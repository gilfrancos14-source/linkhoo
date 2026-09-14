import { useState } from 'react';
import { useMarket } from '../../contexts/MarketContext';
import { getCategoriesByMarket, addCategory, updateCategory, deleteCategory, type Category } from '../../data/categories';

export default function CategoriesPage() {
  const { market } = useMarket();
  const [cats, setCats] = useState<Category[]>(() => getCategoriesByMarket(market));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formImg, setFormImg] = useState('');
  const [formAlt, setFormAlt] = useState('');

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

  const handleSave = () => {
    if (!formTitle.trim()) return;
    if (editingId) {
      updateCategory(editingId, { title: formTitle, img: formImg, alt: formAlt });
    } else {
      addCategory({ title: formTitle, img: formImg, alt: formAlt, market });
    }
    setCats(getCategoriesByMarket(market));
    startAdd();
  };

  const handleDelete = (id: string) => {
    if (confirm('Supprimer cette catégorie ?')) {
      deleteCategory(id);
      setCats(getCategoriesByMarket(market));
    }
  };

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
