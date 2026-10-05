import CountrySelector from '../components/CountrySelector';
import LandingHero from '../components/LandingHero';
import LandingSlider from '../components/LandingSlider';
import LandingTestimonials from '../components/LandingTestimonials';
import { useRevealOnScroll } from '../hooks/useRevealOnScroll';

// Page d'accueil racine — squelette repris de CoinAfrique :
// hero + recherche multicritères, choix du pays, carrousel, témoignages.
export default function LandingPage() {
  useRevealOnScroll();

  return (
    <main className="landing">
      <LandingHero />
      <CountrySelector />
      <LandingSlider />
      <LandingTestimonials />
    </main>
  );
}
