# Скрипт для освобождения порта 3001
Write-Host "Поиск процессов на порту 3001..." -ForegroundColor Cyan

$port = 3001
$processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($processes) {
    foreach ($pid in $processes) {
        $processName = (Get-Process -Id $pid -ErrorAction SilentlyContinue).ProcessName
        Write-Host "Останавливаю процесс $pid ($processName) на порту $port" -ForegroundColor Yellow
        Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
    Write-Host "Порт $port освобожден" -ForegroundColor Green
} else {
    Write-Host "Порт $port уже свободен" -ForegroundColor Green
}

# Проверка
Start-Sleep -Seconds 1
$remaining = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($remaining) {
    Write-Host "Порт $port все еще занят. Попробуйте запустить от имени администратора." -ForegroundColor Red
} else {
    Write-Host "Порт $port свободен. Можно запускать сервер!" -ForegroundColor Green
}
