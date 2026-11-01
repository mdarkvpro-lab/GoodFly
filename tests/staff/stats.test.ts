// Direction dashboard statistics.  node tests/staff/stats.test.ts
import { bookingKpis, bookingsByMonth, clientsByMonth, kpis, type ProfileRow } from "../../src/lib/staff/stats.ts";

const now = new Date("2026-10-15T12:00:00Z");
const row = (role: ProfileRow["role"], created: string, disabled: string | null = null): ProfileRow => ({
  id: Math.random().toString(36).slice(2),
  full_name: "",
  email: "",
  role,
  created_at: created,
  disabled_at: disabled,
});
const rows: ProfileRow[] = [
  row("client", "2026-10-02T10:00:00Z"),
  row("client", "2026-10-09T10:00:00Z"),
  row("client", "2026-09-20T10:00:00Z", "2026-10-05T10:00:00Z"),
  row("client", "2026-09-25T10:00:00Z"),
  row("client", "2025-01-10T10:00:00Z"), // older than 12 months: not in the chart
  row("agent", "2026-10-01T10:00:00Z"),
  row("agent", "2026-08-01T10:00:00Z", "2026-09-01T10:00:00Z"),
  row("direction", "2026-10-01T10:00:00Z"),
];

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, info = "") => {
  if (ok) pass++;
  else fail++;
  console.log(ok ? "  ✓" : "  ✘", name, ok ? "" : `— ${info}`);
};

const series = clientsByMonth(rows, now);
check("12 months, oldest first, ending this month", series.length === 12 && series[11].key === "2026-10" && series[0].key === "2025-11", JSON.stringify(series.map((p) => p.key)));
check("October: 2 clients gained, 1 lost", series[11].gained === 2 && series[11].lost === 1, JSON.stringify(series[11]));
check("September: 2 clients gained, 0 lost", series[10].gained === 2 && series[10].lost === 0, JSON.stringify(series[10]));
check("agents and Direction are not counted as clients", series.reduce((n, p) => n + p.gained, 0) === 4, String(series.reduce((n, p) => n + p.gained, 0)));

const k = kpis(rows, now);
check("active clients exclude deactivated ones", k.activeClients === 4, String(k.activeClients));
check("active agents exclude deactivated ones", k.activeAgents === 1, String(k.activeAgents));
check("this month vs last month", k.newThisMonth === 2 && k.newLastMonth === 2 && k.lostThisMonth === 1 && k.lostLastMonth === 0, JSON.stringify(k));
check("January rolls back to December of the previous year", clientsByMonth([], new Date("2026-01-10T00:00:00Z"), 2)[0].key === "2025-12");

console.log("Booking statistics");
const bk = [
  { created_at: "2026-10-02T10:00:00Z", status: "new" },
  { created_at: "2026-10-03T10:00:00Z", status: "confirmed" },
  { created_at: "2026-10-04T10:00:00Z", status: "cancelled" },
  { created_at: "2026-09-10T10:00:00Z", status: "confirmed" },
  { created_at: "2026-09-11T10:00:00Z", status: "in_progress" },
  { created_at: "2025-01-01T10:00:00Z", status: "confirmed" }, // outside the 12 months
];
const bseries = bookingsByMonth(bk, now);
check("12 months, oldest first, ending this month", bseries.length === 12 && bseries[11].key === "2026-10" && bseries[0].key === "2025-11", JSON.stringify(bseries.map((p) => p.key)));
check("requests and confirmed are counted per month", bseries[11].requests === 3 && bseries[11].confirmed === 1 && bseries[10].requests === 2 && bseries[10].confirmed === 1, JSON.stringify(bseries.slice(10)));
const bkk = bookingKpis(bk, now);
check("headline numbers", bkk.thisMonth === 3 && bkk.lastMonth === 2 && bkk.confirmedThisMonth === 1 && bkk.waiting === 1, JSON.stringify(bkk));
check("confirmation rate counts decided requests only (3 confirmed / 4 decided)", bkk.confirmRate === 75, String(bkk.confirmRate));
check("no decided request: no rate (not 0 %)", bookingKpis([{ created_at: "2026-10-02T10:00:00Z", status: "new" }], now).confirmRate === null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
