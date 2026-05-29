import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAllowedWebOrigins } from './auth.js';

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
