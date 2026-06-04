#!/usr/bin/env python3
"""Télécharge les illustrations des persos Smash (roster smash.ts) vers
apps/web/public/smash/<id>.png.

Deux sources, dans l'ordre (best-effort, comme fetch_sf_portraits.py) :
  1. smashbros.com officiel : /assets_v2/img/fighter/<slug>/main.png ;
  2. repli wiki Fandom (pageimages) pour les slugs introuvables (DLC, codenames
     divergents…), via le titre « <Nom> (SSBU) ».

Un perso sans image retombe sur la pastille colorée de SmashCharIcon. Idempotent :
ne re-télécharge pas un fichier déjà présent et non vide."""
import json, os, re, time, urllib.parse, urllib.request

OUT = os.path.join(os.path.dirname(__file__), "..", "apps", "web", "public", "smash")
OFFICIAL = "https://www.smashbros.com/assets_v2/img/fighter/{slug}/main.png"
FANDOM = "https://supersmashbros.fandom.com/api.php"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
OFFICIAL_HEADERS = {"User-Agent": UA, "Referer": "https://www.smashbros.com/en_US/fighter/index.html"}

# id -> titre de page Fandom préféré (désambiguïsation / pages composées).
FANDOM_TITLES = {
    "rosalina": "Rosalina & Luma (SSBU)",
    "mii_fighter": "Mii Brawler (SSBU)",
    "pokemon_trainer": "Pokémon Trainer (SSBU)",
    "rob": "R.O.B. (SSBU)",
    "mr_game_and_watch": "Mr. Game & Watch (SSBU)",
}


def roster():
    """(id, name, slug) parsés depuis le roster front (source unique de vérité)."""
    smash = os.path.join(os.path.dirname(__file__), "..", "apps", "web", "src", "lib", "smash.ts")
    text = open(smash, encoding="utf-8").read()
    out = []
    for m in re.finditer(
        r"\{ id: '([^']+)', name: '([^']+)', color: '[^']+', slug: '([^']+)' \}", text
    ):
        out.append((m.group(1), m.group(2), m.group(3)))
    return out


def fetch(url, headers):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read()


def fandom_thumb(title):
    q = urllib.parse.urlencode({
        "action": "query", "prop": "pageimages", "piprop": "thumbnail",
        "pithumbsize": "512", "redirects": "1", "format": "json", "titles": title,
    })
    data = json.loads(fetch(FANDOM + "?" + q, {"User-Agent": UA}).decode("utf-8"))
    for _, p in data.get("query", {}).get("pages", {}).items():
        src = p.get("thumbnail", {}).get("source")
        if src:
            return src
    return None


def save(body, dest):
    if not body or len(body) < 500:
        return False
    open(dest, "wb").write(body)
    return True


def main():
    os.makedirs(OUT, exist_ok=True)
    ok, missing = [], []
    for cid, name, slug in roster():
        dest = os.path.join(OUT, cid + ".png")
        if os.path.exists(dest) and os.path.getsize(dest) > 500:
            ok.append(cid)
            continue
        # 1) source officielle smashbros.com
        try:
            if save(fetch(OFFICIAL.format(slug=slug), OFFICIAL_HEADERS), dest):
                ok.append(cid); print(f"  ok   {cid:18s} <- smashbros/{slug}"); time.sleep(0.1); continue
        except Exception:
            pass
        # 2) repli Fandom (pageimages) — titres candidats
        candidates = []
        if cid in FANDOM_TITLES:
            candidates.append(FANDOM_TITLES[cid])
        candidates += [f"{name} (SSBU)", name]
        done = False
        for title in candidates:
            try:
                src = fandom_thumb(title)
                if src and save(fetch(src, {"User-Agent": UA}), dest):
                    ok.append(cid); print(f"  ok   {cid:18s} <- fandom: {title}"); done = True; break
            except Exception:
                pass
            time.sleep(0.15)
        if not done:
            missing.append(cid); print(f"  MISS {cid:18s} ({name})")
        time.sleep(0.1)
    print(f"\nDONE: {len(ok)} ok, {len(missing)} missing")
    if missing:
        print("missing:", ", ".join(missing))


if __name__ == "__main__":
    main()
