/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      colors: {
        'smart-indigo': '#1d4ed8',
        'smart-indigo-hover': '#1e40af',
        'friendly-orange': '#ff7a30',
        'friendly-orange-hover': '#ea580c',
        'light-bg': '#f8fafc',
        'ink-dark': '#0f172a',
      }
    },
  },
  plugins: [],
}
