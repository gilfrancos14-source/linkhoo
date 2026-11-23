import { describe, expect, it } from 'vitest';
import { protectText, similarity } from './textProtection';

describe('protectText', () => {
  it('protège le montant, le téléphone et le glossaire', () => {
    const protectedText = protectText('Appartement à 250 000 FCFA — contact 0700000000 — Linkhoo');
    expect(protectedText.text).not.toContain('FCFA');
    expect(protectedText.text).not.toContain('250 000');
    expect(protectedText.text).toMatch(/ZTOK\d+Z/);

    const restored = protectedText.restore('Flat for ZTOK0Z — call ZTOK1Z — ZTOK2Z');
    expect(restored).toContain('250 000 FCFA');
    expect(restored).toContain('0700000000');
    expect(restored).toContain('Linkhoo');
  });

  it('protège les noms propres transmis depuis la fiche', () => {
    const protectedText = protectText('Studio à Cocody', ['Cocody']);
    expect(protectedText.text).not.toContain('Cocody');
    expect(protectedText.restore(protectedText.text)).toBe('Studio à Cocody');
  });

  it('applique le glossaire configurable', () => {
    const protectedText = protectText('À Abidjan, FCFA.', [], { 'FCFA': 'CFA franc' });
    expect(protectedText.text).not.toContain('FCFA');
    expect(protectedText.restore(protectedText.text)).toBe('À Abidjan, CFA franc.');
  });

  it('protège une URL', () => {
    const protectedText = protectText('Voir https://exemple.fr/photo.jpg pour details');
    expect(protectedText.text).not.toContain('https://');
    expect(protectedText.restore(protectedText.text)).toContain('https://exemple.fr/photo.jpg');
  });
});

describe('similarity', () => {
  it('mesure la ressemblance après aller-retour', () => {
    expect(similarity('studio cocody abidjan', 'studio cocody abidjan')).toBe(1);
    expect(similarity('studio cocody abidjan', 'villa marcory paris')).toBe(0);
  });
});
