import { Router, Request, Response } from 'express';
import { authenticateClerk } from '../middleware/authMiddleware';
import { validatePromotion, applyPromotion } from '../utils/PromotionManager';
import { checkPermission } from '../utils/AccessControl';

const router = Router();

// Appliquer l'authentification
router.use(authenticateClerk);

// Route pour créer une promotion
router.post('/create', 
  checkPermission('promotion:create'),
  (req: Request, res: Response) => {
    try {
      const promotionData = req.body;
      
      // Valider les données de promotion
      if (!promotionData.name || !promotionData.type || !promotionData.value) {
        res.status(400).json({ error: 'Missing required fields' });
        return;
      }
      
      // Ici, vous créez la promotion dans la base de données
      const promotion = {
        id: `promo_${Date.now()}`,
        name: promotionData.name,
        type: promotionData.type,
        value: promotionData.value,
        conditions: promotionData.conditions || {},
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      res.json({
        message: 'Promotion created successfully',
        promotion
      });
    } catch (error) {
      console.error('Error creating promotion:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Route pour appliquer une promotion
router.post('/apply', 
  // Permission AVANT l'effet de bord : sinon applyPromotion s'exécute
  // même pour un utilisateur non autorisé (auto-assignation de promotion).
  checkPermission('promotion:apply'),
  validatePromotion,
  applyPromotion,
  (req: Request, res: Response) => {
    try {
      // Le résultat de l'application est déjà dans req.promotionResult
      const promotionResult = (req as any).promotionResult;
      const promotionError = (req as any).promotionError;
      
      if (promotionError) {
        res.status(400).json({ error: promotionError });
        return;
      }
      
      res.json({
        message: 'Promotion applied successfully',
        result: promotionResult
      });
    } catch (error) {
      console.error('Error applying promotion:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Route pour valider une promotion
router.post('/validate', 
  checkPermission('promotion:read'),
  (req: Request, res: Response) => {
    try {
      const { promotionId } = req.body;
      
      if (!promotionId) {
        res.status(400).json({ error: 'Promotion ID required' });
        return;
      }
      
      // Ici, vous validez la promotion depuis la base de données
      const validation = {
        valid: true,
        message: 'Promotion is valid'
      };
      
      res.json(validation);
    } catch (error) {
      console.error('Error validating promotion:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Route pour obtenir les détails d'une promotion
router.get('/:id', 
  checkPermission('promotion:read'),
  (req: Request, res: Response) => {
    try {
      const promotionId = req.params.id;
      
      // Ici, vous récupérez la promotion depuis la base de données
      const promotion = {
        id: promotionId,
        name: 'Summer Discount',
        type: 'percentage',
        value: 15,
        conditions: {
          minimumAmount: 50,
          maxUses: 1000,
          validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        },
        active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      res.json(promotion);
    } catch (error) {
      console.error('Error retrieving promotion:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Route pour lister toutes les promotions
router.get('/', 
  checkPermission('promotion:read'),
  (req: Request, res: Response) => {
    try {
      // Ici, vous récupérez toutes les promotions depuis la base de données
      const promotions = [
        {
          id: 'promo_1',
          name: 'Welcome Discount',
          type: 'percentage',
          value: 10,
          conditions: {
            minimumAmount: 50,
            maxUses: 1000,
            validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          },
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 'promo_2',
          name: 'Free Shipping',
          type: 'free_shipping',
          value: 0,
          conditions: {
            minimumAmount: 100,
            maxUses: 500
          },
          active: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      
      res.json(promotions);
    } catch (error) {
      console.error('Error retrieving promotions:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Route pour mettre à jour une promotion
router.put('/:id', 
  checkPermission('promotion:update'),
  (req: Request, res: Response) => {
    try {
      const promotionId = req.params.id;
      const updateData = req.body;
      
      // Ici, vous mettez à jour la promotion dans la base de données
      const updatedPromotion = {
        id: promotionId,
        name: updateData.name || 'Updated Promotion',
        type: updateData.type || 'percentage',
        value: updateData.value || 10,
        conditions: updateData.conditions || {},
        active: updateData.active !== undefined ? updateData.active : true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      res.json({
        message: 'Promotion updated successfully',
        promotion: updatedPromotion
      });
    } catch (error) {
      console.error('Error updating promotion:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Route pour désactiver une promotion
router.put('/:id/disable', 
  checkPermission('promotion:update'),
  (req: Request, res: Response) => {
    try {
      const promotionId = req.params.id;
      
      // Ici, vous désactivez la promotion dans la base de données
      res.json({
        message: 'Promotion disabled successfully',
        promotionId
      });
    } catch (error) {
      console.error('Error disabling promotion:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Route pour obtenir les statistiques d'utilisation des promotions
router.get('/stats/usage', 
  checkPermission('promotion:read'),
  (req: Request, res: Response) => {
    try {
      // Ici, vous récupérez les statistiques depuis la base de données
      const stats = {
        totalPromotions: 10,
        activePromotions: 8,
        totalApplications: 1500,
        averageDiscount: 12.5,
        mostUsedPromotion: 'Summer Discount'
      };
      
      res.json(stats);
    } catch (error) {
      console.error('Error retrieving promotion stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

export default router;