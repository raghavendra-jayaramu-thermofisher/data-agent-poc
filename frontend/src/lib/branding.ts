/**
 * Centralized application branding constants.
 * Modify this file to update the product name, slogans, and disclaimers across the entire UI.
 */
export const BRANDING = {
  /** Full product name */
  name: 'Data Agent',

  /** Short brand mark initials (used in compact logo badges) */
  shortName: 'DA',

  /** Accessible label for home links */
  ariaHomeLabel: 'Data Agent home',

  /** Brand tagline */
  tagline: 'Ask questions. Understand your data.',

  /** Brand subtitle description */
  subtitle: 'Explore charts and tables, check the details, and save your findings in dashboards.',

  /** Login prompt text */
  loginPrompt: 'New to Data Agent?',

  /** Disclaimer text shown under chat inputs */
  chatDisclaimer: 'Data Agent executes verified, read-only analytical SQL over authorized data sources.',
} as const;

export type BrandingConfig = typeof BRANDING;
