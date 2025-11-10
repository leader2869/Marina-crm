import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usersService, clubsService } from '../services/api'
import { User, UserRole, Club } from '../types'
import { Users, ArrowLeft, Ship, Anchor, Edit2, X } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'

export default function UserDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [clubs, setClubs] = useState<Club[]>([])
  const [editForm, setEditForm] = useState({
    email: '',
    phone: '',
    role: UserRole.GUEST,
    clubIds: [] as number[],
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (id) {
      loadUser()
    }
    loadClubs()
  }, [id])

  const loadClubs = async () => {
    try {
      const response = await clubsService.getAll({ limit: 100 })
      setClubs(response.data || [])
    } catch (error) {
      console.error('Ошибка загрузки клубов:', error)
    }
  }

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
      [UserRole.PENDING_VALIDATION]: 'Ожидает валидации',
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
      [UserRole.PENDING_VALIDATION]: 'bg-orange-100 text-orange-800',
    }
    return colorMap[role] || 'bg-gray-100 text-gray-800'
  }

  const handleEditClick = () => {
    if (!user) return
    
    // Получаем массив ID клубов из managedClubs
    const clubIds: number[] = []
    if (user.managedClubs && Array.isArray(user.managedClubs)) {
      user.managedClubs.forEach((uc: any) => {
        if (uc.club && uc.club.id) {
          clubIds.push(uc.club.id)
        }
      })
    }
    
    // Для обратной совместимости добавляем managedClub, если есть
    if (user.managedClub && user.managedClub.id && !clubIds.includes(user.managedClub.id)) {
      clubIds.push(user.managedClub.id)
    }
    
    setEditForm({
      email: user.email,
      phone: user.phone || '',
      role: user.role,
      clubIds: clubIds,
    })
    setShowEditModal(true)
    setError('')
  }

  const handleCloseEdit = () => {
    setShowEditModal(false)
    setEditForm({
      email: '',
      phone: '',
      role: UserRole.GUEST,
      clubIds: [],
    })
    setError('')
  }

  const handleSave = async () => {
    if (!user) return

    setError('')
    setSaving(true)

    try {
      const updateData: any = {
        email: editForm.email,
        phone: editForm.phone || null,
        role: editForm.role,
        managedClubId: null,
      }

      // Отправляем массив clubIds для новой связи многие-ко-многим
      if (editForm.clubIds && editForm.clubIds.length > 0) {
        updateData.clubIds = editForm.clubIds
      } else {
        updateData.clubIds = []
      }

      await usersService.update(user.id, updateData)
      await loadUser()
      handleCloseEdit()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка обновления пользователя')
    } finally {
      setSaving(false)
    }
  }

  const handleValidateUser = async () => {
    if (!user) return
    
    if (!confirm('Вы уверены, что хотите валидировать этого пользователя? Роль будет изменена на "Владелец клуба".')) {
      return
    }
    
    setSaving(true)
    try {
      // Меняем роль с PENDING_VALIDATION на CLUB_OWNER и устанавливаем isValidated = true
      await usersService.update(user.id, { 
        role: UserRole.CLUB_OWNER,
        isValidated: true 
      })
      await loadUser()
      alert('Пользователь успешно валидирован. Роль изменена на "Владелец клуба".')
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка валидации пользователя')
    } finally {
      setSaving(false)
    }
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

  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN

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
        {isSuperAdmin && (
          <div className="flex gap-3">
            {user.role === UserRole.PENDING_VALIDATION && (
              <button
                onClick={handleValidateUser}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
              >
                Валидировать пользователя
              </button>
            )}
            <button
              onClick={handleEditClick}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Edit2 className="h-5 w-5 mr-2" />
              Редактировать профиль
            </button>
          </div>
        )}
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
            {user.role === UserRole.PENDING_VALIDATION && (
              <div className="flex justify-between py-2 border-b border-gray-200">
                <span className="text-gray-600">Статус валидации:</span>
                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800">
                  Ожидает валидации
                </span>
              </div>
            )}
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

      {/* Модальное окно редактирования */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={handleCloseEdit} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Редактировать профиль: {user?.firstName} {user?.lastName}
                  </h3>
                  <button
                    onClick={handleCloseEdit}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {error && (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                    {error}
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700">
                      Email *
                    </label>
                    <input
                      id="edit-email"
                      type="email"
                      required
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-phone" className="block text-sm font-medium text-gray-700">
                      Телефон
                    </label>
                    <input
                      id="edit-phone"
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-role" className="block text-sm font-medium text-gray-700">
                      Роль *
                    </label>
                    <select
                      id="edit-role"
                      required
                      value={editForm.role}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value as UserRole })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    >
                      <option value={UserRole.SUPER_ADMIN}>Супер-администратор</option>
                      <option value={UserRole.ADMIN}>Администратор</option>
                      <option value={UserRole.CLUB_OWNER}>Владелец клуба</option>
                      <option value={UserRole.VESSEL_OWNER}>Судовладелец</option>
                      <option value={UserRole.GUEST}>Гость</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="edit-clubs" className="block text-sm font-medium text-gray-700">
                      Яхт-клубы (можно выбрать несколько)
                    </label>
                    <select
                      id="edit-clubs"
                      multiple
                      size={5}
                      value={editForm.clubIds.map(String)}
                      onChange={(e) => {
                        const selectedIds = Array.from(e.target.selectedOptions, option => parseInt(option.value))
                        setEditForm({ ...editForm, clubIds: selectedIds })
                      }}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    >
                      {clubs.map((club) => (
                        <option key={club.id} value={club.id}>
                          {club.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Удерживайте Ctrl (или Cmd на Mac) для выбора нескольких клубов
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseEdit}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

