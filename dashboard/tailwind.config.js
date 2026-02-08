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
        'primary': '#ff2d95',
        'background-light': '#1a0030',
        'background-dark': '#0a001a',
        secondary: '#b026ff',
        dark: '#0a001a',
        'dark-lighter': '#110025',
        'dark-lightest': '#1e0040',
        // Brutalist theme tokens
        'brutal-bg': '#0a001a',
        'brutal-surface': '#110025',
        'brutal-card': '#16002e',
        // Neon accent tokens
        'neon-pink': '#ff2d95',
        'neon-cyan': '#00f0ff',
        'neon-purple': '#b026ff',
        'neon-yellow': '#ffd319',
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
        'brutal': '4px 4px 0px 0px rgba(255,45,149,0.4)',
        'brutal-sm': '3px 3px 0px 0px rgba(255,45,149,0.3)',
        'brutal-lg': '8px 8px 0px 0px rgba(255,45,149,0.4)',
        'brutal-cyan': '4px 4px 0px 0px rgba(0,240,255,0.3)',
        'brutal-purple': '4px 4px 0px 0px rgba(176,38,255,0.3)',
        'brutal-yellow': '4px 4px 0px 0px rgba(255,211,25,0.3)',
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
