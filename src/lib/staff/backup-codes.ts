/**
 * 2FA backup codes (pure, unit-tested in tests/staff). Each account gets 10 single-use codes,
 * shown once; only their hashes are stored. The recovery Edge Function (supabase/functions/
 * mfa-recovery) uses the same normalisation and hash.
 */
import { createHash, randomInt } from "node:crypto";

/** No 0/O or 1/I, so a code read from paper is never ambiguous. 32 symbols → 50 bits per code. */
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const BACKUP_CODE_COUNT = 10;

/** Upper case, letters and digits only ("abcde-12345 " → "ABCDE12345"). */
export const normalizeBackupCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** 10 new codes written XXXXX-XXXXX, all different. */
export function newBackupCodes(count = BACKUP_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    let raw = "";
    for (let i = 0; i < 10; i++) raw += ALPHABET[randomInt(ALPHABET.length)];
    codes.add(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return [...codes];
}

/** The stored form of a code: tied to the account, so a hash is useless for any other account. */
export const backupCodeHash = (userId: string, code: string) =>
  createHash("sha256").update(`goodfly-backup:${userId}:${normalizeBackupCode(code)}`).digest("hex");
