import { describe, it, expect } from 'vitest';
import { ADMINS, isAdmin } from './admins.js';

describe('isAdmin', () => {
  it('ADMINS est un tableau non vide de chaînes', () => {
    expect(Array.isArray(ADMINS)).toBe(true);
    expect(ADMINS.length).toBeGreaterThan(0);
    for (const login of ADMINS) {
      expect(typeof login).toBe('string');
    }
  });

  it('chaque login de ADMINS renvoie true', () => {
    for (const login of ADMINS) {
      expect(isAdmin(login)).toBe(true);
    }
  });

  it('les mêmes logins en MAJUSCULES renvoient true (insensible à la casse)', () => {
    for (const login of ADMINS) {
      expect(isAdmin(login.toUpperCase())).toBe(true);
    }
  });

  it('les mêmes logins en CasseMixte renvoient true (insensible à la casse)', () => {
    for (const login of ADMINS) {
      const mixed = login
        .split('')
        .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c.toLowerCase()))
        .join('');
      expect(isAdmin(mixed)).toBe(true);
    }
  });

  it("un login non-admin renvoie false ('randomuser')", () => {
    expect(isAdmin('randomuser')).toBe(false);
  });

  it('une chaîne vide renvoie false', () => {
    expect(isAdmin('')).toBe(false);
  });

  // ── SÉCURITÉ : garde-fous contre l'usurpation d'admin (spoofing) ──
  it('SÉCURITÉ: un login avec espace en suffixe ne doit pas usurper un admin', () => {
    expect(isAdmin('abidaux ')).toBe(false);
  });

  it('SÉCURITÉ: un login avec saut de ligne ne doit pas usurper un admin', () => {
    expect(isAdmin('abidaux\n')).toBe(false);
  });

  it('SÉCURITÉ: un login avec espace en préfixe ne doit pas usurper un admin', () => {
    expect(isAdmin(' abidaux')).toBe(false);
  });

  it('SÉCURITÉ: un caractère ajouté ne doit pas usurper un admin (abidauxx)', () => {
    expect(isAdmin('abidauxx')).toBe(false);
  });

  it('SÉCURITÉ: un caractère retiré ne doit pas usurper un admin (abidau)', () => {
    expect(isAdmin('abidau')).toBe(false);
  });

  it("SÉCURITÉ: 'admin' littéral n'est pas un admin", () => {
    expect(isAdmin('admin')).toBe(false);
  });

  it('SÉCURITÉ: des caractères sosies (lookalike) ne doivent pas usurper un admin', () => {
    // Cyrillique 'а' (U+0430) au lieu du 'a' latin dans 'abidaux'
    expect(isAdmin('аbidaux')).toBe(false);
    // Chiffre '0' à la place du 'o' dans 'throbert'
    expect(isAdmin('thr0bert')).toBe(false);
  });
});
