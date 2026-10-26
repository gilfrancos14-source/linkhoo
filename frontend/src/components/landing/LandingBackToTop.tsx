import Icon from './icons';

export default function LandingBackToTop() {
  return (
    <button
      type="button"
      className="acc-to-top"
      aria-label="Haut de page"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <Icon name="arrowUp" size={20} />
    </button>
  );
}
