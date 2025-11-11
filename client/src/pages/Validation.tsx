import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usersService, clubsService } from '../services/api'
import { UserRole, Club } from '../types'
import { CheckCircle, XCircle, User as UserIcon, Phone, Mail, Calendar, ArrowLeft, Anchor } from 'lucide-react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { LoadingAnimation } from '../components/LoadingAnimation'

interface PendingUser {
  id: number
  firstName: string
  lastName: string
  email: string
  phone?: string
  role: UserRole
  createdAt: string
  isValidated: boolean
}

interface PendingClub {
  id: number
  name: string
  address: string
  ownerId: number
  owner?: {
    firstName: string
    lastName: string
  }
  createdAt: string
  isValidated: boolean
  isSubmittedForValidation: boolean
  rejectionComment?: string | null
}

export default function Validation() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<PendingUser[]>([])
  const [clubs, setClubs] = useState<PendingClub[]>([])
  const [activeTab, setActiveTab] = useState<'users' | 'clubs'>('users')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [validating, setValidating] = useState<number | null>(null)
  const [validatingClub, setValidatingClub] = useState<number | null>(null)
  const [rejectingClub, setRejectingClub] = useState<number | null>(null)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectComment, setRejectComment] = useState('')
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null)

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await Promise.all([loadPendingUsers(), loadPendingClubs()])
      setLoading(false)
    }
    loadData()
  }, [])

  const loadPendingUsers = async () => {
    try {
      setError('')
      // Получаем всех пользователей с ролью PENDING_VALIDATION
      const response = await usersService.getAll({ limit: 1000 })
      const allUsers = response.data || response || []
      const pendingUsers = (Array.isArray(allUsers) ? allUsers : []).filter((user: any) => 
        user.role === UserRole.PENDING_VALIDATION
      )
      setUsers(pendingUsers)
    } catch (err: any) {
      console.error('Ошибка загрузки пользователей:', err)
      setError(err.error || err.message || 'Ошибка загрузки пользователей')
    }
  }

  const handleValidate = async (userId: number) => {
    if (!confirm('Вы уверены, что хотите валидировать этого пользователя? Роль будет изменена на "Владелец клуба".')) {
      return
    }

    setValidating(userId)
    try {
      // Меняем роль с PENDING_VALIDATION на CLUB_OWNER и устанавливаем isValidated = true
      await usersService.update(userId, { 
        role: UserRole.CLUB_OWNER,
        isValidated: true 
      })
      await Promise.all([loadPendingUsers(), loadPendingClubs()])
      alert('Пользователь успешно валидирован. Роль изменена на "Владелец клуба".')
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка валидации пользователя')
    } finally {
      setValidating(null)
    }
  }

  const loadPendingClubs = async () => {
    try {
      setError('')
      // Получаем все клубы, отправленные на валидацию, но еще не валидированные (исключая отклоненные)
      const response = await clubsService.getAll({ limit: 1000, showHidden: 'true' })
      const allClubs = response.data || []
      const pendingClubs = (Array.isArray(allClubs) ? allClubs : []).filter((club: Club) => 
        club.isSubmittedForValidation === true && club.isValidated === false && !club.rejectionComment
      )
      setClubs(pendingClubs)
    } catch (err: any) {
      console.error('Ошибка загрузки клубов:', err)
      setError(err.error || err.message || 'Ошибка загрузки клубов')
    }
  }

  const handleValidateClub = async (clubId: number) => {
    if (!confirm('Вы уверены, что хотите валидировать этот яхт-клуб? После валидации клуб будет виден всем пользователям.')) {
      return
    }

    setValidatingClub(clubId)
    try {
      await clubsService.update(clubId, { isValidated: true, rejectionComment: null })
      await Promise.all([loadPendingUsers(), loadPendingClubs()])
      alert('Яхт-клуб успешно валидирован')
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка валидации яхт-клуба')
    } finally {
      setValidatingClub(null)
    }
  }

  const handleRejectClick = (clubId: number) => {
    setSelectedClubId(clubId)
    setRejectComment('')
    setShowRejectModal(true)
  }

  const handleRejectClose = () => {
    setShowRejectModal(false)
    setRejectComment('')
    setSelectedClubId(null)
  }

  const handleRejectClub = async () => {
    if (!selectedClubId) return
    
    if (!rejectComment.trim()) {
      alert('Пожалуйста, укажите причину отказа в валидации')
      return
    }

    if (!confirm('Вы уверены, что хотите отказать в валидации этому яхт-клубу? Владелец клуба получит ваш комментарий.')) {
      return
    }

    setRejectingClub(selectedClubId)
    try {
      await clubsService.update(selectedClubId, { 
        isValidated: false,
        isSubmittedForValidation: false,
        rejectionComment: rejectComment.trim()
      })
      await Promise.all([loadPendingUsers(), loadPendingClubs()])
      alert('Отказ в валидации отправлен владельцу клуба')
      handleRejectClose()
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка отказа в валидации')
    } finally {
      setRejectingClub(null)
    }
  }

  const handleViewUser = (userId: number) => {
    navigate(`/users/${userId}`)
  }

  const handleViewClub = (clubId: number) => {
    navigate(`/clubs/${clubId}`)
  }

  if (loading) {
    return <LoadingAnimation message="Загрузка данных для валидации..." />
  }

  const totalPending = users.length + clubs.length

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
            <h1 className="text-3xl font-bold text-gray-900">Валидация</h1>
            <p className="mt-2 text-gray-600">
              Всего ожидает валидации: {totalPending} ({users.length} пользователей, {clubs.length} яхт-клубов)
            </p>
          </div>
        </div>
      </div>

      {/* Вкладки */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Пользователи ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('clubs')}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'clubs'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Яхт-клубы ({clubs.length})
          </button>
        </nav>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {activeTab === 'users' && (
        <>
          {users.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Нет пользователей, ожидающих валидации</h2>
              <p className="text-gray-600">Все владельцы яхт-клубов валидированы</p>
            </div>
          ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <p className="text-sm text-gray-600">
              Всего пользователей, ожидающих валидации: <span className="font-semibold text-gray-900">{users.length}</span>
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Пользователь
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Контакты
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата регистрации
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                          <UserIcon className="h-6 w-6 text-primary-600" />
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.firstName} {user.lastName}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: #{user.id}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {user.email && (
                          <div className="flex items-center mb-1">
                            <Mail className="h-4 w-4 mr-2 text-gray-400" />
                            {user.email}
                          </div>
                        )}
                        {user.phone && (
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 mr-2 text-gray-400" />
                            {user.phone}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-gray-900">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        {format(new Date(user.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleViewUser(user.id)}
                          className="text-primary-600 hover:text-primary-900"
                          title="Просмотреть профиль"
                        >
                          Профиль
                        </button>
                        <button
                          onClick={() => handleValidate(user.id)}
                          disabled={validating === user.id}
                          className="flex items-center px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                        >
                          {validating === user.id ? (
                            'Валидация...'
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Валидировать
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
          )}
        </>
      )}

      {activeTab === 'clubs' && (
        <>
          {clubs.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Нет яхт-клубов, ожидающих валидации</h2>
              <p className="text-gray-600">Все яхт-клубы валидированы</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <p className="text-sm text-gray-600">
                  Всего яхт-клубов, ожидающих валидации: <span className="font-semibold text-gray-900">{clubs.length}</span>
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Яхт-клуб
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Владелец
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Адрес
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Дата создания
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Действия
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {clubs.map((club) => (
                      <tr key={club.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
                              <Anchor className="h-6 w-6 text-primary-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">
                                {club.name}
                              </div>
                              <div className="text-sm text-gray-500">
                                ID: #{club.id}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {club.owner ? (
                              `${club.owner.firstName} ${club.owner.lastName}`
                            ) : (
                              `ID: ${club.ownerId}`
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {club.address}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center text-sm text-gray-900">
                            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                            {format(new Date(club.createdAt), 'dd.MM.yyyy HH:mm', { locale: ru })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleViewClub(club.id)}
                              className="text-primary-600 hover:text-primary-900"
                              title="Просмотреть клуб"
                            >
                              Просмотр
                            </button>
                            <button
                              onClick={() => handleRejectClick(club.id)}
                              disabled={validatingClub === club.id || rejectingClub === club.id}
                              className="flex items-center px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                            >
                              <XCircle className="h-4 w-4 mr-1" />
                              Отказать
                            </button>
                            <button
                              onClick={() => handleValidateClub(club.id)}
                              disabled={validatingClub === club.id || rejectingClub === club.id}
                              className="flex items-center px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                            >
                              {validatingClub === club.id ? (
                                'Валидация...'
                              ) : (
                                <>
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Валидировать
                                </>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Модальное окно отказа в валидации */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Отказать в валидации</h2>
            <div className="mb-4">
              <label htmlFor="reject-comment" className="block text-sm font-medium text-gray-700 mb-2">
                Причина отказа (обязательно):
              </label>
              <textarea
                id="reject-comment"
                rows={4}
                value={rejectComment}
                onChange={(e) => setRejectComment(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                placeholder="Укажите причину отказа в валидации яхт-клуба..."
              />
            </div>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={handleRejectClose}
                disabled={rejectingClub !== null}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={handleRejectClub}
                disabled={rejectingClub !== null || !rejectComment.trim()}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
              >
                {rejectingClub !== null ? 'Отправка...' : 'Отказать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

