import { useState } from 'react';
import Icon from './icons';

export default function LandingTopBar() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="acc-offline">
      <div className="acc-container acc-offline__inner">
        <p className="acc-offline__msg">
          <Icon name="wifiOff" size={16} />
          <span>Vous êtes actuellement hors ligne. Certaines fonctionnalités peuvent être limitées.</span>
        </p>
        <div className="acc-offline__actions">
          <button
            type="button"
            className="acc-offline__retry"
            onClick={() => window.location.reload()}
          >
            <Icon name="rotateCw" size={14} />
            Réessayer
          </button>
          <button
            type="button"
            className="acc-offline__close"
            aria-label="Fermer"
            onClick={() => setVisible(false)}
          >
            <Icon name="x" size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
