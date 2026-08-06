// lov_entries.recurrence is free text only (e.g. "Wednesdays, 9:00 AM –
// 1:30 PM (May – Nov)") — no day-of-week/rule column exists. The legacy
// V1 board (public/board/js/app.js, recurrenceToDayCode) already parses a
// weekday name out of this text; this ports that same matching (not a
// new scheme) and adds an optional month-range parse V1 doesn't have, so
// a recurring event can be expanded onto the correct calendar days
// without ever writing a new row per occurrence.

const WEEKDAY_NAMES: { name: string; code: number }[] = [
  { name: "sunday", code: 0 },
  { name: "monday", code: 1 },
  { name: "tuesday", code: 2 },
  { name: "wednesday", code: 3 },
  { name: "thursday", code: 4 },
  { name: "friday", code: 5 },
  { name: "saturday", code: 6 },
];

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];
const MONTH_PATTERN = MONTH_NAMES.map((m) => m.slice(0, 3)).join("|");
const MONTH_RANGE_RE = new RegExp(`\\b(${MONTH_PATTERN})[a-z]*\\s*[-–—]+\\s*(${MONTH_PATTERN})[a-z]*\\b`);

export interface ParsedRecurrence {
  /** 0 (Sunday) - 6 (Saturday), or null if no weekday name was found in the text. */
  dayOfWeek: number | null;
  /** Inclusive [startMonth, endMonth], 0-based, may wrap (e.g. Nov-Feb); null if no range found. */
  monthRange: [number, number] | null;
}

export function parseRecurrence(recurrence: string | null | undefined): ParsedRecurrence {
  const lower = (recurrence ?? "").toLowerCase();

  let dayOfWeek: number | null = null;
  for (const { name, code } of WEEKDAY_NAMES) {
    if (lower.includes(name)) {
      dayOfWeek = code;
      break;
    }
  }

  let monthRange: [number, number] | null = null;
  const match = lower.match(MONTH_RANGE_RE);
  if (match) {
    const start = MONTH_NAMES.findIndex((m) => m.startsWith(match[1]));
    const end = MONTH_NAMES.findIndex((m) => m.startsWith(match[2]));
    if (start >= 0 && end >= 0) monthRange = [start, end];
  }

  return { dayOfWeek, monthRange };
}

function monthInRange(month: number, range: [number, number] | null): boolean {
  if (!range) return true;
  const [start, end] = range;
  return start <= end ? month >= start && month <= end : month >= start || month <= end;
}

/** Every date-key ("YYYY-MM-DD") in the given calendar month that a weekly
 * recurring event lands on, respecting its month-range if it has one, and
 * never before today WITHIN THE CURRENT MONTH (no expired-looking past
 * occurrences earlier this month). `isCurrentMonth` gates that filter -
 * without it, navigating to a genuinely past month would make every one
 * of its days "before today" and silently erase all recurring events
 * from that month, even though dated (non-recurring) events still show
 * correctly there. Only weekly (single weekday) recurrences expand onto
 * the grid — a recurrence with no detectable weekday (e.g. "Monthly,
 * 1st Saturday") still only appears in the existing flat recurring list,
 * same as before this change. */
export function expandRecurringEventForMonth(
  recurrence: string | null | undefined,
  year: number,
  month: number,
  todayKey: string,
  isCurrentMonth: boolean,
): string[] {
  const { dayOfWeek, monthRange } = parseRecurrence(recurrence);
  if (dayOfWeek === null) return [];
  if (!monthInRange(month, monthRange)) return [];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const keys: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    if (date.getDay() !== dayOfWeek) continue;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    if (isCurrentMonth && key < todayKey) continue; // no expired occurrences earlier this month
    keys.push(key);
  }
  return keys;
}
