# Yandex Music DOM dumper for Stream Deck plugin diagnostics.
#
# Connects to the local Chrome DevTools Protocol exposed by the Yandex Music
# desktop app (port 9339, opened by the Stream Deck plugin when it launches
# the app), then dumps the current DOM and key element metadata once per
# second to JSON files in ./dom-dumps/.
#
# Each snapshot contains:
#   - timestamp, URL, page title, viewport size
#   - every element with a data-test-id (tag, classes, position, sprite hrefs,
#     aria-pressed, aria-label, trimmed text)
#   - candidate "player bar" containers by class-name substring
#   - full document.documentElement.outerHTML
#
# Stop with Ctrl+C. Then zip the dom-dumps folder and send it back.

$ErrorActionPreference = "Stop"
$Port = 9339
$OutputDir = Join-Path $PSScriptRoot "dom-dumps"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " Yandex Music DOM dumper" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Before continuing:" -ForegroundColor Yellow
Write-Host "  1. Make sure Yandex Music is running through the Stream Deck plugin"
Write-Host "     (the plugin launches the app with --remote-debugging-port=$Port)."
Write-Host "  2. Navigate to the page where Stream Deck buttons do not work"
Write-Host "     (e.g. My Vibe / Моя Волна)."
Write-Host "  3. Once the dump is running, press the Stream Deck buttons that"
Write-Host "     should be working and try them inside the app too."
Write-Host "  4. Stop with Ctrl+C, then zip the 'dom-dumps' folder and send it."
Write-Host ""

# --- Locate the music page target -------------------------------------------
try {
    $targets = Invoke-RestMethod -Uri "http://localhost:$Port/json" -TimeoutSec 5
} catch {
    Write-Host ""
    Write-Host "ERROR: cannot reach Chrome DevTools Protocol on port $Port." -ForegroundColor Red
    Write-Host "Start Yandex Music via the Stream Deck plugin first, then re-run this script." -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

$target = $targets | Where-Object { $_.type -eq 'page' -and $_.url -like 'music-application*' } | Select-Object -First 1

if (-not $target) {
    Write-Host ""
    Write-Host "ERROR: no 'music-application' page target found on port $Port." -ForegroundColor Red
    Write-Host "Targets discovered:" -ForegroundColor Yellow
    foreach ($t in $targets) { Write-Host ("  [{0}] {1} -> {2}" -f $t.type, $t.title, $t.url) }
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit 1
}

Write-Host ("Connecting to: {0}" -f $target.title) -ForegroundColor Green
Write-Host ("URL:           {0}" -f $target.url) -ForegroundColor Green
Write-Host ""

# --- Open a WebSocket connection to the target ------------------------------
$ws  = [System.Net.WebSockets.ClientWebSocket]::new()
$cts = [System.Threading.CancellationTokenSource]::new()

try {
    $ws.ConnectAsync([Uri]$target.webSocketDebuggerUrl, $cts.Token).Wait()
} catch {
    Write-Host ("ERROR: WebSocket connect failed: {0}" -f $_.Exception.Message) -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

$script:msgId = 0

function Send-CDP {
    param([string]$Method, $Params)
    $script:msgId++
    $id  = $script:msgId
    $msg = @{ id = $id; method = $Method }
    if ($Params) { $msg.params = $Params }
    $json    = $msg | ConvertTo-Json -Depth 20 -Compress
    $bytes   = [System.Text.Encoding]::UTF8.GetBytes($json)
    $segment = [System.ArraySegment[byte]]::new($bytes)
    $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, $cts.Token).Wait()
    return $id
}

function Receive-CDP {
    param([int]$ExpectedId)
    $buffer = New-Object byte[] 65536
    while ($true) {
        $sb = [System.Text.StringBuilder]::new()
        do {
            $segment = [System.ArraySegment[byte]]::new($buffer)
            $result  = $ws.ReceiveAsync($segment, $cts.Token).GetAwaiter().GetResult()
            [void]$sb.Append([System.Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count))
        } while (-not $result.EndOfMessage)
        $resp = $sb.ToString() | ConvertFrom-Json
        if ($resp.id -eq $ExpectedId) { return $resp }
    }
}

# JS payload — uses single-quoted here-string so PowerShell does not interpolate.
$Expression = @'
(function() {
    try {
        function rect(el) {
            const r = el.getBoundingClientRect();
            return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), visible: r.width > 0 && r.height > 0 };
        }
        function classes(el) {
            return (el.className && el.className.toString) ? el.className.toString().slice(0, 400) : '';
        }
        return JSON.stringify({
            timestamp: new Date().toISOString(),
            url: location.href,
            title: document.title,
            viewport: { w: window.innerWidth, h: window.innerHeight },
            testIds: Array.from(document.querySelectorAll('[data-test-id]')).map(el => ({
                tid: el.getAttribute('data-test-id'),
                tag: el.tagName,
                cls: classes(el),
                text: (el.textContent || '').trim().slice(0, 120),
                rect: rect(el),
                spriteHrefs: Array.from(el.querySelectorAll('use')).map(u => u.getAttribute('xlink:href') || u.getAttribute('href')).filter(Boolean),
                ariaPressed: el.getAttribute('aria-pressed'),
                ariaLabel: el.getAttribute('aria-label'),
                disabled: el.hasAttribute('disabled')
            })),
            playerBarCandidates: Array.from(document.querySelectorAll('[class*="PlayerBar"], [class*="playerBar"], [class*="player-bar"], [class*="Player_"], [class*="Vibe"]'))
                .slice(0, 10)
                .map(el => ({ tag: el.tagName, cls: classes(el), rect: rect(el) })),
            html: document.documentElement.outerHTML
        });
    } catch (err) {
        return JSON.stringify({ error: err.message, stack: err.stack });
    }
})()
'@

Write-Host "Dump loop is running. Press Ctrl+C to stop." -ForegroundColor Green
Write-Host ""

$counter = 0
try {
    while ($true) {
        try {
            $id      = Send-CDP -Method "Runtime.evaluate" -Params @{ expression = $Expression; returnByValue = $true }
            $resp    = Receive-CDP -ExpectedId $id
            $payload = $resp.result.result.value
            if (-not $payload) { $payload = ($resp | ConvertTo-Json -Depth 20 -Compress) }
            $ts   = (Get-Date).ToString("yyyyMMdd-HHmmss-fff")
            $file = Join-Path $OutputDir "dump-$ts.json"
            [System.IO.File]::WriteAllText($file, $payload, [System.Text.Encoding]::UTF8)
            $counter++
            $kb = [Math]::Round($payload.Length / 1024)
            Write-Host ("[{0,4}] {1}  ({2} KB)" -f $counter, (Split-Path $file -Leaf), $kb)
            if ($counter -gt 0 -and ($counter % 60) -eq 0) {
                Write-Host ("  -- {0} snapshots saved; press Ctrl+C when done --" -f $counter) -ForegroundColor Yellow
            }
        } catch {
            Write-Host ("Snapshot failed: {0}" -f $_.Exception.Message) -ForegroundColor Red
        }
        Start-Sleep -Seconds 1
    }
} finally {
    Write-Host ""
    Write-Host ("Stopped. {0} snapshots saved to:" -f $counter) -ForegroundColor Green
    Write-Host ("  {0}" -f $OutputDir) -ForegroundColor Green
    Write-Host ""
    Write-Host "Please zip the 'dom-dumps' folder and send the archive back."
    Write-Host ""
    try { $ws.CloseAsync([System.Net.WebSockets.WebSocketCloseStatus]::NormalClosure, "bye", $cts.Token).Wait() } catch {}
}
