import { useState, useEffect } from 'react'
import { FileText, Upload, Download, Save, X, Trash2, Edit2 } from 'lucide-react'

interface Template {
  filename: string
  anchors: string[]
  created_at: string
  id?: string // Уникальный идентификатор для React key
}

interface Contragent {
  filename: string
  name: string
  data: Record<string, string>
  created_at: string
  updated_at: string
}

export default function ContractFilling() {
  const [step, setStep] = useState<'upload' | 'fill'>('upload')
  const [uploadedFilename, setUploadedFilename] = useState('')
  const [anchors, setAnchors] = useState<string[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [contragents, setContragents] = useState<Contragent[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [filledFilename, setFilledFilename] = useState('')
  const [showSaveContragentModal, setShowSaveContragentModal] = useState(false)
  const [contragentName, setContragentName] = useState('')
  const [showRenameTemplateModal, setShowRenameTemplateModal] = useState(false)
  const [templateToRename, setTemplateToRename] = useState('')
  const [newTemplateName, setNewTemplateName] = useState('')

  // URL для API
  const API_URL = '/api/contract-filling'

  useEffect(() => {
    loadTemplates()
    loadContragents()
  }, [])

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token')
    return {
      'Authorization': token ? `Bearer ${token}` : '',
    }
  }

  const loadTemplates = async () => {
    try {
      const response = await fetch(`${API_URL}/templates`, {
        headers: getAuthHeaders()
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Ошибка при загрузке шаблонов' }))
        const errorMessage = typeof errorData.error === 'object'
          ? errorData.error?.message || errorData.error?.code || 'Ошибка при загрузке шаблонов'
          : errorData.error || 'Ошибка при загрузке шаблонов'
        showMessage('error', errorMessage)
        setTemplates([])
        return
      }

      const data = await response.json()
      // Добавляем уникальный ID для каждого шаблона
      const templatesWithId = (data.templates || []).map((template: Template, index: number) => ({
        ...template,
        id: template.filename + '_' + index + '_' + (template.created_at || Date.now())
      }))
      setTemplates(templatesWithId)
    } catch (error: any) {
      console.error('Ошибка загрузки шаблонов:', error)
      const errorMessage = error?.message || 'Ошибка при загрузке шаблонов'
      showMessage('error', errorMessage)
      setTemplates([])
    }
  }

  const loadContragents = async () => {
    try {
      const response = await fetch(`${API_URL}/contragents`, {
        headers: getAuthHeaders()
      })
      const data = await response.json()
      setContragents(data.contragents || [])
    } catch (error) {
      console.error('Ошибка загрузки контрагентов:', error)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return

    if (!selectedFile.name.match(/\.(doc|docx)$/i)) {
      showMessage('error', 'Неподдерживаемый формат файла. Используйте .doc или .docx')
      return
    }

    setLoading(true)

    const formData = new FormData()
    formData.append('file', selectedFile)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setUploadedFilename(data.filename)
        setAnchors(data.anchors || [])
        showMessage('success', data.message || 'Документ загружен успешно')
        // Не загружаем шаблоны сразу, так как шаблон еще не сохранен
      } else {
        showMessage('error', data.error || 'Ошибка при загрузке файла')
      }
    } catch (error: any) {
      showMessage('error', `Ошибка: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const saveTemplate = async () => {
    if (!uploadedFilename || anchors.length === 0) {
      showMessage('error', 'Сначала загрузите документ с якорями')
      return
    }

    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/save-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          filename: uploadedFilename,
          anchors: anchors,
        }),
      })

      const data = await response.json()

      if (data.success) {
        showMessage('success', 'Шаблон успешно сохранен!')
        // Очищаем загруженный файл и якоря после сохранения
        setUploadedFilename('')
        setAnchors([])
        // Загружаем обновленный список шаблонов
        loadTemplates()
      } else {
        showMessage('error', data.error || 'Ошибка при сохранении шаблона')
      }
    } catch (error: any) {
      showMessage('error', `Ошибка: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleTemplateSelect = (templateName: string) => {
    setSelectedTemplate(templateName)
    const template = templates.find(t => t.filename === templateName)
    if (template) {
      const initialData: Record<string, string> = {}
      template.anchors.forEach(anchor => {
        initialData[anchor] = ''
      })
      setFormData(initialData)
      setStep('fill')
    }
  }

  const loadContragentData = async (contragent: Contragent) => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/contragent/${contragent.filename}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      })
      const data = await response.json()
      
      if (data.data) {
        setFormData({ ...formData, ...data.data })
        showMessage('success', `Данные контрагента "${data.name}" загружены`)
      }
    } catch (error: any) {
      showMessage('error', `Ошибка при загрузке данных: ${error.message}`)
    }
  }

  const saveContragent = async (name: string) => {
    if (!name || !name.trim()) {
      showMessage('error', 'Введите имя контрагента')
      return
    }

    if (!formData || Object.keys(formData).length === 0) {
      showMessage('error', 'Нет данных для сохранения')
      return
    }

    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/save-contragent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          name: name.trim(),
          data: formData,
        }),
      })

      const data = await response.json()

      if (data.success) {
        showMessage('success', data.message || 'Контрагент сохранен')
        loadContragents()
      } else {
        showMessage('error', data.error || 'Ошибка при сохранении контрагента')
      }
    } catch (error: any) {
      showMessage('error', `Ошибка: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const deleteContragent = async (filename: string, name: string) => {
    if (!confirm(`Удалить контрагента "${name}"?`)) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/contragent/${filename}`, {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      })

      const data = await response.json()

      if (data.success) {
        showMessage('success', 'Контрагент удален')
        loadContragents()
      } else {
        showMessage('error', data.error || 'Ошибка при удалении контрагента')
      }
    } catch (error: any) {
      showMessage('error', `Ошибка: ${error.message}`)
    }
  }

  const deleteTemplate = async (filename: string) => {
    if (!confirm(`Удалить шаблон "${filename}"?`)) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/template/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      })

      const data = await response.json()

      if (data.success) {
        showMessage('success', 'Шаблон удален')
        loadTemplates()
        // Если удаленный шаблон был выбран, сбрасываем выбор
        if (selectedTemplate === filename) {
          setSelectedTemplate('')
          setFormData({})
          setStep('upload')
        }
      } else {
        showMessage('error', data.error || 'Ошибка при удалении шаблона')
      }
    } catch (error: any) {
      showMessage('error', `Ошибка: ${error.message}`)
    }
  }

  const openRenameTemplateModal = (filename: string) => {
    setTemplateToRename(filename)
    setNewTemplateName(filename)
    setShowRenameTemplateModal(true)
  }

  const renameTemplate = async () => {
    if (!newTemplateName.trim() || !newTemplateName.match(/\.(doc|docx)$/i)) {
      showMessage('error', 'Введите корректное имя файла с расширением .doc или .docx')
      return
    }

    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/template/${encodeURIComponent(templateToRename)}/rename`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          newFilename: newTemplateName.trim()
        }),
      })

      const data = await response.json()

      if (data.success) {
        showMessage('success', 'Шаблон переименован')
        loadTemplates()
        setShowRenameTemplateModal(false)
        // Если переименованный шаблон был выбран, обновляем выбор
        if (selectedTemplate === templateToRename) {
          setSelectedTemplate(data.filename)
        }
      } else {
        showMessage('error', data.error || 'Ошибка при переименовании шаблона')
      }
    } catch (error: any) {
      showMessage('error', `Ошибка: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const fillContract = async () => {
    if (!selectedTemplate) {
      showMessage('error', 'Выберите шаблон')
      return
    }

    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/fill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          template_filename: selectedTemplate,
          data: formData,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Ошибка при заполнении договора' }))
        const errorMessage = typeof errorData.error === 'object' 
          ? errorData.error?.message || errorData.error?.code || 'Ошибка при заполнении договора'
          : errorData.error || 'Ошибка при заполнении договора'
        showMessage('error', errorMessage)
        return
      }

      const data = await response.json()

      if (data.success) {
        setFilledFilename(data.filename)
        showMessage('success', data.message || 'Договор успешно заполнен')
      } else {
        const errorMessage = typeof data.error === 'object'
          ? data.error?.message || data.error?.code || 'Ошибка при заполнении договора'
          : data.error || 'Ошибка при заполнении договора'
        showMessage('error', errorMessage)
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || 'Неизвестная ошибка'
      showMessage('error', `Ошибка: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const downloadFile = async () => {
    if (!filledFilename) {
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/download/${encodeURIComponent(filledFilename)}`, {
        method: 'GET',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Ошибка при скачивании файла' }))
        showMessage('error', errorData.error || 'Ошибка при скачивании файла')
        return
      }

      // Получаем blob из ответа
      const blob = await response.blob()
      
      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filledFilename
      document.body.appendChild(a)
      a.click()
      
      // Очищаем
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      showMessage('success', 'Файл успешно скачан')
    } catch (error: any) {
      showMessage('error', `Ошибка при скачивании: ${error.message}`)
    }
  }

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text })
    setTimeout(() => setMessage(null), 5000)
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="w-8 h-8" />
          Заполнение договоров
        </h1>
        <p className="text-gray-600 mt-2">
          Загрузите договор, расставьте якоря и заполните данными контрагентов
        </p>
      </div>

      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Шаг 1: Загрузка документа */}
      {step === 'upload' && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Шаг 1: Загрузите договор
          </h2>

          <div className="border-2 border-dashed border-primary-300 rounded-lg p-8 text-center hover:border-primary-500 transition-colors">
            <input
              type="file"
              id="fileInput"
              accept=".doc,.docx"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label
              htmlFor="fileInput"
              className="cursor-pointer flex flex-col items-center gap-2"
            >
              <Upload className="w-12 h-12 text-primary-500" />
              <p className="text-lg font-medium text-gray-700">
                Перетащите файл сюда или нажмите для выбора
              </p>
              <p className="text-sm text-gray-500">Поддерживаются форматы: .doc, .docx</p>
            </label>
          </div>

          {loading && (
            <div className="mt-4 text-center text-gray-600">Загрузка файла...</div>
          )}

          {anchors.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Найденные якоря в документе:</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {anchors.map((anchor, index) => (
                  <div
                    key={index}
                    className="bg-primary-50 border border-primary-200 rounded-lg p-3 text-center font-semibold text-primary-700"
                  >
                    {`{{${anchor}}}`}
                  </div>
                ))}
              </div>
              <button
                onClick={saveTemplate}
                disabled={loading}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4 inline mr-2" />
                Сохранить шаблон
              </button>
            </div>
          )}
        </div>
      )}

      {/* Шаг 2: Заполнение данных */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Шаг 2: Заполните данные контрагентов
        </h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Выберите шаблон:
          </label>
          {templates.length > 0 ? (
            <div className="space-y-2">
              {templates.map((template) => (
                <div
                  key={template.id || template.filename || `template-${templates.indexOf(template)}`}
                  className="flex items-center gap-2 p-3 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <input
                    type="radio"
                    id={`template-${template.filename}`}
                    name="template"
                    value={template.filename}
                    checked={selectedTemplate === template.filename}
                    onChange={(e) => handleTemplateSelect(e.target.value)}
                    className="w-4 h-4 text-primary-600"
                  />
                  <label
                    htmlFor={`template-${template.filename}`}
                    className="flex-1 cursor-pointer"
                  >
                    <div className="font-medium text-gray-800">{template.filename}</div>
                    <div className="text-sm text-gray-500">
                      {template.anchors.length} якорей
                    </div>
                  </label>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        openRenameTemplateModal(template.filename)
                      }}
                      className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                      title="Переименовать"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteTemplate(template.filename)
                      }}
                      className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
                      title="Удалить"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center text-gray-500">
              Нет сохраненных шаблонов. Загрузите и сохраните шаблон на шаге 1.
            </div>
          )}
          <button
            onClick={loadTemplates}
            className="mt-2 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
          >
            Обновить список
          </button>
        </div>

        {/* Сохраненные контрагенты */}
        {contragents.length > 0 && (
          <div className="mb-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Сохраненные контрагенты:</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {contragents.map((contragent) => (
                <div
                  key={contragent.filename}
                  className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-primary-500 hover:shadow-md transition-all relative"
                  onClick={() => loadContragentData(contragent)}
                >
                  <div className="font-semibold text-gray-800">{contragent.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(contragent.updated_at).toLocaleDateString('ru-RU')}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteContragent(contragent.filename, contragent.name)
                    }}
                    className="absolute top-2 right-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={loadContragents}
              className="mt-3 px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Обновить список
            </button>
          </div>
        )}

        {/* Форма заполнения */}
        {step === 'fill' && selectedTemplate && (
          <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {Object.keys(formData).map((key) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:
                  </label>
                  <input
                    type="text"
                    value={formData[key]}
                    onChange={(e) =>
                      setFormData({ ...formData, [key]: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder={`Введите значение для ${key}`}
                  />
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={fillContract}
                disabled={loading}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                Заполнить договор
              </button>

              {filledFilename && (
                <>
                  <button
                    onClick={downloadFile}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Скачать договор
                  </button>
                  <button
                    onClick={() => {
                      setContragentName('')
                      setShowSaveContragentModal(true)
                    }}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Сохранить как контрагента
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Модальное окно для сохранения контрагента */}
      {showSaveContragentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Сохранить контрагента</h3>
              <button
                onClick={() => setShowSaveContragentModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Имя контрагента:
              </label>
              <input
                type="text"
                value={contragentName}
                onChange={(e) => setContragentName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Например: ООО Рога и Копыта"
              />
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowSaveContragentModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Отмена
              </button>
              <button
                onClick={async () => {
                  await saveContragent(contragentName)
                  setShowSaveContragentModal(false)
                }}
                disabled={!contragentName.trim() || loading}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для переименования шаблона */}
      {showRenameTemplateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Переименовать шаблон</h3>
              <button
                onClick={() => setShowRenameTemplateModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Новое имя файла:
              </label>
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="например: договор.docx"
              />
              <p className="mt-2 text-xs text-gray-500">
                Имя должно заканчиваться на .doc или .docx
              </p>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRenameTemplateModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Отмена
              </button>
              <button
                onClick={renameTemplate}
                disabled={!newTemplateName.trim() || loading}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                Переименовать
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

