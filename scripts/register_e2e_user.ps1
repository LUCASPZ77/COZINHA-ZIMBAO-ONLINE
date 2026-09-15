$cpf = '913.' + (Get-Random -Minimum 100 -Maximum 999).ToString() + '.' + (Get-Random -Minimum 100 -Maximum 999).ToString() + '-' + (Get-Random -Minimum 10 -Maximum 99).ToString()
$email = "test+$(New-Guid)@example.com"
$body = @{ cargo='Cozinheira'; nome='E2ETest'; sobrenome='Runner'; email=$email; cpf=$cpf } | ConvertTo-Json
Write-Host "Registering user with CPF: $cpf and email: $email"
try {
    $r = Invoke-RestMethod -Uri 'https://cozinha-zimbao-online.onrender.com/usuarios/registrar' -Method Post -ContentType 'application/json' -Body $body -ErrorAction Stop
    Write-Host "Registered: $($r | ConvertTo-Json -Compress)"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
}
Write-Host "E2E_USER $cpf $email"
