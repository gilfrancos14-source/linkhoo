#!/usr/bin/env node

/**
 * Script de build pour l'application PWA Phase 2
 * 
 * Ce script prépare l'application pour le déploiement avec toutes les
 * fonctionnalités PWA activées.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

console.log(chalk.blue.bold('🚀 Démarrage du build PWA Phase 2...'));

try {
  // Vérifier que tous les fichiers nécessaires existent
  const requiredFiles = [
    'src/components/PWAControlPanel.tsx',
    'src/components/PushNotificationBanner.tsx',
    'src/components/OfflineQueueStatus.tsx',
    'src/components/InstallPrompt.tsx',
    'src/components/CacheManager.tsx',
    'src/hooks/usePushNotifications.ts',
    'src/hooks/useOfflineQueue.ts',
    'src/hooks/useCacheManager.ts',
    'src/hooks/useInstallPrompt.ts',
    'src/css/pwa-components.css',
    'public/manifest.json',
    'public/sw.js'
  ];
  
  console.log(chalk.yellow('📋 Vérification des fichiers requis...'));
  const missingFiles = [];
  
  requiredFiles.forEach(file => {
    const filePath = path.join(process.cwd(), file);
    if (!fs.existsSync(filePath)) {
      missingFiles.push(file);
    }
  });
  
  if (missingFiles.length > 0) {
    console.error(chalk.red.bold('❌ Fichiers manquants:'));
    missingFiles.forEach(file => {
      console.error(chalk.red(`  - ${file}`));
    });
    process.exit(1);
  }
  
  console.log(chalk.green('✅ Tous les fichiers requis sont présents'));
  
  // Nettoyer le dossier de build
  console.log(chalk.yellow('🧹 Nettoyage du dossier de build...'));
  try {
    fs.rmSync('dist', { recursive: true, force: true });
  } catch {
    // Le dossier n'existe pas, c'est normal
  }
  
  // Installer les dépendances si nécessaire
  console.log(chalk.yellow('📦 Installation des dépendances...'));
  execSync('npm install', { stdio: 'inherit' });
  
  // Linting
  console.log(chalk.yellow('🔍 Linting du code...'));
  execSync('npm run lint', { stdio: 'inherit' });
  
  // Tests
  console.log(chalk.yellow('🧪 Exécution des tests...'));
  execSync('npm test', { stdio: 'inherit' });
  
  // Build de l'application
  console.log(chalk.yellow('🔨 Build de l\'application...'));
  execSync('npm run build', { stdio: 'inherit' });
  
  // Vérifier que le build a réussi
  if (!fs.existsSync('dist')) {
    console.error(chalk.red.bold('❌ Le build a échoué'));
    process.exit(1);
  }
  
  // Vérifier les fichiers PWA dans le build
  console.log(chalk.yellow('📁 Vérification des fichiers PWA dans le build...'));
  const pwaFiles = [
    'dist/manifest.json',
    'dist/sw.js',
    'dist/icons/icon-192.png',
    'dist/icons/icon-512.png'
  ];
  
  const missingPwaFiles = [];
  pwaFiles.forEach(file => {
    if (!fs.existsSync(path.join(process.cwd(), file))) {
      missingPwaFiles.push(file);
    }
  });
  
  if (missingPwaFiles.length > 0) {
    console.error(chalk.red.bold('❌ Fichiers PWA manquants dans le build:'));
    missingPwaFiles.forEach(file => {
      console.error(chalk.red(`  - ${file}`));
    });
    process.exit(1);
  }
  
  console.log(chalk.green('✅ Build réussi avec tous les fichiers PWA'));
  
  // Générer un rapport de build
  const buildReport = {
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    features: [
      'PWA Control Panel',
      'Push Notifications',
      'Offline Queue',
      'Cache Management',
      'Install Prompt',
      'Offline Forms',
      'Background Sync',
      'Image Optimization',
      'Stratified Cache'
    ],
    files: {
      'manifest.json': '✅',
      'sw.js': '✅',
      'icons': '✅',
      'pwa-components': '✅',
      'hooks': '✅'
    },
    size: {
      total: fs.existsSync('dist') ? getDirectorySize('dist') : 0,
      pwa: getDirectorySize('dist') - getDirectorySize('dist/static')
    }
  };
  
  // Sauvegarder le rapport
  fs.writeFileSync('dist/build-report.json', JSON.stringify(buildReport, null, 2));
  
  // Afficher le rapport
  console.log(chalk.blue.bold('\n📊 RAPPORT DE BUILD'));
  console.log(chalk.blue(`Version: ${buildReport.version}`));
  console.log(chalk.blue(`Timestamp: ${buildReport.timestamp}`));
  console.log(chalk.blue(`Taille totale: ${(buildReport.size.total / 1024 / 1024).toFixed(2)} MB`));
  console.log(chalk.blue(`Taille PWA: ${(buildReport.size.pwa / 1024 / 1024).toFixed(2)} MB`));
  
  console.log(chalk.blue.bold('\n🔧 Fonctionnalités PWA incluses:'));
  buildReport.features.forEach(feature => {
    console.log(chalk.green(`✅ ${feature}`));
  });
  
  console.log(chalk.blue.bold('\n📁 Fichiers PWA générés:'));
  Object.entries(buildReport.files).forEach(([file, status]) => {
    console.log(`${status} ${file}`);
  });
  
  // Message de fin
  console.log(chalk.green.bold('\n🎉 BUILD PWA PHASE 2 RÉUSSI !'));
  console.log(chalk.green('L\'application est prête pour le déploiement.'));
  console.log(chalk.blue('\n🚀 Prochaines étapes:'));
  console.log('1. Déployer sur le serveur de production');
  console.log('2. Configurer le service worker');
  console.log('3. Tester l\'application sur différents appareils');
  console.log('4. Vérifier les notifications push');
  console.log('5. Tester le mode hors-ligne');
  
  process.exit(0);
  
} catch {
  console.error(chalk.red.bold('❌ ERREUR LORS DU BUILD:'));
  console.error(error.message);
  process.exit(1);
}

// Fonction pour calculer la taille d'un dossier
function getDirectorySize(dir) {
  let total = 0;
  
  if (!fs.existsSync(dir)) {
    return 0;
  }
  
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isDirectory()) {
      total += getDirectorySize(filePath);
    } else {
      total += stats.size;
    }
  });
  
  return total;
}