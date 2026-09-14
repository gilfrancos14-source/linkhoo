import { Link } from 'react-router-dom';
import { useHomePath } from '../hooks/useHomePath';

export default function NotFoundPage() {
  const homePath = useHomePath();

  return (
    <main className="error-page">
      <div className="container">
        <p className="error-page__code">404</p>
        <h1 className="error-page__title">Page introuvable</h1>
        <p className="error-page__desc">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <Link to={homePath} className="error-page__link">Retour à l'accueil</Link>
      </div>
    </main>
  );
}
