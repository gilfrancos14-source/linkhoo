import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { apiTranslations } from '../lib/api';
import '../styles/translation-report.css';

interface TranslationReportProps {
  entityId: string;
  entityType?: string;
  field?: string;
  currentValue: string;
}

/**
 * Petit bouton discret sur les contenus traduits : le visiteur peut proposer
 * une correction, enregistrée comme définitive (statut `corrige`) et donc
 * jamais régénérée par le worker.
 */
export default function TranslationReport({
  entityId,
  entityType = 'room',
  field = 'title',
  currentValue,
}: TranslationReportProps) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentValue);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if ((i18n.language || 'fr').split('-')[0] === 'fr') return null;

  if (!open) {
    return (
      <button
        type="button"
        className="translation-report__toggle"
        onClick={() => setOpen(true)}
      >
        {t('translationReport.button')}
      </button>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!value.trim()) return;
    setBusy(true);
    try {
      await apiTranslations.report({
        entityType,
        entityId,
        locale: i18n.language.split('-')[0],
        field,
        value: value.trim(),
      });
      setDone(true);
      setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="translation-report" onSubmit={submit}>
      <input
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={t('translationReport.placeholder')}
        aria-label={t('translationReport.placeholder')}
      />
      <button type="submit" disabled={busy || done}>
        {done ? t('translationReport.thanks') : t('translationReport.send')}
      </button>
    </form>
  );
}
