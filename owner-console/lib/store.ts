/**
 * Data access for the owner console. Two implementations:
 *  - SupabaseStore: the real project, through the service-role key (bypasses RLS — owner only).
 *  - MemoryStore (memoryStore.ts): demo data for trying the console and for tests.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type Role = "owner" | "direction" | "agent" | "client";
export const ROLES: Role[] = ["owner", "direction", "agent", "client"];

export type Account = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  disabledAt: string | null;
  createdAt: string;
  lastSignInAt: string | null;
};

export type AuditEntry = {
  id: string;
  actor: string | null;
  action: string;
  target: string | null;
  details: Record<string, unknown>;
  createdAt: string;
};

export interface AdminStore {
  readonly label: string;
  listAccounts(): Promise<Account[]>;
  getAccount(id: string): Promise<Account | null>;
  inviteDirection(email: string, fullName: string): Promise<Account>;
  /** Creates a confirmed account with a password (no e-mail needed). */
  createDirection(email: string, fullName: string, password: string): Promise<Account>;
  setRole(id: string, role: Role): Promise<void>;
  /** Deactivate in the database and block sign-in. */
  suspend(id: string): Promise<void>;
  restore(id: string): Promise<void>;
  /** Permanent deletion of the auth user (the profile is removed with it). */
  remove(id: string): Promise<void>;
  recoveryLink(email: string): Promise<string>;
  audit(action: string, target: string | null, details: Record<string, unknown>): Promise<void>;
  listAudit(limit: number): Promise<AuditEntry[]>;
}

const BAN_FOREVER = "876000h"; // ~100 years

type ProfileRow = { id: string; full_name: string; role: Role; disabled_at: string | null; created_at: string };

export class SupabaseStore implements AdminStore {
  readonly label = "Supabase";
  private db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  }

  private static fail(what: string, error: { message: string } | null): never {
    throw new Error(`${what}: ${error?.message ?? "unknown error"}`);
  }

  async listAccounts(): Promise<Account[]> {
    const { data: profiles, error } = await this.db
      .from("profiles")
      .select("id, full_name, role, disabled_at, created_at")
      .order("created_at", { ascending: true });
    if (error) SupabaseStore.fail("profiles", error);

    const users = new Map<string, { email: string; lastSignInAt: string | null }>();
    for (let page = 1; ; page++) {
      const { data, error: e } = await this.db.auth.admin.listUsers({ page, perPage: 1000 });
      if (e) SupabaseStore.fail("auth users", e);
      for (const u of data.users) users.set(u.id, { email: u.email ?? "", lastSignInAt: u.last_sign_in_at ?? null });
      if (data.users.length < 1000) break;
    }

    return (profiles as ProfileRow[]).map((p) => ({
      id: p.id,
      email: users.get(p.id)?.email ?? "",
      fullName: p.full_name,
      role: p.role,
      disabledAt: p.disabled_at,
      createdAt: p.created_at,
      lastSignInAt: users.get(p.id)?.lastSignInAt ?? null,
    }));
  }

  async getAccount(id: string): Promise<Account | null> {
    const { data: p, error } = await this.db
      .from("profiles")
      .select("id, full_name, role, disabled_at, created_at")
      .eq("id", id)
      .maybeSingle();
    if (error) SupabaseStore.fail("profile", error);
    if (!p) return null;
    const { data: u } = await this.db.auth.admin.getUserById(id);
    const row = p as ProfileRow;
    return {
      id: row.id,
      email: u?.user?.email ?? "",
      fullName: row.full_name,
      role: row.role,
      disabledAt: row.disabled_at,
      createdAt: row.created_at,
      lastSignInAt: u?.user?.last_sign_in_at ?? null,
    };
  }

  async inviteDirection(email: string, fullName: string): Promise<Account> {
    const { data, error } = await this.db.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
    if (error || !data.user) SupabaseStore.fail("invitation", error);
    // The sign-up trigger creates a client profile; the owner console promotes it.
    const { error: e } = await this.db.from("profiles").update({ role: "direction", full_name: fullName }).eq("id", data.user.id);
    if (e) SupabaseStore.fail("promotion", e);
    const account = await this.getAccount(data.user.id);
    if (!account) throw new Error("invited account not found");
    return account;
  }

  async createDirection(email: string, fullName: string, password: string): Promise<Account> {
    const { data, error } = await this.db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error || !data.user) SupabaseStore.fail("account creation", error);
    const { error: e } = await this.db.from("profiles").update({ role: "direction", full_name: fullName }).eq("id", data.user.id);
    if (e) SupabaseStore.fail("promotion", e);
    const account = await this.getAccount(data.user.id);
    if (!account) throw new Error("created account not found");
    return account;
  }

  async setRole(id: string, role: Role): Promise<void> {
    const { error } = await this.db.from("profiles").update({ role }).eq("id", id);
    if (error) SupabaseStore.fail("role", error);
  }

  async suspend(id: string): Promise<void> {
    const { error } = await this.db.from("profiles").update({ disabled_at: new Date().toISOString() }).eq("id", id);
    if (error) SupabaseStore.fail("suspend", error);
    const { error: e } = await this.db.auth.admin.updateUserById(id, { ban_duration: BAN_FOREVER });
    if (e) SupabaseStore.fail("sign-in block", e);
  }

  async restore(id: string): Promise<void> {
    const { error } = await this.db.from("profiles").update({ disabled_at: null, disabled_by: null }).eq("id", id);
    if (error) SupabaseStore.fail("restore", error);
    const { error: e } = await this.db.auth.admin.updateUserById(id, { ban_duration: "none" });
    if (e) SupabaseStore.fail("sign-in unblock", e);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.db.auth.admin.deleteUser(id);
    if (error) SupabaseStore.fail("delete", error);
  }

  async recoveryLink(email: string): Promise<string> {
    const { data, error } = await this.db.auth.admin.generateLink({ type: "recovery", email });
    if (error || !data.properties?.action_link) SupabaseStore.fail("recovery link", error);
    return data.properties.action_link;
  }

  async audit(action: string, target: string | null, details: Record<string, unknown>): Promise<void> {
    const { error } = await this.db.from("audit_log").insert({ actor: null, action, target, details });
    if (error) SupabaseStore.fail("audit", error);
  }

  async listAudit(limit: number): Promise<AuditEntry[]> {
    const { data, error } = await this.db
      .from("audit_log")
      .select("id, actor, action, target, details, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) SupabaseStore.fail("audit log", error);
    return (data ?? []).map((r) => ({
      id: String(r.id),
      actor: r.actor,
      action: r.action,
      target: r.target,
      details: (r.details ?? {}) as Record<string, unknown>,
      createdAt: r.created_at,
    }));
  }
}
