import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidEmail, patchAxiosTimeout, withFedapayTimeout } from './fedapayHttp';

const TIMEOUT_MS = Number(process.env.FEDAPAY_TIMEOUT_MS || 15000);

describe('isValidEmail', () => {
  it('accepte une adresse simple', () => {
    expect(isValidEmail('contact@ilehya.com')).toBe(true);
  });

  it('accepte une adresse avec sous-domaine et plus-tag', () => {
    expect(isValidEmail('prenom.nom+tag@sub.domaine.ci')).toBe(true);
  });

  it('accepte une adresse de 255 caractères (borne haute)', () => {
    const email = `${'a'.repeat(250)}@x.co`;
    expect(email).toHaveLength(255);
    expect(isValidEmail(email)).toBe(true);
  });

  it('refuse une adresse de 256 caractères', () => {
    const email = `${'a'.repeat(251)}@x.co`;
    expect(email).toHaveLength(256);
    expect(isValidEmail(email)).toBe(false);
  });

  it('refuse une adresse sans @', () => {
    expect(isValidEmail('pas-une-adresse')).toBe(false);
  });

  it('refuse une adresse sans domaine de premier niveau', () => {
    expect(isValidEmail('user@localhost')).toBe(false);
  });

  it('refuse une adresse contenant un espace', () => {
    expect(isValidEmail('user @ilehya.com')).toBe(false);
  });

  it('refuse une adresse vide', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('refuse une adresse à double @', () => {
    expect(isValidEmail('user@@ilehya.com')).toBe(false);
  });

  it('refuse les valeurs non chaînes', () => {
    expect(isValidEmail(42)).toBe(false);
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail({})).toBe(false);
    expect(isValidEmail(['user@ilehya.com'])).toBe(false);
  });
});

describe('withFedapayTimeout', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('laisse passer une promesse qui résout avant le timeout', async () => {
    await expect(withFedapayTimeout(Promise.resolve('token-ok'))).resolves.toBe('token-ok');
  });

  it('propage l’erreur d’origine survenue avant le timeout', async () => {
    await expect(withFedapayTimeout(Promise.reject(new Error('réseau indisponible')))).rejects.toThrow(
      'réseau indisponible',
    );
  });

  it('rejette avec le message de timeout au-delà de FEDAPAY_TIMEOUT_MS', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const never = new Promise<never>(() => {});
    const wrapped = withFedapayTimeout(never);
    const assertion = expect(wrapped).rejects.toThrow(`FedaPay: timeout après ${TIMEOUT_MS}ms`);

    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 10);
    await assertion;
  });

  it('n’intervient plus une fois la promesse résolue', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });

    const wrapped = withFedapayTimeout(Promise.resolve('rapide'));
    await expect(wrapped).resolves.toBe('rapide');

    // Aucune rejection ne doit apparaître à l'expiration du timer interne.
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS + 10);
    await expect(wrapped).resolves.toBe('rapide');
  });
});

describe('patchAxiosTimeout', () => {
  afterEach(() => {
    axios.defaults.timeout = 0;
  });

  it('pose le timeout FedaPay sur axios et ne le refait jamais', () => {
    axios.defaults.timeout = 0;
    patchAxiosTimeout();
    expect(axios.defaults.timeout).toBe(TIMEOUT_MS);

    // Second appel : le drapeau interne empêche toute nouvelle écriture.
    axios.defaults.timeout = 1234;
    patchAxiosTimeout();
    expect(axios.defaults.timeout).toBe(1234);
  });

  it('ne réduit jamais un timeout axios déjà plus court', async () => {
    vi.resetModules();
    const freshModule = await import('./fedapayHttp');
    const freshAxios = (await import('axios')).default;

    freshAxios.defaults.timeout = 500;
    freshModule.patchAxiosTimeout();

    expect(freshAxios.defaults.timeout).toBe(500);
  });
});
