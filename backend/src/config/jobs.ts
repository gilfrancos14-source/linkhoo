/**
 * Configuration des tâches planifiées (jobs)
 */

export interface JobConfig {
  name: string;
  interval: number; // en millisecondes
  handler: () => Promise<void>;
  enabled: boolean;
}

export const JOBS: JobConfig[] = [
  {
    name: 'expireUnpaidConfirmed',
    interval: 24 * 60 * 60 * 1000, // Toutes les 24 heures
    handler: async () => {
      const { expireUnpaidConfirmed } = await import('../jobs/expireUnpaidConfirmed');
      await expireUnpaidConfirmed();
    },
    enabled: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development',
  },
  {
    name: 'expireStalePending',
    interval: 6 * 60 * 60 * 1000, // Toutes les 6 heures
    handler: async () => {
      const { expireStalePending } = await import('../jobs/expireStalePending');
      await expireStalePending();
    },
    enabled: process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development',
  },
];

/**
 * Lance toutes les tâches planifiées activées
 */
export function startScheduledJobs(): () => void {
  const intervals: NodeJS.Timeout[] = [];
  
  JOBS.forEach(job => {
    if (job.enabled) {
      console.log(`[Jobs] Démarrage de la tâche planifiée: ${job.name} (toutes ${job.interval / 1000 / 60 / 60}h)`);
      
      // Exécution immédiate puis à intervalles réguliers
      intervals.push(setInterval(job.handler, job.interval));
      job.handler().catch(error => {
        console.error(`[Jobs] Erreur dans la tâche ${job.name}:`, error);
      });
    }
  });
  
  // Retourne une fonction pour arrêter toutes les tâches
  return () => {
    intervals.forEach(clearInterval);
    console.log('[Jobs] Toutes les tâches planifiées ont été arrêtées');
  };
}