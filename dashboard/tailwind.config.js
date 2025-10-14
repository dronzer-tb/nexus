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
        'primary': '#0d8bf2',
        'background-light': '#f5f7f8',
        'background-dark': '#101a22',
        secondary: '#8b5cf6',
        dark: '#0f172a',
        'dark-lighter': '#1e293b',
        'dark-lightest': '#334155',
      },
      fontFamily: {
        'display': ['Space Grotesk', 'sans-serif']
      },
      borderRadius: {
        'DEFAULT': '0.25rem',
        'lg': '0.5rem',
        'xl': '0.75rem',
        'full': '9999px'
      },
    },
  },
  plugins: [],
}
