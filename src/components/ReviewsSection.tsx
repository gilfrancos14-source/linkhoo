const reviews = [
  {
    stars: 5,
    quote: '« T3 loué en dix jours : visite le samedi, bail signé le mardi. Trois ans que nous y vivons et la moindre demande est traitée en 24h. »',
    author: 'Amélie B.',
    role: 'Locataire — T3, bail de 3 ans',
    initials: 'AB',
  },
  {
    stars: 5,
    quote: '« Voyage d\'affaires prolongé d\'une semaine — service impeccable, WiFi stable, ménage discret. L\'adresse idéale pour les longs séjours de travail. »',
    author: 'Mehdi K.',
    role: 'Voyageur — Suite Prestige, séjour d\'une semaine',
    initials: 'MK',
  },
  {
    stars: 5,
    quote: '« Je confie mon appartement à Ilehya depuis trois ans. Loyer versé chaque mois, locataire sérieux, et zéro gestion pour moi. »',
    author: 'Jean-Marc P.',
    role: 'Propriétaire — gestion complète',
    initials: 'JP',
  },
];

function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true">
      <path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4-4.8-2.5-4.8 2.5.9-5.4L4.2 7.7l5.4-.8z"/>
    </svg>
  );
}

export default function ReviewsSection() {
  return (
    <section className="reviews" id="avis">
      <div className="container">
        <div className="section-head reveal">
          <p className="eyebrow">Ils ont loué ou séjourné chez nous</p>
          <h2 className="section-title">Ce qu'ils <em>en disent</em></h2>
        </div>

        <div className="reviews__grid">
          {reviews.map((review, i) => (
            <figure key={i} className="review reveal">
              <div className="review__stars" aria-label={`Note : ${review.stars} étoiles sur 5`}>
                {Array.from({ length: review.stars }).map((_, j) => (
                  <StarIcon key={j} />
                ))}
              </div>
              <blockquote className="review__quote">{review.quote}</blockquote>
              <figcaption className="review__author">
                <span className="review__avatar" aria-hidden="true">{review.initials}</span>
                <span>
                  <strong>{review.author}</strong>
                  <small>{review.role}</small>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
