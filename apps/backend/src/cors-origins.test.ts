import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAllowedWebOrigins, isTrusted42Origin } from './auth.js';

describe('getAllowedWebOrigins', () => {
  let saved: string | undefined;

  beforeEach(() => {
    saved = process.env.WEB_APP_URLS;
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env.WEB_APP_URLS;
    } else {
      process.env.WEB_APP_URLS = saved;
    }
  });

  it('valeur par défaut quand WEB_APP_URLS est absent', () => {
    delete process.env.WEB_APP_URLS;
    expect(getAllowedWebOrigins()).toEqual(['http://localhost:5173']);
  });

  it('une seule URL', () => {
    process.env.WEB_APP_URLS = 'https://app.example.com';
    expect(getAllowedWebOrigins()).toEqual(['https://app.example.com']);
  });

  it('plusieurs URLs séparées par des virgules', () => {
    process.env.WEB_APP_URLS = 'https://a.example.com,https://b.example.com';
    expect(getAllowedWebOrigins()).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });

  it('les slashs de fin sont retirés', () => {
    process.env.WEB_APP_URLS = 'https://a.example.com/,https://b.example.com/';
    expect(getAllowedWebOrigins()).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });

  it('les espaces autour des entrées sont supprimés (trim)', () => {
    process.env.WEB_APP_URLS = '  https://a.example.com ,  https://b.example.com  ';
    expect(getAllowedWebOrigins()).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });

  it('les entrées vides (virgule en trop) sont filtrées', () => {
    process.env.WEB_APP_URLS = 'https://a.example.com,,https://b.example.com,';
    expect(getAllowedWebOrigins()).toEqual([
      'https://a.example.com',
      'https://b.example.com',
    ]);
  });

  it('une chaîne vide renvoie un tableau vide', () => {
    // Nuance : le code utilise `process.env.WEB_APP_URLS ?? défaut`.
    // '' n'est PAS null/undefined, donc `??` ne s'applique PAS : on garde ''.
    // ''.split(',') => [''] puis .filter(Boolean) => [].
    // Le défaut localhost n'est donc utilisé que si la variable est absente.
    process.env.WEB_APP_URLS = '';
    expect(getAllowedWebOrigins()).toEqual([]);
  });
});

describe('isTrusted42Origin', () => {
  it('accepte le domaine intra exact en HTTPS', () => {
    expect(isTrusted42Origin('https://intra.42.fr')).toBe(true);
  });

  it('accepte les sous-domaines de l\'intra en HTTPS', () => {
    expect(isTrusted42Origin('https://profile.intra.42.fr')).toBe(true);
    expect(isTrusted42Origin('https://meta.intra.42.fr')).toBe(true);
  });

  it('REJETTE les tentatives de bypass par sous-chaîne', () => {
    // Le piège classique d'un `includes('intra.42.fr')`.
    expect(isTrusted42Origin('https://intra.42.fr.evil.com')).toBe(false);
    expect(isTrusted42Origin('https://evilintra.42.fr')).toBe(false);
    expect(isTrusted42Origin('https://intra.42.fr.attacker.io')).toBe(false);
    expect(isTrusted42Origin('https://notintra.42.fr')).toBe(false);
  });

  it('REJETTE le HTTP non sécurisé', () => {
    expect(isTrusted42Origin('http://intra.42.fr')).toBe(false);
  });

  it('REJETTE les valeurs vides ou malformées', () => {
    expect(isTrusted42Origin(undefined)).toBe(false);
    expect(isTrusted42Origin(null)).toBe(false);
    expect(isTrusted42Origin('')).toBe(false);
    expect(isTrusted42Origin('pas-une-url')).toBe(false);
  });
});
