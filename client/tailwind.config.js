/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        accent: '#00ff88',
        gold: '#ffb800',
        neutral: {
          100: '#f8fafc',
          200: '#e2e8f0',
          300: '#cbd5f5',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
        },
      },
      boxShadow: {
        glow: '0 0 20px rgba(0, 255, 136, 0.25)',
      },
    },
  },
  plugins: [],
};
