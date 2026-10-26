import SectionHeading from './SectionHeading';
import type { ReviewCard } from './viewModel';

interface ReviewsSectionProps {
  reviews: ReviewCard[];
}

export default function ReviewsSection({ reviews }: ReviewsSectionProps) {
  if (reviews.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8" data-purpose="testimonials">
      <SectionHeading
        icon="fa-solid fa-star"
        title="Avis"
        subtitle="Ce que nos voyageurs disent de leur expérience."
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {reviews.map((review) => (
          <article
            key={review.id}
            className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-start gap-4"
          >
            <div className="w-11 h-11 rounded-full bg-[#0E1A2D] text-white font-bold text-sm flex items-center justify-center flex-shrink-0">
              {review.initials}
            </div>
            <div className="flex-1">
              <div className="flex items-center text-amber-400 text-xs gap-1 mb-1.5">
                {Array.from({ length: review.rating }).map((_, index) => (
                  <i key={index} className="fa-solid fa-star"></i>
                ))}
              </div>
              <p className="text-xs text-slate-600 italic">"{review.comment}"</p>
              <div className="mt-3">
                <h5 className="text-xs font-bold text-slate-900 leading-none">{review.name}</h5>
                {review.city && (
                  <span className="text-[10px] text-slate-400">Séjour à {review.city}</span>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
