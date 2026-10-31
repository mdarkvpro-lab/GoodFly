/** In-memory store with demo data (clearly fictitious) — used by `npm run owner:demo` and the tests. */
import { randomUUID } from "node:crypto";
import type { Account, AdminStore, AuditEntry, Role } from "./store.ts";

const days = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();

export function demoAccounts(): Account[] {
  const a = (email: string, fullName: string, role: Role, extra: Partial<Account> = {}): Account => ({
    id: randomUUID(),
    email,
    fullName,
    role,
    disabledAt: null,
    createdAt: days(120),
    lastSignInAt: days(1),
    ...extra,
  });
  return [
    a("proprietaire@exemple.ma", "Propriétaire (vous)", "owner", { lastSignInAt: null }),
    a("patron.x@exemple.ma", "Patron X", "direction"),
    a("patron.y@exemple.ma", "Patron Y", "direction", { lastSignInAt: days(2) }),
    a("agent1@exemple.ma", "Agent 1", "agent"),
    a("agent2@exemple.ma", "Agent 2", "agent", { lastSignInAt: days(3) }),
    a("ancien.agent@exemple.ma", "Ancien agent", "agent", { disabledAt: days(40) }),
    a("client1@exemple.ma", "Client exemple", "client", { lastSignInAt: days(5) }),
  ];
}

export class MemoryStore implements AdminStore {
  readonly label = "Démo (données fictives)";
  accounts: Account[];
  log: AuditEntry[] = [];

  constructor(accounts: Account[] = demoAccounts()) {
    this.accounts = accounts;
  }

  private find(id: string): Account {
    const acc = this.accounts.find((x) => x.id === id);
    if (!acc) throw new Error("account not found");
    return acc;
  }

  async listAccounts() {
    return this.accounts.map((x) => ({ ...x }));
  }
  async getAccount(id: string) {
    const acc = this.accounts.find((x) => x.id === id);
    return acc ? { ...acc } : null;
  }
  async inviteDirection(email: string, fullName: string) {
    if (this.accounts.some((x) => x.email.toLowerCase() === email.toLowerCase())) throw new Error("email already registered");
    const acc: Account = { id: randomUUID(), email, fullName, role: "direction", disabledAt: null, createdAt: new Date().toISOString(), lastSignInAt: null };
    this.accounts.push(acc);
    return { ...acc };
  }
  async createDirection(email: string, fullName: string) {
    return this.inviteDirection(email, fullName);
  }
  async setRole(id: string, role: Role) {
    this.find(id).role = role;
  }
  async suspend(id: string) {
    this.find(id).disabledAt = new Date().toISOString();
  }
  async restore(id: string) {
    this.find(id).disabledAt = null;
  }
  async remove(id: string) {
    this.find(id);
    this.accounts = this.accounts.filter((x) => x.id !== id);
  }
  async recoveryLink(email: string) {
    return `https://exemple.invalid/reinitialiser?email=${encodeURIComponent(email)}`;
  }
  async audit(action: string, target: string | null, details: Record<string, unknown>) {
    this.log.unshift({ id: randomUUID(), actor: null, action, target, details, createdAt: new Date().toISOString() });
  }
  async listAudit(limit: number) {
    return this.log.slice(0, limit);
  }
}
