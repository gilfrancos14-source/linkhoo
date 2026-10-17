/** Bandeau des 4 étapes du formulaire d'ajout d'appartement. */
export default function AddRoomStepper({ step }: { step: number }) {
  return (
    <div className="steps">
      <div className={`step ${step === 1 ? 'step--active' : ''} ${step > 1 ? 'step--done' : ''}`}>
        <span className="step__num">{step > 1 ? '' : '1'}</span>
        <span className="step__label">Identification</span>
      </div>
      <div className={`step ${step === 2 ? 'step--active' : ''} ${step > 2 ? 'step--done' : ''}`}>
        <span className="step__num">{step > 2 ? '' : '2'}</span>
        <span className="step__label">Détails</span>
      </div>
      <div className={`step ${step === 3 ? 'step--active' : ''} ${step > 3 ? 'step--done' : ''}`}>
        <span className="step__num">{step > 3 ? '' : '3'}</span>
        <span className="step__label">Photos</span>
      </div>
      <div className={`step ${step === 4 ? 'step--active' : ''}`}>
        <span className="step__num">4</span>
        <span className="step__label">Aperçu</span>
      </div>
    </div>
  );
}
