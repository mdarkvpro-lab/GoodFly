/**
 * GoodFly airliner — original geometry (no third-party model).
 * Modern twin-engine wide-body proportions. Units ≈ 6.4 m. Nose +x, up +y, right wing +z.
 */
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const F = { length: 9, radius: 0.44, noseStart: 2.7, tailStart: -2.2 };
export const HALF = F.length / 2;

/** Fuselage centre line: flat, then a long up-sweep to the tail cone. */
export function centerY(x: number): number {
  if (x >= F.tailStart) return 0;
  const t = (F.tailStart - x) / (F.tailStart + HALF);
  return 0.42 * t * t;
}

function radiusAt(x: number): number {
  const R = F.radius;
  if (x < F.tailStart) {
    const t = Math.max(0, (x + HALF) / (F.tailStart + HALF));
    const s = t * t * (3 - 2 * t);
    return R * (0.09 + 0.91 * s);
  }
  if (x > F.noseStart) {
    // Long ogive nose (~2 diameters): stays full for a while, then tapers to a rounded tip.
    const t = Math.min(1, (x - F.noseStart) / (HALF - F.noseStart));
    return R * Math.pow(Math.max(0, 1 - Math.pow(t, 2.4)), 0.55);
  }
  return R;
}

/**
 * Fuselage lathe. The UV seam runs along the belly:
 * u = 0 bottom → 0.25 left side → 0.5 top → 0.75 right side; v = 0 tail → 1 nose.
 */
export function fuselage(radial = 96, along = 160): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= along; i++) {
    // Denser sampling at nose and tail where the shape changes fastest.
    const s = i / along;
    const x = -HALF + F.length * (0.5 - 0.5 * Math.cos(Math.PI * s));
    pts.push(new THREE.Vector2(Math.max(radiusAt(x), 0.0005), x));
  }
  const geo = new THREE.LatheGeometry(pts, radial, Math.PI / 2, Math.PI * 2);
  geo.rotateZ(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    let y = pos.getY(i);
    if (x > F.noseStart) {
      // Airliner nose: the crown slopes down to the tip while the belly line stays nearly level.
      const t = (x - F.noseStart) / (HALF - F.noseStart);
      if (y < 0) y *= 1 - 0.45 * t;
      y -= 0.32 * F.radius * t * t;
    }
    pos.setY(i, y + centerY(x));
  }
  // Lathe UV v follows point order (tail first) but samples are cosine-spaced: remap v to true length.
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    uv.setY(i, (pos.getX(i) + HALF) / F.length);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Fuselage UV helpers shared with the livery painter. */
export const fuselageUV = {
  v: (x: number) => (x + HALF) / F.length,
  /** Height h (−1 bottom … 1 top) on a side → u. */
  u: (h: number, side: "left" | "right") => {
    const a = Math.acos(Math.max(-1, Math.min(1, -h))) / (2 * Math.PI);
    return side === "left" ? a : 1 - a;
  },
};

export type Section = { x: number; y: number; z: number; chord: number; t: number };

function airfoil(n: number): [number, number][] {
  const th = (x: number) => 5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
  const loop: [number, number][] = [];
  for (let k = n; k >= 0; k--) {
    const x = (1 - Math.cos((Math.PI * k) / n)) / 2;
    loop.push([x, th(x)]);
  }
  for (let k = 1; k <= n; k++) {
    const x = (1 - Math.cos((Math.PI * k) / n)) / 2;
    loop.push([x, -th(x)]);
  }
  return loop; // closed: first and last are both the trailing edge
}

/**
 * Lofted lifting surface through any number of sections.
 * axis "z": horizontal (wings, stabilisers), thickness along y.
 * axis "y": vertical (fin, pylons), thickness along z.
 * UV: u = chord position around the section (0 trailing edge → 0.5 leading edge → 1), v = along the span.
 */
