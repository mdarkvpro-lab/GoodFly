/**
 * Close-up review renders of the GLB while modelling (not used by the site).
 *   node scripts/aircraft/preview.ts <out-dir> [view ...]   views: nose, side, poster
 */
import { chromium } from "@playwright/test";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const [out = join(ROOT, ".preview"), ...views] = process.argv.slice(2);
const ALLOWED = ["scripts/aircraft/", "node_modules/three/", "public/models/", "src/components/aircraft3d/"];
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".json": "application/json", ".glb": "model/gltf-binary" };
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
await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
const port = (server.address() as { port: number }).port;
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
try {
  for (const view of views.length ? views : ["nose", "side"]) {
    const page = await browser.newPage({ viewport: { width: 1920, height: 800 } });
    page.on("pageerror", (e) => console.error("page error:", e.message));
    const v = view === "poster" ? "" : `&view=${view}`;
    await page.goto(`http://127.0.0.1:${port}/scripts/aircraft/poster.html?theme=light&dir=ltr${v}`);
    await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true, null, { timeout: 120_000 });
    await page.evaluate(() => (document.body.style.background = "#e5f1ff"));
    const file = join(out, `${view}.jpg`);
    await page.screenshot({ path: file, type: "jpeg", quality: 82 });
    console.log(file);
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}
