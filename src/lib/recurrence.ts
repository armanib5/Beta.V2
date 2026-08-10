// lov_entries.recurrence is free text only (e.g. "Wednesdays, 9:00 AM –
// 1:30 PM (May – Nov)") — no day-of-week/rule column exists. The legacy
// V1 board (public/board/js/app.js, recurrenceToDayCode) already parses a
// weekday name out of this text; this ports that same matching (not a
// new scheme) and adds an optional month-range parse V1 doesn't have, so
// a recurring event can be expanded onto the correct calendar days
// without ever writing a new row per occurrence.
//
// Two patterns beyond a single plain weekday show up in real recurrence
// text and need distinct handling, not just "which weekday name appears
// first":
//  - An ordinal immediately before a weekday name ("1st Friday of every
//    month", "Monthly, 1st Saturday") means only the Nth occurrence of
//    that weekday each month, not every week.
//  - Multiple weekdays - either a range ("Thursdays–Saturdays") or a
//    list ("Fridays & Saturdays", "...; also Thursdays") - all recur
//    weekly together, not just whichever one happens to appear earliest
//    in a fixed Sunday-Saturday scan order.

const WEEKDAY_NAMES: { name: string; code: number }[] = [
  { name: "sunday", code: 0 },
  { name: "monday", code: 1 },
  { name: "tuesday", code: 2 },
  { name: "wednesday", code: 3 },
  { name: "thursday", code: 4 },
  { name: "friday", code: 5 },
  { name: "saturday", code: 6 },
];
const WEEKDAY_NAME_PATTERN = WEEKDAY_NAMES.map((w) => w.name).join("|");

const ORDINAL_WEEK: Record<string, number> = {
  "1st": 1, first: 1,
  "2nd": 2, second: 2,
  "3rd": 3, third: 3,
  "4th": 4, fourth: 4,
  "5th": 5, fifth: 5,
  last: -1,
};
const ORDINAL_RE = new RegExp(
  `\\b(1st|first|2nd|second|3rd|third|4th|fourth|5th|fifth|last)\\s+(${WEEKDAY_NAME_PATTERN})\\b`,
);
const WEEKDAY_RANGE_RE = new RegExp(`\\b(${WEEKDAY_NAME_PATTERN})s?\\s*[-–—]+\\s*(${WEEKDAY_NAME_PATTERN})s?\\b`);

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_PATTERN = MONTH_NAMES.map((m) => m.slice(0, 3)).join("|");
const MONTH_RANGE_RE = new RegExp(`\\b(${MONTH_PATTERN})[a-z]*\\s*[-–—]+\\s*(${MONTH_PATTERN})[a-z]*\\b`);

export interface OrdinalWeekday {
  /** 1-5 for "1st"-"5th", or -1 for "last". */
  week: number;
  /** 0 (Sunday) - 6 (Saturday). */
  day: number;
}

export interface ParsedRecurrence {
  /** Plain weekly weekdays (no ordinal qualifier) - recur every matching week. */
  weeklyDays: number[];
  /** "Nth weekday of the month" rules - recur only on that one occurrence per month. */
  ordinalDays: OrdinalWeekday[];
  /** Inclusive [startMonth, endMonth], 0-based, may wrap (e.g. Nov-Feb); null if no range found. */
  monthRange: [number, number] | null;
}

