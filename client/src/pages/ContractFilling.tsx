import { useState, useEffect } from 'react'
import { FileText, Upload, Download, Save } from 'lucide-react'

interface Template {
  filename: string
  anchors: string[]
  created_at: string
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

  // URL для API
  const API_URL = '/api/contract-filling'

  useEffect(() => {
    loadTemplates()
    loadContragents()
  }, [])

  const loadTemplates = async () => {
    try {
      const response = await fetch(`${API_URL}/templates`)
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error) {
      console.error('Ошибка загрузки шаблонов:', error)
    }
  }

  const loadContragents = async () => {
    try {
      const response = await fetch(`${API_URL}/contragents`)
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
      const response = await fetch(`${API_URL}/upload`, {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (data.success) {
        setUploadedFilename(data.filename)
        setAnchors(data.anchors || [])
        showMessage('success', data.message || 'Документ загружен успешно')
        loadTemplates()
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
      const response = await fetch(`${API_URL}/save-template`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filename: uploadedFilename,
          anchors: anchors,
        }),
      })

      const data = await response.json()

      if (data.success) {
        showMessage('success', 'Шаблон успешно сохранен!')
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

  const loadContragentData = (contragent: Contragent) => {
    if (contragent.data) {
      setFormData({ ...formData, ...contragent.data })
      showMessage('success', `Данные контрагента "${contragent.name}" загружены`)
    }
  }

  const fillContract = async () => {
    if (!selectedTemplate) {
      showMessage('error', 'Выберите шаблон')
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/fill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          template_filename: selectedTemplate,
          data: formData,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setFilledFilename(data.filename)
        showMessage('success', data.message || 'Договор успешно заполнен')
      } else {
        showMessage('error', data.error || 'Ошибка при заполнении договора')
      }
    } catch (error: any) {
      showMessage('error', `Ошибка: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const downloadFile = () => {
    if (filledFilename) {
      window.open(`${API_URL}/download/${filledFilename}`, '_blank')
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
          <select
            value={selectedTemplate}
            onChange={(e) => handleTemplateSelect(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">-- Выберите шаблон --</option>
            {templates.map((template) => (
              <option key={template.filename} value={template.filename}>
                {template.filename} ({template.anchors.length} якорей)
              </option>
            ))}
          </select>
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
                  className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-primary-500 hover:shadow-md transition-all"
                  onClick={() => loadContragentData(contragent)}
                >
                  <div className="font-semibold text-gray-800">{contragent.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {new Date(contragent.updated_at).toLocaleDateString('ru-RU')}
                  </div>
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
                <button
                  onClick={downloadFile}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Скачать договор
                </button>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

