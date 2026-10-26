import { describe, expect, it } from 'vitest';
import type { VerificationStatusResponse } from '../../../lib/api';
import type { SuiviDocument } from './useSuiviVerification';
import {
  detailTones,
  documentBadge,
  documentsByType,
  formatMoment,
  headline,
  lastUpdate,
  overallBadge,
  stepTones,
  submittedCount,
  toVerificationStatus,
} from './suiviVerificationModel';

function makeDoc(
  document_type: SuiviDocument['document_type'],
  status: SuiviDocument['status'],
): SuiviDocument {
  return { id: `doc-${document_type}`, document_type, status, rejection_reason: null };
}

const SUBMITTED_AT = '2026-10-20T10:24:00.000Z';
const REVIEWED_AT = '2026-10-21T09:05:00.000Z';

function makeStatus(
  overrides: Partial<VerificationStatusResponse> = {},
): VerificationStatusResponse {
  return {
    verification_status: 'under_review',
    verification_rejection_reason: null,
    verification_submitted_at: SUBMITTED_AT,
    verification_reviewed_at: null,
    property_maps_url: null,
    property_lat: null,
    property_lng: null,
    documents: [],
    ...overrides,
  };
}

describe('toVerificationStatus', () => {
  it('accepte les statuts connus du backend', () => {
    expect(toVerificationStatus('approved')).toBe('approved');
    expect(toVerificationStatus('under_review')).toBe('under_review');
  });

  it('retombe sur « none » pour une valeur absente ou inattendue', () => {
    expect(toVerificationStatus(null)).toBe('none');
    expect(toVerificationStatus(undefined)).toBe('none');
    expect(toVerificationStatus('archived')).toBe('none');
  });
});

describe('overallBadge', () => {
  it('associe un libellé et une couleur à chaque statut', () => {
    expect(overallBadge('approved')).toEqual({ label: 'Validé', tone: 'done' });
    expect(overallBadge('rejected')).toEqual({ label: 'Refusé', tone: 'rejected' });
    expect(overallBadge('under_review')).toEqual({ label: 'En cours', tone: 'current' });
    expect(overallBadge('pending')).toEqual({ label: 'En attente', tone: 'current' });
    expect(overallBadge('none')).toEqual({ label: 'À compléter', tone: 'waiting' });
  });
});

describe('headline', () => {
  it('explique l’attente pendant l’examen', () => {
    expect(headline('under_review', null)).toMatchObject({
      title: "Votre dossier est en cours d'examen",
      actionLabel: null,
    });
    expect(headline('pending', null).title).toBe("Votre dossier est en cours d'examen");
  });

  it('expose le motif de refus et une action corrective', () => {
    const result = headline('rejected', 'La photo de vous est floue.');
    expect(result.title).toBe('Votre dossier a été refusé');
    expect(result.description).toBe('La photo de vous est floue.');
    expect(result.actionLabel).toBe('Corriger mon dossier');
  });

  it('utilise un message générique quand le motif de refus est vide', () => {
    expect(headline('rejected', '   ').description).toContain('ne sont pas conformes');
    expect(headline('rejected', null).description).toContain('ne sont pas conformes');
  });

  it('invite à compléter un dossier jamais soumis', () => {
    expect(headline('none', null)).toMatchObject({
      title: "Votre dossier n'est pas encore soumis",
      actionLabel: 'Compléter mon dossier',
    });
  });

  it('ne propose aucune action une fois validé', () => {
    expect(headline('approved', null)).toMatchObject({
      title: 'Votre compte est vérifié',
      actionLabel: null,
    });
  });
});

