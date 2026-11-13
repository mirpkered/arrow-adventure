param([string]$OutputDirectory = "docs/previews/round-9h")

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
Set-Location $repoRoot
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$paper = [System.Drawing.ColorTranslator]::FromHtml("#F7F7F2")
$ink = [System.Drawing.ColorTranslator]::FromHtml("#30373E")
$gridInk = [System.Drawing.ColorTranslator]::FromHtml("#E5E7E1")
$muted = [System.Drawing.ColorTranslator]::FromHtml("#7F888B")
$accent = [System.Drawing.ColorTranslator]::FromHtml("#3857A4")
$heart = [System.Drawing.ColorTranslator]::FromHtml("#D96662")
$hDocument = Get-Content -Raw "src/game/prototypes/round9h-square-true-7.json" | ConvertFrom-Json
$gDocument = Get-Content -Raw "src/game/prototypes/round9g-square-7-weave.json" | ConvertFrom-Json
$hLevel = $hDocument.puzzle
$gLevel = $gDocument.puzzle
$hGrid = $hLevel.grid
$gGrid = [pscustomobject]@{ spacing = 0.5; origin = [pscustomobject]@{ x = 0; y = 0 }; pathOffset = 0.5 }

function World-Point($Point, $Grid) {
  return [pscustomobject]@{ x = [double]$Point.x + [double]$Grid.pathOffset; y = [double]$Point.y + [double]$Grid.pathOffset }
}

function Map-World($Point, $View) {
  return [System.Drawing.PointF]::new(
    [single]($View.left + ($Point.x - $View.worldX) * $View.scaleX),
    [single]($View.top + ($Point.y - $View.worldY) * $View.scaleY)
  )
}

function Arrow-Head($Arrow, $Grid) {
  $head = $Arrow.path[-1]; $previous = $Arrow.path[-2]
  $dx = [double]$head.x - [double]$previous.x; $dy = [double]$head.y - [double]$previous.y
  $length = [Math]::Sqrt($dx * $dx + $dy * $dy); $dx /= $length; $dy /= $length
  $px = -$dy; $py = $dx; $center = World-Point $head $Grid
  $tip = [pscustomobject]@{ x = $center.x + $dx * 0.36; y = $center.y + $dy * 0.36 }
  $base = [pscustomobject]@{ x = $center.x + $dx * 0.07; y = $center.y + $dy * 0.07 }
  return @(
    $tip,
    [pscustomobject]@{ x = $base.x + $px * 0.17; y = $base.y + $py * 0.17 },
    [pscustomobject]@{ x = $base.x - $px * 0.17; y = $base.y - $py * 0.17 }
  )
}

