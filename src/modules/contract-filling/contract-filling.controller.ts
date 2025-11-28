import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import { AppError } from '../../middleware/errorHandler';
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
      const filepath = path.join(UPLOAD_FOLDER, filename);

      // Сохраняем файл
      fs.writeFileSync(filepath, file.buffer);

      // Извлекаем якоря из документа
      const anchors = await this.extractAnchorsFromDoc(filepath);

      res.json({
        success: true,
        filename: filename,
        anchors: anchors,
        message: `Документ загружен. Найдено якорей: ${anchors.length}`
      });
    } catch (error: any) {
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
      const templatePath = path.join(TEMPLATES_FOLDER, filename);

      if (!fs.existsSync(sourcePath)) {
        throw new AppError('Файл не найден', 404);
      }

      // Копируем файл в папку шаблонов
      fs.copyFileSync(sourcePath, templatePath);

      // Сохраняем метаданные
      const metadata = {
        filename: filename,
        anchors: anchors || [],
        created_at: new Date().toISOString()
      };
      const metadataPath = path.join(TEMPLATES_FOLDER, filename + '.json');
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

      res.json({
        success: true,
        message: 'Шаблон сохранен'
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
        res.json({ templates: [] });
        return;
      }

      const files = fs.readdirSync(TEMPLATES_FOLDER);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const metadataPath = path.join(TEMPLATES_FOLDER, file);
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
          templates.push(metadata);
        }
      }

      res.json({ templates });
    } catch (error: any) {
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

      if (!template_filename) {
        throw new AppError('Имя шаблона не указано', 400);
      }

      const templatePath = path.join(TEMPLATES_FOLDER, template_filename);
      if (!fs.existsSync(templatePath)) {
        throw new AppError('Шаблон не найден', 404);
      }

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

      // Генерируем имя выходного файла
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const outputFilename = `filled_${timestamp}_${template_filename}`;
      const outputPath = path.join(OUTPUT_FOLDER, outputFilename);

      // Заполняем договор
      await this.replaceAnchorsInDoc(templatePath, filteredData, outputPath);

      res.json({
        success: true,
        filename: outputFilename,
        message: `Договор успешно заполнен. Заменено якорей: ${Object.keys(filteredData).length}`,
        replaced_anchors: Object.keys(filteredData)
      });
    } catch (error: any) {
      next(new AppError(error.message || 'Ошибка при заполнении договора', 500));
    }
  }

  // Скачивание файла
  async download(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filename } = req.params;
      const filepath = path.join(OUTPUT_FOLDER, filename);

      if (!fs.existsSync(filepath)) {
        throw new AppError('Файл не найден', 404);
      }

      const downloadResult = res.download(filepath, filename, (err) => {
        if (err && !res.headersSent) {
          next(new AppError('Ошибка при скачивании файла', 500));
        }
      });
      
      // Подавляем предупреждение TypeScript о возвращаемом значении
      void downloadResult;
    } catch (error: any) {
      next(new AppError(error.message || 'Ошибка при скачивании файла', 500));
    }
  }

  // Список контрагентов
  async getContragents(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const contragents: any[] = [];

      if (!fs.existsSync(CONTRAGENTS_FOLDER)) {
        res.json({ contragents: [] });
        return;
      }

      const files = fs.readdirSync(CONTRAGENTS_FOLDER);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const filepath = path.join(CONTRAGENTS_FOLDER, file);
          const contragent = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
          contragent.filename = file;
          contragents.push(contragent);
        }
      }

      // Сортируем по дате обновления
      contragents.sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
        return dateB - dateA;
      });

      res.json({ contragents });
    } catch (error: any) {
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

      // Создаем безопасное имя файла
      const safeName = name.replace(/[^\w\-а-яА-ЯёЁ\s]/gi, '').replace(/\s+/g, '_');
      if (!safeName) {
        throw new AppError('Некорректное имя контрагента', 400);
      }

      const contragentInfo = {
        name: name.trim(),
        data: data,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const filepath = path.join(CONTRAGENTS_FOLDER, `${safeName}.json`);
      fs.writeFileSync(filepath, JSON.stringify(contragentInfo, null, 2), 'utf-8');

      res.json({
        success: true,
        message: `Контрагент "${name}" сохранен`,
        filename: `${safeName}.json`
      });
    } catch (error: any) {
      next(new AppError(error.message || 'Ошибка при сохранении контрагента', 500));
    }
  }

  // Получение контрагента
  async getContragent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filename } = req.params;
      const filepath = path.join(CONTRAGENTS_FOLDER, filename);

      if (!fs.existsSync(filepath)) {
        throw new AppError('Контрагент не найден', 404);
      }

      const contragent = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
      res.json(contragent);
    } catch (error: any) {
      next(new AppError(error.message || 'Ошибка при загрузке контрагента', 500));
    }
  }

  // Удаление контрагента
  async deleteContragent(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { filename } = req.params;
      const filepath = path.join(CONTRAGENTS_FOLDER, filename);

      if (!fs.existsSync(filepath)) {
        throw new AppError('Контрагент не найден', 404);
      }

      fs.unlinkSync(filepath);

      res.json({
        success: true,
        message: 'Контрагент удален'
      });
    } catch (error: any) {
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
      const zip = new AdmZip(templatePath);
      const zipEntries = zip.getEntries();

      // Нормализуем ключи данных
      const normalizedData: Record<string, string> = {};
      for (const [key, value] of Object.entries(data)) {
        const normalizedKey = this.normalizeAnchor(key);
        normalizedData[normalizedKey] = String(value);
      }

      // Заменяем якоря в document.xml
      for (const entry of zipEntries) {
        if (entry.entryName === 'word/document.xml') {
          let xmlContent = entry.getData().toString('utf-8');

          // Сначала пытаемся распарсить XML для более точной замены
          try {
            const parsed = await parseStringAsync(xmlContent);
            
            // Функция для рекурсивной замены якорей в XML структуре
            const replaceInNode = (node: any): any => {
              if (typeof node === 'string') {
                // Заменяем якоря в текстовых узлах
                let text = node;
                const patterns = [
                  { fullPattern: /\{\{([^}]+)\}\}/g },
                  { fullPattern: /\{([^}]+)\}/g }
                ];

                for (const { fullPattern } of patterns) {
                  text = text.replace(fullPattern, (match: string, anchorName: string) => {
                    const normalizedAnchor = this.normalizeAnchor(anchorName);
                    
                    // Ищем значение в нормализованных данных
                    for (const [key, value] of Object.entries(normalizedData)) {
                      if (key === normalizedAnchor) {
                        return value;
                      }
                    }

                    // Если не нашли, возвращаем оригинал
                    return match;
                  });
                }
                return text;
              }
              
              if (Array.isArray(node)) {
                return node.map(n => replaceInNode(n));
              }
              
              if (node && typeof node === 'object') {
                const result: any = {};
                for (const [key, value] of Object.entries(node)) {
                  result[key] = replaceInNode(value);
                }
                return result;
              }
              
              return node;
            };

            const replaced = replaceInNode(parsed);
            
            // Конвертируем обратно в XML (упрощенный способ)
            // Для более точной конвертации можно использовать xml2js.Builder
            // Но для простоты используем строковую замену
            xmlContent = xmlContent.replace(/\{\{([^}]+)\}\}/g, (match: string, anchorName: string) => {
              const normalizedAnchor = this.normalizeAnchor(anchorName);
              for (const [key, value] of Object.entries(normalizedData)) {
                if (key === normalizedAnchor) {
                  return value;
                }
              }
              return match;
            });
            
            xmlContent = xmlContent.replace(/\{([^}]+)\}/g, (match: string, anchorName: string) => {
              const normalizedAnchor = this.normalizeAnchor(anchorName);
              for (const [key, value] of Object.entries(normalizedData)) {
                if (key === normalizedAnchor) {
                  return value;
                }
              }
              return match;
            });
          } catch (parseError) {
            // Если не удалось распарсить, используем простую строковую замену
            console.warn('[ContractFilling] Не удалось распарсить XML для замены, используем простую замену');
            
            const patterns = [
              { fullPattern: /\{\{([^}]+)\}\}/g },
              { fullPattern: /\{([^}]+)\}/g }
            ];

            for (const { fullPattern } of patterns) {
              xmlContent = xmlContent.replace(fullPattern, (match: string, anchorName: string) => {
                const normalizedAnchor = this.normalizeAnchor(anchorName);
                
                // Ищем значение в нормализованных данных
                for (const [key, value] of Object.entries(normalizedData)) {
                  if (key === normalizedAnchor) {
                    // Заменяем якорь на значение, сохраняя XML структуру вокруг
                    return value;
                  }
                }

                // Если не нашли, возвращаем оригинал
                return match;
              });
            }
          }

          // Обновляем содержимое в ZIP
          zip.updateFile(entry.entryName, Buffer.from(xmlContent, 'utf-8'));
        }
      }

      // Сохраняем измененный файл
      zip.writeZip(outputPath);
    } catch (error: any) {
      throw new AppError(`Ошибка при заполнении договора: ${error.message}`, 500);
    }
  }
}

