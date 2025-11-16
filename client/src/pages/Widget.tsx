import { useState } from 'react'
import { Code, Copy, Check, ExternalLink } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import BackButton from '../components/BackButton'

export default function Widget() {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)

  // Генерируем URL для виджета
  const widgetUrl = `${window.location.origin}/widget/embed?userId=${user?.id || ''}`

  const widgetCode = `<iframe 
  src="${widgetUrl}"
  width="100%"
  height="600"
  frameborder="0"
  style="border: none; border-radius: 8px;"
></iframe>`

  const handleCopy = () => {
    navigator.clipboard.writeText(widgetCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Виджет для бронирования</h1>
          <p className="mt-2 text-gray-600">Встройте виджет бронирования на ваш сайт</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <Code className="h-5 w-5 mr-2 text-primary-600" />
          Код для встраивания
        </h2>
        
        <div className="bg-gray-50 rounded-lg p-4 mb-4 relative">
          <pre className="text-sm text-gray-800 overflow-x-auto">
            <code>{widgetCode}</code>
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-4 right-4 flex items-center px-3 py-1.5 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 transition-colors"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 mr-1" />
                Скопировано
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 mr-1" />
                Копировать
              </>
            )}
          </button>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Инструкция:</h3>
          <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
            <li>Скопируйте код выше</li>
            <li>Вставьте его на страницу вашего сайта, где хотите разместить виджет</li>
            <li>Виджет автоматически отобразит доступные яхт-клубы и позволит посетителям бронировать места</li>
          </ol>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
          <ExternalLink className="h-5 w-5 mr-2 text-primary-600" />
          Предпросмотр
        </h2>
        
        <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
          <iframe
            src={widgetUrl}
            width="100%"
            height="600"
            style={{ border: 'none', borderRadius: '8px' }}
            title="Виджет бронирования"
          />
        </div>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-yellow-900 mb-2">Примечание:</h3>
        <p className="text-sm text-yellow-800">
          Виджет будет отображать только те яхт-клубы, которые опубликованы и доступны для бронирования.
          Все бронирования будут привязаны к вашему аккаунту.
        </p>
      </div>
    </div>
  )
}

