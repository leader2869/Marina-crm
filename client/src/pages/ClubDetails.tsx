import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { clubsService } from '../services/api'
import { Club } from '../types'
import { MapPin, Phone, Mail, Globe, Anchor } from 'lucide-react'

export default function ClubDetails() {
  const { id } = useParams<{ id: string }>()
  const [club, setClub] = useState<Club | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadClub()
    }
  }, [id])

  const loadClub = async () => {
    try {
      const data = await clubsService.getById(parseInt(id!))
      setClub(data)
    } catch (error) {
      console.error('Ошибка загрузки клуба:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>
  }

  if (!club) {
    return <div className="text-center py-12">Клуб не найден</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">{club.name}</h1>
        {club.description && <p className="mt-2 text-gray-600">{club.description}</p>}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Информация</h2>
          <div className="space-y-3">
            <div className="flex items-center">
              <MapPin className="h-5 w-5 text-gray-400 mr-3" />
              <span className="text-gray-700">{club.address}</span>
            </div>
            {club.phone && (
              <div className="flex items-center">
                <Phone className="h-5 w-5 text-gray-400 mr-3" />
                <span className="text-gray-700">{club.phone}</span>
              </div>
            )}
            {club.email && (
              <div className="flex items-center">
                <Mail className="h-5 w-5 text-gray-400 mr-3" />
                <span className="text-gray-700">{club.email}</span>
              </div>
            )}
            {club.website && (
              <div className="flex items-center">
                <Globe className="h-5 w-5 text-gray-400 mr-3" />
                <a href={club.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">
                  {club.website}
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Характеристики</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Всего причалов:</span>
              <span className="font-semibold">{club.totalBerths}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Базовая цена за день:</span>
              <span className="font-semibold text-primary-600">
                {club.basePrice.toLocaleString()} ₽
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Минимальный период аренды:</span>
              <span className="font-semibold">{club.minRentalPeriod} дней</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Максимальный период аренды:</span>
              <span className="font-semibold">{club.maxRentalPeriod} дней</span>
            </div>
          </div>
        </div>
      </div>

      {club.berths && club.berths.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Причалы</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {club.berths.map((berth) => (
              <div key={berth.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center mb-2">
                  <Anchor className="h-5 w-5 text-primary-600 mr-2" />
                  <span className="font-semibold">Причал {berth.number}</span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Длина: {berth.length} м</div>
                  <div>Ширина: {berth.width} м</div>
                  {berth.pricePerDay && (
                    <div className="text-primary-600 font-semibold">
                      {berth.pricePerDay.toLocaleString()} ₽/день
                    </div>
                  )}
                  <div className={`mt-2 ${berth.isAvailable ? 'text-green-600' : 'text-red-600'}`}>
                    {berth.isAvailable ? 'Доступен' : 'Занят'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

