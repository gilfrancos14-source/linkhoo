/** Écran de confirmation affiché après l'enregistrement d'un appartement. */
export default function AddRoomSuccess({
  title,
  onAddAnother,
  onBackToList,
}: {
  title: string;
  onAddAnother: () => void;
  onBackToList: () => void;
}) {
  return (
    <div className="form-success">
      <div className="form-success__icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#0F9D6B" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
      </div>
      <h2>Appartement enregistré !</h2>
      <p>{title} a été ajouté avec succès.</p>
      <div className="form-success__actions">
        <button className="admin-btn admin-btn--primary" onClick={onAddAnother}>
          Ajouter un autre
        </button>
        <button className="admin-btn" onClick={onBackToList}>
          Retour à la liste
        </button>
      </div>
    </div>
  );
}
