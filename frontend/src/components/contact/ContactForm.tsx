import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Icon from '../landing/icons';
import { MARKETS } from '../../config/markets';
import { apiContact, type ContactPayload } from '../../lib/api';
import { CONTACT_SUBJECT_KEYS, type ContactSubjectKey } from './data';

interface FormValues {
  nom: string;
  email: string;
  objet: string;
  tel: string;
  message: string;
}

type RequiredField = 'nom' | 'email' | 'objet' | 'message';
type FieldErrors = Partial<Record<RequiredField, boolean>>;
type Status = 'idle' | 'sending' | 'error' | 'sent' | 'apiError';

const EMPTY_FORM: FormValues = {
  nom: '',
  email: '',
  objet: '',
  tel: '',
  message: '',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Clé stable de la maquette → valeur acceptée par l'API (indépendant de la langue). */
const SUBJECT_TO_API: Record<ContactSubjectKey, ContactPayload['sujet']> = {
  general: 'autre',
  publish: 'compte-gerant',
  technical: 'autre',
  payment: 'reservation',
  suggestion: 'autre',
};

export default function ContactForm() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<Status>('idle');
  const timer = useRef<number | null>(null);

  // La page /contact est à la racine : on retombe sur le marché par défaut.
  const slug = pathname.split('/')[1];
  const market = MARKETS.find((item) => item.slug === slug) ?? MARKETS[0];

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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (status === 'sending') return;

    const nextErrors: FieldErrors = {
      nom: values.nom.trim() === '',
      email: !EMAIL_RE.test(values.email.trim()),
      objet: values.objet === '',
      message: values.message.trim().length < 10,
    };

    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      setStatus('error');
      resetStatusLater(2200);
      return;
    }

    setErrors({});
    setStatus('sending');
    try {
      await apiContact.send({
        nom: values.nom.trim(),
        email: values.email.trim(),
        telephone: values.tel.trim(),
        pays: market.pays,
        sujet: SUBJECT_TO_API[values.objet as ContactSubjectKey] ?? 'autre',
        message: values.message.trim(),
        market: market.code,
        // Pot de miel : plus tard rempli par les robots, jamais par un humain.
        website: '',
      });
      setValues(EMPTY_FORM);
      setStatus('sent');
      resetStatusLater(2500);
    } catch {
      setStatus('apiError');
      resetStatusLater(4000);
    }
  };

  const inputClass = (invalid: boolean) => `ct-input${invalid ? ' ct-input--error' : ''}`;

  return (
    <div className="ct-card ct-form-card">
      <div className="ct-card__head">
        <span className="ct-card__head-icon">
          <Icon name="house" size={14} />
        </span>
        <div>
          <h2 className="ct-card__title">{t('contact.form.title')}</h2>
          <p className="ct-card__subtitle">{t('contact.form.subtitle')}</p>
        </div>
      </div>

      <form id="contactForm" className="ct-form" noValidate onSubmit={handleSubmit}>
        <div className="ct-form__grid">
          <div>
            <label className="ct-label" htmlFor="ct-nom">
              {t('contact.form.fullName')} <span aria-hidden="true">*</span>
            </label>
            <input
              id="ct-nom"
              className={inputClass(Boolean(errors.nom))}
              type="text"
              required
              placeholder={t('contact.form.namePlaceholder')}
              value={values.nom}
              onChange={update('nom')}
            />
          </div>

          <div>
            <label className="ct-label" htmlFor="ct-email">
              {t('contact.form.email')} <span aria-hidden="true">*</span>
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
              {t('contact.form.subject')} <span aria-hidden="true">*</span>
            </label>
            <div className="ct-select">
              <select
                id="ct-objet"
                className={`${inputClass(Boolean(errors.objet))} ct-select__field`}
                required
                value={values.objet}
                onChange={update('objet')}
              >
                <option value="">{t('contact.form.subjectPlaceholder')}</option>
                {CONTACT_SUBJECT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {t(`contact.form.subjects.${key}`)}
                  </option>
                ))}
              </select>
              <Icon name="chevronDown" size={12} />
            </div>
          </div>

          <div>
            <label className="ct-label" htmlFor="ct-tel">
              {t('contact.form.phone')} <span className="ct-label__optional">{t('contact.form.optional')}</span>
            </label>
            <input
              id="ct-tel"
              className="ct-input"
              type="tel"
              placeholder={t('contact.form.phonePlaceholder')}
              value={values.tel}
              onChange={update('tel')}
            />
          </div>
        </div>

        <div className="ct-form__message">
          <label className="ct-label" htmlFor="ct-message">
            {t('contact.form.message')} <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="ct-message"
            className={inputClass(Boolean(errors.message))}
            required
            placeholder={t('contact.form.messagePlaceholder')}
            value={values.message}
            onChange={update('message')}
          />
        </div>

        <button type="submit" className="ct-submit" disabled={status === 'sending'}>
          <Icon name="send" size={13} />
          <span aria-live="polite">{t(`contact.form.labels.${status}`)}</span>
        </button>
      </form>
    </div>
  );
}
