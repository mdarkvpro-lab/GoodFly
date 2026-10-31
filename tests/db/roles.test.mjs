// Runs the GoodFly roles migration in an in-process Postgres (PGlite) with a minimal
// stand-in for Supabase's auth schema, then checks every account rule.
import { PGlite } from "@electric-sql/pglite";
import fs from "fs";

// Every migration, in order, exactly as they are applied to Supabase.
const migrationsDir = new URL("../../supabase/migrations/", import.meta.url);
const migrations = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort()
  .map((f) => fs.readFileSync(new URL(f, migrationsDir), "utf8"));
const db = new PGlite();

await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
`);
for (const sql of migrations) await db.exec(sql);
// Supabase grants table privileges to API roles by default; RLS does the filtering.
await db.exec(`
  grant usage on schema public to authenticated, anon;
  grant select, insert, update, delete on public.profiles, public.audit_log to authenticated;
`);


const ids = {
  O: "00000000-0000-0000-0000-00000000000a",
  X: "00000000-0000-0000-0000-00000000000b",
  Y: "00000000-0000-0000-0000-00000000000c",
  A: "00000000-0000-0000-0000-00000000000d",
  C: "00000000-0000-0000-0000-00000000000e",
};
for (const [name, id] of Object.entries(ids)) {
  await db.query(`insert into auth.users (id, raw_user_meta_data) values ($1, $2)`, [id, { full_name: name, role: "owner" }]);
}
// Owner console path (runs as postgres): assign roles.
await db.exec(`
  update public.profiles set role = 'owner' where id = '${ids.O}';
  update public.profiles set role = 'direction' where id in ('${ids.X}', '${ids.Y}');
  update public.profiles set role = 'agent' where id = '${ids.A}';
`);

async function as(user, sql, params = []) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${ids[user]}', false);`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

let pass = 0, fail = 0;
async function check(name, fn) {
  try {
    await fn();
    pass++;
    console.log("  ✓", name);
  } catch (e) {
    fail++;
    console.log("  ✘", name, "—", e.message);
  }
}
const expectRows = async (p, n) => {
  const r = await p;
  const got = r.rows.length || r.affectedRows || 0;
  if (got !== n) throw new Error(`expected ${n} rows, got ${got}`);
};
const expectError = async (p, text) => {
  try {
    await p;
  } catch (e) {
    if (text && !e.message.includes(text)) throw new Error(`wrong error: ${e.message}`);
    return;
  }
  throw new Error("expected an error, but it succeeded");
};

console.log("Sign-up");
await check("sign-up metadata cannot choose a role (C stays client)", async () => {
  const r = await db.query(`select role from public.profiles where id = $1`, [ids.C]);
  if (r.rows[0].role !== "client") throw new Error(r.rows[0].role);
});
await check("only one owner can exist", () => expectError(db.query(`update public.profiles set role = 'owner' where id = $1`, [ids.C]), "duplicate"));

console.log("Bosses cannot touch each other");
await check("X cannot edit Y's profile", () => expectRows(as("X", `update public.profiles set full_name = 'hacked' where id = $1`, [ids.Y]), 0));
await check("X cannot deactivate Y", () => expectError(as("X", `select public.deactivate_account($1)`, [ids.Y]), "owner console"));
await check("Y cannot deactivate X", () => expectError(as("Y", `select public.deactivate_account($1)`, [ids.X]), "owner console"));
await check("X cannot deactivate himself", () => expectError(as("X", `select public.deactivate_account($1)`, [ids.X]), "owner console"));
await check("X cannot deactivate the owner", () => expectError(as("X", `select public.deactivate_account($1)`, [ids.O]), "owner console"));
await check("X cannot change his own role", () => expectError(as("X", `update public.profiles set role = 'owner' where id = $1`, [ids.X]), "only the owner"));
await check("X cannot hide Y by setting disabled_at directly", () => expectRows(as("X", `update public.profiles set disabled_at = now() where id = $1`, [ids.Y]), 0));

