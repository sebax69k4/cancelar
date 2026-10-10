const LOCALE = 'es-AR';

const dateFmt = new Intl.DateTimeFormat(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
});
const moneyFmt = new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const relFmt = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

export function formatDate(iso: string): string {
  return dateFmt.format(new Date(iso));
}

export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso));
}

export function formatMoney(value: number): string {
  return moneyFmt.format(value);
}

/** 5 → "5 h", 30 → "30 h", 75 → "3 d 3 h" */
export function formatHours(hours: number): string {
  const h = Math.max(0, Math.floor(hours));
  if (h < 1) return '< 1 h';
  if (h < 48) return `${h} h`;
  const d = Math.floor(h / 24);
  const rest = h % 24;
  return rest ? `${d} d ${rest} h` : `${d} d`;
}

export function formatRelative(iso: string, now: number = Date.now()): string {
  const diffMin = Math.round((new Date(iso).getTime() - now) / 60000);
  if (Math.abs(diffMin) < 1) return 'recién';
  if (Math.abs(diffMin) < 60) return relFmt.format(diffMin, 'minute');
  const diffH = Math.round(diffMin / 60);
  if (Math.abs(diffH) < 48) return relFmt.format(diffH, 'hour');
  return relFmt.format(Math.round(diffH / 24), 'day');
}

export function hoursBetween(fromIso: string, to: number = Date.now()): number {
  return (to - new Date(fromIso).getTime()) / 3_600_000;
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}
