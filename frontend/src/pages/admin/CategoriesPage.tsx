import { useState, useEffect } from 'react';
import { useMarket } from '../../contexts/MarketContext';
import { fetchCategoriesByMarket, addCategory, updateCategory, deleteCategory, type Category } from '../../data/categories';

export default function CategoriesPage() {
  const { market } = useMarket();
  const [cats, setCats] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formImg, setFormImg] = useState('');
  const [formAlt, setFormAlt] = useState('');

  const loadData = async () => {
    const data = await fetchCategoriesByMarket(market);
    setCats(data);
    setLoading(false);
  };

  useEffect(() => { loadData(); }, [market]);

  const startAdd = () => {
    setEditingId(null);
    setFormTitle('');
    setFormImg('');
    setFormAlt('');
  };

  const startEdit = (cat: Category) => {
    setEditingId(cat.id);
    setFormTitle(cat.title);
    setFormImg(cat.img);
    setFormAlt(cat.alt);
  };

  const handleSave = async () => {
    if (!formTitle.trim()) return;
    if (editingId) {
      await updateCategory(editingId, { title: formTitle, img: formImg, alt: formAlt });
    } else {
      await addCategory({ title: formTitle, img: formImg, alt: formAlt, market });
    }
    await loadData();
    startAdd();
  };

  const handleDelete = async (id: string) => {
    if (confirm('Supprimer cette catégorie ?')) {
      await deleteCategory(id);
      await loadData();
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page__header">
          <h2>Gestion des catégories</h2>
        </div>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h2>Gestion des catégories</h2>
        <button className="admin-btn admin-btn--primary" onClick={startAdd}>
          + Ajouter
        </button>
      </div>

      <div className="admin-categories-grid">
        {cats.map((cat) => (
          <div key={cat.id} className="admin-cat-card">
            <img src={cat.img} alt={cat.alt} className="admin-cat-card__img" />
            <div className="admin-cat-card__body">
              <input
                type="text"
                value={editingId === cat.id ? formTitle : cat.title}
                onChange={(e) => setFormTitle(e.target.value)}
                disabled={editingId !== cat.id}
                className="admin-cat-card__input"
              />
              {editingId === cat.id && (
                <div className="admin-cat-card__edit-fields">
                  <input type="text" placeholder="URL image" value={formImg} onChange={(e) => setFormImg(e.target.value)} />
                  <input type="text" placeholder="Alt" value={formAlt} onChange={(e) => setFormAlt(e.target.value)} />
                </div>
              )}
            </div>
            <div className="admin-cat-card__actions">
              {editingId === cat.id ? (
                <button className="admin-btn admin-btn--sm admin-btn--primary" onClick={handleSave}>Sauver</button>
              ) : (
                <button className="admin-btn admin-btn--sm" onClick={() => startEdit(cat)}>Modifier</button>
              )}
              <button className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => handleDelete(cat.id)}>Supprimer</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
