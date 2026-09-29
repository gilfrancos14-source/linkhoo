import type { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { errorHandler } from './errorHandler';

interface HandlerResult {
  status: number;
  body: unknown;
  nextCalls: number;
}

/** Exécute errorHandler avec des req/res/next minimaux et capture la réponse. */
function runErrorHandler(err: unknown): HandlerResult {
  let status = 0;
  let body: unknown;

  const res = {
    status: vi.fn((code: number) => {
      status = code;
      return res;
    }),
    json: vi.fn((payload: unknown) => {
      body = payload;
      return res;
    }),
  } as unknown as Response;

  const next = vi.fn();

  errorHandler(err, {} as Request, res, next as unknown as NextFunction);

  return { status, body, nextCalls: next.mock.calls.length };
}

describe('errorHandler', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('consigne l’erreur via console.error', () => {
    runErrorHandler(new Error('boom'));
    expect(consoleErrorSpy).toHaveBeenCalledWith('Erreur serveur:', 'boom');
  });

  it('consigne la valeur brute quand ce n’est pas une Error', () => {
    runErrorHandler({ code: 'EFAIL' });
    expect(consoleErrorSpy).toHaveBeenCalledWith('Erreur serveur:', { code: 'EFAIL' });
  });

  describe('statut issu de `status`', () => {
    it('404 : renvoie le message de l’erreur', () => {
      const err = Object.assign(new Error('Ressource introuvable'), { status: 404 });
      const { status, body } = runErrorHandler(err);
      expect(status).toBe(404);
      expect(body).toEqual({ error: 'Ressource introuvable' });
    });

    it('400 : garde la limite basse des codes métier', () => {
      const err = Object.assign(new Error('Corps invalide'), { status: 400 });
      const { status, body } = runErrorHandler(err);
      expect(status).toBe(400);
      expect(body).toEqual({ error: 'Corps invalide' });
    });

    it('599 : garde la limite haute des codes métier', () => {
      const err = Object.assign(new Error('Peu courant'), { status: 599 });
      const { status } = runErrorHandler(err);
      expect(status).toBe(599);
    });

    it('500 : masque le message derrière l’erreur interne', () => {
      const err = Object.assign(new Error('détail interne'), { status: 500 });
      const { status, body } = runErrorHandler(err);
      expect(status).toBe(500);
      expect(body).toEqual({ error: 'Erreur interne du serveur' });
    });
  });

  describe('statut issu de `statusCode`', () => {
    it('401 : utilise statusCode quand `status` est absent', () => {
      const err = Object.assign(new Error('Session expirée'), { statusCode: 401 });
      const { status, body } = runErrorHandler(err);
      expect(status).toBe(401);
      expect(body).toEqual({ error: 'Session expirée' });
    });

    it('401 : utilise statusCode quand `status` est undefined', () => {
      const err = Object.assign(new Error('Session expirée'), {
        status: undefined,
        statusCode: 401,
      });
      const { status } = runErrorHandler(err);
      expect(status).toBe(401);
    });

    it('préfère `status` (même invalide) à `statusCode`', () => {
      const err = Object.assign(new Error('redirigé'), { status: 300, statusCode: 403 });
      const { status, body } = runErrorHandler(err);
      expect(status).toBe(500);
      expect(body).toEqual({ error: 'Erreur interne du serveur' });
    });
  });

  describe('valeurs de statut invalides → 500', () => {
    it('status hors bornes (300)', () => {
      const err = Object.assign(new Error('redirigé'), { status: 300 });
      const { status, body } = runErrorHandler(err);
      expect(status).toBe(500);
      expect(body).toEqual({ error: 'Erreur interne du serveur' });
    });

    it('status hors bornes (600)', () => {
      const err = Object.assign(new Error('trop grand'), { status: 600 });
      const { status } = runErrorHandler(err);
      expect(status).toBe(500);
    });

    it('status non numérique (chaîne)', () => {
      const err = Object.assign(new Error('statut chaîne'), { status: '404' });
      const { status, body } = runErrorHandler(err);
      expect(status).toBe(500);
      expect(body).toEqual({ error: 'Erreur interne du serveur' });
    });

    it('statut valide mais erreur non Error → « Requête invalide »', () => {
      const { status, body } = runErrorHandler({ status: 400, message: 'privé' });
      expect(status).toBe(400);
      expect(body).toEqual({ error: 'Requête invalide' });
    });

    it('erreur sans statut → 500 interne', () => {
      const { status, body } = runErrorHandler(new Error('sans statut'));
      expect(status).toBe(500);
      expect(body).toEqual({ error: 'Erreur interne du serveur' });
    });

    it('valeur null → 500 interne', () => {
      const { status, body } = runErrorHandler(null);
      expect(status).toBe(500);
      expect(body).toEqual({ error: 'Erreur interne du serveur' });
    });

    it('valeur undefined → 500 interne', () => {
      const { status, body } = runErrorHandler(undefined);
      expect(status).toBe(500);
      expect(body).toEqual({ error: 'Erreur interne du serveur' });
    });

    it('chaîne vide → 500 interne', () => {
      const { status, body } = runErrorHandler('');
      expect(status).toBe(500);
      expect(body).toEqual({ error: 'Erreur interne du serveur' });
    });
  });

  it('n’ invoque jamais next (fin de chaîne)', () => {
    const { nextCalls } = runErrorHandler(new Error('stop'));
    expect(nextCalls).toBe(0);
  });
});