console.log("Bosses manage their own account and the agency's agents/clients");
await check("X edits his own name", () => expectRows(as("X", `update public.profiles set full_name = 'Patron X' where id = $1`, [ids.X]), 1));
await check("X sees every profile (reports)", () => expectRows(as("X", `select id from public.profiles`), 5));
await check("X deactivates agent A", () => as("X", `select public.deactivate_account($1)`, [ids.A]));
await check("deactivation is written to the audit log", () => expectRows(db.query(`select 1 from public.audit_log where action = 'deactivate_account' and target = $1`, [ids.A]), 1));
await check("deactivated agent A loses access (cannot edit own profile)", () => expectRows(as("A", `update public.profiles set full_name = 'x' where id = $1`, [ids.A]), 0));
await check("Y (other boss) restores agent A", () => as("Y", `select public.restore_account($1)`, [ids.A]));
await check("X promotes client C to agent", () => expectRows(as("X", `update public.profiles set role = 'agent' where id = $1`, [ids.C]), 1));
await check("X cannot promote C to direction", () => expectError(as("X", `update public.profiles set role = 'direction' where id = $1`, [ids.C]), "only the owner"));
await db.exec(`update public.profiles set role = 'client' where id = '${ids.C}'`);

console.log("Agents and clients");
await check("agent A reads client profiles but not bosses", async () => {
  const r = await as("A", `select role from public.profiles`);
  const roles = r.rows.map((x) => x.role).sort().join(",");
  if (roles !== "agent,client") throw new Error(roles);
});
await check("agent A cannot deactivate anyone", () => expectError(as("A", `select public.deactivate_account($1)`, [ids.C]), "only direction"));
await check("client C only sees himself", () => expectRows(as("C", `select id from public.profiles`), 1));
await check("client C cannot read the audit log", () => expectRows(as("C", `select id from public.audit_log`), 0));
await check("client C cannot make himself an agent", () => expectError(as("C", `update public.profiles set role = 'agent' where id = $1`, [ids.C]), "only direction"));
await check("nobody can hard-delete a profile from the website", () => expectRows(as("X", `delete from public.profiles where id = $1`, [ids.C]), 0));

console.log("Owner console (service role / postgres)");
await check("owner can permanently delete a boss who had deactivated someone (journal kept)", async () => {
  await as("X", `select public.deactivate_account($1)`, [ids.C]);
  await db.query(`delete from auth.users where id = $1`, [ids.X]);
  await expectRows(db.query(`select 1 from public.profiles where id = $1`, [ids.X]), 0);
  const r = await db.query(`select actor from public.audit_log where action = 'deactivate_account' and target = $1`, [ids.C]);
  if (r.rows.length !== 1 || r.rows[0].actor !== null) throw new Error(JSON.stringify(r.rows));
  const c = await db.query(`select disabled_by from public.profiles where id = $1`, [ids.C]);
  if (c.rows[0].disabled_by !== null) throw new Error("disabled_by not cleared");
});
await check("owner can deactivate boss Y", () => expectRows(db.query(`update public.profiles set disabled_at = now() where id = $1`, [ids.Y]), 1));
await check("deactivated boss Y can no longer see reports", () => expectRows(as("Y", `select id from public.profiles where id <> $1`, [ids.Y]), 0));

console.log("API exposure");
await check("the sign-up trigger function is not executable by API roles", async () => {
  const r = await db.query(
    `select has_function_privilege('anon', 'public.handle_new_user()', 'execute') as anon,
            has_function_privilege('authenticated', 'public.handle_new_user()', 'execute') as auth`,
  );
  if (r.rows[0].anon || r.rows[0].auth) throw new Error(JSON.stringify(r.rows[0]));
});
await check("foreign keys and the journal are indexed", async () => {
  const r = await db.query(`select indexname from pg_indexes where schemaname = 'public'`);
  const names = r.rows.map((x) => x.indexname);
  for (const n of ["audit_log_actor_idx", "audit_log_target_idx", "audit_log_created_at_idx", "profiles_disabled_by_idx"]) {
    if (!names.includes(n)) throw new Error(`missing ${n}`);
  }
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
