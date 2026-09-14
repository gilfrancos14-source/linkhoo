import { useState, useEffect, useRef } from 'react';
import { useMarket } from '../../contexts/MarketContext';
import {
  fetchBannersBySection,
  fetchAllBannersByMarket,
  addBanner,
  updateBanner,
  deleteBanner,
  type Banner,
  type BannerSection,
} from '../../data/banners';

const SECTION_LABELS: Record<BannerSection, string> = {
  popular: 'Les plus loués',
  promos: 'Offres promotionnelles',
  categories: 'Catégories',
  events: 'Événements',
};

const SECTIONS: BannerSection[] = ['popular', 'promos', 'categories', 'events'];

export default function BannieresPage() {
  const { market } = useMarket();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSection, setActiveSection] = useState<BannerSection>('popular');
  const [banners, setBanners] = useState<Banner[]>([]);
  const [allBanners, setAllBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formImg, setFormImg] = useState('');
  const [formAlt, setFormAlt] = useState('');
  const [formLink, setFormLink] = useState('');
  const [formOrder, setFormOrder] = useState(0);

  const loadData = async () => {
    const [sectionBanners, all] = await Promise.all([
      fetchBannersBySection(market, activeSection),
      fetchAllBannersByMarket(market),
    ]);
    setBanners(sectionBanners);
    setAllBanners(all);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [market, activeSection]);

  const startAdd = () => {
    setEditingId(null);
    setFormImg('');
    setFormAlt('');
    setFormLink(`/${market.toLowerCase()}/recherche`);
    setFormOrder(banners.length);
  };

  const startEdit = (b: Banner) => {
    setEditingId(b.id);
    setFormImg(b.img);
    setFormAlt(b.alt);
    setFormLink(b.link);
    setFormOrder(b.order);
  };

  const handleSave = async () => {
    if (!formImg.trim()) return;
    if (editingId) {
      await updateBanner(editingId, { img: formImg, alt: formAlt, link: formLink, order: formOrder });
    } else {
      await addBanner({ section: activeSection, img: formImg, alt: formAlt, link: formLink, market, order: formOrder });
    }
    await loadData();
    startAdd();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Supprimer cette bannière ?')) {
      await deleteBanner(id);
      await loadData();
    }
  };

  const handlePhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('Image trop lourde (max 2 Mo)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFormImg(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const isEditing = editingId !== null;

  const getSectionCount = (section: BannerSection) =>
    allBanners.filter((b) => b.section === section).length;

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page__header">
          <h2>Gestion des bannières</h2>
        </div>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h2>Gestion des bannières</h2>
        <button className="admin-btn admin-btn--primary" onClick={startAdd}>
          + Ajouter
        </button>
      </div>

      {/* Section tabs */}
      <div className="admin-tabs">
        {SECTIONS.map((s) => (
          <button
            key={s}
            className={`admin-tab${activeSection === s ? ' admin-tab--active' : ''}`}
            onClick={() => { setActiveSection(s); setEditingId(null); }}
          >
            {SECTION_LABELS[s]}
            <span className="admin-tab__count">{getSectionCount(s)}</span>
          </button>
        ))}
      </div>

      {/* Form */}
      {(isEditing || formImg) && (
        <div className="admin-form-card">
          <h3>{isEditing ? 'Modifier la bannière' : 'Nouvelle bannière'}</h3>
          <div className="form-grid">
            <label className="admin-field">
              <span>Image *</span>
              <div className="admin-field__row">
                <input type="text" value={formImg} onChange={(e) => setFormImg(e.target.value)} placeholder="URL ou base64" />
                <button className="admin-btn admin-btn--sm" onClick={() => fileInputRef.current?.click()}>Upload</button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />
            </label>
            <label className="admin-field">
              <span>Texte alternatif</span>
              <input type="text" value={formAlt} onChange={(e) => setFormAlt(e.target.value)} placeholder="Description de l'image" />
            </label>
            <label className="admin-field">
              <span>Lien</span>
              <input type="text" value={formLink} onChange={(e) => setFormLink(e.target.value)} placeholder="/ci/recherche" />
            </label>
            <label className="admin-field">
              <span>Ordre</span>
              <input type="number" min={0} value={formOrder} onChange={(e) => setFormOrder(Number(e.target.value))} />
            </label>
          </div>
          {formImg && (
            <div className="admin-banner-preview">
              <img src={formImg} alt={formAlt} />
            </div>
          )}
          <div className="form-nav">
            <button className="admin-btn" onClick={startAdd}>Annuler</button>
            <div className="form-nav__spacer" />
            <button className="admin-btn admin-btn--primary" onClick={handleSave}>
              {isEditing ? 'Mettre à jour' : 'Ajouter'}
            </button>
          </div>
        </div>
      )}

      {/* Banner list */}
      <div className="admin-banner-grid">
        {banners.length === 0 && (
          <p className="admin-empty">Aucune bannière pour cette section.</p>
        )}
        {banners.map((b) => (
          <div key={b.id} className="admin-banner-card">
            <img src={b.img} alt={b.alt} className="admin-banner-card__img" />
            <div className="admin-banner-card__body">
              <span className="admin-banner-card__section">{SECTION_LABELS[b.section]}</span>
              <span className="admin-banner-card__order">Ordre: {b.order}</span>
            </div>
            <div className="admin-banner-card__actions">
              <button className="admin-btn admin-btn--sm" onClick={() => startEdit(b)}>Modifier</button>
              <button className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => handleDelete(b.id)}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
