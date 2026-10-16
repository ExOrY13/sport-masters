# Publie la version actuelle du jeu sur GitHub Pages (https://exory13.github.io/sport-masters/)
# Usage (depuis le dossier du jeu) :  powershell -ExecutionPolicy Bypass -File publier.ps1 "Ce que j'ai change"
param([string]$Message = "Mise a jour du jeu")
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
$env:Path = "C:\Program Files\Git\cmd;C:\Program Files\GitHub CLI;" + $env:Path

# 1. Nouveau numero de version sur les fichiers CSS/JS : force les navigateurs a recharger la nouvelle version
$html = [IO.File]::ReadAllText("index.html", [Text.Encoding]::UTF8)
$version = [int]([regex]::Match($html, '\?v=(\d+)').Groups[1].Value) + 1
$html = [regex]::Replace($html, '\?v=\d+', "?v=$version")
[IO.File]::WriteAllText("index.html", $html, (New-Object Text.UTF8Encoding $false))

# 2. Enregistrement + envoi sur GitHub
git add -A
git commit -q -m "$Message (v$version)"
git push -q
Write-Host "Version $version envoyee. Le site se met a jour dans environ 1 minute :"
Write-Host "https://exory13.github.io/sport-masters/"
