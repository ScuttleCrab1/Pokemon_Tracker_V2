# Dépose tes CSV ici

Pose directement dans ce dossier (pas dans `traites/`) tes exports iEstim, nommés :

- `MMJJ.csv` → export **cartes** du jour JJ/MM (année en cours par défaut). Exemple : `0705.csv` = 5 juillet.
- `scelles-MMJJ.csv` → export **scellés** (format pas encore défini, sera ignoré avec un avertissement pour l'instant).

Puis lance, depuis la racine du projet :

```powershell
powershell -File ./tools/import-dropbox.ps1
```

Chaque fichier devient un snapshot daté dans `data/snapshots/cartes/` (ou `scelles/`), ajouté dans `data/index.json`, et le CSV est déplacé dans `traites/` pour ne pas être réimporté par erreur. Le site les affichera automatiquement dans l'ordre chronologique, quel que soit l'ordre dans lequel tu les as déposés/traités.

Si tu veux importer une année différente de l'année en cours : `powershell -File ./tools/import-dropbox.ps1 -Year 2025`.
