import crypto from 'crypto';

/**
 * Interface pour les données de signature
 */
export interface SignatureData {
  payload: string;
  signature: string;
  timestamp: string;
  algorithm?: string;
}

/**
 * Vérificateur de signatures sécurisé
 */
export class SignatureVerifier {
  private secretKey: string;
  private algorithm: string;

  constructor(secretKey: string, algorithm: string = 'sha256') {
    this.secretKey = secretKey;
    this.algorithm = algorithm;
  }

  /**
   * Générer une signature HMAC
   */
  generateSignature(payload: string): string {
    const hmac = crypto.createHmac(this.algorithm, this.secretKey);
    hmac.update(payload);
    return hmac.digest('hex');
  }

  /**
   * Vérifier une signature HMAC
   */
  verifySignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = this.generateSignature(payload);
      
      // Utiliser une comparaison sécurisée contre les attaques temporelles
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error('Error verifying signature:', error);
      return false;
    }
  }

  /**
   * Vérifier une signature avec timestamp
   */
  verifySignatureWithTimestamp(payload: string, signature: string, timestamp: string): boolean {
    try {
      // Vérifier le timestamp (ne pas accepter de requêtes trop anciennes)
      const requestTime = new Date(timestamp).getTime();
      const now = Date.now();
      const maxAge = 5 * 60 * 1000; // 5 minutes
      
      if (Math.abs(now - requestTime) > maxAge) {
        console.error('Timestamp too old or invalid');
        return false;
      }

      // Créer la signature avec le timestamp
      const signedPayload = timestamp + payload;
      return this.verifySignature(signedPayload, signature);
    } catch (error) {
      console.error('Error verifying signature with timestamp:', error);
      return false;
    }
  }

  /**
   * Vérifier une signature JWT
   */
  verifyJWT(token: string, publicKey?: string): any {
    try {
      // Si une clé publique est fournie, utiliser la vérification JWT
      if (publicKey) {
        const jwt = require('jsonwebtoken');
        return jwt.verify(token, publicKey);
      }
      
      // Sinon, utiliser une vérification simple basée sur la signature
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
      const signature = parts[2];

      // Vérifier l'algorithme
      if (header.alg !== this.algorithm) {
        throw new Error('Invalid algorithm');
      }

      // Vérifier la signature
      const signedPayload = parts[0] + '.' + parts[1];
      const isValid = this.verifySignature(signedPayload, signature);
      
      if (!isValid) {
        throw new Error('Invalid signature');
      }

      return payload;
    } catch (error) {
      console.error('Error verifying JWT:', error);
      throw error;
    }
  }

  /**
   * Générer une signature RSA
   */
  generateRSASignature(payload: string, privateKey: string): string {
    try {
      const sign = crypto.createSign('RSA-SHA256');
      sign.update(payload);
      return sign.sign(privateKey, 'hex');
    } catch (error) {
      console.error('Error generating RSA signature:', error);
      throw error;
    }
  }

  /**
   * Vérifier une signature RSA
   */
  verifyRSASignature(payload: string, signature: string, publicKey: string): boolean {
    try {
      const verify = crypto.createVerify('RSA-SHA256');
      verify.update(payload);
      return verify.verify(publicKey, signature, 'hex');
    } catch (error) {
      console.error('Error verifying RSA signature:', error);
      return false;
    }
  }

  /**
   * Créer une signature URL-safe
   */
  createURLSafeSignature(payload: string): string {
    const signature = this.generateSignature(payload);
    // Remplacer les caractères non URL-safe
    return signature.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  }

  /**
   * Vérifier une signature URL-safe
   */
  verifyURLSafeSignature(payload: string, signature: string): boolean {
    // Remplacer les caractères URL-safe pour obtenir la signature originale
    const originalSignature = signature
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .replace(/=/g, '');
    
    return this.verifySignature(payload, originalSignature);
  }

  /**
   * Vérifier les signatures de webhook
   */
  verifyWebhookSignature(payload: string, signature: string, secret: string, timestamp?: string): boolean {
    try {
      // Si un timestamp est fourni, l'utiliser pour la vérification
      if (timestamp) {
        return this.verifySignatureWithTimestamp(payload, signature, timestamp);
      }
      
      // Sinon, vérifier la signature simple
      const verifier = new SignatureVerifier(secret, this.algorithm);
      return verifier.verifySignature(payload, signature);
    } catch (error) {
      console.error('Error verifying webhook signature:', error);
      return false;
    }
  }
}

/**
 * Créer une instance du vérificateur de signatures
 */
const secretKey = process.env.SECRET_KEY || 'default-secret-key';
const signatureVerifier = new SignatureVerifier(secretKey);

/**
 * Middleware pour vérifier les signatures des requêtes
 */
export const verifyRequestSignature = (req: any, res: any, next: any): void => {
  try {
    const signature = req.headers['x-signature'] as string;
    const timestamp = req.headers['x-timestamp'] as string;
    
    if (!signature) {
      res.status(401).json({ error: 'Signature required' });
      return;
    }

    const payload = JSON.stringify(req.body);
    const isValid = signatureVerifier.verifySignatureWithTimestamp(payload, signature, timestamp);
    
    if (!isValid) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    next();
  } catch (error) {
    console.error('Error verifying request signature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware pour vérifier les signatures des webhooks
 */
export const verifyWebhookSignature = (req: any, res: any, next: any): void => {
  try {
    const signature = req.headers['x-webhook-signature'] as string;
    const timestamp = req.headers['x-webhook-timestamp'] as string;
    const secret = process.env.WEBHOOK_SECRET;
    
    if (!signature || !secret) {
      res.status(401).json({ error: 'Signature or secret required' });
      return;
    }

    const payload = req.rawBody || JSON.stringify(req.body);
    const isValid = signatureVerifier.verifyWebhookSignature(payload, signature, secret, timestamp);
    
    if (!isValid) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    next();
  } catch (error) {
    console.error('Error verifying webhook signature:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Fonction utilitaire pour générer une signature
 */
export const generateSignature = (payload: string): string => {
  return signatureVerifier.generateSignature(payload);
};

/**
 * Fonction utilitaire pour vérifier une signature
 */
export const verifySignature = (payload: string, signature: string): boolean => {
  return signatureVerifier.verifySignature(payload, signature);
};

export default signatureVerifier;