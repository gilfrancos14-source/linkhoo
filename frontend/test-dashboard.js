// Test simple pour vérifier si DashboardPage peut être importé et rendu
import React from 'react';
import { render } from 'react-dom';
import { MemoryRouter } from 'react-router-dom';

// Importer les dépendances nécessaires
import { MarketProvider } from './src/contexts/MarketContext';
import { GerantSessionProvider } from './src/contexts/GerantSessionContext';
import { ClerkProvider } from '@clerk/clerk-react';

// Importer le composant DashboardPage
const DashboardPage = React.lazy(() => import('./src/pages/gerant/DashboardPage'));

// Créer un élément div pour le rendu
const testDiv = document.createElement('div');
testDiv.id = 'test-root';
document.body.appendChild(testDiv);

// Fonction de rendu de test
function TestDashboard() {
  return (
    <ClerkProvider publishableKey="pk_test_ZXBpYy1zcG9uZ2UtODkzMy5jbGVyay5hY2NvdW50cy5kZXYk">
      <MemoryRouter initialEntries={['/gerant']}>
        <MarketProvider>
          <GerantSessionProvider>
            <React.Suspense fallback={<div>Chargement...</div>}>
              <DashboardPage />
            </React.Suspense>
          </GerantSessionProvider>
        </MarketProvider>
      </MemoryRouter>
    </ClerkProvider>
  );
}

// Tenter de rendre le composant
try {
  render(<TestDashboard />, testDiv);
  console.log('DashboardPage rendu avec succès');
} catch (error) {
  console.error('Erreur lors du rendu de DashboardPage:', error);
}