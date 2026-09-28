import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  isChunkError: boolean;
}

// Un chunk lazy n'est plus trouvé sur le serveur : arrive après un déploiement
// (les hashes des fichiers changent) quand un onglet ouvert utilise l'ancienne
// version de index.html. React.lazy met en mémoire l'échec d'import, donc un
// simple « réessayer » rejetterait la même promesse : il faut un vrai reload.
function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /dynamically imported module|Loading chunk|Importing a module script failed|Failed to fetch/i.test(
    error.message
  );
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, isChunkError: isChunkLoadError(error) };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false, isChunkError: false });
    }
  }

  handleRetry = () => {
    if (this.state.isChunkError) {
      // Rechargement complet : seul un nouveau index.html peut fournir les
      // hashes de chunks à jour.
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, isChunkError: false });
  };

  render() {
    if (this.state.hasError) {
      const { isChunkError } = this.state;
      return (
        <main className="error-page">
          <div className="container">
            <h1>{isChunkError ? 'Mise à jour du site' : 'Une erreur est survenue'}</h1>
            <p>
              {isChunkError
                ? 'Une nouvelle version du site vient d\'être publiée. Rechargez la page pour continuer.'
                : 'Nous nous excusons pour ce désagrément. Veuillez réessayer ultérieurement.'}
            </p>
            <button type="button" className="error-page__link" onClick={this.handleRetry}>
              {isChunkError ? 'Recharger la page' : 'Réessayer'}
            </button>
            <a href="/" className="error-page__link">Retour à l'accueil</a>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
