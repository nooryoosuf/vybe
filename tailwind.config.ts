import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        vybe: {
          bg: '#07080D',
          surface: '#0D0F18',
          elevated: '#131624',
          card: '#161A2B',
          border: 'rgba(255, 255, 255, 0.08)',
          accent: '#6D5DFB',
          accentLight: '#8B7CFD',
          accentDark: '#5241E0',
          indigo: '#4F46E5',
          violet: '#7C3AED',
          crimson: '#E50914',
          emerald: '#10B981',
          amber: '#F59E0B',
        },
      },
      fontFamily: {
        sans: ['var(--font-jakarta)', 'Inter', 'system-ui', 'sans-serif'],
        display: ['var(--font-space)', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'vybe-radial': 'radial-gradient(circle at 50% 0%, rgba(109, 93, 251, 0.16) 0%, rgba(13, 15, 24, 0) 70%)',
        'vybe-glow': 'radial-gradient(ellipse at center, rgba(124, 58, 237, 0.25) 0%, transparent 70%)',
      },
      boxShadow: {
        'vybe-sm': '0 4px 20px -2px rgba(0, 0, 0, 0.5)',
        'vybe-lg': '0 20px 50px -12px rgba(0, 0, 0, 0.75)',
        'vybe-accent': '0 0 32px -4px rgba(109, 93, 251, 0.45)',
      },
      animation: {
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float-slow': 'vybeFloat 6s ease-in-out infinite',
      },
      keyframes: {
        vybeFloat: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
