/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,js}",
    "./*.html",
    "./**/*.html"
  ],
  theme: {
    extend: {
      colors: {
        primary: '#6366f1',
        darkbg: '#0f172a',
        card: '#1e293b'
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif']
      }
    },
  },
  plugins: [],
}
