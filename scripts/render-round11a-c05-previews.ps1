param([string]$DataPath = 'docs/previews/round-11a/c05-motion-data.json', [string]$OutputDirectory = 'docs/previews/round-11a')
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
Add-Type -AssemblyName System.Drawing
$data = Get-Content -Raw $DataPath | ConvertFrom-Json
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$paper = [System.Drawing.ColorTranslator]::FromHtml('#F7F7F2')
$ink = [System.Drawing.ColorTranslator]::FromHtml('#30373E')
$gridInk = [System.Drawing.ColorTranslator]::FromHtml('#E5E7E1')
$muted = [System.Drawing.ColorTranslator]::FromHtml('#778188')
$danger = [System.Drawing.ColorTranslator]::FromHtml('#C94B4B')
$reference = [System.Drawing.ColorTranslator]::FromHtml('#D1A34A')
function Map-Point($Point, $Panel, [double]$Scale) { [System.Drawing.PointF]::new([single]($Panel.x + ($Point.x + .55) * $Scale), [single]($Panel.y + ($Point.y + .55) * $Scale)) }
function Draw-Grid($Graphics, $Panel, [double]$Scale) {
  $pen=[System.Drawing.Pen]::new($gridInk,[single]([Math]::Max(1,$Scale*.018)))
  for($i=0;$i -le 7;$i++){$a=Map-Point ([pscustomobject]@{x=$i;y=0}) $Panel $Scale;$b=Map-Point ([pscustomobject]@{x=$i;y=7}) $Panel $Scale;$Graphics.DrawLine($pen,$a,$b);$a=Map-Point ([pscustomobject]@{x=0;y=$i}) $Panel $Scale;$b=Map-Point ([pscustomobject]@{x=7;y=$i}) $Panel $Scale;$Graphics.DrawLine($pen,$a,$b)}
  $pen.Dispose()
}
function Head-Points($Path, [double]$Width=.15) {
  $head=$Path[-1];$prev=$Path[-2];$dx=[double]$head.x-[double]$prev.x;$dy=[double]$head.y-[double]$prev.y;$length=[Math]::Sqrt($dx*$dx+$dy*$dy);$dx/=$length;$dy/=$length;$px=-$dy;$py=$dx;$factor=$Width/.15
  return @([pscustomobject]@{x=$head.x+$dx*.36*$factor;y=$head.y+$dy*.36*$factor},[pscustomobject]@{x=$head.x+$dx*.07*$factor+$px*.17*$factor;y=$head.y+$dy*.07*$factor+$py*.17*$factor},[pscustomobject]@{x=$head.x+$dx*.07*$factor-$px*.17*$factor;y=$head.y+$dy*.07*$factor-$py*.17*$factor})
}
function Draw-Arrow($Graphics, $Path, $Panel, [double]$Scale, $Color, $Head = $null, [bool]$ShowTail = $true) {
  $points=[System.Collections.Generic.List[System.Drawing.PointF]]::new();foreach($p in $Path){$points.Add((Map-Point $p $Panel $Scale))}
  $pen=[System.Drawing.Pen]::new($Color,[single]([Math]::Max(1,$Scale*.12)));$pen.StartCap=[System.Drawing.Drawing2D.LineCap]::Round;$pen.EndCap=[System.Drawing.Drawing2D.LineCap]::Round;$pen.LineJoin=[System.Drawing.Drawing2D.LineJoin]::Round;$Graphics.DrawLines($pen,$points.ToArray());$pen.Dispose()
  if($null -eq $Head){$Head=Head-Points $Path $data.style.headWidth};$hp=[System.Collections.Generic.List[System.Drawing.PointF]]::new();foreach($p in $Head){$hp.Add((Map-Point $p $Panel $Scale))};$brush=[System.Drawing.SolidBrush]::new($Color);$Graphics.FillPolygon($brush,$hp.ToArray());$brush.Dispose()
  if($ShowTail){$tail=Map-Point $Path[0] $Panel $Scale;$radius=[single]($Scale*.09);$fill=[System.Drawing.SolidBrush]::new($paper);$Graphics.FillEllipse($fill,$tail.X-$radius,$tail.Y-$radius,2*$radius,2*$radius);$fill.Dispose();$outline=[System.Drawing.Pen]::new($Color,[single]([Math]::Max(1,$Scale*.025)));$Graphics.DrawEllipse($outline,$tail.X-$radius,$tail.Y-$radius,2*$radius,2*$radius);$outline.Dispose()}
}
function New-Canvas([int]$Width,[int]$Height) {$bitmap=[System.Drawing.Bitmap]::new($Width,$Height);$g=[System.Drawing.Graphics]::FromImage($bitmap);$g.SmoothingMode=[System.Drawing.Drawing2D.SmoothingMode]::AntiAlias;$g.Clear($paper);return @($bitmap,$g)}
function Save-Canvas($Bitmap,$Graphics,[string]$Name){$Bitmap.Save((Join-Path $OutputDirectory $Name),[System.Drawing.Imaging.ImageFormat]::Png);$Graphics.Dispose();$Bitmap.Dispose()}
function Title($Graphics,[string]$Text,[single]$X,[single]$Y,[single]$Size=22){$font=[System.Drawing.Font]::new('Arial',$Size,[System.Drawing.FontStyle]::Bold);$Graphics.DrawString($Text,$font,[System.Drawing.SolidBrush]::new($ink),$X,$Y);$font.Dispose()}

