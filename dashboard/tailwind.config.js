/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': 'rgb(var(--neon-pink-rgb) / <alpha-value>)',
        'background-light': 'rgb(var(--brutal-surface-rgb) / <alpha-value>)',
        'background-dark': 'rgb(var(--brutal-bg-rgb) / <alpha-value>)',
        secondary: 'rgb(var(--neon-purple-rgb) / <alpha-value>)',
        dark: 'rgb(var(--brutal-bg-rgb) / <alpha-value>)',
        'dark-lighter': 'rgb(var(--brutal-surface-rgb) / <alpha-value>)',
        'dark-lightest': 'rgb(var(--brutal-card-rgb) / <alpha-value>)',
        'brutal-bg': 'rgb(var(--brutal-bg-rgb) / <alpha-value>)',
        'brutal-surface': 'rgb(var(--brutal-surface-rgb) / <alpha-value>)',
        'brutal-card': 'rgb(var(--brutal-card-rgb) / <alpha-value>)',
        'neon-pink': 'rgb(var(--neon-pink-rgb) / <alpha-value>)',
        'neon-cyan': 'rgb(var(--neon-cyan-rgb) / <alpha-value>)',
        'neon-purple': 'rgb(var(--neon-purple-rgb) / <alpha-value>)',
        'neon-yellow': 'rgb(var(--neon-yellow-rgb) / <alpha-value>)',
        'tx': 'rgb(var(--theme-text-rgb) / <alpha-value>)',
        'on-primary': 'var(--on-primary)',
      },
      fontFamily: {
        'display': ['Space Grotesk', 'sans-serif'],
        'brutal': ['Space Mono', 'monospace'],
        'mono': ['Space Mono', 'monospace'],
      },
      borderRadius: {
        'DEFAULT': '0px',
        'lg': '0px',
        'xl': '0px',
        'full': '9999px'
      },
      boxShadow: {
        'brutal': '4px 4px 0px 0px rgb(var(--neon-pink-rgb) / 0.4)',
        'brutal-sm': '3px 3px 0px 0px rgb(var(--neon-pink-rgb) / 0.3)',
        'brutal-lg': '8px 8px 0px 0px rgb(var(--neon-pink-rgb) / 0.4)',
        'brutal-cyan': '4px 4px 0px 0px rgb(var(--neon-cyan-rgb) / 0.3)',
        'brutal-purple': '4px 4px 0px 0px rgb(var(--neon-purple-rgb) / 0.3)',
        'brutal-yellow': '4px 4px 0px 0px rgb(var(--neon-yellow-rgb) / 0.3)',
      },
      animation: {
        'marquee': 'marquee 30s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
}
