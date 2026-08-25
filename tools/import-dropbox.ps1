<#
.SYNOPSIS
  Importe tous les CSV posés dans csv-a-importer/ vers des snapshots datés,
  dans l'ordre chronologique, sans avoir besoin de Python/Node (indisponibles
  sur cette machine).

.NOTES
  Convention de nom de fichier dans csv-a-importer/ :
    MMJJ.csv           -> export cartes du JJ/MM de l'année en cours (ex: 0705.csv = 5 juillet)
    scelles-MMJJ.csv    -> export scellés du JJ/MM

  Chaque fichier traité est déplacé dans csv-a-importer/traites/ pour ne pas
  être réimporté par erreur. Relancer avec -Force pour retraiter un fichier
  déjà présent dans traites/.

  La logique de slug/id est IDENTIQUE à js/matching.js et ingest/ingest.py -
  garder les trois synchronisés si elle change.

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

$files = Get-ChildItem -Path $dropDir -Filter "*.csv" -File
if ($files.Count -eq 0) {
  Write-Host "Aucun CSV a traiter dans $dropDir"
  return
}

foreach ($file in $files) {
  $name = $file.BaseName  # sans extension
  $type = "cartes"
  $datePart = $name

  if ($name -match '^scelles-(\d{4})$') {
    $type = "scelles"
    $datePart = $Matches[1]
  } elseif ($name -notmatch '^\d{4}$') {
    Write-Warning "Nom de fichier ignore (attendu MMJJ.csv ou scelles-MMJJ.csv) : $($file.Name)"
    continue
  }

  $month = $datePart.Substring(0, 2)
  $day = $datePart.Substring(2, 2)
  try {
    $date = Get-Date -Year $Year -Month ([int]$month) -Day ([int]$day)
  } catch {
    Write-Warning "Date invalide dans le nom de fichier : $($file.Name) (mois=$month jour=$day)"
    continue
  }
  $timestamp = $date.ToString("yyyy-MM-ddT0000")

  if ($type -eq "cartes") {
    $items = Import-CartesCsv $file.FullName
  } else {
    Write-Warning "Format scelles pas encore defini - fichier ignore : $($file.Name)"
    continue
  }

  $outDir = Join-Path $root "data/snapshots/$type"
  New-Item -ItemType Directory -Force -Path $outDir | Out-Null
  $outPath = Join-Path $outDir "$timestamp.json"
  $snapshot = [ordered]@{ timestamp = $timestamp; source = $file.Name; items = $items }
  $snapshot | ConvertTo-Json -Depth 5 | Out-File -FilePath $outPath -Encoding utf8

  Update-Index -type $type -timestamp $timestamp -path "data/snapshots/$type/$timestamp.json" -count $items.Count -label "Import $($file.Name)"

  $total = ($items | Measure-Object -Property prixActuel -Sum).Sum
  Write-Host "OK $($file.Name) -> $timestamp ($type, $($items.Count) items, $([math]::Round($total,2)) EUR)"

  Move-Item -Path $file.FullName -Destination (Join-Path $doneDir $file.Name) -Force:$Force
}
