# 🚀 Workflow Git + Déploiement — Ultra Simple

> TL;DR : Code sur `develop`, pousse = staging se déploie. Quand c'est bon, fais venir `develop` → `main` = prod se déploie.

---

## Les 2 branches

| Branche | Ça déploie où | Quoi faire |
|---------|---|---|
| **`develop`** | staging.oneleague.fr | Tu bosses ici. Chaque `git push` = redéploiement auto. |
| **`main`** | oneleague.fr (PROD) | Branche de prod. Mise à jour = merger `develop` dedans. |

---

## Workflow au quotidien — 3 étapes

### Étape 1 — Tu codes sur `develop`

```bash
git switch develop
git pull
```

*(C'est tout. Tu es sur la bonne branche.)*

Tu fais tes modifs. Quand tu es prêt :

```bash
git add -A
git commit -m "feat: ma feature"
git push origin develop
```

✅ **Boom.** GitHub Actions lance un build auto, construit l'image Docker `:develop`, la pousse sur GHCR, et déploie sur **staging.oneleague.fr** en ~9 minutes.

**Tester** : https://staging.oneleague.fr (login OAuth, tu es automatiquement superadmin si tu es dans la whitelist).

---

### Étape 2 — Tu valides sur staging

Tu testes ta feature sur https://staging.oneleague.fr.

Tout bon ? Continue. Pas bon ? Refais un `git commit` → `git push origin develop`, ça redéploie.

---

### Étape 3 — Passer en PROD (une seule fois par release)

Quand tout marche sur staging, tu amènes `develop` → `main`.

**Façon la plus simple :**

1. Va sur GitHub : https://github.com/42-League-corp/42_League/compare/main...develop
2. Clique **Create pull request**
3. Ajoute un titre / description si tu veux
4. Clique **Merge pull request**

Voilà.

**Ou en ligne de commande :**

```bash
git switch main
git pull
git merge develop
git push origin main
```

✅ **Boom.** GitHub Actions lance `deploy-prod` : construit les images `:main`, valide le Caddyfile, déploie sur **oneleague.fr** en ~9 minutes.

---

## Les 5 erreurs à NE PAS faire

❌ **Ne pas** coder sur `main` (elle n'est que pour les releases)  
❌ **Ne pas** `git push origin main` en direct (sauf urgence hotfix)  
❌ **Ne pas** oublier `git pull` avant de coder (sinon conflit)  
❌ **Ne pas** faire 47 petits commits débiles (fais un vrai commit par feature)  
❌ **Ne pas** laisser trainer une PR ouverte — merge ou close vite  

---

## Les 3 choses à savoir sur GitHub Actions

### 1. Chaque `push` déclenche un truc

```
tu: git push origin develop
           │
           ▼
GitHub: "OK, je lance deploy-staging"
           │
           ▼
⏳ 9 minutes plus tard
           │
           ▼
✅ staging.oneleague.fr est à jour
```

### 2. Si ça casse, tu vois l'erreur

Va sur https://github.com/42-League-corp/42_League/actions — tu vois tous les déploiements et si l'un échoue, pourquoi.

### 3. Aucun "déploiement manuel" n'existe

**Pas de bouton "Deploy".**  
Tu `push` → c'est déployé. C'est tout.

---

## Cheat sheet — Les 6 commandes à connaître

```bash
# 1. Préparer (une fois au début)
git switch develop && git pull

# 2. Bosser
git add -A
git commit -m "feat: ta feature"

# 3. Pousser (= déployer sur staging)
git push origin develop

# 4. Tester (manuel sur https://staging.oneleague.fr)
# [ouvre le lien, testes]

# 5. Passer en prod
git switch main && git pull && git merge develop && git push origin main

# 6. Revenir bosser
git switch develop
```

---

## L'appelle de la console si ça échoue

**"Mon push a échoué"** → regarde l'erreur GitHub Actions (le lien s'affiche)  
**"Staging ne se met pas à jour"** → `git status` (t'as peut-être oublié un `git add`)  
**"Je vois un conflit au merge"** → fais `git merge --abort`, résout sur develop, repousse, recommence le merge  
**"Prod a un bug"** → fix sur develop, pousse, passe en prod une fois bon  

---

## Résumé (vraiment au complet)

```
DEVELOP branch (staging)          MAIN branch (prod)
       │                                │
    git commit                     git merge develop
       │                                │
    git push                          git push
       │                                │
       ▼                                ▼
  ⏳ build `:develop`             ⏳ build `:main`
       │                                │
       ▼                                ▼
  ✅ staging.oneleague.fr          ✅ oneleague.fr (REAL)
```

**Voilà. C'est ça.**
