import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// getCampusLocations garde un cache au niveau module : on recharge le module à
// chaque test (resetModules + import dynamique) pour repartir d'un cache vide.
const getAppToken = vi.fn();
let fetchMock: ReturnType<typeof vi.fn>;
let savedCampus: string | undefined;

async function loadModule() {
  vi.resetModules();
  vi.doMock('./ft-api.js', () => ({ getAppToken }));
  return import('./locations.js');
}

function okResponse(body: unknown) {
  return { ok: true, status: 200, json: async () => body };
}

beforeEach(() => {
  getAppToken.mockReset();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  savedCampus = process.env.FT_CAMPUS_ID;
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.doUnmock('./ft-api.js');
  if (savedCampus === undefined) delete process.env.FT_CAMPUS_ID;
  else process.env.FT_CAMPUS_ID = savedCampus;
});

describe('getCampusLocations', () => {
  it('retourne une map vide et n’appelle pas l’API sans token applicatif', async () => {
    getAppToken.mockResolvedValue(null);
    const { getCampusLocations } = await loadModule();
    const map = await getCampusLocations();
    expect(map.size).toBe(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('parse les locations et indexe login → host', async () => {
    getAppToken.mockResolvedValue('app-token');
    fetchMock.mockResolvedValue(
      okResponse([
        { user: { login: 'alice' }, host: 'e1r2p3' },
        { user: { login: 'bob' }, host: 'e1r2p4' },
      ]),
    );
    const { getCampusLocations } = await loadModule();
    const map = await getCampusLocations();
    expect(map.get('alice')).toBe('e1r2p3');
    expect(map.get('bob')).toBe('e1r2p4');
    expect(map.size).toBe(2);
  });

  it('ignore les entrées sans login ou sans host', async () => {
    getAppToken.mockResolvedValue('app-token');
    fetchMock.mockResolvedValue(
      okResponse([
        { user: { login: 'alice' }, host: 'e1r2p3' },
        { user: { login: 'nohost' }, host: '' },
        { user: {}, host: 'e1r2p9' },
        { host: 'e1r2p9' },
      ]),
    );
    const { getCampusLocations } = await loadModule();
    const map = await getCampusLocations();
    expect([...map.keys()]).toEqual(['alice']);
  });

  it('utilise FT_CAMPUS_ID dans l’URL (défaut "1")', async () => {
    getAppToken.mockResolvedValue('app-token');
    fetchMock.mockResolvedValue(okResponse([]));
    const { getCampusLocations } = await loadModule();
    await getCampusLocations();
    expect(fetchMock.mock.calls[0]![0]).toContain('/campus/1/locations');

    // Avec une valeur explicite, l'URL la reflète.
    process.env.FT_CAMPUS_ID = '42';
    const fresh = await loadModule();
    fetchMock.mockResolvedValue(okResponse([]));
    await fresh.getCampusLocations();
    expect(fetchMock.mock.calls.at(-1)![0]).toContain('/campus/42/locations');
  });

  it('envoie le token applicatif en Bearer', async () => {
    getAppToken.mockResolvedValue('app-token');
    fetchMock.mockResolvedValue(okResponse([]));
    const { getCampusLocations } = await loadModule();
    await getCampusLocations();
    const opts = fetchMock.mock.calls[0]![1];
    expect(opts.headers.authorization).toBe('Bearer app-token');
  });

  it('renvoie une map vide si l’API répond en erreur', async () => {
    getAppToken.mockResolvedValue('app-token');
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => [] });
    const { getCampusLocations } = await loadModule();
    expect((await getCampusLocations()).size).toBe(0);
  });

  it('renvoie une map vide si fetch jette', async () => {
    getAppToken.mockResolvedValue('app-token');
    fetchMock.mockRejectedValue(new Error('network'));
    const { getCampusLocations } = await loadModule();
    expect((await getCampusLocations()).size).toBe(0);
  });

  it('met en cache : un second appel ne refait ni token ni fetch', async () => {
    getAppToken.mockResolvedValue('app-token');
    fetchMock.mockResolvedValue(okResponse([{ user: { login: 'alice' }, host: 'e1' }]));
    const { getCampusLocations } = await loadModule();
    const first = await getCampusLocations();
    const second = await getCampusLocations();
    expect(second).toBe(first); // même Map renvoyée depuis le cache
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(getAppToken).toHaveBeenCalledOnce();
  });
});
