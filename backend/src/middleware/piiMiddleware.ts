import { Request, Response, NextFunction } from 'express';

/**
 * Interface pour les données personnelles identifiables (PII)
 */
interface PII {
  email?: string;
  phone?: string;
  address?: string;
  ssn?: string;
  idNumber?: string;
  [key: string]: any;
}

/**
 * Liste des champs contenant des PII
 */
const PII_FIELDS = [
  'email', 'email_address', 'e_mail',
  'phone', 'phone_number', 'telephone', 'mobile',
  'address', 'street', 'city', 'zip', 'postal_code',
  'ssn', 'social_security_number', 'id_number', 'identification_number',
  'name', 'first_name', 'last_name', 'full_name',
  'birth_date', 'date_of_birth',
  'passport', 'id_card', 'driver_license'
];

/**
 * Middleware pour détecter et traiter les données PII
 */
export const detectPII = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      next();
      return;
    }

    const piiData: PII = {};

    // Parcourir les données à la recherche de PII
    for (const key in data) {
      if (PII_FIELDS.some(field => key.toLowerCase().includes(field))) {
        piiData[key] = data[key];
      }
    }

    // ATTENTION : on ne MUTATE PAS req.body ici. Remplacer les champs par
    // '[REDACTED]' détruirait les données que la route doit ensuite stocker
    // (ex. /api/pii/store enregistrerait la chaîne "[REDACTED]").
    // Les valeurs détectées restent en mémoire sur la requête — jamais loggées.
    if (Object.keys(piiData).length > 0) {
      (req as Request & { piiData?: PII; piiFields?: string[] }).piiData = piiData;
      (req as Request & { piiFields?: string[] }).piiFields = Object.keys(piiData);
      console.log('PII fields detected in request:', Object.keys(piiData).join(', '));
    }

    next();
  } catch (error) {
    console.error('Error detecting PII:', error);
    next();
  }
};

/**
 * Middleware pour valider les données PII
 */
export const validatePIIData = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const piiData = (req as any).piiData;
    if (!piiData) {
      next();
      return;
    }

    // Valider le format des emails
    if (piiData.email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(piiData.email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }
    }

    // Valider le format des numéros de téléphone
    if (piiData.phone) {
      const phoneRegex = /^[\d\s\-+()]+$/;
      if (!phoneRegex.test(piiData.phone)) {
        res.status(400).json({ error: 'Invalid phone number format' });
        return;
      }
    }

    // Valider les numéros de sécurité sociale
    if (piiData.ssn) {
      const ssnRegex = /^\d{3}-?\d{2}-?\d{4}$/;
      if (!ssnRegex.test(piiData.ssn)) {
        res.status(400).json({ error: 'Invalid SSN format' });
        return;
      }
    }

    next();
  } catch (error) {
    console.error('Error validating PII data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware pour chiffrer les données PII
 */
export const encryptPII = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const piiData = (req as any).piiData;
    if (!piiData) {
      next();
      return;
    }

    // Ici, vous implémenteriez le chiffrement des PII
    // Pour l'exemple, nous allons simplement les logger
    console.log('Encrypting PII data:', piiData);

    // Dans une implémentation réelle, vous utiliseriez un algorithme de chiffrement
    // comme AES-256 avec une clé de chiffrement stockée de manière sécurisée

    next();
  } catch (error) {
    console.error('Error encrypting PII:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware pour anonymiser les données PII dans les réponses
 */
export const anonymizePII = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      if (body && typeof body === 'object') {
        return originalJson(anonymizeObject(body));
      }
      return originalJson(body);
    }) as typeof res.json;

    next();
  } catch (error) {
    console.error('Error anonymizing PII:', error);
    next();
  }
};

/**
 * Fonction utilitaire pour anonymiser les objets contenant des PII.
 * Préserve la forme des tableaux.
 */
function anonymizeObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => anonymizeObject(item));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const anonymized: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (PII_FIELDS.some(field => key.toLowerCase().includes(field))) {
      anonymized[key] = '[ANONYMIZED]';
    } else {
      anonymized[key] = anonymizeObject(entry);
    }
  }
  return anonymized;
}

/**
 * Middleware pour la conformité RGPD
 */
export const gdprCompliance = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Ajouter les en-têtes de conformité RGPD
    res.set({
      'Privacy-Policy': 'https://ilehya.com/privacy-policy',
      'Data-Subject-Access-Request': 'https://ilehya.com/dsar'
    });

    // Vérifier si la requête contient un en-tête de suppression de données
    const deleteData = req.headers['x-delete-data'];
    if (deleteData === 'true') {
      // Ici, vous implémenteriez la suppression des données de l'utilisateur
      console.log('Data deletion request received');
    }

    next();
  } catch (error) {
    console.error('Error in GDPR compliance middleware:', error);
    next();
  }
};

/**
 * Middleware pour la conformité CCPA
 */
export const ccpaCompliance = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Ajouter les en-têtes de conformité CCPA
    res.set({
      'Do-Not-Sell': 'https://ilehya.com/ccpa',
      'Privacy-Policy': 'https://ilehya.com/privacy-policy'
    });

    next();
  } catch (error) {
    console.error('Error in CCPA compliance middleware:', error);
    next();
  }
};