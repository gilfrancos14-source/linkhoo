import { useState } from 'react';
import Icon from '../landing/icons';

export default function AboutTopBar() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="ab-topbar">
      <div className="ab-topbar__inner">
        <p className="ab-topbar__msg">
          <Icon name="megaphone" size={16} />
          <span>Louer en toute confiance, partout en Afrique de l&apos;Ouest !</span>
        </p>
        <div className="ab-topbar__actions">
          <span className="ab-topbar__badge">
            <Icon name="globe" size={14} />
            12 pays disponibles
          </span>
          <button
            type="button"
            className="ab-topbar__close"
            aria-label="Fermer"
            onClick={() => setVisible(false)}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
