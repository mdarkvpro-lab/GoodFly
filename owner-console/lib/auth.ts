/**
 * Local-only protection for the owner console:
 *  - only loopback Host headers are served (blocks DNS-rebinding and LAN access),
 *  - owner passcode (scrypt hash in .env.local), with a lockout after repeated failures,
 *  - in-memory sessions (HttpOnly, SameSite=Strict cookie) that expire when idle,
 *  - a CSRF token plus an Origin check on every POST.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";

const SCRYPT = { N: 1 << 15, r: 8, p: 1, keylen: 32, maxmem: 64 * 1024 * 1024 };

export function hashPasscode(passcode: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(passcode, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: SCRYPT.maxmem });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPasscode(passcode: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, N, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const actual = scryptSync(passcode, Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export const COOKIE = "gf_owner";
const IDLE_MS = 30 * 60_000;
const MAX_FAILURES = 5;
const LOCK_MS = 15 * 60_000;

type Session = { csrf: string; lastSeen: number };

export class Guard {
  private sessions = new Map<string, Session>();
  private failures = 0;
  private lockedUntil = 0;

  private passcodeHash: string;
  private port: number;
  private now: () => number;

  constructor(passcodeHash: string, port: number, now: () => number = Date.now) {
    this.passcodeHash = passcodeHash;
    this.port = port;
    this.now = now;
  }

  /** Host must be loopback on our port. */
  hostAllowed(req: IncomingMessage): boolean {
    const host = req.headers.host ?? "";
    return [`127.0.0.1:${this.port}`, `localhost:${this.port}`, `[::1]:${this.port}`].includes(host);
  }

  /** POSTs must come from our own pages. */
  originAllowed(req: IncomingMessage): boolean {
    const origin = req.headers.origin;
    if (!origin) return false;
    return [`http://127.0.0.1:${this.port}`, `http://localhost:${this.port}`, `http://[::1]:${this.port}`].includes(origin);
  }

  lockRemainingMs(): number {
    return Math.max(0, this.lockedUntil - this.now());
  }

  /** Returns a session token on success. */
  login(passcode: string): { ok: true; token: string } | { ok: false; locked: boolean } {
    if (this.lockRemainingMs() > 0) return { ok: false, locked: true };
    if (!verifyPasscode(passcode, this.passcodeHash)) {
      this.failures++;
      if (this.failures >= MAX_FAILURES) {
        this.lockedUntil = this.now() + LOCK_MS;
        this.failures = 0;
        return { ok: false, locked: true };
      }
      return { ok: false, locked: false };
    }
    this.failures = 0;
    const token = randomBytes(32).toString("base64url");
    this.sessions.set(token, { csrf: randomBytes(24).toString("base64url"), lastSeen: this.now() });
    return { ok: true, token };
  }

  logout(token: string | undefined) {
    if (token) this.sessions.delete(token);
  }

  /** The live session for this request (refreshes the idle timer), or null. */
  session(req: IncomingMessage): { token: string; csrf: string } | null {
    const token = readCookie(req, COOKIE);
    if (!token) return null;
    const s = this.sessions.get(token);
    if (!s) return null;
    if (this.now() - s.lastSeen > IDLE_MS) {
      this.sessions.delete(token);
      return null;
    }
    s.lastSeen = this.now();
    return { token, csrf: s.csrf };
  }
}

export function readCookie(req: IncomingMessage, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function sessionCookie(token: string): string {
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${IDLE_MS / 1000}`;
}

export const clearedCookie = `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`;

/** Constant-time comparison for CSRF tokens. */
export function sameToken(a: string | undefined, b: string): boolean {
  if (!a) return false;
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
