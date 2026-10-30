import { Link } from 'react-router-dom';
import { Crown, ArrowRight } from 'lucide-react';
import { useHomePath } from '../../hooks/useHomePath';

interface PremiumCardProps {
  premium: boolean;
}

/**
 * Carte d'upsell Premium (colonne droite).
 */
export function PremiumCard({ premium }: PremiumCardProps) {
  const homePath = useHomePath();
  const gerantPath = `${homePath}/gerant`;

  return (
    <div className="mt-[5px] rounded-xl border border-[#EEF2F8] bg-white p-[11px] pb-3 shadow-[0_2px_10px_rgba(20,40,90,0.04)]">
      <section className="h-[223px] rounded-xl border border-[#DDE6F4] bg-[#EFF4FB] px-[19px] pt-4">
        <div className="flex items-start gap-4 pl-px">
          <Crown size={24} className="mt-[1px] fill-[#F26B1D] stroke-[1.75] text-[#F26B1D]" />
          <div>
            <h3 className="text-[14px] font-bold leading-5">
              {premium ? 'Votre abonnement Premium' : 'Passez au Premium'}
            </h3>
            <p className="mt-1 text-[11.5px] leading-[18px] text-[#5F7396]">
              Augmentez la visibilité de vos annonces et<br />attirez plus de voyageurs !
            </p>
          </div>
        </div>
        <ul className="ml-[41px] mt-[10px] text-[10px] text-[#3D4F73]">
          {['Plus de visibilité sur la plateforme', 'Mise en avant de vos annonces', 'Statistiques avancées'].map((item) => (
            <li key={item} className="flex h-6 items-center gap-[10px]">
              <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="#27B585" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              {item}
            </li>
          ))}
        </ul>
        <Link
          to={`${gerantPath}/premium`}
          className="mt-[14px] flex h-8 w-full items-center justify-center gap-2 rounded-md bg-[#F26B1D] text-[11px] font-bold text-white shadow-[0_4px_10px_rgba(242,107,29,0.25)] transition hover:bg-[#E05A0C]"
        >
          Découvrir les avantages
          <ArrowRight size={11} className="stroke-white stroke-[2.6]" />
        </Link>
      </section>

      <section className="mt-[27px] h-[135px] rounded-xl border border-[#DDE6F4] bg-[#EFF4FB] pl-[19px] pt-[14px]">
        <div className="flex items-start gap-[17px]">
          <svg className="ic mt-[2px] h-5 w-5 shrink-0 stroke-[1.75] text-[#2F5FC4]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 1.9v.2h5.2v-.2c0-.7.3-1.4.9-1.9A6 6 0 0 0 12 3z" />
          </svg>
          <div>
            <h3 className="text-[11.5px] font-bold leading-4">Besoin d&apos;aide ?</h3>
            <p className="mt-[3px] whitespace-nowrap text-[11px] leading-[19px] text-[#5F7396]">
              Notre équipe est disponible pour vous accompagner<br />dans la gestion de votre compte.
            </p>
          </div>
        </div>
        <Link
          to="/contact"
          className="ml-[37px] mt-[14px] flex h-[33px] w-[181px] items-center rounded-md border border-[#E4EAF4] bg-white pl-[21px] text-[11px] font-bold text-[#2447A5] shadow-sm transition hover:bg-[#F7F9FD]"
        >
          <svg className="ic h-4 w-4 stroke-[1.75]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3" />
          </svg>
          <span className="ml-[14px]">Contacter le support</span>
        </Link>
      </section>
    </div>
  );
}
