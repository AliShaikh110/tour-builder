export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const timeFormat = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });

/** "Today, 6:04 PM" for today, otherwise "Oct 22, 2026". */
export function formatEditedAt(timestamp: number, now = new Date()): string {
  const date = new Date(timestamp);
  return date.toDateString() === now.toDateString()
    ? `Today, ${timeFormat.format(date)}`
    : dateFormat.format(date);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
