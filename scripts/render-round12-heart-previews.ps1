param([string]$OutputDirectory = 'docs/previews/round-12-heart')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

$document = Get-Content -Raw 'src/game/prototypes/round12-heart.json' | ConvertFrom-Json
$level = $document.puzzle
$footprint = $document.footprint[0]
$paper = [System.Drawing.ColorTranslator]::FromHtml('#F7F7F2')
$paperSoft = [System.Drawing.ColorTranslator]::FromHtml('#EEEFEB')
$ink = [System.Drawing.ColorTranslator]::FromHtml('#30373E')
$gridInk = [System.Drawing.ColorTranslator]::FromHtml('#DFE2DC')
$accent = [System.Drawing.ColorTranslator]::FromHtml('#3857A4')
$muted = [System.Drawing.ColorTranslator]::FromHtml('#7F888B')
$heart = [System.Drawing.ColorTranslator]::FromHtml('#D96662')

function Map-Point($Point, $View) {
  [System.Drawing.PointF]::new([single]($View.left + ($Point.x - $View.worldX) * $View.scale), [single]($View.top + ($Point.y - $View.worldY) * $View.scale))
}
function Head-Points($Arrow) {
  $head = $Arrow.path[-1]; $prev = $Arrow.path[-2]
  $dx = [double]$head.x - [double]$prev.x; $dy = [double]$head.y - [double]$prev.y
  $length = [Math]::Sqrt($dx * $dx + $dy * $dy); $dx /= $length; $dy /= $length
  $px = -$dy; $py = $dx
  return @(
    [pscustomobject]@{ x = $head.x + $dx * .36; y = $head.y + $dy * .36 },
    [pscustomobject]@{ x = $head.x + $dx * .07 + $px * .17; y = $head.y + $dy * .07 + $py * .17 },
    [pscustomobject]@{ x = $head.x + $dx * .07 - $px * .17; y = $head.y + $dy * .07 - $py * .17 }
  )
}
function New-View([double]$Left, [double]$Top, [double]$Width, [double]$Height, [double]$Padding = .055) {
  $points = [System.Collections.Generic.List[object]]::new()
  foreach ($point in $footprint) { $points.Add($point) }
  foreach ($arrow in $level.arrows) {
    foreach ($point in $arrow.path) { $points.Add($point) }
    foreach ($point in (Head-Points $arrow)) { $points.Add($point) }
    $tail = $arrow.path[0]
    $points.Add([pscustomobject]@{ x = $tail.x - .09; y = $tail.y - .09 })
    $points.Add([pscustomobject]@{ x = $tail.x + .09; y = $tail.y + .09 })
  }
  $minX = ($points | Measure-Object x -Minimum).Minimum; $maxX = ($points | Measure-Object x -Maximum).Maximum
  $minY = ($points | Measure-Object y -Minimum).Minimum; $maxY = ($points | Measure-Object y -Maximum).Maximum
  $worldWidth = $maxX - $minX; $worldHeight = $maxY - $minY
  $scale = [Math]::Min($Width / ($worldWidth * (1 + 2 * $Padding)), $Height / ($worldHeight * (1 + 2 * $Padding)))
  $viewWidth = $Width / $scale; $viewHeight = $Height / $scale
  $centerX = ($minX + $maxX) / 2; $centerY = ($minY + $maxY) / 2
  [pscustomobject]@{ left = $Left; top = $Top; width = $Width; height = $Height; scale = $scale; worldX = $centerX - $viewWidth / 2; worldY = $centerY - $viewHeight / 2 }
}
function New-ShapePath($View) {
  $mapped = [System.Collections.Generic.List[System.Drawing.PointF]]::new()
  foreach ($point in $footprint) { $mapped.Add((Map-Point $point $View)) }
  $shape = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $shape.AddPolygon($mapped.ToArray())
  return $shape
}
function Draw-HeartGlyph($Graphics, [single]$X, [single]$Y, [single]$Size) {
  $heartPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $heartPath.StartFigure()
  $heartPath.AddBezier($X+$Size*.50, $Y+$Size*.90, $X+$Size*.10, $Y+$Size*.61, $X+$Size*.06, $Y+$Size*.38, $X+$Size*.24, $Y+$Size*.24)
  $heartPath.AddBezier($X+$Size*.24, $Y+$Size*.24, $X+$Size*.37, $Y+$Size*.12, $X+$Size*.49, $Y+$Size*.24, $X+$Size*.50, $Y+$Size*.34)
  $heartPath.AddBezier($X+$Size*.50, $Y+$Size*.34, $X+$Size*.57, $Y+$Size*.18, $X+$Size*.77, $Y+$Size*.13, $X+$Size*.89, $Y+$Size*.27)
  $heartPath.AddBezier($X+$Size*.89, $Y+$Size*.27, $X+$Size*1.06, $Y+$Size*.45, $X+$Size*.82, $Y+$Size*.70, $X+$Size*.50, $Y+$Size*.90)
  $heartPath.CloseFigure()
  $brush = [System.Drawing.SolidBrush]::new($heart); $Graphics.FillPath($brush, $heartPath); $brush.Dispose(); $heartPath.Dispose()
}
function Draw-Heart($Graphics, $View, [bool]$Ids = $false, [bool]$HeadsAndTails = $true, [bool]$Grid = $true, [bool]$IntersectionDots = $false) {
  $shape = New-ShapePath $View
  $fill = [System.Drawing.SolidBrush]::new($paperSoft)
  $outline = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(110, $accent), [single]([Math]::Max(1, $View.scale * .045)))
  $Graphics.FillPath($fill, $shape); $Graphics.DrawPath($outline, $shape)
  if ($Grid) {
    $state = $Graphics.Save(); $Graphics.SetClip($shape, [System.Drawing.Drawing2D.CombineMode]::Intersect)
    $gridPen = [System.Drawing.Pen]::new($gridInk, [single]([Math]::Max(.8, $View.scale * .025)))
    for ($x = 0; $x -le $level.width; $x++) { $a = Map-Point ([pscustomobject]@{ x=$x; y=0 }) $View; $b = Map-Point ([pscustomobject]@{ x=$x; y=$level.height }) $View; $Graphics.DrawLine($gridPen, $a, $b) }
    for ($y = 0; $y -le $level.height; $y++) { $a = Map-Point ([pscustomobject]@{ x=0; y=$y }) $View; $b = Map-Point ([pscustomobject]@{ x=$level.width; y=$y }) $View; $Graphics.DrawLine($gridPen, $a, $b) }
    $Graphics.Restore($state); $gridPen.Dispose()
  }
  if ($IntersectionDots) {
    $state = $Graphics.Save(); $Graphics.SetClip($shape, [System.Drawing.Drawing2D.CombineMode]::Intersect)
    $dotBrush = [System.Drawing.SolidBrush]::new($accent); $radius = [single]([Math]::Max(2.2, $View.scale * .035))
    for ($x = 0; $x -le $level.width; $x++) {
      for ($y = 0; $y -le $level.height; $y++) {
        $mapped = Map-Point ([pscustomobject]@{ x=$x; y=$y }) $View
        $Graphics.FillEllipse($dotBrush, $mapped.X-$radius, $mapped.Y-$radius, 2*$radius, 2*$radius)
      }
    }
    $Graphics.Restore($state); $dotBrush.Dispose()
  }
  foreach ($arrow in $level.arrows) {
    $mapped = [System.Collections.Generic.List[System.Drawing.PointF]]::new()
    foreach ($point in $arrow.path) { $mapped.Add((Map-Point $point $View)) }
    $linePen = [System.Drawing.Pen]::new($ink, [single]([Math]::Max(1.1, $View.scale * .12)))
    $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round; $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round; $linePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $Graphics.DrawLines($linePen, $mapped.ToArray()); $linePen.Dispose()
    if ($HeadsAndTails) {
      $head = [System.Collections.Generic.List[System.Drawing.PointF]]::new(); foreach ($point in (Head-Points $arrow)) { $head.Add((Map-Point $point $View)) }
      $headBrush = [System.Drawing.SolidBrush]::new($ink); $Graphics.FillPolygon($headBrush, $head.ToArray()); $headBrush.Dispose()
      $tail = Map-Point $arrow.path[0] $View; $radius = [single]([Math]::Max(1.5, $View.scale * .09))
      $Graphics.FillEllipse([System.Drawing.SolidBrush]::new($paper), $tail.X-$radius, $tail.Y-$radius, 2*$radius, 2*$radius)
      $tailPen = [System.Drawing.Pen]::new($ink, [single]([Math]::Max(1, $View.scale*.025))); $Graphics.DrawEllipse($tailPen, $tail.X-$radius, $tail.Y-$radius, 2*$radius, 2*$radius); $tailPen.Dispose()
    }
    if ($Ids) {
      $mid = $arrow.path[[Math]::Floor(($arrow.path.Count - 1) / 2)]; $center = Map-Point $mid $View
      $font = [System.Drawing.Font]::new('Arial', [single]([Math]::Max(8, $View.scale*.19)), [System.Drawing.FontStyle]::Bold)
      $label = [string]$arrow.id; $size = $Graphics.MeasureString($label, $font)
      $Graphics.FillEllipse([System.Drawing.SolidBrush]::new($paper), $center.X-($size.Width/2)-2, $center.Y-($size.Height/2)-1, $size.Width+4, $size.Height+2)
      $Graphics.DrawString($label, $font, [System.Drawing.SolidBrush]::new($accent), $center.X-$size.Width/2, $center.Y-$size.Height/2); $font.Dispose()
    }
  }
  $fill.Dispose(); $outline.Dispose(); $shape.Dispose()
}
function Save-Image($Name, $Width, $Height, [scriptblock]$Draw) {
  $bitmap = [System.Drawing.Bitmap]::new($Width, $Height); $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias; $graphics.Clear($paper)
  & $Draw $graphics
  $bitmap.Save((Join-Path $OutputDirectory $Name), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
}

Save-Image 'heart-full-board.png' 1100 1100 {
  param($g)
  $font = [System.Drawing.Font]::new('Arial', 28, [System.Drawing.FontStyle]::Bold); $g.DrawString('ROUND 12 - HEART PROTOTYPE', $font, [System.Drawing.SolidBrush]::new($ink), 42, 28); $font.Dispose()
  Draw-Heart $g (New-View 70 80 960 960 .055)
}
Save-Image 'heart-iphone-390x844.png' 390 844 {
  param($g)
  $font = [System.Drawing.Font]::new('Arial', 15, [System.Drawing.FontStyle]::Bold); $g.DrawString('ROUND 12 - HEART', $font, [System.Drawing.SolidBrush]::new($ink), 18, 54); $font.Dispose()
  Draw-HeartGlyph $g 264 51 15; Draw-HeartGlyph $g 290 51 15; Draw-HeartGlyph $g 316 51 15
  $hint = [System.Drawing.Font]::new('Arial', 11); $g.DrawString('Find a clear path out.', $hint, [System.Drawing.SolidBrush]::new($muted), 18, 91); $hint.Dispose()
  Draw-Heart $g (New-View 12 128 366 625 .055)
  $footer = [System.Drawing.Font]::new('Arial', 11); $g.DrawString('14 arrows | 10 x 11 visible cells', $footer, [System.Drawing.SolidBrush]::new($muted), 18, 800); $footer.Dispose()
}
Save-Image 'heart-footprint-grid-diagnostic.png' 1100 1100 {
  param($g)
  $font = [System.Drawing.Font]::new('Arial', 25, [System.Drawing.FontStyle]::Bold); $g.DrawString('HEART FOOTPRINT - 10 x 11 CELLS - 11 x 12 INTERSECTIONS', $font, [System.Drawing.SolidBrush]::new($ink), 30, 28); $font.Dispose()
  Draw-Heart $g (New-View 100 92 900 930 .055) $false $false $true $true
}
Save-Image 'heart-arrow-ids.png' 1100 1100 {
  param($g)
  $font = [System.Drawing.Font]::new('Arial', 28, [System.Drawing.FontStyle]::Bold); $g.DrawString('ROUND 12 - ARROW ID DIAGNOSTIC', $font, [System.Drawing.SolidBrush]::new($ink), 42, 28); $font.Dispose()
  Draw-Heart $g (New-View 70 80 960 960 .055) $true
}
Save-Image 'heart-corridor-structure.png' 1100 1100 {
  param($g)
  $font = [System.Drawing.Font]::new('Arial', 28, [System.Drawing.FontStyle]::Bold); $g.DrawString('HEART CORRIDOR STRUCTURE - 14 ROUTES', $font, [System.Drawing.SolidBrush]::new($ink), 42, 28); $font.Dispose()
  Draw-Heart $g (New-View 70 80 960 960 .055) $false $false
}
Save-Image 'heart-area-coverage-comparison.png' 1300 760 {
  param($g)
  $font = [System.Drawing.Font]::new('Arial', 24, [System.Drawing.FontStyle]::Bold); $g.DrawString('FULL-AREA SILHOUETTE COVERAGE', $font, [System.Drawing.SolidBrush]::new($ink), 34, 24); $font.Dispose()
  $sub = [System.Drawing.Font]::new('Arial', 16); $g.DrawString('Target heart footprint', $sub, [System.Drawing.SolidBrush]::new($muted), 150, 76); $g.DrawString('Playable arrow field', $sub, [System.Drawing.SolidBrush]::new($muted), 760, 76); $sub.Dispose()
  $left = New-View 70 115 520 600 .055; $shape = New-ShapePath $left; $targetBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(95, $heart)); $g.FillPath($targetBrush, $shape); $g.DrawPath([System.Drawing.Pen]::new($heart, 2), $shape); $shape.Dispose(); $targetBrush.Dispose()
  Draw-Heart $g (New-View 680 115 540 600 .055)
}
Write-Host "Rendered full-board, 390x844, grid, ID, corridor, and coverage previews to $OutputDirectory"
