import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useMarket } from '../../contexts/MarketContext';
import { useHomePath } from '../../hooks/useHomePath';
import { fetchMyRooms, updateRoom, deleteRoom, toggleRoom, type Room } from '../../data/rooms';
import { fetchCategoriesByMarket, type Category } from '../../data/categories';

export default function ChambresPage() {
  const { market } = useMarket();
  const homePath = useHomePath();
  const gerantPath = `${homePath}/gerant`;

  const [rooms, setRooms] = useState<Room[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'true' | 'false'>('all');

  const loadData = async () => {
    try {
      const [r, c] = await Promise.all([
        fetchMyRooms(),
        fetchCategoriesByMarket(market),
      ]);
      setRooms(r);
      setCategories(c);
    } catch (err) {
      console.error('[ChambresPage] Erreur chargement:', err);
      setRooms([]);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [market]);

  const filtered = rooms.filter((r) => {
    const matchSearch = r.title.toLowerCase().includes(search.toLowerCase()) || r.ville.toLowerCase().includes(search.toLowerCase());
    const matchCat = !filterCat || r.category === filterCat;
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'true' && r.disponible) ||
      (filterStatus === 'false' && !r.disponible);
    return matchSearch && matchCat && matchStatus;
  });

  const handleDelete = async (id: string) => {
    if (confirm('Supprimer cette chambre ?')) {
      await deleteRoom(id);
      loadData();
    }
  };

  const toggleDispo = async (id: string) => {
    await toggleRoom(id);
    loadData();
  };

  const togglePopular = async (id: string, current: boolean) => {
    await updateRoom(id, { isPopular: !current });
    loadData();
  };

  const handleCategoryChange = async (roomId: string, categoryId: string) => {
    await updateRoom(roomId, { category: categoryId });
    loadData();
  };

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page__header">
          <h2>Gestion des chambres</h2>
        </div>
        <p>Chargement...</p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page__header">
        <h2>Gestion des chambres</h2>
        <Link to={`${gerantPath}/chambres/ajouter`} className="admin-btn admin-btn--primary">
          + Nouvelle chambre
        </Link>
      </div>

      <div className="admin-filters">
        <input
          type="text"
          placeholder="Rechercher..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="admin-input"
        />
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} className="admin-select">
          <option value="">Toutes catégories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)} className="admin-select">
          <option value="all">Tous statuts</option>
          <option value="true">Disponible</option>
          <option value="false">Occupée</option>
        </select>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Titre</th>
              <th>Ville</th>
              <th>Catégorie</th>
              <th>Prix</th>
              <th>Statut</th>
              <th>Populaire</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((room) => (
                <tr key={room.id}>
                  <td>
                    <img src={room.img} alt={room.alt} className="admin-table__img" />
                  </td>
                  <td className="admin-table__name">{room.title}</td>
                  <td>{room.ville}</td>
                  <td>
                    <select
                      className="admin-select admin-select--inline"
                      value={room.category}
                      onChange={(e) => handleCategoryChange(room.id, e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </td>
                  <td className="admin-table__price">
                    {room.price} FCFA <span className="admin-table__unit">{room.priceUnit}</span>
                  </td>
                  <td>
                    <button
                      className={`admin-badge admin-badge--clickable ${room.disponible ? 'admin-badge--success' : 'admin-badge--danger'}`}
                      onClick={() => toggleDispo(room.id)}
                    >
                      {room.disponible ? 'Disponible' : 'Occupée'}
                    </button>
                  </td>
                  <td>
                    <button
                      className={`admin-badge admin-badge--clickable ${room.isPopular ? 'admin-badge--info' : ''}`}
                      onClick={() => togglePopular(room.id, room.isPopular ?? false)}
                    >
                      {room.isPopular ? '★ Populaire' : '☆'}
                    </button>
                  </td>
                  <td>
                    <div className="admin-table__actions">
                      <button className="admin-btn admin-btn--sm admin-btn--danger" onClick={() => handleDelete(room.id)}>
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="admin-table__empty">Aucune chambre trouvée</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
