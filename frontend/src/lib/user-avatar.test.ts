import { describe, expect, it } from 'vitest';
import { getUserAvatar } from './user-avatar';

describe('name-based avatars', () => {
  it.each([
    ['Alex Morgan', 'AM'],
    ['Raghavendra K J', 'RJ'],
    ['  Alice   Lee  ', 'AL'],
    ['alex.morgan@example.com', 'AM'],
    ['张伟', '张'],
    ['', 'U'],
  ])('creates readable initials for %s', (name, initials) => {
    expect(getUserAvatar(name).initials).toBe(initials);
  });

  it('uses a stable tone across case and whitespace differences', () => {
    expect(getUserAvatar('Alex Morgan').tone).toEqual(getUserAvatar('  ALEX   MORGAN ').tone);
    expect(getUserAvatar('Alex Morgan').tone).toEqual(getUserAvatar('Alex Morgan').tone);
  });
});
