import { Request, Response, NextFunction } from 'express';

/**
 * Interface pour les promotions
 */
interface Promotion {
  id: string;
  name: string;
  type: 'percentage' | 'fixed' | 'free_shipping';
  value: number;
  conditions: {
    minimumAmount?: number;
    productIds?: string[];
    userLevel?: string;
    maxUses?: number;
    validUntil?: Date;
  };
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface pour les applications de promotion
 */
interface PromotionApplication {
  promotionId: string;
  userId: string;
  amount: number;
  discount: number;
  appliedAt: Date;
}

/**
 * Gestionnaire de promotions sécurisé
 */
export class PromotionManager {
  private promotions: Map<string, Promotion> = new Map();
  private applications: Map<string, PromotionApplication> = new Map();
  private maxApplicationsPerUser: number = 3;
  private maxPromotionUses: number = 100;

  /**
   * Créer une nouvelle promotion
   */
  createPromotion(promotion: Omit<Promotion, 'id' | 'createdAt' | 'updatedAt'>): Promotion {
    const id = this.generateId();
    const now = new Date();
    
    const newPromotion: Promotion = {
      id,
      ...promotion,
      createdAt: now,
      updatedAt: now
    };

    this.promotions.set(id, newPromotion);
    return newPromotion;
  }

  /**
   * Appliquer une promotion à une commande
   */
  applyPromotion(promotionId: string, userId: string, amount: number): {
    success: boolean;
    discount: number;
    finalAmount: number;
    message: string;
  } {
    // Vérifier si la promotion existe
    const promotion = this.promotions.get(promotionId);
    if (!promotion) {
      return {
        success: false,
        discount: 0,
        finalAmount: amount,
        message: 'Promotion not found'
      };
    }

    // Vérifier si la promotion est active
    if (!promotion.active) {
      return {
        success: false,
        discount: 0,
        finalAmount: amount,
        message: 'Promotion is not active'
      };
    }

    // Vérifier la date d'expiration
    if (promotion.conditions.validUntil && new Date() > promotion.conditions.validUntil) {
      return {
        success: false,
        discount: 0,
        finalAmount: amount,
        message: 'Promotion has expired'
      };
    }

    // Vérifier le montant minimum
    if (promotion.conditions.minimumAmount && amount < promotion.conditions.minimumAmount) {
      return {
        success: false,
        discount: 0,
        finalAmount: amount,
        message: `Minimum amount of ${promotion.conditions.minimumAmount} required`
      };
    }

    // Vérifier les limites d'utilisation
    const promotionApplications = Array.from(this.applications.values())
      .filter(app => app.promotionId === promotionId);
    
    if (promotion.conditions.maxUses && promotionApplications.length >= promotion.conditions.maxUses) {
      return {
        success: false,
        discount: 0,
        finalAmount: amount,
        message: 'Promotion has reached its maximum usage limit'
      };
    }

    // Vérifier le nombre d'applications par utilisateur
    const userApplications = Array.from(this.applications.values())
      .filter(app => app.userId === userId);
    
    if (userApplications.length >= this.maxApplicationsPerUser) {
      return {
        success: false,
        discount: 0,
        finalAmount: amount,
        message: 'Maximum number of promotions reached for this user'
      };
    }

    // Calculer la réduction
    let discount = 0;
    switch (promotion.type) {
      case 'percentage':
        discount = amount * (promotion.value / 100);
        break;
      case 'fixed':
        discount = Math.min(promotion.value, amount);
        break;
      case 'free_shipping':
        discount = 0; // La réduction est gérée ailleurs
        break;
    }

    // Appliquer la promotion
    const finalAmount = amount - discount;
    const application: PromotionApplication = {
      promotionId,
      userId,
      amount,
      discount,
      appliedAt: new Date()
    };

    this.applications.set(`${promotionId}-${userId}-${Date.now()}`, application);
    
    return {
      success: true,
      discount,
      finalAmount,
      message: 'Promotion applied successfully'
    };
  }

  /**
   * Valider une promotion avant application
   */
  validatePromotion(promotionId: string): {
    valid: boolean;
    message: string;
  } {
    const promotion = this.promotions.get(promotionId);
    
    if (!promotion) {
      return {
        valid: false,
        message: 'Promotion not found'
      };
    }

    if (!promotion.active) {
      return {
        valid: false,
        message: 'Promotion is not active'
      };
    }

    if (promotion.conditions.validUntil && new Date() > promotion.conditions.validUntil) {
      return {
        valid: false,
        message: 'Promotion has expired'
      };
    }

    const promotionApplications = Array.from(this.applications.values())
      .filter(app => app.promotionId === promotionId);
    
    if (promotion.conditions.maxUses && promotionApplications.length >= promotion.conditions.maxUses) {
      return {
        valid: false,
        message: 'Promotion has reached its maximum usage limit'
      };
    }

    return {
      valid: true,
      message: 'Promotion is valid'
    };
  }

  /**
   * Générer un ID unique
   */
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  /**
   * Récupérer les statistiques d'utilisation
   */
  getUsageStats(): {
    totalPromotions: number;
    activePromotions: number;
    totalApplications: number;
    averageDiscount: number;
  } {
    const totalPromotions = this.promotions.size;
    const activePromotions = Array.from(this.promotions.values()).filter(p => p.active).length;
    const totalApplications = this.applications.size;
    
    const totalDiscount = Array.from(this.applications.values())
      .reduce((sum, app) => sum + app.discount, 0);
    
    const averageDiscount = totalApplications > 0 ? totalDiscount / totalApplications : 0;

    return {
      totalPromotions,
      activePromotions,
      totalApplications,
      averageDiscount
    };
  }
}

/**
 * Créer une instance du gestionnaire de promotions
 */
const promotionManager = new PromotionManager();

// Initialiser quelques promotions de test
promotionManager.createPromotion({
  name: 'Welcome Discount',
  type: 'percentage',
  value: 10,
  conditions: {
    minimumAmount: 50,
    maxUses: 1000,
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 jours
  },
  active: true
});

promotionManager.createPromotion({
  name: 'Free Shipping',
  type: 'free_shipping',
  value: 0,
  conditions: {
    minimumAmount: 100,
    maxUses: 500
  },
  active: true
});

/**
 * Middleware pour valider les promotions
 */
export const validatePromotion = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { promotionId } = req.body;
    
    if (!promotionId) {
      next();
      return;
    }

    const validation = promotionManager.validatePromotion(promotionId);
    
    if (!validation.valid) {
      res.status(400).json({ error: validation.message });
      return;
    }

    next();
  } catch (error) {
    console.error('Error validating promotion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Middleware pour appliquer les promotions
 */
export const applyPromotion = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const { promotionId, userId, amount } = req.body;
    
    if (!promotionId || !userId || !amount) {
      next();
      return;
    }

    const result = promotionManager.applyPromotion(promotionId, userId, amount);
    
    if (result.success) {
      (req as any).promotionResult = result;
    } else {
      (req as any).promotionError = result.message;
    }

    next();
  } catch (error) {
    console.error('Error applying promotion:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default promotionManager;