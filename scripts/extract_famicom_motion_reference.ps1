param(
    [Parameter(Mandatory = $true)]
    [string]$VideoPath
)

$ErrorActionPreference = 'Stop'
$outputDir = Join-Path $PSScriptRoot '..\reference\famicom-motion'
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

ffmpeg -y -v error -i $VideoPath -vf "fps=1/60,scale=320:-1,tile=6x5:padding=4:margin=4" -frames:v 1 (Join-Path $outputDir 'overview-60s.jpg')

$segments = @(
    @{ Name = 'opening'; Start = 0; Duration = 120 },
    @{ Name = 'early-rallies'; Start = 120; Duration = 180 },
    @{ Name = 'mid-rallies'; Start = 600; Duration = 180 },
    @{ Name = 'late-rallies'; Start = 1200; Duration = 180 }
)

foreach ($segment in $segments) {
    $out = Join-Path $outputDir ($segment.Name + '.jpg')
    ffmpeg -y -v error -ss $segment.Start -t $segment.Duration -i $VideoPath -vf "fps=1/5,scale=320:-1,tile=6x6:padding=4:margin=4" -frames:v 1 $out
}

Get-ChildItem -LiteralPath $outputDir -Filter '*.jpg' | Select-Object -ExpandProperty FullName
