# Guide Git — pousser sur develop, sur main, et promouvoir en prod

## Le modèle mental (à retenir absolument)

**2 branches = 2 environnements qui se déploient tout seuls :**

| Tu pousses sur… | Ça déclenche… | Résultat visible |
|---|---|---|
| **`develop`** | `deploy-staging` (build image `:develop`) | https://staging.42league.fr (privé, `admin`/`6767`) |
| **`main`** | `deploy-prod` (build/seed image `:main`) | https://42league.fr (**PRODUCTION**) |

> **Règle d'or : on teste sur `develop` (staging) AVANT de promouvoir sur `main` (prod).**

> ⚠️ Fais toujours ça dans ton **terminal WSL Ubuntu** (`cd ~/projects/42_League`) — c'est là qu'est ta clé GitHub. N'utilise pas le Git de Windows (sinon faux fichiers « modifiés » à cause des fins de ligne CRLF).

---

## 1️⃣ Pousser du travail sur `develop` (→ staging)

### Façon propre — branche de feature (recommandé)
```bash
cd ~/projects/42_League
git switch develop && git pull            # repars du dernier develop à jour
git switch -c feat/ma-fonctionnalite      # crée ta branche de travail

# ... tu codes ...
git add -A
git commit -m "feat(scope): ce que ça fait"
git push -u origin feat/ma-fonctionnalite # lance juste la CI (tests), AUCUN déploiement
```
Quand la CI est verte, tu fusionnes dans `develop` :
```bash
git switch develop
git merge feat/ma-fonctionnalite
git push origin develop                   # ⤴ deploy-staging → staging.42league.fr (~5-8 min)
```

### Façon rapide — direct sur develop (pour de petits trucs)
```bash
git switch develop && git pull
git add -A
git commit -m "fix(scope): ..."
git push origin develop                   # ⤴ staging se met à jour
```

---

## 2️⃣ Pousser sur `main` (→ PRODUCTION)

Tu *peux* pousser directement sur `main`, mais **évite-le** : la prod ne doit recevoir que du code déjà validé sur staging. Le bon réflexe = promouvoir `develop` (section 3).

Cas légitime = **hotfix urgent** qui ne peut pas attendre :
```bash
git switch main && git pull
# ... tu corriges ...
git add -A
git commit -m "fix(scope): hotfix ..."
git push origin main                      # ⤴ deploy-prod → 42league.fr
```
> Chaque déploiement prod recrée les conteneurs backend/frontend/caddy → **blip de quelques secondes** (normal). La base de données n'est jamais touchée.
> Après un hotfix sur main, reporte-le sur develop pour ne pas le perdre : `git switch develop && git merge main && git push origin develop`.

---

## 3️⃣ Emmener `develop` → `main` (mise en PROD) ⭐

C'est **l'opération que tu feras le plus souvent** pour livrer en prod ce que tu as validé sur staging.

### Option A — Pull Request GitHub (recommandé : tracé, relisible)
1. Ouvre : **https://github.com/42-League-corp/42_League/compare/main...develop**
2. Clique **Create pull request** → relis la liste des changements.
3. Clique **Merge pull request**.

→ Le merge sur `main` déclenche `deploy-prod` automatiquement. ✅

### Option B — En ligne de commande (rapide)
```bash
git switch main && git pull
git merge develop                         # amène tout develop dans main
git push origin main                      # ⤴ deploy-prod → 42league.fr
git switch develop                        # reviens bosser sur develop
```

---

## 🧰 Réflexes utiles

**Voir ce qui partira en prod AVANT de promouvoir :**
```bash
git log --oneline main..develop           # les commits présents sur develop, pas encore sur main
```

**NE PAS déclencher de déploiement** (ex : changement de doc, de README) — ajoute `[skip ci]` au message :
```bash
git commit -m "docs: mise à jour du guide [skip ci]"
```

**Suivre un déploiement en cours :** onglet **Actions** du dépôt GitHub. Ou vérifier en live :
```bash
curl -sI https://staging.42league.fr      # 401 = normal (basic-auth actif)
curl -s  https://42league.fr/api/health   # doit renvoyer {"ok":true}
```

**Convention de commit (la tienne) :** `feat(...)`, `fix(...)`, `chore(...)`, `docs(...)`, `refactor(...)`. Pas de mention d'outil/IA.

---

## 👉 À faire maintenant (1 fois)

Ton `develop` a déjà 1 commit d'avance (le correctif de pipeline `caddy validate`). Promeus-le pour finaliser :
```bash
cd ~/projects/42_League
git switch main && git pull
git merge develop
git push origin main          # applique le correctif sur la pipeline de prod
git switch develop
```
