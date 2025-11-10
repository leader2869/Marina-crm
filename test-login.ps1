# Тест входа в систему
$body = @{
    email = "admin@marina-crm.com"
    password = "admin123"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:3000/api/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body

Write-Host "✅ Вход выполнен успешно!"
Write-Host "Токен: $($response.token)"
Write-Host "Пользователь: $($response.user.email) - $($response.user.role)"

