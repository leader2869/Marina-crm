import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ShoppingCart, FilePlus, CheckCircle } from 'lucide-react'
import BackButton from '../components/BackButton'
import CreateOrder from './agent/CreateOrder'
import CompletedOrders from './agent/CompletedOrders'

export default function AgentOrders() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as 'active' | 'completed' | null
  const [activeTab, setActiveTab] = useState<'active' | 'completed'>(tabFromUrl === 'completed' ? 'completed' : 'active')

  useEffect(() => {
    if (tabFromUrl === 'completed') {
      setActiveTab('completed')
    }
  }, [tabFromUrl])

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <ShoppingCart className="h-8 w-8 text-primary-600 mr-3" />
            Агентские заказы
          </h1>
          <p className="mt-2 text-gray-600">Управление заказами</p>
        </div>
      </div>

      {/* Вкладки */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => {
                setActiveTab('active')
                setSearchParams({})
              }}
              className={`
                flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${activeTab === 'active'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <FilePlus className="h-5 w-5 mr-2" />
              Активные заказы
            </button>
            <button
              onClick={() => {
                setActiveTab('completed')
                setSearchParams({ tab: 'completed' })
              }}
              className={`
                flex items-center py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap
                ${activeTab === 'completed'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }
              `}
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              Завершенные заказы
            </button>
          </nav>
        </div>

        {/* Контент вкладок */}
        <div className="p-6">
          {activeTab === 'active' ? (
            <CreateOrder />
          ) : (
            <CompletedOrders />
          )}
        </div>
      </div>
    </div>
  )
}
