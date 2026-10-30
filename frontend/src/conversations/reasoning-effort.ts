import type { ModelProfile } from '../api/types';

export type ReasoningEffort = ModelProfile['reasoning_efforts'][number];

export const REASONING_EFFORT_LABELS: Record<ReasoningEffort, string> = {
  none: 'None',
  minimal: 'Minimal',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  xhigh: 'Extra high',
  max: 'Max',
};

/** The profile a question runs on: the chosen one, else the fallback (conversation or workspace default). */
export function effectiveProfile(
  profiles: ModelProfile[],
  selectedProfileId: string | null,
  fallbackProfileId?: string | null,
): ModelProfile | undefined {
  return (
    profiles.find((profile) => profile.id === selectedProfileId) ??
    profiles.find((profile) => profile.id === fallbackProfileId) ??
    profiles.find((profile) => profile.is_default)
  );
}

export function supportsEffort(profile: ModelProfile | undefined, effort: ReasoningEffort | null): boolean {
  return effort === null || Boolean(profile?.reasoning_efforts.includes(effort));
}
