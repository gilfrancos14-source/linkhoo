import crypto from 'crypto';
import { Response, NextFunction } from 'express';
import type { AuthRequest } from '../middleware/authMiddleware';

/**
 * Interface pour les données personnelles identifiables (PII)
 */
interface PII {
  id: string;
  userId: string;
  type: string;
  data: any;
  encrypted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface pour les préférences de confidentialité
 */
interface PrivacyPreferences {
  userId: string;
  dataRetention: number; // en jours
  anonymization: boolean;
  deletionRequests: Date[];
  consentGiven: boolean;
  consentDate: Date;
}

/**
 * Gestionnaire de données personnelles avec chiffrement et conformité
 */
export class PIIDataManager {
  private piiData: Map<string, PII> = new Map();
  private privacyPreferences: Map<string, PrivacyPreferences> = new Map();
  private encryptionKey: string;
  private algorithm = 'aes-256-gcm' as const;

  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
  }

  /**
   * Stocker des données PII avec chiffrement
   */
  storePII(userId: string, type: string, data: any): PII {
    const id = this.generateId();
    const now = new Date();
    
    // Chiffrer les données
    const encryptedData = this.encryptData(JSON.stringify(data));
    
    const pii: PII = {
      id,
      userId,
      type,
      data: encryptedData,
      encrypted: true,
      createdAt: now,
      updatedAt: now
    };

    this.piiData.set(id, pii);
    return pii;
  }

  /**
   * Récupérer des données PII avec déchiffrement.
   * Retourne une COPIE déchiffrée : l'entrée stockée reste chiffrée
   * (l'ancienne version mutait `pii.data` en clair, corrompant le stockage).
   */
  getPII(piiId: string, userId: string): PII | null {
    const pii = this.piiData.get(piiId);

    if (!pii || pii.userId !== userId) {
      return null;
    }

    return {
      ...pii,
      data: this.decryptToJson(pii.data),
    };
  }

  /**
   * Liste (déchiffrées) toutes les données PII d'un utilisateur.
   * Usage : export RGPD et consultation « mes données ».
   */
  listForUser(userId: string): PII[] {
    return Array.from(this.piiData.values())
      .filter(pii => pii.userId === userId)
      .map(pii => ({
        ...pii,
        data: this.decryptToJson(pii.data),
      }));
  }

  /**
   * Mettre à jour des données PII
   */
  updatePII(piiId: string, userId: string, newData: any): PII | null {
    const pii = this.piiData.get(piiId);
    
    if (!pii || pii.userId !== userId) {
      return null;
    }

    // Chiffrer les nouvelles données
    const encryptedData = this.encryptData(JSON.stringify(newData));
    
    pii.data = encryptedData;
    pii.updatedAt = new Date();
    
    this.piiData.set(piiId, pii);
    return pii;
  }

  /**
   * Supprimer des données PII
   */
  deletePII(piiId: string, userId: string): boolean {
    const pii = this.piiData.get(piiId);
    
    if (!pii || pii.userId !== userId) {
      return false;
    }

    this.piiData.delete(piiId);
    return true;
  }

  /**
   * Anonymiser des données PII
   */
  anonymizePII(piiId: string, userId: string): PII | null {
    const pii = this.piiData.get(piiId);
    
    if (!pii || pii.userId !== userId) {
      return null;
    }

    // Remplacer les données par des données anonymes
    const anonymizedData = {
      anonymized: true,
      originalType: pii.type,
      anonymizedAt: new Date()
    };

    const encryptedData = this.encryptData(JSON.stringify(anonymizedData));
    
    pii.data = encryptedData;
    pii.updatedAt = new Date();
    
    this.piiData.set(piiId, pii);
    return pii;
  }

  /**
   * Configurer les préférences de confidentialité
   */
  setPrivacyPreferences(userId: string, preferences: Partial<PrivacyPreferences>): void {
    const now = new Date();
    
    const existingPreferences = this.privacyPreferences.get(userId) || {
      userId,
      dataRetention: 365, // 1 an par défaut
      anonymization: true,
      deletionRequests: [],
      consentGiven: false,
      consentDate: now
    };

    const updatedPreferences: PrivacyPreferences = {
      ...existingPreferences,
      ...preferences,
      consentDate: preferences.consentGiven ? now : existingPreferences.consentDate
    };

    this.privacyPreferences.set(userId, updatedPreferences);
  }

  /**
   * Récupérer les préférences de confidentialité
   */
  getPrivacyPreferences(userId: string): PrivacyPreferences | null {
    return this.privacyPreferences.get(userId) || null;
  }

  /**
   * Demander la suppression des données
   */
  requestDataDeletion(userId: string): void {
    const preferences = this.privacyPreferences.get(userId);
    
    if (preferences) {
      preferences.deletionRequests.push(new Date());
      this.privacyPreferences.set(userId, preferences);
      
      // Supprimer les données PII de l'utilisateur
      const userPII = Array.from(this.piiData.values()).filter(p => p.userId === userId);
      userPII.forEach(pii => this.piiData.delete(pii.id));
    }
  }

