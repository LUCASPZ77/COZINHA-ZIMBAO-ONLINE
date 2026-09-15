$urls = @(
    'https://cozinha-zimbao-online.onrender.com/lista-estoque',
    'https://cozinha-zimbao-online.onrender.com/relatorios',
    'https://cozinha-zimbao-online.onrender.com/login',
    'https://cozinha-zimbao-online.vercel.app/'
)
foreach ($u in $urls) {
    Write-Host "\nChecking: $u"
    $t0 = [datetime]::UtcNow
    try {
        if ($u -like '*\/login') {
            $r = Invoke-WebRequest -Uri $u -Method POST -Body '{"usuario":"naoexiste","senha":"x"}' -ContentType 'application/json' -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
        } else {
            $r = Invoke-WebRequest -Uri $u -Method GET -UseBasicParsing -TimeoutSec 30 -ErrorAction Stop
        }
        $dt = ([datetime]::UtcNow - $t0).TotalMilliseconds
        $len = 0
        try { $len = $r.Content.Length } catch {}
        Write-Host "Status: $($r.StatusCode)    timeMs: $([math]::Round($dt))    len: $len"
    } catch {
        $dt = ([datetime]::UtcNow - $t0).TotalMilliseconds
        Write-Host "ERROR: $($_.Exception.Message)    timeMs: $([math]::Round($dt))"
    }
}
Write-Host "\nDone"
