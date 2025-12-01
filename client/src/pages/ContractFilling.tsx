import { useState, useEffect } from 'react'
import { FileText, Upload, Download, Save, X } from 'lucide-react'

interface Contragent {
  filename: string
  name: string
  data: Record<string, string>
  created_at: string
  updated_at: string
}

export default function ContractFilling() {
  const [step, setStep] = useState<'upload' | 'fill' | 'result'>('upload')
  const [uploadedFilename, setUploadedFilename] = useState('')
  const [anchors, setAnchors] = useState<string[]>([])
  const [formData, setFormData] = useState<Record<string, string>>({})
  const [contragents, setContragents] = useState<Contragent[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [filledFilename, setFilledFilename] = useState('')
  const [showSaveContragentModal, setShowSaveContragentModal] = useState(false)
  const [contragentName, setContragentName] = useState('')

  // URL для API
  const API_URL = '/api/contract-filling'

  useEffect(() => {
    loadContragents()
  }, [])

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token')
    return {
      'Authorization': token ? `Bearer ${token}` : '',
    }
  }

  const loadContragents = async () => {
    try {
      console.log('[ContractFilling] Загрузка контрагентов...')
      const response = await fetch(`${API_URL}/contragents`, {
        headers: getAuthHeaders()
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('[ContractFilling] Получены контрагенты:', data)
      console.log('[ContractFilling] Количество контрагентов:', data.contragents?.length || 0)
      
      const loadedContragents = data.contragents || []
      setContragents(loadedContragents)
      
      if (loadedContragents.length === 0) {
        console.log('[ContractFilling] Контрагенты не найдены')
      }
    } catch (error) {
      console.error('Ошибка загрузки контрагентов:', error)
      showMessage('error', `Ошибка загрузки контрагентов: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`)
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

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Ошибка при загрузке файла' }))
        const errorMessage = typeof errorData.error === 'object'
          ? errorData.error?.message || errorData.error?.code || 'Ошибка при загрузке файла'
          : errorData.error || 'Ошибка при загрузке файла'
        showMessage('error', errorMessage)
        return
      }

      const data = await response.json()

      if (data.success) {
        setUploadedFilename(data.filename)
        const foundAnchors = data.anchors || []
        setAnchors(foundAnchors)
        
        // Автоматически переходим к заполнению данных
        const initialData: Record<string, string> = {}
        foundAnchors.forEach((anchor: string) => {
          initialData[anchor] = ''
        })
        setFormData(initialData)
        setStep('fill')
        
        showMessage('success', `Документ загружен. Найдено якорей: ${foundAnchors.length}`)
      } else {
        showMessage('error', data.error || 'Ошибка при загрузке файла')
      }
    } catch (error: any) {
      showMessage('error', `Ошибка: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const loadContragentData = async (contragent: Contragent) => {
    try {
      console.log('[ContractFilling] Загрузка данных контрагента:', contragent)
      const token = localStorage.getItem('token')
      const response = await fetch(`${API_URL}/contragent/${contragent.filename}`, {
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('[ContractFilling] Получены данные контрагента:', data)
      
      if (data.data) {
        // Если форма еще не инициализирована (нет якорей), инициализируем её
        if (anchors.length === 0 && Object.keys(formData).length === 0) {
          console.log('[ContractFilling] Форма не инициализирована, инициализируем с данными контрагента')
          const initialData: Record<string, string> = {}
          Object.keys(data.data).forEach(key => {
            initialData[key] = data.data[key] || ''
          })
          setFormData(initialData)
        } else {
          // Обновляем данные, добавляя новые поля если их нет
          const updatedData = { ...formData }
          Object.keys(data.data).forEach(key => {
            updatedData[key] = data.data[key] || ''
          })
          setFormData(updatedData)
        }
        
        console.log('[ContractFilling] Данные контрагента загружены в форму')
        showMessage('success', `Данные контрагента "${data.name || contragent.name}" загружены`)
      } else {
        console.warn('[ContractFilling] Данные контрагента не содержат поле data')
        showMessage('error', 'Данные контрагента не найдены')
      }
    } catch (error: any) {
      console.error('[ContractFilling] Ошибка при загрузке данных контрагента:', error)
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
        setShowSaveContragentModal(false)
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

  const fillContract = async () => {
    if (!uploadedFilename) {
      showMessage('error', 'Сначала загрузите документ')
      return
    }

    if (anchors.length === 0) {
      showMessage('error', 'В документе не найдено якорей для заполнения')
      return
    }

    // Проверяем, что хотя бы одно поле заполнено
    const hasData = Object.values(formData).some(value => value && value.trim())
    if (!hasData) {
      showMessage('error', 'Заполните хотя бы одно поле')
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
          template_filename: uploadedFilename,
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
        setStep('result')
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

  const startNew = () => {
    setUploadedFilename('')
    setAnchors([])
    setFormData({})
    setFilledFilename('')
    setStep('upload')
    setMessage(null)
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
          Загрузите договор, система найдет якоря, заполните данные и создайте новый документ
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
            <div className="mt-4 text-center text-gray-600">Загрузка файла и поиск якорей...</div>
          )}
        </div>
      )}

      {/* Шаг 2: Заполнение данных */}
      {step === 'fill' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Шаг 2: Заполните данные
          </h2>

          {/* Показываем найденные якоря */}
          {anchors.length > 0 && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="text-lg font-semibold mb-3">Найденные якоря в документе:</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {anchors.map((anchor, index) => (
                  <div
                    key={index}
                    className="bg-white border border-blue-200 rounded-lg p-3 text-center font-semibold text-blue-700"
                  >
                    {`{{${anchor}}}`}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Сохраненные контрагенты */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Сохраненные контрагенты:</h3>
              <button
                onClick={loadContragents}
                className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                Обновить список
              </button>
            </div>
            
            {contragents.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {contragents.map((contragent) => (
                  <div
                    key={contragent.filename}
                    className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-primary-500 hover:shadow-md transition-all relative"
                    onClick={() => loadContragentData(contragent)}
                  >
                    <div className="font-semibold text-gray-800">
                      {contragent.name || contragent.filename || 'Без имени'}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {contragent.updated_at 
                        ? new Date(contragent.updated_at).toLocaleDateString('ru-RU')
                        : contragent.created_at 
                        ? new Date(contragent.created_at).toLocaleDateString('ru-RU')
                        : 'Дата неизвестна'}
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteContragent(contragent.filename, contragent.name || contragent.filename)
                      }}
                      className="absolute top-2 right-2 p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-gray-500">
                <p>Нет сохраненных контрагентов</p>
                <p className="text-sm mt-2">Заполните форму и сохраните данные контрагента</p>
              </div>
            )}
          </div>

          {/* Форма заполнения */}
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
                {loading ? 'Создание документа...' : 'Создать заполненный договор'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Шаг 3: Результат */}
      {step === 'result' && filledFilename && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Шаг 3: Договор создан
          </h2>

          <div className="mb-6 p-4 bg-green-50 rounded-lg">
            <p className="text-green-800 font-medium mb-4">
              Договор успешно заполнен и готов к скачиванию
            </p>
            
            <div className="flex gap-3">
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
                Сохранить данные контрагента
              </button>
              <button
                onClick={startNew}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
              >
                <Upload className="w-4 h-4" />
                Загрузить новый документ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для сохранения контрагента */}
      {showSaveContragentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Сохранить данные контрагента</h3>
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
    </div>
  )
}
