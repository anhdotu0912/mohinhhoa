export const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";
const dateFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: VIETNAM_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const clockFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: VIETNAM_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

function calendarDate(date: Date, short = false): string {
  const parts = dateFormat.formatToParts(date);
  return (short ? ["day", "month"] : ["day", "month", "year"]).map((kind) => parts.find((item) => item.type === kind)!.value).join("/");
}

/** API datetimes without an offset are UTC; plain calendar dates belong to Vietnam. */
export function parseMessageTime(value?: string | null): Date | null {
  if (!value?.trim()) return null;
  let raw = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) raw += "T00:00:00+07:00";
  else if (/^\d{2}\/\d{2}\/\d{4}$/.test(raw)) {
    const [day, month, year] = raw.split("/");
    raw = `${year}-${month}-${day}T00:00:00+07:00`;
  } else if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(raw)) {
    raw = raw.replace(" ", "T");
    if (!/(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(raw)) raw += "Z";
  } else return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function messageTimeIso(value?: string | null): string | undefined {
  return parseMessageTime(value)?.toISOString();
}

export function vietnamMessageDateTime(value?: string | null, short = false): string {
  const date = parseMessageTime(value);
  if (!date) return "Chưa rõ thời gian";
  return `${calendarDate(date, short)} · ${clockFormat.format(date)}`;
}

export function vietnamMessageClock(value?: string | null, now = Date.now()): string {
  const date = parseMessageTime(value);
  if (!date) return "Chưa rõ thời gian";
  return calendarDate(date) === calendarDate(new Date(now)) ? clockFormat.format(date) : vietnamMessageDateTime(value, true);
}

export function relativeMessageTime(value?: string | null, now = Date.now()): string {
  const date = parseMessageTime(value);
  if (!date) return "Chưa rõ thời gian";
  const elapsed = now - date.getTime();
  if (elapsed < -60_000) return "Sắp tới";
  const minutes = Math.floor(Math.max(0, elapsed) / 60_000);
  if (minutes < 1) return "Vừa xong";
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  // Calendar labels follow Vietnam midnight rather than the viewer's timezone.
  const calendarKey = (at: Date) => {
    const parts = new Intl.DateTimeFormat("en", { timeZone: VIETNAM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
    const part = (kind: string) => parts.find((item) => item.type === kind)!.value;
    return Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day")));
  };
  const days = Math.round((calendarKey(new Date(now)) - calendarKey(date)) / 86_400_000);
  if (days === 1) return "Hôm qua";
  if (days < 7) return `${days} ngày trước`;
  return calendarDate(date);
}
