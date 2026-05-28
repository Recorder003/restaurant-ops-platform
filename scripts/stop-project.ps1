$ports = @(4000, 5173)
$processIds = @()

foreach ($port in $ports) {
  $lines = netstat -ano | Select-String -Pattern ":$port\s+.*LISTENING\s+\d+"

  foreach ($line in $lines) {
    $parts = ($line.ToString() -split '\s+') | Where-Object { $_ }
    $processIds += [int]$parts[$parts.Length - 1]
  }
}

$processIds |
  Sort-Object -Unique |
  ForEach-Object {
    Write-Host "Stopping process on project dev port: $_"
    taskkill /PID $_ /T /F | Out-Host
  }
