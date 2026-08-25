# Dépose tes CSV ici

Deux façons de déposer tes exports iEstim (pas dans `traites/`) :

**1) Dossier daté avec les vrais noms iEstim** (le plus simple si tu copies direct depuis ton export) :
```
csv-a-importer/0705/portefeuille_cartes.csv
csv-a-importer/0705/portefeuille_items.csv
```
`0705` = le dossier daté MMJJ (5 juillet). `portefeuille_items.csv` (scellés) est détecté mais pas encore traité tant que son format n'est pas défini.

**2) Fichier à plat renommé** :
- `MMJJ.csv` → export **cartes** du jour JJ/MM (année en cours par défaut). Exemple : `0705.csv` = 5 juillet.
- `scelles-MMJJ.csv` → export **scellés** (pas encore traité, même limite que ci-dessus).

Puis lance, depuis la racine du projet :

```powershell
powershell -File ./tools/import-dropbox.ps1
```

Chaque fichier cartes devient un snapshot daté dans `data/snapshots/cartes/`, ajouté dans `data/index.json`, et le dossier/fichier traité est déplacé dans `traites/` pour ne pas être réimporté par erreur. Le site les affichera automatiquement dans l'ordre chronologique, quel que soit l'ordre dans lequel tu les as déposés/traités.

Si tu veux importer une année différente de l'année en cours : `powershell -File ./tools/import-dropbox.ps1 -Year 2025`.

**Pour l'usage au quotidien depuis l'iPhone sans passer par le PC**, ce dossier n'est pas nécessaire : envoie directement `portefeuille_cartes.csv` et `portefeuille_items.csv` (via le Partage iOS) dans le Projet claude.ai dédié — voir [`../docs/DEPLOIEMENT.md`](../docs/DEPLOIEMENT.md).
