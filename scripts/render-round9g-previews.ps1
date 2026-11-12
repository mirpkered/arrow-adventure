param([string]$OutputDirectory = "docs/previews/round-9g")

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$prototypePath = "src/game/prototypes/round9g-square-7-weave.json"
$renderer = Join-Path $PSScriptRoot "render-round9f-previews.ps1"
& pwsh -NoProfile -File $renderer -InputFile $prototypePath -OutputDirectory $OutputDirectory
if ($LASTEXITCODE -ne 0) { throw "Round 9G game-style preview rendering failed" }
& pwsh -NoProfile -File $renderer -InputFile $prototypePath -OutputDirectory $OutputDirectory -CorridorPlan
if ($LASTEXITCODE -ne 0) { throw "Round 9G corridor preview rendering failed" }

Copy-Item (Join-Path $OutputDirectory "square-weave-7.png") (Join-Path $OutputDirectory "square-weave-7-weave.png") -Force
Copy-Item (Join-Path $OutputDirectory "square-weave-7-iphone.png") (Join-Path $OutputDirectory "square-weave-7-weave-iphone.png") -Force
Copy-Item (Join-Path $OutputDirectory "square-weave-7-diagnostic.png") (Join-Path $OutputDirectory "square-weave-7-weave-diagnostic.png") -Force

Add-Type -AssemblyName System.Drawing
function Color([string]$Hex) { [System.Drawing.ColorTranslator]::FromHtml($Hex) }
$comparison = [System.Drawing.Bitmap]::new(2050, 1080)
$graphics = [System.Drawing.Graphics]::FromImage($comparison)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear((Color "#F7F7F2"))
$titleFont = [System.Drawing.Font]::new("Arial", 28, [System.Drawing.FontStyle]::Bold)
$labelBrush = [System.Drawing.SolidBrush]::new((Color "#30373E"))
$graphics.DrawString("ROUND 9F · COMPACT SQUARE", $titleFont, $labelBrush, 30, 20)
$graphics.DrawString("ROUND 9G · INTERWOVEN SQUARE", $titleFont, $labelBrush, 1050, 20)
$round9f = [System.Drawing.Image]::FromFile((Join-Path $repoRoot "docs/previews/round-9f/square-weave-7.png"))
$round9g = [System.Drawing.Image]::FromFile((Join-Path $OutputDirectory "square-weave-7.png"))
$graphics.DrawImage($round9f, 25, 70, 1000, 1000)
$graphics.DrawImage($round9g, 1025, 70, 1000, 1000)
$comparison.Save((Join-Path $OutputDirectory "round9f-vs-round9g.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $comparison.Dispose(); $round9f.Dispose(); $round9g.Dispose(); $titleFont.Dispose(); $labelBrush.Dispose()
Remove-Item -LiteralPath (Join-Path $OutputDirectory "square-weave-7.png"), (Join-Path $OutputDirectory "square-weave-7-diagnostic.png"), (Join-Path $OutputDirectory "square-weave-7-iphone.png")
