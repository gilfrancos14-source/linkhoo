export function conditionIcon(condition: string): string {
  const text = condition.toLowerCase();
  if (text.includes('arriv')) return 'i-clock';
  if (text.includes('départ') || text.includes('depart')) return 'i-clock';
  if (text.includes('caution') || text.includes('garantie')) return 'i-shield';
  if (text.includes('fumeur')) return 'i-ban';
  if (text.includes('animaux') || text.includes('animal')) return 'i-paw';
  return 'i-list';
}

export function conditionLabel(condition: string): { label: string; value: string } {
  const index = condition.indexOf(':');
  if (index === -1) return { label: '', value: condition.trim() };
  return {
    label: condition.slice(0, index).trim(),
    value: condition.slice(index + 1).trim(),
  };
}
