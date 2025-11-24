import { useEffect, useState } from 'react'
import { Wrench, Plus, Search } from 'lucide-react'
import { LoadingAnimation } from '../components/LoadingAnimation'
import BackButton from '../components/BackButton'

export default function VesselService() {
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    // Загрузка данных сервиса
    setLoading(false)
  }, [])

  if (loading) {
    return <LoadingAnimation message="Загрузка данных о сервисе..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Wrench className="h-8 w-8 text-primary-600 mr-3" />
              Сервис катеров
            </h1>
            <p className="mt-2 text-gray-600">Управление сервисным обслуживанием катеров</p>
          </div>
        </div>
      </div>

      {/* Поиск */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по катеру, типу обслуживания..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Контент */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <Wrench className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Раздел в разработке</h2>
          <p className="text-gray-600">Функционал сервисного обслуживания катеров будет доступен в ближайшее время</p>
        </div>
      </div>
    </div>
  )
}

