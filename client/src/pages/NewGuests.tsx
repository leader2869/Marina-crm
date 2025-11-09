import { useEffect, useState } from 'react'
import { usersService } from '../services/api'
import { UserCheck, Phone, Calendar } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'

interface GuestData {
  id: number
  firstName: string
  phone: string
  createdAt: string
  email: string
}

export default function NewGuests() {
  const [guests, setGuests] = useState<GuestData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadGuests()
  }, [])

  const loadGuests = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await usersService.getGuests({ limit: 1000 })
      setGuests(response.data || [])
    } catch (err: any) {
      console.error('Ошибка загрузки гостей:', err)
      setError(err.error || err.message || 'Ошибка загрузки гостей')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Новые гости</h1>
        <p className="mt-2 text-gray-600">Список всех пользователей, которые зашли в систему как гости</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {guests.length === 0 ? (
          <div className="text-center py-12">
            <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Гости не найдены</p>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Имя
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Телефон
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата входа
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {guests.map((guest) => (
                <tr key={guest.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-primary-100">
                        <UserCheck className="h-5 w-5 text-primary-600" />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{guest.firstName}</div>
                        <div className="text-sm text-gray-500">{guest.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      {guest.phone !== '-' ? (
                        <>
                          <Phone className="h-4 w-4 mr-2 text-gray-400" />
                          {guest.phone}
                        </>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900">
                      <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                      {format(new Date(guest.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {guests.length > 0 && (
        <div className="text-sm text-gray-600">
          Всего гостей: <span className="font-semibold">{guests.length}</span>
        </div>
      )}
    </div>
  )
}

