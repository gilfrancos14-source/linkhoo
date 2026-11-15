import LandingBackToTop from '../components/landing/LandingBackToTop';
import AboutCta from '../components/a-propos/AboutCta';
import AboutFooter from '../components/a-propos/AboutFooter';
import AboutHeader from '../components/a-propos/AboutHeader';
import AboutHero from '../components/a-propos/AboutHero';
import AboutPillars from '../components/a-propos/AboutPillars';
import AboutStats from '../components/a-propos/AboutStats';
import AboutTeam from '../components/a-propos/AboutTeam';
import AboutTopBar from '../components/a-propos/AboutTopBar';
import AboutWhy from '../components/a-propos/AboutWhy';
import { AnimatedSection } from '../lib/animations';
import '../styles/29-page-a-propos.css';

export default function AProposPage() {
  return (
    <div className="landing about-page">
      <AboutTopBar />
      <AboutHeader />
      <main>
        <AnimatedSection>
          <AboutHero />
        </AnimatedSection>
        <AnimatedSection>
          <AboutPillars />
        </AnimatedSection>
        <AnimatedSection>
          <AboutStats />
        </AnimatedSection>
        <AnimatedSection>
          <AboutWhy />
        </AnimatedSection>
        <AnimatedSection>
          <AboutTeam />
        </AnimatedSection>
        <AnimatedSection>
          <AboutCta />
        </AnimatedSection>
      </main>
      <AboutFooter />
      <LandingBackToTop />
    </div>
  );
}