export function parseRecurrence(recurrence: string | null | undefined): ParsedRecurrence {
  let lower = (recurrence ?? "").toLowerCase();

  const ordinalDays: OrdinalWeekday[] = [];
  const ordinalMatch = lower.match(ORDINAL_RE);
  if (ordinalMatch) {
    const week = ORDINAL_WEEK[ordinalMatch[1]];
    const day = WEEKDAY_NAMES.find((w) => w.name === ordinalMatch[2])?.code;
    if (week !== undefined && day !== undefined) ordinalDays.push({ week, day });
    lower = lower.replace(ordinalMatch[0], "");
  }

  const weeklyDaySet = new Set<number>();
  const rangeMatch = lower.match(WEEKDAY_RANGE_RE);
  if (rangeMatch) {
    const startIdx = WEEKDAY_NAMES.findIndex((w) => w.name === rangeMatch[1]);
    const endIdx = WEEKDAY_NAMES.findIndex((w) => w.name === rangeMatch[2]);
    if (startIdx >= 0 && endIdx >= 0) {
      let i = startIdx;
      // Inclusive walk from start to end, wrapping past Saturday into
      // Sunday (e.g. "Fridays–Sundays" = Fri, Sat, Sun).
      for (;;) {
        weeklyDaySet.add(WEEKDAY_NAMES[i].code);
        if (i === endIdx) break;
        i = (i + 1) % 7;
      }
    }
    lower = lower.replace(rangeMatch[0], "");
  }

  // Any other weekday names still present - plain single mentions,
  // "&"/comma-joined lists, or an "also Thursdays" clause appended after
  // a range - all recur weekly.
  for (const { name, code } of WEEKDAY_NAMES) {
    if (lower.includes(name)) weeklyDaySet.add(code);
  }

  let monthRange: [number, number] | null = null;
  const match = lower.match(MONTH_RANGE_RE);
  if (match) {
    const start = MONTH_NAMES.findIndex((m) => m.startsWith(match[1]));
    const end = MONTH_NAMES.findIndex((m) => m.startsWith(match[2]));
    if (start >= 0 && end >= 0) monthRange = [start, end];
  }

  return { weeklyDays: [...weeklyDaySet], ordinalDays, monthRange };
}

function monthInRange(month: number, range: [number, number] | null): boolean {
  if (!range) return true;
  const [start, end] = range;
  return start <= end ? month >= start && month <= end : month >= start || month <= end;
}

/** The date-of-month (1-based) for the `week`-th occurrence of `weekday`
 * in the given month, or null if that occurrence doesn't exist (e.g. a
 * "5th Friday" in a month with only 4). week=-1 means "last". */
function nthWeekdayDateOfMonth(year: number, month: number, weekday: number, week: number): number | null {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDow = new Date(year, month, 1).getDay();
  const firstOccurrence = 1 + ((weekday - firstDow + 7) % 7);
  if (week === -1) {
    let last = firstOccurrence;
    while (last + 7 <= daysInMonth) last += 7;
    return last;
  }
  const date = firstOccurrence + (week - 1) * 7;
  return date <= daysInMonth ? date : null;
}

/** Whether a parsed recurrence rule actually lands on this exact calendar
 * date - the single source of truth both the calendar grid and the
 * "Happening Now" priority bucket build on, so a recurring event can't
 * show as live/highlighted on a day its own rule doesn't cover. */
export function recurrenceOccursOn(rule: ParsedRecurrence, date: Date): boolean {
  if (!monthInRange(date.getMonth(), rule.monthRange)) return false;
  const dow = date.getDay();
  if (rule.weeklyDays.includes(dow)) return true;
  for (const { week, day } of rule.ordinalDays) {
    if (day !== dow) continue;
    if (nthWeekdayDateOfMonth(date.getFullYear(), date.getMonth(), day, week) === date.getDate()) return true;
  }
  return false;
}

/** Every date-key ("YYYY-MM-DD") in the given calendar month that a
 * recurring event lands on, respecting its month-range if it has one,
 * and never before today WITHIN THE CURRENT MONTH (no expired-looking
 * past occurrences earlier this month). `isCurrentMonth` gates that
 * filter - without it, navigating to a genuinely past month would make
 * every one of its days "before today" and silently erase all recurring
 * events from that month, even though dated (non-recurring) events still
 * show correctly there. */
export function expandRecurringEventForMonth(
  recurrence: string | null | undefined,
  year: number,
  month: number,
  todayKey: string,
  isCurrentMonth: boolean,
): string[] {
  const rule = parseRecurrence(recurrence);
  if (rule.weeklyDays.length === 0 && rule.ordinalDays.length === 0) return [];
  if (!monthInRange(month, rule.monthRange)) return [];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const keys: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (!recurrenceOccursOn(rule, date)) continue;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (isCurrentMonth && key < todayKey) continue; // no expired occurrences earlier this month
    keys.push(key);
  }
  return keys;
}
