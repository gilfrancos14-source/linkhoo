import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import Icon from '../landing/icons';
import { CONTACT_SUBJECTS } from './data';

interface FormValues {
  nom: string;
  email: string;
  objet: string;
  tel: string;
  message: string;
}

type RequiredField = 'nom' | 'email' | 'objet' | 'message';
type FieldErrors = Partial<Record<RequiredField, boolean>>;

const EMPTY_FORM: FormValues = {
  nom: '',
  email: '',
  objet: '',
  tel: '',
  message: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const LABELS = {
  idle: 'Envoyer le message',
  error: 'Veuillez remplir les champs obligatoires',
  sent: 'Message envoyé ✓',
} as const;

export default function ContactForm() {
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<keyof typeof LABELS>('idle');
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
    },
    [],
  );

  const resetStatusLater = (delay: number) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setStatus('idle'), delay);
  };

  const update = (field: keyof FormValues) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
    if (field !== 'tel') {
      setErrors((current) => ({ ...current, [field]: false }));
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FieldErrors = {
      nom: values.nom.trim() === '',
      email: !EMAIL_RE.test(values.email.trim()),
      objet: values.objet === '',
      message: values.message.trim() === '',
    };

    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      setStatus('error');
      resetStatusLater(2200);
      return;
    }

    setErrors({});
    setStatus('sent');
    setValues(EMPTY_FORM);
    resetStatusLater(2500);
  };

  const inputClass = (invalid: boolean) => `ct-input${invalid ? ' ct-input--error' : ''}`;

  return (
    <div className="ct-card ct-form-card">
      <div className="ct-card__head">
        <span className="ct-card__head-icon">
          <Icon name="house" size={14} />
        </span>
        <div>
          <h2 className="ct-card__title">Envoyez-nous un message</h2>
          <p className="ct-card__subtitle">
            Remplissez le formulaire ci-dessous et nous vous répondrons rapidement.
          </p>
        </div>
      </div>

      <form id="contactForm" className="ct-form" noValidate onSubmit={handleSubmit}>
        <div className="ct-form__grid">
          <div>
            <label className="ct-label" htmlFor="ct-nom">
              Nom complet <span aria-hidden="true">*</span>
            </label>
            <input
              id="ct-nom"
              className={inputClass(Boolean(errors.nom))}
              type="text"
              required
              placeholder="Votre nom complet"
              value={values.nom}
              onChange={update('nom')}
            />
          </div>

          <div>
            <label className="ct-label" htmlFor="ct-email">
              Email <span aria-hidden="true">*</span>
            </label>
            <input
              id="ct-email"
              className={inputClass(Boolean(errors.email))}
              type="email"
              required
              placeholder="votre@email.com"
              value={values.email}
              onChange={update('email')}
            />
          </div>

          <div>
            <label className="ct-label" htmlFor="ct-objet">
              Objet <span aria-hidden="true">*</span>
            </label>
            <div className="ct-select">
              <select
                id="ct-objet"
                className={`${inputClass(Boolean(errors.objet))} ct-select__field`}
                required
                value={values.objet}
                onChange={update('objet')}
              >
                <option value="">Choisissez un sujet</option>
                {CONTACT_SUBJECTS.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={12} />
            </div>
          </div>

          <div>
            <label className="ct-label" htmlFor="ct-tel">
              Téléphone <span className="ct-label__optional">(optionnel)</span>
            </label>
            <input
              id="ct-tel"
              className="ct-input"
              type="tel"
              placeholder="Votre numéro de téléphone"
              value={values.tel}
              onChange={update('tel')}
            />
          </div>
        </div>

        <div className="ct-form__message">
          <label className="ct-label" htmlFor="ct-message">
            Votre message <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="ct-message"
            className={inputClass(Boolean(errors.message))}
            required
            placeholder="Écrivez votre message ici..."
            value={values.message}
            onChange={update('message')}
          />
        </div>

        <button type="submit" className="ct-submit">
          <Icon name="send" size={13} />
          <span aria-live="polite">{LABELS[status]}</span>
        </button>
      </form>
    </div>
  );
}
