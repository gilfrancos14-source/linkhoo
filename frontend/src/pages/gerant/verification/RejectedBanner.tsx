import type { VerificationStatusResponse } from '../../../lib/api';

interface RejectedBannerProps {
  verificationStatus: VerificationStatusResponse | null;
}

export default function RejectedBanner({ verificationStatus }: RejectedBannerProps) {
  return (
    <section className="verify-cta verify-cta--danger">
      <div className="verify-cta__icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <line x1="15" y1="9" x2="9" y2="15"/>
          <line x1="9" y1="9" x2="15" y2="15"/>
        </svg>
      </div>
      <div className="verify-cta__text">
        <h3>Demande rejetée</h3>
        <p>{verificationStatus?.verification_rejection_reason || 'Les documents soumis n\'ont pas été acceptés.'}</p>
        <span className="verify-cta__meta">Vous pouvez téléverser de nouveaux documents ci-dessous.</span>
      </div>
    </section>
  );
}
