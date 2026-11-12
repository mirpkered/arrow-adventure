param(
  [string]$InputFile = "src/game/prototypes/round9f-square-7.json",
  [string]$OutputDirectory = "docs/previews/round-9f",
  [switch]$CorridorPlan
)

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"
$document = Get-Content -Raw $InputFile | ConvertFrom-Json
if ($document.puzzle) { $level = $document.puzzle }
else { $level = [pscustomobject]@{ width = 7; height = 7; arrows = @($document.arrows) } }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

function Color([string]$Hex) { [System.Drawing.ColorTranslator]::FromHtml($Hex) }
function Map-Point($Point, [float]$Left, [float]$Top, [float]$Scale) {
  [System.Drawing.PointF]::new($Left + ([float]$Point.x + 0.5) * $Scale, $Top + ([float]$Point.y + 0.5) * $Scale)
}

function Draw-Board($Graphics, [float]$Left, [float]$Top, [float]$Size, [bool]$OnlyCorridors, [bool]$Diagnostic) {
  $boardWidth = [float]$level.width
  $boardHeight = [float]$level.height
  $scale = [Math]::Min($Size / $boardWidth, $Size / $boardHeight)
  $paper = Color "#F7F7F2"; $ink = Color "#30373E"; $corridorInk = Color "#75828E"
  $fine = Color "#E9EAE5"; $major = Color "#E1E3DD"
  $Graphics.FillRectangle([System.Drawing.SolidBrush]::new($paper), $Left, $Top, $boardWidth * $scale, $boardHeight * $scale)
  for ($line = 0; $line -le ($boardWidth * 2); $line++) {
    $unit = $line * 0.5
    $isMajor = ($line % 2 -eq 0)
    $gridPen = [System.Drawing.Pen]::new($(if ($isMajor) { $major } else { $fine }), [float]$(if ($isMajor) { 0.035 } else { 0.018 }) * $scale)
    $screenX = $Left + $unit * $scale
    $Graphics.DrawLine($gridPen, $screenX, $Top, $screenX, $Top + $boardHeight * $scale)
    $Graphics.DrawLine($gridPen, $Left, $Top + $unit * $scale, $Left + $boardWidth * $scale, $Top + $unit * $scale)
    $gridPen.Dispose()
  }

  foreach ($arrow in $level.arrows) {
    $points = @($arrow.path | ForEach-Object { Map-Point $_ $Left $Top $scale })
    $bodyColor = if ($OnlyCorridors) { $corridorInk } else { $ink }
    $linePen = [System.Drawing.Pen]::new($bodyColor, [float](0.12 * $scale))
    $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $linePen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $Graphics.DrawLines($linePen, [System.Drawing.PointF[]]$points)
    $linePen.Dispose()

    if (-not $OnlyCorridors) {
      $last = $arrow.path[-1]; $previous = $arrow.path[-2]
      $dx = [double]$last.x - [double]$previous.x; $dy = [double]$last.y - [double]$previous.y
      $magnitude = [Math]::Sqrt($dx * $dx + $dy * $dy); $dx /= $magnitude; $dy /= $magnitude
      $px = -$dy; $py = $dx; $center = Map-Point $last $Left $Top $scale
      $tip = [System.Drawing.PointF]::new($center.X + $dx * 0.36 * $scale, $center.Y + $dy * 0.36 * $scale)
      $base = [System.Drawing.PointF]::new($center.X + $dx * 0.07 * $scale, $center.Y + $dy * 0.07 * $scale)
      $head = [System.Drawing.PointF[]]@(
        $tip,
        [System.Drawing.PointF]::new($base.X + $px * 0.17 * $scale, $base.Y + $py * 0.17 * $scale),
        [System.Drawing.PointF]::new($base.X - $px * 0.17 * $scale, $base.Y - $py * 0.17 * $scale)
      )
      $Graphics.FillPolygon([System.Drawing.SolidBrush]::new($ink), $head)
      $headPen = [System.Drawing.Pen]::new($paper, [float](0.025 * $scale)); $headPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
      $Graphics.DrawPolygon($headPen, $head); $headPen.Dispose()

      $tail = $points[0]; $radius = [float](0.09 * $scale); $tailPen = [System.Drawing.Pen]::new($ink, [float](0.025 * $scale))
      $Graphics.FillEllipse([System.Drawing.SolidBrush]::new($paper), $tail.X - $radius, $tail.Y - $radius, 2 * $radius, 2 * $radius)
      $Graphics.DrawEllipse($tailPen, $tail.X - $radius, $tail.Y - $radius, 2 * $radius, 2 * $radius); $tailPen.Dispose()

      if ($Diagnostic) {
        $mid = $points[[Math]::Floor(($points.Count - 1) / 2)]
        $font = [System.Drawing.Font]::new("Arial", [float](0.22 * $scale), [System.Drawing.FontStyle]::Bold)
        $measure = $Graphics.MeasureString($arrow.id, $font)
        $rect = [System.Drawing.RectangleF]::new($mid.X - $measure.Width / 2, $mid.Y - $measure.Height / 2, $measure.Width, $measure.Height)
        $Graphics.FillRectangle([System.Drawing.SolidBrush]::new($paper), $rect)
        $Graphics.DrawString($arrow.id, $font, [System.Drawing.SolidBrush]::new((Color "#AF503E")), $rect.X, $rect.Y)
        $font.Dispose()
      }
    }
  }
}

