<#
.SYNOPSIS
  Do do chinh xac cua tinh nang quet hoa don tren mot bo anh that da gan nhan.

.DESCRIPTION
  Goi thang endpoint dang chay (qua API gateway) nen do dung duong di that:
  gateway -> auth -> order-service -> Gemini -> lop doi chieu.

  Dat anh vao  eval\images\<ten>.jpg
  Dat nhan vao eval\labels\<ten>.json   (xem labels\_example.json)

  LUU Y QUOTA: moi anh ton 1 luot goi Gemini. Goi free chi ~100-250 luot/ngay,
  nen chay 30 anh vai lan la cham tran. Dung -Only de chay thu mot anh.

  NOTE: script dung ASCII co y - Windows PowerShell 5.1 doc file UTF-8 khong BOM
  thanh ANSI va lam hong ky tu co dau, gay loi parse.

.EXAMPLE
  .\Run-ReceiptScanEval.ps1
  .\Run-ReceiptScanEval.ps1 -Only form_receipt
#>
param(
  [string]$BaseUrl  = "http://localhost:8080/api/v1",
  [string]$Username = "admin",
  [string]$Password = "123456",
  [string]$Only     = ""
)

$ErrorActionPreference = "Stop"
$root      = Split-Path -Parent $MyInvocation.MyCommand.Path
$imagesDir = Join-Path $root "images"
$labelsDir = Join-Path $root "labels"

if (-not (Test-Path $imagesDir)) { throw "Khong thay thu muc anh: $imagesDir" }

<#
  Windows PowerShell 5.1 giai ma JSON theo ISO-8859-1 khi response khong khai bao charset,
  lam hong het chu co dau (ten mon tieng Viet). Phai tu doc raw bytes roi decode UTF-8,
  neu khong moi phep so sanh ten mon deu that bai.
#>
function Invoke-JsonUtf8 {
  param([string]$Uri, [string]$Method = "Get", $Headers = @{}, [string]$Body = $null)
  $params = @{ Uri = $Uri; Method = $Method; Headers = $Headers; UseBasicParsing = $true }
  if ($Body) { $params.Body = $Body; $params.ContentType = "application/json" }
  $resp = Invoke-WebRequest @params
  $text = [Text.Encoding]::UTF8.GetString($resp.RawContentStream.ToArray())
  return $text | ConvertFrom-Json
}

