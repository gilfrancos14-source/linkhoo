import { Link } from 'react-router-dom';
import { useHomePath } from '../hooks/useHomePath';

export default function PolitiqueConfidentialite() {
  const homePath = useHomePath();

  return (
    <div className="page-legal">
      <div className="container">
        <Link to={homePath} className="page-legal__back">&larr; Retour à l'accueil</Link>
        <h1 className="page-legal__title">Politique de confidentialité</h1>
        <p className="page-legal__update">Dernière mise à jour : 9 septembre 2026</p>

        <section className="page-legal__section">
          <h2>1. Responsable du traitement</h2>
          <p>
            Le responsable du traitement des données personnelles est :
          </p>
          <ul>
            <li><strong>Société :</strong> Ilehya SAS</li>
            <li><strong>Adresse :</strong> 12 Avenue des Artisans, 75010 Paris</li>
            <li><strong>Email :</strong> bonjour@ilehya.com</li>
            <li><strong>Téléphone :</strong> +33 1 23 45 67 89</li>
          </ul>
        </section>

        <section className="page-legal__section">
          <h2>2. Données collectées</h2>
          <p>Dans le cadre de nos services, nous collectons les données suivantes :</p>
          <ul>
            <li><strong>Données d'identification :</strong> nom, prénom, adresse email, numéro de téléphone</li>
            <li><strong>Données de navigation :</strong> adresse IP, pages visitées, durée de consultation</li>
            <li><strong>Données de transaction :</strong> historique de réservation, moyens de paiement (chiffrés)</li>
          </ul>
        </section>

        <section className="page-legal__section">
          <h2>3. Finalités du traitement</h2>
          <p>Vos données sont collectées pour les finalités suivantes :</p>
          <ul>
            <li>Gestion des réservations et des baux locatifs</li>
            <li>Communication relative à vos demandes</li>
            <li>Envoi de newsletters (avec votre consentement)</li>
            <li>Amélioration de nos services et de l'expérience utilisateur</li>
            <li>Respect de nos obligations légales</li>
          </ul>
        </section>

        <section className="page-legal__section">
          <h2>4. Base légale du traitement</h2>
          <p>Le traitement de vos données repose sur :</p>
          <ul>
            <li><strong>L'exécution d'un contrat :</strong> gestion de votre réservation ou bail</li>
            <li><strong>Votre consentement :</strong> inscription à la newsletter</li>
            <li><strong>Un intérêt légitime :</strong> amélioration de nos services, prévention de la fraude</li>
            <li><strong>Une obligation légale :</strong> conservation des factures, réponses aux réquisitions judiciaires</li>
          </ul>
        </section>

        <section className="page-legal__section">
          <h2>5. Durée de conservation</h2>
          <ul>
            <li><strong>Données de compte :</strong> pendant la durée de la relation commerciale + 3 ans</li>
            <li><strong>Données de transaction :</strong> 5 ans (obligation comptable)</li>
            <li><strong>Données de navigation :</strong> 13 mois maximum</li>
            <li><strong>Données de newsletter :</strong> jusqu'à désinscription</li>
          </ul>
        </section>

        <section className="page-legal__section">
          <h2>6. Destinataires des données</h2>
          <p>Vos données peuvent être transmises à :</p>
          <ul>
            <li>Nos partenaires techniques (hébergement, maintenance du site)</li>
            <li>Nos prestataires de paiement (chiffrement TLS/SSL)</li>
            <li>Les autorités compétentes en cas de réquisition judiciaire</li>
          </ul>
          <p>Nous ne vendons jamais vos données à des tiers.</p>
        </section>

        <section className="page-legal__section">
          <h2>7. Vos droits</h2>
          <p>Conformément au RGPD et à la loi Informatique et Libertés, vous disposez des droits suivants :</p>
          <ul>
            <li><strong>Droit d'accès :</strong> obtenir une copie de vos données</li>
            <li><strong>Droit de rectification :</strong> corriger des données inexactes</li>
            <li><strong>Droit à l'effacement :</strong> demander la suppression de vos données</li>
            <li><strong>Droit à la portabilité :</strong> recevoir vos données dans un format structuré</li>
            <li><strong>Droit d'opposition :</strong> vous opposer au traitement pour motif légitime</li>
            <li><strong>Droit de limitation :</strong> demander la suspension du traitement</li>
          </ul>
          <p>
            Pour exercer ces droits, contactez-nous à : <strong>bonjour@ilehya.com</strong>
          </p>
        </section>

        <section className="page-legal__section">
          <h2>8. Sécurité</h2>
          <p>
            Ilehya met en œuvre les mesures techniques et organisationnelles appropriées pour protéger vos données
            contre la perte, l'utilisation abusive, l'accès non autorisé, la divulgation, l'altération et la
            destruction.
          </p>
          <ul>
            <li>Chiffrement TLS/SSL pour les données en transit</li>
            <li>Authentification sécurisée</li>
            <li>Accès restreint aux données personnelles</li>
            <li>Sauvegardes régulières</li>
          </ul>
        </section>

        <section className="page-legal__section">
          <h2>9. Cookies</h2>
          <p>
            Notre site utilise uniquement des cookies techniques nécessaires à son fonctionnement (session,
            préférences). Aucun cookie publicitaire ou de tracking n'est utilisé.
          </p>
          <p>
            Vous pouvez gérer les cookies via les paramètres de votre navigateur.
          </p>
        </section>

        <section className="page-legal__section">
          <h2>10. Réclamation</h2>
          <p>
            Si vous estimez que le traitement de vos données n'est pas conforme à la réglementation, vous avez
            le droit d'introduire une réclamation auprès de la CNIL :
          </p>
          <ul>
            <li><strong>Site :</strong> www.cnil.fr</li>
            <li><strong>Adresse :</strong> 3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07</li>
          </ul>
        </section>

        <section className="page-legal__section">
          <h2>11. Modifications</h2>
          <p>
            Cette politique de confidentialité peut être modifiée à tout moment. La date de dernière mise à jour
            est indiquée en haut de cette page. Nous vous invitons à la consulter régulièrement.
          </p>
        </section>
      </div>
    </div>
  );
}
