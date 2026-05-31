import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHmac } from 'node:crypto';
import { issueToken, verifyToken, issueStreamToken, verifyStreamToken } from './tokens.js';

// Helpers locaux pour reproduire le format des tokens sans dépendre du module
// (base64url(JSON payload).base64url(HMAC-SHA256(payloadB64, secret)))
function b64urlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function decodePayload(token: string): { login: string; iat: number; exp: number } {
  const payloadB64 = token.split('.')[0]!;
  return JSON.parse(b64urlDecode(payloadB64).toString('utf8'));
}

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 jours

afterEach(() => {
  // Toujours restaurer les timers réels après les tests utilisant des faux timers
  vi.useRealTimers();
});

describe('tokens — round-trip (issue puis verify)', () => {
  it('un login simple est retrouvé après émission/vérification', () => {
    const token = issueToken('alice', 'secret');
    expect(verifyToken(token, 'secret')).toBe('alice');
  });

  it('un login avec des chiffres est préservé', () => {
    const token = issueToken('user42', 'secret');
    expect(verifyToken(token, 'secret')).toBe('user42');
  });

  it('un login avec des tirets est préservé', () => {
    const token = issueToken('jean-michel', 'secret');
    expect(verifyToken(token, 'secret')).toBe('jean-michel');
  });

  it('un login avec des underscores est préservé', () => {
    const token = issueToken('admin_root', 'secret');
    expect(verifyToken(token, 'secret')).toBe('admin_root');
  });

  it('un login mélangeant chiffres, tirets et underscores est préservé', () => {
    const token = issueToken('a-b_c-42_x9', 'secret');
    expect(verifyToken(token, 'secret')).toBe('a-b_c-42_x9');
  });

  it('un login vide reste vide (la chaîne vide est un login valide côté format)', () => {
    const token = issueToken('', 'secret');
    expect(verifyToken(token, 'secret')).toBe('');
  });

  it('le token a exactement deux parties séparées par un point', () => {
    const token = issueToken('alice', 'secret');
    expect(token.split('.')).toHaveLength(2);
  });

  it('le payload contient login, iat et exp avec exp = iat + TTL (30 jours)', () => {
    const token = issueToken('alice', 'secret');
    const p = decodePayload(token);
    expect(p.login).toBe('alice');
    expect(typeof p.iat).toBe('number');
    expect(p.exp).toBe(p.iat + TTL_SECONDS);
  });
});

describe('tokens — mauvais secret (SÉCURITÉ)', () => {
  it('un token signé avec le secret A échoue avec le secret B', () => {
    // Un token ne doit jamais être validable sans connaître le bon secret
    const token = issueToken('alice', 'secretA');
    expect(verifyToken(token, 'secretB')).toBeNull();
  });

  it('paire de secrets #2 : "hunter2" vs "letmein"', () => {
    const token = issueToken('bob', 'hunter2');
    expect(verifyToken(token, 'letmein')).toBeNull();
  });

  it('paire de secrets #3 : secrets longs et aléatoires', () => {
    const token = issueToken('carol', 'f8a9c2e7b3d1049586a0fce4d2b18877');
    expect(verifyToken(token, 'f8a9c2e7b3d1049586a0fce4d2b18878')).toBeNull();
  });

  it('un secret différant d\'un seul caractère invalide le token', () => {
    const token = issueToken('dave', 'mon-super-secret');
    expect(verifyToken(token, 'mon-super-Secret')).toBeNull();
  });

  it('le bon secret valide, le mauvais invalide (même token)', () => {
    const token = issueToken('eve', 'correct');
    expect(verifyToken(token, 'correct')).toBe('eve');
    expect(verifyToken(token, 'wrong')).toBeNull();
  });
});

