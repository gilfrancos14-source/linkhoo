import React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { useInView } from 'react-intersection-observer';

// Configuration générale pour les animations
export const fadeInVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1, 
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

export const slideInFromLeftVariants: Variants = {
  hidden: { x: -50, opacity: 0 },
  visible: { 
    x: 0, 
    opacity: 1, 
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

export const slideInFromRightVariants: Variants = {
  hidden: { x: 50, opacity: 0 },
  visible: { 
    x: 0, 
    opacity: 1, 
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

export const slideInFromBottomVariants: Variants = {
  hidden: { y: 50, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1, 
    transition: { duration: 0.6, ease: "easeOut" }
  }
};

export const fadeInUpVariants: Variants = {
  hidden: { y: 30, opacity: 0 },
  visible: { 
    y: 0, 
    opacity: 1, 
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

export const scaleInVariants: Variants = {
  hidden: { scale: 0.8, opacity: 0 },
  visible: { 
    scale: 1, 
    opacity: 1, 
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

// Hook pour les animations au scroll
export const useAnimateOnScroll = (threshold = 0.1) => {
  const { ref, inView, entry } = useInView({
    threshold,
    triggerOnce: true,
  });

  return { ref, inView, entry };
};

// Composant wrapper pour les animations au scroll
export const AnimatedSection = ({ 
  children, 
  variants = fadeInVariants,
  className = "" 
}: { 
  children: React.ReactNode;
  variants?: Variants;
  className?: string;
}) => {
  const prefersReducedMotion = useReducedMotion();
  const { ref, inView } = useAnimateOnScroll();

  // Si l'utilisateur préfère les réduits mouvements, on affiche directement le contenu
  const shouldAnimate = !prefersReducedMotion;

  return (
    <motion.div
      ref={ref}
      className={className}
      initial={shouldAnimate ? "hidden" : "visible"}
      animate={shouldAnimate ? (inView ? "visible" : "hidden") : "visible"}
      variants={shouldAnimate ? variants : { hidden: { opacity: 1 }, visible: { opacity: 1 } }}
    >
      {children}
    </motion.div>
  );
};

// Composant pour les animations de liste avec stagger
export const AnimatedList = ({ 
  children, 
  className = "" 
}: { 
  children: React.ReactNode;
  className?: string;
}) => {
  const prefersReducedMotion = useReducedMotion();
  const shouldAnimate = !prefersReducedMotion;

  return (
    <motion.div
      className={className}
      variants={shouldAnimate ? staggerContainer : { hidden: { opacity: 1 }, visible: { opacity: 1 } }}
      initial={shouldAnimate ? "hidden" : "visible"}
      animate="visible"
    >
      {children}
    </motion.div>
  );
};

// Composant pour les micro-interactions
export const HoverScale = ({ 
  children, 
  scale = 1.05,
  duration = 0.2 
}: { 
  children: React.ReactNode;
  scale?: number;
  duration?: number;
}) => {
  const prefersReducedMotion = useReducedMotion();
  const finalScale = prefersReducedMotion ? 1 : scale;

  return (
    <motion.div
      whileHover={prefersReducedMotion ? undefined : { scale: finalScale }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.95 }}
      transition={{ duration: prefersReducedMotion ? 0 : duration }}
    >
      {children}
    </motion.div>
  );
};

// Composant pour les transitions de page
export const PageTransition = ({ children }: { children: React.ReactNode }) => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0 }}
      animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1 }}
      exit={prefersReducedMotion ? undefined : { opacity: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
    >
      {children}
    </motion.div>
  );
};

// Animation pour les modales
export const modalVariants: Variants = {
  hidden: { 
    opacity: 0,
    scale: 0.8,
    y: 20
  },
  visible: { 
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { 
      duration: 0.3,
      ease: "easeOut"
    }
  },
  exit: { 
    opacity: 0,
    scale: 0.8,
    y: 20,
    transition: { 
      duration: 0.2,
      ease: "easeIn"
    }
  }
};

// Animation pour les loaders
export const loaderVariants: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 1,
      repeat: Infinity,
      ease: "linear"
    }
  }
};

// Animation pour les apparitions au stagger pour les grilles
export const gridStaggerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

// Animation pour les apparitions au stagger pour les listes
export const listStaggerVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      staggerChildren: 0.1
    }
  }
};
