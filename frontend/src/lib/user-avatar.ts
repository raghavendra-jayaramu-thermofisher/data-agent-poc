const tones = [
  { background: 'var(--db-primary-soft)', foreground: 'var(--db-primary-pressed)' },
  { background: 'var(--db-info-soft)', foreground: 'var(--db-info)' },
  { background: 'var(--db-success-soft)', foreground: 'var(--db-success)' },
  { background: 'var(--db-warning-soft)', foreground: 'var(--db-warning)' },
  { background: 'var(--db-danger-soft)', foreground: 'var(--db-danger)' },
] as const;

/** Creates the same local avatar for a name everywhere it appears in the app. */
export function getUserAvatar(name: string) {
  const label = name.trim().replace(/\s+/g, ' ') || 'User';
  const normalized = label.normalize('NFC').toLocaleLowerCase('en-US');
  const words = label
    .split('@')[0]!
    .split(/[\s._,+-]+/)
    .filter(Boolean);
  const first = Array.from(words[0] ?? 'U')[0]!;
  const last = words.length > 1 ? Array.from(words.at(-1)!)[0]! : '';
  let hash = 0;
  for (const character of normalized) hash = (hash * 31 + character.codePointAt(0)!) >>> 0;
  return {
    label,
    initials: (first + last).toLocaleUpperCase('en-US'),
    tone: tones[hash % tones.length]!,
  };
}
