/**
 * Builds the GoodFly airliner GLB files (original model, no third-party assets).
 *   node scripts/aircraft/build.ts
 * Output: public/models/goodfly-airliner.glb (desktop) and goodfly-airliner-lite.glb (phones / low-end).
 */
import { Document, NodeIO, type Material, type Mesh, type Texture } from "@gltf-transform/core";
import { ALL_EXTENSIONS, KHRMaterialsClearcoat } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import * as THREE from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as G from "./geometry.ts";
import * as T from "./textures.ts";

const OUT_DIR = fileURLToPath(new URL("../../public/models/", import.meta.url));

type Lod = { name: string; textureScale: number; fuselage: [number, number]; simplifyRatio?: number };
const LODS: Lod[] = [
  { name: "goodfly-airliner", textureScale: 1, fuselage: [96, 160] },
  { name: "goodfly-airliner-lite", textureScale: 0.5, fuselage: [48, 96], simplifyRatio: 0.45 },
];

const linear = (hex: string): [number, number, number, number] => {
  const c = new THREE.Color(hex); // three converts sRGB hex to linear working space
  return [c.r, c.g, c.b, 1];
};

function buildDocument(lod: Lod): Document {
  const doc = new Document();
  doc.getRoot().getAsset().generator = "GoodFly airliner builder";
  const buffer = doc.createBuffer();
  const clearcoat = doc.createExtension(KHRMaterialsClearcoat);

  const png = (name: string, data: Buffer): Texture =>
    doc.createTexture(name).setImage(new Uint8Array(data)).setMimeType("image/png");

  const material = (
    name: string,
    opts: {
      color?: string;
      rough?: number;
      metal?: number;
      coat?: number;
      coatRough?: number;
      tex?: ReturnType<typeof T.wingTextures>;
      /** Engine shells are seen from inside and outside. */
      doubleSided?: boolean;
    },
  ): Material => {
    const m = doc
      .createMaterial(name)
      .setDoubleSided(opts.doubleSided ?? false)
      .setBaseColorFactor(linear(opts.color ?? "#ffffff"))
      .setRoughnessFactor(opts.tex ? 1 : (opts.rough ?? 0.5))
      .setMetallicFactor(opts.tex ? 1 : (opts.metal ?? 0));
    if (opts.tex) {
      m.setBaseColorTexture(png(`${name}_baseColor`, opts.tex.baseColor));
      m.setMetallicRoughnessTexture(png(`${name}_metalRough`, opts.tex.metalRough));
      if (opts.tex.normal) m.setNormalTexture(png(`${name}_normal`, opts.tex.normal)).setNormalScale(0.6);
      // Emissive map ships switched off (factor 0); the site turns the cabin lights on at night.
      if (opts.tex.emissive) m.setEmissiveTexture(png(`${name}_emissive`, opts.tex.emissive)).setEmissiveFactor([0, 0, 0]);
    }
    if (opts.coat) {
      m.setExtension(
        "KHR_materials_clearcoat",
        clearcoat.createClearcoat().setClearcoatFactor(opts.coat).setClearcoatRoughnessFactor(opts.coatRough ?? 0.12),
      );
    }
    return m;
  };

  const primitive = (geo: THREE.BufferGeometry, mat: Material) => {
    const g = geo.index ? geo : mergeVertices(geo);
    const prim = doc.createPrimitive().setMaterial(mat);
    const attr = (name: string, src: THREE.BufferAttribute, type: "VEC3" | "VEC2") =>
      prim.setAttribute(name, doc.createAccessor().setType(type).setArray(new Float32Array(src.array)).setBuffer(buffer));
    attr("POSITION", g.attributes.position as THREE.BufferAttribute, "VEC3");
    attr("NORMAL", g.attributes.normal as THREE.BufferAttribute, "VEC3");
    if (g.attributes.uv) attr("TEXCOORD_0", g.attributes.uv as THREE.BufferAttribute, "VEC2");
    prim.setIndices(doc.createAccessor().setType("SCALAR").setArray(new Uint32Array(g.index!.array)).setBuffer(buffer));
    return prim;
  };

  const mesh = (name: string, parts: [THREE.BufferGeometry, Material][]): Mesh => {
    const m = doc.createMesh(name);
    for (const [geo, mat] of parts) m.addPrimitive(primitive(geo, mat));
    return m;
  };

  const ts = lod.textureScale;
  const P = T.PALETTE;
  const mats = {
    fuselage: material("Fuselage_Paint", { tex: T.fuselageTextures(ts), coat: 0.75, coatRough: 0.1 }),
    pearl: material("Pearl_Paint", { color: P.pearl, rough: 0.32, metal: 0.06, coat: 0.75, coatRough: 0.1, doubleSided: true }),
    wing: material("Wing_Metal", { tex: T.wingTextures(ts) }),
    wingPlain: material("Wing_Metal_Plain", { color: "#d9dee5", rough: 0.46, metal: 0.55 }),
    fin: material("Fin_Navy", { tex: T.finTextures(ts), coat: 0.6, coatRough: 0.14 }),
    gold: material("Champagne_Gold", { color: P.gold, rough: 0.22, metal: 1, doubleSided: true }),
    duct: material("Engine_Duct", { color: "#2b3038", rough: 0.45, metal: 0.6, doubleSided: true }),
    core: material("Engine_Core", { color: "#7b828d", rough: 0.42, metal: 0.9, doubleSided: true }),
    blades: material("Fan_Titanium", { color: "#8f99a6", rough: 0.28, metal: 1 }),
    spinner: material("Spinner_Chrome", { color: "#e9ecf0", rough: 0.16, metal: 0.95, doubleSided: true }),
  };

  const scene = doc.createScene("GoodFly");
  const root = doc.createNode("GoodFly_Airliner");
  scene.addChild(root);

  const add = (name: string, m: Mesh, translation?: [number, number, number]) => {
    const node = doc.createNode(name).setMesh(m);
    if (translation) node.setTranslation(translation);
    root.addChild(node);
    return node;
  };

  add("Fuselage", mesh("Fuselage", [[G.fuselage(...lod.fuselage), mats.fuselage], [G.bellyFairing(), mats.pearl]]));
  add("Wings", mesh("Wings", [[G.wings(), mats.wing], [G.stabilisers(), mats.wing], [G.flapFairings(), mats.wingPlain]]));
  add("Fin", mesh("Fin", [[G.fin(), mats.fin]]));
  add(
    "Engines",
    mesh("Engines", [
      [G.engineParts.cowl(), mats.pearl],
      [G.engineParts.lip(), mats.gold],
      [G.engineParts.duct(), mats.duct],
      [G.engineParts.core(), mats.core],
      [G.engineParts.pylons(), mats.wingPlain],
    ]),
  );
  // One fan mesh shared by both engines; the site spins these two nodes about their local x axis.
  const fan = mesh("Fan", [[G.fanBlades(), mats.blades], [G.spinner(), mats.spinner]]);
  add("Fan_L", fan, G.fanCenter(-1));
  add("Fan_R", fan, G.fanCenter(1));

  return doc;
}

