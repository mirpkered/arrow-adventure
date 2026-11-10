param([string]$InputJson = 'src/game/prototypes/round9c-prototypes.json', [string]$OutputDirectory = 'docs/previews/round-9c')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$source = Get-Content -Encoding UTF8 -Raw -LiteralPath $InputJson | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$ink = [System.Drawing.Color]::FromArgb(48,54,61)
$paper = [System.Drawing.Color]::FromArgb(251,251,248)
$bg = [System.Drawing.Color]::FromArgb(243,244,241)
$gridColor = [System.Drawing.Color]::FromArgb(225,228,225)

function DrawBoard($g, $entry, $rect, $showIds = $false) {
  $p = $entry.puzzle
  $scale = [Math]::Min($rect.Width / $p.width, $rect.Height / $p.height)
  $w = $p.width * $scale; $h = $p.height * $scale
  $ox = $rect.X + ($rect.Width-$w)/2; $oy = $rect.Y + ($rect.Height-$h)/2
  $g.FillRectangle($script:boardBrush, [single]$ox, [single]$oy, [single]$w, [single]$h)
  $g.DrawRectangle($script:boardBorder, [single]$ox, [single]$oy, [single]$w, [single]$h)
  $gridPen = New-Object System.Drawing.Pen($script:gridColor, [single][Math]::Max(0.6,$scale*0.018))
  for($x=0.5;$x -lt $p.width;$x+=0.5) { $px=[single]($ox+$x*$scale); $g.DrawLine($gridPen,$px,[single]$oy,$px,[single]($oy+$h)) }
  for($y=0.5;$y -lt $p.height;$y+=0.5) { $py=[single]($oy+$y*$scale); $g.DrawLine($gridPen,[single]$ox,$py,[single]($ox+$w),$py) }
  $pen = New-Object System.Drawing.Pen($script:ink,[single]($scale*0.12)); $pen.StartCap=[System.Drawing.Drawing2D.LineCap]::Round; $pen.EndCap=[System.Drawing.Drawing2D.LineCap]::Round; $pen.LineJoin=[System.Drawing.Drawing2D.LineJoin]::Round
  foreach($arrow in $p.arrows) {
    $points = @()
    foreach($pt in $arrow.path) { $points += ,([System.Drawing.PointF]::new([single]($ox+($pt.x+0.5)*$scale),[single]($oy+($pt.y+0.5)*$scale))) }
    $g.DrawLines($pen,[System.Drawing.PointF[]]$points)
    $tail=$points[0]; $diam=[single]($scale*0.18); $g.FillEllipse($script:tailBrush,$tail.X-$diam/2,$tail.Y-$diam/2,$diam,$diam); $g.DrawEllipse($script:tailPen,$tail.X-$diam/2,$tail.Y-$diam/2,$diam,$diam)
    $end=$points[-1]; $prev=$points[-2]; $dx=$end.X-$prev.X; $dy=$end.Y-$prev.Y; $length=[Math]::Sqrt($dx*$dx+$dy*$dy); $ux=$dx/$length; $uy=$dy/$length; $px=-$uy; $py=$ux
    $tip=[System.Drawing.PointF]::new([single]($end.X+$ux*.36*$scale),[single]($end.Y+$uy*.36*$scale)); $base=[System.Drawing.PointF]::new([single]($end.X+$ux*.07*$scale),[single]($end.Y+$uy*.07*$scale))
    $head=[System.Drawing.PointF[]]@($tip,[System.Drawing.PointF]::new([single]($base.X+$px*.17*$scale),[single]($base.Y+$py*.17*$scale)),[System.Drawing.PointF]::new([single]($base.X-$px*.17*$scale),[single]($base.Y-$py*.17*$scale)))
    $g.FillPolygon($script:arrowBrush,$head)
    if($showIds) { $g.DrawString($arrow.id,$script:idFont,$script:idBrush,[single]($tail.X+2),[single]($tail.Y-18)) }
  }
  $pen.Dispose();$gridPen.Dispose()
}

function Wrap-Caption([string]$Text, [int]$Limit = 62) {
  $lines = [System.Collections.Generic.List[string]]::new()
  $line = ''
  foreach($word in ($Text -split '\s+')) {
    $candidate = if($line){ "$line $word" } else { $word }
    if($candidate.Length -gt $Limit -and $line) { $lines.Add($line); $line = $word }
    else { $line = $candidate }
  }
  if($line) { $lines.Add($line) }
  return $lines
}

$script:boardBrush=New-Object System.Drawing.SolidBrush($paper); $script:boardBorder=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220,224,221),1)
$script:ink=$ink; $script:arrowBrush=New-Object System.Drawing.SolidBrush($ink); $script:tailBrush=New-Object System.Drawing.SolidBrush($paper); $script:tailPen=New-Object System.Drawing.Pen($ink,1.2)
$script:idFont=New-Object System.Drawing.Font('Segoe UI',8); $script:idBrush=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(158,91,47))
$script:titleFont=New-Object System.Drawing.Font('Segoe UI',18,[System.Drawing.FontStyle]::Bold); $script:smallFont=New-Object System.Drawing.Font('Segoe UI',10); $script:bodyFont=New-Object System.Drawing.Font('Segoe UI',11)
$white=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White); $text=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(37,42,48)); $muted=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(104,112,120)); $border=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(226,229,226),1)

