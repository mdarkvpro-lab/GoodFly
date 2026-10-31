// Checks the generated GoodFly airliner files: budgets, structure, compression and posters.
//   node tests/model/model.test.ts   (run `npm run build:aircraft` first after changing the model)
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../../", import.meta.url));
const anchors = JSON.parse(readFileSync(`${root}src/components/aircraft3d/aircraftAnchors.json`, "utf8"));
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });

let pass = 0;
let fail = 0;
async function check(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    pass++;
    console.log("  ✓", name);
  } catch (e) {
    fail++;
    console.log("  ✘", name, "—", (e as Error).message);
  }
}
function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const models = [
  { file: "public/models/goodfly-airliner.glb", maxKB: 1200, minTris: 25_000, maxTris: 120_000 },
  { file: "public/models/goodfly-airliner-lite.glb", maxKB: 500, minTris: 6_000, maxTris: 30_000 },
];

for (const m of models) {
  console.log(m.file);
  const path = root + m.file;
  await check("file exists", () => assert(existsSync(path), "missing — run npm run build:aircraft"));
  if (!existsSync(path)) continue;
  const doc = await io.read(path);
  const used = doc.getRoot().listExtensionsUsed().map((e) => e.extensionName);

  await check(`size within ${m.maxKB} KB`, () => {
    const kb = statSync(path).size / 1024;
    assert(kb <= m.maxKB, `${Math.round(kb)} KB`);
  });
  await check(`triangles between ${m.minTris} and ${m.maxTris}`, () => {
    let tris = 0;
    for (const mesh of doc.getRoot().listMeshes()) for (const p of mesh.listPrimitives()) tris += (p.getIndices()?.getCount() ?? 0) / 3;
    assert(tris >= m.minTris && tris <= m.maxTris, `${tris}`);
  });
  await check("geometry is meshopt-compressed", () => assert(used.includes("EXT_meshopt_compression"), used.join(", ")));
  await check("textures are WebP", () => {
    const types = doc.getRoot().listTextures().map((t) => t.getMimeType());
    assert(types.length > 0 && types.every((t) => t === "image/webp"), types.join(", "));
  });
  await check("glossy paint uses clearcoat", () => assert(used.includes("KHR_materials_clearcoat"), used.join(", ")));
  await check("both fan nodes are present", () => {
    const names = doc.getRoot().listNodes().map((n) => n.getName());
    for (const fan of anchors.fans) assert(names.includes(fan), `missing ${fan}`);
  });
  await check("fuselage has colour, metal/roughness, normal and night-glow maps", () => {
    const mat = doc.getRoot().listMaterials().find((x) => x.getName() === "Fuselage_Paint");
    assert(mat, "no Fuselage_Paint material");
    assert(mat.getBaseColorTexture() && mat.getMetallicRoughnessTexture() && mat.getNormalTexture(), "missing PBR maps");
    assert(mat.getEmissiveTexture(), "missing cabin glow map");
    assert(mat.getEmissiveFactor().every((v) => v === 0), "cabin glow must ship switched off");
  });
}

console.log("posters");
for (const theme of ["light", "dark"]) {
  for (const dir of ["ltr", "rtl"]) {
    const file = `${root}public/aircraft/poster-${theme}-${dir}.webp`;
    await check(`poster-${theme}-${dir}.webp is a 1920×800 transparent WebP under 120 KB`, async () => {
      assert(existsSync(file), "missing — run npm run build:aircraft");
      const meta = await sharp(file).metadata();
      assert(meta.format === "webp" && meta.width === 1920 && meta.height === 800 && meta.hasAlpha, JSON.stringify(meta));
      assert(statSync(file).size < 120 * 1024, `${Math.round(statSync(file).size / 1024)} KB`);
    });
  }
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
