import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildClientNotificationEmail,
  buildContactEmail,
  buildReceiptEmail,
  escapeHtml,
  sendContactEmail,
} from './mailer';
import type { ContactMessageInput } from '../validations/contact';

const input: ContactMessageInput = {
  nom: 'Diop',
  prenom: 'Awa',
  email: 'awa@exemple.ci',
  telephone: '+221 77 123 45 67',
  pays: 'Sénégal',
  sujet: 'reservation',
  message: 'Bonjour, <script>alert(1)</script> je veux réserver.',
  market: 'CI',
  website: '',
};

describe('escapeHtml', () => {
  it('neutralise les caractères HTML', () => {
    expect(escapeHtml('<b>"x" & \'y\'</b>')).toBe(
      '&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;',
    );
  });
});

describe('buildContactEmail', () => {
  it('construit un objet identifiant le pays, le sujet et l\u2019expéditeur', () => {
    const email = buildContactEmail(input);

    expect(email.subject).toBe('[Contact Linkhoo] Sénégal — Réservation — Diop Awa');
    expect(email.html).toContain('awa@exemple.ci');
    expect(email.text).toContain('Pays : Sénégal');
  });

  it('échappe le contenu utilisateur dans le HTML', () => {
    const email = buildContactEmail(input);

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.text).toContain('<script>'); // le texte brut garde la saisie
  });
});

describe('buildClientNotificationEmail', () => {
  beforeEach(() => {
    process.env.APP_PUBLIC_URL = 'https://linkehoo.com';
  });

  afterEach(() => {
    delete process.env.APP_PUBLIC_URL;
  });

  it('construit le sujet, le corps et le lien d’action', () => {
    const email = buildClientNotificationEmail({
      to: 'client@exemple.ci',
      subject: 'Votre paiement est confirmé',
      title: 'Votre paiement est confirmé',
      message: 'Merci, tout est bon.',
      actionPath: '/ci/suivi-reservation',
      actionLabel: 'Suivre ma réservation',
    });

    expect(email.subject).toBe('[Linkhoo] Votre paiement est confirmé');
    expect(email.html).toContain('https://linkehoo.com/ci/suivi-reservation');
    expect(email.html).toContain('Suivre ma réservation');
    expect(email.text).toContain('Merci, tout est bon.');
  });

  it('échappe le message et refuse une URL d’action externe', () => {
    const email = buildClientNotificationEmail({
      to: 'client@exemple.ci',
      subject: 'Test',
      title: 'Test',
      message: '<script>alert(1)</script>',
      actionPath: 'https://autre-site.fr',
    });

    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
    expect(email.html).not.toContain('autre-site.fr');
  });
});

describe('buildReceiptEmail', () => {
  it('présente le montant, la réservation et le lien du reçu', () => {
    const email = buildReceiptEmail({
      to: 'awa@exemple.ci',
      clientName: 'Awa Koffi',
      amount: '189 000 FCFA',
      reservationId: 'RES-8F3C21AB',
      receiptUrl: 'https://linkehoo.com/api/receipts/jeton.signé.ici',
    });

    expect(email.subject).toBe('[Linkhoo] Votre reçu de paiement Linkhoo');
    expect(email.html).toContain('Télécharger mon reçu');
    expect(email.html).toContain('https://linkehoo.com/api/receipts/jeton.signé.ici');
    expect(email.text).toContain('189 000 FCFA');
    expect(email.text).toContain('RES-8F3C21AB');
  });

  it('ignore une URL de reçu non HTTPS', () => {
    const email = buildReceiptEmail({
      to: 'awa@exemple.ci',
      clientName: 'Awa',
      amount: '1 FCFA',
      reservationId: 'RES-1',
      receiptUrl: 'javascript:alert(1)',
    });

    expect(email.html).not.toContain('Télécharger mon reçu');
    expect(email.html).not.toContain('javascript:');
  });
});

describe('sendContactEmail', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.MAIL_FROM = 'Linkhoo <no-reply@linkhoo.com>';
    process.env.CONTACT_ADMIN_EMAIL = 'admin@linkhoo.com';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.RESEND_API_KEY;
    delete process.env.MAIL_FROM;
    delete process.env.CONTACT_ADMIN_EMAIL;
  });

  it('rejette sans clé API (configuration de production manquante)', async () => {
    delete process.env.RESEND_API_KEY;

    await expect(sendContactEmail(input)).rejects.toThrow('RESEND_API_KEY manquant');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('appelle Resend avec le destinataire admin et le Reply-To du visiteur', async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await sendContactEmail(input);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer re_test_key' }),
      }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as {
      from: string;
      to: string[];
      reply_to: string;
      subject: string;
    };
    expect(body.from).toBe('Linkhoo <no-reply@linkhoo.com>');
    expect(body.to).toEqual(['admin@linkhoo.com']);
    expect(body.reply_to).toBe('awa@exemple.ci');
    expect(body.subject).toContain('Sénégal');
  });

  it('rejette quand le fournisseur répond hors 2xx', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('Unauthorized') });

    await expect(sendContactEmail(input)).rejects.toThrow('Resend a répondu 401');
  });
});
