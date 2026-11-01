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
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  -- Minimal stand-in for Supabase Storage (buckets, objects, foldername()).
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1] $$;
  grant usage on schema storage to authenticated, anon;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant execute on function storage.foldername(text) to authenticated;
`);
for (const sql of migrations) await db.exec(sql);
// Supabase grants table privileges to API roles by default; RLS does the filtering.
await db.exec(`
  grant usage on schema public to authenticated, anon;
  grant select, insert, update, delete on public.profiles, public.audit_log, public.programs, public.employee_removal_requests, public.booking_requests, public.push_subscriptions to authenticated;
  grant select on public.programs to anon;
`);


const ids = {
  O: "00000000-0000-0000-0000-00000000000a",
  X: "00000000-0000-0000-0000-00000000000b",
  Y: "00000000-0000-0000-0000-00000000000c",
  A: "00000000-0000-0000-0000-00000000000d",
  C: "00000000-0000-0000-0000-00000000000e",
};
for (const [name, id] of Object.entries(ids)) {
  await db.query(`insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)`, [id, `${name.toLowerCase()}@exemple.ma`, { full_name: name, role: "owner" }]);
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
console.log("Removing an employee needs the other boss");
await check("X cannot deactivate employee A directly", () => expectError(as("X", `select public.deactivate_account($1)`, [ids.A]), "removal request"));
await check("X cannot demote employee A to client directly", () => expectError(as("X", `update public.profiles set role = 'client' where id = $1`, [ids.A]), "removal request"));
let requestId;
await check("X asks to remove employee A", async () => {
  const r = await as("X", `select public.request_employee_removal($1, 'Fin de contrat') as id`, [ids.A]);
  requestId = r.rows[0].id;
  if (!requestId) throw new Error("no request id");
});
await check("a second request for A is refused while one is pending", () => expectError(as("Y", `select public.request_employee_removal($1)`, [ids.A]), "already pending"));
await check("X cannot approve his own request", () => expectError(as("X", `select public.decide_employee_removal($1, true)`, [requestId]), "other Direction"));
await check("employee A is still active while the request is pending", async () => {
  const r = await db.query(`select disabled_at from public.profiles where id = $1`, [ids.A]);
  if (r.rows[0].disabled_at) throw new Error("already disabled");
});
await check("an employee cannot request removals", () => expectError(as("A", `select public.request_employee_removal($1)`, [ids.A]), "only direction"));
await check("Y approves: employee A is deactivated", async () => {
  await as("Y", `select public.decide_employee_removal($1, true)`, [requestId]);
  const r = await db.query(`select disabled_at, disabled_by from public.profiles where id = $1`, [ids.A]);
  if (!r.rows[0].disabled_at || r.rows[0].disabled_by !== ids.Y) throw new Error(JSON.stringify(r.rows[0]));
});
await check("a decided request cannot be decided again", () => expectError(as("Y", `select public.decide_employee_removal($1, false)`, [requestId]), "already decided"));
await check("request and approval are in the journal", () =>
  expectRows(db.query(`select 1 from public.audit_log where target = $1 and action in ('request_employee_removal', 'approve_employee_removal')`, [ids.A]), 2));
await check("deactivated agent A loses access (cannot edit own profile)", () => expectRows(as("A", `update public.profiles set full_name = 'x' where id = $1`, [ids.A]), 0));
await check("Y (other boss) restores agent A", () => as("Y", `select public.restore_account($1)`, [ids.A]));
await check("if Y refuses, employee A stays", async () => {
  const r = await as("X", `select public.request_employee_removal($1) as id`, [ids.A]);
  await as("Y", `select public.decide_employee_removal($1, false)`, [r.rows[0].id]);
  const p = await db.query(`select disabled_at from public.profiles where id = $1`, [ids.A]);
  if (p.rows[0].disabled_at) throw new Error("removed anyway");
});
await check("only the requester can cancel a pending request", async () => {
  const r = await as("Y", `select public.request_employee_removal($1) as id`, [ids.A]);
  await expectError(as("X", `select public.cancel_employee_removal($1)`, [r.rows[0].id]), "only the requester");
  await as("Y", `select public.cancel_employee_removal($1)`, [r.rows[0].id]);
  const q = await db.query(`select status from public.employee_removal_requests where id = $1`, [r.rows[0].id]);
  if (q.rows[0].status !== "cancelled") throw new Error(q.rows[0].status);
});
await check("employees and clients cannot read removal requests", () => expectRows(as("A", `select id from public.employee_removal_requests`), 0));

console.log("Employee permissions");
await check("agent A without permission sees only himself", async () => {
  const r = await as("A", `select role from public.profiles`);
  if (r.rows.map((x) => x.role).join() !== "agent") throw new Error(JSON.stringify(r.rows));
});
await check("X grants A the clients.view and programs.manage permissions", () =>
  as("X", `select public.set_employee_permissions($1, array['clients.view', 'programs.manage'])`, [ids.A]));
await check("an unknown permission is refused", () => expectError(as("X", `select public.set_employee_permissions($1, array['admin.all'])`, [ids.A]), "unknown permission"));
await check("permissions only apply to employees (not to Y)", () => expectError(as("X", `select public.set_employee_permissions($1, array['clients.view'])`, [ids.Y]), "active employees"));
await check("A cannot change his own permissions", () =>
  expectError(as("A", `update public.profiles set permissions = array['reports.view'] where id = $1`, [ids.A]), "set_employee_permissions"));
await check("an employee cannot grant permissions", () => expectError(as("A", `select public.set_employee_permissions($1, array['reports.view'])`, [ids.A]), "only direction"));
await check("X promotes client C to agent", () => expectRows(as("X", `update public.profiles set role = 'agent' where id = $1`, [ids.C]), 1));
await check("X cannot promote C to direction", () => expectError(as("X", `update public.profiles set role = 'direction' where id = $1`, [ids.C]), "only the owner"));
await db.exec(`update public.profiles set role = 'client' where id = '${ids.C}'`);

console.log("Agents and clients");
await as("X", `select public.set_employee_permissions($1, array['clients.view', 'programs.manage'])`, [ids.A]);
await check("agent A (with clients.view) reads client profiles but not bosses", async () => {
  const r = await as("A", `select role from public.profiles`);
  const roles = r.rows.map((x) => x.role).sort().join(",");
  if (roles !== "agent,client") throw new Error(roles);
});
await check("agent A cannot deactivate anyone", () => expectError(as("A", `select public.deactivate_account($1)`, [ids.C]), "only direction"));
await check("client C only sees himself", () => expectRows(as("C", `select id from public.profiles`), 1));
await check("client C cannot read the audit log", () => expectRows(as("C", `select id from public.audit_log`), 0));
await check("client C cannot make himself an agent", () => expectError(as("C", `update public.profiles set role = 'agent' where id = $1`, [ids.C]), "only direction"));
await check("nobody can hard-delete a profile from the website", () => expectRows(as("X", `delete from public.profiles where id = $1`, [ids.C]), 0));

console.log("Programmes");
async function asAnon(sql, params = []) {
  await db.exec(`set role anon; select set_config('request.jwt.claim.sub', '', false);`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec(`reset role;`);
  }
}
let programId;
await check("an employee with programs.manage creates a draft (author stamped by the database)", async () => {
  const r = await as("A", `insert into public.programs (slug, title_fr, created_by) values ('omra-printemps', 'Omra de printemps', $1) returning id, created_by, status`, [ids.X]);
  programId = r.rows[0].id;
  if (r.rows[0].created_by !== ids.A || r.rows[0].status !== "draft") throw new Error(JSON.stringify(r.rows[0]));
});
await check("visitors do not see drafts", () => expectRows(asAnon(`select id from public.programs`), 0));
await check("clients do not see drafts", () => expectRows(as("C", `select id from public.programs`), 0));
await check("publishing sets the publication date; visitors then see it", async () => {
  const r = await as("A", `update public.programs set status = 'published' where id = $1 returning published_at`, [programId]);
  if (!r.rows[0].published_at) throw new Error("no published_at");
  await expectRows(asAnon(`select id from public.programs`), 1);
});
await check("visitors cannot change programmes", () => expectError(asAnon(`update public.programs set title_fr = 'Piraté' where id = $1`, [programId]), "permission denied"));
await check("a client cannot create programmes", () => expectError(as("C", `insert into public.programs (slug, title_fr) values ('x-y', 'Test client')`), "row-level security"));
await check("invalid slugs are refused", () => expectError(as("A", `insert into public.programs (slug, title_fr) values ('Bad Slug!', 'Titre')`), "check constraint"));
await check("an employee cannot delete a programme", () => expectRows(as("A", `delete from public.programs where id = $1`, [programId]), 0));
await check("every programme change is in the journal", () =>
  expectRows(db.query(`select 1 from public.audit_log where target = $1 and action in ('program_created', 'program_updated')`, [programId]), 2));
await check("an employee with programs.manage can upload a programme image (programs/ folder only)", async () => {
  await as("A", `insert into storage.objects (bucket_id, name) values ('program-images', 'programs/omra/cover.webp')`);
  await expectError(as("A", `insert into storage.objects (bucket_id, name) values ('program-images', 'other/cover.webp')`), "row-level security");
});
await check("a client cannot upload images", () =>
  expectError(as("C", `insert into storage.objects (bucket_id, name) values ('program-images', 'programs/x.webp')`), "row-level security"));
await check("Direction deletes a programme", async () => {
  await expectRows(as("X", `delete from public.programs where id = $1`, [programId]), 1);
  await expectRows(db.query(`select 1 from public.audit_log where target = $1 and action = 'program_deleted'`, [programId]), 1);
});
await check("removing a permission takes effect immediately", async () => {
  await as("X", `select public.set_employee_permissions($1, array[]::text[])`, [ids.A]);
  await expectError(as("A", `insert into public.programs (slug, title_fr) values ('apres-retrait', 'Après retrait')`), "row-level security");
});

console.log("Dashboard statistics");
await check("an employee without reports.view cannot read statistics", () => expectError(as("A", `select * from public.staff_profile_stats()`), "reports.view"));
await check("with reports.view, statistics contain dates only (no names or e-mails)", async () => {
  await as("X", `select public.set_employee_permissions($1, array['reports.view'])`, [ids.A]);
  const r = await as("A", `select * from public.staff_profile_stats()`);
  const cols = r.fields.map((f) => f.name).sort().join(",");
  if (cols !== "created_at,disabled_at,role") throw new Error(cols);
  if (r.rows.some((x) => x.role !== "client" && x.role !== "agent")) throw new Error("bosses or owner listed");
  await expectRows(as("A", `select id from public.profiles where role = 'client'`), 0); // still no client details
  await as("X", `select public.set_employee_permissions($1, array[]::text[])`, [ids.A]);
});
await check("visitors cannot call the statistics function", () => expectError(asAnon(`select * from public.staff_profile_stats()`), "permission denied"));

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

console.log("E-mail copy on profiles");
await check("the e-mail is copied to the profile at sign-up", async () => {
  const r = await db.query(`select email from public.profiles where id = $1`, [ids.C]);
  if (r.rows[0].email !== "c@exemple.ma") throw new Error(r.rows[0].email);
});
await check("an e-mail change in auth updates the profile", async () => {
  await db.query(`update auth.users set email = 'client.c@exemple.ma' where id = $1`, [ids.C]);
  const r = await db.query(`select email from public.profiles where id = $1`, [ids.C]);
  if (r.rows[0].email !== "client.c@exemple.ma") throw new Error(r.rows[0].email);
});
// Earlier checks suspended C and Y: use the active agent A, and bring Y back (owner path).
await db.query(`update public.profiles set disabled_at = null where id = $1`, [ids.Y]);
await check("a website user cannot change the copied e-mail", () =>
  expectError(as("A", `update public.profiles set email = 'x@evil.ma' where id = $1`, [ids.A]), "managed by Supabase Auth"));
await check("Direction can read e-mails of accounts", async () => {
  const r = await as("Y", `select email from public.profiles where id = $1`, [ids.A]);
  if (r.rows[0]?.email !== "a@exemple.ma") throw new Error(JSON.stringify(r.rows));
});

console.log("API exposure");
await check("the sign-up trigger function is not executable by API roles", async () => {
  const r = await db.query(
    `select has_function_privilege('anon', 'public.handle_new_user()', 'execute') as anon,
            has_function_privilege('authenticated', 'public.handle_new_user()', 'execute') as auth,
            has_function_privilege('authenticated', 'public.sync_profile_email()', 'execute') as sync`,
  );
  if (r.rows[0].anon || r.rows[0].auth || r.rows[0].sync) throw new Error(JSON.stringify(r.rows[0]));
});
await check("foreign keys and the journal are indexed", async () => {
  const r = await db.query(`select indexname from pg_indexes where schemaname = 'public'`);
  const names = r.rows.map((x) => x.indexname);
  for (const n of ["audit_log_actor_idx", "audit_log_target_idx", "audit_log_created_at_idx", "profiles_disabled_by_idx"]) {
    if (!names.includes(n)) throw new Error(`missing ${n}`);
  }
});

console.log("Booking requests");
const req = (extra = {}) => ({ full_name: "Salma B.", phone: "+212 6 12 34 56 78", email: "salma@exemple.ma", to_place: "Istanbul", travel_dates: "fin décembre", adults: "2", children: "1", message: "Hôtel proche du centre", lang: "fr", consent: "true", ...extra });
await db.exec(`insert into public.programs (slug, status, title_fr) values ('omra-test', 'published', 'Omra test'), ('brouillon-test', 'draft', 'Brouillon test')`);
const FORM_KEY = "test-form-key-0123456789";
await db.query(`insert into private.settings values ('booking_form_key_sha256', encode(sha256(convert_to($1, 'UTF8')), 'hex'))`, [FORM_KEY]);
let ipSeq = 0;
const ip = () => (++ipSeq).toString(16).padStart(64, "0");
const submit = (p, key = FORM_KEY, ipHash = ip()) => asAnon(`select public.submit_booking_request($1, $2, $3) as ref`, [p, key, ipHash]);
let bookingRef = "";
await check("a visitor can send a request and gets a reference", async () => {
  const r = await submit(req());
  bookingRef = r.rows[0].ref;
  if (!/^GF-[0-9A-F]{8}$/.test(bookingRef)) throw new Error(bookingRef);
});
await check("a request for a published programme keeps its title", async () => {
  const r = await submit(req({ program: "omra-test", to_place: "", phone: "0611111111" }));
  const row = await db.query(`select program_title, program_id is not null as linked from public.booking_requests where reference = $1`, [r.rows[0].ref]);
  if (row.rows[0].program_title !== "Omra test" || !row.rows[0].linked) throw new Error(JSON.stringify(row.rows));
});
await check("a draft programme cannot be booked", () => expectError(submit(req({ program: "brouillon-test" })), "program_unavailable"));
await check("consent is required", () => expectError(submit(req({ consent: "false" })), "consent"));
await check("bad phone, e-mail, traveller count and missing destination are refused", async () => {
  for (const bad of [{ phone: "abc" }, { phone: "12" }, { email: "pas-un-email" }, { adults: "0" }, { adults: "x" }, { children: "50" }, { to_place: "" }, { full_name: "a" }, { message: "x".repeat(1001) }, { lang: "en" }]) {
    await expectError(submit(req(bad)), "invalid");
  }
});
await check("visitors cannot choose the status or the reference", async () => {
  const r = await submit(req({ phone: "0622222222", status: "confirmed", reference: "GF-00000000" }));
  const row = await db.query(`select status, reference from public.booking_requests where reference = $1`, [r.rows[0].ref]);
  if (row.rows[0].status !== "new" || row.rows[0].reference === "GF-00000000") throw new Error(JSON.stringify(row.rows));
});
await check("one phone number is limited to 3 requests per day", async () => {
  await submit(req({ phone: "0633333333" }));
  await submit(req({ phone: "06 33 33 33 33" }));
  await submit(req({ phone: "06.33.33.33.33" }));
  await expectError(submit(req({ phone: "0633333333" })), "too_many");
});
await check("a request without the site's form key is refused", async () => {
  await expectError(submit(req({ phone: "0644444444" }), null), "form_key");
  await expectError(submit(req({ phone: "0644444444" }), "wrong-key"), "form_key");
});
await check("the form key hash is out of reach of the API", async () => {
  await expectError(asAnon(`select * from private.settings`), "permission denied");
  await expectError(as("Y", `select * from private.settings`), "permission denied");
});
await check("one visitor (IP) is limited to 5 requests per hour", async () => {
  const visitor = "ab".repeat(32);
  for (let i = 0; i < 5; i++) await submit(req({ phone: `065555555${i}` }), FORM_KEY, visitor);
  await expectError(submit(req({ phone: "0655555559" }), FORM_KEY, visitor), "too_many");
  await expectError(submit(req({ phone: "0655555558" }), FORM_KEY, "not-a-hash"), "invalid");
});
await check("visitors cannot read, change or delete requests", async () => {
  await expectError(asAnon(`select * from public.booking_requests`), "permission denied");
  await expectError(asAnon(`select public.update_booking_request(id, 'confirmed', '') from public.booking_requests`), "permission denied");
});
await check("an employee without bookings.manage sees no request", async () => {
  await as("Y", `select public.set_employee_permissions($1, array[]::text[])`, [ids.A]);
  await expectRows(as("A", `select id from public.booking_requests`), 0);
  const id = (await db.query(`select id from public.booking_requests where reference = $1`, [bookingRef])).rows[0].id;
  await expectError(as("A", `select public.update_booking_request($1, 'confirmed', '')`, [id]), "bookings.manage");
});
await check("an employee with bookings.manage reads and follows up requests (journaled)", async () => {
  await as("Y", `select public.set_employee_permissions($1, array['bookings.manage'])`, [ids.A]);
  const r = await as("A", `select id from public.booking_requests where reference = $1`, [bookingRef]);
  if (r.rows.length !== 1) throw new Error("not visible");
  await as("A", `select public.update_booking_request($1, 'in_progress', 'Rappelée à 10h')`, [r.rows[0].id]);
  const row = await db.query(`select status, staff_note, handled_by from public.booking_requests where id = $1`, [r.rows[0].id]);
  if (row.rows[0].status !== "in_progress" || row.rows[0].handled_by !== ids.A) throw new Error(JSON.stringify(row.rows));
  const log = await db.query(`select details from public.audit_log where action = 'booking_updated' and target = $1`, [r.rows[0].id]);
  if (log.rows[0]?.details?.reference !== bookingRef) throw new Error(JSON.stringify(log.rows));
});
await check("staff cannot edit requests directly or set an unknown status", async () => {
  await expectRows(as("A", `update public.booking_requests set full_name = 'x' where reference = $1`, [bookingRef]), 0);
  await expectError(as("A", `select public.update_booking_request(id, 'paid', '') from public.booking_requests where reference = $1`, [bookingRef]), "invalid");
});
await check("only Direction can delete a request; the journal keeps no personal data", async () => {
  const id = (await db.query(`select id from public.booking_requests where reference = $1`, [bookingRef])).rows[0].id;
  await expectError(as("A", `select public.delete_booking_request($1)`, [id]), "only direction");
  await as("Y", `select public.delete_booking_request($1)`, [id]);
  await expectRows(db.query(`select 1 from public.booking_requests where id = $1`, [id]), 0);
  const log = await db.query(`select details::text as d from public.audit_log where action = 'booking_deleted' and target = $1`, [id]);
  if (!log.rows[0] || /Salma|612|exemple/.test(log.rows[0].d)) throw new Error(JSON.stringify(log.rows));
  await as("Y", `select public.set_employee_permissions($1, array[]::text[])`, [ids.A]);
});
await check("deleting a programme keeps its requests", async () => {
  await db.exec(`delete from public.programs where slug in ('omra-test', 'brouillon-test')`);
  const r = await db.query(`select count(*)::int as n from public.booking_requests where program_title = 'Omra test'`);
  if (r.rows[0].n !== 1) throw new Error(JSON.stringify(r.rows));
});

console.log("Push notifications (staff devices)");
const dev = (n) => ({ endpoint: `https://fcm.googleapis.com/fcm/send/device-${n}`, p256dh: "B".repeat(87), auth: "a".repeat(22) });
const addDevice = (who, d) => as(who, `insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)`, [ids[who], d.endpoint, d.p256dh, d.auth]);
await check("Direction registers a device", () => addDevice("Y", dev(1)));
await check("an employee without bookings.manage cannot register", async () => {
  await as("Y", `select public.set_employee_permissions($1, array[]::text[])`, [ids.A]);
  await expectError(addDevice("A", dev(2)), "row-level security");
});
await check("nobody registers a device for someone else", () =>
  expectError(as("Y", `insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, $2, $3, $4)`, [ids.A, dev(3).endpoint, dev(3).p256dh, dev(3).auth]), "row-level security"));
