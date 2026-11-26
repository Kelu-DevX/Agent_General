// Sandpoint runs on Pacific time (America/Los_Angeles), not Boise's Mountain time.
const TZ = "America/Los_Angeles";

function parts(d: Date) {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: TZ, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(d).map((x) => [x.type, x.value]),
  );
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Calendar date in Sandpoint, as YYYY-MM-DD. */
export function pacificDate(now: Date = new Date()): string {
  const { y, m, d } = parts(now);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** True once Sandpoint's calendar has moved past the season's last day. */
export function seasonOver(seasonEnd: string, now: Date = new Date()): boolean {
  return pacificDate(now) > seasonEnd;
}

/** Midnight today in Sandpoint, as a UTC "YYYY-MM-DD HH:MM:SS" string (SQLite CURRENT_TIMESTAMP format). */
export function pacificDayStartUtc(now: Date = new Date()): string {
  const { y, m, d, h, mi, s } = parts(now);
  const offsetMs = Date.UTC(y, m - 1, d, h, mi, s) - Math.floor(now.getTime() / 1000) * 1000;
  const start = new Date(Date.UTC(y, m - 1, d) - offsetMs);
  return start.toISOString().slice(0, 19).replace("T", " ");
}
