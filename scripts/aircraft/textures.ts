/**
 * Procedural PBR textures for the GoodFly airliner (albedo, metal/roughness, normal).
 * glTF conventions: UV (0,0) is the top-left of the image; metal/roughness uses G = roughness, B = metalness.
 */
import { createCanvas, GlobalFonts, type SKRSContext2D } from "@napi-rs/canvas";
import { fileURLToPath } from "node:url";
import { F, fuselageUV, HALF } from "./geometry.ts";

GlobalFonts.registerFromPath(fileURLToPath(new URL("./fonts/Manrope.ttf", import.meta.url)), "Manrope");

export const PALETTE = {
  pearl: "#f6f7f9",
  belly: "#e7ebf0",
  navy: "#12234a",
  gold: "#c8a96a",
  glass: "#0d1522",
  seam: "#dfe3e9",
};

type Tex = { baseColor: Buffer; metalRough: Buffer; normal?: Buffer; emissive?: Buffer };

/** Height map (grey = flat, darker = recessed) → tangent-space normal map. */
function heightToNormal(ctx: SKRSContext2D, w: number, h: number, strength: number): Buffer {
  const src = ctx.getImageData(0, 0, w, h).data;
  const out = createCanvas(w, h);
  const octx = out.getContext("2d");
  const img = octx.createImageData(w, h);
  const H = (x: number, y: number) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const len = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      img.data[i] = ((-dx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / len) * 0.5 + 0.5) * 255; // +Y up (glTF / OpenGL convention)
      img.data[i + 2] = ((1 / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out.toBuffer("image/png");
}

function canvas(w: number, h: number, fill: string) {
  const c = createCanvas(w, h);
  const ctx = c.getContext("2d");
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, w, h);
  return { c, ctx };
}

/** Roughness / metalness packed as glTF expects (R unused = 255). */
const mr = (roughness: number, metal: number) =>
  `rgb(255, ${Math.round(roughness * 255)}, ${Math.round(metal * 255)})`;

// ───────────── Fuselage ─────────────

export function fuselageTextures(scale = 1): Tex {
  const W = Math.round(1024 * scale); // around the body
  const H = Math.round(3072 * scale); // along the body (tail at the top)
  const X = (u: number) => u * W;
  const Y = (x: number) => fuselageUV.v(x) * H;
  const pxAround = W / (2 * Math.PI * F.radius); // pixels per unit around
  const pxAlong = H / F.length; // pixels per unit along

  const base = canvas(W, H, PALETTE.pearl);
  const rough = canvas(W, H, mr(0.34, 0.06));
  const height = canvas(W, H, "rgb(128,128,128)");
  // Night cabin glow: windows only (half resolution). The site switches it on in the dark theme.
  const glow = canvas(W / 2, H / 2, "#000000");

  // Belly tone (h < −0.55 on both sides, the seam sits on the belly at u = 0 / 1)
  const bellyU = fuselageUV.u(-0.55, "left");
  base.ctx.fillStyle = PALETTE.belly;
  base.ctx.fillRect(0, 0, X(bellyU), H);
  base.ctx.fillRect(X(1 - bellyU), 0, W - X(1 - bellyU), H);

  const sides = ["left", "right"] as const;

  // Navy pinstripe and champagne-gold line below the windows
  for (const side of sides) {
    const stripe = (h: number, color: string, thick: number, from: number, to: number) => {
      const u = X(fuselageUV.u(h, side));
      base.ctx.fillStyle = color;
      base.ctx.fillRect(u - thick / 2, Y(from), thick, Y(to) - Y(from));
    };
    stripe(-0.16, PALETTE.navy, 9 * scale, -2.6, 3.55);
    stripe(-0.24, PALETTE.gold, 4 * scale, -2.3, 3.45);
  }

  // Panel seams (height map): circumferential every 0.55, plus longitudinal lines
  height.ctx.strokeStyle = "rgb(70,70,70)";
  height.ctx.lineWidth = 1.6 * scale;
  for (let x = -HALF + 0.6; x < HALF - 0.4; x += 0.55) {
    height.ctx.beginPath();
    height.ctx.moveTo(0, Y(x));
    height.ctx.lineTo(W, Y(x));
    height.ctx.stroke();
  }
  for (const h of [-0.82, -0.45, 0.62, 0.9]) {
    for (const side of sides) {
      const u = X(fuselageUV.u(h, side));
      height.ctx.beginPath();
      height.ctx.moveTo(u, Y(-3.6));
      height.ctx.lineTo(u, Y(3.9));
      height.ctx.stroke();
    }
  }
  // Radome seam
  height.ctx.beginPath();
  height.ctx.moveTo(0, Y(4.05));
  height.ctx.lineTo(W, Y(4.05));
  height.ctx.stroke();
  // Nose landing-gear doors on the belly (the UV seam runs along the belly, so draw at both edges)
  {
    const uL = X(fuselageUV.u(-0.88, "left"));
    const uR = X(fuselageUV.u(-0.88, "right"));
    height.ctx.beginPath();
    for (const [x0, x1] of [[0, uL], [uR, W]]) {
      height.ctx.moveTo(x0, Y(3.15));
      height.ctx.lineTo(x1, Y(3.15));
      height.ctx.moveTo(x0, Y(3.72));
      height.ctx.lineTo(x1, Y(3.72));
    }
    height.ctx.moveTo(uL, Y(3.15));
    height.ctx.lineTo(uL, Y(3.72));
    height.ctx.moveTo(uR, Y(3.15));
    height.ctx.lineTo(uR, Y(3.72));
    height.ctx.stroke();
  }

  // Doors (outline in albedo + recessed seam), windows (glass) on both sides
  const doors = [2.98, 1.12, -0.42, -2.02];
  const winH = 0.12;
  for (const side of sides) {
    const uWin = X(fuselageUV.u(winH, side));
    for (const dx of doors) {
      const w = 0.26 * pxAlong;
      const hgt = 0.56 * pxAround;
      const cx = uWin;
      const cy = Y(dx);
      for (const ctx of [height.ctx, base.ctx]) {
        ctx.strokeStyle = ctx === base.ctx ? PALETTE.seam : "rgb(60,60,60)";
        ctx.lineWidth = (ctx === base.ctx ? 1.6 : 2.2) * scale;
        ctx.beginPath();
        ctx.roundRect(cx - hgt * 0.42, cy - w / 2, hgt, w, 10 * scale);
        ctx.stroke();
      }
      // Small door window
      base.ctx.fillStyle = PALETTE.glass;
      base.ctx.beginPath();
      base.ctx.roundRect(cx - 0.05 * pxAround, cy - 0.025 * pxAlong, 0.1 * pxAround, 0.05 * pxAlong, 6 * scale);
      base.ctx.fill();
    }
    for (let x = -2.25; x < 2.8; x += 0.132) {
      if (doors.some((d) => Math.abs(x - d) < 0.2)) continue;
      const cx = uWin;
      const cy = Y(x);
      const ww = 0.098 * pxAround;
      const wh = 0.062 * pxAlong;
      base.ctx.fillStyle = PALETTE.glass;
      base.ctx.beginPath();
      base.ctx.roundRect(cx - ww / 2, cy - wh / 2, ww, wh, Math.min(ww, wh) * 0.45);
      base.ctx.fill();
      rough.ctx.fillStyle = mr(0.06, 0.7);
      rough.ctx.beginPath();
      rough.ctx.roundRect(cx - ww / 2, cy - wh / 2, ww, wh, Math.min(ww, wh) * 0.45);
      rough.ctx.fill();
      glow.ctx.fillStyle = "#ffffff";
      glow.ctx.beginPath();
      glow.ctx.roundRect((cx - ww / 2) / 2, (cy - wh / 2) / 2, ww / 2, wh / 2, Math.min(ww, wh) * 0.22);
      glow.ctx.fill();
      height.ctx.fillStyle = "rgb(105,105,105)";
      height.ctx.beginPath();
      height.ctx.roundRect(cx - ww / 2 - 2, cy - wh / 2 - 2, ww + 4, wh + 4, Math.min(ww, wh) * 0.5);
      height.ctx.fill();
    }
  }

  // Cockpit windshield: one band per side split by a pillar; the gap at the top is the centre post.
  for (const side of sides) {
    const pt = (h: number, x: number): [number, number] => [X(fuselageUV.u(h, side)), Y(x)];
    // [height, x] corners; heights are relative to the local radius, so they follow the nose taper.
    const panes: [number, number][][] = [
      // side pane (rear)
      [[0.24, 3.42], [0.6, 3.41], [0.7, 3.585], [0.26, 3.605]],
      // front pane
      [[0.27, 3.63], [0.72, 3.605], [0.86, 3.78], [0.3, 3.82]],
    ];
    for (const pane of panes) {
      const poly = pane.map(([h, x]) => pt(h, x));
      for (const [ctx, fill, k] of [
        [base.ctx, PALETTE.glass, 1],
        [rough.ctx, mr(0.04, 0.75), 1],
        [glow.ctx, "#3a4d70", 0.5],
      ] as const) {
        ctx.fillStyle = fill;
        ctx.beginPath();
        poly.forEach(([x, y], i) => (i ? ctx.lineTo(x * k, y * k) : ctx.moveTo(x * k, y * k)));
        ctx.closePath();
        ctx.fill();
      }
      // Frame seam around each pane
      height.ctx.strokeStyle = "rgb(80,80,80)";
      height.ctx.lineWidth = 2 * scale;
      height.ctx.beginPath();
      poly.forEach(([x, y], i) => (i ? height.ctx.lineTo(x, y) : height.ctx.moveTo(x, y)));
      height.ctx.closePath();
      height.ctx.stroke();
    }
  }

  // Wordmark "GoodFly" + gold dot above the forward windows, readable on both sides
  for (const side of sides) {
    const ctx = base.ctx;
    const size = 0.25 * pxAround;
    ctx.save();
    ctx.translate(X(fuselageUV.u(0.48, side)), Y(2.05));
    // Text runs nose-wards on the right side and tail-wards on the left (as seen by a viewer);
    // the body mapping mirrors the image, hence the reflection after the rotation.
    ctx.rotate(side === "right" ? Math.PI / 2 : -Math.PI / 2);
    ctx.scale(1, -1);
    ctx.font = `800 ${size}px Manrope`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = PALETTE.navy;
    ctx.fillText("GoodFly", 0, 0);
    const wText = ctx.measureText("GoodFly").width;
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.arc(wText / 2 + size * 0.28, size * 0.2, size * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  return {
    baseColor: base.c.toBuffer("image/png"),
    metalRough: rough.c.toBuffer("image/png"),
    normal: heightToNormal(height.ctx, W, H, 2.2),
    emissive: glow.c.toBuffer("image/png"),
  };
}

// ───────────── Wings & stabilisers ─────────────

export function wingTextures(scale = 1): Tex {
  const W = Math.round(1024 * scale); // around the airfoil (0 TE → 0.5 LE → 1 TE)
  const H = Math.round(512 * scale); // along the span
  const base = canvas(W, H, "#d9dee5");
  const rough = canvas(W, H, mr(0.46, 0.55));
  const height = canvas(W, H, "rgb(128,128,128)");

  // Polished leading edge band
  base.ctx.fillStyle = "#c7ced8";
  base.ctx.fillRect(W * 0.43, 0, W * 0.14, H);
  rough.ctx.fillStyle = mr(0.22, 0.85);
  rough.ctx.fillRect(W * 0.43, 0, W * 0.14, H);

  // Slightly varied panel tones (upper and lower skins)
  let s = 5;
  const rand = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 40; i++) {
    const u = rand() * 0.86 + 0.07;
    if (u > 0.4 && u < 0.6) continue;
    const v = rand();
    base.ctx.fillStyle = `rgba(150,160,175,${0.04 + rand() * 0.05})`;
    base.ctx.fillRect(u * W, v * H, W * 0.08, H * 0.12);
  }

  // Seams: chordwise lines across the span, spanwise lines (spar lines, flaps, ailerons)
  height.ctx.strokeStyle = "rgb(70,70,70)";
  height.ctx.lineWidth = 1.5 * scale;
  for (let v = 0.06; v < 1; v += 0.075) {
    height.ctx.beginPath();
    height.ctx.moveTo(0, v * H);
    height.ctx.lineTo(W, v * H);
    height.ctx.stroke();
  }
  for (const u of [0.08, 0.16, 0.3, 0.43, 0.57, 0.7, 0.84, 0.92]) {
    height.ctx.beginPath();
    height.ctx.moveTo(u * W, 0);
    height.ctx.lineTo(u * W, H);
    height.ctx.stroke();
  }
  // Flap / aileron gaps (deeper) near the trailing edge on the upper skin
  height.ctx.strokeStyle = "rgb(40,40,40)";
  height.ctx.lineWidth = 2.4 * scale;
  for (const [u, v0, v1] of [
    [0.11, 0.0, 0.62],
    [0.11, 0.66, 0.9],
    [0.89, 0.0, 0.62],
  ] as const) {
    height.ctx.beginPath();
    height.ctx.moveTo(u * W, v0 * H);
    height.ctx.lineTo(u * W, v1 * H);
    height.ctx.stroke();
  }

  return {
    baseColor: base.c.toBuffer("image/png"),
    metalRough: rough.c.toBuffer("image/png"),
    normal: heightToNormal(height.ctx, W, H, 2.0),
  };
}

// ───────────── Tail fin (original GoodFly emblem) ─────────────

export function finTextures(scale = 1): Tex {
  const W = Math.round(2048 * scale); // around (each half is one side of the fin)
  const H = Math.round(1024 * scale); // root → tip
  const base = canvas(W, H, PALETTE.navy);
  const rough = canvas(W, H, mr(0.3, 0.12));

  // The fin image is ~1.6× denser along the chord than along the span, so shapes are stretched in x here.
  const sx = 1.6;
  for (const center of [0.25, 0.75]) {
    const cx = center * W;
    const half = W / 2;
    // Flight-path arc: rises from the lower trailing edge towards the dot.
    for (const [ctx, style, width] of [
      [base.ctx, PALETTE.gold, 7 * scale],
      [rough.ctx, mr(0.38, 0.5), 7 * scale],
    ] as const) {
      ctx.strokeStyle = style;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      const dirX = center < 0.5 ? -1 : 1; // trailing edge is at u = 0 on one half and u = 1 on the other
      // Image y runs root (0) → tip (H): start low near the trailing edge, rise towards the dot.
      ctx.moveTo(cx + dirX * half * 0.36, H * 0.1);
      ctx.quadraticCurveTo(cx + dirX * half * 0.04, H * 0.24, cx - dirX * half * 0.05, H * 0.56);
      ctx.stroke();
    }
    // Brand dot
    const r = H * 0.085;
    for (const [ctx, style] of [
      [base.ctx, PALETTE.gold],
      [rough.ctx, mr(0.36, 0.55)],
    ] as const) {
      ctx.fillStyle = style;
      ctx.beginPath();
      ctx.ellipse(cx - (center < 0.5 ? -1 : 1) * half * 0.07, H * 0.68, r * sx, r, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  return { baseColor: base.c.toBuffer("image/png"), metalRough: rough.c.toBuffer("image/png") };
}
