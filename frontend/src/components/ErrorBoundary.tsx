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

/** Icône unique, en trait fin, pour rester autonome (aucun import applicatif). */
function StatusIcon({ update }: { update: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true" focusable="false">
      {update ? (
        <path
          d="M12 3.5 13.6 9a2 2 0 0 0 1.4 1.4l5.5 1.6-5.5 1.6A2 2 0 0 0 13.6 15L12 20.5 10.4 15a2 2 0 0 0-1.4-1.4L3.5 12l5.5-1.6A2 2 0 0 0 10.4 9L12 3.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      ) : (
        <path
          d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94L14.7 6.3Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      )}
    </svg>
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
        <main className="status-page">
          <div className="status-page__inner">
            <div className="status-page__icon" aria-hidden="true">
              <StatusIcon update={isChunkError} />
            </div>

            <p className="status-page__eyebrow">
              {isChunkError ? 'Mise à jour' : 'Maintenance'}
            </p>

            <h1 className="status-page__title">
              {isChunkError ? 'Mise à jour du site' : 'Une erreur est survenue'}
            </h1>

            <p className="status-page__desc">
              {isChunkError
                ? "Une nouvelle version du site vient d'être publiée. Rechargez la page pour continuer."
                : 'Nous nous excusons pour ce désagrément. Veuillez réessayer ultérieurement.'}
            </p>

            <div className="status-page__actions">
              <button
                type="button"
                className="status-page__btn status-page__btn--primary"
                onClick={this.handleRetry}
              >
                {isChunkError ? 'Recharger la page' : 'Réessayer'}
              </button>
              <a href="/" className="status-page__btn status-page__btn--secondary">
                Retour à l'accueil
              </a>
            </div>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
