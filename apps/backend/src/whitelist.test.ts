import { describe, it, expect } from 'vitest';
import { WHITELIST, WHITELIST_DISABLED, isWhitelisted } from './whitelist.js';

// NB: WHITELIST_DISABLED vaut actuellement `false` (const), donc on teste la
// vraie logique d'appartenance. Si WHITELIST_DISABLED valait `true`, alors
// isWhitelisted renverrait true pour TOUS les logins (mode open beta).
describe('isWhitelisted', () => {
  it('WHITELIST est un tableau non vide de chaînes', () => {
    expect(Array.isArray(WHITELIST)).toBe(true);
    expect(WHITELIST.length).toBeGreaterThan(0);
    for (const login of WHITELIST) {
      expect(typeof login).toBe('string');
    }
  });

  it('WHITELIST_DISABLED est un booléen', () => {
    expect(typeof WHITELIST_DISABLED).toBe('boolean');
  });

  it('chaque login de WHITELIST renvoie true', () => {
    for (const login of WHITELIST) {
      expect(isWhitelisted(login)).toBe(true);
    }
  });

  it('les mêmes logins en MAJUSCULES renvoient true (insensible à la casse)', () => {
    for (const login of WHITELIST) {
      expect(isWhitelisted(login.toUpperCase())).toBe(true);
    }
  });

  it('un login non whitelisté renvoie false', () => {
    expect(isWhitelisted('randomuser')).toBe(false);
  });

  it('une chaîne vide renvoie false', () => {
    expect(isWhitelisted('')).toBe(false);
  });

  // ── SÉCURITÉ : garde-fous contre l'usurpation (spoofing) ──
  it('SÉCURITÉ: un login avec espace en suffixe ne passe pas la whitelist', () => {
    expect(isWhitelisted('throbert ')).toBe(false);
  });

  it('SÉCURITÉ: un login avec saut de ligne ne passe pas la whitelist', () => {
    expect(isWhitelisted('throbert\n')).toBe(false);
  });

  it('SÉCURITÉ: un caractère ajouté ne passe pas la whitelist (throbertt)', () => {
    expect(isWhitelisted('throbertt')).toBe(false);
  });

  it('SÉCURITÉ: un caractère retiré ne passe pas la whitelist (throber)', () => {
    expect(isWhitelisted('throber')).toBe(false);
  });

  it('SÉCURITÉ: des caractères sosies (lookalike) ne passent pas la whitelist', () => {
    // '0' à la place du 'o' dans 'throbert'
    expect(isWhitelisted('thr0bert')).toBe(false);
    // Cyrillique 'а' (U+0430) au lieu du 'a' latin dans 'abidaux'
    expect(isWhitelisted('аbidaux')).toBe(false);
  });
});