describe('stepTones', () => {
  it('garde toutes les étapes à venir quand rien n’est soumis', () => {
    expect(stepTones('none', null)).toEqual({
      submitted: 'upcoming',
      review: 'upcoming',
      final: 'upcoming',
      verified: 'upcoming',
    });
  });

  it('marque l’examen comme étape courante', () => {
    expect(stepTones('under_review', SUBMITTED_AT)).toEqual({
      submitted: 'done',
      review: 'current',
      final: 'upcoming',
      verified: 'upcoming',
    });
  });

  it('ne considère pas la soumission faite sans date de soumission', () => {
    expect(stepTones('pending', null).submitted).toBe('upcoming');
  });

  it('termine toutes les étapes une fois approuvé', () => {
    expect(stepTones('approved', SUBMITTED_AT)).toEqual({
      submitted: 'done',
      review: 'done',
      final: 'done',
      verified: 'done',
    });
  });

  it('signale le refus sans activer le compte', () => {
    expect(stepTones('rejected', SUBMITTED_AT)).toEqual({
      submitted: 'done',
      review: 'rejected',
      final: 'rejected',
      verified: 'upcoming',
    });
  });
});

describe('detailTones', () => {
  it('suit le même cycle que le bandeau', () => {
    expect(detailTones('under_review', SUBMITTED_AT)).toEqual({
      submitted: 'done',
      review: 'current',
      profile: 'upcoming',
      activation: 'upcoming',
    });
    expect(detailTones('approved', SUBMITTED_AT)).toEqual({
      submitted: 'done',
      review: 'done',
      profile: 'done',
      activation: 'done',
    });
    expect(detailTones('rejected', SUBMITTED_AT)).toEqual({
      submitted: 'done',
      review: 'rejected',
      profile: 'upcoming',
      activation: 'upcoming',
    });
  });
});

describe('documentBadge', () => {
  it('distingue un document absent, validé, refusé ou en cours', () => {
    expect(documentBadge(undefined, 'under_review')).toEqual({
      label: 'À ajouter',
      tone: 'waiting',
    });
    expect(documentBadge(makeDoc('national_id', 'approved'), 'under_review').label).toBe('Validé');
    expect(documentBadge(makeDoc('national_id', 'rejected'), 'under_review').label).toBe('Refusé');
    expect(documentBadge(makeDoc('national_id', 'pending'), 'under_review').label).toBe('En cours');
  });

  it('affiche « Ajouté » tant que le dossier n’est pas soumis', () => {
    expect(documentBadge(makeDoc('national_id', 'pending'), 'none')).toEqual({
      label: 'Ajouté',
      tone: 'waiting',
    });
  });
});

describe('documentsByType', () => {
  it('ne conserve qu’une version par type de document', () => {
    const map = documentsByType([
      makeDoc('national_id', 'pending'),
      makeDoc('national_id', 'approved'),
      makeDoc('selfie', 'pending'),
    ]);

    expect(map.size).toBe(2);
    expect(map.get('national_id')?.status).toBe('approved');
    expect(submittedCount([...map.values()])).toBe(2);
  });

  it('compte les types réellement déposés', () => {
    expect(submittedCount([])).toBe(0);
    expect(submittedCount([makeDoc('selfie', 'pending')])).toBe(1);
  });
});

describe('formatMoment / lastUpdate', () => {
  it('replie sur un libellé quand la date manque', () => {
    expect(formatMoment(null)).toBe('À venir');
    expect(formatMoment(undefined, '—')).toBe('—');
  });

  it('formate une date avec l’heure', () => {
    const formatted = formatMoment(SUBMITTED_AT);
    expect(formatted).toContain('•');
    expect(formatted).toContain('2026');
  });

  it('privilégie la date de revue, sinon la soumission', () => {
    expect(lastUpdate(makeStatus({ verification_reviewed_at: REVIEWED_AT }))).toBe(
      formatMoment(REVIEWED_AT),
    );
    expect(lastUpdate(makeStatus())).toBe(formatMoment(SUBMITTED_AT));
    expect(lastUpdate(null)).toBe('—');
    expect(lastUpdate(makeStatus({ verification_submitted_at: null }))).toBe('—');
  });
});
