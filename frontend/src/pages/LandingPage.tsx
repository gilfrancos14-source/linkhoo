import CountrySelector from '../components/CountrySelector';
import LandingBoosts from '../components/LandingBoosts';
import LandingHero from '../components/LandingHero';
import LandingSlider from '../components/LandingSlider';
import LandingTestimonials from '../components/LandingTestimonials';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll';

// Page d'accueil racine — squelette repris de CoinAfrique :
// hero + recherche multicritères, choix du pays, annonces sponsorisées,
// carrousel, témoignages.
export default function LandingPage() {
  useRevealOnScroll();

  return (
    <main className="landing">
      <LandingHero />
      <CountrySelector />
      <LandingBoosts />
      <LandingSlider />
      <LandingTestimonials />
    </main>
  );
}
