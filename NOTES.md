# NOTES — bugs/observations repérés en lisant le code

> Conformément à la consigne : je liste ici les bugs évidents trouvés en passant.
> Je ne corrige pas sans validation, sauf mention explicite ci-dessous.

## ProfilDesktop — graphe ELO dupliqué (CORRIGÉ avec accord)
`apps/web/src/pages/profil/ProfilDesktop.tsx` affichait **deux fois** le même bloc
« Évolution ELO » (copier-coller, probablement issu d'un merge). Retiré lors de
l'harmonisation du profil (un seul graphe, hauteur portée à 140px). Signalé dans
la conversation.

## CreateTournamentSchema — capacité 2|4 vs front 4/8 (RÉSOLU)
Le schéma zod acceptait `capacity` 2 ou 4 alors que le front proposait 4/8.
Aligné sur **8 ou 16** (minimum 8 joueurs, bracket = puissance de 2).
