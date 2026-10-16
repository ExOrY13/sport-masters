# Usage (depuis le dossier du jeu) :  powershell -ExecutionPolicy Bypass -File tools\check-titles.ps1
param([string]$DataFile = (Join-Path (Split-Path $PSScriptRoot -Parent) 'js\data.js'))
# Verifie que chaque titre Wikipedia pointe bien vers un sportif (pas une homonymie / un homonyme)
$data = Get-Content -Raw -Encoding UTF8 $DataFile
$titles = [regex]::Matches($data, '\[\s*"\w+",\s*"([^"]+)",\s*"[a-z-]+",\s*"(?:C|PC|R|SR|UR|L|S)"') | ForEach-Object { $_.Groups[1].Value }
$ok = 'joueu|footballeu|basketteu|tennism|pilote|boxeu|athl|nageu|nageuse|cycliste|rugby|judok|lutteu|golfeu|hockey|skieu|biathl|fondeu|patineu|surfeu|gymnaste|escrimeu|handball|volley|pongiste|navigat|skateu|grimpeu|triathl|plongeu|kayak|canoe|canoë|sprinteu|marathon|perchiste|sauteu|lanceu|arts martiaux|combattant|karat|taekwond|kickbox|motocycl|sportif|sportive|badminton|quarterback|entraîneu|décathl|heptathl|coureu|hurdl|snowboard|freestyle|haltér|cavali|champion|gardien|dirigeant|homme politique'
for ($i = 0; $i -lt $titles.Count; $i += 50) {
  $chunk = @($titles[$i..([Math]::Min($i + 49, $titles.Count - 1))])
  $body = @{ action="query"; prop="description"; redirects="1"; format="json"; formatversion="2"; titles=($chunk -join "|") }
  $r = $null
  for ($try = 1; -not $r; $try++) {
    try { $r = Invoke-RestMethod -Uri "https://fr.wikipedia.org/w/api.php" -Method Post -Body $body -UserAgent "SportMasters/1.0 (audit)" }
    catch { if ($try -ge 5) { throw }; Start-Sleep -Seconds ($try * 15) }
  }
  $redir = @{}
  foreach ($n in @($r.query.redirects)) { if ($n) { $redir[$n.to] = $n.from } }
  foreach ($p in $r.query.pages) {
    $from = if ($redir.ContainsKey($p.title)) { "$($redir[$p.title]) => $($p.title)" } else { $p.title }
    if ($p.missing) { "INTROUVABLE : $from"; continue }
    $d = "$($p.description)"
    if ($d -match 'homonymie') { "HOMONYMIE   : $from"; continue }
    if ($d -notmatch $ok) { "A VERIFIER  : $from -> $d" }
  }
  Start-Sleep -Seconds 2
}
"Audit termine sur $($titles.Count) titres."
