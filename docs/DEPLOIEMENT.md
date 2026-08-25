# Déploiement — étapes à faire toi-même

Ces étapes touchent tes comptes (GitHub, Vercel, claude.ai) : je ne peux pas les faire à ta place. Une fois faites, je peux pousser le code et vérifier que tout fonctionne.

## 1. Créer le repo GitHub

1. Va sur [github.com/new](https://github.com/new).
2. Nom suggéré : `pokemon-collection-tracker` (ou ce que tu préfères).
3. Visibilité : **Private**.
4. Ne coche **aucune** case d'initialisation (pas de README, pas de .gitignore) — le repo doit être vide, le code existe déjà en local.
5. Une fois créé, copie l'URL du repo (ex: `https://github.com/tonpseudo/pokemon-collection-tracker.git`) et donne-la moi : je fais `git remote add origin ...` puis `git push`.

## 2. Connecter Vercel

1. Va sur [vercel.com/new](https://vercel.com/new) et connecte-toi avec ton compte GitHub.
2. Importe le repo `pokemon-collection-tracker`.
3. Aucune configuration nécessaire : c'est un site statique (pas de build command, pas de output directory à changer — laisse les valeurs par défaut, ou "Other" comme framework preset).
4. Déploie. Vercel te donne une URL du type `pokemon-collection-tracker.vercel.app` — c'est le **lien secret non listé** vers ton site (ne le partage pas, ne le liste nulle part publiquement).
5. Chaque futur `git push` sur `main` (fait automatiquement par le Projet claude.ai) redéploiera le site tout seul.

## 3. Créer le Projet claude.ai dédié

1. Sur [claude.ai](https://claude.ai), crée un nouveau **Projet** (ex: "Pokémon Tracker — Import").
2. Dans les paramètres du Projet, active le **connecteur GitHub** et autorise-le sur le repo `pokemon-collection-tracker` (lecture + écriture).
3. Colle le contenu de [`CLAUDE_PROJECT_INSTRUCTIONS.md`](CLAUDE_PROJECT_INSTRUCTIONS.md) dans les "Instructions du projet", en remplaçant `{REPO}` par le nom réel du repo (ex: `tonpseudo/pokemon-collection-tracker`).
4. Teste : envoie `cartes.csv` dans une conversation de ce Projet et vérifie qu'un nouveau fichier apparaît dans `data/snapshots/cartes/` sur GitHub, et que le site Vercel se met à jour après.

## 4. Automatisation iPhone (Scriptable)

Voir [`../scriptable/pokemon-tracker-rappel.js`](../scriptable/pokemon-tracker-rappel.js) et sa documentation en tête de fichier pour l'installation dans l'app Scriptable + l'automatisation Raccourcis à 18h.

## Résumé de ce qui se passe ensuite, au quotidien

```
18h : notification iPhone (Scriptable)
   → tu ouvres iEstim, tu exportes le CSV
   → tu le partages (Share Sheet) vers l'app Claude, dans le Projet "Pokémon Tracker — Import"
   → Claude parse le CSV, écrit un nouveau snapshot, push sur GitHub
   → Vercel redéploie automatiquement
   → ton site est à jour, sans toucher à un PC
```
