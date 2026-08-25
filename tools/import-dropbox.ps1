<#
.SYNOPSIS
  Importe tous les CSV posés dans csv-a-importer/ vers des snapshots datés,
  dans l'ordre chronologique, sans avoir besoin de Python/Node (indisponibles
  sur cette machine).

.NOTES
  Deux conventions acceptées dans csv-a-importer/ :

  1) Fichiers à plat, nommés par date :
       MMJJ.csv           -> export cartes du JJ/MM de l'année en cours (ex: 0705.csv = 5 juillet)
       scelles-MMJJ.csv    -> export scellés du JJ/MM

  2) Dossiers datés contenant les vrais noms iEstim (comme sur l'iPhone) :
       csv-a-importer/0705/portefeuille_cartes.csv
       csv-a-importer/0705/portefeuille_items.csv
     (le nom du dossier porte la date MMJJ ; le nom du fichier porte le type)

  Chaque fichier traité est déplacé dans csv-a-importer/traites/ (et le dossier
  daté supprimé s'il est vide) pour ne pas être réimporté par erreur. Relancer
  avec -Force pour retraiter un fichier déjà présent dans traites/.

  Le format "objets scellés" n'est pas encore défini (colonnes de
  portefeuille_items.csv inconnues) : ces fichiers sont détectés mais ignorés
  avec un avertissement en attendant.

  La logique de slug/id est IDENTIQUE à js/matching.js, ingest/ingest.py et
  docs/CLAUDE_PROJECT_INSTRUCTIONS.md - garder les quatre synchronisés si elle change.

.EXAMPLE
  powershell -File ./tools/import-dropbox.ps1
  powershell -File ./tools/import-dropbox.ps1 -Year 2025
#>
param(
  [int]$Year = 2026,
  [switch]$Force
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$dropDir = Join-Path $root "csv-a-importer"
$doneDir = Join-Path $dropDir "traites"
New-Item -ItemType Directory -Force -Path $doneDir | Out-Null

function Slugify($s) {
  if (-not $s) { return "" }
  $normalized = $s.ToString().Normalize([Text.NormalizationForm]::FormD)
  $sb = New-Object System.Text.StringBuilder
  foreach ($c in $normalized.ToCharArray()) {
    $cat = [Globalization.CharUnicodeInfo]::GetUnicodeCategory($c)
    if ($cat -ne [Globalization.UnicodeCategory]::NonSpacingMark) { [void]$sb.Append($c) }
  }
  $ascii = $sb.ToString().ToLowerInvariant()
  $slug = [regex]::Replace($ascii, '[^a-z0-9]+', '-')
  return $slug.Trim('-')
}

function Import-CartesCsv($csvPath) {
  $csv = Import-Csv -Path $csvPath -Encoding UTF8
  $items = foreach ($row in $csv) {
    $prixAchatRaw = ($row.'Prix Achat' -replace '[^\d,\.]', '') -replace ',', '.'
    $prixAchat = if ($prixAchatRaw) { [math]::Round([double]$prixAchatRaw, 2) } else { 0 }
    $prixActuel = if ($row.'Prix Actuel') { [math]::Round([double]$row.'Prix Actuel', 2) } else { 0 }
    $baseId = (Slugify $row.Nom) + '-' + (Slugify $row.'Numéro') + '-' + (Slugify $row.'Série') + '-' + (Slugify $row.'État') + '-' + (Slugify $row.Version)
    [PSCustomObject][ordered]@{
      baseId = $baseId
      nom = $row.Nom
      numero = $row.'Numéro'
      serie = $row.'Série'
      bloc = $row.Bloc
      etat = $row.'État'
      version = $row.Version
      langue = $row.'Langue Carte'
      gradationSociete = $row.'Société de gradation'
      gradationNote = $row.'Note de gradation'
      prixAchat = $prixAchat
      prixActuel = $prixActuel
    }
  }

  $counts = @{}
  foreach ($it in $items) {
    if ($counts.ContainsKey($it.baseId)) {
      $counts[$it.baseId]++
      $it | Add-Member -NotePropertyName id -NotePropertyValue ($it.baseId + '-' + $counts[$it.baseId])
    } else {
      $counts[$it.baseId] = 1
      $it | Add-Member -NotePropertyName id -NotePropertyValue $it.baseId
    }
  }
  return $items | Select-Object id,nom,numero,serie,bloc,etat,version,langue,gradationSociete,gradationNote,prixAchat,prixActuel
}

function Update-Index($type, $timestamp, $path, $count, $label) {
  $indexPath = Join-Path $root "data/index.json"
  $index = Get-Content -Raw -Encoding UTF8 $indexPath | ConvertFrom-Json
  $existing = @($index.$type | Where-Object { $_.timestamp -ne $timestamp })
  $newEntry = [PSCustomObject][ordered]@{ timestamp = $timestamp; path = $path; count = $count; label = $label }
  $updated = @($existing) + $newEntry | Sort-Object timestamp
  $index.$type = $updated
  $index | ConvertTo-Json -Depth 6 | Out-File -FilePath $indexPath -Encoding utf8
}

function Get-TimestampFromDatePart($datePart, $sourceLabel) {
  if ($datePart -notmatch '^\d{4}$') {
    Write-Warning "Date illisible (attendu MMJJ) : $sourceLabel"
    return $null
  }
  $month = $datePart.Substring(0, 2)
  $day = $datePart.Substring(2, 2)
  try {
    $date = Get-Date -Year $Year -Month ([int]$month) -Day ([int]$day)
  } catch {
    Write-Warning "Date invalide : $sourceLabel (mois=$month jour=$day)"
    return $null
  }
  return $date.ToString("yyyy-MM-ddT0000")
}

function Import-CartesFile($csvFile, $timestamp, $sourceLabel) {
  $items = Import-CartesCsv $csvFile.FullName
  $outDir = Join-Path $root "data/snapshots/cartes"
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $outPath = Join-Path $outDir "$timestamp.json"
  $snapshot = [ordered]@{ timestamp = $timestamp; source = $sourceLabel; items = $items }
  $snapshot | ConvertTo-Json -Depth 5 | Out-File -FilePath $outPath -Encoding utf8

  Update-Index -type "cartes" -timestamp $timestamp -path "data/snapshots/cartes/$timestamp.json" -count $items.Count -label "Import $sourceLabel"

  $total = ($items | Measure-Object -Property prixActuel -Sum).Sum
  Write-Host "OK $sourceLabel -> $timestamp (cartes, $($items.Count) items, $([math]::Round($total,2)) EUR)"
}

# --- Convention 1 : fichiers a plat MMJJ.csv / scelles-MMJJ.csv ---
$flatFiles = Get-ChildItem -Path $dropDir -Filter "*.csv" -File
foreach ($file in $flatFiles) {
  $name = $file.BaseName
  if ($name -match '^scelles-(\d{4})$') {
    Write-Warning "Format scelles pas encore defini - fichier ignore : $($file.Name)"
    continue
  }
  if ($name -notmatch '^\d{4}$') {
    Write-Warning "Nom de fichier ignore (attendu MMJJ.csv ou scelles-MMJJ.csv, ou depose-le dans un dossier date, voir portefeuille_*.csv) : $($file.Name)"
    continue
  }
  $timestamp = Get-TimestampFromDatePart $name $file.Name
  if (-not $timestamp) { continue }

  Import-CartesFile $file $timestamp $file.Name
  Move-Item -Path $file.FullName -Destination (Join-Path $doneDir $file.Name) -Force:$Force
}

# --- Convention 2 : dossiers dates contenant portefeuille_cartes.csv / portefeuille_items.csv ---
$dateFolders = Get-ChildItem -Path $dropDir -Directory | Where-Object { $_.Name -ne "traites" -and $_.Name -match '^\d{4}$' }
foreach ($folder in $dateFolders) {
  $timestamp = Get-TimestampFromDatePart $folder.Name $folder.Name
  if (-not $timestamp) { continue }

  $cartesFile = Join-Path $folder.FullName "portefeuille_cartes.csv"
  $itemsFile = Join-Path $folder.FullName "portefeuille_items.csv"

  if (Test-Path $cartesFile) {
    Import-CartesFile (Get-Item $cartesFile) $timestamp "$($folder.Name)/portefeuille_cartes.csv"
  }
  if (Test-Path $itemsFile) {
    Write-Warning "Format scelles pas encore defini - portefeuille_items.csv ignore ($($folder.Name))"
  }

  $destFolder = Join-Path $doneDir $folder.Name
  Move-Item -Path $folder.FullName -Destination $destFolder -Force:$Force
}

if ($flatFiles.Count -eq 0 -and $dateFolders.Count -eq 0) {
  Write-Host "Aucun CSV a traiter dans $dropDir"
}
