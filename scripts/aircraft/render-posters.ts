/**
 * Renders the hero poster stills from the real GLB (light/dark × ltr/rtl), transparent background.
 *   node scripts/aircraft/render-posters.ts
 * Output: public/aircraft/poster-{light,dark}-{ltr,rtl}.webp
 */
import { chromium } from "@playwright/test";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const OUT = join(ROOT, "public/aircraft");
// Only these folders are served by the throwaway renderer server.
const ALLOWED = ["scripts/aircraft/", "node_modules/three/", "public/models/", "src/components/aircraft3d/"];
const TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".json": "application/json",
  ".glb": "model/gltf-binary",
  ".wasm": "application/wasm",
};

const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent((req.url ?? "/").split("?")[0])).replace(/^\/+/, "");
  const file = join(ROOT, path);
  if (!ALLOWED.some((p) => path.startsWith(p)) || !file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
});

await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = (server.address() as { port: number }).port;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  for (const theme of ["light", "dark"]) {
    for (const dir of ["ltr", "rtl"]) {
      const page = await browser.newPage({ viewport: { width: 1920, height: 800 } });
      page.on("pageerror", (e) => console.error("page error:", e.message));
      await page.goto(`http://127.0.0.1:${port}/scripts/aircraft/poster.html?theme=${theme}&dir=${dir}`);
      await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 120_000 });
      const png = await page.locator("canvas").screenshot({ omitBackground: true });
      const file = join(OUT, `poster-${theme}-${dir}.webp`);
      await sharp(png).webp({ quality: 88, alphaQuality: 90 }).toFile(file);
      console.log(`poster-${theme}-${dir}.webp  ${Math.round(statSync(file).size / 1024)} KB`);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
