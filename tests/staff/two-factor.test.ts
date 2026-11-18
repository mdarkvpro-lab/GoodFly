// 2FA backup codes.  node tests/staff/two-factor.test.ts
import { readFileSync } from "node:fs";
import { backupCodeHash, newBackupCodes, normalizeBackupCode } from "../../src/lib/staff/backup-codes.ts";

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, info = "") => {
  if (ok) pass++;
  else fail++;
  console.log(ok ? "  ✓" : "  ✘", name, ok ? "" : `— ${info}`);
};

console.log("Backup codes");
const codes = newBackupCodes();
check("10 codes are made", codes.length === 10, String(codes.length));
check("codes look like XXXXX-XXXXX, without 0, O, 1 or I", codes.every((c) => /^[2-9A-HJ-NP-Z]{5}-[2-9A-HJ-NP-Z]{5}$/.test(c)), codes.join(" "));
check("all codes are different", new Set(codes).size === 10);
check("two batches never repeat", !newBackupCodes().some((c) => codes.includes(c)));
check("typing is forgiving (case, spaces, dash)", normalizeBackupCode(" abcde-23456 ") === "ABCDE23456");
const user = "00000000-0000-0000-0000-00000000000b";
check("the hash is 64 hex characters", /^[0-9a-f]{64}$/.test(backupCodeHash(user, codes[0])));
check("the same code typed differently gives the same hash", backupCodeHash(user, "abcde 23456") === backupCodeHash(user, "ABCDE-23456"));
check("a hash belongs to one account", backupCodeHash(user, codes[0]) !== backupCodeHash("00000000-0000-0000-0000-00000000000c", codes[0]));

console.log("Same hash in the recovery Edge Function");
const bytes = new TextEncoder().encode(`goodfly-backup:${user}:${normalizeBackupCode(codes[0])}`);
const web = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map((b) => b.toString(16).padStart(2, "0")).join("");
check("WebCrypto (Edge Function) and Node agree", web === backupCodeHash(user, codes[0]));
const edge = readFileSync(new URL("../../supabase/functions/mfa-recovery/index.ts", import.meta.url), "utf8");
check("the Edge Function uses the same prefix and normalisation", edge.includes("goodfly-backup:${userId}:${clean}") && edge.includes('toUpperCase().replace(/[^A-Z0-9]/g, "")'));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
