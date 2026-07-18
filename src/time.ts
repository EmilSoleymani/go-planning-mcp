// Toronto clock helpers: Metrolinx sends naive "YYYY-MM-DD HH:MM:SS" strings
// with no timezone info (confirmed live, tool-schemas spec §5) — treated as
// America/Toronto wall-clock time throughout the server.

const TORONTO_TZ = "America/Toronto";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

interface NaiveParts {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
}

function parseNaiveParts(naive: string): NaiveParts {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(naive);
  if (!match) throw new Error(`Unrecognized Metrolinx timestamp: ${naive}`);
  const [, y, mo, d, h, mi, s] = match as unknown as [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
  return {
    y: Number(y),
    mo: Number(mo),
    d: Number(d),
    h: Number(h),
    mi: Number(mi),
    s: Number(s),
  };
}

function offsetMinutesAt(instant: Date, timeZone: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(instant).map((p) => [p.type, p.value]),
  );
  // Some locales render midnight as "24" for 2-digit hour12:false formats.
  const hour = parts.hour === "24" ? "00" : parts.hour;
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - instant.getTime()) / 60_000;
}

function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? "-" : "+";
  const abs = Math.abs(minutes);
  return `${sign}${pad2(Math.floor(abs / 60))}:${pad2(abs % 60)}`;
}

/**
 * Converts a naive Metrolinx "YYYY-MM-DD HH:MM:SS" Toronto wall-clock string
 * into full ISO 8601 with the DST-aware offset attached.
 *
 * The offset is resolved by treating the naive components as a UTC instant
 * guess and reading Toronto's actual offset near that instant — correct
 * except inside the ~1h DST-transition window itself, an accepted starting
 * heuristic (same spirit as the arrive_by heuristic, tool-schemas spec §5).
 */
export function toIsoWithTorontoOffset(naive: string): string {
  const { y, mo, d, h, mi, s } = parseNaiveParts(naive);
  const guessUtc = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  const offset = offsetMinutesAt(guessUtc, TORONTO_TZ);
  return `${String(y).padStart(4, "0")}-${pad2(mo)}-${pad2(d)}T${pad2(h)}:${pad2(mi)}:${pad2(s)}${formatOffset(offset)}`;
}

/** Minutes between two naive same-timezone Metrolinx timestamps (later − earlier). */
export function diffMinutes(laterNaive: string, earlierNaive: string): number {
  const a = parseNaiveParts(laterNaive);
  const b = parseNaiveParts(earlierNaive);
  const aMs = Date.UTC(a.y, a.mo - 1, a.d, a.h, a.mi, a.s);
  const bMs = Date.UTC(b.y, b.mo - 1, b.d, b.h, b.mi, b.s);
  return Math.round((aMs - bMs) / 60_000);
}

/** Current Toronto-local date and time, for input parameters that default to "now". */
export function nowInToronto(): { date: string; time: string } {
  const dtf = new Intl.DateTimeFormat("en-CA", {
    timeZone: TORONTO_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const parts = Object.fromEntries(
    dtf.formatToParts(new Date()).map((p) => [p.type, p.value]),
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}`,
  };
}

/** Adds (or subtracts) hours to an "HH:MM" time, wrapping within a 24h day. */
export function addHoursToTime(time: string, hours: number): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) throw new Error(`Unrecognized HH:MM time: ${time}`);
  const [, hh, mm] = match as unknown as [string, string, string];
  const minutesInDay = 24 * 60;
  const total =
    (Number(hh) * 60 + Number(mm) + hours * 60 + minutesInDay * 100) %
    minutesInDay;
  return `${pad2(Math.floor(total / 60))}:${pad2(total % 60)}`;
}

/** "HH:MM" -> Metrolinx's "HHmm" wire format. */
export function hhmmToWire(time: string): string {
  return time.replace(":", "");
}

/** "YYYY-MM-DD" -> Metrolinx's "yyyymmdd" wire format. */
export function dateToWire(date: string): string {
  return date.replaceAll("-", "");
}
