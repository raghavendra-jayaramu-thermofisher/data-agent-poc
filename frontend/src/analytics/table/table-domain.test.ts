import { describe, expect, it } from 'vitest';
import { formatColumnHeader } from './table-domain';

describe('formatColumnHeader', () => {
  it('prefers custom column labels when supplied', () => {
    const custom = {
      total_expense: 'Total Expense',
      reason: 'Expense Category',
    };
    expect(formatColumnHeader('total_expense', custom)).toBe('Total Expense');
    expect(formatColumnHeader('reason', custom)).toBe('Expense Category');
  });

  it('formats snake_case column names to clean Title Case', () => {
    expect(formatColumnHeader('total_revenue')).toBe('Total Revenue');
    expect(formatColumnHeader('course_name')).toBe('Course Name');
    expect(formatColumnHeader('created_at')).toBe('Created At');
    expect(formatColumnHeader('is_active')).toBe('Is Active');
  });

  it('preserves uppercase for standard abbreviations (ID, URL, API, KPI, SQL, SKU)', () => {
    expect(formatColumnHeader('customer_id')).toBe('Customer ID');
    expect(formatColumnHeader('avatar_url')).toBe('Avatar URL');
    expect(formatColumnHeader('api_key')).toBe('API Key');
    expect(formatColumnHeader('kpi_score')).toBe('KPI Score');
  });

  it('handles camelCase column names', () => {
    expect(formatColumnHeader('totalRevenue')).toBe('Total Revenue');
    expect(formatColumnHeader('customerId')).toBe('Customer ID');
  });
});
