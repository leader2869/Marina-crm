import { useEffect, useState } from 'react'
import { vesselsService } from '../services/api'
import { Vessel } from '../types'
import { Ship, Plus } from 'lucide-react'

export default function Vessels() {
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadVessels()
  }, [])

  const loadVessels = async () => {
    try {
      const response = await vesselsService.getAll({ limit: 100 })
      setVessels(response.data || [])
    } catch (error) {
      console.error('Ошибка загрузки судов:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Судна</h1>
          <p className="mt-2 text-gray-600">Управление судами</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
          <Plus className="h-5 w-5 mr-2" />
          Добавить судно
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {vessels.map((vessel) => (
          <div key={vessel.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <Ship className="h-8 w-8 text-primary-600 mr-3" />
                <h3 className="text-xl font-semibold text-gray-900">{vessel.name}</h3>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Тип:</span>
                <span className="font-semibold">{vessel.type}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Длина:</span>
                <span className="font-semibold">{vessel.length} м</span>
              </div>
              {vessel.width && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Ширина:</span>
                  <span className="font-semibold">{vessel.width} м</span>
                </div>
              )}
              {vessel.registrationNumber && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Рег. номер:</span>
                  <span className="font-semibold">{vessel.registrationNumber}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {vessels.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Ship className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Судна не найдены</p>
        </div>
      )}
    </div>
  )
}

