// Test simple pour vérifier si DashboardPage peut être importé
try {
  import('./src/pages/gerant/DashboardPage.tsx').then(module => {
    console.log('DashboardPage importé avec succès');
    console.log('Export par défaut:', module.default ? 'Oui' : 'Non');
  }).catch(error => {
    console.error('Erreur lors de l\'import de DashboardPage:', error);
  });
} catch (error) {
  console.error('Erreur lors du test d\'import:', error);
}