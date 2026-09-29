/**
 * Déclaration globale unique des propriétés métier attachées à `Request`.
 *
 * Ce fichier est un module (il exporte), le `declare global` ci-dessous étend donc
 * `Express.Request` pour l'ensemble du programme compilé (tsconfig.json et
 * tsconfig.test.json incluent tous les fichiers de `src`). Aucune autre
 * déclaration globale ne doit être ajoutée ailleurs (sinon risque de conflit
 * TS2717).
 */

export interface RequestAuthInfo {
  userId: string;
  sessionId?: string;
  sessionClaims?: unknown;
}

export interface RequestAdminInfo {
  adminId: string;
  email: string;
}

export interface RawBodyRequest {
  rawBody?: string;
}

declare global {
  namespace Express {
    interface Request {
      auth?: RequestAuthInfo;
      admin?: RequestAdminInfo;
      rawBody?: string;
    }
  }
}