function Draw-Board($Graphics, $Level, $Grid, $View, [bool]$OnlyCorridors = $false, [bool]$Diagnostic = $false) {
  $scale = [single][Math]::Min($View.scaleX, $View.scaleY)
  $intervalX = [Math]::Round([double]$Level.width / [double]$Grid.spacing)
  $intervalY = [Math]::Round([double]$Level.height / [double]$Grid.spacing)
  $majorEvery = [Math]::Max(1, [Math]::Round(1 / [double]$Grid.spacing))
  for ($i = 0; $i -le $intervalX; $i++) {
    $x = [double]$Grid.origin.x + $i * [double]$Grid.spacing
    $pen = [System.Drawing.Pen]::new($gridInk, [single]($(if ($i % $majorEvery -eq 0) { 0.03 } else { 0.025 }) * $scale))
    $screenX = $View.left + ($x - $View.worldX) * $View.scaleX
    $Graphics.DrawLine($pen, [single]$screenX, [single]$View.top, [single]$screenX, [single]($View.top + $Level.height * $View.scaleY))
    $pen.Dispose()
  }
  for ($i = 0; $i -le $intervalY; $i++) {
    $y = [double]$Grid.origin.y + $i * [double]$Grid.spacing
    $pen = [System.Drawing.Pen]::new($gridInk, [single]($(if ($i % $majorEvery -eq 0) { 0.03 } else { 0.025 }) * $scale))
    $screenY = $View.top + ($y - $View.worldY) * $View.scaleY
    $Graphics.DrawLine($pen, [single]$View.left, [single]$screenY, [single]($View.left + $Level.width * $View.scaleX), [single]$screenY)
    $pen.Dispose()
  }

  foreach ($arrow in $Level.arrows) {
    $points = @($arrow.path | ForEach-Object { Map-World (World-Point $_ $Grid) $View })
    $bodyColor = if ($OnlyCorridors) { [System.Drawing.ColorTranslator]::FromHtml("#75828E") } else { $ink }
    $linePen = [System.Drawing.Pen]::new($bodyColor, [single](0.12 * $scale))
    $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $linePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $Graphics.DrawLines($linePen, [System.Drawing.PointF[]]$points)
    $linePen.Dispose()
    if ($OnlyCorridors) { continue }

    $headPoints = @(Arrow-Head $arrow $Grid | ForEach-Object { Map-World $_ $View })
    $head = [System.Drawing.PointF[]]$headPoints
    $Graphics.FillPolygon([System.Drawing.SolidBrush]::new($ink), $head)
    $headPen = [System.Drawing.Pen]::new($paper, [single](0.025 * $scale)); $headPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $Graphics.DrawPolygon($headPen, $head); $headPen.Dispose()

    $tail = Map-World (World-Point $arrow.path[0] $Grid) $View
    $rx = [single](0.09 * $View.scaleX); $ry = [single](0.09 * $View.scaleY)
    $Graphics.FillEllipse([System.Drawing.SolidBrush]::new($paper), $tail.X - $rx, $tail.Y - $ry, 2 * $rx, 2 * $ry)
    $tailPen = [System.Drawing.Pen]::new($ink, [single](0.025 * $scale))
    $Graphics.DrawEllipse($tailPen, $tail.X - $rx, $tail.Y - $ry, 2 * $rx, 2 * $ry); $tailPen.Dispose()

    if ($Diagnostic) {
      $mid = $arrow.path[[Math]::Floor(($arrow.path.Count - 1) / 2)]
      $center = Map-World (World-Point $mid $Grid) $View
      $fontSize = [single][Math]::Max(10, 0.22 * $scale)
      $font = [System.Drawing.Font]::new("Arial", $fontSize, [System.Drawing.FontStyle]::Bold)
      $measure = $Graphics.MeasureString($arrow.id, $font)
      $rect = [System.Drawing.RectangleF]::new($center.X - $measure.Width / 2, $center.Y - $measure.Height / 2, $measure.Width, $measure.Height)
      $Graphics.FillRectangle([System.Drawing.SolidBrush]::new($paper), $rect)
      $Graphics.DrawString($arrow.id, $font, [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml("#AF503E")), $rect.X, $rect.Y)
      $font.Dispose()
    }
  }
}

function New-CompositionView($Level, $Grid, [double]$pixelWidth, [double]$pixelHeight, [double]$screenLeft, [double]$screenTop, [double]$screenWidth, [double]$screenHeight) {
  $points = [System.Collections.Generic.List[object]]::new()
  foreach ($arrow in $Level.arrows) {
    foreach ($point in $arrow.path) { $points.Add((World-Point $point $Grid)) }
    foreach ($point in (Arrow-Head $arrow $Grid)) { $points.Add($point) }
    $tail = World-Point $arrow.path[0] $Grid
    $points.Add([pscustomobject]@{ x = $tail.x - 0.09; y = $tail.y - 0.09 })
    $points.Add([pscustomobject]@{ x = $tail.x + 0.09; y = $tail.y + 0.09 })
  }
  $pad = 0.06
  $minX = ($points | Measure-Object -Property x -Minimum).Minimum - $pad
  $maxX = ($points | Measure-Object -Property x -Maximum).Maximum + $pad
  $minY = ($points | Measure-Object -Property y -Minimum).Minimum - $pad
  $maxY = ($points | Measure-Object -Property y -Maximum).Maximum + $pad
  $contentWidth = $maxX - $minX; $contentHeight = $maxY - $minY
  $aspect = $screenWidth / $screenHeight
  $viewWidth = [Math]::Max($contentWidth * 1.24, $contentHeight * 1.24 * $aspect)
  $viewHeight = $viewWidth / $aspect
  $centerX = ($minX + $maxX) / 2; $centerY = ($minY + $maxY) / 2
  return [pscustomobject]@{
    left = $screenLeft; top = $screenTop; worldX = $centerX - $viewWidth / 2; worldY = $centerY - $viewHeight / 2
    scaleX = $screenWidth / $viewWidth; scaleY = $screenHeight / $viewHeight
  }
}

