// Vercel serverless function entry point
// This file is used by Vercel to handle all requests
try {
  // TypeScript компилируется в CommonJS, поэтому экспорт может быть в разных форматах
  const serverModule = require('../dist/server');
  
  // Проверяем разные варианты экспорта
  const app = serverModule.default || serverModule.exports || serverModule;
  
  if (!app) {
    throw new Error('Не удалось загрузить Express приложение из dist/server.js');
  }
  
  // Export the Express app as a serverless function
  module.exports = app;
} catch (error) {
  console.error('❌ Ошибка при загрузке serverless функции:', error);
  // Создаем минимальное Express приложение для обработки ошибок
  const express = require('express');
  const errorApp = express();
  errorApp.use((req, res) => {
    res.status(500).json({ 
      error: 'Ошибка при загрузке приложения',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  });
  module.exports = errorApp;
}

