/** Pure statistics for the Direction dashboard (unit-tested in tests/staff). */

export type ProfileRow = {
  id: string;
  full_name: string;
  email: string;
  role: "owner" | "direction" | "agent" | "client";
  disabled_at: string | null;
  created_at: string;
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
