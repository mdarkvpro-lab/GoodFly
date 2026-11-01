// GoodFly — create an employee account (Direction only).
// Called server-side by the website with the signed-in Direction user's access token.
// The secret key never leaves Supabase. Returns a one-time temporary password.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const PERMISSIONS = ["programs.manage", "clients.view", "reports.view", "bookings.manage"];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function key(jsonVar: string, legacyVar: string): string {
  try {
    const keys = JSON.parse(Deno.env.get(jsonVar) ?? "{}");
    if (keys.default) return keys.default;
  } catch {
    // fall back to the legacy key below
  }
  return Deno.env.get(legacyVar) ?? "";
}

function temporaryPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(15)); // 120 bits
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "unauthenticated" });

  // 1. Who is calling? (token validated by Supabase Auth)
  const asUser = createClient(url, key("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await asUser.auth.getUser(token);
  if (userError || !userData.user) return json(401, { error: "unauthenticated" });
  const { data: role } = await asUser.rpc("my_role");
  if (role !== "direction") return json(403, { error: "forbidden" });

  // 2. Validate the request
  let body: { email?: unknown; fullName?: unknown; permissions?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid" });
  }
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim().slice(0, 120) : "";
  const permissions = Array.isArray(body.permissions) ? [...new Set(body.permissions.map(String))] : [];
  if (!EMAIL.test(email) || email.length > 254) return json(400, { error: "email" });
  if (!fullName) return json(400, { error: "name" });
  if (!permissions.every((p) => PERMISSIONS.includes(p))) return json(400, { error: "permissions" });

  // 3. Create the account with the secret key (bypasses RLS: only after the checks above)
  const admin = createClient(url, key("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const password = temporaryPassword();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, must_change_password: true },
  });
  if (createError || !created.user) {
    const exists = /already|registered|exists/i.test(createError?.message ?? "");
    return json(exists ? 409 : 500, { error: exists ? "exists" : "create" });
  }

  const id = created.user.id;
  const { error: promoteError } = await admin.from("profiles").update({ role: "agent", full_name: fullName, permissions }).eq("id", id);
  if (promoteError) {
    await admin.auth.admin.deleteUser(id); // never leave a half-created account behind
    return json(500, { error: "create" });
  }
  await admin.from("audit_log").insert({
    actor: userData.user.id,
    action: "create_employee",
    target: id,
    details: { email, permissions },
  });

  return json(200, { id, email, password });
});