describe('tokens — altération de la signature (SÉCURITÉ)', () => {
  it('changer un caractère de la signature invalide le token', () => {
    const token = issueToken('alice', 'secret');
    const [payloadB64, sig] = token.split('.') as [string, string];
    // On change le premier caractère de la signature par un autre caractère base64url
    const flipped = (sig[0] === 'A' ? 'B' : 'A') + sig.slice(1);
    expect(verifyToken(`${payloadB64}.${flipped}`, 'secret')).toBeNull();
  });

  it('changer le dernier caractère de la signature invalide le token', () => {
    const token = issueToken('alice', 'secret');
    const [payloadB64, sig] = token.split('.') as [string, string];
    const last = sig[sig.length - 1];
    const flipped = sig.slice(0, -1) + (last === 'A' ? 'B' : 'A');
    expect(verifyToken(`${payloadB64}.${flipped}`, 'secret')).toBeNull();
  });

  it('une signature tronquée invalide le token', () => {
    const token = issueToken('alice', 'secret');
    const [payloadB64, sig] = token.split('.') as [string, string];
    expect(verifyToken(`${payloadB64}.${sig.slice(0, sig.length - 5)}`, 'secret')).toBeNull();
  });

  it('une signature vide invalide le token', () => {
    const token = issueToken('alice', 'secret');
    const payloadB64 = token.split('.')[0]!;
    expect(verifyToken(`${payloadB64}.`, 'secret')).toBeNull();
  });

  it('une signature remplacée par celle d\'un autre login invalide le token', () => {
    // La signature d'un autre payload ne peut pas valider ce payload
    const tokenA = issueToken('alice', 'secret');
    const tokenB = issueToken('bob', 'secret');
    const payloadA = tokenA.split('.')[0]!;
    const sigB = tokenB.split('.')[1]!;
    expect(verifyToken(`${payloadA}.${sigB}`, 'secret')).toBeNull();
  });
});

describe('tokens — FORGERY: usurpation par altération du payload (SÉCURITÉ CRITIQUE)', () => {
  it('NE PEUT PAS usurper un superadmin (abidaux) en réécrivant le login tout en gardant la signature originale', () => {
    // Attaque d'usurpation : on émet un token pour un utilisateur lambda,
    // on décode le payload, on remplace le login par celui d'un superadmin (abidaux),
    // on ré-encode et on conserve la signature d'origine.
    // Sans le secret, la signature ne correspond plus -> doit renvoyer null.
    const token = issueToken('attacker', 'super-secret-server-key');
    const [, originalSig] = token.split('.') as [string, string];
    const payload = decodePayload(token);
    payload.login = 'abidaux'; // tentative d'élévation de privilèges
    const forgedPayloadB64 = b64urlEncode(JSON.stringify(payload));
    const forgedToken = `${forgedPayloadB64}.${originalSig}`;
    expect(verifyToken(forgedToken, 'super-secret-server-key')).toBeNull();
  });

  it('NE PEUT PAS prolonger l\'expiration en réécrivant exp tout en gardant la signature originale', () => {
    // Attaque de prolongation : on pousse exp loin dans le futur en gardant la signature.
    // Sans le secret, la signature ne correspond plus -> doit renvoyer null.
    const token = issueToken('alice', 'super-secret-server-key');
    const [, originalSig] = token.split('.') as [string, string];
    const payload = decodePayload(token);
    payload.exp = payload.exp + 60 * 60 * 24 * 365 * 100; // +100 ans
    const forgedPayloadB64 = b64urlEncode(JSON.stringify(payload));
    const forgedToken = `${forgedPayloadB64}.${originalSig}`;
    expect(verifyToken(forgedToken, 'super-secret-server-key')).toBeNull();
  });

  it('un token entièrement fabriqué à la main (payload plausible, signature bidon) est rejeté', () => {
    const now = Math.floor(Date.now() / 1000);
    const payload = { login: 'abidaux', iat: now, exp: now + TTL_SECONDS };
    const payloadB64 = b64urlEncode(JSON.stringify(payload));
    const bogusSig = b64urlEncode('this-is-not-a-valid-hmac-signature-32');
    expect(verifyToken(`${payloadB64}.${bogusSig}`, 'secret')).toBeNull();
  });

  it('réutiliser un payload modifié avec sa propre re-signature SOUS un faux secret échoue contre le vrai secret', () => {
    // L'attaquant resigne correctement le payload modifié mais avec un secret qu'il devine -> échec
    const realSecret = 'real-server-secret';
    const now = Math.floor(Date.now() / 1000);
    const payload = { login: 'abidaux', iat: now, exp: now + TTL_SECONDS };
    const payloadB64 = b64urlEncode(JSON.stringify(payload));
    // signature calculée avec un mauvais secret (helper local équivalent)
    const forged = issueToken('abidaux', 'guessed-wrong-secret');
    const forgedSig = forged.split('.')[1]!;
    expect(verifyToken(`${payloadB64}.${forgedSig}`, realSecret)).toBeNull();
  });
});

