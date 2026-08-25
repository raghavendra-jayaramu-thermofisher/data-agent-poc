export type DateInput = string | number | Date;
function validDate(value: DateInput): Date | null { const d = value instanceof Date ? value : new Date(value); return Number.isNaN(d.getTime()) ? null : d; }
export function getLocalTimeZone() { return Intl.DateTimeFormat().resolvedOptions().timeZone; }
export function formatLocalDateTime(value: DateInput, timeZone = getLocalTimeZone(), locale = 'en-US') {
    const d = validDate(value);
    if (!d)
        return 'Invalid date';
    return new Intl.DateTimeFormat(locale, { timeZone, year: 'numeric', month: 'short', day: '2-digit', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(d);
}
export function formatLocalDate(value: DateInput, timeZone = getLocalTimeZone(), locale = 'en-US') {
    const d = validDate(value);
    if (!d)
        return 'Invalid date';
    return new Intl.DateTimeFormat(locale, { timeZone, year: 'numeric', month: 'short', day: '2-digit' }).format(d);
}
export function formatLocalTime(value: DateInput, timeZone = getLocalTimeZone(), locale = 'en-US') {
    const d = validDate(value);
    if (!d)
        return 'Invalid date';
    return new Intl.DateTimeFormat(locale, { timeZone, hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }).format(d);
}
export function formatRelativeTime(value: DateInput, now = new Date()) {
    const d = validDate(value);
    if (!d)
        return 'Invalid date';
    const seconds = Math.round((d.getTime() - now.getTime()) / 1000);
    const abs = Math.abs(seconds);
    const [amount, unit]: [
        number,
        Intl.RelativeTimeFormatUnit
    ] = abs < 60 ? [seconds, 'second'] : abs < 3600 ? [Math.round(seconds / 60), 'minute'] : abs < 86400 ? [Math.round(seconds / 3600), 'hour'] : [Math.round(seconds / 86400), 'day'];
    return new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' }).format(amount, unit);
}
export function toUtcIsoString(value: DateInput) { const d = validDate(value); return d ? d.toISOString() : null; }
export function formatDateOnly(value: string) { return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : 'Invalid date'; }
