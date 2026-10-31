// Owner console: security (local-only, passcode, lockout, CSRF, origin, session expiry) and rules.
//   node tests/owner/owner.test.ts
import { createServer, request, type Server } from "node:http";
import { Guard, hashPasscode } from "../../owner-console/lib/auth.ts";
import { MemoryStore } from "../../owner-console/lib/memoryStore.ts";
import { createApp } from "../../owner-console/server.ts";

const PASS = "correct horse battery";
const HASH = hashPasscode(PASS);

type Res = { status: number; headers: Record<string, string | string[] | undefined>; body: string };

async function start(opts: { now?: () => number } = {}) {
  const store = new MemoryStore();
  // The guard needs the real port, which is only known once the server listens.
  const app: { handle?: ReturnType<typeof createApp> } = {};
  const server: Server = createServer((req, res) => void app.handle?.(req, res));
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const guard = new Guard(HASH, port, opts.now);
  app.handle = createApp({ store, guard, maxDirection: 2, demo: false });
  let cookie = "";

  const call = (method: string, path: string, opts2: { form?: Record<string, string>; headers?: Record<string, string> } = {}) =>
    new Promise<Res>((resolve, reject) => {
      const body = opts2.form ? new URLSearchParams(opts2.form).toString() : "";
      const req = request(
        {
          host: "127.0.0.1",
          port,
          method,
          path,
          headers: {
            host: `127.0.0.1:${port}`,
            ...(method === "POST" ? { origin: `http://127.0.0.1:${port}`, "content-type": "application/x-www-form-urlencoded" } : {}),
            ...(cookie ? { cookie } : {}),
            ...opts2.headers,
          },
        },
        (res) => {
          let data = "";
          res.on("data", (c) => (data += c));
          res.on("end", () => {
            const set = res.headers["set-cookie"];
            if (set) cookie = set[0].split(";")[0];
            resolve({ status: res.statusCode ?? 0, headers: res.headers, body: data });
          });
        },
      );
      req.on("error", reject);
      req.end(body);
    });

  const csrf = async () => {
    const page = await call("GET", "/");
    const m = page.body.match(/name="csrf" value="([^"]+)"/);
    if (!m) throw new Error("no csrf token on page");
    return m[1];
  };
  const login = () => call("POST", "/login", { form: { passcode: PASS } });
  const byName = (name: string) => store.accounts.find((a) => a.fullName === name)!;
  return { store, server, port, call, csrf, login, byName, clearCookie: () => (cookie = "") };
}

