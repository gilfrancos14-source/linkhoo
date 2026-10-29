import ContactCta from '../components/contact/ContactCta';
import ContactDetails from '../components/contact/ContactDetails';
import ContactFaq from '../components/contact/ContactFaq';
import ContactFooter from '../components/contact/ContactFooter';
import ContactForm from '../components/contact/ContactForm';
import ContactHeader from '../components/contact/ContactHeader';
import ContactHero from '../components/contact/ContactHero';
import ContactLocation from '../components/contact/ContactLocation';
import ContactTopBar from '../components/contact/ContactTopBar';
import LandingBackToTop from '../components/landing/LandingBackToTop';
import '../styles/30-page-contact.css';

export default function ContactPage() {
  return (
    <div className="landing contact-page">
      <ContactTopBar />
      <ContactHeader />

      <main>
        <ContactHero />

        <section className="ct-contact">
          <div className="ct-contact__inner">
            <ContactForm />
            <ContactDetails />
          </div>
        </section>

        <section className="ct-info">
          <div className="ct-info__inner">
            <ContactLocation />
            <ContactFaq />
          </div>
        </section>

        <ContactCta />
      </main>

      <ContactFooter />
      <LandingBackToTop />
    </div>
  );
}
