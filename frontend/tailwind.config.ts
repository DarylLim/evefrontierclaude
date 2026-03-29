import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ghost: {
          bg: '#0a0e1a',
          surface: '#111827',
          border: '#1f2937',
          accent: '#00d4ff',
          warning: '#f59e0b',
          danger: '#ef4444',
          safe: '#10b981',
        },
      },
    },
  },
  plugins: [],
};

export default config;
