import type { Config } from 'tailwindcss';

/** Paleta do layout "Hybrid Run — MVP": tema claro, laranja de destaque, azul para corrida longa/leve. */
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#F4F3EF', surface: '#FFFFFF', alt: '#F9F8F5', soft: '#ECEAE4', line: '#E4E2DC', line2: '#C9C6BD',
        ink: '#15171A', body: '#3E434A', muted: '#5B6068',
        accent: '#D9480F', accent2: '#B93C0A', accent3: '#8F2E07', peach: '#F2A27A', tint: '#FFF1E8', tintline: '#F3C9AE',
        blue: '#1D4ED8', bluetint: '#DCE6FB', blueink: '#1E3A8A', bluelight: '#9DB4EE',
        ok: '#1F7A4D', bad: '#B42318',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Impact', 'sans-serif'],
      },
    },
  },
} satisfies Config;
