# Modern Loading Components

Ce dossier contient des composants de chargement modernes et élégants pour améliorer l'expérience utilisateur pendant le chargement des données.

## Composants disponibles

### 1. LoadingSpinner.tsx
Composant de spinner de chargement avec plusieurs variantes:

```jsx
import { LoadingSpinner } from './LoadingSpinner';

// Utilisation de base
<LoadingSpinner />

// Avec texte
<LoadingSpinner text="Chargement..." />

// Différentes tailles
<LoadingSpinner size="sm" />
<LoadingSpinner size="md" />
<LoadingSpinner size="lg" />

// Différentes variantes
<LoadingSpinner variant="dots" />
<LoadingSpinner variant="bars" />
<LoadingSpinner variant="pulse" />
<LoadingSpinner variant="spinner" />
```

### 2. SkeletonLoader.tsx
Composants de chargement squelette:

```jsx
import { Skeleton, SkeletonCard, SkeletonGrid } from './SkeletonLoader';

// Squelette simple
<Skeleton />
<Skeleton variant="circle" />
<Skeleton variant="avatar" />

// Liste de squelettes
<SkeletonList count={3} />

// Carte de chargement
<SkeletonCard showAvatar showMedia />

// Grille de cartes
<SkeletonGrid columns={3} count={6} />
```

### 3. PageLoader.tsx
Composant de chargement de page avec overlay:

```jsx
import { PageLoader, DashboardLoader, CardLoader } from './PageLoader';

// Loader de page avec overlay
<PageLoader loading={isLoading} error={error} retryCallback={retryFunction}>
  <YourContent />
</PageLoader>

// Loader de dashboard
<DashboardLoader loading={isLoading} message="Chargement du dashboard..." />

// Loader de cartes
<CardLoader count={3} />
```

### 4. ModernListLoader.tsx
Chargeurs modernes pour listes et tableaux:

```jsx
import { ModernListLoader, ModernTableLoader, ModernCardGridLoader } from './ModernListLoader';

// Liste moderne
<ModernListLoader count={5} showAvatar showMedia />

// Tableau moderne
<ModernTableLoader rows={10} columns={4} />

// Grille de cartes moderne
<ModernCardGridLoader count={6} />
```

### 5. LoadingNotification.tsx
Notifications de chargement:

```jsx
import { LoadingNotification, LoadingProgressBar, LoadingStepper } from './LoadingNotification';

// Notification de chargement
<LoadingNotification 
  message="Opération en cours" 
  submessage="Veuillez patienter..." 
  duration={5000} 
/>

// Barre de progression
<LoadingProgressBar progress={75} message="Téléchargement" />

// Étapes de chargement
<LoadingStepper 
  steps={[
    { label: "Initialisation", description: "Préparation du système" },
    { label: "Traitement", description: "Exécution de la tâche" },
    { label: "Finalisation", description: "Sauvegarde des résultats" }
  ]} 
  currentStep={1} 
/>
```

## Hooks personnalisés

### 1. useLoadingState.ts
Gestion simple des états de chargement:

```jsx
import { useLoadingState } from '../hooks/useLoadingState';

const { isLoading, error, startLoading, stopLoading, setError } = useLoadingState();
```

### 2. useAdvancedLoading.ts
Gestion avancée du chargement avec notifications:

```jsx
import { useAdvancedLoading } from '../hooks/useAdvancedLoading';

const loading = useAdvancedLoading({
  showNotification: true,
  notificationDuration: 3000
});

// Démarrer un chargement
loading.startLoading('Chargement des données...');

// Mettre à jour la progression
loading.updateProgress(50);

// Gérer les erreurs
loading.setError('Une erreur est survenue');

// Gérer le succès
loading.setSuccess('Opération terminée');
```

### 3. useAsyncOperation.ts
Opérations asynchroniques avec gestion du chargement:

```jsx
import { useAsyncOperation } from '../hooks/useAdvancedLoading';

const { execute, isLoading, error } = useAsyncOperation(
  async () => {
    // Votre opération asynchrone
    const result = await fetchData();
    return result;
  },
  {
    onSuccess: (data) => console.log('Succès:', data),
    onError: (error) => console.error('Erreur:', error)
  }
);

// Exécuter l'opération
execute('Chargement des données...');
```

## Styles CSS

Les styles modernes sont définis dans `src/styles/modern-loading.css` et sont automatiquement importés dans `src/index.css`.

### Classes CSS disponibles:

- `.loading-spinner` - Spinner de base
- `.loading-dots` - Points animés
- `.loading-bars` - Barres animées
- `.skeleton` - Effet shimmer
- `.progress-bar` - Barre de progression

## Bonnes pratiques

1. **Utilisez des loaders significatifs** - Indiquez toujours à l'utilisateur ce qui est en cours de chargement

2. **Affichez la progression** - Lorsque possible, montrez la progression du chargement

3. **Gérez les erreurs gracieusement** - Affichez des messages d'erreur clairs et offrez des options de réessai

4. **Utilisez des animations fluides** - Les animations doivent être fluides et non perturbatrices

5. **Respectez les préférences utilisateur** - Désactivez les animations si l'utilisateur a demandé `prefers-reduced-motion`

## Personnalisation

Vous pouvez personnaliser les couleurs et les animations en modifiant les variables CSS dans `src/styles/01-tokens.css` ou en surchargeant les classes dans vos propres fichiers CSS.