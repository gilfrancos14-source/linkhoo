import Icon from '../landing/icons';

export default function ContactCta() {
  return (
    <section className="ct-cta">
      <div className="ct-cta__inner">
        <Icon name="house" size={110} className="ct-cta__decor ct-cta__decor--large" />
        <Icon name="house" size={80} className="ct-cta__decor ct-cta__decor--small" />

        <div className="ct-cta__body">
          <span className="ct-cta__icon">
            <Icon name="send" size={22} />
          </span>
          <div>
            <h2>Encore une question ?</h2>
            <p>Notre équipe est toujours disponible pour vous aider.</p>
          </div>
        </div>

        <a href="#contactForm" className="ct-cta__btn">
          Nous contacter
          <Icon name="arrowRight" size={14} />
        </a>
      </div>
    </section>
  );
}
