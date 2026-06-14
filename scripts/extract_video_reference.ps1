param(
    [Parameter(Mandatory = $true)]
    [string]$VideoPath
)

$ErrorActionPreference = 'Stop'
$outputDir = Join-Path $PSScriptRoot '..\reference\video'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

$overview = Join-Path $outputDir 'overview.jpg'
ffmpeg -y -v error -i $VideoPath -vf "fps=1/10,scale=384:-1,tile=5x7:padding=4:margin=4" -frames:v 1 $overview

Write-Output $overview
