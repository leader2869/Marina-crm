#!/bin/bash

echo "🔍 Полная диагностика проблемы с доступом к 1marina.ru"
echo "======================================================"
echo ""

# Проверка DNS
echo "1️⃣ Проверка DNS записей:"
echo "------------------------"
echo ""
echo "Корневой домен (1marina.ru):"
dig 1marina.ru +short
echo ""
echo "WWW домен (www.1marina.ru):"
dig www.1marina.ru +short
echo ""

# Проверка доступности через curl
echo "2️⃣ Проверка доступности через curl:"
echo "-----------------------------------"
echo ""
echo "Проверка https://1marina.ru:"
curl -I https://1marina.ru 2>&1 | head -5
echo ""
echo "Проверка https://www.1marina.ru:"
curl -I https://www.1marina.ru 2>&1 | head -5
echo ""

# Проверка SSL сертификата
echo "3️⃣ Проверка SSL сертификата:"
echo "----------------------------"
echo ""
echo "Сертификат для 1marina.ru:"
echo | openssl s_client -connect 1marina.ru:443 -servername 1marina.ru 2>/dev/null | openssl x509 -noout -subject -issuer 2>/dev/null | head -2
echo ""
echo "Сертификат для www.1marina.ru:"
echo | openssl s_client -connect www.1marina.ru:443 -servername www.1marina.ru 2>/dev/null | openssl x509 -noout -subject -issuer 2>/dev/null | head -2
echo ""

# Проверка файла hosts
echo "4️⃣ Проверка файла hosts:"
echo "------------------------"
if grep -q "marina" /etc/hosts 2>/dev/null; then
    echo "⚠️  Найдены записи для marina в /etc/hosts:"
    grep "marina" /etc/hosts
    echo ""
    echo "❌ Это может блокировать доступ к сайту!"
    echo "   Удалите или закомментируйте эти строки (добавьте # в начале)"
else
    echo "✅ Записей для marina в /etc/hosts не найдено"
fi
echo ""

# Проверка DNS серверов
echo "5️⃣ Текущие DNS серверы:"
echo "----------------------"
scutil --dns | grep "nameserver\[0\]" | head -3
echo ""

# Проверка ping
echo "6️⃣ Проверка ping:"
echo "----------------"
echo "Ping 1marina.ru:"
ping -c 2 1marina.ru 2>&1 | tail -2
echo ""
echo "Ping www.1marina.ru:"
ping -c 2 www.1marina.ru 2>&1 | tail -2
echo ""

echo "======================================================"
echo "✅ Диагностика завершена"
echo ""
echo "📋 Следующие шаги:"
echo ""
echo "1. Откройте браузер и нажмите F12 (или Cmd+Option+I на Mac)"
echo "2. Перейдите на вкладку 'Console'"
echo "3. Попробуйте открыть https://1marina.ru"
echo "4. Посмотрите, какие ошибки появляются в консоли"
echo "5. Запишите текст ошибки"
echo ""
echo "6. Попробуйте открыть https://www.1marina.ru"
echo "   (этот домен должен работать)"
echo ""
echo "7. Если www.1marina.ru работает, используйте его вместо 1marina.ru"
echo ""
echo "8. Для исправления DNS записей см. файл FIX_DNS_RECORDS.md"
echo ""





