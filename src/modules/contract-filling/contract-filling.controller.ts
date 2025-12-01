import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
import { AppDataSource } from '../../config/database';
import { Contragent } from '../../entities/Contragent';
import { UserRole } from '../../types';
import * as fs from 'fs';
import * as path from 'path';
import AdmZip from 'adm-zip';
import { parseString } from 'xml2js';
import { promisify } from 'util';

const parseStringAsync = promisify(parseString);

// Папки для хранения файлов
// На Vercel используем /tmp для временных файлов
const isVercel = !!process.env.VERCEL;
const baseFolder = isVercel ? '/tmp' : process.cwd();

const UPLOAD_FOLDER = path.join(baseFolder, 'contract-uploads');
const TEMPLATES_FOLDER = path.join(baseFolder, 'contract-templates');
const OUTPUT_FOLDER = path.join(baseFolder, 'contract-output');
const CONTRAGENTS_FOLDER = path.join(baseFolder, 'contract-contragents');

// Создаем папки если их нет (с обработкой ошибок)
try {
  [UPLOAD_FOLDER, TEMPLATES_FOLDER, OUTPUT_FOLDER, CONTRAGENTS_FOLDER].forEach(folder => {
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder, { recursive: true });
    }
  });
  
  // Логируем информацию о путях при инициализации
  let uploadFilesList: string[] = [];
  let templateFilesList: string[] = [];
  
  try {
    if (fs.existsSync(UPLOAD_FOLDER)) {
      uploadFilesList = fs.readdirSync(UPLOAD_FOLDER);
    }
  } catch (e: any) {
    console.error('[ContractFilling] Ошибка чтения папки загрузок при инициализации:', e.message);
  }
  
  try {
    if (fs.existsSync(TEMPLATES_FOLDER)) {
      templateFilesList = fs.readdirSync(TEMPLATES_FOLDER);
    }
  } catch (e: any) {
    console.error('[ContractFilling] Ошибка чтения папки шаблонов при инициализации:', e.message);
  }
  
  console.log('[ContractFilling] Инициализация путей:', {
    isVercel,
    baseFolder,
    baseFolderAbsolute: path.resolve(baseFolder),
    cwd: process.cwd(),
    cwdAbsolute: path.resolve(process.cwd()),
    uploadFolder: UPLOAD_FOLDER,
    uploadFolderAbsolute: path.resolve(UPLOAD_FOLDER),
    templatesFolder: TEMPLATES_FOLDER,
    templatesFolderAbsolute: path.resolve(TEMPLATES_FOLDER),
    uploadFolderExists: fs.existsSync(UPLOAD_FOLDER),
    templatesFolderExists: fs.existsSync(TEMPLATES_FOLDER),
    uploadFilesCount: uploadFilesList.length,
    uploadFiles: uploadFilesList,
    templateFilesCount: templateFilesList.length,
    templateFiles: templateFilesList
  });
} catch (error: any) {
  console.error('[ContractFilling] Ошибка при создании папок:', error.message);
  // Не блокируем запуск, но логируем ошибку
}

export class ContractFillingController {
  // Загрузка документа и извлечение якорей
  async upload(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.file) {
        throw new AppError('Файл не найден', 400);
      }

      const file = req.file;
      const filename = file.originalname;
      
