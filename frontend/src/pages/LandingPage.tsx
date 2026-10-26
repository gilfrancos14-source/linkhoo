import { useState } from 'react';
import LandingBackToTop from '../components/landing/LandingBackToTop';
import LandingCountries from '../components/landing/LandingCountries';
import LandingFooter from '../components/landing/LandingFooter';
import LandingHeader from '../components/landing/LandingHeader';
import LandingHero from '../components/landing/LandingHero';
import LandingReviews from '../components/landing/LandingReviews';
import LandingSlider from '../components/landing/LandingSlider';
import LandingTopBar from '../components/landing/LandingTopBar';
import { DEFAULT_COUNTRY, type Country } from '../components/landing/data';

export default function LandingPage() {
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY);

  const focusSearch = () => {
    const input = document.getElementById('acc-search-keyword');
    input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    input?.focus({ preventScroll: true });
  };

  const scrollToCountries = () => {
    document.getElementById('ou-louer')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="landing">
      <LandingTopBar />
      <LandingHeader
        country={country}
        onCountryClick={scrollToCountries}
        onSearchClick={focusSearch}
      />
      <main>
        <LandingHero country={country} onCountryChange={setCountry} />
        <LandingCountries country={country} onCountryChange={setCountry} />
        <LandingSlider />
        <LandingReviews />
      </main>
      <LandingFooter />
      <LandingBackToTop />
    </div>
  );
}
