import { type SVGProps } from 'react';

/**
 * Wrapper autour des icônes lucide-react pour conserver la taille
 * utilisée par les maquettes (h-4 w-4 par défaut, surchargeable via className).
 * Remplace <svg className="ic ..."><use href="#i-xxx" /></svg>.
 */
export function MaqIcon({ className = 'h-4 w-4 shrink-0', ...props }: SVGProps<SVGSVGElement> & { className?: string }) {
  return <svg className={`ic ${className}`} {...props} />;
}
