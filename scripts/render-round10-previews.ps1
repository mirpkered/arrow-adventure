param([string]$OutputDirectory = 'docs/previews/round-10')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
Add-Type -AssemblyName System.Drawing
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$catalog = Get-Content -Raw 'src/game/adventure-catalog.json' | ConvertFrom-Json
$paper = [System.Drawing.ColorTranslator]::FromHtml('#F7F7F2')
$ink = [System.Drawing.ColorTranslator]::FromHtml('#30373E')
$gridInk = [System.Drawing.ColorTranslator]::FromHtml('#E5E7E1')
$muted = [System.Drawing.ColorTranslator]::FromHtml('#7F888B')
$heart = [System.Drawing.ColorTranslator]::FromHtml('#D96662')

function Map-Point($Point, $View) {
  [System.Drawing.PointF]::new([single]($View.left + ($Point.x - $View.worldX) * $View.scaleX), [single]($View.top + ($Point.y - $View.worldY) * $View.scaleY))
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
function New-View($Level, [double]$Left, [double]$Top, [double]$Width, [double]$Height, [bool]$FitComposition) {
  if ($FitComposition) {
    $points = [System.Collections.Generic.List[object]]::new()
    foreach ($arrow in $Level.arrows) {
      foreach ($point in $arrow.path) { $points.Add($point) }
      foreach ($point in (Head-Points $arrow)) { $points.Add($point) }
      $tail = $arrow.path[0]; $points.Add([pscustomobject]@{ x = $tail.x - .09; y = $tail.y - .09 }); $points.Add([pscustomobject]@{ x = $tail.x + .09; y = $tail.y + .09 })
    }
    $minX = ($points | Measure-Object x -Minimum).Minimum - .06; $maxX = ($points | Measure-Object x -Maximum).Maximum + .06
    $minY = ($points | Measure-Object y -Minimum).Minimum - .06; $maxY = ($points | Measure-Object y -Maximum).Maximum + .06
  } else { $minX = 0; $minY = 0; $maxX = [double]$Level.width; $maxY = [double]$Level.height }
  $worldWidth = $maxX - $minX; $worldHeight = $maxY - $minY
  $padWidth = $worldWidth * 1.24; $padHeight = $worldHeight * 1.24
  $scale = [Math]::Min($Width / $padWidth, $Height / $padHeight)
  $viewWidth = $Width / $scale; $viewHeight = $Height / $scale
  $centerX = ($minX + $maxX) / 2; $centerY = ($minY + $maxY) / 2
  return [pscustomobject]@{ left = $Left; top = $Top; worldX = $centerX - $viewWidth / 2; worldY = $centerY - $viewHeight / 2; scaleX = $scale; scaleY = $scale }
}
function Draw-Board($Graphics, $Level, $View, [bool]$Ids = $false) {
  $gridPen = [System.Drawing.Pen]::new($gridInk, [single]([Math]::Max(1, $View.scaleX * .018)))
  for ($x = 0; $x -le $Level.width; $x++) { $a = Map-Point ([pscustomobject]@{x=$x;y=0}) $View; $b = Map-Point ([pscustomobject]@{x=$x;y=$Level.height}) $View; $Graphics.DrawLine($gridPen,$a,$b) }
  for ($y = 0; $y -le $Level.height; $y++) { $a = Map-Point ([pscustomobject]@{x=0;y=$y}) $View; $b = Map-Point ([pscustomobject]@{x=$Level.width;y=$y}) $View; $Graphics.DrawLine($gridPen,$a,$b) }
  $gridPen.Dispose()
  foreach ($arrow in $Level.arrows) {
    $mapped = [System.Collections.Generic.List[System.Drawing.PointF]]::new()
    foreach ($point in $arrow.path) { $mapped.Add((Map-Point $point $View)) }
    $linePen = [System.Drawing.Pen]::new($ink,[single]([Math]::Max(1.1,$View.scaleX * .12)))
    $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round; $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round; $linePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $Graphics.DrawLines($linePen,$mapped.ToArray()); $linePen.Dispose()
    $head = [System.Collections.Generic.List[System.Drawing.PointF]]::new(); foreach ($point in (Head-Points $arrow)) { $head.Add((Map-Point $point $View)) }
    $Graphics.FillPolygon([System.Drawing.SolidBrush]::new($ink),$head.ToArray())
    $tail = Map-Point $arrow.path[0] $View; $radius = [single]([Math]::Max(1.5,$View.scaleX * .09))
    $Graphics.FillEllipse([System.Drawing.SolidBrush]::new($paper),$tail.X-$radius,$tail.Y-$radius,2*$radius,2*$radius)
    $tailPen = [System.Drawing.Pen]::new($ink,[single]([Math]::Max(1,$View.scaleX*.025))); $Graphics.DrawEllipse($tailPen,$tail.X-$radius,$tail.Y-$radius,2*$radius,2*$radius); $tailPen.Dispose()
    if ($Ids) {
      $mid = $arrow.path[[Math]::Floor(($arrow.path.Count - 1) / 2)]; $center = Map-Point $mid $View
      $font = [System.Drawing.Font]::new('Arial',[single]([Math]::Max(8,$View.scaleX*.16)),[System.Drawing.FontStyle]::Bold)
      $label = [string]$arrow.id; $size = $Graphics.MeasureString($label,$font)
      $Graphics.FillRectangle([System.Drawing.SolidBrush]::new($paper),$center.X-$size.Width/2,$center.Y-$size.Height/2,$size.Width,$size.Height)
      $Graphics.DrawString($label,$font,[System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#A6493B')),$center.X-$size.Width/2,$center.Y-$size.Height/2); $font.Dispose()
    }
  }
}
function Save-Full($Entry) {
  $bitmap=[System.Drawing.Bitmap]::new(1100,1100);$g=[System.Drawing.Graphics]::FromImage($bitmap);$g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias;$g.Clear($paper)
  $font=[System.Drawing.Font]::new('Arial',24,[System.Drawing.FontStyle]::Bold);$g.DrawString("LEVEL $($Entry.number) — $($Entry.title)",$font,[System.Drawing.SolidBrush]::new($ink),42,28);$font.Dispose()
  $view=New-View $Entry.puzzle 90 95 920 920 $false;Draw-Board $g $Entry.puzzle $view $false
  $path=Join-Path $OutputDirectory "level-$($Entry.number)-full.png";$bitmap.Save($path,[System.Drawing.Imaging.ImageFormat]::Png);$g.Dispose();$bitmap.Dispose()
}
function Save-Phone($Entry) {
  $bitmap=[System.Drawing.Bitmap]::new(390,844);$g=[System.Drawing.Graphics]::FromImage($bitmap);$g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias;$g.Clear($paper)
  $font=[System.Drawing.Font]::new('Arial',15,[System.Drawing.FontStyle]::Bold);$g.DrawString("LEVEL $($Entry.number.ToString('00'))",$font,[System.Drawing.SolidBrush]::new($ink),19,68);$font.Dispose()
  $heartFont=[System.Drawing.Font]::new('Segoe UI Symbol',21,[System.Drawing.FontStyle]::Bold);$g.DrawString('♥  ♥  ♥',$heartFont,[System.Drawing.SolidBrush]::new($heart),246,61);$heartFont.Dispose()
  $view=New-View $Entry.puzzle 14 126 362 650 $true;Draw-Board $g $Entry.puzzle $view $false
  $foot=[System.Drawing.Font]::new('Arial',11,[System.Drawing.FontStyle]::Regular);$g.DrawString("$($Entry.puzzle.arrows.Count) arrows · true $($Entry.puzzle.width)×$($Entry.puzzle.height) grid",$foot,[System.Drawing.SolidBrush]::new($muted),18,800);$foot.Dispose()
  $path=Join-Path $OutputDirectory "level-$($Entry.number)-iphone-390x844.png";$bitmap.Save($path,[System.Drawing.Imaging.ImageFormat]::Png);$g.Dispose();$bitmap.Dispose()
}
foreach ($entry in $catalog.levels) { Save-Full $entry; Save-Phone $entry }
$sheet=[System.Drawing.Bitmap]::new(1280,1580);$g=[System.Drawing.Graphics]::FromImage($sheet);$g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias;$g.Clear($paper)
$title=[System.Drawing.Font]::new('Arial',31,[System.Drawing.FontStyle]::Bold);$g.DrawString('ARROW ADVENTURE — ROUND 10',$title,[System.Drawing.SolidBrush]::new($ink),38,24);$title.Dispose()
$positions=@(@(26,92),@(434,92),@(842,92),@(230,818),@(638,818))
for($i=0;$i -lt $catalog.levels.Count;$i++){
  $entry=$catalog.levels[$i];$x=$positions[$i][0];$y=$positions[$i][1];$panel=[System.Drawing.Rectangle]::new($x,$y,390,710)
  $g.FillRectangle([System.Drawing.SolidBrush]::new([System.Drawing.Color]::White),$panel)
  $font=[System.Drawing.Font]::new('Arial',16,[System.Drawing.FontStyle]::Bold);$g.DrawString("LEVEL $($entry.number) — $($entry.title)",$font,[System.Drawing.SolidBrush]::new($ink),$x+12,$y+10);$font.Dispose()
  $sub=[System.Drawing.Font]::new('Arial',12,[System.Drawing.FontStyle]::Regular);$g.DrawString("$($entry.puzzle.width)×$($entry.puzzle.height) cells · $($entry.puzzle.arrows.Count) arrows",$sub,[System.Drawing.SolidBrush]::new($muted),$x+12,$y+36);$sub.Dispose()
  $view=New-View $entry.puzzle ($x+18) ($y+62) 354 632 $true;Draw-Board $g $entry.puzzle $view $false
}
$sheet.Save((Join-Path $OutputDirectory 'contact-sheet.png'),[System.Drawing.Imaging.ImageFormat]::Png);$g.Dispose();$sheet.Dispose()
Write-Host "Rendered five full boards, five 390×844 views, and contact sheet into $OutputDirectory"
