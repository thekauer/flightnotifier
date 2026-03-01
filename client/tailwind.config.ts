import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class', 'media'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
