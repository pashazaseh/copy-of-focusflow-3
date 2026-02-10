const defaultTheme = require('tailwindcss/defaultTheme');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}",
    "./electron/**/*.{js,ts,jsx,tsx}",
    "./*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', ...defaultTheme.fontFamily.sans],
        orbitron: ['Orbitron', 'sans-serif'],
        'space-mono': ['"Space Mono"', 'monospace'],
      },
      animation: {
        'spin-slow': 'spin 20s linear infinite',
        'pulse-glow': 'pulse-glow 4s ease-in-out infinite',
      },
      backgroundImage: {
        'radial-dark': 'radial-gradient(ellipse at center, #000 0%, #111827 80%)',
        'radial-cyber': 'radial-gradient(ellipse at center, #000 0%, #050505 80%)',
        'radial-light': 'radial-gradient(ellipse at center, #ccc 0%, #fff 70%)',
      },
      backgroundImage: {
        'radial-dark': 'radial-gradient(ellipse at center, #000 0%, #111827 80%)',
        'radial-cyber': 'radial-gradient(ellipse at center, #000 0%, #050505 80%)',
        'radial-light': 'radial-gradient(ellipse at center, #ccc 0%, #fff 70%)',
      }
    },
  },
  plugins: [],
}
