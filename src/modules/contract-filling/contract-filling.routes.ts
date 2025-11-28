import { Router } from 'express';
import multer from 'multer';
import { ContractFillingController } from './contract-filling.controller';
import { authenticate, authorize } from '../../middleware/auth';
import { UserRole } from '../../types';

const router = Router();
const controller = new ContractFillingController();

// Настройка multer для загрузки файлов
const storage = multer.memoryStorage(); // Храним файлы в памяти
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 16 * 1024 * 1024, // 16MB
  },
  fileFilter: (req, file, cb) => {
    // Разрешаем только DOC и DOCX файлы
    if (file.mimetype === 'application/msword' || 
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.originalname.match(/\.(doc|docx)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Неподдерживаемый формат файла. Используйте .doc или .docx'));
    }
  }
});

// Все маршруты требуют аутентификации и роль CLUB_OWNER
router.use(authenticate);
router.use(authorize(UserRole.CLUB_OWNER));

// Загрузка документа
router.post('/upload', upload.single('file'), controller.upload.bind(controller));

// Сохранение шаблона
router.post('/save-template', controller.saveTemplate.bind(controller));

// Список шаблонов
router.get('/templates', controller.getTemplates.bind(controller));

// Удаление шаблона
router.delete('/template/:filename', controller.deleteTemplate.bind(controller));

// Переименование шаблона
router.put('/template/:filename/rename', controller.renameTemplate.bind(controller));

// Заполнение договора
router.post('/fill', controller.fillContract.bind(controller));

// Скачивание файла
router.get('/download/:filename', controller.download.bind(controller));

// Список контрагентов
router.get('/contragents', controller.getContragents.bind(controller));

// Сохранение контрагента
router.post('/save-contragent', controller.saveContragent.bind(controller));

// Получение контрагента
router.get('/contragent/:filename', controller.getContragent.bind(controller));

// Удаление контрагента
router.delete('/contragent/:filename', controller.deleteContragent.bind(controller));

export default router;

