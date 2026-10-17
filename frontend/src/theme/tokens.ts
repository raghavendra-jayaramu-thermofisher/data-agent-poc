export const designTokens = {
  colors: {
    primary: '#5B5FC7',
    primaryHover: '#4F52B2',
    primaryPressed: '#444791',
    primarySoft: '#ECECF9',
    onPrimary: '#FFFFFF',
    signal: '#E3AC19',
    signalHover: '#CB970E',
    signalSoft: '#FFF4CC',
    canvas: '#F5F7FB',
    background: '#F5F7FB',
    ambientStart: '#EEF1FC',
    ambientEnd: '#F7F9FC',
    sidebarSurface: '#F0F2FA',
    userMessage: '#ECEEF9',
    surface: '#FFFFFF',
    surfaceRaised: '#FFFFFF',
    surfaceMuted: '#F3F4F8',
    surfaceHover: '#EAECF3',
    foreground: '#262626',
    textPrimary: '#262626',
    textSecondary: '#626268',
    textMuted: '#727278',
    textDisabled: '#AAAAB0',
    surfaceSelected: '#E9EAFB',
    chartGrid: '#E9ECF3',
    chartAxis: '#727278',
    border: '#E2E5ED',
    borderDefault: '#E2E5ED',
    borderSubtle: '#EDF0F5',
    borderStrong: '#C9CDDA',
    focusRing: '#5B5FC7',
    success: '#32745A',
    successSoft: '#E5F1EB',
    warning: '#8C5A00',
    warningSoft: '#F8EDCF',
    danger: '#A84545',
    dangerSoft: '#F7E7E5',
    info: '#346495',
    infoSoft: '#E7EEF6',
    chart: [
      '#588CCC',
      '#4E948C',
      '#8A7FB0',
      '#D0A348',
      '#CF7F87',
      '#718F66',
      '#9B6C8F',
      '#79818E',
    ] as const,
  },
  radius: { default: 4, sm: 4, md: 6, lg: 8, status: 9999 },
  spacing: { xxs: 2, xs: 4, sm: 6, md: 8, lg: 12, xl: 16, xxl: 24, page: 20 },
  typography: {
    ui: '"IBM Plex Sans", system-ui, sans-serif',
    code: '"Source Code Pro", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
} as const;

/** The app and ECharts share this palette; CSS consumes the variables set before React mounts. */
export function applyDesignTokens(root: HTMLElement) {
  for (const [name, value] of Object.entries(designTokens.colors)) {
    if (typeof value === 'string')
      root.style.setProperty(
        '--db-' + name.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase()),
        value,
      );
  }
  designTokens.colors.chart.forEach((color, index) =>
    root.style.setProperty('--db-chart-' + (index + 1), color),
  );
  root.style.setProperty('--db-font-ui', designTokens.typography.ui);
  root.style.setProperty('--db-font-mono', designTokens.typography.code);
}