# Full puzzle comparison; all unchanged paths are muted so c05's orientation is easy to compare.
$canvas=New-Canvas 1200 690;$bitmap=$canvas[0];$g=$canvas[1]
Title $g 'LEVEL 3 — WINDING PATHS · BEFORE / AFTER c05' 28 22 25
$panels=@(@{x=45;y=112;w=520;h=520},@{x=635;y=112;w=520;h=520})
for($side=0;$side -lt 2;$side++){$p=$panels[$side];$scale=[Math]::Min($p.w/8.1,$p.h/8.1);$label=if($side -eq 0){'BEFORE · c05 exits SOUTH toward old tail'}else{'AFTER · same corridor; c05 exits EAST'};Title $g $label ($p.x+8) ($p.y-36) 15;Draw-Grid $g $p $scale;foreach($arrow in $data.level.arrows){Draw-Arrow $g $arrow.path $p $scale $muted};$c05=if($side -eq 0){$data.c05Before}else{$data.c05After};Draw-Arrow $g $c05.path $p $scale $danger}
Save-Canvas $bitmap $g 'level-3-before-after-c05.png'

# Enlarged c05 route diagnostic, with the original tail location retained as a dotted reference.
$canvas=New-Canvas 1050 590;$bitmap=$canvas[0];$g=$canvas[1]
Title $g 'c05 ROUTE DIAGNOSTIC · unchanged centerline, corrected heading' 25 20 23
for($side=0;$side -lt 2;$side++){$p=@{x=45+$side*510;y=115;w=450;h=425};$scale=[Math]::Min($p.w/8.1,$p.h/8.1);$c05=if($side -eq 0){$data.c05Before}else{$data.c05After};$label=if($side -eq 0){'Before: head at (7,3), south; tail at (7,4)'}else{'After: head at (7,4), east; tail at (7,3)'};Title $g $label ($p.x-10) ($p.y-35) 13;Draw-Grid $g $p $scale
  $ref=Map-Point ([pscustomobject]@{x=7;y=4}) $p $scale;$ghost=[System.Drawing.Pen]::new($reference,[single]([Math]::Max(1,$scale*.025)));$ghost.DashStyle=[System.Drawing.Drawing2D.DashStyle]::Dash;$r=[single]($scale*.16);$g.DrawEllipse($ghost,$ref.X-$r,$ref.Y-$r,2*$r,2*$r);$ghost.Dispose()
  Draw-Arrow $g $c05.path $p $scale $danger
}
Save-Canvas $bitmap $g 'c05-head-tail-diagnostic.png'

# Engine-produced movement snapshots. The amber dashed ring marks the old tail coordinate (7,4).
$distances=@(0,.285,.5,1,2,4)
$canvas=New-Canvas 1840 790;$bitmap=$canvas[0];$g=$canvas[1]
Title $g 'c05 MOVEMENT FRAMES · distance sampled from moveArrowDistance' 24 15 22
$font=[System.Drawing.Font]::new('Arial',12,[System.Drawing.FontStyle]::Bold)
$rows=@(@{label='BEFORE · SOUTH';state=$data.c05Before;color=$danger;y=74},@{label='AFTER · EAST';state=$data.c05After;color=$ink;y=420})
foreach($row in $rows){$g.DrawString($row.label,$font,[System.Drawing.SolidBrush]::new($row.color),18,$row.y+105);foreach($d in $distances){$frame=$row.state.frames|Where-Object{[Math]::Abs([double]$_.distance-$d)-lt .0001}|Select-Object -First 1;if(!$frame){continue};$col=[Array]::IndexOf($distances,$d);$p=@{x=50+$col*298;y=$row.y+10;w=275;h=275};$scale=[Math]::Min($p.w/8.1,$p.h/8.1);$labelFont=[System.Drawing.Font]::new('Arial',11,[System.Drawing.FontStyle]::Regular);$g.DrawString("travel $d cells",$labelFont,[System.Drawing.SolidBrush]::new($muted),$p.x,$row.y-2);$labelFont.Dispose();Draw-Grid $g $p $scale;$ref=Map-Point ([pscustomobject]@{x=7;y=4}) $p $scale;$ghost=[System.Drawing.Pen]::new($reference,[single]([Math]::Max(1,$scale*.025)));$ghost.DashStyle=[System.Drawing.Drawing2D.DashStyle]::Dash;$r=[single]($scale*.16);$g.DrawEllipse($ghost,$ref.X-$r,$ref.Y-$r,2*$r,2*$r);$ghost.Dispose();Draw-Arrow $g $frame.path $p $scale $row.color $frame.head}}
$font.Dispose();Save-Canvas $bitmap $g 'c05-engine-movement-frames.png'
Write-Host "Rendered Round 11A c05 comparison and movement evidence to $OutputDirectory"
