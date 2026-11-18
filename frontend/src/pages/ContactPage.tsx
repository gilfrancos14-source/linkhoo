import ContactCta from '../components/contact/ContactCta';
import ContactDetails from '../components/contact/ContactDetails';
import ContactFaq from '../components/contact/ContactFaq';
import ContactFooter from '../components/contact/ContactFooter';
import ContactFormPWA from '../components/contact/ContactFormPWA';
import ContactHeader from '../components/contact/ContactHeader';
import ContactHero from '../components/contact/ContactHero';
import ContactLocation from '../components/contact/ContactLocation';
import ContactTopBar from '../components/contact/ContactTopBar';
import LandingBackToTop from '../components/landing/LandingBackToTop';
import { AnimatedSection } from '../lib/animations';
import '../styles/30-page-contact.css';

export default function ContactPage() {
  return (
    <div className="landing contact-page">
      <ContactTopBar />
      <ContactHeader />

      <main>
        <AnimatedSection>
          <ContactHero />
        </AnimatedSection>

        <section className="ct-contact">
          <div className="ct-contact__inner">
            <AnimatedSection>
              <ContactFormPWA />
            </AnimatedSection>
            <AnimatedSection>
              <ContactDetails />
            </AnimatedSection>
          </div>
        </section>

        <section className="ct-info">
          <div className="ct-info__inner">
            <AnimatedSection>
              <ContactLocation />
            </AnimatedSection>
            <AnimatedSection>
              <ContactFaq />
            </AnimatedSection>
          </div>
        </section>

        <AnimatedSection>
          <ContactCta />
        </AnimatedSection>
      </main>

      <ContactFooter />
      <LandingBackToTop />
    </div>
  );
}
