# Recupere les photos Wikipedia de toutes les cartes et genere js/photos-map.js
# Usage (depuis le dossier du jeu) :  powershell -ExecutionPolicy Bypass -File tools\update-photos.ps1
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$data = Get-Content -Raw -Encoding UTF8 (Join-Path $root "js\data.js")
$titles = [regex]::Matches($data, '\[\s*"\w+",\s*"([^"]+)",\s*"[a-z-]+",\s*"(?:C|PC|R|SR|UR|L)"') | ForEach-Object { $_.Groups[1].Value }
$dupes = $titles | Group-Object | Where-Object Count -gt 1
foreach ($d in $dupes) { "EN DOUBLE DANS LA LISTE : $($d.Name)" }

$missingPages = New-Object System.Collections.ArrayList

function Get-Images($lang, $list, $reportMissing) {
  $map = @{}
  for ($i = 0; $i -lt $list.Count; $i += 40) {
    $chunk = @($list[$i..([Math]::Min($i + 39, $list.Count - 1))])
    $body = @{ action = "query"; prop = "pageimages"; piprop = "thumbnail"; pithumbsize = "500"; redirects = "1"; format = "json"; formatversion = "2"; titles = ($chunk -join "|") }
    $r = $null
    for ($try = 1; -not $r; $try++) {
      try { $r = Invoke-RestMethod -Uri "https://$lang.wikipedia.org/w/api.php" -Method Post -Body $body -UserAgent "SportMasters/1.0 (jeu local)" }
      catch { if ($try -ge 4) { throw }; Write-Host "Wikipedia demande de patienter, nouvel essai dans $($try * 15) s..."; Start-Sleep -Seconds ($try * 15) }
    }
    # retrouve le titre d'origine en suivant normalisations et redirections
    $back = @{}
    foreach ($t in $chunk) { $back[$t] = $t }
    foreach ($n in @($r.query.normalized) + @($r.query.redirects)) { if ($n -and $back.ContainsKey($n.from)) { $back[$n.to] = $back[$n.from] } }
    foreach ($p in $r.query.pages) {
      if (-not $back.ContainsKey($p.title)) { continue }
      if ($p.missing -and $reportMissing) { [void]$missingPages.Add($back[$p.title]) }
      elseif ($p.thumbnail) { $map[$back[$p.title]] = $p.thumbnail.source }
    }
    Start-Sleep -Milliseconds 800
  }
  return $map
}

$found = Get-Images "fr" $titles $true
$noImg = @($titles | Where-Object { -not $found.ContainsKey($_) -and -not $missingPages.Contains($_) })
if ($noImg.Count) {
  $en = Get-Images "en" $noImg $false
  foreach ($k in $en.Keys) { $found[$k] = $en[$k] }
}

$lines = $titles | Select-Object -Unique | ForEach-Object {
  $v = if ($found.ContainsKey($_)) { '"' + $found[$_] + '"' } else { "null" }
  '  "' + $_.Replace('"', '\"') + '": ' + $v
}
$header = "// Genere automatiquement par tools/update-photos.ps1 - ne pas modifier a la main"
$js = "$header`nconst PHOTO_MAP = {`n" + ($lines -join ",`n") + "`n};`n"
[IO.File]::WriteAllText((Join-Path $root "js\photos-map.js"), $js, (New-Object Text.UTF8Encoding $false))

"Cartes : $($titles.Count) - photos trouvees : $($found.Count)"
foreach ($m in $missingPages) { "PAGE INTROUVABLE sur fr.wikipedia : $m" }
$titles | Where-Object { -not $found.ContainsKey($_) -and -not $missingPages.Contains($_) } | ForEach-Object { "SANS PHOTO : $_" }
