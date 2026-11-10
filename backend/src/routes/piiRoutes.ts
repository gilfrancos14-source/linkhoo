import { Router, Request, Response } from 'express';
import { authenticateClerk } from '../middleware/authMiddleware';
import type { AuthRequest } from '../middleware/authMiddleware';
import { detectAndStorePII, dataSubjectRights } from '../utils/PIIDataManager';
import piiDataManager from '../utils/PIIDataManager';
import { checkPermission } from '../utils/AccessControl';

const router = Router();

// Appliquer l'authentification
router.use(authenticateClerk);

// Route pour stocker des données PII
router.post('/store', 
  detectAndStorePII,
  checkPermission('pii:store'),
  (req: Request, res: Response) => {
    try {
      const detectedPII = (req as any).detectedPII;
      
      if (!detectedPII) {
        res.status(400).json({ error: 'No PII data detected' });
        return;
      }
      
      res.json({
        message: 'PII data stored successfully',
        data: detectedPII
      });
    } catch (error) {
      console.error('Error storing PII data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Route pour récupérer les données PII de l'utilisateur
router.get('/my-data', 
  checkPermission('pii:read'),
  (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Données RÉELLES de l'utilisateur (magasin chiffré du serveur).
      res.json(piiDataManager.listForUser(userId));
    } catch (error) {
      console.error('Error retrieving PII data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Route pour anonymiser les données PII
router.post('/anonymize', 
  checkPermission('pii:anonymize'),
  (req: AuthRequest, res: Response) => {
    try {
      const { piiIds } = req.body;
      const userId = req.user?.id;

      if (!userId || !piiIds || !Array.isArray(piiIds)) {
        res.status(400).json({ error: 'Invalid PII IDs' });
        return;
      }

      // Anonymisation RÉELLE (seules les entrées appartenant à l'utilisateur
      // sont touchées : `anonymizePII` vérifie le ownerId).
      const anonymizedData = piiIds
        .filter((id): id is string => typeof id === 'string')
        .map(id => ({
          id,
          status: piiDataManager.anonymizePII(id, userId) ? 'anonymized' : 'not_found',
          anonymizedAt: new Date()
        }));

      res.json({
        message: 'PII data anonymized successfully',
        data: anonymizedData
      });
    } catch (error) {
      console.error('Error anonymizing PII data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Route pour supprimer les données PII
router.delete('/delete', 
  checkPermission('pii:delete'),
  (req: AuthRequest, res: Response) => {
    try {
      const { piiIds } = req.body;
      const userId = req.user?.id;

      if (!userId || !piiIds || !Array.isArray(piiIds)) {
        res.status(400).json({ error: 'Invalid PII IDs' });
        return;
      }

      // Suppression RÉELLE (scopée à l'utilisateur authentifié).
      const deletedData = piiIds
        .filter((id): id is string => typeof id === 'string')
        .map(id => ({
          id,
          status: piiDataManager.deletePII(id, userId) ? 'deleted' : 'not_found',
          deletedAt: new Date()
        }));

      res.json({
        message: 'PII data deleted successfully',
        data: deletedData
      });
    } catch (error) {
      console.error('Error deleting PII data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Route pour les droits des sujets de données (RGPD)
router.post('/data-subject-rights/:action', 
  dataSubjectRights
  // `dataSubjectRights` écrit lui-même la réponse (200/4xx) et ne appelle
  // jamais `next()` : aucun handler final n'est nécessaire ici.
);

// Route pour configurer les préférences de confidentialité
router.put('/privacy-preferences', 
  checkPermission('pii:update'),
  (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const preferences = req.body;
      piiDataManager.setPrivacyPreferences(userId, preferences);

      res.json({
        message: 'Privacy preferences updated successfully',
        preferences: piiDataManager.getPrivacyPreferences(userId)
      });
    } catch (error) {
      console.error('Error updating privacy preferences:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Route pour obtenir les préférences de confidentialité
router.get('/privacy-preferences', 
  checkPermission('pii:read'),
  (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Préférences RÉELLES de l'utilisateur (défauts s'il n'en a pas).
      const preferences = piiDataManager.getPrivacyPreferences(userId);
      res.json(preferences ?? {
        dataRetention: 365,
        anonymization: true,
        consentGiven: false,
        deletionRequests: [],
        consentDate: null
      });
    } catch (error) {
      console.error('Error retrieving privacy preferences:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Route pour exporter les données PII
router.get('/export', 
  checkPermission('pii:export'),
  (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Export RGPD : données RÉELLES déchiffrées de l'utilisateur.
      res.json({
        userId,
        data: piiDataManager.listForUser(userId),
        exportedAt: new Date()
      });
    } catch (error) {
      console.error('Error exporting PII data:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;