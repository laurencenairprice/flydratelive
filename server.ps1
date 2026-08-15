param(
  [int]$Port = 5500,
  [string]$Root = "C:\Users\Laurence\flydratelive"
)

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".svg" = "image/svg+xml"
  ".jpg" = "image/jpeg"
  ".jpeg" = "image/jpeg"
  ".png" = "image/png"
  ".ico" = "image/x-icon"
  ".json" = "application/json; charset=utf-8"
}

function Get-Secrets {
  $path = Join-Path $Root "secrets.json"
  if (-not (Test-Path $path)) {
    throw "Flight lookup is not configured."
  }
  Get-Content $path -Raw | ConvertFrom-Json
}

function Send-Json($response, $status, $object) {
  $json = $object | ConvertTo-Json -Depth 8 -Compress
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $response.StatusCode = $status
  $response.ContentType = "application/json; charset=utf-8"
  $response.Headers["Cache-Control"] = "no-store"
  $response.Headers["Access-Control-Allow-Origin"] = "*"
  $response.Headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
  $response.ContentLength64 = $bytes.Length
  $response.OutputStream.Write($bytes, 0, $bytes.Length)
  $response.Close()
}

function Get-FlightLookup($number, $date) {
  $secrets = Get-Secrets
  $code = ($number.ToUpper() -replace "[^A-Z0-9]", "")
  if (-not $code) { throw "Enter a flight number." }
  if ($date -and $date -notmatch "^\d{4}-\d{2}-\d{2}$") { throw "Use date format YYYY-MM-DD." }

  $url = "https://aerodatabox.p.rapidapi.com/flights/number/$code"
  if ($date) { $url = "$url/$date" }

  $headers = @{
    "x-rapidapi-host" = $secrets.rapidApiHost
    "x-rapidapi-key" = $secrets.rapidApiKey
  }
  return Invoke-RestMethod -Method GET -Uri $url -Headers $headers
}

$listener = [System.Net.HttpListener]::new()
$prefix = "http://127.0.0.1:$Port/"
$listener.Prefixes.Add($prefix)
try {
  $listener.Start()
} catch {
  $Port = 5501
  $listener = [System.Net.HttpListener]::new()
  $prefix = "http://127.0.0.1:$Port/"
  $listener.Prefixes.Add($prefix)
  $listener.Start()
}

Write-Host "FLYDRATE at $prefix"

while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $request = $ctx.Request
  $response = $ctx.Response
  $path = [Uri]::UnescapeDataString($request.Url.AbsolutePath)

  try {
    if ($request.HttpMethod -eq "OPTIONS") {
      $response.StatusCode = 204
      $response.Headers["Access-Control-Allow-Origin"] = "*"
      $response.Headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
      $response.Headers["Access-Control-Allow-Headers"] = "Content-Type"
      $response.Close()
      continue
    }

    if ($path -eq "/api/flight") {
      $number = $request.QueryString["number"]
      $date = $request.QueryString["date"]
      $data = Get-FlightLookup $number $date
      Send-Json $response 200 $data
      continue
    }

    if ($path -eq "/") { $path = "/index.html" }
    $file = Join-Path $Root (($path.TrimStart("/") -replace "/", "\"))
    $full = [System.IO.Path]::GetFullPath($file)
    if (-not $full.StartsWith($Root)) {
      $response.StatusCode = 403
      $response.Close()
      continue
    }
    if (Test-Path $full -PathType Leaf) {
      $bytes = [System.IO.File]::ReadAllBytes($full)
      $ext = [System.IO.Path]::GetExtension($full).ToLowerInvariant()
      $response.ContentType = $(if ($mime.ContainsKey($ext)) { $mime[$ext] } else { "application/octet-stream" })
      $response.ContentLength64 = $bytes.Length
      $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $response.StatusCode = 404
    }
    $response.Close()
  } catch {
    $message = $_.Exception.Message
    $status = 502
    if ($message -match "404" -or $message -match "Not Found") { $status = 404; $message = "Flight not found." }
    Send-Json $response $status @{ error = $message }
  }
}
