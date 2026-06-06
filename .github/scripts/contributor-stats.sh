#!/usr/bin/env bash
# Calcule les stats de contributions git (lignes ajout/suppr/net) des fondateurs
# et les émet en JSON sur une seule ligne, p.ex. :
#   {"throbert":{"added":96373,"deleted":30533,"net":65840},"abidaux":{...}}
#
# Utilisé par les workflows de déploiement pour injecter CONTRIBUTOR_STATS dans
# l'image backend (la prod n'a ni `.git` ni binaire `git`). Même logique que
# l'alias `git lines` et que apps/backend/src/contributor-stats.ts (groupé par
# e-mail pour fusionner les identités multiples, --no-merges, binaire ignoré).
set -euo pipefail

git log --no-merges --numstat --pretty='@%ae' | awk -F'\t' '
  /^@/ {
    e = tolower(substr($0, 2))
    if (e == "frozyxyt.76@gmail.com" || e == "thomas.robert76@hotmail.com") who = "throbert"
    else if (e == "abidaux@student.42lehavre.fr" || e == "adr.bidaux@gmail.com") who = "abidaux"
    else who = ""
    next
  }
  who != "" && NF == 3 && $1 != "-" && $2 != "-" { A[who] += $1; D[who] += $2 }
  END {
    n = split("throbert abidaux", ks, " ")
    printf "{"
    sep = ""
    for (i = 1; i <= n; i++) {
      k = ks[i]; a = A[k] + 0; d = D[k] + 0
      printf "%s\"%s\":{\"added\":%d,\"deleted\":%d,\"net\":%d}", sep, k, a, d, a - d
      sep = ","
    }
    printf "}"
  }
'
