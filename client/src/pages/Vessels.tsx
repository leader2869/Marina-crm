import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { vesselsService } from '../services/api'
import { Vessel, UserRole } from '../types'
import { Ship, Plus, Trash2, Search } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function Vessels() {
  const { user } = useAuth()
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

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

  const handleDelete = async (vesselId: number) => {
    // Первое подтверждение
    if (!confirm('Вы уверены, что хотите удалить это судно?')) return

    // Второе подтверждение
    if (!confirm('ВНИМАНИЕ! Это действие необратимо. Данные будут удалены из базы данных. Продолжить?')) return

    setDeleting(true)

    try {
      await vesselsService.delete(vesselId)
      await loadVessels()
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка удаления судна')
    } finally {
      setDeleting(false)
    }
  }

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN

  // Фильтрация судов по поисковому запросу
  const filteredVessels = vessels.filter((vessel) => {
    if (!searchTerm) return true
    
    const searchLower = searchTerm.toLowerCase().trim()
    
    // Поиск по названию судна
    const vesselName = vessel.name?.toLowerCase() || ''
    if (vesselName.includes(searchLower)) return true
    
    // Поиск по регистрационному номеру
    const registrationNumber = vessel.registrationNumber?.toLowerCase() || ''
    if (registrationNumber.includes(searchLower)) return true
    
    // Поиск по владельцу
    if (vessel.owner) {
      // Поиск по полному имени (имя + фамилия)
      const ownerFullName = `${vessel.owner.firstName || ''} ${vessel.owner.lastName || ''}`.toLowerCase().trim()
      if (ownerFullName.includes(searchLower)) return true
      
      // Поиск по имени отдельно
      const ownerFirstName = vessel.owner.firstName?.toLowerCase() || ''
      if (ownerFirstName.includes(searchLower)) return true
      
      // Поиск по фамилии отдельно
      const ownerLastName = vessel.owner.lastName?.toLowerCase() || ''
      if (ownerLastName.includes(searchLower)) return true
      
      // Поиск по телефону владельца
      const ownerPhone = vessel.owner.phone?.toLowerCase() || ''
      if (ownerPhone.includes(searchLower)) return true
    }
    
    return false
  })

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

      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по названию, владельцу, рег. номеру или телефону..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 bg-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredVessels.map((vessel) => (
          <div key={vessel.id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 relative">
            <div className="flex items-start justify-between mb-4">
              <Link
                to={`/vessels/${vessel.id}`}
                className="flex items-center flex-1 hover:text-primary-600 transition-colors"
              >
                <Ship className="h-8 w-8 text-primary-600 mr-3" />
                <h3 className="text-xl font-semibold text-gray-900">{vessel.name}</h3>
              </Link>
              {isSuperAdmin && (
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleDelete(vessel.id)
                  }}
                  disabled={deleting}
                  className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                  title="Удалить"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
            </div>
            <Link to={`/vessels/${vessel.id}`} className="block">
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
                {vessel.heightAboveWaterline && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Высота над ватерлинией:</span>
                    <span className="font-semibold">{vessel.heightAboveWaterline} м</span>
                  </div>
                )}
                {vessel.registrationNumber && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Рег. номер:</span>
                    <span className="font-semibold">{vessel.registrationNumber}</span>
                  </div>
                )}
              </div>
            </Link>
          </div>
        ))}
      </div>

      {filteredVessels.length === 0 && vessels.length > 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Ship className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Судна по запросу "{searchTerm}" не найдены</p>
        </div>
      )}

      {vessels.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Ship className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Судна не найдены</p>
        </div>
      )}
    </div>
  )
}