export function loft(sections: Section[], axis: "z" | "y", n = 20): THREE.BufferGeometry {
  const loop = airfoil(n);
  const P = loop.length;
  const positions: number[] = [];
  const uvs: number[] = [];
  const spanLen: number[] = [0];
  for (let s = 1; s < sections.length; s++) {
    const a = sections[s - 1];
    const b = sections[s];
    spanLen.push(spanLen[s - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  }
  const total = spanLen[spanLen.length - 1];

  sections.forEach((sec, s) => {
    loop.forEach(([xc, yt], k) => {
      const x = sec.x - xc * sec.chord;
      const th = yt * sec.t * sec.chord;
      if (axis === "z") positions.push(x, sec.y + th, sec.z);
      else positions.push(x, sec.y, sec.z + th);
      // u is linear in chord position (upper skin 0 → 0.5, lower skin 0.5 → 1) so textures are not squeezed at the edges.
      uvs.push(k <= n ? 0.5 * (1 - xc) : 0.5 + 0.5 * xc, spanLen[s] / total);
    });
  });

  const index: number[] = [];
  for (let s = 0; s < sections.length - 1; s++) {
    const a = s * P;
    const b = (s + 1) * P;
    for (let i = 0; i < P - 1; i++) index.push(a + i, b + i, b + i + 1, a + i, b + i + 1, a + i + 1);
  }
  // Tip cap (fan from the leading edge point of the last section).
  const last = (sections.length - 1) * P;
  const le = last + n;
  for (let i = 0; i < P - 1; i++) if (i !== n && i + 1 !== n) index.push(le, last + i + 1, last + i);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(index);
  geo.computeVertexNormals();

  // Upper surface (first half of the loop) must face +y (or +z for vertical panels).
  const probe = Math.floor(n / 2);
  const nrm = new THREE.Vector3().fromBufferAttribute(geo.attributes.normal, probe);
  if ((axis === "z" ? nrm.y : nrm.z) < 0) {
    const idx = geo.index!;
    for (let i = 0; i < idx.count; i += 3) {
      const t = idx.getX(i + 1);
      idx.setX(i + 1, idx.getX(i + 2));
      idx.setX(i + 2, t);
    }
    geo.computeVertexNormals();
  }
  return geo;
}

const mirrorZ = (sections: Section[]) => sections.map((s) => ({ ...s, z: -s.z }));

// ───────────── Wing (raked tips, no winglets) ─────────────
export const WING: Section[] = [
  { x: 1.25, y: -0.27, z: 0.3, chord: 2.5, t: 0.13 },
  { x: 0.35, y: -0.21, z: 1.55, chord: 1.45, t: 0.115 },
  { x: -1.55, y: -0.02, z: 4.0, chord: 0.58, t: 0.095 },
  { x: -2.15, y: 0.04, z: 4.36, chord: 0.16, t: 0.09 },
];

/** Leading edge / lower surface height of the wing at a given span z (right wing). */
export function wingAt(z: number) {
  const zz = Math.abs(z);
  for (let i = 1; i < WING.length; i++) {
    const a = WING[i - 1];
    const b = WING[i];
    if (zz <= b.z) {
      const t = (zz - a.z) / (b.z - a.z);
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, chord: a.chord + (b.chord - a.chord) * t };
    }
  }
  const l = WING[WING.length - 1];
  return { x: l.x, y: l.y, chord: l.chord };
}

export function wings(): THREE.BufferGeometry {
  return mergeGeometries([loft(WING, "z"), loft(mirrorZ(WING), "z")])!;
}

export function stabilisers(): THREE.BufferGeometry {
  const y0 = centerY(-3.3) + 0.06;
  const S: Section[] = [
    { x: -2.95, y: y0, z: 0.14, chord: 1.15, t: 0.1 },
    { x: -3.9, y: y0 + 0.2, z: 1.7, chord: 0.42, t: 0.09 },
  ];
  return mergeGeometries([loft(S, "z", 16), loft(mirrorZ(S), "z", 16)])!;
}

export function fin(): THREE.BufferGeometry {
  const y0 = centerY(-2.9) + F.radius * 0.62;
  return loft(
    [
      { x: -2.62, y: y0, z: 0, chord: 1.65, t: 0.1 },
      { x: -3.92, y: y0 + 1.8, z: 0, chord: 0.62, t: 0.09 },
    ],
    "y",
    18,
  );
}

/** Belly fairing where the wing meets the fuselage. */
export function bellyFairing(): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(1, 48, 24);
  g.scale(2.05, 0.3, 0.52);
  g.translate(0.2, -0.33, 0);
  return g;
}

/** Flap-track fairings under the trailing edge. */
export function flapFairings(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (const side of [1, -1]) {
    for (const z of [1.15, 2.15, 3.05]) {
      const w = wingAt(z);
      const g = new THREE.SphereGeometry(1, 20, 10);
      g.scale(0.48, 0.065, 0.06);
      g.translate(w.x - w.chord * 0.78, w.y - 0.07, side * z);
      parts.push(g);
    }
  }
  return mergeGeometries(parts)!;
}

// ───────────── Engines ─────────────
export const ENGINE = { x: 0.82, y: -0.64, z: 1.85, front: 0.7, rear: -0.64 };

function latheX(profile: [number, number][], segments: number): THREE.BufferGeometry {
  const g = new THREE.LatheGeometry(profile.map(([r, x]) => new THREE.Vector2(r, x)), segments);
  g.rotateZ(-Math.PI / 2); // lathe axis +y → +x
  return g;
}