/** Points the site needs (navigation lights, fan nodes), written next to the scene code. */
function writeAnchors() {
  const tip = (side: 1 | -1): [number, number, number] => {
    const t = G.WING[G.WING.length - 1];
    return [t.x - 0.06, t.y + 0.02, side * (t.z + 0.03)];
  };
  const r3 = (v: number[]) => v.map((n) => Math.round(n * 1000) / 1000);
  const tail: [number, number, number] = [-G.HALF - 0.02, G.centerY(-G.HALF), 0];
  const anchors = {
    generatedBy: "scripts/aircraft/build.ts",
    fans: ["Fan_L", "Fan_R"],
    size: { length: G.F.length, span: G.WING[G.WING.length - 1].z * 2 },
    lights: [
      { position: r3(tip(-1)), color: "#ff3b3b", kind: "steady" },
      { position: r3(tip(1)), color: "#3dff8a", kind: "steady" },
      { position: r3(tail), color: "#ffffff", kind: "steady" },
      { position: r3([tip(-1)[0] - 0.22, tip(-1)[1], tip(-1)[2]]), color: "#ffffff", kind: "strobe" },
      { position: r3([tip(1)[0] - 0.22, tip(1)[1], tip(1)[2]]), color: "#ffffff", kind: "strobe" },
      { position: r3([0.2, G.F.radius + 0.03, 0]), color: "#ff4a3d", kind: "beacon" },
      { position: r3([0.6, -G.F.radius - 0.32, 0]), color: "#ff4a3d", kind: "beacon" },
    ],
  };
  const file = fileURLToPath(new URL("../../src/components/aircraft3d/aircraftAnchors.json", import.meta.url));
  writeFileSync(file, JSON.stringify(anchors, null, 2) + "\n");
}

async function main() {
  writeAnchors();
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;
  await MeshoptDecoder.ready;
  mkdirSync(OUT_DIR, { recursive: true });
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

  for (const lod of LODS) {
    const doc = buildDocument(lod);
    await doc.transform(
      dedup(),
      weld(),
      ...(lod.simplifyRatio ? [simplify({ simplifier: MeshoptSimplifier, ratio: lod.simplifyRatio, error: 0.0015 })] : []),
      prune(),
      textureCompress({ encoder: sharp, targetFormat: "webp", slots: /normalTexture/, quality: 92 }),
      textureCompress({ encoder: sharp, targetFormat: "webp", quality: 86 }),
      meshopt({ encoder: MeshoptEncoder, level: "medium" }),
    );

    let triangles = 0;
    let drawCalls = 0;
    for (const m of doc.getRoot().listMeshes()) {
      for (const p of m.listPrimitives()) {
        triangles += (p.getIndices()?.getCount() ?? 0) / 3;
        drawCalls += 1;
      }
    }
    const file = `${OUT_DIR}${lod.name}.glb`;
    await io.write(file, doc);
    const kb = Math.round(statSync(file).size / 1024);
    console.log(`${lod.name}.glb  ${kb} KB  ${Math.round(triangles)} triangles  ${drawCalls + 1} draw calls (incl. 2nd fan)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
