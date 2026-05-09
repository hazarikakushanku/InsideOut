export const theme = {
  colors: {
    bg: '#F8FAFC',
    surface: '#FFFFFF',
    glass: 'rgba(255,255,255,.75)',
    textPrimary: '#0F172A',
    textSecondary: '#475569',
    textMuted: '#94A3B8',
    border: '#E2E8F0',
    mint: '#2DD4BF',
    mintSoft: '#CCFBF1',
    status: {
      safe: {
        color: '#10B981',
        bg: '#D1FAE5',
        glow: 'rgba(16,185,129,.4)',
      },
      caution: {
        color: '#F59E0B',
        bg: '#FEF3C7',
        glow: 'rgba(245,158,11,.4)',
      },
      risky: {
        color: '#EF4444',
        bg: '#FEE2E2',
        glow: 'rgba(239,68,68,.4)',
      },
    },
  },
  radii: {
    card: 24,
    button: 18,
    badge: 999,
  },
  spacing: {
    xs: 6,
    sm: 10,
    md: 16,
    lg: 24,
    xl: 32,
  },
  typography: {
    heading: {
      fontWeight: '800' as const,
      letterSpacing: -0.5,
      color: '#0F172A',
    },
    subheading: {
      fontWeight: '700' as const,
      letterSpacing: -0.5,
      color: '#0F172A',
    },
    body: {
      fontWeight: '400' as const,
      color: '#475569',
    },
    caption: {
      fontWeight: '400' as const,
      color: '#94A3B8',
    },
  },
};