if ($CorridorPlan) {
  $bitmap = [System.Drawing.Bitmap]::new(1000, 1000); $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias; $graphics.Clear((Color "#F7F7F2"))
  Draw-Board $graphics 150 150 700 $true $false
  $bitmap.Save((Join-Path $OutputDirectory "corridor-plan.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose(); exit 0
}

function Save-Square([string]$FileName, [bool]$Diagnostic) {
  $bitmap = [System.Drawing.Bitmap]::new(1000, 1000); $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias; $graphics.Clear((Color "#F7F7F2"))
  Draw-Board $graphics 150 150 700 $false $Diagnostic
  $bitmap.Save((Join-Path $OutputDirectory $FileName), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
}

Save-Square "square-weave-7.png" $false
Save-Square "square-weave-7-diagnostic.png" $true

$phone = [System.Drawing.Bitmap]::new(390, 844); $graphics = [System.Drawing.Graphics]::FromImage($phone)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$paper = Color "#F7F7F2"; $ink = Color "#20272E"; $muted = Color "#7F888B"; $accent = Color "#3857A4"; $heart = Color "#D96662"
$graphics.Clear($paper)
$hudFont = [System.Drawing.Font]::new("Arial", 15, [System.Drawing.FontStyle]::Bold)
$heartFont = [System.Drawing.Font]::new("Segoe UI Symbol", 21, [System.Drawing.FontStyle]::Bold)
$symbolFont = [System.Drawing.Font]::new("Segoe UI Symbol", 20, [System.Drawing.FontStyle]::Regular)
$smallFont = [System.Drawing.Font]::new("Arial", 11, [System.Drawing.FontStyle]::Regular)
$graphics.DrawString("LEVEL 01", $hudFont, [System.Drawing.SolidBrush]::new($ink), 23, 68)
$heartGlyph = [string][char]0x2665
$graphics.DrawString("$heartGlyph  $heartGlyph  $heartGlyph", $heartFont, [System.Drawing.SolidBrush]::new($heart), 218, 61)
$graphics.DrawEllipse([System.Drawing.Pen]::new($accent, 1.5), 345, 63, 27, 27)
$graphics.DrawString([string][char]0x21BB, $symbolFont, [System.Drawing.SolidBrush]::new($accent), 347, 62)
Draw-Board $graphics 20 225 350 $false $false
$graphics.DrawString("15 arrows remaining", $smallFont, [System.Drawing.SolidBrush]::new($muted), 23, 753)
$phone.Save((Join-Path $OutputDirectory "square-weave-7-iphone.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose(); $phone.Dispose(); $hudFont.Dispose(); $heartFont.Dispose(); $symbolFont.Dispose(); $smallFont.Dispose()
