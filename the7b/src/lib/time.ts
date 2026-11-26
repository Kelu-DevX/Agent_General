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
  const { y, m, d } = parts(now);
  const midnightAsUtc = Date.UTC(y, m - 1, d);
  // Use the UTC offset in force at midnight itself, not now: they differ on daylight-saving days.
  // offsetAt(t) is Sandpoint wall-clock minus UTC (e.g. -8h in winter). Guess with now's offset,
  // then correct with the offset at the guessed instant.
  const offsetAt = (t: number) => {
    const p = parts(new Date(t));
    return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(t / 1000) * 1000;
  };
  const guess = midnightAsUtc - offsetAt(now.getTime());
  const start = midnightAsUtc - offsetAt(guess);
  return new Date(start).toISOString().slice(0, 19).replace("T", " ");
}

/** "2026-12-06 23:12:00" (UTC, SQLite format) -> "Dec 6, 3:12 PM" in Sandpoint. */
export function pacificShort(utc: string): string {
  const d = new Date(utc.replace(" ", "T") + (utc.endsWith("Z") ? "" : "Z"));
  if (Number.isNaN(d.getTime())) return utc;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  }).format(d);
}
