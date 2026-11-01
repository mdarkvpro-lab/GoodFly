// GoodFly — Direction gives an employee a new temporary password (forgotten password).
// Called server-side by the website with the signed-in Direction user's access token.
// At most 10 resets per account in 30 days (enforced by the database trigger).
// The employee must choose a new password at the next sign-in.
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "unauthenticated" });

  // 1. The caller must be an active Direction account.
  const asUser = createClient(url, key("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await asUser.auth.getUser(token);
  if (userError || !userData.user) return json(401, { error: "unauthenticated" });
  const { data: role } = await asUser.rpc("my_role");
  if (role !== "direction") return json(403, { error: "forbidden" });

  let body: { id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid" });
  }
  const id = typeof body.id === "string" ? body.id : "";
  if (!UUID.test(id)) return json(400, { error: "invalid" });

  const admin = createClient(url, key("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 2. Only active employees (never Direction or the owner: those go through the owner console).
  const { data: target } = await admin.from("profiles").select("role, disabled_at").eq("id", id).maybeSingle();
  if (!target || target.role !== "agent" || target.disabled_at) return json(403, { error: "notEmployee" });

  // 3. Count the reset first: the database refuses an 11th one within 30 days.
  const { error: limitError } = await admin.from("password_resets").insert({ target: id, requested_by: userData.user.id });
  if (limitError) return json(429, { error: /reset_limit/.test(limitError.message) ? "limit" : "generic" });

  const password = temporaryPassword();
  const { error: updateError } = await admin.auth.admin.updateUserById(id, {
    password,
    user_metadata: { must_change_password: true },
  });
  if (updateError) return json(500, { error: "generic" });

  await admin.from("audit_log").insert({ actor: userData.user.id, action: "reset_employee_password", target: id, details: {} });
  return json(200, { password });
});
