const DAY_MS = 24 * 60 * 60 * 1000;

const releaseDateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

export function toMonthKey(date) {
  return toIsoDate(date).slice(0, 7);
}

export function getMonthRange(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function getQuickRange(range, today = new Date()) {
  if (range === "week") {
    return { start: toIsoDate(today), end: toIsoDate(addDays(today, 7)) };
  }
  if (range === "quarter") {
    return { start: toIsoDate(today), end: toIsoDate(addDays(today, 90)) };
  }
  return getMonthRange(toMonthKey(today));
}

export function formatReleaseDate(isoDate) {
  if (!isoDate) return "TBA";
  const [year, month, day] = isoDate.split("-").map(Number);
  return releaseDateFormat.format(new Date(year, month - 1, day));
}

export function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString("en-ZA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const dayMonthFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});
const monthYearFormat = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
});
const weekdayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "short" });

// "14 Oct" this year, "14 Oct 2025" otherwise. Takes a full timestamp (the Library stores ISO strings).
export function formatShortDate(timestamp) {
  const date = new Date(timestamp);
  return date.getFullYear() === new Date().getFullYear()
    ? dayMonthFormat.format(date)
    : releaseDateFormat.format(date);
}

export function formatMonthYear(timestamp) {
  return monthYearFormat.format(new Date(timestamp));
}

export function formatWeekday(timestamp) {
  return weekdayFormat.format(new Date(timestamp));
}
