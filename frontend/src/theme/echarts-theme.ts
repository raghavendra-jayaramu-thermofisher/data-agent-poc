import { designTokens } from './tokens';

export const echartsTheme = {
  color: [...designTokens.colors.chart],
  backgroundColor: 'transparent',
  textStyle: { fontFamily: designTokens.typography.ui, color: designTokens.colors.foreground },
  title: {
    textStyle: {
      fontFamily: designTokens.typography.ui,
      color: designTokens.colors.foreground,
      fontSize: 14,
      fontWeight: 600,
    },
  },
  legend: { textStyle: { color: designTokens.colors.textSecondary, fontSize: 12 } },
  categoryAxis: {
    axisLine: { lineStyle: { color: designTokens.colors.borderStrong } },
    axisTick: { lineStyle: { color: designTokens.colors.borderStrong } },
    axisLabel: { color: designTokens.colors.textSecondary, fontSize: 12 },
    splitLine: { show: false },
  },
  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: designTokens.colors.textSecondary, fontSize: 12 },
    splitLine: { lineStyle: { color: designTokens.colors.chartGrid } },
  },
  tooltip: {
    backgroundColor: designTokens.colors.surface,
    borderColor: designTokens.colors.borderStrong,
    textStyle: { color: designTokens.colors.foreground, fontSize: 12 },
  },
} as const;
