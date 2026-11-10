import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';

/**
 * Interface pour les rôles et permissions
 */
interface Role {
  name: string;
  permissions: string[];
}

/**
 * Interface pour les politiques d'accès
 */
interface Policy {
  resource: string;
  action: string;
  effect: 'allow' | 'deny';
  conditions?: Record<string, any>;
}

/**
 * Système de contrôle d'accès basé sur les rôles et les politiques
 */
export class AccessControl {
  private roles: Map<string, Role> = new Map();
  private policies: Policy[] = [];

  /**
   * Ajouter un rôle
   */
  addRole(name: string, permissions: string[]): void {
    this.roles.set(name, { name, permissions });
  }

  /**
   * Ajouter une politique d'accès
   */
  addPolicy(policy: Policy): void {
    this.policies.push(policy);
  }

  /**
   * Vérifier si un utilisateur a une permission
   */
  hasPermission(userId: string, permission: string): boolean {
    // Dans une implémentation réelle, vous récupériez le rôle de l'utilisateur depuis la base de données
    const userRole = this.getRoleForUser(userId);
    if (!userRole) return false;

    return userRole.permissions.includes(permission);
  }

  /**
   * Vérifier si un utilisateur peut accéder à une ressource
   */
  canAccess(userId: string, resource: string, action: string, context?: Record<string, any>): boolean {
    // Récupérer le rôle de l'utilisateur
    const userRole = this.getRoleForUser(userId);
    if (!userRole) return false;

    // Vérifier les politiques d'accès
    for (const policy of this.policies) {
      if (policy.resource === resource && policy.action === action) {
        // Vérifier les conditions si elles existent
        if (policy.conditions && context) {
          const conditionsMet = this.checkConditions(policy.conditions, context);
          if (!conditionsMet) continue;
        }

        // Appliquer la politique
        if (policy.effect === 'allow') {
          return true;
        } else if (policy.effect === 'deny') {
          return false;
        }
      }
    }

    // Vérifier les permissions directes
    return this.hasPermission(userId, `${resource}:${action}`);
  }

  /**
   * Vérifier les conditions d'une politique
   */
  private checkConditions(conditions: Record<string, any>, context: Record<string, any>): boolean {
    for (const [key, value] of Object.entries(conditions)) {
      const actual = context[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Opérateurs simples : { $lt: 1000 }, { $gte: … }, { $in: [...] }
        if ('$lt' in value && !(actual < value.$lt)) return false;
        if ('$lte' in value && !(actual <= value.$lte)) return false;
        if ('$gt' in value && !(actual > value.$gt)) return false;
        if ('$gte' in value && !(actual >= value.$gte)) return false;
        if ('$in' in value && !value.$in.includes(actual)) return false;
        continue;
      }
      if (actual !== value) {
        return false;
      }
    }
    return true;
  }

  /**
   * Récupère le rôle d'un utilisateur.
   * Sans accès à la requête, on ne peut pas lire le statut admin : c'est le
   * middleware `checkPermission` (qui a `req`) qui traite le cas admin.
   * Par défaut : rôle `user` (auto-service) pour tout userId inconnu.
   */
  private getRoleForUser(_userId: string): Role | undefined {
    return this.roles.get('user');
  }
}

/**
 * Créer une instance du système de contrôle d'accès
 */
const accessControl = new AccessControl();

// Initialiser les rôles par défaut
accessControl.addRole('admin', [
  'users:read',
  'users:write',
  'users:delete',
  'resources:read',
  'resources:write',
  'resources:delete',
  'system:admin'
]);

accessControl.addRole('manager', [
  'users:read',
  'users:write',
  'resources:read',
  'resources:write'
]);

accessControl.addRole('user', [
  'resources:read',
  // Auto-service : chaque utilisateur authentifié gère SES propres données
  // (les routes PII sont de toute façon scopées par userId côté handler).
  'pii:store',
  'pii:read',
  'pii:update',
  'pii:anonymize',
  'pii:delete',
  'pii:export',
  'promotion:read',
  'promotion:apply',
  'payment:read'
]);

// Ajouter des politiques d'accès
accessControl.addPolicy({
  resource: 'payment',
  action: 'create',
  effect: 'allow',
  conditions: { amount: { $lt: 1000 } }
});

accessControl.addPolicy({
  resource: 'payment',
  action: 'refund',
  effect: 'allow',
  conditions: { role: 'admin' }
});

/**
 * Middleware pour vérifier les permissions
 */
export const checkPermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      // Admin JWT : permissions granulaires chargées en base par le
      // middleware admin du projet (req.adminPerms), sinon admin complet.
      if (req.admin) {
        if (!req.adminPerms || req.adminPerms.isSuper || req.adminPerms.perms.has(permission)) {
          next();
          return;
        }
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      const userId = req.user?.id || req.auth?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!accessControl.hasPermission(userId, permission)) {
        res.status(403).json({ error: 'Insufficient permissions' });
        return;
      }

      next();
    } catch (error) {
      console.error('Error checking permission:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware pour vérifier l'accès aux ressources
 */
export const checkAccess = (resource: string, action: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      const userId = req.user?.id || req.auth?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const context = {
        ...req.body,
        ...req.params,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      };

      if (!accessControl.canAccess(userId, resource, action, context)) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      next();
    } catch (error) {
      console.error('Error checking access:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

/**
 * Middleware pour la gestion des capacités utilisateur
 */
export const checkCapability = (capability: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    try {
      const userId = req.user?.id || req.auth?.userId;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Vérifier si l'utilisateur a la capacité requise
      const hasCapability = accessControl.hasPermission(userId, capability);
      
      if (!hasCapability) {
        res.status(403).json({ error: 'Insufficient capability' });
        return;
      }

      next();
    } catch (error) {
      console.error('Error checking capability:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};

export default accessControl;