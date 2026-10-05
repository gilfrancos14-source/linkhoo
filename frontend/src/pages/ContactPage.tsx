import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMarket } from '../contexts/MarketContext';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { apiContact, type ContactPayload } from '../lib/api';
import { isValidEmail } from '../utils/validators';

// Liste de pays de la page contact de référence (CoinAfrique) — « Cameroun »
// corrigé. Doit rester alignée sur PAYS_CONTACT côté backend (enum + CHECK).
const PAYS = [
  'Bénin',
  'Burkina Faso',
  'Cameroun',
  'Congo',
  "Côte d'Ivoire",
  'Gabon',
  'Guinée',
  'Mali',
  'Niger',
  'RDC',
  'Sénégal',
  'Togo',
] as const;

const SUJETS: { value: ContactPayload['sujet']; label: string }[] = [
  { value: 'reservation', label: 'Réservation' },
  { value: 'compte-gerant', label: 'Compte gérant' },
  { value: 'partenariat', label: 'Partenariat' },
  { value: 'presse', label: 'Presse' },
  { value: 'autre', label: 'Autre demande' },
];

const PHONE_RE = /^\+?[0-9 .()-]{6,20}$/;

interface FormState {
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  pays: string;
  sujet: string;
  message: string;
  website: string;
}

type FieldKey = keyof FormState;
type FieldErrors = Partial<Record<FieldKey, string>>;

const EMPTY_FORM: FormState = {
  nom: '',
  prenom: '',
  email: '',
  telephone: '',
  pays: '',
  sujet: '',
  message: '',
  website: '',
};

function validate(form: FormState): FieldErrors {
  const errors: FieldErrors = {};

  if (!form.nom.trim()) errors.nom = 'Veuillez indiquer votre nom.';
  if (!isValidEmail(form.email.trim())) errors.email = 'Adresse email invalide.';
  if (form.telephone.trim() && !PHONE_RE.test(form.telephone.trim())) {
    errors.telephone = 'Numéro de téléphone invalide.';
  }
  if (!form.pays) errors.pays = 'Veuillez choisir un pays.';
  if (!form.sujet) errors.sujet = 'Veuillez choisir un sujet.';
  if (form.message.trim().length < 10) {
    errors.message = 'Le message doit contenir au moins 10 caractères.';
  } else if (form.message.trim().length > 2000) {
    errors.message = 'Le message ne peut pas dépasser 2000 caractères.';
  }

  return errors;
}

function aria(id: string, error?: string) {
  return {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': error ? `${id}-error` : undefined,
  };
}

