export function scrollToAccueil() {
  const el = document.getElementById('accueil');
  if (el) el.scrollIntoView({ behavior: 'smooth' });
}