function Save-SquarePreview([string]$Name, [bool]$OnlyCorridors, [bool]$Diagnostic) {
  $bitmap = [System.Drawing.Bitmap]::new(1000, 1000); $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias; $graphics.Clear($paper)
  $view = [pscustomobject]@{ left = 150; top = 150; worldX = 0; worldY = 0; scaleX = 100; scaleY = 100 }
  Draw-Board $graphics $hLevel $hGrid $view $OnlyCorridors $Diagnostic
  $bitmap.Save((Join-Path $OutputDirectory $Name), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
}

Save-SquarePreview "true-grid-7x7.png" $false $false
Save-SquarePreview "true-grid-7x7-ids.png" $false $true
Save-SquarePreview "true-grid-7x7-corridors.png" $true $false

# Independently inspectable grid: 8 positions per axis means exactly 7 visible cells.
$diagnostic = [System.Drawing.Bitmap]::new(1100, 1100); $graphics = [System.Drawing.Graphics]::FromImage($diagnostic)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias; $graphics.Clear($paper)
$gridView = [pscustomobject]@{ left = 200; top = 250; worldX = 0; worldY = 0; scaleX = 100; scaleY = 100 }
Draw-Board $graphics $hLevel $hGrid $gridView $true $false
$coordFont = [System.Drawing.Font]::new("Arial", 15, [System.Drawing.FontStyle]::Regular)
$coordBrush = [System.Drawing.SolidBrush]::new($muted)
for ($coordinate = 0; $coordinate -le 7; $coordinate++) {
  $graphics.DrawString("$coordinate", $coordFont, $coordBrush, 196 + $coordinate * 100, 222)
  $graphics.DrawString("$coordinate", $coordFont, $coordBrush, 172, 242 + $coordinate * 100)
}
$labelFont = [System.Drawing.Font]::new("Arial", 22, [System.Drawing.FontStyle]::Bold)
$graphics.DrawString("TRUE GRID: 7 CELLS X 7 CELLS - 8 INTERSECTIONS EACH AXIS", $labelFont, [System.Drawing.SolidBrush]::new($ink), 110, 55)
$diagnostic.Save((Join-Path $OutputDirectory "true-grid-diagnostic.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $diagnostic.Dispose(); $coordFont.Dispose(); $coordBrush.Dispose(); $labelFont.Dispose()

# Portrait preview follows the app's board-wrap size, safe-area insets, composition bounds, and 12% fit padding.
$phone = [System.Drawing.Bitmap]::new(390, 844); $graphics = [System.Drawing.Graphics]::FromImage($phone)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias; $graphics.Clear($paper)
$safeTop = 59; $safeBottom = 34; $side = 14; $header = 58; $prompt = 31; $footer = 32
$boardTop = $safeTop + $header + $prompt; $boardHeight = 844 - $safeTop - $safeBottom - $header - $prompt - $footer
$boardWidth = 390 - 2 * $side
$phoneView = New-CompositionView $hLevel $hGrid 390 844 $side $boardTop $boardWidth $boardHeight
$hudFont = [System.Drawing.Font]::new("Arial", 15, [System.Drawing.FontStyle]::Bold)
$symbolFont = [System.Drawing.Font]::new("Segoe UI Symbol", 20, [System.Drawing.FontStyle]::Regular)
$heartFont = [System.Drawing.Font]::new("Segoe UI Symbol", 21, [System.Drawing.FontStyle]::Bold)
$smallFont = [System.Drawing.Font]::new("Arial", 11, [System.Drawing.FontStyle]::Regular)
$graphics.DrawString("LEVEL 01", $hudFont, [System.Drawing.SolidBrush]::new($ink), 22, $safeTop + 18)
$heartText = [string][char]0x2665 + "  " + [string][char]0x2665 + "  " + [string][char]0x2665
$graphics.DrawString($heartText, $heartFont, [System.Drawing.SolidBrush]::new($heart), 218, $safeTop + 11)
$graphics.DrawEllipse([System.Drawing.Pen]::new($accent, 1.5), 345, $safeTop + 12, 27, 27)
$graphics.DrawString([string][char]0x21BB, $symbolFont, [System.Drawing.SolidBrush]::new($accent), 347, $safeTop + 11)
$promptFont = [System.Drawing.Font]::new("Arial", 11, [System.Drawing.FontStyle]::Regular)
$graphics.DrawString("Find an arrow with a clear path out.", $promptFont, [System.Drawing.SolidBrush]::new($muted), 100, $safeTop + $header + 8)
Draw-Board $graphics $hLevel $hGrid $phoneView $false $false
$graphics.DrawString("15 arrows remaining", $smallFont, [System.Drawing.SolidBrush]::new($muted), 22, 844 - $safeBottom - 22)
$graphics.DrawString("1 / 10", $smallFont, [System.Drawing.SolidBrush]::new($muted), 328, 844 - $safeBottom - 22)
$phone.Save((Join-Path $OutputDirectory "true-grid-7x7-iphone.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $phone.Dispose(); $hudFont.Dispose(); $symbolFont.Dispose(); $heartFont.Dispose(); $smallFont.Dispose(); $promptFont.Dispose()

# Same board-space scale on both sides, while explicitly identifying their different visible lattices.
$comparison = [System.Drawing.Bitmap]::new(2050, 1120); $graphics = [System.Drawing.Graphics]::FromImage($comparison)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias; $graphics.Clear($paper)
$titleFont = [System.Drawing.Font]::new("Arial", 25, [System.Drawing.FontStyle]::Bold)
$subtitleFont = [System.Drawing.Font]::new("Arial", 15, [System.Drawing.FontStyle]::Regular)
$label = [System.Drawing.SolidBrush]::new($ink); $subLabel = [System.Drawing.SolidBrush]::new($muted)
$graphics.DrawString("ROUND 9G - 14x14 VISIBLE SUBCELLS", $titleFont, $label, 35, 18)
$graphics.DrawString("7 board units - 15 grid intersections per axis", $subtitleFont, $subLabel, 35, 52)
$graphics.DrawString("ROUND 9H - TRUE 7x7 VISIBLE CELLS", $titleFont, $label, 1055, 18)
$graphics.DrawString("7 cells - 8 grid intersections per axis", $subtitleFont, $subLabel, 1055, 52)
$gView = [pscustomobject]@{ left = 175; top = 100; worldX = 0; worldY = 0; scaleX = 100; scaleY = 100 }
$hView = [pscustomobject]@{ left = 1195; top = 100; worldX = 0; worldY = 0; scaleX = 100; scaleY = 100 }
Draw-Board $graphics $gLevel $gGrid $gView $false $false
Draw-Board $graphics $hLevel $hGrid $hView $false $false
$comparison.Save((Join-Path $OutputDirectory "round9g-vs-round9h-visible-grid.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $comparison.Dispose(); $titleFont.Dispose(); $subtitleFont.Dispose(); $label.Dispose(); $subLabel.Dispose()
