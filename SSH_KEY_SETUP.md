# Настройка SSH ключа для GitHub

## ✅ SSH ключ создан!

Ваш публичный SSH ключ:
```
ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAINRNlUEefBm08lkK2bqPpC+m8lzo00PPHeCiUZlRHU3X vitalymacbookair@MacBook-Air-Vitalij.local
```

## 📋 Добавление ключа в GitHub

1. **Скопируйте публичный ключ выше** (весь ключ от `ssh-ed25519` до конца)

2. **Откройте GitHub в браузере:**
   - Перейдите на: https://github.com/settings/keys
   - Или: Settings → SSH and GPG keys → New SSH key

3. **Добавьте ключ:**
   - Нажмите "New SSH key"
   - Title: `MacBook Air Vitalij` (или любое удобное название)
   - Key: вставьте скопированный публичный ключ
   - Нажмите "Add SSH key"

4. **Проверьте подключение:**
   ```bash
   ssh -T git@github.com
   ```
   Должно появиться сообщение: "Hi leader2869! You've successfully authenticated..."

## 🚀 После добавления ключа

Теперь вы можете пушить изменения без ввода пароля:
```bash
git push origin main
```

## 📝 Примечание

Git remote уже настроен на использование SSH:
- `git@github.com:leader2869/Marina-crm.git`

Если нужно вернуться на HTTPS:
```bash
git remote set-url origin https://github.com/leader2869/Marina-crm.git
```

