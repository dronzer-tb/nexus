/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        dark: '#0f172a',
        'dark-lighter': '#1e293b',
        'dark-lightest': '#334155',
      }
    },
  },
  plugins: [],
}
