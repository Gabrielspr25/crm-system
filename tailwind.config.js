/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/react-app/**/*.{js,ts,jsx,tsx}",
    "./Constructor Tarifas/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        claro: {
          red: '#da291c',
          dark: '#b01b12',
          black: '#000000',
          gray: '#333333'
        }
      }
    },
  },
  plugins: [],
};
