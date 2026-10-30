import { Link } from 'react-router-dom';
import {
  Home, Calendar, MessageCircle, User as LucideUser,
  ChevronDown, Plus, Tag,
  List as LucideList, Shield, FileText, UserCheck, Crown, Box,
} from 'lucide-react';
import { useHomePath } from '../../hooks/useHomePath';

/**
 * Sidebar de navigation du gérant — version lucide-react.
 * Remplace tous les <svg><use href="#i-..." /></svg> par des composants lucide.
 */
export function ProfileSidebar({ active }: { active: string }) {
  const homePath = useHomePath();
  const gerantPath = `${homePath}/gerant`;
  const suiviPath = `${gerantPath}/verification/suivi`;

  return (
    <aside className="sticky top-0 hidden h-screen w-[250px] shrink-0 overflow-y-auto border-r border-[#EEF2F8] bg-[#FBFCFE] pb-8 lg:block">
      <div className="ml-[42px] mt-[15px] flex h-[35px] items-center">
        <Link to={gerantPath} className="flex h-[35px] items-center">
          <img src="/logo.jpg" alt="Linkhoo" width="759" height="373" className="h-[35px] w-auto" />
        </Link>
      </div>

      <nav className="mt-[26px] text-[#0F2150]">
        <Link
          to={gerantPath}
          className={`mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold ${active === 'aperçu' ? 'bg-[#FDEDE2] text-[#F26B1D]' : ''}`}
        >
          <Home size={18} />Aperçu
        </Link>

        <div className="mt-[11px]">
          <Link
            to={`${gerantPath}/chambres`}
            className={`mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold ${active === 'chambres' ? 'bg-[#FDEDE2] text-[#F26B1D]' : ''}`}
          >
            <Calendar size={18} />Chambres
            <ChevronDown size={13} className="ml-auto stroke-[2.2]" />
          </Link>
          <div className="mt-[5px]">
            <Link to={`${gerantPath}/chambres`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]">
              <LucideList size={14} className="text-[#6F82A6]" />Toutes les chambres
            </Link>
            <Link to={`${gerantPath}/chambres/ajouter`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]">
              <Plus size={14} className="text-[#6F82A6]" />Ajouter une chambre
            </Link>
            <a href="#" className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]">
              <Tag size={14} className="text-[#6F82A6]" />Catégories
            </a>
          </div>
        </div>

        <div className="mt-[18px]">
          <Link
            to={`${gerantPath}/reservations`}
            className={`mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold ${active === 'reservations' ? 'bg-[#FDEDE2] text-[#F26B1D]' : ''}`}
          >
            <Calendar size={18} />Réservations
            <span className="-mr-2.5 ml-auto grid h-4 w-4 place-items-center rounded-full bg-[#FFE4D2] text-[10px] font-bold text-[#F26B1D]">3</span>
          </Link>
          <div className="mt-[5px]">
            <Link to={`${gerantPath}/reservations/demandes`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]">
              <FileText size={14} className="text-[#6F82A6]" />Demandes
            </Link>
            <Link to={`${gerantPath}/reservations/calendrier`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]">
              <Calendar size={14} className="text-[#6F82A6]" />Calendrier
            </Link>
          </div>
        </div>

        <div className="mt-[18px]">
          <Link
            to={`${gerantPath}/messages/boite-reception`}
            className={`mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold ${active === 'messages' ? 'bg-[#FDEDE2] text-[#F26B1D]' : ''}`}
          >
            <MessageCircle size={18} />Messages
            <span className="-mr-2.5 ml-auto grid h-4 w-4 place-items-center rounded-full bg-[#FFE4D2] text-[10px] font-bold text-[#F26B1D]">2</span>
          </Link>
          <div className="mt-[5px]">
            <Link to={`${gerantPath}/messages/boite-reception`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]">
              <Box size={14} className="text-[#6F82A6]" />Boîte de réception
            </Link>
            <Link to={`${gerantPath}/messages/boite-reception`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]">
              <MessageCircle size={14} className="text-[#6F82A6]" />Nouveau message
            </Link>
          </div>
        </div>

        <div className="mt-[18px]">
          <Link
            to={`${gerantPath}/verification`}
            className={`mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold ${active === 'verification' ? 'bg-[#FDEDE2] text-[#F26B1D]' : ''}`}
          >
            <Shield size={18} />Vérification
            <ChevronDown size={13} className="ml-auto stroke-[2.2]" />
          </Link>
          <div className="mt-[5px]">
            <Link to={`${gerantPath}/verification`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]">
              <FileText size={14} className="text-[#6F82A6]" />Mes documents
            </Link>
            <Link to={suiviPath} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]">
              <UserCheck size={14} className="text-[#6F82A6]" />Suivi de vérification
            </Link>
          </div>
        </div>

        <div className="mt-[18px]">
          <Link
            to={`${gerantPath}/profil`}
            className={`mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold ${active === 'profil' ? 'bg-[#FDEDE2] text-[#F26B1D]' : ''}`}
          >
            <LucideUser size={18} />Profil
          </Link>
          <div className="mt-[5px]">
            <Link
              to={`${gerantPath}/profil`}
              aria-current="page"
              className="mx-[19px] flex h-7 items-center gap-[13px] rounded-lg bg-[#FDEDE2] pl-[25px] text-[11.5px] font-medium text-[#F26B1D]"
            >
              <LucideUser size={14} className="text-[#F26B1D]" />Mes informations
            </Link>
          </div>
        </div>

        <div className="mt-[18px]">
          <Link to={`${gerantPath}/premium`} className="mx-[19px] flex h-[28px] items-center gap-[13px] rounded-lg px-[11px] text-[12.5px] font-bold">
            <Crown size={18} className="fill-[#F26B1D] text-[#F26B1D]" />Premium
          </Link>
          <div className="mt-[5px]">
            <Link to={`${gerantPath}/premium`} className="mx-[19px] flex h-6 items-center gap-[13px] pl-[25px] text-[11.5px] font-medium text-[#5F7396]">
              <Calendar size={14} className="text-[#6F82A6]" />Mon abonnement
            </Link>
          </div>
        </div>
      </nav>

      <div className="ml-[19px] mr-[16px] mt-[41px] h-[118px] rounded-xl border border-[#FEE3D1] bg-[#FFF2EA] px-[17px] pt-[14px]">
        <div className="flex items-center gap-[11px]">
          <Crown size={20} className="fill-[#F26B1D] text-[#F26B1D]" />
          <p className="text-[11.5px] font-bold">Passez au Premium</p>
        </div>
        <p className="mt-[9px] text-[10px] leading-4 text-[#5F7396]">Plus de visibilité, plus de réservations !</p>
        <Link
          to={`${gerantPath}/premium`}
          className="mt-[11px] flex h-[28px] items-center justify-center rounded-lg bg-[#F26B1D] text-[11px] font-bold text-white shadow-sm transition hover:bg-[#E05A0C]"
        >
          Voir les avantages
        </Link>
      </div>
    </aside>
  );
}