$sheet=New-Object System.Drawing.Bitmap(1600,800); $g=[System.Drawing.Graphics]::FromImage($sheet);$g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias;$g.Clear($bg)
$g.DrawString('Arrow Adventure - Round 9C composition review',$script:titleFont,$text,28,20);$g.DrawString('Three experimental layouts | exact prototype paths | monochrome game proportions',$script:smallFont,$muted,28,54)
for($i=0;$i -lt $source.Count;$i++) {
  $entry=$source[$i];$x=20+$i*520;$y=90
  $g.FillRectangle($white,$x,$y,500,680);$g.DrawRectangle($border,$x,$y,500,680)
  $g.DrawString("Prototype $([char](65+$i)) - $($entry.name)",$script:titleFont,$text,$x+16,$y+14)
  $g.DrawString("$($entry.puzzle.arrows.Count) arrows | $($entry.puzzle.width) x $($entry.puzzle.height) | $($entry.difficulty)",$script:smallFont,$muted,$x+16,$y+43)
  DrawBoard $g $entry ([System.Drawing.RectangleF]::new([single]($x+25),[single]($y+72),[single]450,[single]560)) $false
  $captionText = if($entry.previewCaption) { $entry.previewCaption } else { $entry.purpose }
  $captionLines = Wrap-Caption $captionText 62
  for($lineIndex=0;$lineIndex -lt [Math]::Min(2,$captionLines.Count);$lineIndex++) {
    $g.DrawString($captionLines[$lineIndex],$script:bodyFont,$muted,[single]($x+16),[single]($y+638+$lineIndex*15))
  }
}
$sheet.Save((Join-Path $OutputDirectory 'contact-sheet.png'),[System.Drawing.Imaging.ImageFormat]::Png);$g.Dispose();$sheet.Dispose()

for($i=0;$i -lt $source.Count;$i++) {
  $entry=$source[$i];$name=[char](97+$i);$image=New-Object System.Drawing.Bitmap(780,1000);$ig=[System.Drawing.Graphics]::FromImage($image);$ig.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias;$ig.Clear($bg)
  $ig.DrawString("Prototype $([char](65+$i)) - $($entry.name)",$script:titleFont,$text,28,24);$ig.DrawString("$($entry.puzzle.arrows.Count) arrows | $($entry.puzzle.width) x $($entry.puzzle.height) | $($entry.difficulty)",$script:smallFont,$muted,28,60)
  DrawBoard $ig $entry ([System.Drawing.RectangleF]::new(32,104,716,850)) $false
  $image.Save((Join-Path $OutputDirectory "prototype-$name.png"),[System.Drawing.Imaging.ImageFormat]::Png);$ig.Dispose();$image.Dispose()
}

$heart=$source[1];$comparison=New-Object System.Drawing.Bitmap(1200,700);$cg=[System.Drawing.Graphics]::FromImage($comparison);$cg.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias;$cg.Clear($bg)
$cg.DrawString('Heart prototype - composition comparison',$script:titleFont,$text,28,24);$cg.DrawString('The right panel shows only the playable paths; no outline is present in the puzzle.',$script:smallFont,$muted,28,60)
$cg.FillRectangle($white,20,100,560,560);$cg.DrawRectangle($border,20,100,560,560);$cg.FillRectangle($white,600,100,580,560);$cg.DrawRectangle($border,600,100,580,560)
$cg.DrawString('Intended silhouette',$script:titleFont,$text,42,116);$cg.DrawString('Actual arrow arrangement',$script:titleFont,$text,622,116)
$heartBrush=New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(32,207,109,118));$heartPen=New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(185,207,109,118),4)
$heartPts=[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(300,250),[System.Drawing.PointF]::new(220,180),[System.Drawing.PointF]::new(150,205),[System.Drawing.PointF]::new(140,270),[System.Drawing.PointF]::new(300,460),[System.Drawing.PointF]::new(460,270),[System.Drawing.PointF]::new(450,205),[System.Drawing.PointF]::new(380,180))
$cg.FillClosedCurve($heartBrush,$heartPts);$cg.DrawClosedCurve($heartPen,$heartPts)
DrawBoard $cg $heart ([System.Drawing.RectangleF]::new(635,165,510,470)) $false
$comparison.Save((Join-Path $OutputDirectory 'heart-comparison.png'),[System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose();$comparison.Dispose();$boardBrush.Dispose();$boardBorder.Dispose();$arrowBrush.Dispose();$tailBrush.Dispose();$tailPen.Dispose();$idFont.Dispose();$idBrush.Dispose();$titleFont.Dispose();$smallFont.Dispose();$bodyFont.Dispose();$white.Dispose();$text.Dispose();$muted.Dispose();$border.Dispose();$heartBrush.Dispose();$heartPen.Dispose();$cg.Dispose()
Write-Output "Rendered contact sheet, three phone previews, and heart comparison to $OutputDirectory"