/** Outer cowl with a serrated (chevron) trailing edge. */
function cowl(): THREE.BufferGeometry {
  // Profiles run rear → front (increasing x) so the lathe normals face outwards.
  const prof: [number, number][] = [
    [0.222, -0.64],
    [0.238, -0.56],
    [0.27, -0.32],
    [0.286, 0.0],
    [0.288, 0.3],
    [0.278, 0.5],
    [0.268, 0.6],
    [0.264, 0.645],
  ];
  const g = latheX(prof, 96);
  const pos = g.attributes.position;
  const chevrons = 18;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    if (x < -0.6) {
      const phi = Math.atan2(pos.getZ(i), pos.getY(i));
      // Soft scalloped edge (cosine, shallow) rather than sharp teeth.
      const wave = 0.5 + 0.5 * Math.cos(phi * chevrons);
      pos.setX(i, x + 0.022 * wave - 0.01);
    }
  }
  g.computeVertexNormals();
  return g;
}

/** Polished intake lip (champagne gold band). */
function lip(): THREE.BufferGeometry {
  return latheX(
    [
      [0.234, 0.64],
      [0.244, 0.69],
      [0.258, 0.7],
      [0.268, 0.675],
      [0.264, 0.64],
    ],
    96,
  );
}

/** Inner duct from the lip to the fan face. */
function duct(): THREE.BufferGeometry {
  const g = latheX(
    [
      [0.236, 0.6],
      [0.232, 0.48],
      [0.228, 0.36],
    ],
    64,
  );
  g.scale(1, 1, 1);
  return g;
}

/** Core nozzle and a short exhaust plug, mostly tucked inside the cowl like a modern high-bypass fan. */
function core(): THREE.BufferGeometry {
  return latheX(
    [
      [0.002, -0.96],
      [0.035, -0.93],
      [0.07, -0.86],
      [0.09, -0.8],
      [0.108, -0.79],
      [0.13, -0.76],
      [0.168, -0.66],
      [0.2, -0.5],
    ],
    64,
  );
}

/** Fan face disc behind the blades. */
function fanDisc(): THREE.BufferGeometry {
  const g = new THREE.CircleGeometry(0.228, 64);
  g.rotateY(Math.PI / 2);
  g.translate(0.3, 0, 0);
  return g;
}

/** 22 twisted fan blades (merged), centred on the fan axis at the origin. */
export function fanBlades(): THREE.BufferGeometry {
  const blades: THREE.BufferGeometry[] = [];
  const count = 22;
  for (let i = 0; i < count; i++) {
    const g = new THREE.BoxGeometry(0.014, 0.17, 0.07, 1, 8, 1);
    g.translate(0, 0.055 + 0.085, 0);
    const pos = g.attributes.position;
    for (let k = 0; k < pos.count; k++) {
      const r = pos.getY(k);
      const twist = 0.9 - r * 2.4; // more pitch at the root, flatter at the tip
      const x = pos.getX(k);
      const z = pos.getZ(k);
      pos.setX(k, x * Math.cos(twist) - z * Math.sin(twist));
      pos.setZ(k, x * Math.sin(twist) + z * Math.cos(twist));
    }
    g.rotateX((i / count) * Math.PI * 2);
    blades.push(g);
  }
  const merged = mergeGeometries(blades)!;
  merged.computeVertexNormals();
  return merged;
}

export function spinner(): THREE.BufferGeometry {
  return latheX(
    [
      [0.064, -0.03],
      [0.066, 0.0],
      [0.055, 0.07],
      [0.03, 0.115],
      [0.0005, 0.13],
    ],
    48,
  );
}

function pylon(): THREE.BufferGeometry {
  const w = wingAt(ENGINE.z);
  return loft(
    [
      { x: 0.55, y: 0.2, z: 0, chord: 1.15, t: 0.15 },
      { x: w.x - ENGINE.x + 0.15, y: w.y - ENGINE.y - 0.02, z: 0, chord: 1.35, t: 0.13 },
    ],
    "y",
    12,
  );
}

const at = (g: THREE.BufferGeometry, side: 1 | -1) => g.clone().translate(ENGINE.x, ENGINE.y, side * ENGINE.z);
const both = (make: () => THREE.BufferGeometry) => mergeGeometries([at(make(), 1), at(make(), -1)])!;

export const engineParts = {
  cowl: () => both(cowl),
  lip: () => both(lip),
  duct: () => mergeGeometries([both(duct), both(fanDisc)])!,
  core: () => both(core),
  pylons: () => both(pylon),
};

/** Fan centre in aircraft space (blades spin about +x here). */
export const fanCenter = (side: 1 | -1): [number, number, number] => [ENGINE.x + 0.36, ENGINE.y, side * ENGINE.z];
