/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/maquette/**/*.{ts,tsx}',
    './src/pages/RoomDetailMaq7.tsx',
    './src/pages/gerant/DashboardPage.tsx',
    './src/pages/gerant/ChambresPage.tsx',
    './src/pages/gerant/AjouterChambreMaq3.tsx',
    './src/pages/gerant/AjouterChambreMaq3Form.tsx',
    './src/pages/gerant/DemandesReservationMaq4.tsx',
    './src/pages/gerant/CalendrierMaq5.tsx',
    './src/pages/gerant/BoiteReceptionMaq6.tsx',
    './src/pages/gerant/verification/VerifiedSection.tsx',
    './src/pages/gerant/verification/VerificationStaticSection.tsx',
    './src/pages/gerant/verification/SuiviVerificationSection.tsx',
    './src/pages/gerant/MesInformationsMaq.tsx',
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#F85F13',
          dark: '#E04F08',
          50: '#FFF3EC',
          100: '#FFE0CE',
          500: '#f97316',
          600: '#ea580c',
          primary: '#FF5E1E',
          navy: '#0b132b',
        },
        navy: '#12284B',
        ink: '#16294B',
        muted: '#5C6B88',
        line: '#E3E9F4',
        canvas: '#F4F7FD',
        dash: {
          navy: '#0f2a5c',
          brand: {
            DEFAULT: '#f97316',
            dark: '#ea580c',
            soft: '#fff1e6',
          },
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        handwriting: ['Caveat', 'cursive'],
      },
    },
  },
  plugins: [],
};
