import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useHomePath } from '../../hooks/useHomePath';

/**
 * Fil d'Ariane : lien retour + titre de page.
 */
export function ProfileBreadcrumb() {
  const homePath = useHomePath();
  const gerantPath = `${homePath}/gerant`;

  return (
    <div className="pt-[15px]">
      <Link to={gerantPath} className="ml-[6px] inline-flex h-5 items-center gap-[10px] text-[12.5px] font-bold">
        <ArrowLeft size={13} className="stroke-[2.4]" />Retour
      </Link>
      <h1 className="mt-1 text-[31px] font-extrabold leading-8 tracking-[-0.01em] text-[#0D2150]">Mes informations</h1>
      <p className="-mt-px text-[15px] leading-[18px] text-[#5F7396]">Gérez vos informations personnelles et professionnelles.</p>
    </div>
  );
}
