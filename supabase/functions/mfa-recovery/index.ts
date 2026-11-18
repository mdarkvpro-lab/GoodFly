// GoodFly — "I lost my phone": a staff member spends one backup code to remove their 2FA,
// then must set it up again on the new phone right away.
// Called server-side by the website with the signed-in (password only, "aal1") user's token.
// Codes are checked as hashes in the database (5 wrong codes per hour at most).
import { createClient } from "npm:@supabase/supabase-js@2.118.0";

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

/** Same normalisation and hash as the website (src/lib/staff/backup-codes.ts). */
async function codeHash(userId: string, code: string): Promise<string> {
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const bytes = new TextEncoder().encode(`goodfly-backup:${userId}:${clean}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The session id inside the caller's token (kept alive while they re-enroll). */
function sessionId(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.session_id === "string" ? payload.session_id : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "method" });

  const url = Deno.env.get("SUPABASE_URL")!;
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "unauthenticated" });

  // 1. Who is calling? (token validated by Supabase Auth)
  const asUser = createClient(url, key("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY"), {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await asUser.auth.getUser(token);
  if (userError || !userData.user) return json(401, { error: "unauthenticated" });
  const userId = userData.user.id;

  let body: { code?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid" });
  }
  const code = typeof body.code === "string" ? body.code : "";
  if (code.replace(/[^A-Za-z0-9]/g, "").length !== 10) return json(400, { error: "format" });

  const admin = createClient(url, key("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 2. Only active staff accounts that have 2FA to recover.
  const { data: profile } = await admin.from("profiles").select("role, disabled_at").eq("id", userId).maybeSingle();
  if (!profile || !["direction", "agent"].includes(profile.role) || profile.disabled_at) return json(403, { error: "forbidden" });

  // 3. Spend the code (the database counts wrong attempts).
  const { data: ok, error: codeError } = await admin.rpc("consume_backup_code", { account: userId, code_hash: await codeHash(userId, code) });
  if (codeError) return json(429, { error: /too_many/.test(codeError.message) ? "tooMany" : "generic" });
  if (ok !== true) return json(400, { error: "wrong" });

  // 4. Remove every 2FA factor, then reset: other sessions end, the backup codes are forgotten.
  const { data: factors, error: listError } = await admin.auth.admin.mfa.listFactors({ userId });
  if (listError) return json(500, { error: "generic" });
  for (const f of factors?.factors ?? []) {
    const { error } = await admin.auth.admin.mfa.deleteFactor({ id: f.id, userId });
    if (error) return json(500, { error: "generic" });
  }
  const { error: resetError } = await admin.rpc("mfa_reset", { account: userId, via: "backup_code", keep_session: sessionId(token) });
  if (resetError) return json(500, { error: "generic" });

  return json(200, { ok: true });
});
