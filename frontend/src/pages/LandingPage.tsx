import { useState } from 'react';
import LandingBackToTop from '../components/landing/LandingBackToTop';
import LandingCountries from '../components/landing/LandingCountries';
import LandingFooter from '../components/landing/LandingFooter';
import LandingHeader from '../components/landing/LandingHeader';
import LandingHero from '../components/landing/LandingHero';
import LandingLocalRooms from '../components/landing/LandingLocalRooms';
import LandingReviews from '../components/landing/LandingReviews';
import LandingSlider from '../components/landing/LandingSlider';
import LandingTopBar from '../components/landing/LandingTopBar';
import type { Country } from '../components/landing/data';
import { useHostMarket } from '../hooks/useHostMarket';
import { AnimatedSection } from '../lib/animations.tsx';

export default function LandingPage() {
  // Aucun pays pré-sélectionné pour la recherche : le visiteur choisit
  // explicitement son marché depuis le hero, l'en-tête ou « Où louer ? ».
  const [country, setCountry] = useState<Country | null>(null);
  // En revanche, « Devenir hôte » part du marché détecté (IP du visiteur).
  const hostMarket = useHostMarket();

  return (
    <div className="landing">
      <LandingTopBar />
      <LandingHeader
        showActions={false}
        showSearch={false}
        showMenu
        hostLink={`/${hostMarket.toLowerCase()}/inscription/gerant`}
      />
      <main>
        <LandingHero country={country} onCountryChange={setCountry} />
        <AnimatedSection>
          <LandingCountries country={country} onCountryChange={setCountry} />
        </AnimatedSection>
        <AnimatedSection>
          <LandingLocalRooms />
        </AnimatedSection>
        <AnimatedSection>
          <LandingLocalRooms variant="neighbor" />
        </AnimatedSection>
        <AnimatedSection>
          <LandingLocalRooms variant="weekend" />
        </AnimatedSection>
        <AnimatedSection>
          <LandingSlider />
        </AnimatedSection>
        <AnimatedSection>
          <LandingReviews />
        </AnimatedSection>
      </main>
      <LandingFooter />
      <LandingBackToTop />
    </div>
  );
}
