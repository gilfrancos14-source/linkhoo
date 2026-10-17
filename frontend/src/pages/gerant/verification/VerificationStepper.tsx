import type { Step } from './docs';

interface VerificationStepperProps {
  step: Step;
}

export default function VerificationStepper({ step }: VerificationStepperProps) {
  return (
    <div className="steps verif-steps">
      <div className={`step ${step === 1 ? 'step--active' : step > 1 ? 'step--done' : ''}`}>
        <span className="step__num">{step > 1 ? '' : '1'}</span>
        <span className="step__label">Coordonnées</span>
      </div>
      <div className={`step ${step === 2 ? 'step--active' : step > 2 ? 'step--done' : ''}`}>
        <span className="step__num">{step > 2 ? '' : '2'}</span>
        <span className="step__label">Documents + adresse</span>
      </div>
      <div className={`step ${step === 3 ? 'step--active' : ''}`}>
        <span className="step__num">3</span>
        <span className="step__label">Envoi</span>
      </div>
    </div>
  );
}
