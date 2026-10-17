/** Formate une plage de séjour (ex. « 01 mars → 04 mars 2026 »). */
export function formatStayDates(from: string, to: string): string {
  const parse = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    return y && m && d ? new Date(y, m - 1, d) : null;
  };
  const d1 = parse(from);
  const d2 = parse(to);
  if (!d1 || !d2) return `${from} → ${to}`;
  const sameYear = d1.getFullYear() === d2.getFullYear();
  const a = d1.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
  const b = d2.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${a} → ${b}`;
}
