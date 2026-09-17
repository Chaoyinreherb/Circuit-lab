/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bench: {
          bg: '#121418',
          panel: '#1e222b',
          border: '#2e3440',
          accent: '#3b82f6',
        }
      }
    },
  },
  plugins: [],
}