Write-Host "Dang nhap..." -ForegroundColor Cyan
$login = Invoke-JsonUtf8 -Method Post -Uri "$BaseUrl/auth/login" `
  -Body (@{ username = $Username; password = $Password } | ConvertTo-Json)
$token = $login.data.accessToken
if (-not $token) { throw "Khong lay duoc token" }
$headers = @{ Authorization = "Bearer $token" }

# Luu y: -Include chi hoat dong khi path co wildcard (hoac dung -Recurse)
$images = Get-ChildItem -Path (Join-Path $imagesDir "*") -Include *.jpg,*.jpeg,*.png -File
if ($Only) { $images = $images | Where-Object { $_.BaseName -eq $Only } }
if (-not $images) { throw "Khong co anh nao de do (thu muc images trong?)" }

$totExpected = 0; $totDetected = 0; $totAutoOk = 0
$totSilentErr = 0; $totHigh = 0; $totFabricated = 0
$rows = @()

foreach ($img in $images) {
  $labelPath = Join-Path $labelsDir "$($img.BaseName).json"
  if (-not (Test-Path $labelPath)) {
    Write-Host "  ! Bo qua $($img.Name) - chua co nhan $($img.BaseName).json" -ForegroundColor DarkYellow
    continue
  }
  $label = Get-Content $labelPath -Raw -Encoding UTF8 | ConvertFrom-Json

  Write-Host "Quet $($img.Name)..." -NoNewline
  $b64  = [Convert]::ToBase64String([IO.File]::ReadAllBytes($img.FullName))
  $body = @{ imagesBase64 = @($b64); mimeType = "image/jpeg" } | ConvertTo-Json
  try {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $resp = Invoke-JsonUtf8 -Method Post -Uri "$BaseUrl/orders/scan-receipt" `
      -Headers $headers -Body $body
    $sw.Stop()
  } catch {
    Write-Host " LOI: $($_.Exception.Message)" -ForegroundColor Red
    continue
  }
  $got = $resp.data
  Write-Host (" {0:N1}s, {1} dong" -f $sw.Elapsed.TotalSeconds, $got.items.Count) -ForegroundColor DarkGray

  # Ghep tung dong nhan voi dong ket qua theo ten mon (nhan dung ten chuan trong DB)
  $unmatched = [Collections.ArrayList]@($got.items)
  $expected = $label.items.Count
  $detected = 0; $autoOk = 0

  foreach ($exp in $label.items) {
    $hit = $unmatched | Where-Object { $_.productName -eq $exp.productName } | Select-Object -First 1
    if ($hit) {
      $detected++
      if ($hit.confidence -eq "high" -and $hit.quantity -eq $exp.quantity) { $autoOk++ }
      $unmatched.Remove($hit) | Out-Null
    }
  }

  # Dong ket qua khong ung voi nhan nao: bia ra (neu tu tin thi la loi am tham)
  $fabricated = $unmatched.Count
  $silent = @($unmatched | Where-Object { $_.confidence -eq "high" }).Count
  $highCount = @($got.items | Where-Object { $_.confidence -eq "high" }).Count

  $totExpected += $expected; $totDetected += $detected; $totAutoOk += $autoOk
  $totFabricated += $fabricated; $totSilentErr += $silent; $totHigh += $highCount

  $totalOk = "-"
  if ($null -ne $label.grandTotal -and $null -ne $got.grandTotal) {
    $diff = [math]::Abs([double]$label.grandTotal - [double]$got.grandTotal)
    $totalOk = if ($diff -le 1000) { "ok" } else { "LECH" }
  }
  $tableOk = "-"
  if ($label.tableLabel) {
    $tableOk = if ("$($got.tableLabel)" -eq "$($label.tableLabel)") { "ok" } else { "sai" }
  }

  $rows += [pscustomobject]@{
    Anh        = $img.BaseName
    NhanDong   = $expected
    NhanDien   = $detected
    TuDongDung = $autoOk
    Bia        = $fabricated
    SaiAmTham  = $silent
    TongCong   = $totalOk
    Ban        = $tableOk
  }
}

if ($totExpected -eq 0) { throw "Khong do duoc gi - thieu nhan?" }

Write-Host ""
Write-Host "===== CHI TIET TUNG ANH =====" -ForegroundColor Cyan
$rows | Format-Table -AutoSize

$autoRate  = 100.0 * $totAutoOk / $totExpected
$recall    = 100.0 * $totDetected / $totExpected
$precision = 0.0
if ($totHigh -gt 0) { $precision = 100.0 * ($totHigh - $totSilentErr) / $totHigh }

$autoColor = "Red"
if ($autoRate -ge 95) { $autoColor = "Green" } elseif ($autoRate -ge 88) { $autoColor = "Yellow" }
$precColor = "Red"
if ($precision -ge 99) { $precColor = "Green" } elseif ($precision -ge 95) { $precColor = "Yellow" }
$silentColor = "Green"
if ($totSilentErr -gt 0) { $silentColor = "Red" }

Write-Host "===== TONG HOP =====" -ForegroundColor Cyan
Write-Host ("So dong theo nhan        : {0}" -f $totExpected)
Write-Host ("Nhan dien duoc          : {0} ({1:N1} pct)" -f $totDetected, $recall)
Write-Host ("Bia them (khong co that): {0}" -f $totFabricated)
Write-Host ("Sai am tham (tu tin+sai): {0}" -f $totSilentErr) -ForegroundColor $silentColor
Write-Host ""
Write-Host (">> TU DONG DUNG      : {0:N1} pct  (muc tieu >= 95)" -f $autoRate) -ForegroundColor $autoColor
Write-Host (">> DO CHUAN 'tu tin' : {0:N1} pct  (muc tieu >= 99)" -f $precision) -ForegroundColor $precColor
Write-Host ""
Write-Host "Ghi chu: dong bi danh 'Can xac nhan' KHONG tinh la loi - do la nhac nhan vien kiem."
Write-Host "Loi that su dang lo la 'sai am tham': AI tu tin nhung sai, nhan vien se khong kiem lai."
