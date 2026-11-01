import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#11141C', surface: '#1B1F2A', alt: '#222738', line: '#2C3244',
        ink: '#EDEFF5', muted: '#8D93A9', faint: '#5D6478',
        gold: '#E8B04B', sky: '#5AA9E6', amber: '#E8934A',
        red: '#E8654F', emerald: '#4CAF82', slate: '#5B6275',
      },
      fontFamily: { mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'] },
      borderRadius: { card: '14px' },
    },
  },
} satisfies Config;
