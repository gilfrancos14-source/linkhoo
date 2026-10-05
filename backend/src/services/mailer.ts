import type { ContactMessageInput } from '../validations/contact';

// ── Envoi d'email de contact (formulaire « Contactez-nous ») ──
//
// Production : Resend en appel REST (HTTPS/443) — aucune dépendance npm,
// aucune dépendance au port 25 ni à la réputation de l'IP du VPS (LWS),
// SPF/DKIM gérés côté fournisseur une fois le domaine vérifié.
//
// Repli sans tiers : remplacer l'implémentation de `sendContactEmail` par un
// envoi SMTP (nodemailer, port 465 SSL vers le SMTP LWS ou relais Mailjet).
// La signature est volontairement stable : un seul fichier à changer.

const RESEND_API_URL = 'https://api.resend.com/emails';
const SEND_TIMEOUT_MS = 10_000;

const SUJET_LIBELLES: Record<string, string> = {
  reservation: 'Réservation',
  'compte-gerant': 'Compte gérant',
  partenariat: 'Partenariat',
  presse: 'Presse',
  autre: 'Autre demande',
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function row(label: string, value: string): string {
  if (!value) return '';
  return `<tr><td style="padding:6px 12px 6px 0;color:#5b6b7a;white-space:nowrap;">${escapeHtml(label)}</td><td style="padding:6px 0;color:#12263a;">${escapeHtml(value)}</td></tr>`;
}

export interface ContactEmail {
  subject: string;
  html: string;
  text: string;
}

export function buildContactEmail(input: ContactMessageInput): ContactEmail {
  const nomComplet = [input.nom, input.prenom].filter(Boolean).join(' ');
  const sujetLibelle = SUJET_LIBELLES[input.sujet] ?? SUJET_LIBELLES.autre;
  const subject = `[Contact Linkhoo] ${input.pays} — ${sujetLibelle} — ${nomComplet}`;

  const rows = [
    row('Nom', input.nom),
    row('Prénom', input.prenom),
    row('Email', input.email),
    row('Téléphone', input.telephone),
    row('Pays', input.pays),
    row('Sujet', sujetLibelle),
    row('Marché', input.market ?? ''),
  ].join('');

  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#12263a;">',
    '<h2 style="margin:0 0 12px;font-size:18px;">Nouveau message depuis le formulaire de contact</h2>',
    `<table style="border-collapse:collapse;">${rows}</table>`,
    '<p style="margin:16px 0 6px;color:#5b6b7a;">Message :</p>',
    `<div style="padding:12px;background:#f4f7fa;border-radius:6px;white-space:pre-wrap;">${escapeHtml(input.message)}</div>`,
    '</div>',
  ].join('\n');

  const text = [
    'Nouveau message depuis le formulaire de contact',
    `Nom : ${input.nom}`,
    `Prénom : ${input.prenom}`,
    `Email : ${input.email}`,
    `Téléphone : ${input.telephone}`,
    `Pays : ${input.pays}`,
    `Sujet : ${sujetLibelle}`,
    `Marché : ${input.market ?? ''}`,
    '',
    'Message :',
    input.message,
  ].join('\n');

  return { subject, html, text };
}

/**
 * Envoie le message à l'administrateur. Rejette si la clé API manque, si le
 * fournisseur répond hors 2xx ou si le délai est dépassé — l'appelant décide
 * du statut HTTP (502) et conserve la saisie côté client.
 */
export async function sendContactEmail(input: ContactMessageInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM ?? 'Linkhoo <no-reply@linkhoo.com>';
  const to = process.env.CONTACT_ADMIN_EMAIL ?? 'contact@linkhoo.com';

  if (!apiKey) {
    throw new Error('RESEND_API_KEY manquant : envoi de mail de contact impossible.');
  }

  const { subject, html, text } = buildContactEmail(input);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS);

  try {
    const res = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: input.email,
        subject,
        html,
        text,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new Error(`Resend a répondu ${res.status}${detail ? ` : ${detail.slice(0, 200)}` : ''}`);
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Délai dépassé lors de l\u2019envoi du message.');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}
