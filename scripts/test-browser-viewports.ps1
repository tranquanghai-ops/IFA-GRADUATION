$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$outDir = [System.IO.Path]::GetFullPath('tests/screenshots')
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
}

$viewports = @(
    @{ Name = 'desktop-1920'; Width = 1920; Height = 1080 },
    @{ Name = 'desktop-1366'; Width = 1366; Height = 768 },
    @{ Name = 'tablet-768';   Width = 768;  Height = 1024 },
    @{ Name = 'mobile-375';   Width = 375;  Height = 812 }
)

$targetUrl = 'https://ifa-graduation.web.app/'

foreach ($vp in $viewports) {
    $vpName = $vp.Name
    $vpW = $vp.Width
    $vpH = $vp.Height
    $file = Join-Path $outDir "viewport-$vpName.png"
    Write-Host "Capturing $vpName (${vpW}x${vpH})..."
    $argList = @(
        '--headless',
        '--disable-gpu',
        "--window-size=${vpW},${vpH}",
        "--screenshot=$file",
        $targetUrl
    )
    $proc = Start-Process -FilePath $edge -ArgumentList $argList -PassThru -NoNewWindow
    $proc.WaitForExit(10000)
    if (-not $proc.HasExited) {
        Stop-Process -Id $proc.Id -Force
    }
    if (Test-Path $file) {
        $len = (Get-Item $file).Length
        Write-Host "PASS: Successfully captured $vpName ($len bytes)"
    } else {
        Write-Host "FAIL: Failed to capture $vpName"
    }
}
Write-Host "Completed browser viewport testing."