describe('tokens — scope SSE (cloisonnement Bearer / stream)', () => {
  const SECRET = 'super-secret-server-key';

  it('round-trip : un stream token est validé par verifyStreamToken', () => {
    const t = issueStreamToken('alice', SECRET);
    expect(verifyStreamToken(t, SECRET)).toBe('alice');
  });

  it('SÉCURITÉ : un stream token (scope sse) est REFUSÉ comme Bearer', () => {
    // C'est le cœur du correctif : un token de stream qui fuite (logs / Referer)
    // ne doit jamais authentifier une mutation via Authorization: Bearer.
    const t = issueStreamToken('alice', SECRET);
    expect(verifyToken(t, SECRET)).toBeNull();
  });

  it('SÉCURITÉ : un Bearer (scope auth) ne peut PAS ouvrir le flux SSE', () => {
    // Réciproque : on n'accepte plus le Bearer complet en query string.
    const t = issueToken('alice', SECRET);
    expect(verifyStreamToken(t, SECRET)).toBeNull();
  });

  it('rétro-compat : un token historique SANS scope reste un Bearer valide', () => {
    // Les tokens 'auth' sont émis sans champ scope (format identique à l'existant).
    const t = issueToken('alice', SECRET);
    const payload = decodePayload(t) as Record<string, unknown>;
    expect(payload.scope).toBeUndefined();
    expect(verifyToken(t, SECRET)).toBe('alice');
  });

  it('un stream token expire vite (TTL ~60 s)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const t = issueStreamToken('alice', SECRET);
    expect(verifyStreamToken(t, SECRET)).toBe('alice');
    vi.setSystemTime(new Date('2026-01-01T00:01:01Z')); // +61 s
    expect(verifyStreamToken(t, SECRET)).toBeNull();
  });

  it('un scope falsifié (sse → auth) sans re-signature valide est rejeté', () => {
    const t = issueStreamToken('attacker', SECRET);
    const [, sig] = t.split('.') as [string, string];
    const payload = decodePayload(t) as Record<string, unknown>;
    delete payload.scope; // tentative : faire passer un stream token pour un Bearer
    const forged = `${b64urlEncode(JSON.stringify(payload))}.${sig}`;
    expect(verifyToken(forged, SECRET)).toBeNull();
  });
});

describe('tokens — tokens malformés (ne doivent jamais lever d\'exception)', () => {
  const cases: Array<[string, string]> = [
    ['chaîne vide', ''],
    ['sans point', 'abcdef'],
    ['un seul point', '.'],
    ['trois parties (deux points)', 'a.b.c'],
    ['quatre parties', 'a.b.c.d'],
    ['garbage aléatoire', '!!!@@@###$$$'],
    ['caractères non base64', 'éàü.çñ¿'],
    ['payload présent mais point final sans signature', 'eyJhIjoxfQ.'],
    ['point en tête', '.signature'],
    ['espaces', '   .   '],
  ];

  for (const [label, value] of cases) {
    it(`renvoie null sans lever pour : ${label}`, () => {
      expect(() => verifyToken(value, 'secret')).not.toThrow();
      expect(verifyToken(value, 'secret')).toBeNull();
    });
  }

  it('un payload non-JSON avec signature bidon ne lève pas et renvoie null', () => {
    // Payload qui n'est pas du JSON : même si la signature échoue d'abord,
    // verifyToken ne doit jamais lever d'exception.
    const payloadB64 = b64urlEncode('ceci-nest-pas-du-json');
    expect(() => verifyToken(`${payloadB64}.AAAA`, 'secret')).not.toThrow();
    expect(verifyToken(`${payloadB64}.AAAA`, 'secret')).toBeNull();
  });

  it('un payload JSON valide mais sans le champ login (bien signé) est rejeté', () => {
    // Pour atteindre le contrôle de type interne, on signe réellement un payload sans login.
    const payloadB64 = b64urlEncode(JSON.stringify({ foo: 'bar', exp: 9999999999 }));
    // On reconstruit la signature correcte via le format public : impossible sans le secret côté
    // attaquant, mais ici en test on connaît le secret et on reproduit l'algo HMAC du module.
    const sig = b64urlEncode(createHmac('sha256', 'secret').update(payloadB64).digest());
    expect(verifyToken(`${payloadB64}.${sig}`, 'secret')).toBeNull();
  });
});

