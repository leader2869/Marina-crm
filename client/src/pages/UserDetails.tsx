import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usersService } from '../services/api'
import { User, UserRole } from '../types'
import { Users, ArrowLeft, Ship, Anchor } from 'lucide-react'
import { format } from 'date-fns'

export default function UserDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (id) {
      loadUser()
    }
  }, [id])

  const loadUser = async () => {
    try {
      const data = (await usersService.getById(parseInt(id!))) as unknown as User
      setUser(data)
      setError('')
    } catch (error: any) {
      console.error('Ошибка загрузки пользователя:', error)
      if (error.error) {
        setError(error.error)
      } else if (error.message) {
        setError(error.message)
      } else if (typeof error === 'string') {
        setError(error)
      } else {
        setError('Ошибка загрузки пользователя')
      }
    } finally {
      setLoading(false)
    }
  }

  const getRoleText = (role: UserRole) => {
    const roleMap: Record<UserRole, string> = {
      [UserRole.SUPER_ADMIN]: 'Супер-администратор',
      [UserRole.ADMIN]: 'Администратор',
      [UserRole.CLUB_OWNER]: 'Владелец клуба',
      [UserRole.VESSEL_OWNER]: 'Судовладелец',
      [UserRole.GUEST]: 'Гость',
    }
    return roleMap[role] || role
  }

  const getRoleColor = (role: UserRole) => {
    const colorMap: Record<UserRole, string> = {
      [UserRole.SUPER_ADMIN]: 'bg-purple-100 text-purple-800',
      [UserRole.ADMIN]: 'bg-blue-100 text-blue-800',
      [UserRole.CLUB_OWNER]: 'bg-green-100 text-green-800',
      [UserRole.VESSEL_OWNER]: 'bg-yellow-100 text-yellow-800',
      [UserRole.GUEST]: 'bg-gray-100 text-gray-800',
    }
    return colorMap[role] || 'bg-gray-100 text-gray-800'
  }


  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Загрузка...</p>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="text-center py-12">
        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Пользователь не найден</h2>
        <p className="text-gray-600 mb-4">{error || 'Пользователь с указанным ID не найден'}</p>
        <button
          onClick={() => navigate('/users')}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          Вернуться к списку пользователей
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/users')}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
            title="Назад"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {user.firstName} {user.lastName}
            </h1>
            <p className="mt-2 text-gray-600">Полная информация о пользователе</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Основная информация */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Users className="h-6 w-6 text-primary-600 mr-2" />
            Основная информация
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">ID:</span>
              <span className="font-semibold text-gray-900">#{user.id}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Имя:</span>
              <span className="font-semibold text-gray-900">{user.firstName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Фамилия:</span>
              <span className="font-semibold text-gray-900">{user.lastName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Роль:</span>
              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(user.role)}`}>
                {getRoleText(user.role)}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Email:</span>
              <span className="font-semibold text-gray-900">{user.email}</span>
            </div>
            {user.phone && (
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Телефон:</span>
                <span className="font-semibold text-gray-900">{user.phone}</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-gray-600">Дата регистрации:</span>
              <span className="font-semibold text-gray-900">
                {format(new Date(user.createdAt), 'dd.MM.yyyy')}
              </span>
            </div>
          </div>
        </div>

        {/* Яхт-клуб */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <Anchor className="h-6 w-6 text-primary-600 mr-2" />
            Яхт-клуб
          </h2>
          {user.managedClub ? (
            <div className="space-y-4">
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Название:</span>
                <span className="font-semibold text-gray-900">{user.managedClub.name}</span>
              </div>
              {user.managedClub.address && (
                <div className="flex justify-between py-2 border-b border-gray-200">
                  <span className="text-gray-600">Адрес:</span>
                  <span className="font-semibold text-gray-900">{user.managedClub.address}</span>
                </div>
              )}
            </div>
          ) : user.ownedClubs && user.ownedClubs.length > 0 ? (
            <div className="space-y-4">
              {user.ownedClubs.map((club) => (
                <div key={club.id} className="py-2 border-b border-gray-200">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Название:</span>
                    <span className="font-semibold text-gray-900">{club.name}</span>
                  </div>
                  {club.address && (
                    <div className="flex justify-between mt-2">
                      <span className="text-gray-600">Адрес:</span>
                      <span className="font-semibold text-gray-900">{club.address}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600">Яхт-клуб не привязан</p>
          )}
        </div>

        {/* Судна */}
        {user.vessels && user.vessels.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
            <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
              <Ship className="h-6 w-6 text-primary-600 mr-2" />
              Судна ({user.vessels.length})
            </h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {user.vessels.map((vessel) => (
                <div
                  key={vessel.id}
                  onClick={() => navigate(`/vessels/${vessel.id}`)}
                  className="p-4 border border-gray-200 rounded-lg hover:border-primary-500 hover:shadow-md transition-all cursor-pointer"
                >
                  <h3 className="font-semibold text-gray-900 mb-2">{vessel.name}</h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Тип:</span>
                      <span className="font-medium">{vessel.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Длина:</span>
                      <span className="font-medium">{vessel.length} м</span>
                    </div>
                    {vessel.width && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Ширина:</span>
                        <span className="font-medium">{vessel.width} м</span>
                      </div>
                    )}
                    {vessel.registrationNumber && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Рег. номер:</span>
                        <span className="font-medium">{vessel.registrationNumber}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