let pass = 0;
let fail = 0;
async function check(name: string, fn: () => Promise<void>) {
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

console.log("Security");
{
  const app = await start();
  await check("refuses a non-local Host header (LAN / DNS rebinding)", async () => {
    const r = await app.call("GET", "/login", { headers: { host: "goodfly.evil:4000" } });
    assert(r.status === 421, `status ${r.status}`);
  });
  await check("pages require a session", async () => {
    const r = await app.call("GET", "/");
    assert(r.status === 303 && r.headers.location === "/login", `status ${r.status}`);
  });
  await check("wrong passcode is rejected", async () => {
    const r = await app.call("POST", "/login", { form: { passcode: "nope" } });
    assert(r.status === 401, `status ${r.status}`);
  });
  await check("right passcode opens a session with a strict cookie", async () => {
    const r = await app.login();
    const set = String(r.headers["set-cookie"]);
    assert(r.status === 303 && /HttpOnly/.test(set) && /SameSite=Strict/.test(set), set);
    const home = await app.call("GET", "/");
    assert(home.status === 200 && home.body.includes("Patron X"), `status ${home.status}`);
  });
  await check("pages send a strict Content-Security-Policy and no-store", async () => {
    const r = await app.call("GET", "/");
    assert(String(r.headers["content-security-policy"]).includes("default-src 'none'"), "no CSP");
    assert(r.headers["cache-control"] === "no-store", "cacheable");
  });
  await check("POST from another origin is refused", async () => {
    const token = await app.csrf();
    const id = app.byName("Patron Y").id;
    const r = await app.call("POST", `/accounts/${id}/suspend`, { form: { csrf: token }, headers: { origin: "https://evil.example" } });
    assert(r.status === 403 && !app.byName("Patron Y").disabledAt, `status ${r.status}`);
  });
  await check("POST without the CSRF token is refused", async () => {
    const id = app.byName("Patron Y").id;
    const r = await app.call("POST", `/accounts/${id}/suspend`, { form: { csrf: "forged" } });
    assert(r.status === 403 && !app.byName("Patron Y").disabledAt, `status ${r.status}`);
  });
  await check("names are escaped in pages (no script injection)", async () => {
    const token = await app.csrf();
    await app.call("POST", `/accounts/${app.byName("Patron Y").id}/suspend`, { form: { csrf: token } });
    await app.call("POST", "/direction/invite", { form: { csrf: token, email: "z@exemple.ma", fullName: "<script>alert(1)</script>" } });
    const page = await app.call("GET", "/");
    assert(!page.body.includes("<script>alert(1)</script>") && page.body.includes("&lt;script&gt;"), "not escaped");
  });
  app.server.close();
}

{
  const app = await start();
  await check("5 wrong passcodes lock the login (even the right one) for 15 minutes", async () => {
    for (let i = 0; i < 5; i++) await app.call("POST", "/login", { form: { passcode: `wrong${i}` } });
    const r = await app.login();
    assert(r.status === 401 && r.body.includes("Trop d"), `status ${r.status}`);
  });
  app.server.close();
}

{
  let t = 1_000_000;
  const app = await start({ now: () => t });
  await check("an idle session expires after 30 minutes", async () => {
    await app.login();
    assert((await app.call("GET", "/")).status === 200, "not logged in");
    t += 31 * 60_000;
    const r = await app.call("GET", "/");
    assert(r.status === 303, `status ${r.status}`);
  });
  app.server.close();
}

console.log("Owner rules");
{
  const app = await start();
  await app.login();
  await check("suspending a boss is applied and written to the journal", async () => {
    const token = await app.csrf();
    const y = app.byName("Patron Y");
    const r = await app.call("POST", `/accounts/${y.id}/suspend`, { form: { csrf: token } });
    assert(r.status === 303 && app.byName("Patron Y").disabledAt, "not suspended");
    assert(app.store.log.some((e) => e.action === "owner_suspend" && e.target === y.id), "no audit entry");
  });
  await check("restoring the boss works", async () => {
    const token = await app.csrf();
    await app.call("POST", `/accounts/${app.byName("Patron Y").id}/restore`, { form: { csrf: token } });
    assert(!app.byName("Patron Y").disabledAt, "still suspended");
  });
  await check("a third active Direction account is refused", async () => {
    const token = await app.csrf();
    const before = app.store.accounts.length;
    await app.call("POST", "/direction/invite", { form: { csrf: token, email: "patron.z@exemple.ma", fullName: "Patron Z" } });
    assert(app.store.accounts.length === before, "invited anyway");
    const page = await app.call("GET", "/");
    assert(page.body.includes("déjà 2 comptes Direction"), "no explanation shown");
  });
  await check("promoting an agent to Direction is refused while 2 are active", async () => {
    const token = await app.csrf();
    const agent = app.byName("Agent 1");
    await app.call("POST", `/accounts/${agent.id}/role`, { form: { csrf: token, role: "direction" } });
    assert(app.byName("Agent 1").role === "agent", "promoted anyway");
  });
  await check("permanent deletion needs the exact e-mail", async () => {
    const token = await app.csrf();
    const agent = app.byName("Agent 2");
    await app.call("POST", `/accounts/${agent.id}/delete`, { form: { csrf: token, confirmEmail: "wrong@exemple.ma" } });
    assert(app.store.accounts.some((a) => a.id === agent.id), "deleted without confirmation");
    await app.call("POST", `/accounts/${agent.id}/delete`, { form: { csrf: token, confirmEmail: agent.email } });
    assert(!app.store.accounts.some((a) => a.id === agent.id), "not deleted");
  });
  await check("the owner account cannot be opened or changed from the console", async () => {
    const token = await app.csrf();
    const owner = app.store.accounts.find((a) => a.role === "owner")!;
    assert((await app.call("GET", `/accounts/${owner.id}`)).status === 404, "owner page opened");
    await app.call("POST", `/accounts/${owner.id}/suspend`, { form: { csrf: token } });
    assert(!owner.disabledAt, "owner suspended");
  });
  await check("purge removes only accounts suspended for more than 30 days", async () => {
    const token = await app.csrf();
    const before = app.store.accounts.length;
    await app.call("POST", "/purge", { form: { csrf: token } });
    assert(!app.store.accounts.some((a) => a.fullName === "Ancien agent"), "old account kept");
    assert(app.store.accounts.length === before - 1, "removed too much");
  });
  await check("a Direction account can be created with a temporary password, shown once", async () => {
    const token = await app.csrf();
    await app.call("POST", `/accounts/${app.byName("Patron Y").id}/suspend`, { form: { csrf: token } });
    await app.call("POST", "/direction/invite", { form: { csrf: token, mode: "password", email: "patron.w@exemple.ma", fullName: "Patron W" } });
    const first = await app.call("GET", "/");
    const second = await app.call("GET", "/");
    const pw = first.body.match(/<code class="copy">([^<]+)<\/code>/)?.[1];
    assert(app.byName("Patron W")?.role === "direction", "not created");
    assert(pw && pw.length >= 20 && !second.body.includes(pw), "password not shown exactly once");
    assert(app.store.log.some((e) => e.action === "owner_create_direction"), "no audit entry");
  });
  await check("recovery link is shown once to the owner", async () => {
    const token = await app.csrf();
    const x = app.byName("Patron X");
    await app.call("POST", `/accounts/${x.id}/recovery`, { form: { csrf: token } });
    const first = await app.call("GET", `/accounts/${x.id}`);
    const second = await app.call("GET", `/accounts/${x.id}`);
    assert(first.body.includes("reinitialiser") && !second.body.includes("reinitialiser"), "link not shown once");
  });
  app.server.close();
}

console.log("Real browser");
{
  const app = await start();
  await check("a real browser can log in, suspend and restore an account", async () => {
    const { chromium } = await import("@playwright/test");
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(`http://127.0.0.1:${app.port}/`);
      await page.fill('input[name="passcode"]', PASS);
      await page.click('button[type="submit"]');
      await page.waitForURL(`http://127.0.0.1:${app.port}/`);
      await page.click("text=Gérer >> nth=0");
      await page.click("text=Suspendre");
      await page.waitForSelector("text=Compte suspendu");
      assert(app.byName("Patron X").disabledAt, "not suspended");
      await page.click("text=Réactiver le compte");
      await page.waitForSelector("text=Compte réactivé");
      assert(!app.byName("Patron X").disabledAt, "not restored");
    } finally {
      await browser.close();
    }
  });
  app.server.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