await check("only official push services are accepted (no arbitrary URL)", async () => {
  for (const endpoint of ["https://evil.example/hook", "http://fcm.googleapis.com/x", "https://fcm.googleapis.com.evil.example/x", "https://169.254.169.254/latest"]) {
    await expectError(addDevice("Y", { ...dev(4), endpoint }), "check constraint");
  }
});
await check("an employee with bookings.manage registers; others cannot see their devices", async () => {
  await as("Y", `select public.set_employee_permissions($1, array['bookings.manage'])`, [ids.A]);
  await addDevice("A", dev(5));
  await expectRows(as("Y", `select 1 from public.push_subscriptions where user_id = $1`, [ids.A]), 0);
  await expectRows(as("A", `select 1 from public.push_subscriptions`), 1);
});
await check("visitors cannot read devices", () => expectError(asAnon(`select * from public.push_subscriptions`), "permission denied"));
await check("the device list needs the site's form key", async () => {
  await expectError(asAnon(`select * from public.booking_push_targets($1)`, ["wrong"]), "form_key");
  const r = await asAnon(`select endpoint from public.booking_push_targets($1)`, [FORM_KEY]);
  if (r.rows.length !== 2) throw new Error(JSON.stringify(r.rows));
});
await check("an employee who loses bookings.manage stops receiving alerts", async () => {
  await as("Y", `select public.set_employee_permissions($1, array[]::text[])`, [ids.A]);
  const r = await asAnon(`select endpoint from public.booking_push_targets($1)`, [FORM_KEY]);
  if (r.rows.length !== 1 || !r.rows[0].endpoint.endsWith("device-1")) throw new Error(JSON.stringify(r.rows));
});
await check("expired devices are forgotten only with the form key", async () => {
  await expectError(asAnon(`select public.forget_push_endpoint($1, $2)`, ["wrong", dev(1).endpoint]), "form_key");
  await asAnon(`select public.forget_push_endpoint($1, $2)`, [FORM_KEY, dev(1).endpoint]);
  await expectRows(db.query(`select 1 from public.push_subscriptions where endpoint = $1`, [dev(1).endpoint]), 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
