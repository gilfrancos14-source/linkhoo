import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="error-page">
          <div className="container">
            <h1>Une erreur est survenue</h1>
            <p>Nous nous excusons pour ce désagrément. Veuillez réessayer ultérieurement.</p>
            <button type="button" className="error-page__link" onClick={() => this.setState({ hasError: false })}>
              Réessayer
            </button>
            <a href="/" className="error-page__link">Retour à l'accueil</a>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
