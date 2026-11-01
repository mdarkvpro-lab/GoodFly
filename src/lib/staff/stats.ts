/** Pure statistics for the Direction dashboard (unit-tested in tests/staff). */

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  role: "owner" | "direction" | "agent" | "client";
  disabled_at: string | null;
  created_at: string;
  permissions?: string[];
};

export type MonthPoint = { key: string; gained: number; lost: number };

const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** Clients gained (sign-ups) and lost (deactivations) per month, oldest first. */
export function clientsByMonth(rows: ProfileRow[], now = new Date(), months = 12): MonthPoint[] {
  const points: MonthPoint[] = [];
  const index = new Map<string, MonthPoint>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const p = { key: monthKey(d), gained: 0, lost: 0 };
    points.push(p);
    index.set(p.key, p);
  }
  for (const r of rows) {
    if (r.role !== "client") continue;
    const g = index.get(monthKey(new Date(r.created_at)));
    if (g) g.gained++;
    if (r.disabled_at) {
      const l = index.get(monthKey(new Date(r.disabled_at)));
      if (l) l.lost++;
    }
  }
  return points;
}

export type Kpis = {
  activeClients: number;
  activeAgents: number;
  newThisMonth: number;
  newLastMonth: number;
  lostThisMonth: number;
  lostLastMonth: number;
};

export function kpis(rows: ProfileRow[], now = new Date()): Kpis {
  const series = clientsByMonth(rows, now, 2);
  const [last, current] = series;
  return {
    activeClients: rows.filter((r) => r.role === "client" && !r.disabled_at).length,
    activeAgents: rows.filter((r) => r.role === "agent" && !r.disabled_at).length,
    newThisMonth: current.gained,
    newLastMonth: last.gained,
    lostThisMonth: current.lost,
    lostLastMonth: last.lost,
  };
}

export type BookingRow = { created_at: string; status: string };
export type BookingPoint = { key: string; requests: number; confirmed: number };

/** Booking requests received and confirmed per month (by request month), oldest first. */
export function bookingsByMonth(rows: BookingRow[], now = new Date(), months = 12): BookingPoint[] {
  const points: BookingPoint[] = [];
  const index = new Map<string, BookingPoint>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const p = { key: monthKey(d), requests: 0, confirmed: 0 };
    points.push(p);
    index.set(p.key, p);
  }
  for (const r of rows) {
    const p = index.get(monthKey(new Date(r.created_at)));
    if (!p) continue;
    p.requests++;
    if (r.status === "confirmed") p.confirmed++;
  }
  return points;
}

export type BookingKpis = { thisMonth: number; lastMonth: number; confirmedThisMonth: number; waiting: number; confirmRate: number | null };

/** Headline numbers; the confirmation rate covers requests that were decided (confirmed or cancelled). */
export function bookingKpis(rows: BookingRow[], now = new Date()): BookingKpis {
  const [last, current] = bookingsByMonth(rows, now, 2);
  const decided = rows.filter((r) => r.status === "confirmed" || r.status === "cancelled").length;
  const confirmed = rows.filter((r) => r.status === "confirmed").length;
  return {
    thisMonth: current.requests,
    lastMonth: last.requests,
    confirmedThisMonth: current.confirmed,
    waiting: rows.filter((r) => r.status === "new").length,
    confirmRate: decided ? Math.round((confirmed / decided) * 100) : null,
  };
}
