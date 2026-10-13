import { useCallback, useEffect, useState } from 'react';
import {
  apiAdmin,
  type AdminData,
  type AdminPermissionDef,
  type AdminPermissionKey,
  type AdminTeamMember,
} from '../../lib/adminApi';

function toggleKey(set: Set<AdminPermissionKey>, key: AdminPermissionKey): Set<AdminPermissionKey> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

/** Estimation visuelle de la robustesse d'un mot de passe (0 → 5). */
function pwStrength(pw: string) {
  if (!pw) return { score: 0, pct: 0, label: '', cls: '' };
  let s = 0;
  if (pw.length >= 6) s++;
  if (pw.length >= 10) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (s <= 2) return { score: s, pct: (s / 5) * 100, label: 'Faible', cls: 'weak' };
  if (s <= 3) return { score: s, pct: (s / 5) * 100, label: 'Correct', cls: 'fair' };
  return { score: s, pct: (s / 5) * 100, label: 'Robuste', cls: 'strong' };
}

export default function AdminEquipePage() {
  const [me, setMe] = useState<AdminData | null>(null);
  const [members, setMembers] = useState<AdminTeamMember[]>([]);
  const [catalog, setCatalog] = useState<AdminPermissionDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [accessDenied, setAccessDenied] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createNom, setCreateNom] = useState('');
  const [createPrenom, setCreatePrenom] = useState('');
  const [createPassword, setCreatePassword] = useState('');
  const [createPerms, setCreatePerms] = useState<Set<AdminPermissionKey>>(new Set());
  const [creating, setCreating] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<Set<AdminPermissionKey>>(new Set());
  const [editSuper, setEditSuper] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const [resetId, setResetId] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const labelOf = (key: AdminPermissionKey) =>
    catalog.find((p) => p.key === key)?.label ?? key;

  const pw = pwStrength(createPassword);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setAccessDenied(false);
    try {
      const [meData, team, perms] = await Promise.all([
        apiAdmin.getMe(),
        apiAdmin.listTeam(),
        apiAdmin.getPermissionCatalog(),
      ]);
      setMe(meData);
      setMembers(team);
      setCatalog(perms);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erreur lors du chargement';
      if (message.includes('Permission refusée')) setAccessDenied(true);
      else setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Fermeture du panneau de création par la touche Échap.
  useEffect(() => {
    if (!createOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setCreateOpen(false);
      setCreateEmail('');
      setCreateNom('');
      setCreatePrenom('');
      setCreatePassword('');
      setCreatePerms(new Set());
      setError('');
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [createOpen]);

  function closeCreatePanel() {
    setCreateOpen(false);
    setCreateEmail('');
    setCreateNom('');
    setCreatePrenom('');
    setCreatePassword('');
    setCreatePerms(new Set());
    setError('');
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (createPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setCreating(true);
    try {
      await apiAdmin.createTeamMember({
        email: createEmail.trim(),
        password: createPassword,
        nom: createNom.trim(),
        prenom: createPrenom.trim(),
        permissions: [...createPerms],
      });
      setSuccess(
        `Compte créé pour ${createEmail.trim()} — transmettez-lui le mot de passe hors plateforme.`,
      );
      setCreateOpen(false);
      setCreateEmail('');
      setCreateNom('');
      setCreatePrenom('');
      setCreatePassword('');
      setCreatePerms(new Set());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingId) return;
    setError('');
    setSuccess('');
    setSavingEdit(true);
    try {
      await apiAdmin.updateTeamMember(editingId, {
        permissions: [...editPerms],
        is_superadmin: editSuper,
      });
      setSuccess('Périmètre mis à jour');
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de la mise à jour");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetId) return;
    if (resetPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    setError('');
    setSuccess('');
    setResetting(true);
    try {
      await apiAdmin.updateTeamMember(resetId, { password: resetPassword });
      setSuccess('Mot de passe réinitialisé — transmettez-le hors plateforme.');
      setResetId(null);
      setResetPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la réinitialisation');
    } finally {
      setResetting(false);
    }
  };

  const handleDelete = async (member: AdminTeamMember) => {
    if (!window.confirm(`Supprimer le compte de ${member.email} ?`)) return;
    setError('');
    setSuccess('');
    try {
      await apiAdmin.deleteTeamMember(member.id);
      setSuccess('Compte supprimé');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la suppression');
    }
  };

  if (loading) {
    return (
      <div className="dash">
        <div className="dash-page-head">
          <h1>Équipe</h1>
          <p>Chargement des comptes administrateurs…</p>
        </div>
      </div>
    );
  }

  if (accessDenied) {
    return (
      <div className="dash">
        <div className="dash-page-head">
          <h1>Équipe</h1>
          <p>Gestion des comptes administrateurs</p>
        </div>
        <div className="panel" style={{ padding: '24px' }}>
          <div className="auth-error">
            La gestion de l&apos;équipe est réservée au superadministrateur.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dash">
      <div className="dash-page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1>Équipe</h1>
          <p>Créer et gérer les comptes administrateurs et leur périmètre</p>
        </div>
        {!createOpen && (
          <button
            className="admin-btn admin-btn--primary"
            onClick={() => setCreateOpen(true)}
          >
            Ajouter un administrateur
          </button>
        )}
      </div>

      {error && <div className="auth-error" style={{ marginBottom: '16px' }}>{error}</div>}
      {success && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #6ee7b7',
            color: '#065f46',
            padding: '0.6rem 0.8rem',
            borderRadius: '8px',
            fontSize: '0.82rem',
            marginBottom: '16px',
          }}
        >
          {success}
        </div>
      )}

      {/* Panneau coulissant de création (mêmes classes que les bannières / tâches). */}
      <div className={`banner-slide-panel ${createOpen ? 'banner-slide-panel--open' : ''}`}>
        {createOpen && <div className="banner-slide-panel__overlay" onClick={closeCreatePanel} />}
        {createOpen && (
        <div className="banner-slide-panel__content" role="dialog" aria-modal="true" aria-label="Nouvel administrateur">
          <div className="banner-slide-panel__header">
            <h2>Nouvel administrateur</h2>
            <button className="banner-slide-panel__close" onClick={closeCreatePanel} aria-label="Fermer">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>

          {/* Le formulaire englobe body + footer : le bouton submit reste dans le form. */}
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            <div className="banner-slide-panel__body">
              <label className="banner-field">
                <span>Email</span>
                <input
                  id="eq-email"
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  required
                  autoComplete="off"
                  placeholder="prenom.nom@ilehya.ci"
                  autoFocus
                />
              </label>

              <div className="eq-form-row">
                <label className="banner-field">
                  <span>Prénom</span>
                  <input
                    id="eq-prenom"
                    type="text"
                    value={createPrenom}
                    onChange={(e) => setCreatePrenom(e.target.value)}
                    required
                  />
                </label>
                <label className="banner-field">
                  <span>Nom</span>
                  <input
                    id="eq-nom"
                    type="text"
                    value={createNom}
                    onChange={(e) => setCreateNom(e.target.value)}
                    required
                  />
                </label>
              </div>

              <div>
                <label className="banner-field">
                  <span>Mot de passe provisoire</span>
                  <input
                    id="eq-password"
                    type="password"
                    value={createPassword}
                    onChange={(e) => setCreatePassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    placeholder="Minimum 6 caractères — à transmettre hors plateforme"
                  />
                </label>
                {createPassword && (
                  <div className={`pw-strength pw-strength--${pw.cls}`} style={{ marginTop: '6px' }}>
                    <span className="pw-strength__bar">
                      <span className="pw-strength__fill" style={{ width: `${pw.pct}%` }} />
                    </span>
                    {pw.label}
                  </div>
                )}
              </div>

              <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
                <legend style={{ fontSize: '12px', fontWeight: 600, color: 'var(--admin-ink)', marginBottom: '8px' }}>
                  Sections autorisées
                </legend>
                <div className="perm-grid">
                  {catalog.map((perm) => (
                    <label key={perm.key} className={`perm-chip ${createPerms.has(perm.key) ? 'perm-chip--on' : ''}`}>
                      <input
                        type="checkbox"
                        checked={createPerms.has(perm.key)}
                        onChange={() => setCreatePerms((prev) => toggleKey(prev, perm.key))}
                      />
                      <span className="perm-chip__text">
                        <strong>{perm.label}</strong>
                        <small>{perm.description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="banner-slide-panel__footer">
              <button className="admin-btn" onClick={closeCreatePanel} type="button">Annuler</button>
              <button className="admin-btn admin-btn--primary" type="submit" disabled={creating}>
                {creating ? 'Création…' : 'Créer le compte'}
              </button>
            </div>
          </form>
        </div>
        )}
      </div>

      {members.length === 0 && !error ? (
        <div className="panel" style={{ padding: '24px' }}>
          <p>Aucun compte administrateur.</p>
        </div>
      ) : (
        members.map((member) => {
          const isMe = member.id === me?.id;
          const isEditing = editingId === member.id;
          const isResetting = resetId === member.id;
          return (
            <div key={member.id} className="panel" style={{ padding: '20px 24px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <strong>{member.prenom} {member.nom}</strong>
                    {member.is_superadmin && (
                      <span className="admin-badge admin-badge--success">Superadmin</span>
                    )}
                    {isMe && <span className="admin-badge">Vous</span>}
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'var(--ink-soft)' }}>{member.email}</span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {member.is_superadmin ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>
                        Toutes les sections
                      </span>
                    ) : member.permissions.length === 0 ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--ink-soft)' }}>
                        Aucune section
                      </span>
                    ) : (
                      member.permissions.map((key) => (
                        <span
                          key={key}
                          style={{
                            fontSize: '0.72rem',
                            background: '#f1f5f9',
                            border: '1px solid #e2e8f0',
                            borderRadius: '999px',
                            padding: '2px 10px',
                          }}
                        >
                          {labelOf(key)}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    className="admin-btn admin-btn--sm"
                    onClick={() => {
                      setResetId(isResetting ? null : member.id);
                      setEditingId(null);
                      setResetPassword('');
                    }}
                  >
                    Mot de passe
                  </button>
                  <button
                    className="admin-btn admin-btn--sm"
                    onClick={() => {
                      setEditingId(isEditing ? null : member.id);
                      setResetId(null);
                      setEditPerms(new Set(member.permissions));
                      setEditSuper(member.is_superadmin);
                    }}
                  >
                    {isEditing ? 'Annuler' : 'Modifier'}
                  </button>
                  {!isMe && (
                    <button
                      className="admin-btn admin-btn--danger admin-btn--sm"
                      onClick={() => void handleDelete(member)}
                    >
                      Supprimer
                    </button>
                  )}
                </div>
              </div>

              {isEditing && (
                <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                  <label style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.85rem', marginBottom: '12px' }}>
                    <input
                      type="checkbox"
                      checked={editSuper}
                      onChange={(e) => setEditSuper(e.target.checked)}
                    />
                    <span>
                      <strong>Super administrateur</strong> — toutes les sections, gestion de l&apos;équipe
                    </span>
                  </label>
                  {!editSuper && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '8px', marginBottom: '12px' }}>
                      {catalog.map((perm) => (
                        <label key={perm.key} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.85rem' }}>
                          <input
                            type="checkbox"
                            checked={editPerms.has(perm.key)}
                            onChange={() => setEditPerms((prev) => toggleKey(prev, perm.key))}
                          />
                          {perm.label}
                        </label>
                      ))}
                    </div>
                  )}
                  <button
                    className="admin-btn admin-btn--primary admin-btn--sm"
                    onClick={() => void handleSaveEdit()}
                    disabled={savingEdit}
                  >
                    {savingEdit ? 'Enregistrement…' : 'Enregistrer le périmètre'}
                  </button>
                </div>
              )}

              {isResetting && (
                <div style={{ marginTop: '16px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <label className="auth-field" style={{ flex: '1 1 240px', margin: 0 }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                      Nouveau mot de passe
                    </span>
                    <input
                      type="password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      minLength={6}
                      autoComplete="new-password"
                      placeholder="Minimum 6 caractères"
                    />
                  </label>
                  <button
                    className="admin-btn admin-btn--primary admin-btn--sm"
                    onClick={() => void handleResetPassword()}
                    disabled={resetting}
                  >
                    {resetting ? 'Enregistrement…' : 'Réinitialiser'}
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
