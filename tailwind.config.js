/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        rubik: ['Rubik', 'sans-serif'],
      },
      colors: {
        brand: {
          blue: '#4a7fff',
          blue2: '#3366dd',
          blue3: '#1a3a8f',
          purple: '#8b5cf6',
          purple2: '#7c3aed',
        },
      },
    },
  },
  plugins: [],
}
