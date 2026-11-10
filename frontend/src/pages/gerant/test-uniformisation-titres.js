// Test pour vérifier l'uniformisation des titres dans les pages du gestionnaire
// Ce script vérifie que tous les titres utilisent la classe dash-page-head

const fs = require('fs');
const path = require('path');

// Liste des fichiers à vérifier
const filesToCheck = [
  'DashboardPage.tsx',
  'ChambresPage.tsx',
  'ReservationsPage.tsx',
  'BoiteReceptionMaq6.tsx',
  'AjouterChambreMaq3.tsx',
  'CalendrierMaq5.tsx',
  'DemandesReservationMaq4.tsx',
  'PremiumPage.tsx',
  'verification/VerificationStaticSection.tsx',
  'verification/SuiviVerificationSection.tsx',
  'AjouterChambreMaq3Form.tsx'
];

const gerantPath = path.join(__dirname, '..');
let allTitlesUseCorrectClass = true;

console.log('Vérification de l\'uniformisation des titres...\n');

filesToCheck.forEach(file => {
  const filePath = path.join(gerantPath, file);
  
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Vérifier si le fichier contient des titres h1 ou h2 sans la classe dash-page-head
    const h1Matches = content.match(/<h1[^>]*>(.*?)<\/h1>/g) || [];
    const h2Matches = content.match(/<h2[^>]*>(.*?)<\/h2>/g) || [];
    
    let hasIncorrectTitles = false;
    
    // Vérifier les titres h1
    h1Matches.forEach(match => {
      if (!match.includes('dash-page-head')) {
        console.log(`❌ Titre h1 incorrect trouvé dans ${file}: ${match}`);
        hasIncorrectTitles = true;
      }
    });
    
    // Vérifier les titres h2
    h2Matches.forEach(match => {
      if (!match.includes('dash-page-head')) {
        console.log(`❌ Titre h2 incorrect trouvé dans ${file}: ${match}`);
        hasIncorrectTitles = true;
      }
    });
    
    if (!hasIncorrectTitles) {
      console.log(`✅ ${file}: Tous les titres utilisent la classe dash-page-head`);
    } else {
      allTitlesUseCorrectClass = false;
    }
  } else {
    console.log(`⚠️  Fichier non trouvé: ${file}`);
  }
});

console.log('\nRésultat final:');
if (allTitlesUseCorrectClass) {
  console.log('✅ Tous les titres sont uniformisés avec la classe dash-page-head');
} else {
  console.log('❌ Certains titres n\'utilisent pas la classe dash-page-head');
}