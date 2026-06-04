#!/usr/bin/env python3
"""Télécharge les portraits des personnages Street Fighter (roster sf.ts) depuis
le wiki Fandom (API pageimages) vers apps/web/public/sf/<id>.png.

Best-effort : un perso sans image trouvée est listé en « missing » et retombera
sur la pastille colorée de SfCharIcon. Idempotent (ne re-télécharge pas un fichier
déjà présent et non vide)."""
import json, os, sys, time, urllib.request, urllib.parse

OUT = os.path.join(os.path.dirname(__file__), "..", "apps", "web", "public", "sf")
API = "https://streetfighter.fandom.com/api.php"
UA = "42League-portrait-fetcher/1.0 (internal school league tool)"

# id -> titre de page wiki préféré. Pour les variantes par jeu (ryu_iii, gill_v…)
# on pointe sur le personnage de base. Défaut quand absent : le nom du roster.
TITLES = {
    "chun_li": "Chun-Li", "e_honda": "E. Honda", "dee_jay": "Dee Jay",
    "m_bison": "M. Bison", "vega": "Vega (Street Fighter)",
    "balrog": "Balrog (Street Fighter)", "fei_long": "Fei Long",
    "t_hawk": "T. Hawk", "dan": "Dan Hibiki", "sakura": "Sakura Kasugano",
    "karin": "Karin Kanzuki", "r_mika": "Rainbow Mika", "gen": "Gen (Street Fighter)",
    "rose": "Rose (Street Fighter)", "guy": "Guy", "charlie": "Charlie Nash",
    "nash": "Charlie Nash", "cracker_jack": "Cracker Jack", "alex": "Alex (Street Fighter)",
    "q": "Q (Street Fighter)", "g": "G (Street Fighter)", "gill": "Gill",
    "gill_v": "Gill", "seth": "Seth (Street Fighter)", "poison": "Poison (Street Fighter)",
    "ed": "Ed (Street Fighter)", "fang": "F.A.N.G", "aki": "A.K.I.",
    "terry": "Terry Bogard", "mai": "Mai Shiranui", "laura": "Laura Matsuda",
    "lucia": "Lucia Morgan", "abigail": "Abigail (Street Fighter)", "kage": "Kage",
    "ryu_iii": "Ryu", "elena_iii": "Elena", "rashid_v": "Rashid", "kolin": "Kolin",
    "lily": "Lily (Street Fighter)", "luke": "Luke (Street Fighter)",
}

def roster():
    sf = os.path.join(os.path.dirname(__file__), "..", "apps", "web", "src", "lib", "sf.ts")
    out = []
    import re
    for m in re.finditer(r"\{ id: '([^']+)', name: '([^']+)'", open(sf, encoding="utf-8").read()):
        out.append((m.group(1), m.group(2)))
    return out

def api_image(title):
    q = urllib.parse.urlencode({
        "action": "query", "prop": "pageimages", "piprop": "thumbnail",
        "pithumbsize": "512", "redirects": "1", "format": "json", "titles": title,
    })
    req = urllib.request.Request(API + "?" + q, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        data = json.load(r)
    pages = data.get("query", {}).get("pages", {})
    for _, p in pages.items():
        thumb = p.get("thumbnail", {}).get("source")
        if thumb:
            return thumb
    return None

def download(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read()
    if len(body) < 500:
        return False
    open(dest, "wb").write(body)
    return True

def main():
    os.makedirs(OUT, exist_ok=True)
    ok, missing = [], []
    for cid, name in roster():
        dest = os.path.join(OUT, cid + ".png")
        if os.path.exists(dest) and os.path.getsize(dest) > 500:
            ok.append(cid); continue
        candidates = []
        if cid in TITLES: candidates.append(TITLES[cid])
        candidates += [name, name + " (Street Fighter)"]
        seen, url = set(), None
        for title in candidates:
            if title in seen: continue
            seen.add(title)
            try:
                url = api_image(title)
            except Exception as e:
                url = None
            if url: break
            time.sleep(0.15)
        if not url:
            missing.append(cid); print(f"  MISS {cid:14s} ({name})"); continue
        try:
            if download(url, dest):
                ok.append(cid); print(f"  ok   {cid:14s} <- {url.split('/revision')[0].split('/')[-1]}")
            else:
                missing.append(cid); print(f"  MISS {cid:14s} (tiny)")
        except Exception as e:
            missing.append(cid); print(f"  MISS {cid:14s} ({e})")
        time.sleep(0.1)
    print(f"\nDONE: {len(ok)} ok, {len(missing)} missing")
    if missing: print("missing:", ", ".join(missing))

if __name__ == "__main__":
    main()
