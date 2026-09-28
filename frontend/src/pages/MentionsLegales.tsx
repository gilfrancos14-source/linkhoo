import { Link } from 'react-router-dom';
import { useHomePath } from '../hooks/useHomePath';

export default function MentionsLegales() {
  const homePath = useHomePath();

  return (
    <div className="page-legal">
      <div className="container">
        <Link to={homePath} className="page-legal__back">&larr; Retour à l'accueil</Link>
        <h1 className="page-legal__title">Mentions légales</h1>
        <p className="page-legal__update">Dernière mise à jour : 9 septembre 2026</p>

        <section className="page-legal__section">
          <h2>1. Éditeur du site</h2>
          <p>
            Le site <strong>linkhoo.com</strong> est édité par la société <strong>Linkhoo</strong>, SAS au capital de 10 000 €,
            immatriculée au RCS de Paris sous le numéro 123 456 789, dont le siège social est situé au
            12 Avenue des Artisans, 75010 Paris.
          </p>
          <ul>
            <li><strong>Directeur de la publication :</strong> M. Alassan H.</li>
            <li><strong>Email :</strong> bonjour@linkhoo.com</li>
            <li><strong>Téléphone :</strong> +33 1 23 45 67 89</li>
          </ul>
        </section>

        <section className="page-legal__section">
          <h2>2. Hébergeur</h2>
          <p>
            Ce site est hébergé par <strong>Vercel Inc.</strong>, 340 S Lemon Ave #4133, Walnut, CA 91789, États-Unis.
          </p>
        </section>

        <section className="page-legal__section">
          <h2>3. Propriété intellectuelle</h2>
          <p>
            L'ensemble du contenu de ce site (textes, images, vidéos, logos, icônes, sons, logiciels) est la propriété
            exclusive d'Linkhoo ou de ses partenaires et est protégé par les lois françaises et internationales relatives
            à la propriété intellectuelle.
          </p>
          <p>
            Toute reproduction, représentation, modification, publication, transmission ou dénaturation du site ou de
            son contenu, par quelque procédé que ce soit, est interdite sans autorisation préalable écrite d'Linkhoo.
          </p>
        </section>

        <section className="page-legal__section">
          <h2>4. Données personnelles</h2>
          <p>
            Conformément au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et
            Libertés, vous disposez de droits sur vos données personnelles.
          </p>
          <p>
            Pour exercer vos droits ou pour toute question relative à la protection de vos données, vous pouvez
            nous contacter à l'adresse : <strong>bonjour@linkhoo.com</strong>.
          </p>
          <p>
            Pour plus d'informations, consultez notre <Link to={`${homePath}/politique-de-confidentialite`}>Politique de confidentialité</Link>.
          </p>
        </section>

        <section className="page-legal__section">
          <h2>5. Cookies</h2>
          <p>
            Ce site utilise des cookies techniques nécessaires à son bon fonctionnement. Aucun cookie de tracking
            ou de publicité n'est déposé sans votre consentement.
          </p>
          <p>
            Vous pouvez configurer votre navigateur pour refuser les cookies, mais cela pourrait affecter
            certaines fonctionnalités du site.
          </p>
        </section>

        <section className="page-legal__section">
          <h2>6. Limitation de responsabilité</h2>
          <p>
            Linkhoo s'efforce de fournir des informations aussi précises que possible sur ce site. Toutefois, il ne
            pourra être tenu responsable des omissions, des inexactitudes et des carences dans la mise à jour.
          </p>
          <p>
            Les biens immobiliers présentés sur ce site sont donnés à titre indicatif. Les photos, surfaces et
            descriptions peuvent être susceptibles de modifications. Seul le contrat de bail fait foi.
          </p>
        </section>

        <section className="page-legal__section">
          <h2>7. Liens hypertextes</h2>
          <p>
            Le site peut contenir des liens hypertextes vers d'autres sites. Linkhoo n'exerce aucun contrôle sur
            le contenu de ces sites tiers et décline toute responsabilité quant à leur contenu.
          </p>
        </section>

        <section className="page-legal__section">
          <h2>8. Droit applicable</h2>
          <p>
            Les présentes mentions légales sont régies par le droit français. En cas de litige, les tribunaux
            compétents de Paris seront seuls compétents.
          </p>
        </section>
      </div>
    </div>
  );
}
