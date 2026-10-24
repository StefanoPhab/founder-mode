import { TIMEZONE } from "./rules.config";

const dayFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar day (YYYY-MM-DD) of an instant, in Europe/Rome. */
export function dayKey(d: Date): string {
  return dayFmt.format(d);
}

function parseDay(day: string): Date {
  return new Date(`${day}T00:00:00Z`);
}

export function addDays(day: string, n: number): string {
  const d = parseDay(day);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. */
export function weekday(day: string): number {
  return (parseDay(day).getUTCDay() + 6) % 7;
}

export function isSunday(day: string): boolean {
  return weekday(day) === 6;
}

/** Monday of the week containing `day`; used as the week key. */
export function weekStart(day: string): string {
  return addDays(day, -weekday(day));
}

export function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The instant Europe/Rome midnight starts `day` (handles CET/CEST). */
export function startOfDay(day: string): Date {
  for (const offset of ["+02:00", "+01:00"]) {
    const d = new Date(`${day}T00:00:00${offset}`);
    if (dayKey(d) === day && dayKey(new Date(d.getTime() - 1)) !== day) return d;
  }
  return new Date(`${day}T00:00:00+01:00`);
}
