import { Link } from 'react-router-dom';
import { useHomePath } from '../hooks/useHomePath';

export default function AProposPage() {
  const homePath = useHomePath();

  return (
    <div className="page-legal">
      <div className="container">
        <Link to="/" className="page-legal__back">&larr; Retour à l'accueil</Link>
        <h1 className="page-legal__title">À propos de Linkhoo</h1>
        <p className="page-legal__update">Dernière mise à jour : 9 septembre 2026</p>

        <section className="page-legal__section">
          <h2>1. Qui sommes-nous ?</h2>
          <p>
            <strong>Linkhoo</strong> est une plateforme de location de biens immobiliers et de
            réservation d'expériences pensée pour l'Afrique de l'Ouest. Appartements, maisons,
            séjours événementiels et activités touristiques : tout se réserve en ligne, en quelques
            clics, sans intermédiaire.
          </p>
          <p>
            Notre siège est basé à Abidjan et notre équipe réunit des profils de la tech, de
            l'hôtellerie et du commerce, autour d'une même conviction : le marché locatif
            francophone mérite des outils simples, rapides et fiables.
          </p>
        </section>

        <section className="page-legal__section">
          <h2>2. Notre mission</h2>
          <p>
            Connecter directement locataires, voyageurs et gérants de biens : plus de frais
            obscurs, plus d'allers-retours interminables. Linkhoo affiche des prix clairs, des
            photos réelles et des disponibilités à jour pour que chaque réservation se fasse en
            toute confiance.
          </p>
        </section>

        <section className="page-legal__section">
          <h2>3. Comment ça marche ?</h2>
          <ul>
            <li><strong>Locataires et voyageurs :</strong> cherchez un bien ou une expérience, choisissez vos dates, envoyez une demande de réservation et suivez-la depuis votre compte.</li>
            <li><strong>Gérants :</strong> publiez vos biens, gérez vos réservations et votre disponibilité depuis un tableau de bord dédié.</li>
            <li><strong>Validation :</strong> chaque demande est confirmée par le gérant, qui peut refuser ou proposer d'autres dates.</li>
          </ul>
        </section>

        <section className="page-legal__section">
          <h2>4. Nos marchés</h2>
          <p>
            Linkhoo est déployé marché par marché, avec un catalogue, des villes et des prix
            adaptés à chaque pays :
          </p>
          <ul>
            <li><Link to="/ci">Côte d'Ivoire</Link> — Abidjan, Grand-Bassam, Assinie et toute la côte.</li>
            <li><Link to="/bj">Bénin</Link> — Cotonou, Porto-Novo, Ouidah et l'arrière-pays.</li>
          </ul>
          <p>
            Choisissez votre marché depuis le sélecteur de drapeau en haut de page pour voir les
            biens disponibles.
          </p>
        </section>

        <section className="page-legal__section">
          <h2>5. Nos engagements</h2>
          <ul>
            <li>Des annonces vérifiées et des photos fidèles aux biens.</li>
            <li>Des prix affichés en toutes lettres, sans frais cachés.</li>
            <li>La protection de vos données personnelles, conformément à notre <Link to={`${homePath}/politique-de-confidentialite`}>Politique de confidentialité</Link>.</li>
            <li>Un service client joignable à toute heure via le formulaire de contact.</li>
          </ul>
        </section>

        <section className="page-legal__section">
          <h2>6. Contact</h2>
          <p>
            Une question, une suggestion ou un partenariat ? Écrivez-nous à{' '}
            <strong>bonjour@linkhoo.com</strong> ou passez par notre{' '}
            <Link to="/contact">formulaire de contact</Link>.
          </p>
          <p>
            Retournez à l&apos;<Link to="/">accueil</Link> pour parcourir les biens, ou consultez
            nos <Link to={`${homePath}/mentions-legales`}>mentions légales</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