      // Убеждаемся, что папка существует
      if (!fs.existsSync(UPLOAD_FOLDER)) {
        console.log('[ContractFilling] Создаем папку UPLOAD_FOLDER:', UPLOAD_FOLDER);
        fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });
      }
      
      const filepath = path.join(UPLOAD_FOLDER, filename);
      
      console.log('[ContractFilling] Сохранение файла:', {
        filename,
        filepath,
        fileSize: file.buffer.length,
        uploadFolder: UPLOAD_FOLDER,
        folderExists: fs.existsSync(UPLOAD_FOLDER)
      });

      // Сохраняем файл
      fs.writeFileSync(filepath, file.buffer);
      
      // Проверяем, что файл действительно сохранен
      if (!fs.existsSync(filepath)) {
        throw new AppError('Не удалось сохранить файл', 500);
      }
      
      const savedFileSize = fs.statSync(filepath).size;
      console.log('[ContractFilling] Файл сохранен успешно, размер:', savedFileSize, 'байт');

      // Извлекаем якоря из документа
      const anchors = await this.extractAnchorsFromDoc(filepath);
      
      console.log('[ContractFilling] Найдено якорей:', anchors.length);

      res.json({
        success: true,
        filename: filename,
        anchors: anchors,
        message: `Документ загружен. Найдено якорей: ${anchors.length}`
      });
    } catch (error: any) {
      console.error('[ContractFilling] Ошибка в upload:', {
        message: error.message,
        stack: error.stack
      });
      next(new AppError(error.message || 'Ошибка при загрузке файла', 500));
    }
  }

  // Сохранение шаблона
  async saveTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filename, anchors } = req.body;

      if (!filename) {
        throw new AppError('Имя файла не указано', 400);
      }

      const sourcePath = path.join(UPLOAD_FOLDER, filename);

      if (!fs.existsSync(sourcePath)) {
        throw new AppError('Файл не найден', 404);
      }

      // Определяем расширение файла
      const ext = path.extname(filename).toLowerCase() || '.docx';
      
      // Генерируем имя файла на основе даты и времени
      const now = new Date();
      const timestamp = now.toISOString()
        .replace(/[:.]/g, '-')
        .slice(0, -5) // Убираем миллисекунды и Z
        .replace('T', '_'); // Заменяем T на подчеркивание
      
      const templateFilename = `template_${timestamp}${ext}`;
      const templatePath = path.join(TEMPLATES_FOLDER, templateFilename);

      // Копируем файл в папку шаблонов с новым именем
      fs.copyFileSync(sourcePath, templatePath);

      // Сохраняем метаданные
      const metadata = {
        filename: templateFilename,
        original_filename: filename, // Сохраняем оригинальное имя для справки
        anchors: anchors || [],
        created_at: now.toISOString()
      };
      const metadataPath = path.join(TEMPLATES_FOLDER, templateFilename + '.json');
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

      res.json({
        success: true,
        message: 'Шаблон сохранен',
        filename: templateFilename
      });
    } catch (error: any) {
      next(new AppError(error.message || 'Ошибка при сохранении шаблона', 500));
    }
  }

  // Список шаблонов
  async getTemplates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const templates: any[] = [];

      if (!fs.existsSync(TEMPLATES_FOLDER)) {
        console.log('[ContractFilling] Папка шаблонов не существует, создаем:', TEMPLATES_FOLDER);
        try {
          fs.mkdirSync(TEMPLATES_FOLDER, { recursive: true });
        } catch (mkdirError: any) {
          console.error('[ContractFilling] Ошибка при создании папки шаблонов:', mkdirError.message);
        }
        res.json({ templates: [] });
        return;
      }

      const files = fs.readdirSync(TEMPLATES_FOLDER);
      console.log('[ContractFilling] Файлы в папке шаблонов:', files);
      
      for (const file of files) {
        try {
          if (file.endsWith('.json')) {
            const metadataPath = path.join(TEMPLATES_FOLDER, file);
            try {
              const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
              
              // Проверяем, что файл шаблона существует
              if (metadata.filename) {
                const templateFilePath = path.join(TEMPLATES_FOLDER, metadata.filename);
                if (fs.existsSync(templateFilePath)) {
                  templates.push(metadata);
                } else {
                  console.warn(`[ContractFilling] Файл шаблона не найден: ${templateFilePath}`);
                }
              } else {
                console.warn(`[ContractFilling] Метаданные без filename: ${file}`);
              }
            } catch (parseError: any) {
              console.error(`[ContractFilling] Ошибка при парсинге метаданных ${file}:`, parseError.message);
            }
          } else if (file.match(/\.(doc|docx)$/i)) {
            // Пропускаем файлы, которые уже имеют метаданные
            const metadataFile = file + '.json';
            if (files.includes(metadataFile)) {
              continue; // Этот файл уже обработан через метаданные
            }
            
            // Если есть файл без метаданных, создаем метаданные на лету
            const templateFilePath = path.join(TEMPLATES_FOLDER, file);
            if (fs.existsSync(templateFilePath)) {
              // Пытаемся извлечь якоря (но не блокируем, если не получится)
              try {
                const anchors = await this.extractAnchorsFromDoc(templateFilePath);
                const stats = fs.statSync(templateFilePath);
                templates.push({
                  filename: file,
                  original_filename: file, // Для старых шаблонов без метаданных
                  anchors: anchors || [],
                  created_at: stats.mtime.toISOString()
                });
              } catch (error: any) {
                console.warn(`[ContractFilling] Не удалось извлечь якоря из ${file}:`, error.message);
                // Все равно добавляем шаблон, но с пустыми якорями
                try {
                  const stats = fs.statSync(templateFilePath);
                  templates.push({
                    filename: file,
                    original_filename: file,
                    anchors: [],
                    created_at: stats.mtime.toISOString()
                  });
                } catch (statError: any) {
                  console.error(`[ContractFilling] Ошибка при получении статистики файла ${file}:`, statError.message);
                }
              }
            }
          }
        } catch (fileError: any) {
          console.error(`[ContractFilling] Ошибка при обработке файла ${file}:`, fileError.message);
          // Продолжаем обработку других файлов
        }
      }

      console.log('[ContractFilling] Возвращаем шаблоны:', templates.map(t => t.filename));
      res.json({ templates });
    } catch (error: any) {
      console.error('[ContractFilling] Критическая ошибка в getTemplates:', {
        message: error.message,
        stack: error.stack
      });
      next(new AppError(error.message || 'Ошибка при загрузке шаблонов', 500));
    }
  }

  // Удаление шаблона
  async deleteTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filename } = req.params;

      if (!filename) {
        throw new AppError('Имя файла не указано', 400);
      }

      const templatePath = path.join(TEMPLATES_FOLDER, filename);
      const metadataPath = path.join(TEMPLATES_FOLDER, filename + '.json');

      if (!fs.existsSync(templatePath) && !fs.existsSync(metadataPath)) {
        throw new AppError('Шаблон не найден', 404);
      }

      // Удаляем файл шаблона
      if (fs.existsSync(templatePath)) {
        fs.unlinkSync(templatePath);
      }

      // Удаляем метаданные
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }

      res.json({
        success: true,
        message: 'Шаблон удален'
      });
    } catch (error: any) {
      next(new AppError(error.message || 'Ошибка при удалении шаблона', 500));
    }
  }

  // Переименование шаблона
  async renameTemplate(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filename } = req.params;
      const { newFilename } = req.body;

      if (!filename) {
        throw new AppError('Имя файла не указано', 400);
      }

      if (!newFilename || !newFilename.trim()) {
        throw new AppError('Новое имя файла не указано', 400);
      }

      // Проверяем расширение
      const sanitizedNewFilename = newFilename.trim();
      if (!sanitizedNewFilename.match(/\.(doc|docx)$/i)) {
        throw new AppError('Новое имя должно иметь расширение .doc или .docx', 400);
      }

      const oldTemplatePath = path.join(TEMPLATES_FOLDER, filename);
      const oldMetadataPath = path.join(TEMPLATES_FOLDER, filename + '.json');
      const newTemplatePath = path.join(TEMPLATES_FOLDER, sanitizedNewFilename);
      const newMetadataPath = path.join(TEMPLATES_FOLDER, sanitizedNewFilename + '.json');

      if (!fs.existsSync(oldTemplatePath) && !fs.existsSync(oldMetadataPath)) {
        throw new AppError('Шаблон не найден', 404);
      }

      if (fs.existsSync(newTemplatePath) || fs.existsSync(newMetadataPath)) {
        throw new AppError('Шаблон с таким именем уже существует', 400);
      }

      // Переименовываем файл шаблона
      if (fs.existsSync(oldTemplatePath)) {
        fs.renameSync(oldTemplatePath, newTemplatePath);
      }

      // Переименовываем метаданные
      if (fs.existsSync(oldMetadataPath)) {
        const metadata = JSON.parse(fs.readFileSync(oldMetadataPath, 'utf-8'));
        metadata.filename = sanitizedNewFilename;
        metadata.updated_at = new Date().toISOString();
        fs.writeFileSync(newMetadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
        fs.unlinkSync(oldMetadataPath);
      } else {
        // Если метаданных нет, создаем новые
        const metadata = {
          filename: sanitizedNewFilename,
          anchors: [],
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        fs.writeFileSync(newMetadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
      }

      res.json({
        success: true,
        message: 'Шаблон переименован',
        filename: sanitizedNewFilename
      });
    } catch (error: any) {
      next(new AppError(error.message || 'Ошибка при переименовании шаблона', 500));
    }
  }

  // Заполнение договора
  async fillContract(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { template_filename, data } = req.body;

      console.log('[ContractFilling] fillContract вызван:', {
        template_filename,
        template_filename_type: typeof template_filename,
        dataKeys: data ? Object.keys(data) : [],
        uploadFolder: UPLOAD_FOLDER,
        templatesFolder: TEMPLATES_FOLDER,
        outputFolder: OUTPUT_FOLDER
      });

      if (!template_filename) {
        throw new AppError('Имя файла не указано', 400);
      }

      // Декодируем имя файла, если оно пришло в неправильной кодировке
      let decodedFilename = template_filename;
      try {
        decodedFilename = decodeURIComponent(template_filename);
      } catch (e) {
        decodedFilename = template_filename;
      }

      console.log('[ContractFilling] Начало поиска файла:', {
        template_filename,
        decodedFilename,
        uploadFolder: UPLOAD_FOLDER,
        templatesFolder: TEMPLATES_FOLDER,
        uploadFolderExists: fs.existsSync(UPLOAD_FOLDER),
        templatesFolderExists: fs.existsSync(TEMPLATES_FOLDER),
        cwd: process.cwd(),
        isVercel
      });

      // Сначала ищем файл в папке загрузок (UPLOAD_FOLDER)
      let templatePath = path.join(UPLOAD_FOLDER, decodedFilename);
      console.log('[ContractFilling] Проверка файла в папке загрузок:', templatePath, 'существует:', fs.existsSync(templatePath));
      
      if (!fs.existsSync(templatePath)) {
        // Пробуем оригинальное имя
        templatePath = path.join(UPLOAD_FOLDER, template_filename);
        console.log('[ContractFilling] Проверка файла (оригинальное имя):', templatePath, 'существует:', fs.existsSync(templatePath));
      }

      // Если не нашли в папке загрузок, ищем в папке шаблонов
      if (!fs.existsSync(templatePath)) {
        templatePath = path.join(TEMPLATES_FOLDER, decodedFilename);
        console.log('[ContractFilling] Проверка файла в папке шаблонов:', templatePath, 'существует:', fs.existsSync(templatePath));
      }

      if (!fs.existsSync(templatePath)) {
        templatePath = path.join(TEMPLATES_FOLDER, template_filename);
        console.log('[ContractFilling] Проверка файла в папке шаблонов (оригинальное):', templatePath, 'существует:', fs.existsSync(templatePath));
      }

      if (!fs.existsSync(templatePath)) {
        // Убеждаемся, что папки существуют
        if (!fs.existsSync(UPLOAD_FOLDER)) {
          console.log('[ContractFilling] Создаем папку UPLOAD_FOLDER:', UPLOAD_FOLDER);
          fs.mkdirSync(UPLOAD_FOLDER, { recursive: true });
        }
        if (!fs.existsSync(TEMPLATES_FOLDER)) {
          console.log('[ContractFilling] Создаем папку TEMPLATES_FOLDER:', TEMPLATES_FOLDER);
          fs.mkdirSync(TEMPLATES_FOLDER, { recursive: true });
        }
        
        // Пробуем найти файл по списку файлов в папке загрузок
        let uploadFiles: string[] = [];
        let templateFiles: string[] = [];
        
        try {
          const uploadExists = fs.existsSync(UPLOAD_FOLDER);
          console.log('[ContractFilling] Проверка папки загрузок:', {
            path: UPLOAD_FOLDER,
            exists: uploadExists,
            absolutePath: path.resolve(UPLOAD_FOLDER)
          });
          
          if (uploadExists) {
            const allUploadFiles = fs.readdirSync(UPLOAD_FOLDER);
            console.log('[ContractFilling] Все файлы в папке загрузок:', allUploadFiles);
            uploadFiles = allUploadFiles.filter(f => f.match(/\.(doc|docx)$/i));
            console.log('[ContractFilling] Отфильтрованные DOCX файлы в загрузках:', uploadFiles);
          } else {
            console.warn('[ContractFilling] Папка загрузок не существует:', UPLOAD_FOLDER);
          }
        } catch (error: any) {
          console.error('[ContractFilling] Ошибка чтения папки загрузок:', {
            message: error.message,
            stack: error.stack,
            path: UPLOAD_FOLDER
          });
        }
        
        try {
          const templatesExists = fs.existsSync(TEMPLATES_FOLDER);
          console.log('[ContractFilling] Проверка папки шаблонов:', {
            path: TEMPLATES_FOLDER,
            exists: templatesExists,
            absolutePath: path.resolve(TEMPLATES_FOLDER)
          });
          
          if (templatesExists) {
            const allTemplateFiles = fs.readdirSync(TEMPLATES_FOLDER);
            console.log('[ContractFilling] Все файлы в папке шаблонов:', allTemplateFiles);
            templateFiles = allTemplateFiles.filter(f => f.match(/\.(doc|docx)$/i));
            console.log('[ContractFilling] Отфильтрованные DOCX файлы в шаблонах:', templateFiles);
          } else {
            console.warn('[ContractFilling] Папка шаблонов не существует:', TEMPLATES_FOLDER);
          }
        } catch (error: any) {
          console.error('[ContractFilling] Ошибка чтения папки шаблонов:', {
            message: error.message,
            stack: error.stack,
            path: TEMPLATES_FOLDER
          });
        }
        
        const allFiles = [...uploadFiles, ...templateFiles];
        
        // Детальное логирование для отладки
        console.log('[ContractFilling] Поиск файла:', {
          template_filename,
          decodedFilename,
          uploadFolder: UPLOAD_FOLDER,
          templatesFolder: TEMPLATES_FOLDER,
          uploadFolderExists: fs.existsSync(UPLOAD_FOLDER),
          templatesFolderExists: fs.existsSync(TEMPLATES_FOLDER),
          uploadFiles,
          templateFiles,
          allFiles,
          cwd: process.cwd(),
          isVercel
        });
        
        // Логируем байтовые представления имен файлов для отладки кодировки
        if (uploadFiles.length > 0 || templateFiles.length > 0) {
          console.log('[ContractFilling] Детали файлов:', {
            templateFilenameBytes: Buffer.from(template_filename, 'utf8').toString('hex'),
            decodedFilenameBytes: Buffer.from(decodedFilename, 'utf8').toString('hex'),
            uploadFilesBytes: uploadFiles.map(f => Buffer.from(f, 'utf8').toString('hex')),
            templateFilesBytes: templateFiles.map(f => Buffer.from(f, 'utf8').toString('hex'))
          });
        }
        
        // Ищем файл, который может быть похожим (без учета регистра)
        // Нормализуем имена файлов для сравнения (убираем лишние пробелы, приводим к нижнему регистру)
        const normalizeFileName = (name: string) => name.toLowerCase().trim().replace(/\s+/g, ' ');
        const templateLower = normalizeFileName(template_filename);
        const decodedLower = normalizeFileName(decodedFilename);
        
        const matchingFile = allFiles.find(file => {
          const fileLower = normalizeFileName(file);
          // Точное совпадение или частичное
          return fileLower === templateLower || 
                 fileLower === decodedLower ||
                 fileLower.includes(templateLower) || 
                 templateLower.includes(fileLower) ||
                 fileLower.includes(decodedLower) ||
                 decodedLower.includes(fileLower) ||
                 // Также проверяем без расширения
                 fileLower.replace(/\.(doc|docx)$/i, '') === templateLower.replace(/\.(doc|docx)$/i, '') ||
                 fileLower.replace(/\.(doc|docx)$/i, '') === decodedLower.replace(/\.(doc|docx)$/i, '');
        });

        if (matchingFile) {
          // Проверяем в какой папке находится файл
          const uploadPath = path.join(UPLOAD_FOLDER, matchingFile);
          const templatePathCheck = path.join(TEMPLATES_FOLDER, matchingFile);
          templatePath = fs.existsSync(uploadPath) ? uploadPath : templatePathCheck;
          console.log('[ContractFilling] Найден похожий файл:', {
            matchingFile,
            templatePath,
            uploadPath,
            templatePathCheck,
            uploadPathExists: fs.existsSync(uploadPath),
            templatePathCheckExists: fs.existsSync(templatePathCheck),
            finalPath: templatePath,
            finalPathExists: fs.existsSync(templatePath)
          });
        } else {
          // Пробуем найти файл напрямую по имени (на случай, если он не попал в список)
          const directUploadPath = path.join(UPLOAD_FOLDER, template_filename);
          const directDecodedUploadPath = path.join(UPLOAD_FOLDER, decodedFilename);
          const directTemplatePath = path.join(TEMPLATES_FOLDER, template_filename);
          const directDecodedTemplatePath = path.join(TEMPLATES_FOLDER, decodedFilename);
          
          console.log('[ContractFilling] Прямая проверка путей:', {
            directUploadPath,
            directUploadPathExists: fs.existsSync(directUploadPath),
            directDecodedUploadPath,
            directDecodedUploadPathExists: fs.existsSync(directDecodedUploadPath),
            directTemplatePath,
            directTemplatePathExists: fs.existsSync(directTemplatePath),
            directDecodedTemplatePath,
            directDecodedTemplatePathExists: fs.existsSync(directDecodedTemplatePath)
          });
          
          if (fs.existsSync(directUploadPath)) {
            templatePath = directUploadPath;
            console.log('[ContractFilling] Файл найден по прямому пути (upload, оригинальное имя):', templatePath);
          } else if (fs.existsSync(directDecodedUploadPath)) {
            templatePath = directDecodedUploadPath;
            console.log('[ContractFilling] Файл найден по прямому пути (upload, декодированное имя):', templatePath);
          } else if (fs.existsSync(directTemplatePath)) {
            templatePath = directTemplatePath;
            console.log('[ContractFilling] Файл найден по прямому пути (template, оригинальное имя):', templatePath);
          } else if (fs.existsSync(directDecodedTemplatePath)) {
            templatePath = directDecodedTemplatePath;
            console.log('[ContractFilling] Файл найден по прямому пути (template, декодированное имя):', templatePath);
        } else {
          console.error('[ContractFilling] Файл не найден:', {
            template_filename,
            decodedFilename,
            uploadFiles,
            templateFiles,
            uploadFolderExists: fs.existsSync(UPLOAD_FOLDER),
              templatesFolderExists: fs.existsSync(TEMPLATES_FOLDER),
              uploadFolderAbsolute: path.resolve(UPLOAD_FOLDER),
              templatesFolderAbsolute: path.resolve(TEMPLATES_FOLDER)
          });
          throw new AppError(`Файл не найден: ${template_filename}. Доступные файлы в загрузках: ${uploadFiles.length > 0 ? uploadFiles.join(', ') : '(папка пуста или не существует)'}, в шаблонах: ${templateFiles.length > 0 ? templateFiles.join(', ') : '(папка пуста или не существует)'}`, 404);
          }
        }
      }
      
      console.log('[ContractFilling] Используем файл:', templatePath, 'существует:', fs.existsSync(templatePath));

      // Фильтруем пустые значения
      const filteredData: Record<string, string> = {};
      for (const [key, value] of Object.entries(data || {})) {
        if (value && String(value).trim()) {
          filteredData[key] = String(value);
        }
      }

      if (Object.keys(filteredData).length === 0) {
        throw new AppError('Нет данных для заполнения', 400);
      }

      // Убеждаемся, что папка OUTPUT_FOLDER существует
      if (!fs.existsSync(OUTPUT_FOLDER)) {
        console.log('[ContractFilling] Создаем папку OUTPUT_FOLDER:', OUTPUT_FOLDER);
        fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
      }

      // Генерируем имя выходного файла
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const outputFilename = `filled_${timestamp}_${template_filename}`;
      const outputPath = path.join(OUTPUT_FOLDER, outputFilename);

      console.log('[ContractFilling] Начинаем заполнение договора:', {
        templatePath,
        outputPath,
        filteredDataKeys: Object.keys(filteredData)
      });

      // Заполняем договор
      await this.replaceAnchorsInDoc(templatePath, filteredData, outputPath);

      // Проверяем, что файл создан
      if (!fs.existsSync(outputPath)) {
        throw new AppError('Не удалось создать выходной файл', 500);
      }

      // Проверяем, что файл действительно отличается от исходного
      const outputStats = fs.statSync(outputPath);
      const templateStats = fs.statSync(templatePath);
      
      console.log('[ContractFilling] Сравнение файлов:', {
        templatePath,
        outputPath,
        templateSize: templateStats.size,
        outputSize: outputStats.size,
        sizesMatch: templateStats.size === outputStats.size
      });

      // Проверяем содержимое заполненного файла
      try {
        const checkZip = new AdmZip(outputPath);
        const checkEntry = checkZip.getEntry('word/document.xml');
        if (checkEntry) {
          const checkContent = checkEntry.getData().toString('utf-8');
          const checkText = checkContent.replace(/<[^>]+>/g, '');
          
          // Проверяем, что хотя бы один якорь был заменен
          const hasReplacedData = Object.values(filteredData).some(value => 
            checkText.includes(String(value))
          );
          
          if (!hasReplacedData && Object.keys(filteredData).length > 0) {
            console.warn('[ContractFilling] ВНИМАНИЕ: Заполненные данные не найдены в выходном файле!');
            console.warn('[ContractFilling] Данные для заполнения:', Object.keys(filteredData));
            console.warn('[ContractFilling] Первые 300 символов текста файла:', checkText.substring(0, 300));
          } else {
            console.log('[ContractFilling] Подтверждено: данные успешно добавлены в файл');
          }
        }
      } catch (checkError: any) {
        console.warn('[ContractFilling] Не удалось проверить содержимое файла:', checkError.message);
      }

      console.log('[ContractFilling] Договор успешно заполнен:', outputPath);

      res.json({
        success: true,
        filename: outputFilename,
        message: `Договор успешно заполнен. Заменено якорей: ${Object.keys(filteredData).length}`,
        replaced_anchors: Object.keys(filteredData)
      });
    } catch (error: any) {
      console.error('[ContractFilling] Ошибка в fillContract:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      next(new AppError(error.message || 'Ошибка при заполнении договора', 500));
    }
  }

  // Скачивание файла
  async download(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filename } = req.params;
      
      // Декодируем имя файла из URL
      const decodedFilename = decodeURIComponent(filename);
      const filepath = path.join(OUTPUT_FOLDER, decodedFilename);

      console.log('[ContractFilling] Запрос на скачивание файла:', {
        filename,
        decodedFilename,
        filepath,
        exists: fs.existsSync(filepath),
        outputFolder: OUTPUT_FOLDER
      });

      if (!fs.existsSync(filepath)) {
        throw new AppError('Файл не найден', 404);
      }

      // Проверяем, что это действительно заполненный файл (начинается с filled_)
      if (!decodedFilename.startsWith('filled_')) {
        console.warn('[ContractFilling] ВНИМАНИЕ: Скачивается файл, который не является заполненным:', decodedFilename);
      }

      // Определяем MIME тип
      const ext = path.extname(decodedFilename).toLowerCase();
      let contentType = 'application/octet-stream';
      if (ext === '.doc') {
        contentType = 'application/msword';
      } else if (ext === '.docx') {
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      }

      // Читаем файл
      const fileBuffer = fs.readFileSync(filepath);
      const stats = fs.statSync(filepath);
      
      console.log('[ContractFilling] Файл готов к скачиванию:', {
        filename: decodedFilename,
        size: stats.size,
        contentType
      });
      
      // Устанавливаем заголовки
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(decodedFilename)}"`);
      res.setHeader('Content-Length', fileBuffer.length.toString());
      
      // Отправляем файл
      res.send(fileBuffer);
    } catch (error: any) {
      console.error('[ContractFilling] Ошибка при скачивании файла:', {
        message: error.message,
        stack: error.stack
      });
      next(new AppError(error.message || 'Ошибка при скачивании файла', 500));
    }
  }

  // Список контрагентов
  async getContragents(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      console.log('[ContractFilling] Запрос на получение контрагентов');
      
      if (!AppDataSource.isInitialized) {
        throw new AppError('База данных не подключена', 503);
      }

      const contragentRepository = AppDataSource.getRepository(Contragent);
      
      // Получаем контрагентов для текущего пользователя или клуба
      const where: any = {};
      if (req.userId) {
        where.userId = req.userId;
      }
      
      const contragents = await contragentRepository.find({
        where,
        order: { updated_at: 'DESC' },
      });

      // Преобразуем для совместимости с фронтендом
      const formattedContragents = contragents.map(c => ({
        id: c.id,
        filename: `${c.id}.json`, // Для совместимости
        name: c.name,
        data: c.data,
        created_at: c.created_at.toISOString(),
        updated_at: c.updated_at.toISOString(),
      }));

      console.log('[ContractFilling] Всего загружено контрагентов:', formattedContragents.length);
      res.json({ contragents: formattedContragents });
    } catch (error: any) {
      console.error('[ContractFilling] Ошибка при загрузке контрагентов:', {
        message: error.message,
        stack: error.stack
      });
      next(new AppError(error.message || 'Ошибка при загрузке контрагентов', 500));
    }
  }

  // Сохранение контрагента
  async saveContragent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name, data } = req.body;

      if (!name || !name.trim()) {
        throw new AppError('Имя контрагента не указано', 400);
      }

      if (!data || Object.keys(data).length === 0) {
        throw new AppError('Нет данных для сохранения', 400);
      }

      if (!AppDataSource.isInitialized) {
        throw new AppError('База данных не подключена', 503);
      }

      const contragentRepository = AppDataSource.getRepository(Contragent);
      
      // Создаем новый контрагент
      const contragent = contragentRepository.create({
        name: name.trim(),
        data: data,
        userId: req.userId || null,
      });

      const savedContragent = await contragentRepository.save(contragent);

      console.log('[ContractFilling] Контрагент сохранен в БД:', {
        id: savedContragent.id,
        name: savedContragent.name
      });

      res.json({
        success: true,
        message: `Контрагент "${name}" сохранен`,
        filename: `${savedContragent.id}.json`, // Для совместимости
        id: savedContragent.id
      });
    } catch (error: any) {
      console.error('[ContractFilling] Ошибка при сохранении контрагента:', {
        message: error.message,
        stack: error.stack
      });
      next(new AppError(error.message || 'Ошибка при сохранении контрагента', 500));
    }
  }

  // Получение контрагента
  async getContragent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filename } = req.params;
      
      // Извлекаем ID из filename (формат: "123.json" или просто "123")
      const id = parseInt(filename.replace('.json', ''));
      
      if (isNaN(id)) {
        throw new AppError('Некорректный ID контрагента', 400);
      }

      if (!AppDataSource.isInitialized) {
        throw new AppError('База данных не подключена', 503);
      }

      const contragentRepository = AppDataSource.getRepository(Contragent);
      
      const where: any = { id };
      if (req.userId) {
        where.userId = req.userId;
      }
      
      const contragent = await contragentRepository.findOne({ where });

      if (!contragent) {
        throw new AppError('Контрагент не найден', 404);
      }

      // Преобразуем для совместимости с фронтендом
      res.json({
        id: contragent.id,
        name: contragent.name,
        data: contragent.data,
        created_at: contragent.created_at.toISOString(),
        updated_at: contragent.updated_at.toISOString(),
      });
    } catch (error: any) {
      console.error('[ContractFilling] Ошибка при загрузке контрагента:', {
        message: error.message,
        stack: error.stack
      });
      next(new AppError(error.message || 'Ошибка при загрузке контрагента', 500));
    }
  }

  // Удаление контрагента
  async deleteContragent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filename } = req.params;
      
      // Извлекаем ID из filename (формат: "123.json" или просто "123")
      const id = parseInt(filename.replace('.json', ''));
      
      if (isNaN(id)) {
        throw new AppError('Некорректный ID контрагента', 400);
      }

      if (!AppDataSource.isInitialized) {
        throw new AppError('База данных не подключена', 503);
      }

      const contragentRepository = AppDataSource.getRepository(Contragent);
      
      const where: any = { id };
      if (req.userId) {
        where.userId = req.userId;
      }
      
      const contragent = await contragentRepository.findOne({ where });

      if (!contragent) {
        throw new AppError('Контрагент не найден', 404);
      }

      await contragentRepository.remove(contragent);

      console.log('[ContractFilling] Контрагент удален из БД:', id);

      res.json({
        success: true,
        message: 'Контрагент удален'
      });
    } catch (error: any) {
      console.error('[ContractFilling] Ошибка при удалении контрагента:', {
        message: error.message,
        stack: error.stack
      });
      next(new AppError(error.message || 'Ошибка при удалении контрагента', 500));
    }
  }

  // Извлечение текста из XML узла (рекурсивно)
  private extractTextFromXmlNode(node: any): string {
    if (typeof node === 'string') {
      return node;
    }
    if (Array.isArray(node)) {
      return node.map(n => this.extractTextFromXmlNode(n)).join('');
    }
    if (node && typeof node === 'object') {
      // В DOCX текст находится в элементах w:t
      if (node['w:t']) {
        return this.extractTextFromXmlNode(node['w:t']);
      }
      // Рекурсивно обрабатываем все дочерние элементы
      return Object.values(node)
        .map(val => this.extractTextFromXmlNode(val))
        .join('');
    }
    return '';
  }

  // Извлечение якорей из DOCX файла
  private async extractAnchorsFromDoc(docPath: string): Promise<string[]> {
    try {
      const zip = new AdmZip(docPath);
      const zipEntries = zip.getEntries();

      const anchors = new Set<string>();

      // Ищем якоря в document.xml
      for (const entry of zipEntries) {
        if (entry.entryName === 'word/document.xml') {
          const xmlContent = entry.getData().toString('utf-8');
          
          try {
            // Парсим XML
            const parsed = await parseStringAsync(xmlContent);
            
            // Извлекаем весь текст из документа
            const fullText = this.extractTextFromXmlNode(parsed);
            
            // Ищем якоря в тексте
            const patterns = [
              /\{\{([^}]+)\}\}/g,  // {{имя}}
              /\{([^}]+)\}/g       // {имя}
            ];

            for (const pattern of patterns) {
              let match;
              while ((match = pattern.exec(fullText)) !== null) {
                // Очищаем якорь от лишних символов, но сохраняем кириллицу и пробелы
                const anchor = match[1]
                  .trim()
                  .replace(/[\r\n\t]/g, ' ') // Заменяем переносы на пробелы
                  .replace(/\s+/g, ' ')      // Множественные пробелы в один
                  .replace(/[^\w\s\-а-яА-ЯёЁ]/g, ''); // Удаляем спецсимволы, кроме букв, цифр, пробелов и дефисов
                
                if (anchor && anchor.length > 0) {
                  anchors.add(anchor);
                }
              }
            }
          } catch (parseError: any) {
            // Если не удалось распарсить XML, используем простой поиск по тексту
            console.warn('[ContractFilling] Не удалось распарсить XML, используем простой поиск:', parseError.message);
            
            // Удаляем XML-теги для простого поиска
            const textWithoutTags = xmlContent
              .replace(/<[^>]+>/g, ' ') // Удаляем все теги
              .replace(/\s+/g, ' ')    // Множественные пробелы в один
              .trim();
            
            const patterns = [
              /\{\{([^}]+)\}\}/g,  // {{имя}}
              /\{([^}]+)\}/g       // {имя}
            ];

            for (const pattern of patterns) {
              let match;
              while ((match = pattern.exec(textWithoutTags)) !== null) {
                const anchor = match[1]
                  .trim()
                  .replace(/\s+/g, ' ')
                  .replace(/[^\w\s\-а-яА-ЯёЁ]/g, '');
                
                if (anchor && anchor.length > 0) {
                  anchors.add(anchor);
                }
              }
            }
          }
        }
      }

      return Array.from(anchors).sort();
    } catch (error: any) {
      throw new AppError(`Ошибка при извлечении якорей: ${error.message}`, 500);
    }
  }

  // Нормализация якоря для сравнения
  private normalizeAnchor(anchor: string): string {
    return anchor
      .trim()
      .replace(/[\r\n\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-а-яА-ЯёЁ]/g, '')
      .toLowerCase();
  }

  // Замена якорей в DOCX файле
  private async replaceAnchorsInDoc(
    templatePath: string,
    data: Record<string, string>,
    outputPath: string
  ): Promise<void> {
    try {
      console.log('[ContractFilling] Начинаем замену якорей:', {
        templatePath,
        outputPath,
        dataKeys: Object.keys(data),
        dataValues: Object.values(data).slice(0, 3)
      });

      const zip = new AdmZip(templatePath);
      const zipEntries = zip.getEntries();

      // Нормализуем ключи данных
      const normalizedData: Record<string, string> = {};
      for (const [key, value] of Object.entries(data)) {
        const normalizedKey = this.normalizeAnchor(key);
        normalizedData[normalizedKey] = String(value);
        console.log(`[ContractFilling] Нормализация: "${key}" -> "${normalizedKey}" = "${value}"`);
      }

      // Заменяем якоря в document.xml
      for (const entry of zipEntries) {
        if (entry.entryName === 'word/document.xml') {
          let xmlContent = entry.getData().toString('utf-8');
          
          console.log('[ContractFilling] Исходный XML (первые 500 символов):', xmlContent.substring(0, 500));

          // Парсим XML для правильной обработки разбитых якорей
          try {
            const parsed = await parseStringAsync(xmlContent);
            
            // Извлекаем весь текст документа для поиска якорей
            const fullText = this.extractTextFromXmlNode(parsed);
            console.log('[ContractFilling] Извлеченный текст (первые 500 символов):', fullText.substring(0, 500));
            
            // Ищем все якоря в тексте
            const anchorMatches: Array<{ original: string; normalized: string; value: string; escapedValue: string }> = [];
            const patterns = [
              { fullPattern: /\{\{([^}]+)\}\}/g, name: 'double_braces' },
              { fullPattern: /\{([^}]+)\}/g, name: 'single_braces' }
            ];
            
            for (const { fullPattern } of patterns) {
              let match;
              // Сбрасываем lastIndex для повторного использования regex
              fullPattern.lastIndex = 0;
              while ((match = fullPattern.exec(fullText)) !== null) {
                const normalizedAnchor = this.normalizeAnchor(match[1]);
                if (normalizedData.hasOwnProperty(normalizedAnchor)) {
                  const value = normalizedData[normalizedAnchor];
                  // Экранируем значение для XML
                  const escapedValue = String(value)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&apos;');
                  
                  anchorMatches.push({
                    original: match[0],
                    normalized: normalizedAnchor,
                    value: value,
                    escapedValue: escapedValue
                  });
                  
                  console.log(`[ContractFilling] Найден якорь для замены: "${match[0]}" -> "${value}"`);
                } else {
                  console.log(`[ContractFilling] Якорь "${normalizedAnchor}" не найден в данных`);
                }
              }
            }
            
            console.log('[ContractFilling] Найдено якорей для замены:', anchorMatches.length);
            
            if (anchorMatches.length === 0) {
              console.warn('[ContractFilling] Не найдено якорей для замены. Проверьте данные:', {
                normalizedDataKeys: Object.keys(normalizedData),
                fullTextSample: fullText.substring(0, 200)
              });
            }
            
            // Функция для рекурсивного обхода и замены якорей в XML структуре
            // Этот подход правильно обрабатывает разбитые якоря
            const replaceInNode = (node: any, parentText: string = ''): { node: any; text: string } => {
              if (typeof node === 'string') {
                return { node, text: node };
              }
              
              if (Array.isArray(node)) {
                let combinedText = '';
                const processedNodes = node.map(n => {
                  const result = replaceInNode(n, parentText + combinedText);
                  combinedText += result.text;
                  return result.node;
                });
                return { node: processedNodes, text: combinedText };
              }
              
              if (node && typeof node === 'object') {
                const result: any = {};
                let nodeText = '';
                
                // Обрабатываем текстовые элементы w:t
                if (node['w:t']) {
                  const textContent = Array.isArray(node['w:t']) 
                    ? node['w:t'].map((t: any) => typeof t === 'string' ? t : (t._ || t || '')).join('')
                    : (typeof node['w:t'] === 'string' ? node['w:t'] : (node['w:t']._ || node['w:t'] || ''));
                  
                  nodeText = textContent;
                  
                  // Собираем контекст для поиска разбитых якорей
                  const contextText = parentText + textContent;
                  
                  // Ищем якоря в контексте
                  let modifiedText = textContent;
                  let hasReplacement = false;
                  
                  for (const match of anchorMatches) {
                    // Проверяем, содержится ли якорь в контексте
                    if (contextText.includes(match.original)) {
                      // Если якорь полностью в этом элементе, заменяем его
                      if (textContent.includes(match.original)) {
                        modifiedText = modifiedText.replace(match.original, match.escapedValue);
                        hasReplacement = true;
                        console.log(`[ContractFilling] Замена в элементе: "${match.original}" -> "${match.value}"`);
                      }
                    }
                  }
                  
                  // Если текст изменился, обновляем узел
                  if (hasReplacement) {
                    result['w:t'] = modifiedText;
                    // Копируем остальные свойства узла
                    for (const key in node) {
                      if (key !== 'w:t') {
                        const childResult = replaceInNode(node[key], parentText + modifiedText);
                        result[key] = childResult.node;
                        nodeText += childResult.text;
                      }
                    }
                    return { node: result, text: modifiedText };
                  } else {
                    result['w:t'] = textContent;
                    // Копируем остальные свойства узла
                    for (const key in node) {
                      if (key !== 'w:t') {
                        const childResult = replaceInNode(node[key], parentText + nodeText);
                        result[key] = childResult.node;
                        nodeText += childResult.text;
                      }
                    }
                    return { node: result, text: nodeText };
                  }
                }
                
                // Рекурсивно обрабатываем все дочерние элементы
                for (const key in node) {
                  const childResult = replaceInNode(node[key], parentText + nodeText);
                  result[key] = childResult.node;
                  nodeText += childResult.text;
                }
                
                return { node: result, text: nodeText };
              }
              
              return { node, text: '' };
            };
            
            // Применяем замену
            const modifiedResult = replaceInNode(parsed);
            
            // Конвертируем обратно в XML строку
            // Используем простой подход - заменяем в исходном XML строке
            // Это более надежно, чем пытаться сериализовать обратно в XML
            let replacementCount = 0;
            
            // Заменяем якоря в XML строке
            // Важно: якоря могут быть разбиты на несколько элементов w:t
            // Используем простой и надежный подход: заменяем якоря в тексте между тегами w:t
            
            // Сначала пробуем простую замену для целых якорей
            for (const match of anchorMatches) {
              const escapedAnchor = match.original.replace(/[{}[\]()*+?.\\^$|]/g, '\\$&');
              const simplePattern = new RegExp(escapedAnchor, 'g');
              
              if (xmlContent.includes(match.original)) {
                xmlContent = xmlContent.replace(simplePattern, match.escapedValue);
                replacementCount++;
                console.log(`[ContractFilling] Замена в XML: "${match.original}" -> "${match.value}"`);
              }
            }
            
            // Если остались не замененные якоря, они могут быть разбиты на несколько элементов w:t
            // Используем более простой подход: заменяем в каждом элементе w:t отдельно
            if (replacementCount < anchorMatches.length) {
              console.log(`[ContractFilling] Пытаемся заменить ${anchorMatches.length - replacementCount} оставшихся якорей`);
              
              // Заменяем якоря в каждом элементе w:t
              // Важно: используем глобальную переменную для отслеживания уже замененных якорей
              const replacedAnchors = new Set<string>();
              
              xmlContent = xmlContent.replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, (match, textContent) => {
                let modifiedText = textContent;
                let wasModified = false;
                
                for (const anchorMatch of anchorMatches) {
                  // Проверяем, что якорь еще не был заменен и содержится в этом элементе
                  if (textContent.includes(anchorMatch.original) && !replacedAnchors.has(anchorMatch.original)) {
                    modifiedText = modifiedText.replace(new RegExp(anchorMatch.original.replace(/[{}[\]()*+?.\\^$|]/g, '\\$&'), 'g'), anchorMatch.escapedValue);
                    wasModified = true;
                    replacedAnchors.add(anchorMatch.original);
                    replacementCount++;
                    console.log(`[ContractFilling] Замена в элементе w:t: "${anchorMatch.original}" -> "${anchorMatch.value}"`);
                  }
                }
                
                if (wasModified) {
                  return match.replace(textContent, modifiedText);
                }
                return match;
              });
              
              // Проверяем, что все якоря были заменены
              const remainingAnchors = anchorMatches.filter(m => !replacedAnchors.has(m.original));
              if (remainingAnchors.length > 0) {
                console.warn(`[ContractFilling] Не удалось заменить ${remainingAnchors.length} якорей:`, remainingAnchors.map(m => m.original));
              }
              
              // Если все еще остались не замененные якоря, пробуем найти их разбитыми
              // Собираем текст из нескольких соседних элементов w:t
              const textOnly = xmlContent.replace(/<[^>]+>/g, '');
              const stillMissing = anchorMatches.filter(m => !replacedAnchors.has(m.original));
              
              for (const match of stillMissing) {
                if (textOnly.includes(match.original)) {
                  console.warn(`[ContractFilling] Якорь "${match.original}" найден в тексте, но не может быть заменен (возможно, разбит на несколько элементов)`);
                  
                  // Пробуем более агрессивную замену - ищем якорь даже если он разбит тегами
                  // Создаем паттерн, который находит якорь даже если он разбит
                  const anchorChars = match.original.split('');
                  const flexiblePatternParts: string[] = [];
                  
                  for (let i = 0; i < anchorChars.length; i++) {
                    const char = anchorChars[i];
                    const escapedChar = char.replace(/[{}[\]()*+?.\\^$|]/g, '\\$&');
                    
                    if (i === 0) {
                      flexiblePatternParts.push(escapedChar);
                    } else {
                      // Между символами могут быть XML теги
                      flexiblePatternParts.push(`(?:<[^>]*>)*${escapedChar}`);
                    }
                  }
                  
                  const flexiblePattern = new RegExp(flexiblePatternParts.join(''), 'g');
                  
                  // Пробуем заменить разбитый якорь
                  let foundBroken = false;
                  xmlContent = xmlContent.replace(flexiblePattern, (matched) => {
                    const matchedText = matched.replace(/<[^>]+>/g, '');
                    if (matchedText === match.original && !replacedAnchors.has(match.original)) {
                      foundBroken = true;
                      replacedAnchors.add(match.original);
              replacementCount++;
                      console.log(`[ContractFilling] Замена разбитого якоря: "${match.original}" -> "${match.value}"`);
                      // Заменяем на значение, вставляя его в первый элемент w:t
                      return match.escapedValue;
                    }
                    return matched;
                  });
                  
                  if (!foundBroken) {
                    console.warn(`[ContractFilling] Не удалось заменить разбитый якорь "${match.original}"`);
                  }
                }
              }
            }
            
            console.log(`[ContractFilling] Всего заменено якорей: ${replacementCount}`);
            
            // Проверяем, что изменения действительно применены
            const finalTextCheck = xmlContent.replace(/<[^>]+>/g, '');
            const remainingAnchorsInText = anchorMatches.filter(m => finalTextCheck.includes(m.original));
            if (remainingAnchorsInText.length > 0) {
              console.warn(`[ContractFilling] ВНИМАНИЕ: ${remainingAnchorsInText.length} якорей все еще присутствуют в XML после замены:`, remainingAnchorsInText.map(m => m.original));
            } else {
              console.log('[ContractFilling] Все якоря успешно заменены в XML');
            }
            
          } catch (parseError: any) {
            console.warn('[ContractFilling] Не удалось распарсить XML, используем простую замену:', parseError.message);
            
            // Fallback: простая замена в XML строке
            let replacementCount = 0;
            const patterns = [
              { fullPattern: /\{\{([^}]+)\}\}/g, name: 'double_braces' },
              { fullPattern: /\{([^}]+)\}/g, name: 'single_braces' }
            ];

            for (const { fullPattern, name } of patterns) {
              xmlContent = xmlContent.replace(fullPattern, (match: string, anchorName: string) => {
                const normalizedAnchor = this.normalizeAnchor(anchorName);
                
                if (normalizedData.hasOwnProperty(normalizedAnchor)) {
                  const value = normalizedData[normalizedAnchor];
                  const escapedValue = String(value)
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&apos;');
                  
                  console.log(`[ContractFilling] Замена: "${match}" -> "${value}"`);
                  replacementCount++;
                  return escapedValue;
                }
                
                return match;
              });
            }
            
            console.log(`[ContractFilling] Всего заменено якорей (fallback): ${replacementCount}`);
          }

          // Обновляем содержимое в ZIP
          console.log('[ContractFilling] Обновляем document.xml в ZIP архиве');
          zip.updateFile(entry.entryName, Buffer.from(xmlContent, 'utf-8'));
          
          // Проверяем, что файл действительно обновлен
          const updatedEntry = zip.getEntry(entry.entryName);
          if (updatedEntry) {
            const updatedContent = updatedEntry.getData().toString('utf-8');
            const sampleText = updatedContent.replace(/<[^>]+>/g, '').substring(0, 200);
            console.log('[ContractFilling] Проверка обновленного XML (первые 200 символов текста):', sampleText);
          }
        }
      }

      // Сохраняем измененный файл
      console.log('[ContractFilling] Сохраняем файл:', outputPath);
      zip.writeZip(outputPath);
      
      // Проверяем сохраненный файл
      if (fs.existsSync(outputPath)) {
        const savedZip = new AdmZip(outputPath);
        const savedEntry = savedZip.getEntry('word/document.xml');
        if (savedEntry) {
          const savedContent = savedEntry.getData().toString('utf-8');
          const savedText = savedContent.replace(/<[^>]+>/g, '').substring(0, 200);
          console.log('[ContractFilling] Проверка сохраненного файла (первые 200 символов текста):', savedText);
        }
      }
      
      // Проверяем, что файл создан
      if (!fs.existsSync(outputPath)) {
        throw new Error('Файл не был создан после записи');
      }
      
      const stats = fs.statSync(outputPath);
      console.log('[ContractFilling] Файл создан успешно, размер:', stats.size, 'байт');
    } catch (error: any) {
      console.error('[ContractFilling] Ошибка в replaceAnchorsInDoc:', {
        message: error.message,
        stack: error.stack,
        name: error.name
      });
      throw new AppError(`Ошибка при заполнении договора: ${error.message}`, 500);
    }
  }
}

