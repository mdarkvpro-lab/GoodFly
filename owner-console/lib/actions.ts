/**
 * Owner actions with their rules. Every successful action is written to the audit log.
 * The database rules (supabase/migrations) still apply to the website; these rules protect
 * the owner from mistakes in the console itself.
 */
import { randomBytes } from "node:crypto";
import type { Account, AdminStore, Role } from "./store.ts";

export class ActionError extends Error {}

export const PURGE_AFTER_DAYS = 30;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ASSIGNABLE: Role[] = ["direction", "agent", "client"];

export class OwnerActions {
  private store: AdminStore;
  private maxDirection: number;

  constructor(store: AdminStore, maxDirection: number) {
    this.store = store;
    this.maxDirection = maxDirection;
  }

  private async target(id: string): Promise<Account> {
    const acc = await this.store.getAccount(id);
    if (!acc) throw new ActionError("Compte introuvable.");
    if (acc.role === "owner") throw new ActionError("Le compte propriétaire ne peut pas être modifié depuis la console.");
    return acc;
  }

  private async activeDirectionCount(exceptId?: string): Promise<number> {
    const all = await this.store.listAccounts();
    return all.filter((a) => a.role === "direction" && !a.disabledAt && a.id !== exceptId).length;
  }

  private log(action: string, acc: Account | null, details: Record<string, unknown> = {}) {
    return this.store.audit(action, acc?.id ?? null, { via: "owner-console", email: acc?.email, ...details });
  }

  private async checkNewDirection(emailRaw: string, nameRaw: string) {
    const email = emailRaw.trim().toLowerCase();
    const fullName = nameRaw.trim().slice(0, 120);
    if (!EMAIL.test(email)) throw new ActionError("Adresse e-mail invalide.");
    if (!fullName) throw new ActionError("Le nom est obligatoire.");
    if ((await this.activeDirectionCount()) >= this.maxDirection) {
      throw new ActionError(`Il y a déjà ${this.maxDirection} comptes Direction actifs.`);
    }
    return { email, fullName };
  }

  async inviteDirection(emailRaw: string, nameRaw: string): Promise<Account> {
    const { email, fullName } = await this.checkNewDirection(emailRaw, nameRaw);
    const acc = await this.store.inviteDirection(email, fullName);
    await this.log("owner_invite_direction", acc, { fullName });
    return acc;
  }

  /** Creates the account directly with a strong temporary password, shown once to the owner. */
  async createDirection(emailRaw: string, nameRaw: string): Promise<{ account: Account; password: string }> {
    const { email, fullName } = await this.checkNewDirection(emailRaw, nameRaw);
    const password = randomBytes(15).toString("base64url"); // 20 characters, ~120 bits
    const account = await this.store.createDirection(email, fullName, password);
    await this.log("owner_create_direction", account, { fullName });
    return { account, password };
  }

  async setRole(id: string, roleRaw: string): Promise<void> {
    const role = roleRaw as Role;
    if (!ASSIGNABLE.includes(role)) throw new ActionError("Rôle invalide.");
    const acc = await this.target(id);
    if (acc.role === role) return;
    if (role === "direction" && (await this.activeDirectionCount(id)) >= this.maxDirection) {
      throw new ActionError(`Il y a déjà ${this.maxDirection} comptes Direction actifs.`);
    }
    await this.store.setRole(id, role);
    await this.log("owner_set_role", acc, { from: acc.role, to: role });
  }

  async suspend(id: string): Promise<void> {
    const acc = await this.target(id);
    if (acc.disabledAt) throw new ActionError("Ce compte est déjà suspendu.");
    await this.store.suspend(id);
    await this.log("owner_suspend", acc);
  }

  async restore(id: string): Promise<void> {
    const acc = await this.target(id);
    if (!acc.disabledAt) throw new ActionError("Ce compte est déjà actif.");
    if (acc.role === "direction" && (await this.activeDirectionCount(id)) >= this.maxDirection) {
      throw new ActionError(`Il y a déjà ${this.maxDirection} comptes Direction actifs.`);
    }
    await this.store.restore(id);
    await this.log("owner_restore", acc);
  }

  /** Permanent deletion: the owner must type the account's e-mail to confirm. */
  async remove(id: string, confirmEmail: string): Promise<void> {
    const acc = await this.target(id);
    if (confirmEmail.trim().toLowerCase() !== acc.email.toLowerCase()) {
      throw new ActionError("Confirmation incorrecte : saisissez exactement l'e-mail du compte.");
    }
    await this.store.remove(id);
    await this.log("owner_delete", acc, { role: acc.role, fullName: acc.fullName });
  }

  async recoveryLink(id: string): Promise<string> {
    const acc = await this.target(id);
    if (!acc.email) throw new ActionError("Ce compte n'a pas d'e-mail.");
    const link = await this.store.recoveryLink(acc.email);
    await this.log("owner_recovery_link", acc);
    return link;
  }

  /** Deletes accounts deactivated for more than 30 days (never the owner). */
  async purge(now = Date.now()): Promise<number> {
    const limit = now - PURGE_AFTER_DAYS * 86_400_000;
    const due = (await this.store.listAccounts()).filter(
      (a) => a.role !== "owner" && a.disabledAt && Date.parse(a.disabledAt) < limit,
    );
    for (const acc of due) {
      await this.store.remove(acc.id);
      await this.log("owner_purge", acc, { role: acc.role });
    }
    return due.length;
  }
}
