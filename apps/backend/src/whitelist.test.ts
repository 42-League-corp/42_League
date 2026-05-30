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

  // En open beta (WHITELIST_DISABLED = true), isWhitelisted renvoie true pour
  // TOUS les logins. Hors open beta, seuls les membres de la WHITELIST passent.
  // Ces assertions valent donc `WHITELIST_DISABLED` dans les deux modes.
  it('un login non whitelisté : bloqué seulement hors open beta', () => {
    expect(isWhitelisted('randomuser')).toBe(WHITELIST_DISABLED);
  });

  it('une chaîne vide : bloquée seulement hors open beta', () => {
    expect(isWhitelisted('')).toBe(WHITELIST_DISABLED);
  });

  // ── SÉCURITÉ : garde-fous contre l'usurpation (spoofing) hors open beta ──
  it('SÉCURITÉ: un login avec espace en suffixe ne passe pas (hors open beta)', () => {
    expect(isWhitelisted('throbert ')).toBe(WHITELIST_DISABLED);
  });

  it('SÉCURITÉ: un login avec saut de ligne ne passe pas (hors open beta)', () => {
    expect(isWhitelisted('throbert\n')).toBe(WHITELIST_DISABLED);
  });

  it('SÉCURITÉ: un caractère ajouté ne passe pas (throbertt, hors open beta)', () => {
    expect(isWhitelisted('throbertt')).toBe(WHITELIST_DISABLED);
  });

  it('SÉCURITÉ: un caractère retiré ne passe pas (throber, hors open beta)', () => {
    expect(isWhitelisted('throber')).toBe(WHITELIST_DISABLED);
  });

  it('SÉCURITÉ: des caractères sosies (lookalike) ne passent pas (hors open beta)', () => {
    // '0' à la place du 'o' dans 'throbert'
    expect(isWhitelisted('thr0bert')).toBe(WHITELIST_DISABLED);
    // Cyrillique 'а' (U+0430) au lieu du 'a' latin dans 'abidaux'
    expect(isWhitelisted('аbidaux')).toBe(WHITELIST_DISABLED);
  });
});
