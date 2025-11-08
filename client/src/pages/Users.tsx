import { useEffect, useState } from 'react'
import { usersService, clubsService } from '../services/api'
import { UserRole, Club } from '../types'
import { Users, Edit2, X, Plus } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'

interface UserData {
  id: number
  firstName: string
  lastName: string
  email: string
  phone: string
  role: UserRole
  clubName: string
  debt: number
  createdAt: string
}

export default function UsersPage() {
  const { user } = useAuth()
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [clubs, setClubs] = useState<Club[]>([])
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [editForm, setEditForm] = useState({
    email: '',
    phone: '',
    role: UserRole.GUEST,
    managedClubId: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    phone: '',
    role: UserRole.GUEST,
    managedClubId: '',
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    loadUsers()
    loadClubs()
  }, [])

  const loadUsers = async () => {
    try {
      const response = await usersService.getAll({ limit: 100 })
      setUsers(response.data || [])
    } catch (error: any) {
      console.error('Ошибка загрузки пользователей:', error)
      if (error.error || error.message) {
        setError(error.error || error.message)
      }
    } finally {
      setLoading(false)
    }
  }

  const loadClubs = async () => {
    try {
      const response = await clubsService.getAll({ limit: 100 })
      setClubs(response.data || [])
    } catch (error) {
      console.error('Ошибка загрузки клубов:', error)
    }
  }

  const handleEdit = (user: UserData) => {
    setEditingUser(user)
    
    // Находим текущий клуб пользователя по имени
    let currentClubId = ''
    if (user.clubName && user.clubName !== '-') {
      const club = clubs.find((c) => c.name === user.clubName)
      if (club) {
        currentClubId = club.id.toString()
      }
    }
    
    setEditForm({
      email: user.email,
      phone: user.phone === '-' ? '' : user.phone,
      role: user.role,
      managedClubId: currentClubId,
    })
    setError('')
  }

  const handleCloseEdit = () => {
    setEditingUser(null)
    setEditForm({
      email: '',
      phone: '',
      role: UserRole.GUEST,
      managedClubId: '',
    })
    setError('')
  }

  const handleSave = async () => {
    if (!editingUser) return

    setError('')
    setSaving(true)

    try {
      const updateData: any = {
        email: editForm.email,
        phone: editForm.phone || null,
        role: editForm.role,
      }

      if (editForm.managedClubId) {
        updateData.managedClubId = parseInt(editForm.managedClubId)
      } else {
        updateData.managedClubId = null
      }

      await usersService.update(editingUser.id, updateData)
      await loadUsers()
      handleCloseEdit()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка обновления пользователя')
    } finally {
      setSaving(false)
    }
  }

  const handleOpenAdd = () => {
    setShowAddModal(true)
    setAddForm({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: '',
      role: UserRole.GUEST,
      managedClubId: '',
    })
    setError('')
  }

  const handleCloseAdd = () => {
    setShowAddModal(false)
    setAddForm({
      email: '',
      password: '',
      firstName: '',
      lastName: '',
      phone: '',
      role: UserRole.GUEST,
      managedClubId: '',
    })
    setError('')
  }

  const handleCreate = async () => {
    setError('')
    setCreating(true)

    try {
      const createData: any = {
        email: addForm.email,
        password: addForm.password,
        firstName: addForm.firstName,
        lastName: addForm.lastName,
        phone: addForm.phone || null,
        role: addForm.role,
      }

      if (addForm.managedClubId) {
        createData.managedClubId = parseInt(addForm.managedClubId)
      }

      await usersService.create(createData)
      await loadUsers()
      handleCloseAdd()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка создания пользователя')
    } finally {
      setCreating(false)
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  // Проверка роли (дополнительная защита)
  if (user && user.role !== UserRole.SUPER_ADMIN) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Доступ запрещен</h1>
          <p className="text-gray-600">У вас нет прав для доступа к этой странице</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Пользователи</h1>
          <p className="mt-2 text-gray-600">Список всех зарегистрированных пользователей</p>
        </div>
        <button
          onClick={handleOpenAdd}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          <Plus className="h-5 w-5 mr-2" />
          Добавить пользователя
        </button>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Имя и Фамилия
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Роль
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Яхт-клуб
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Контакты
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Задолженность
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата регистрации
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">#{user.id}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {getRoleText(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.clubName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email}</div>
                    {user.phone !== '-' && (
                      <div className="text-xs text-gray-500">{user.phone}</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {user.debt > 0 ? (
                      <div className="text-sm font-semibold text-red-600">
                        {formatCurrency(user.debt)}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">Нет задолженности</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {format(new Date(user.createdAt), 'dd.MM.yyyy')}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button
                      onClick={() => handleEdit(user)}
                      className="text-primary-600 hover:text-primary-900"
                      title="Редактировать"
                    >
                      <Edit2 className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {users.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Пользователи не найдены</p>
        </div>
      )}

      {/* Модальное окно добавления пользователя */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={handleCloseAdd} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Добавить нового пользователя
                  </h3>
                  <button
                    onClick={handleCloseAdd}
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
                    <label htmlFor="add-email" className="block text-sm font-medium text-gray-700">
                      Email *
                    </label>
                    <input
                      id="add-email"
                      type="email"
                      required
                      value={addForm.email}
                      onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="add-password" className="block text-sm font-medium text-gray-700">
                      Пароль *
                    </label>
                    <input
                      id="add-password"
                      type="password"
                      required
                      value={addForm.password}
                      onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="add-firstName" className="block text-sm font-medium text-gray-700">
                      Имя *
                    </label>
                    <input
                      id="add-firstName"
                      type="text"
                      required
                      value={addForm.firstName}
                      onChange={(e) => setAddForm({ ...addForm, firstName: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="add-lastName" className="block text-sm font-medium text-gray-700">
                      Фамилия *
                    </label>
                    <input
                      id="add-lastName"
                      type="text"
                      required
                      value={addForm.lastName}
                      onChange={(e) => setAddForm({ ...addForm, lastName: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="add-phone" className="block text-sm font-medium text-gray-700">
                      Телефон
                    </label>
                    <input
                      id="add-phone"
                      type="tel"
                      value={addForm.phone}
                      onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="add-role" className="block text-sm font-medium text-gray-700">
                      Роль *
                    </label>
                    <select
                      id="add-role"
                      required
                      value={addForm.role}
                      onChange={(e) => setAddForm({ ...addForm, role: e.target.value as UserRole })}
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
                    <label htmlFor="add-club" className="block text-sm font-medium text-gray-700">
                      Яхт-клуб
                    </label>
                    <select
                      id="add-club"
                      value={addForm.managedClubId}
                      onChange={(e) => setAddForm({ ...addForm, managedClubId: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    >
                      <option value="">Не привязан</option>
                      {clubs.map((club) => (
                        <option key={club.id} value={club.id}>
                          {club.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={creating}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {creating ? 'Создание...' : 'Создать'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseAdd}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования */}
      {editingUser && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={handleCloseEdit} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Редактировать пользователя: {editingUser.firstName} {editingUser.lastName}
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
                    <label htmlFor="edit-club" className="block text-sm font-medium text-gray-700">
                      Яхт-клуб
                    </label>
                    <select
                      id="edit-club"
                      value={editForm.managedClubId}
                      onChange={(e) => setEditForm({ ...editForm, managedClubId: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    >
                      <option value="">Не привязан</option>
                      {clubs.map((club) => (
                        <option key={club.id} value={club.id}>
                          {club.name}
                        </option>
                      ))}
                    </select>
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

