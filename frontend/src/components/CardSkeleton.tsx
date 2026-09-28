interface CardSkeletonProps {
  count?: number;
}

/**
 * Carte fantôme affichée pendant le fetch d'une section de la home :
 * l'utilisateur voit immédiatement la structure de la grille au lieu
 * d'un bloc vide qui « pop » à la fin du chargement.
 */
export default function CardSkeleton({ count = 4 }: CardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card-skeleton" aria-hidden="true">
          <div className="card-skeleton__media" />
          <div className="card-skeleton__body">
            <span className="card-skeleton__line" style={{ width: '72%' }} />
            <span className="card-skeleton__line card-skeleton__line--sm" style={{ width: '46%' }} />
          </div>
        </div>
      ))}
    </>
  );
}
