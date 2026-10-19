import { describe, expect, it } from 'vitest';
import { formatDateOnly, formatLocalDate, formatLocalDateTime, formatLocalTime, formatRelativeTime, toUtcIsoString } from './datetime';
const instant = '2026-08-24T12:35:00Z';
describe('datetime', () => {
    it('formats an instant in UTC', () => expect(formatLocalDateTime(instant, 'UTC', 'en-US')).toContain('Aug 24, 2026'));
    it('converts the same instant to Asia/Kolkata', () => expect(formatLocalTime(instant, 'Asia/Kolkata', 'en-US')).toMatch(/6:05:00 PM/));
    it('converts the same instant to America/New_York', () => expect(formatLocalTime(instant, 'America/New_York', 'en-US')).toMatch(/8:35:00 AM/));
    it('converts the same instant to Europe/London during DST', () => expect(formatLocalTime(instant, 'Europe/London', 'en-GB')).toMatch(/13:35:00/));
    it('handles a DST boundary deterministically', () => expect(formatLocalTime('2026-11-01T06:30:00Z', 'America/New_York', 'en-US')).toMatch(/1:30:00 AM/));
    it('does not timezone-shift a date-only business value', () => expect(formatDateOnly('2026-08-24')).toBe('2026-08-24'));
    it('formats local date independently', () => expect(formatLocalDate(instant, 'Asia/Kolkata', 'en-GB')).toContain('24 Aug 2026'));
    it('returns safe invalid date text', () => expect(formatLocalDateTime('bad-date', 'UTC')).toBe('Invalid date'));
    it('creates UTC ISO strings', () => expect(toUtcIsoString('2026-08-24T18:05:00+05:30')).toBe('2026-08-24T12:35:00.000Z'));
    it('formats relative time', () => expect(formatRelativeTime('2026-08-24T12:34:00Z', new Date(instant))).toContain('minute'));
});