export default function ContactPage() {
  const { market } = useMarket();
  const online = useOnlineStatus();

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const setField = (key: FieldKey, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    setSubmitError('');
    setSuccess('');

    const found = validate(form);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;

    if (!online) {
      setSubmitError('Connexion internet requise pour envoyer votre message. Réessayez une fois en ligne.');
      return;
    }

    setSubmitting(true);
    try {
      const payload: ContactPayload = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        email: form.email.trim(),
        telephone: form.telephone.trim(),
        pays: form.pays,
        sujet: form.sujet as ContactPayload['sujet'],
        message: form.message.trim(),
        market,
        website: form.website,
      };
      const res = await apiContact.send(payload);
      setSuccess(res.message || 'Votre message a bien été envoyé.');
      setForm(EMPTY_FORM);
      setErrors({});
    } catch (err) {
      // Les valeurs saisies sont conservées : l'utilisateur peut réessayer.
      setSubmitError(
        err instanceof Error && err.message
          ? err.message
          : "L'envoi a échoué. Veuillez réessayer.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-contact">
      <div className="container">
        <Link to="/" className="page-legal__back">&larr; Retour à l&apos;accueil</Link>

        <div className="contact__grid">
          <section className="contact__intro">
            <h1 className="contact__title">Contactez-nous</h1>
            <p className="contact__lead">
              Une question sur une réservation, votre compte gérant, un partenariat ou la
              presse ? Écrivez-nous : l&apos;équipe Linkhoo vous répond sous 24 à 48 heures
              ouvrées.
            </p>
          </section>

          <section className="contact__panel" aria-labelledby="contact-form-title">
            <h2 className="contact__panel-title" id="contact-form-title">
              Envoyez un message
            </h2>

            {success ? (
              <div className="contact__success" role="status">
                <p className="contact__success-msg">{success}</p>
                <p className="contact__success-note">
                  Nous vous répondrons à l&apos;adresse email indiquée.
                </p>
                <button
                  type="button"
                  className="contact__submit contact__submit--ghost"
                  onClick={() => setSuccess('')}
                >
                  Envoyer un autre message
                </button>
              </div>
            ) : (
              <form className="contact__form" onSubmit={handleSubmit} noValidate>
                <div className={`contact__field${errors.nom ? ' contact__field--error' : ''}`}>
                  <label className="contact__label" htmlFor="contact-nom">Nom *</label>
                  <input
                    className="contact__input"
                    id="contact-nom"
                    name="nom"
                    type="text"
                    autoComplete="family-name"
                    value={form.nom}
                    onChange={(e) => setField('nom', e.target.value)}
                    disabled={submitting}
                    required
                    {...aria('contact-nom', errors.nom)}
                  />
                  {errors.nom && <span className="field-error" id="contact-nom-error">{errors.nom}</span>}
                </div>

                <div className="contact__field">
                  <label className="contact__label" htmlFor="contact-prenom">Prénom</label>
                  <input
                    className="contact__input"
                    id="contact-prenom"
                    name="prenom"
                    type="text"
                    autoComplete="given-name"
                    value={form.prenom}
                    onChange={(e) => setField('prenom', e.target.value)}
                    disabled={submitting}
                  />
                </div>

                <div className={`contact__field${errors.email ? ' contact__field--error' : ''}`}>
                  <label className="contact__label" htmlFor="contact-email">Email *</label>
                  <input
                    className="contact__input"
                    id="contact-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="vous@exemple.com"
                    value={form.email}
                    onChange={(e) => setField('email', e.target.value)}
                    disabled={submitting}
                    required
                    {...aria('contact-email', errors.email)}
                  />
                  {errors.email && <span className="field-error" id="contact-email-error">{errors.email}</span>}
                </div>

                <div className={`contact__field${errors.telephone ? ' contact__field--error' : ''}`}>
                  <label className="contact__label" htmlFor="contact-telephone">Téléphone</label>
                  <input
                    className="contact__input"
                    id="contact-telephone"
                    name="telephone"
                    type="tel"
                    autoComplete="tel"
                    placeholder="+225 07 00 00 00 00"
                    value={form.telephone}
                    onChange={(e) => setField('telephone', e.target.value)}
                    disabled={submitting}
                    {...aria('contact-telephone', errors.telephone)}
                  />
                  {errors.telephone && (
                    <span className="field-error" id="contact-telephone-error">{errors.telephone}</span>
                  )}
                </div>

                <div className={`contact__field${errors.sujet ? ' contact__field--error' : ''}`}>
                  <label className="contact__label" htmlFor="contact-sujet">Sujet *</label>
                  <select
                    className="contact__select"
                    id="contact-sujet"
                    name="sujet"
                    value={form.sujet}
                    onChange={(e) => setField('sujet', e.target.value)}
                    disabled={submitting}
                    required
                    {...aria('contact-sujet', errors.sujet)}
                  >
                    <option value="">Choisir un sujet</option>
                    {SUJETS.map((sujet) => (
                      <option key={sujet.value} value={sujet.value}>
                        {sujet.label}
                      </option>
                    ))}
                  </select>
                  {errors.sujet && <span className="field-error" id="contact-sujet-error">{errors.sujet}</span>}
                </div>

                <div className={`contact__field${errors.pays ? ' contact__field--error' : ''}`}>
                  <label className="contact__label" htmlFor="contact-pays">Pays *</label>
                  <select
                    className="contact__select"
                    id="contact-pays"
                    name="pays"
                    value={form.pays}
                    onChange={(e) => setField('pays', e.target.value)}
                    disabled={submitting}
                    required
                    {...aria('contact-pays', errors.pays)}
                  >
                    <option value="">Pays</option>
                    {PAYS.map((pays) => (
                      <option key={pays} value={pays}>
                        {pays}
                      </option>
                    ))}
                  </select>
                  {errors.pays && <span className="field-error" id="contact-pays-error">{errors.pays}</span>}
                </div>

                <div className={`contact__field contact__field--full${errors.message ? ' contact__field--error' : ''}`}>
                  <label className="contact__label" htmlFor="contact-message">Votre message *</label>
                  <textarea
                    className="contact__textarea"
                    id="contact-message"
                    name="message"
                    rows={6}
                    placeholder="Comment pouvons-nous vous aider ?"
                    value={form.message}
                    onChange={(e) => setField('message', e.target.value)}
                    disabled={submitting}
                    required
                    {...aria('contact-message', errors.message)}
                  />
                  {errors.message && (
                    <span className="field-error" id="contact-message-error">{errors.message}</span>
                  )}
                </div>

                {/* Pot de miel : invisible, jamais focusable, rempli par les robots. */}
                <div className="contact__hp" aria-hidden="true">
                  <label htmlFor="contact-website">Ne pas remplir ce champ</label>
                  <input
                    id="contact-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.website}
                    onChange={(e) => setField('website', e.target.value)}
                  />
                </div>

                {submitError && (
                  <p className="contact__error" role="alert">
                    {submitError}
                  </p>
                )}

                <button type="submit" className="contact__submit" disabled={submitting}>
                  {submitting ? 'Envoi en cours…' : 'Envoyer'}
                </button>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
