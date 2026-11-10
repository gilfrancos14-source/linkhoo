import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken } from '@clerk/backend';

/**
 * Interface pour les extended request objects
 */
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
}

/**
 * Middleware pour authentifier les utilisateurs avec JWT
 */
export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization token required' });
      return;
    }

    const token = authHeader.substring(7);
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      res.status(500).json({ error: 'JWT secret not configured' });
      return;
    }

    jwt.verify(token, jwtSecret, (err, decoded) => {
      if (err) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }

      req.user = decoded as any;
      next();
    });
  } catch (error) {
    console.error('Error in JWT authentication:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware pour authentifier les utilisateurs avec Clerk
 */
export const authenticateClerk = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization token required' });
      return;
    }

    const token = authHeader.substring(7);

    // Vérifier le token avec Clerk (même implémentation que clerkAuth.ts)
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY!,
      clockSkewInMs: 60_000,
    });

    // Renseigner `req.auth` (convention du projet) ET `req.user`
    // (convention utilisée par les routes PII / promotions).
    req.auth = {
      userId: payload.sub,
      sessionId: payload.sid,
      sessionClaims: payload,
    };
    req.user = {
      id: payload.sub,
      email: typeof (payload as { email?: unknown }).email === 'string'
        ? ((payload as { email?: string }).email as string)
        : '',
      role: typeof (payload as { role?: unknown }).role === 'string'
        ? ((payload as { role?: string }).role as string)
        : 'user',
      permissions: [],
    };

    next();
  } catch (error) {
    console.error('Error in Clerk authentication:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};

/**
 * Middleware pour vérifier les permissions
 */
export const requirePermissions = (permissions: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const userPermissions = req.user.permissions || [];
      const hasPermission = permissions.every(permission => 
        userPermissions.includes(permission)
      );

      if (!hasPermission) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      next();
    } catch (error) {
      console.error('Error checking permissions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware pour vérifier le rôle
 */
export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!roles.includes(req.user.role)) {
        res.status(403).json({ error: 'Insufficient role' });
        return;
      }

      next();
    } catch (error) {
      console.error('Error checking role:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware pour vérifier la possession de la ressource
 */
export const requireOwnership = (resourceId: string, userIdField: string = 'userId') => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const resourceUserId = req.body[userIdField] || req.params[userIdField];
      
      // Si l'utilisateur est admin, autoriser l'accès
      if (req.user.role === 'admin') {
        next();
        return;
      }

      // Vérifier si l'utilisateur possède la ressource
      if (resourceUserId !== req.user.id) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      next();
    } catch (error) {
      console.error('Error checking ownership:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware pour limiter le taux de requêtes par utilisateur
 */
export const rateLimitByUser = (maxRequests: number, windowMs: number) => {
  const requests = new Map<string, number[]>();

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const userId = req.user.id;
      const now = Date.now();
      
      // Initialiser ou récupérer les requêtes de l'utilisateur
      if (!requests.has(userId)) {
        requests.set(userId, []);
      }
      
      const userRequests = requests.get(userId)!;
      
      // Supprimer les requêtes expirées
      const validRequests = userRequests.filter(time => now - time < windowMs);
      requests.set(userId, validRequests);
      
      // Vérifier si le taux est dépassé
      if (validRequests.length >= maxRequests) {
        res.status(429).json({ error: 'Too many requests' });
        return;
      }
      
      // Ajouter la requête actuelle
      validRequests.push(now);
      requests.set(userId, validRequests);
      
      next();
    } catch (error) {
      console.error('Error in rate limiting:', error);
      next();
    }
  };
};

/**
 * Middleware pour la journalisation des tentatives de connexion
 */
export const loginAttemptLogger = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const originalSend = res.send;
    res.send = function (this: Response, data: unknown): Response {
      // Journaliser les tentatives de connexion échouées (IP uniquement, jamais de credential)
      if (res.statusCode === 401) {
        console.log('Failed login attempt from IP:', req.ip);
      }
      return originalSend.call(this, data);
    } as typeof res.send;

    next();
  } catch (error) {
    console.error('Error in login attempt logger:', error);
    next();
  }
};