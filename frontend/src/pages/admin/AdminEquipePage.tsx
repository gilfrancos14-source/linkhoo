import { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Pencil,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import {
  apiAdmin,
  type AdminData,
  type AdminPermissionDef,
  type AdminPermissionKey,
  type AdminTeamMember,
} from '../../lib/adminApi';
import '../../styles/47-admin-equipe.css';

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

function initials(member: AdminTeamMember): string {
  const first = (member.prenom || member.email || '?').trim()[0] ?? '?';
  const last = (member.nom || '').trim()[0] ?? '';
  return (first + last).toUpperCase();
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
        <div className="panel eq-alert eq-alert--error">
          <AlertCircle size={17} aria-hidden="true" />
          <span>La gestion de l&apos;équipe est réservée au superadministrateur.</span>
        </div>
      </div>
    );
  }

  const superadminCount = members.filter((m) => m.is_superadmin).length;
  const usedPermissions = new Set(members.flatMap((m) => m.permissions)).size;

  return (
    <div className="dash eq-page">
      <div className="dash-page-head eq-page__head">
        <div className="eq-page__heading">
          <span className="eq-page__icon" aria-hidden="true"><Users size={22} strokeWidth={1.8} /></span>
          <div>
            <h1>Équipe</h1>
            <p>Créer et gérer les comptes administrateurs et leur périmètre</p>
          </div>
        </div>
        {!createOpen && (
          <button className="admin-btn admin-btn--primary eq-add-btn" onClick={() => setCreateOpen(true)}>
            <UserPlus size={16} aria-hidden="true" />
            Ajouter un administrateur
          </button>
        )}
      </div>

      <div className="eq-stats" aria-label="Aperçu de l'équipe">
        <div className="eq-stat">
          <span className="eq-stat__icon" aria-hidden="true"><Users size={18} /></span>
          <span className="eq-stat__body">
            <strong>{members.length}</strong>
            <small>Administrateurs</small>
          </span>
        </div>
        <div className="eq-stat">
          <span className="eq-stat__icon eq-stat__icon--accent" aria-hidden="true"><ShieldCheck size={18} /></span>
          <span className="eq-stat__body">
            <strong>{superadminCount}</strong>
            <small>Superadministrateurs</small>
          </span>
        </div>
        <div className="eq-stat">
          <span className="eq-stat__icon" aria-hidden="true"><KeyRound size={18} /></span>
          <span className="eq-stat__body">
            <strong>{usedPermissions}</strong>
            <small>Sections déléguées</small>
          </span>
        </div>
      </div>

      {error && (
        <div className="eq-alert eq-alert--error" role="alert">
          <AlertCircle size={17} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="eq-alert eq-alert--success" role="status">
          <CheckCircle2 size={17} aria-hidden="true" />
          <span>{success}</span>
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
          <form onSubmit={handleCreate} className="eq-create-form">
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

              <fieldset className="eq-fieldset">
                <legend>Sections autorisées</legend>
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
        <div className="panel eq-empty">
          <span className="eq-empty__icon" aria-hidden="true"><Users size={26} /></span>
          <p>Aucun compte administrateur.</p>
        </div>
      ) : (
        <div className="eq-members">
          {members.map((member) => {
            const isMe = member.id === me?.id;
            const isEditing = editingId === member.id;
            const isResetting = resetId === member.id;
            return (
              <div key={member.id} className="panel eq-member">
                <div className="eq-member__top">
                  <div className="eq-member__identity">
                    <span className="eq-member__avatar" aria-hidden="true">{initials(member)}</span>
                    <div className="eq-member__info">
                      <div className="eq-member__name">
                        <strong>{member.prenom} {member.nom}</strong>
                        {member.is_superadmin && (
                          <span className="admin-badge admin-badge--success">Superadmin</span>
                        )}
                        {isMe && <span className="admin-badge">Vous</span>}
                      </div>
                      <span className="eq-member__email">{member.email}</span>
                      <div className="eq-member__perms">
                        {member.is_superadmin ? (
                          <span className="eq-perm eq-perm--muted">Toutes les sections</span>
                        ) : member.permissions.length === 0 ? (
                          <span className="eq-perm eq-perm--muted">Aucune section</span>
                        ) : (
                          member.permissions.map((key) => (
                            <span key={key} className="eq-perm">{labelOf(key)}</span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="eq-member__actions">
                    <button
                      className="admin-btn admin-btn--sm"
                      onClick={() => {
                        setResetId(isResetting ? null : member.id);
                        setEditingId(null);
                        setResetPassword('');
                      }}
                    >
                      <KeyRound size={14} aria-hidden="true" />
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
                      <Pencil size={14} aria-hidden="true" />
                      {isEditing ? 'Annuler' : 'Modifier'}
                    </button>
                    {!isMe && (
                      <button
                        className="admin-btn admin-btn--danger admin-btn--sm"
                        onClick={() => void handleDelete(member)}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>

                {isEditing && (
                  <div className="eq-member__expand">
                    <label className="eq-super-check">
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
                      <div className="eq-edit-perms">
                        {catalog.map((perm) => (
                          <label key={perm.key} className="eq-edit-perm">
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
                  <div className="eq-member__expand eq-reset">
                    <label className="banner-field eq-reset__field">
                      <span>Nouveau mot de passe</span>
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
          })}
        </div>
      )}
    </div>
  );
}
