import { useEffect, useState } from 'react';
import { apiReviews, type FeaturedReviewData } from '../lib/api';
import { LANDING_TESTIMONIALS } from '../data/testimonials';

interface TestimonialEntry {
  id: string;
  prenom: string;
  nom: string;
  pays: string;
  titre: string;
  texte: string;
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1] : '';
  return (`${first.charAt(0)}${last.charAt(0)}`).toUpperCase() || '?';
}

function fromReview(review: FeaturedReviewData): TestimonialEntry {
  const nom = review.client_name;
  return {
    id: review.id,
    prenom: nom.split(/\s+/)[0] ?? nom,
    nom,
    pays: review.room?.title ? `Séjour — ${review.room.title}` : 'Avis client',
    titre: `Note : ${review.note_appartement} sur 5`,
    texte: review.commentaire,
  };
}

function toEntries(statics: typeof LANDING_TESTIMONIALS): TestimonialEntry[] {
  return statics.map((t) => ({ ...t }));
}

// Bloc « Nos utilisateurs en parlent » — structure CoinAfrique.
// On affiche les avis vedettes de l'API, avec repli sur les témoignages
// statiques quand l'API ne renvoie rien (le bloc ne disparaît jamais).
export default function LandingTestimonials() {
  const [entries, setEntries] = useState<TestimonialEntry[]>(() =>
    toEntries(LANDING_TESTIMONIALS),
  );

  useEffect(() => {
    let alive = true;
    apiReviews
      .featured()
      .then((reviews) => {
        if (!alive) return;
        if (Array.isArray(reviews) && reviews.length > 0) {
          setEntries(reviews.slice(0, 6).map(fromReview));
        }
      })
      .catch(() => {
        /* repli statique déjà en place */
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section className="landing-testimonials" id="avis">
      <div className="container">
        <div className="section-head reveal">
          <p className="eyebrow">Ils louent avec Linkhoo</p>
          <h2 className="section-title">Nos utilisateurs <em>en parlent</em></h2>
        </div>

        <ul className="landing-testimonials__grid" role="list">
          {entries.map((entry) => (
            <li key={entry.id} className="landing-testimonials__card reveal">
              <div className="landing-testimonials__head">
                <span className="landing-testimonials__avatar" aria-hidden="true">
                  {initialsOf(entry.nom)}
                </span>
                <span className="landing-testimonials__identity">
                  <strong className="landing-testimonials__prenom">{entry.prenom}</strong>
                  <span className="landing-testimonials__nom">{entry.nom}</span>
                  <span className="landing-testimonials__pays">{entry.pays}</span>
                </span>
              </div>
              <p className="landing-testimonials__titre">{entry.titre}</p>
              <p className="landing-testimonials__texte">{entry.texte}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
