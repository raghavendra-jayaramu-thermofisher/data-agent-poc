import { BRANDING } from '../lib/branding';
import { useId } from 'react';

export function BrandLogo({
  decorative = false,
  className = '',
  paused,
}: {
  decorative?: boolean;
  className?: string;
  paused?: boolean;
}) {
  const gradientId = useId();
  const colors = ['#464EB8', '#7B83EB', '#505AC9'];
  const quadrants = [
    [0, 2],
    [1, 2],
    [2, 0],
    [1, 0],
  ];
  return (
    <svg
      className={`brand-logo ${className}`}
      viewBox="0 0 24 24"
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : BRANDING.name}
      aria-hidden={decorative || undefined}
      data-paused={paused}
      width={32}
      height={32}
    >
      <defs>
        {quadrants.map(([start, end], index) => (
          <linearGradient key={index} id={`${gradientId}-${index}`} x2="1" y2="1">
            <stop stopColor={colors[start!]} />
            <stop offset="1" stopColor={colors[end!]} />
          </linearGradient>
        ))}
      </defs>
      <path fill={`url(#${gradientId}-0)`} d="M13 11V2a9 9 0 0 1 9 9Z" />
      <path fill={`url(#${gradientId}-1)`} d="M13 13h9a9 9 0 0 1-9 9Z" />
      <path fill={`url(#${gradientId}-2)`} d="M11 13v9a9 9 0 0 1-9-9Z" />
      <path fill={`url(#${gradientId}-3)`} d="M11 11H2a9 9 0 0 1 9-9Z" />
    </svg>
  );
}
