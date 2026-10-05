import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildContactEmail, escapeHtml, sendContactEmail } from './mailer';
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
