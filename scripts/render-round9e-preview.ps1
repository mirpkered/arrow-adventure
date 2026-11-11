param(
  [string]$InputFile = "src/game/prototypes/round9e-square-15.json",
  [string]$OutputDirectory = "docs/previews/round-9e"
)

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = "Stop"
$document = Get-Content -Raw $InputFile | ConvertFrom-Json
$level = if ($document.puzzle) { $document.puzzle } else { $document }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null

function Get-Color([string]$Hex) { return [System.Drawing.ColorTranslator]::FromHtml($Hex) }
function Get-BoardPoint($Point) { return [System.Drawing.PointF]::new([float]($Point.x + 0.5), [float]($Point.y + 0.5)) }

function Draw-Board($Graphics, [float]$Left, [float]$Top, [float]$Size, [bool]$Diagnostic) {
  $scale = $Size / 15.0
  $paper = Get-Color "#F7F7F2"
  $ink = Get-Color "#30373E"
  $gridFine = Get-Color "#E9EAE5"
  $gridMajor = Get-Color "#E2E4DE"
  $Graphics.FillRectangle([System.Drawing.SolidBrush]::new($paper), $Left, $Top, $Size, $Size)

  for ($line = 0; $line -le 30; $line++) {
    $unit = $line * 0.5
    $major = ($line % 2 -eq 0)
    $gridPen = [System.Drawing.Pen]::new($(if ($major) { $gridMajor } else { $gridFine }), [float]$(if ($major) { 0.035 } else { 0.018 }) * $scale)
    $screen = $Left + $unit * $scale
    $Graphics.DrawLine($gridPen, $screen, $Top, $screen, $Top + $Size)
    $screenY = $Top + $unit * $scale
    $Graphics.DrawLine($gridPen, $Left, $screenY, $Left + $Size, $screenY)
    $gridPen.Dispose()
  }

  foreach ($arrow in $level.arrows) {
    $points = @($arrow.path | ForEach-Object {
      $board = Get-BoardPoint $_
      [System.Drawing.PointF]::new($Left + $board.X * $scale, $Top + $board.Y * $scale)
    })
    $bodyPen = [System.Drawing.Pen]::new($ink, [float](0.12 * $scale))
    $bodyPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $bodyPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
    $bodyPen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $Graphics.DrawLines($bodyPen, [System.Drawing.PointF[]]$points)
    $bodyPen.Dispose()

    $last = $arrow.path[-1]
    $previous = $arrow.path[-2]
    $dx = [double]$last.x - [double]$previous.x
    $dy = [double]$last.y - [double]$previous.y
    $length = [Math]::Sqrt($dx * $dx + $dy * $dy)
    $dx /= $length; $dy /= $length
    $px = -$dy; $py = $dx
    $headCenter = Get-BoardPoint $last
    $tip = [System.Drawing.PointF]::new($Left + ($headCenter.X + $dx * 0.36) * $scale, $Top + ($headCenter.Y + $dy * 0.36) * $scale)
    $base = [System.Drawing.PointF]::new($Left + ($headCenter.X + $dx * 0.07) * $scale, $Top + ($headCenter.Y + $dy * 0.07) * $scale)
    $headPoints = [System.Drawing.PointF[]]@(
      $tip,
      [System.Drawing.PointF]::new($base.X + $px * 0.17 * $scale, $base.Y + $py * 0.17 * $scale),
      [System.Drawing.PointF]::new($base.X - $px * 0.17 * $scale, $base.Y - $py * 0.17 * $scale)
    )
    $Graphics.FillPolygon([System.Drawing.SolidBrush]::new($ink), $headPoints)
    $headOutline = [System.Drawing.Pen]::new($paper, [float](0.025 * $scale))
    $headOutline.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
    $Graphics.DrawPolygon($headOutline, $headPoints)
    $headOutline.Dispose()

    $tail = $points[0]
    $tailPen = [System.Drawing.Pen]::new($ink, [float](0.025 * $scale))
    $tailRadius = [float](0.09 * $scale)
    $Graphics.FillEllipse([System.Drawing.SolidBrush]::new($paper), $tail.X - $tailRadius, $tail.Y - $tailRadius, $tailRadius * 2, $tailRadius * 2)
    $Graphics.DrawEllipse($tailPen, $tail.X - $tailRadius, $tail.Y - $tailRadius, $tailRadius * 2, $tailRadius * 2)
    $tailPen.Dispose()

    if ($Diagnostic) {
      $mid = $points[[Math]::Floor(($points.Count - 1) / 2)]
      $font = [System.Drawing.Font]::new("Arial", [float](0.24 * $scale), [System.Drawing.FontStyle]::Bold)
      $text = $arrow.id
      $measure = $Graphics.MeasureString($text, $font)
      $rect = [System.Drawing.RectangleF]::new($mid.X - $measure.Width / 2, $mid.Y - $measure.Height / 2, $measure.Width, $measure.Height)
      $Graphics.FillRectangle([System.Drawing.SolidBrush]::new($paper), $rect)
      $Graphics.DrawString($text, $font, [System.Drawing.SolidBrush]::new((Get-Color "#AF503E")), $rect.X, $rect.Y)
      $font.Dispose()
    }
  }
}

function Save-Square([string]$Name, [bool]$Diagnostic) {
  $bitmap = [System.Drawing.Bitmap]::new(1200, 1200)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear((Get-Color "#F7F7F2"))
  Draw-Board $graphics 80 80 1040 $Diagnostic
  $bitmap.Save((Join-Path $OutputDirectory $Name), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose()
}

Save-Square "square-weave.png" $false
Save-Square "square-weave-diagnostic.png" $true

$phone = [System.Drawing.Bitmap]::new(390, 844)
$g = [System.Drawing.Graphics]::FromImage($phone)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$paper = Get-Color "#F7F7F2"; $ink = Get-Color "#20272E"; $muted = Get-Color "#7F888B"; $accent = Get-Color "#3857A4"; $heart = Get-Color "#D96662"
$g.Clear($paper)
$hudFont = [System.Drawing.Font]::new("Arial", 15, [System.Drawing.FontStyle]::Bold)
$smallFont = [System.Drawing.Font]::new("Arial", 11, [System.Drawing.FontStyle]::Regular)
$heartFont = [System.Drawing.Font]::new("Segoe UI Symbol", 21, [System.Drawing.FontStyle]::Bold)
$symbolFont = [System.Drawing.Font]::new("Segoe UI Symbol", 20, [System.Drawing.FontStyle]::Regular)
$g.DrawString("LEVEL 01", $hudFont, [System.Drawing.SolidBrush]::new($ink), 23, 68)
$heartGlyph = [string][char]0x2665
$g.DrawString("$heartGlyph  $heartGlyph  $heartGlyph", $heartFont, [System.Drawing.SolidBrush]::new($heart), 218, 61)
$g.DrawEllipse([System.Drawing.Pen]::new($accent, 1.5), 345, 63, 27, 27)
$g.DrawString([string][char]0x21BB, $symbolFont, [System.Drawing.SolidBrush]::new($accent), 347, 62)
Draw-Board $g 20 225 350 $false
$g.DrawString("15 arrows remaining", $smallFont, [System.Drawing.SolidBrush]::new($muted), 23, 753)
$phone.Save((Join-Path $OutputDirectory "square-weave-iphone.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $phone.Dispose(); $hudFont.Dispose(); $smallFont.Dispose(); $heartFont.Dispose(); $symbolFont.Dispose()