describe('tokens — expiration (faux timers)', () => {
  it('un token est valide juste après émission', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const token = issueToken('alice', 'secret');
    expect(verifyToken(token, 'secret')).toBe('alice');
  });

  it('un token expire après 31 jours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const token = issueToken('alice', 'secret');
    expect(verifyToken(token, 'secret')).toBe('alice');
    // On avance le temps de 31 jours -> au-delà du TTL de 30 jours
    vi.setSystemTime(new Date('2026-02-01T00:00:00Z'));
    expect(verifyToken(token, 'secret')).toBeNull();
  });

  it('un token est encore valide à 29 jours', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const token = issueToken('alice', 'secret');
    vi.setSystemTime(new Date('2026-01-30T00:00:00Z'));
    expect(verifyToken(token, 'secret')).toBe('alice');
  });

  it('exactement à exp : rejeté (le code utilise >= exp)', () => {
    vi.useFakeTimers();
    const start = new Date('2026-01-01T00:00:00Z');
    vi.setSystemTime(start);
    const token = issueToken('alice', 'secret');
    const exp = decodePayload(token).exp;
    // On se place pile à la seconde d'expiration
    vi.setSystemTime(new Date(exp * 1000));
    expect(verifyToken(token, 'secret')).toBeNull();
  });

  it('une seconde avant exp : encore valide', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    const token = issueToken('alice', 'secret');
    const exp = decodePayload(token).exp;
    vi.setSystemTime(new Date((exp - 1) * 1000));
    expect(verifyToken(token, 'secret')).toBe('alice');
  });
});

describe('tokens — comparaison à temps constant / longueurs', () => {
  it('une signature de longueur différente est rejetée (a.length !== b.length avant timingSafeEqual)', () => {
    const token = issueToken('alice', 'secret');
    const payloadB64 = token.split('.')[0]!;
    // Signature volontairement trop courte
    expect(verifyToken(`${payloadB64}.AAAA`, 'secret')).toBeNull();
    // Signature volontairement trop longue
    const longSig = 'A'.repeat(200);
    expect(verifyToken(`${payloadB64}.${longSig}`, 'secret')).toBeNull();
  });

  it('une signature de la bonne longueur mais erronée est rejetée', () => {
    const token = issueToken('alice', 'secret');
    const [payloadB64, sig] = token.split('.') as [string, string];
    // Même longueur que la vraie signature, mais entièrement composée de 'A'
    const sameLenWrong = 'A'.repeat(sig.length);
    // On s'assure qu'on ne tombe pas par hasard sur la vraie signature
    expect(sameLenWrong).not.toBe(sig);
    expect(verifyToken(`${payloadB64}.${sameLenWrong}`, 'secret')).toBeNull();
  });
});

describe('tokens — déterminisme', () => {
  it('deux émissions du même login à temps figé produisent des tokens identiques', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-29T12:00:00Z'));
    const t1 = issueToken('alice', 'secret');
    const t2 = issueToken('alice', 'secret');
    expect(t1).toBe(t2);
  });

  it('deux logins différents à temps figé produisent des tokens différents', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-29T12:00:00Z'));
    const t1 = issueToken('alice', 'secret');
    const t2 = issueToken('bob', 'secret');
    expect(t1).not.toBe(t2);
  });

  it('le même login avec deux secrets différents donne des signatures différentes (temps figé)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-29T12:00:00Z'));
    const t1 = issueToken('alice', 'secretA');
    const t2 = issueToken('alice', 'secretB');
    expect(t1.split('.')[0]).toBe(t2.split('.')[0]); // payload identique
    expect(t1.split('.')[1]).not.toBe(t2.split('.')[1]); // signature différente
  });
});

describe('tokens — le secret compte (cas du secret vide)', () => {
  it('un secret vide fait un round-trip cohérent avec lui-même', () => {
    const token = issueToken('alice', '');
    expect(verifyToken(token, '')).toBe('alice');
  });

  it('un token émis avec un secret vide échoue sous un vrai secret', () => {
    const token = issueToken('alice', '');
    expect(verifyToken(token, 'real-secret')).toBeNull();
  });

  it('un token émis avec un vrai secret échoue sous un secret vide', () => {
    const token = issueToken('alice', 'real-secret');
    expect(verifyToken(token, '')).toBeNull();
  });
});
