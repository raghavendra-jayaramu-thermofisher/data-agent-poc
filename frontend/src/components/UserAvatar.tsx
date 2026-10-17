import { getUserAvatar } from '../lib/user-avatar';

export function UserAvatar({ name }: { name: string }) {
  const { label, initials, tone } = getUserAvatar(name);
  return (
    <span
      className="user-avatar"
      role="img"
      aria-label={`${label} avatar`}
      title={label}
      style={{ backgroundColor: tone.background, color: tone.foreground }}
    >
      <span aria-hidden="true">{initials}</span>
    </span>
  );
}