  /**
   * Nettoyer les données expirées : suppression des entrées PII plus vieilles
   * que la durée de rétention de l'utilisateur.
   *
   * (L'ancienne version calculait `new Date(retention * 86400000)`, c'est-à-dire
   * une date de 1970+1 an : tout était considéré comme expiré et TOUTES les
   * PII des utilisateurs avec préférences étaient supprimées au premier run.)
   */
  cleanupExpiredData(): void {
    const now = Date.now();

    for (const pii of Array.from(this.piiData.values())) {
      const preferences = this.privacyPreferences.get(pii.userId);
      const retentionDays = preferences?.dataRetention ?? 365;
      const expiresAt = pii.createdAt.getTime() + retentionDays * 24 * 60 * 60 * 1000;

      if (now > expiresAt) {
        this.piiData.delete(pii.id);
      }
    }
  }

  /**
   * Chiffrer des données — AES-256-GCM avec IV aléatoire et tag d'authentification.
   * Format : iv:tag:ciphertext (hex)
   *
   * (Remplace l'ancienne implémentation `crypto.createCipher`, retirée de
   * Node.js, qui générait un IV jamais utilisé et reposait sur du KDF maison.)
   */
  private encryptData(data: string): string {
    const key = this.deriveKey();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, key, iv);

    const encrypted = Buffer.concat([
      cipher.update(data, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Déchiffrer des données chiffrées par `encryptData`.
   */
  private decryptData(encryptedData: string): string {
    const [ivHex, tagHex, ciphertextHex] = encryptedData.split(':');
    if (!ivHex || !tagHex || !ciphertextHex) {
      throw new Error('Format de données chiffrées invalide');
    }

    const key = this.deriveKey();
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      key,
      Buffer.from(ivHex, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextHex, 'hex')),
      decipher.final(),
    ]).toString('utf8');
  }

  /**
   * Dérive une clé de 32 octets à partir de la clé configurée (scrypt).
   */
  private deriveKey(): Buffer {
    return crypto.scryptSync(this.encryptionKey, 'ilehya-pii-salt', 32);
  }

  /**
   * Déchiffre puis dé-JSON decode si possible (les entrées sont écrites
   * via `JSON.stringify`).
   */
  private decryptToJson(stored: unknown): unknown {
    if (typeof stored !== 'string') return stored;
    try {
      return JSON.parse(this.decryptData(stored));
    } catch {
      return this.decryptData(stored);
    }
  }

  /**
   * Générer un ID unique
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }
}

/**
 * Créer une instance du gestionnaire de données PII
 *
 * Sans PII_ENCRYPTION_KEY, on génère une clé ALÉATOIRE pour ce process
 * plutôt que d'utiliser une valeur par défaut connue : les données écrites
 * ne seront pas relues après redémarrage, mais jamais déchiffrables par un
 * tiers. En production, PII_ENCRYPTION_KEY DOIT être définie.
 */
const encryptionKey = process.env.PII_ENCRYPTION_KEY?.trim();
if (!encryptionKey) {
  console.warn(
    '[SECURITY] PII_ENCRYPTION_KEY absente : clé éphémère générée pour ce process. ' +
      'Définissez PII_ENCRYPTION_KEY en production (voir .env.example).',
  );
}
const piiDataManager = new PIIDataManager(encryptionKey || crypto.randomBytes(32).toString('hex'));

/**
 * Middleware pour détecter et stocker les données PII
 */
export const detectAndStorePII = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      next();
      return;
    }

    // Détecter les données PII dans la requête
    const piiFields = ['email', 'phone', 'address', 'ssn', 'idNumber'];
    const detectedPII: { [key: string]: any } = {};

    piiFields.forEach(field => {
      if (req.body[field]) {
        detectedPII[field] = req.body[field];
        
        // Stocker les données PII
        piiDataManager.storePII(userId, field, req.body[field]);
        
        // Masquer les données PII de la réponse
        req.body[field] = '[REDACTED]';
      }
    });

    if (Object.keys(detectedPII).length > 0) {
      (req as any).detectedPII = detectedPII;
    }

    next();
  } catch (error) {
    console.error('Error detecting and storing PII:', error);
    next();
  }
};

/**
 * Middleware pour la conformité RGPD
 */
export const gdprCompliance = (req: AuthRequest, res: Response, next: NextFunction): void => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      next();
      return;
    }

    // Vérifier si l'utilisateur a donné son consentement
    const preferences = piiDataManager.getPrivacyPreferences(userId);
    
    if (!preferences?.consentGiven) {
      res.status(403).json({ error: 'User has not given consent for data processing' });
      return;
    }

    next();
  } catch (error) {
    console.error('Error in GDPR compliance:', error);
    next();
  }
};

/**
 * Middleware pour la gestion des droits des sujets de données
 */
export const dataSubjectRights = (req: AuthRequest, res: Response, _next: NextFunction): void => {
  try {
    const { action } = req.params;
    const userId = req.user?.id;
    
    if (!userId) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    switch (action) {
      case 'access': {
        // Donner accès aux données PII de l'utilisateur (déchiffrées)
        res.json({ pii: piiDataManager.listForUser(userId) });
        return;
      }

      case 'delete':
        // Supprimer les données PII de l'utilisateur
        piiDataManager.requestDataDeletion(userId);
        res.json({ message: 'Data deletion request processed' });
        return;

      case 'anonymize': {
        // Anonymiser les données PII de l'utilisateur
        const piiList = piiDataManager.listForUser(userId);

        piiList.forEach(pii => {
          piiDataManager.anonymizePII(pii.id, userId);
        });

        res.json({ message: 'PII data anonymized' });
        return;
      }

      default:
        res.status(400).json({ error: 'Invalid action' });
        return;
    }
  } catch (error) {
    console.error('Error in data subject rights:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default piiDataManager;