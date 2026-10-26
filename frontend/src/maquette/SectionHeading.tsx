import { Link } from 'react-router-dom';

interface SectionHeadingProps {
  icon: string;
  title: string;
  subtitle: string;
  linkLabel?: string;
  to?: string;
}

export default function SectionHeading({
  icon,
  title,
  subtitle,
  linkLabel,
  to,
}: SectionHeadingProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <span className="text-orange-500">
            <i className={icon}></i>
          </span>
          {title}
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">{subtitle}</p>
      </div>
      {linkLabel && to && (
        <Link
          className="text-xs sm:text-sm font-bold text-slate-800 hover:text-[#FF5E1E] flex items-center gap-1 group"
          to={to}
        >
          <span>{linkLabel}</span>
          <i className="fa-solid fa-arrow-right text-xs group-hover:translate-x-0.5 transition"></i>
        </Link>
      )}
    </div>
  );
}
