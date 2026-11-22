#!/usr/bin/env node

/**
 * Script de déploiement automatique pour l'application PWA Phase 2
 * 
 * Ce script automatise tout le processus de déploiement de l'application
 * PWA Phase 2, depuis le build jusqu'à la configuration du serveur.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

// Configuration
const config = {
  // Informations du serveur
  server: {
    host: 'votre-serveur.com',
    username: 'username',
    webroot: '/var/www/ilehya',
    sshKey: '~/.ssh/id_rsa'
  },
  
  // Configuration du déploiement
  deploy: {
    clean: true,
    backup: true,
    test: true,
    restart: true
  },
  
  // Configuration PWA
  pwa: {
    serviceWorker: '/sw.js',
    manifest: '/manifest.json',
    icons: '/icons'
  }
};

console.log(chalk.blue.bold('🚀 Démarrage du déploiement PWA Phase 2...'));

try {
  // Étape 1: Préparation
  console.log(chalk.yellow('📋 Étape 1: Préparation...'));
  
  // Vérifier les prérequis
  checkPrerequisites();
  
  // Nettoyer le dossier de build
  if (config.deploy.clean) {
    console.log(chalk.yellow('🧹 Nettoyage du dossier de build...'));
    try {
      fs.rmSync('dist', { recursive: true, force: true });
    } catch {
      // Le dossier n'existe pas, c'est normal
    }
  }
  
  // Étape 2: Build
  console.log(chalk.yellow('🔨 Étape 2: Build de l\'application...'));
  
  // Installer les dépendances
  console.log(chalk.yellow('📦 Installation des dépendances...'));
  execSync('npm install', { stdio: 'inherit' });
  
  // Linting
  consoleSync('npm run lint', { stdio: 'inherit' });
  
  // Tests
  if (config.deploy.test) {
    console.log(chalk.yellow('🧪 Exécution des tests...'));
    execSync('npm test', { stdio: 'inherit' });
    
    // Tests PWA spécifiques
    console.log(chalk.yellow('🧪 Tests PWA spécifiques...'));
    execSync('node scripts/test-pwa.js', { stdio: 'inherit' });
  }
  
  // Build
  console.log(chalk.yellow('🔨 Build de l\'application...'));
  execSync('npm run build', { stdio: 'inherit' });
  
  // Vérifier que le build a réussi
  if (!fs.existsSync('dist')) {
    console.error(chalk.red.bold('❌ Le build a échoué'));
    process.exit(1);
  }
  
  // Étape 3: Backup (si configuré)
  if (config.deploy.backup) {
    console.log(chalk.yellow('💾 Étape 3: Création d\'un backup...'));
    createBackup();
  }
  
  // Étape 4: Déploiement
  console.log(chalk.yellow('📤 Étape 4: Déploiement des fichiers...'));
  deployFiles();
  
  // Étape 5: Configuration du serveur
  console.log(chalk.yellow('⚙️ Étape 5: Configuration du serveur...'));
  configureServer();
  
  // Étape 6: Vérification
  console.log(chalk.yellow('✅ Étape 6: Vérification du déploiement...'));
  verifyDeployment();
  
  // Étape 7: Redémarrage (si configuré)
  if (config.deploy.restart) {
    console.log(chalk.yellow('🔄 Étape 7: Redémarrage du service...'));
    restartService();
  }
  
  // Message de fin
  console.log(chalk.green.bold('\n🎉 DÉPLOIEMENT PWA PHASE 2 RÉUSSI !'));
  console.log(chalk.green('L\'application est maintenant déployée avec toutes les fonctionnalités PWA.'));
  
  // Afficher l'URL de l'application
  console.log(chalk.blue.bold('\n🌐 URL de l\'application:'));
  console.log(chalk.blue(`https://${config.server.host}`));
  
  // Afficher les vérifications à faire
  console.log(chalk.blue.bold('\n🔍 Vérifications à effectuer:'));
  console.log('1. Ouvrir l\'application dans un navigateur');
  console.log('2. Vérifier l\'invite d\'installation');
  console.log('3. Tester le mode hors-ligne');
  console.log('4. Tester les notifications push');
  console.log('5. Vérifier la synchronisation hors-ligne');
  
  process.exit(0);
  
} catch {
  console.error(chalk.red.bold('❌ ERREUR LORS DU DÉPLOIEMENT:'));
  console.error(error.message);
  
  // Tenter un rollback si un backup existe
  if (config.deploy.backup && fs.existsSync('backup')) {
    console.log(chalk.yellow('\n🔄 Tentative de rollback...'));
    rollback();
  }
  
  process.exit(1);
}

// Fonctions utilitaires

function checkPrerequisites() {
  console.log(chalk.yellow('Vérification des prérequis...'));
  
  // Vérifier Node.js
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf-8' });
    console.log(chalk.green(`✅ Node.js: ${nodeVersion.trim()}`));
  } catch {
    console.error(chalk.red('❌ Node.js n\'est pas installé'));
    process.exit(1);
  }
  
  // Vérifier npm
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf-8' });
    console.log(chalk.green(`✅ npm: ${npmVersion.trim()}`));
  } catch {
    console.error(chalk.red('❌ npm n\'est pas installé'));
    process.exit(1);
  }
  
  // Vérifier les fichiers nécessaires
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
  
  const missingFiles = [];
  requiredFiles.forEach(file => {
    if (!fs.existsSync(file)) {
      missingFiles.push(file);
    }
  });
  
  if (missingFiles.length > 0) {
    console.error(chalk.red('❌ Fichiers manquants:'));
    missingFiles.forEach(file => {
      console.error(chalk.red(`  - ${file}`));
    });
    process.exit(1);
  }
  
  console.log(chalk.green('✅ Tous les prérequis sont satisfaits'));
}

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `backup-${timestamp}`;
  const backupPath = path.join('backup', backupName);
  
  // Créer le dossier backup
  if (!fs.existsSync('backup')) {
    fs.mkdirSync('backup');
  }
  
  // Créer l'archive
  execSync(`tar -czf ${backupPath}.tar.gz -C .. ilehya-react/dist`, { stdio: 'inherit' });
  
  // Sauvegarder la configuration
  fs.writeFileSync(path.join(backupPath, 'config.json'), JSON.stringify(config, null, 2));
  
  console.log(chalk.green(`✅ Backup créé: ${backupPath}.tar.gz`));
}

function deployFiles() {
  // Créer un script de déploiement temporaire
  const deployScript = `
#!/bin/bash
# Script de déploiement PWA Phase 2

# Arrêter le service web
sudo systemctl stop nginx

# Nettoyer l'ancien déploiement
sudo rm -rf ${config.server.webroot}/*

# Déployer les nouveaux fichiers
sudo cp -r ${config.server.webroot}/* ${config.server.webroot}/

# Configurer les permissions
sudo chown -R www-data:www-data ${config.server.webroot}
sudo chmod -R 755 ${config.server.webroot}

# Redémarrer le service web
sudo systemctl start nginx

# Vérifier que tout fonctionne
curl -I https://${config.server.host}/manifest.json
curl -I https://${config.server.host}/sw.js
`;
  
  fs.writeFileSync('deploy.sh', deployScript);
  fs.chmodSync('deploy.sh', '755');
  
  // Déployer via SSH
  const scpCommand = `scp -i ${config.server.sshKey} deploy.sh ${config.server.username}@${config.server.host}:/tmp/deploy.sh`;
  execSync(scpCommand, { stdio: 'inherit' });
  
  // Exécuter le déploiement distant
  const sshCommand = `ssh -i ${config.server.sshKey} ${config.server.username}@${config.server.host} 'bash /tmp/deploy.sh'`;
  execSync(sshCommand, { stdio: 'inherit' });
  
  // Nettoyer
  fs.unlinkSync('deploy.sh');
  
  console.log(chalk.green('✅ Fichiers déployés avec succès'));
}

function configureServer() {
  // Créer un script de configuration temporaire
  const configScript = `
#!/bin/bash
# Script de configuration PWA Phase 2

# Configurer Nginx pour PWA
cat > /etc/nginx/sites-available/ilehya-pwa << 'EOF'
server {
    listen 443 ssl http2;
    server_name ${config.server.host};
    
    # SSL
    ssl_certificate /etc/letsencrypt/live/${config.server.host}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${config.server.host}/privkey.pem;
    
    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    
    # Cache headers
    location ~* [.](js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Service worker
    location = /sw.js {
        expires 0;
        add_header Cache-Control "no-cache";
    }
    
    # Manifest
    location = /manifest.json {
        expires 1d;
        add_header Cache-Control "public";
    }
    
    # Application
    location / {
        root ${config.server.webroot};
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Activer le site
sudo ln -sf /etc/nginx/sites-available/ilehya-pwa /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Tester la configuration
sudo nginx -t

# Redémarrer Nginx
sudo systemctl restart nginx
`;
  
  fs.writeFileSync('config.sh', configScript);
  fs.chmodSync('config.sh', '755');
  
  // Déployer via SSH
  const scpCommand = `scp -i ${config.server.sshKey} config.sh ${config.server.username}@${config.server.host}:/tmp/config.sh`;
  execSync(scpCommand, { stdio: 'inherit' });
  
  // Exécuter la configuration distante
  const sshCommand = `ssh -i ${config.server.sshKey} ${config.server.username}@${config.server.host} 'bash /tmp/config.sh'`;
  execSync(sshCommand, { stdio: 'inherit' });
  
  // Nettoyer
  fs.unlinkSync('config.sh');
  
  console.log(chalk.green('✅ Serveur configuré avec succès'));
}

function verifyDeployment() {
  // Vérifier les fichiers PWA
  const checks = [
    { url: '/manifest.json', expected: 'application/json' },
    { url: '/sw.js', expected: 'application/javascript' },
    { url: '/icons/icon-192.png', expected: 'image/png' },
    { url: '/icons/icon-512.png', expected: 'image/png' }
  ];
  
  checks.forEach(check => {
    try {
      const command = `curl -I https://${config.server.host}${check.url}`;
      const result = execSync(command, { encoding: 'utf-8' });
      
      if (result.includes(`Content-Type: ${check.expected}`)) {
        console.log(chalk.green(`✅ ${check.url} - OK`));
      } else {
        console.log(chalk.red(`❌ ${check.url} - Type de contenu incorrect`));
      }
    } catch {
      console.log(chalk.red(`❌ ${check.url} - Erreur`));
    }
  });
  
  console.log(chalk.green('✅ Vérification du déploiement terminée'));
}

function restartService() {
  // Redémarrer le service web
  const sshCommand = `ssh -i ${config.server.sshKey} ${config.server.username}@${config.server.host} 'sudo systemctl restart nginx'`;
  execSync(sshCommand, { stdio: 'inherit' });
  
  console.log(chalk.green('✅ Service redémarré avec succès'));
}

function rollback() {
  console.log(chalk.yellow('🔄 Rollback en cours...'));
  
  // Trouver le dernier backup
  const backupFiles = fs.readdirSync('backup');
  const latestBackup = backupFiles
    .filter(file => file.endsWith('.tar.gz'))
    .sort()
    .pop();
  
  if (!latestBackup) {
    console.error(chalk.red('❌ Aucun backup trouvé'));
    return;
  }
  
  // Restaurer le backup
  const backupPath = path.join('backup', latestBackup);
  execSync(`tar -xzf ${backupPath}`, { stdio: 'inherit' });
  
  console.log(chalk.green(`✅ Rollback effectué avec succès: ${latestBackup}`));
}