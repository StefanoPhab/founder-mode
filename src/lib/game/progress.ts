import { daysBetween, isSunday, weekStart } from "../time";

// Level curve: reaching level N+1 from level N costs 500 + 250 * (N - 1) XP.
export function xpToNext(level: number): number {
  return 500 + 250 * (level - 1);
}

export function levelFromXp(xp: number): { level: number; xpIntoLevel: number; xpForNext: number } {
  let level = 1;
  let rest = Math.max(0, xp);
  while (rest >= xpToNext(level)) {
    rest -= xpToNext(level);
    level++;
  }
  return { level, xpIntoLevel: rest, xpForNext: xpToNext(level) };
}

/** Total XP needed to reach `level` from zero. */
export function xpForLevel(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

/**
 * Streak over active days. A missed day is covered by Sunday (auto-frozen) or the
 * week's single freeze; otherwise the streak resets. Today never breaks it — the day
 * isn't over. Frozen days keep the streak alive but don't add to it.
 */
export function computeStreak(
  activeDays: Set<string>,
  today: string,
): { current: number; longest: number; freezesLeft: number } {
  const first = [...activeDays].sort()[0];
  if (!first || first > today) return { current: 0, longest: 0, freezesLeft: 1 };

  const freezeUsed = new Set<string>();
  let current = 0;
  let longest = 0;
  for (const day of daysBetween(first, today)) {
    if (activeDays.has(day)) {
      current++;
    } else if (day === today || isSunday(day)) {
      // today is still open; Sundays are frozen for free
    } else if (current > 0 && !freezeUsed.has(weekStart(day))) {
      freezeUsed.add(weekStart(day));
    } else {
      current = 0;
    }
    longest = Math.max(longest, current);
  }
  return { current, longest, freezesLeft: freezeUsed.has(weekStart(today)) ? 0 : 1 };
}

