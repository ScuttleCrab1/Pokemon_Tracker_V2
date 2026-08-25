# Pokémon Collection Tracker

Site statique (pas de build, pas de dépendance Node) qui suit la valeur de la collection de cartes Pokémon (et bientôt des produits scellés) dans le temps, alimenté par les exports CSV de l'app iEstim.

## Structure

```
index.html               dashboard (une seule page)
css/                      tokens (couleurs/typo), layout, composants
js/                       data-loader, matching (id des items), stats (calculs), charts, period-picker, app (orchestration)
data/
  index.json              liste des snapshots disponibles
  snapshots/cartes/        un fichier JSON horodaté par import de cartes.csv
  snapshots/scelles/       idem pour les produits scellés (format à définir)
ingest/ingest.py           algorithme de référence CSV -> snapshot JSON (Python)
tools/import-dropbox.ps1   import local en masse depuis csv-a-importer/ (PowerShell, pas besoin de Python)
csv-a-importer/            dépose ici tes CSV nommés MMJJ.csv pour un import local (voir son README)
docs/
  CLAUDE_PROJECT_INSTRUCTIONS.md   à coller dans le Projet claude.ai qui fait l'ingestion
  DEPLOIEMENT.md                   étapes GitHub / Vercel / claude.ai à faire toi-même
scriptable/pokemon-tracker-rappel.js   script iPhone (notif 18h + tentative d'ouverture iEstim)
```

## Comment ça marche

1. Chaque snapshot est une capture datée de toute la collection (cartes ou scellés) au moment d'un export CSV.
2. Chaque item a un `id` stable basé sur nom + numéro + série + état + version (voir `js/matching.js`), ce qui permet de suivre son prix d'un snapshot à l'autre même si l'ordre du CSV change.
3. Le site charge tous les snapshots au chargement de la page, calcule les stats côté client (aucun backend), et permet de comparer deux dates au choix.
4. Le P&L affiché est l'évolution de la valeur entre deux snapshots choisis, pas le prix d'achat (souvent absent/à 0€ dans les exports iEstim).

## Développement local

Pas de build. Comme `fetch()` d'un JSON local est bloqué en `file://`, sers le dossier avec n'importe quel serveur statique, par exemple :

```bash
npx serve .
```

(ou tout autre serveur statique équivalent si `npx` n'est pas disponible).

## Déploiement

Voir [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md).

## Ajouter un nouveau snapshot manuellement (sans passer par claude.ai)

```bash
python ingest/ingest.py chemin/vers/cartes.csv --type cartes --repo-root .
```
