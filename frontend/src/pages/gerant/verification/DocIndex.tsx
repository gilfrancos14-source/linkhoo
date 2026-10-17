export default function DocIndex({ index }: { index: number }) {
  return <span className="verif-doc__num">{String(index).padStart(2, '0')}</span>;
}
