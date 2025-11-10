# Инструкция по добавлению изображения яхты

## Варианты интеграции изображения яхты Azimut 46:

### Вариант 1: Использовать URL из интернета

1. Найдите изображение яхты Azimut 46 в интернете (например, на Unsplash, Pexels, или официальном сайте Azimut)
2. Скопируйте URL изображения
3. В файле `LoadingAnimation.tsx` замените строку:
   ```typescript
   const boatImageUrl = 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=400&h=300&fit=crop'
   ```
   на ваш URL

### Вариант 2: Использовать локальное изображение

1. Создайте папку `public/images/` в директории `client/`
2. Поместите изображение яхты (PNG, JPG, SVG) в эту папку, например: `azimut-46.png`
3. В файле `LoadingAnimation.tsx` замените:
   ```typescript
   const boatImageUrl = '/images/azimut-46.png'
   ```

### Вариант 3: Использовать SVG из внешнего источника

1. Найдите SVG иконку яхты (например, на flaticon.com, icons8.com)
2. Используйте URL или локальный файл SVG
3. Замените `boatImageUrl` на путь к SVG

### Вариант 4: Использовать AI генерацию изображений

Можно использовать сервисы для генерации изображений:
- DALL-E
- Midjourney
- Stable Diffusion
- Leonardo.ai

Сгенерируйте изображение яхты Azimut 46 и используйте его по варианту 1 или 2.

## Рекомендуемые источники изображений:

1. **Unsplash** - https://unsplash.com/s/photos/azimut-yacht
2. **Pexels** - https://www.pexels.com/search/yacht/
3. **Официальный сайт Azimut** - https://www.azimutyachts.com/
4. **Flaticon** - https://www.flaticon.com/search?word=yacht (для SVG иконок)

## Размеры изображения:

Рекомендуемый размер: 400x300px или больше (будет автоматически масштабироваться)
Формат: PNG, JPG, SVG

