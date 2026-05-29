import { describe, it, expect, vi, afterEach } from 'vitest';
import { registerSse, emit, broadcast, type SseEvent } from './sse.js';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

// Faux stream SSE: on n'exerce que .writeSSE(...).
type FakeStream = { writeSSE: ReturnType<typeof vi.fn> };

function makeStream(): FakeStream {
  return { writeSSE: vi.fn().mockResolvedValue(undefined) };
}

// Variante qui rejette: simule un flux déjà fermé côté client.
function makeFailingStream(): FakeStream {
  return { writeSSE: vi.fn().mockRejectedValue(new Error('closed')) };
}

// On collecte tous les cleanups créés pour garantir l'isolation des tests:
// l'état `connections` est au niveau module et persiste entre les tests.
const cleanups: Array<() => void> = [];

function register(login: string, stream: FakeStream): () => void {
  const cleanup = registerSse(login, stream as any);
  cleanups.push(cleanup);
  return cleanup;
}

// Compteur pour fabriquer des logins uniques par test (robustesse à l'ordre).
let loginSeq = 0;
function uniqueLogin(name: string): string {
  loginSeq += 1;
  return `${name}-${loginSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

// Vide la file d'attente des microtâches puis la macrotâche courante:
// la suppression d'un stream stale se fait dans un .catch() asynchrone.
async function flush(): Promise<void> {
  await new Promise((r) => setTimeout(r, 0));
}

afterEach(() => {
  // Nettoyage systématique: on retire toutes les connexions enregistrées
  // par le test courant pour éviter toute fuite d'état vers les autres tests
  // (notamment broadcast() qui voit TOUTES les connexions).
  while (cleanups.length) {
    const cleanup = cleanups.pop()!;
    cleanup();
  }
  vi.clearAllMocks();
});

// --------------------------------------------------------------------------
// registerSse + emit: basics
// --------------------------------------------------------------------------

describe('registerSse + emit', () => {
  it('registers a connection and emit calls writeSSE once with the correct shape', () => {
    const login = uniqueLogin('alice');
    const stream = makeStream();
    register(login, stream);

    const event: SseEvent = { type: 'ping', payload: { hello: 'world' } };
    emit([login], event);

    expect(stream.writeSSE).toHaveBeenCalledTimes(1);
    expect(stream.writeSSE).toHaveBeenCalledWith({
      event: 'ping',
      data: JSON.stringify({ hello: 'world' }),
    });
  });

  it('uses event.type as the SSE event name', () => {
    const login = uniqueLogin('alice');
    const stream = makeStream();
    register(login, stream);

    emit([login], { type: 'match.updated', payload: {} });

    expect(stream.writeSSE).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'match.updated' }),
    );
  });

  it('emit to a login with no connections is a no-op (does not throw)', () => {
    const ghost = uniqueLogin('ghost');
    expect(() => emit([ghost], { type: 'x', payload: 1 })).not.toThrow();
  });

  it('emit with an empty logins array is a no-op', () => {
    expect(() => emit([], { type: 'x', payload: 1 })).not.toThrow();
  });
});

// --------------------------------------------------------------------------
// Payload serialization
// --------------------------------------------------------------------------

describe('emit payload serialization', () => {
  it('serializes object payloads', () => {
    const login = uniqueLogin('alice');
    const stream = makeStream();
    register(login, stream);

    const payload = { a: 1, b: 'two', c: [3, 4] };
    emit([login], { type: 'e', payload });

    expect(stream.writeSSE).toHaveBeenCalledWith({
      event: 'e',
      data: JSON.stringify(payload),
    });
  });

  it('serializes array payloads', () => {
    const login = uniqueLogin('alice');
    const stream = makeStream();
    register(login, stream);

    const payload = [1, 'two', { three: 3 }];
    emit([login], { type: 'e', payload });

    expect(stream.writeSSE).toHaveBeenCalledWith({
      event: 'e',
      data: JSON.stringify(payload),
    });
  });

  it('serializes null payloads', () => {
    const login = uniqueLogin('alice');
    const stream = makeStream();
    register(login, stream);

    emit([login], { type: 'e', payload: null });

    expect(stream.writeSSE).toHaveBeenCalledWith({ event: 'e', data: 'null' });
  });

  it('serializes string payloads (with JSON quoting)', () => {
    const login = uniqueLogin('alice');
    const stream = makeStream();
    register(login, stream);

    emit([login], { type: 'e', payload: 'hello' });

    expect(stream.writeSSE).toHaveBeenCalledWith({ event: 'e', data: '"hello"' });
  });

  it('serializes number payloads', () => {
    const login = uniqueLogin('alice');
    const stream = makeStream();
    register(login, stream);

    emit([login], { type: 'e', payload: 42 });

    expect(stream.writeSSE).toHaveBeenCalledWith({ event: 'e', data: '42' });
  });

  it('serializes boolean payloads', () => {
    const login = uniqueLogin('alice');
    const stream = makeStream();
    register(login, stream);

    emit([login], { type: 'e', payload: false });

    expect(stream.writeSSE).toHaveBeenCalledWith({ event: 'e', data: 'false' });
  });
});

// --------------------------------------------------------------------------
// CIBLAGE / VIE PRIVÉE — propriété de sécurité centrale
// --------------------------------------------------------------------------

describe('emit targeting / privacy (sécurité)', () => {
  it("SÉCURITÉ: emit(['alice']) atteint UNIQUEMENT alice et JAMAIS bob", () => {
    // Test de sécurité clé: un événement destiné à un utilisateur ne doit
    // jamais fuiter vers les flux d'un autre utilisateur connecté.
    const alice = uniqueLogin('alice');
    const bob = uniqueLogin('bob');
    const aliceStream = makeStream();
    const bobStream = makeStream();
    register(alice, aliceStream);
    register(bob, bobStream);

    emit([alice], { type: 'secret', payload: { token: 'abc' } });

    // Alice reçoit bien l'évènement…
    expect(aliceStream.writeSSE).toHaveBeenCalledTimes(1);
    // …mais Bob ne doit RIEN recevoir: aucune fuite tolérée.
    expect(bobStream.writeSSE).not.toHaveBeenCalled();
  });

  it("SÉCURITÉ: un mix [connecté, inconnu] ne touche que le connecté", () => {
    // On vise alice (connectée) et un login inconnu. Bob, connecté mais non
    // ciblé, ne doit toujours rien recevoir.
    const alice = uniqueLogin('alice');
    const bob = uniqueLogin('bob');
    const unknown = uniqueLogin('nobody');
    const aliceStream = makeStream();
    const bobStream = makeStream();
    register(alice, aliceStream);
    register(bob, bobStream);

    emit([alice, unknown], { type: 'e', payload: 1 });

    expect(aliceStream.writeSSE).toHaveBeenCalledTimes(1);
    expect(bobStream.writeSSE).not.toHaveBeenCalled();
  });

  it("SÉCURITÉ: cibler deux logins n'arrose pas un troisième non ciblé", () => {
    // alice + bob ciblés, carol connectée mais hors cible: carol = silence.
    const alice = uniqueLogin('alice');
    const bob = uniqueLogin('bob');
    const carol = uniqueLogin('carol');
    const aliceStream = makeStream();
    const bobStream = makeStream();
    const carolStream = makeStream();
    register(alice, aliceStream);
    register(bob, bobStream);
    register(carol, carolStream);

    emit([alice, bob], { type: 'e', payload: 'data' });

    expect(aliceStream.writeSSE).toHaveBeenCalledTimes(1);
    expect(bobStream.writeSSE).toHaveBeenCalledTimes(1);
    // carol ne fait pas partie de la cible: aucune fuite.
    expect(carolStream.writeSSE).not.toHaveBeenCalled();
  });
});

// --------------------------------------------------------------------------
// Multiple connections per login (e.g. several browser tabs)
// --------------------------------------------------------------------------

describe('multiple connections for the same login', () => {
  it('emit reaches BOTH streams of the same login (two tabs)', () => {
    const login = uniqueLogin('alice');
    const tab1 = makeStream();
    const tab2 = makeStream();
    register(login, tab1);
    register(login, tab2);

    emit([login], { type: 'e', payload: { n: 1 } });

    expect(tab1.writeSSE).toHaveBeenCalledTimes(1);
    expect(tab2.writeSSE).toHaveBeenCalledTimes(1);
    const expected = { event: 'e', data: JSON.stringify({ n: 1 }) };
    expect(tab1.writeSSE).toHaveBeenCalledWith(expected);
    expect(tab2.writeSSE).toHaveBeenCalledWith(expected);
  });

  it('SÉCURITÉ: plusieurs onglets de alice, mais bob (connecté) reste muet', () => {
    const alice = uniqueLogin('alice');
    const bob = uniqueLogin('bob');
    const tab1 = makeStream();
    const tab2 = makeStream();
    const bobStream = makeStream();
    register(alice, tab1);
    register(alice, tab2);
    register(bob, bobStream);

    emit([alice], { type: 'e', payload: 1 });

    expect(tab1.writeSSE).toHaveBeenCalledTimes(1);
    expect(tab2.writeSSE).toHaveBeenCalledTimes(1);
    expect(bobStream.writeSSE).not.toHaveBeenCalled();
  });
});

// --------------------------------------------------------------------------
// Cleanup
// --------------------------------------------------------------------------

describe('cleanup function', () => {
  it('removes the connection so emit no longer calls that stream', () => {
    const login = uniqueLogin('alice');
    const stream = makeStream();
    const cleanup = registerSse(login, stream as any);

    emit([login], { type: 'e', payload: 1 });
    expect(stream.writeSSE).toHaveBeenCalledTimes(1);

    cleanup();

    emit([login], { type: 'e', payload: 2 });
    // Toujours 1 appel: le stream a été retiré, plus aucune diffusion.
    expect(stream.writeSSE).toHaveBeenCalledTimes(1);
  });

  it('cleaning up one tab keeps the other tab receiving', () => {
    const login = uniqueLogin('alice');
    const tab1 = makeStream();
    const tab2 = makeStream();
    const cleanup1 = registerSse(login, tab1 as any);
    register(login, tab2);

    cleanup1();
    emit([login], { type: 'e', payload: 1 });

    expect(tab1.writeSSE).not.toHaveBeenCalled();
    expect(tab2.writeSSE).toHaveBeenCalledTimes(1);
  });

  it('calling cleanup twice is safe (idempotent)', () => {
    const login = uniqueLogin('alice');
    const stream = makeStream();
    const cleanup = registerSse(login, stream as any);

    expect(() => {
      cleanup();
      cleanup();
    }).not.toThrow();

    emit([login], { type: 'e', payload: 1 });
    expect(stream.writeSSE).not.toHaveBeenCalled();
  });

  it("once a login's last connection is cleaned up, broadcast no longer reaches it", () => {
    const login = uniqueLogin('alice');
    const stream = makeStream();
    const cleanup = registerSse(login, stream as any);

    cleanup();

    broadcast({ type: 'global', payload: 1 });
    expect(stream.writeSSE).not.toHaveBeenCalled();
  });
});

// --------------------------------------------------------------------------
// Stale-stream eviction
// --------------------------------------------------------------------------

describe('stale-stream eviction', () => {
  it('removes a stream whose writeSSE rejected; a later emit does not call it again', async () => {
    const login = uniqueLogin('alice');
    const stream = makeFailingStream();
    register(login, stream);

    emit([login], { type: 'e', payload: 1 });
    expect(stream.writeSSE).toHaveBeenCalledTimes(1);

    // Le .catch() est asynchrone: on laisse les microtâches/macrotâche tourner.
    await flush();

    emit([login], { type: 'e', payload: 2 });
    // Toujours 1 appel: le stream stale a été évincé après le rejet.
    expect(stream.writeSSE).toHaveBeenCalledTimes(1);
  });

  it('evicting a failing stream does not affect a healthy stream of the same login', async () => {
    const login = uniqueLogin('alice');
    const failing = makeFailingStream();
    const healthy = makeStream();
    register(login, failing);
    register(login, healthy);

    emit([login], { type: 'e', payload: 1 });
    await flush();

    emit([login], { type: 'e', payload: 2 });

    // failing: appelé une seule fois (puis évincé).
    expect(failing.writeSSE).toHaveBeenCalledTimes(1);
    // healthy: appelé aux deux emits.
    expect(healthy.writeSSE).toHaveBeenCalledTimes(2);
  });

  it('a failing stream that was the last connection is removed from broadcast too', async () => {
    const login = uniqueLogin('alice');
    const stream = makeFailingStream();
    register(login, stream);

    broadcast({ type: 'e', payload: 1 });
    expect(stream.writeSSE).toHaveBeenCalledTimes(1);
    await flush();

    // Après éviction, plus aucune connexion pour ce login.
    broadcast({ type: 'e', payload: 2 });
    expect(stream.writeSSE).toHaveBeenCalledTimes(1);
  });
});

// --------------------------------------------------------------------------
// broadcast
// --------------------------------------------------------------------------

describe('broadcast', () => {
  it('reaches all currently-registered logins', () => {
    const a = uniqueLogin('a');
    const b = uniqueLogin('b');
    const c = uniqueLogin('c');
    const sa = makeStream();
    const sb = makeStream();
    const sc = makeStream();
    register(a, sa);
    register(b, sb);
    register(c, sc);

    broadcast({ type: 'leaderboard', payload: { rank: [] } });

    expect(sa.writeSSE).toHaveBeenCalledTimes(1);
    expect(sb.writeSSE).toHaveBeenCalledTimes(1);
    expect(sc.writeSSE).toHaveBeenCalledTimes(1);
  });

  it('broadcast reaches every tab of every login', () => {
    const a = uniqueLogin('a');
    const b = uniqueLogin('b');
    const a1 = makeStream();
    const a2 = makeStream();
    const b1 = makeStream();
    register(a, a1);
    register(a, a2);
    register(b, b1);

    broadcast({ type: 'g', payload: 1 });

    expect(a1.writeSSE).toHaveBeenCalledTimes(1);
    expect(a2.writeSSE).toHaveBeenCalledTimes(1);
    expect(b1.writeSSE).toHaveBeenCalledTimes(1);
  });

  it('broadcast passes the correct event shape', () => {
    const a = uniqueLogin('a');
    const sa = makeStream();
    register(a, sa);

    broadcast({ type: 'tournament.start', payload: { id: 7 } });

    expect(sa.writeSSE).toHaveBeenCalledWith({
      event: 'tournament.start',
      data: JSON.stringify({ id: 7 }),
    });
  });

  it('broadcast with no connections is a no-op (does not throw)', () => {
    // afterEach a tout nettoyé; ce test n'enregistre rien.
    expect(() => broadcast({ type: 'g', payload: 1 })).not.toThrow();
  });
});
