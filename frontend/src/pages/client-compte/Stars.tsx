/** Notation par étoiles, interactive (radio) ou en lecture seule. */
export default function Stars({ value, onChange, label }: {
  value: number;
  onChange?: (v: number) => void;
  label: string;
}) {
  return (
    <div className="star-rating" role={onChange ? 'radiogroup' : 'img'} aria-label={`${label} : ${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`star-rating__star${n <= value ? ' is-active' : ''}`}
          onClick={onChange ? () => onChange(n) : undefined}
          disabled={!onChange}
          aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
          tabIndex={onChange ? 0 : -1}
        >
          ★
        </button>
      ))}
    </div>
  );
}
