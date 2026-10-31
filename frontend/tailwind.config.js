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
    './src/pages/gerant/PremiumPage.tsx',
    './src/pages/gerant/verification/VerifiedSection.tsx',
    './src/pages/gerant/verification/VerificationStaticSection.tsx',
    './src/pages/gerant/verification/SuiviVerificationSection.tsx',
    './src/pages/gerant/MesInformationsMaq.tsx',
    './src/components/gerant-profile/**/*.tsx',
    './src/pages/client-compte/ClientDashboardMaq.tsx',
    './src/pages/client-compte/ClientReservationsMaq.tsx',
    './src/pages/LaisserAvisPage.tsx',
    './src/pages/messages/ClientMessagesMaq.tsx',
    './src/components/BrandLogo.tsx',
  ],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#FF6A13',
          dark: '#E04F08',
          50: '#FFF3EC',
          100: '#FFE0CE',
          500: '#f97316',
          600: '#ea580c',
          primary: '#FF5E1E',
          navy: '#0b132b',
        },
        habi: {
          DEFAULT: '#F26A1B',
          dark: '#D9560C',
          soft: '#FFF1E8',
        },
        navy: {
          DEFAULT: '#0B2A55',
          900: '#081D3F',
        },
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
        inter: ['Inter Variable', 'system-ui', 'sans-serif'],
        sans: ['"Plus Jakarta Sans Variable"', 'sans-serif'],
        handwriting: ['Caveat Variable', 'cursive'],
      },
    },
  },
  plugins: [],
};
