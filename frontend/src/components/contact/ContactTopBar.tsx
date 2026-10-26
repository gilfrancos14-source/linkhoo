import { useState } from 'react';
import Icon from '../landing/icons';

export default function ContactTopBar() {
  const [visible, setVisible] = useState(true);

  if (!visible) return null;

  return (
    <div className="ct-announce">
      <div className="ct-announce__inner">
        <p className="ct-announce__msg">
          <Icon name="megaphone" size={12} />
          <span>Louez en toute confiance, partout en Afrique de l&apos;Ouest !</span>
        </p>
        <div className="ct-announce__actions">
          <span className="ct-announce__badge">
            <Icon name="globe" size={12} />
            12 pays disponibles
          </span>
          <button
            type="button"
            className="ct-announce__close"
            aria-label="Fermer"
            onClick={() => setVisible(false)}
          >
            <Icon name="x" size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
