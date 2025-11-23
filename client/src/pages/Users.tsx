import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { usersService, clubsService } from '../services/api'
import { UserRole, Club, Vessel } from '../types'
import { Users, Edit2, X, Plus, Trash2, Search, Ship, Download, ArrowUp, ArrowDown, ChevronsUpDown, User } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import * as XLSX from 'xlsx'
import { LoadingAnimation } from '../components/LoadingAnimation'
import BackButton from '../components/BackButton'

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
  vessels?: Vessel[]
  avatar?: string
}

export default function UsersPage() {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState<UserData[]>([])
  const [loading, setLoading] = useState(true)
  const [clubs, setClubs] = useState<Club[]>([])
  const [editingUser, setEditingUser] = useState<UserData | null>(null)
  const [editForm, setEditForm] = useState({
    email: '',
    phone: '',
    role: UserRole.GUEST,
    managedClubId: '',
    clubIds: [] as number[],
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
    clubIds: [] as number[],
  })
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null)
  const [showVesselModal, setShowVesselModal] = useState(false)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc')

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

  const handleEdit = async (user: UserData) => {
    setEditingUser(user)
    
    try {
      // Загружаем полные данные пользователя с клубами
      const fullUser = await usersService.getById(user.id) as any
      
      // Получаем массив ID клубов из managedClubs
      const clubIds: number[] = []
      if (fullUser.managedClubs && Array.isArray(fullUser.managedClubs)) {
        fullUser.managedClubs.forEach((uc: any) => {
          if (uc.club && uc.club.id) {
            clubIds.push(uc.club.id)
          }
        })
      }
      
      // Для обратной совместимости добавляем managedClub, если есть
      if (fullUser.managedClub && fullUser.managedClub.id && !clubIds.includes(fullUser.managedClub.id)) {
        clubIds.push(fullUser.managedClub.id)
      }
      
      setEditForm({
        email: user.email,
        phone: user.phone === '-' ? '' : user.phone,
        role: user.role,
        managedClubId: '', // Оставляем для обратной совместимости
        clubIds: clubIds,
      })
      setError('')
    } catch (err: any) {
      console.error('Ошибка загрузки данных пользователя:', err)
      // Если не удалось загрузить, используем старый способ
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
        clubIds: [],
      })
      setError('')
    }
  }

  const handleCloseEdit = () => {
    setEditingUser(null)
    setEditForm({
      email: '',
      phone: '',
      role: UserRole.GUEST,
      managedClubId: '',
      clubIds: [],
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

      // Отправляем массив clubIds для новой связи многие-ко-многим
      if (editForm.clubIds && editForm.clubIds.length > 0) {
        updateData.clubIds = editForm.clubIds
      } else {
        updateData.clubIds = []
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
      clubIds: [],
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
      clubIds: [],
    })
    setError('')
  }

  const handleDelete = async (userId: number) => {
    // Первое подтверждение
    if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) return

    // Второе подтверждение
    if (!confirm('ВНИМАНИЕ! Это действие необратимо. Данные будут удалены из базы данных. Продолжить?')) return

    setDeleting(true)
    setError('')

    try {
      await usersService.delete(userId)
      await loadUsers()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка удаления пользователя')
    } finally {
      setDeleting(false)
    }
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

      // Отправляем массив clubIds для новой связи многие-ко-многим
      if (addForm.clubIds && addForm.clubIds.length > 0) {
        createData.clubIds = addForm.clubIds
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
      [UserRole.PENDING_VALIDATION]: 'bg-red-500 text-white font-bold',
    }
    return colorMap[role] || 'bg-gray-100 text-gray-800'
  }

  const exportToExcel = async () => {
    try {
      // Загружаем всех пользователей для экспорта
      const response = await usersService.getAll({ limit: 10000 })
      const allUsers = response.data || []

      // Подготавливаем данные для Excel
      const excelData = allUsers.map((user: UserData) => {
        const vessels = user.vessels && user.vessels.length > 0
          ? user.vessels.map(v => v.name).join(', ')
          : 'Нет катеров'

        return {
          'ID': user.id,
          'Имя': user.firstName || '',
          'Фамилия': user.lastName || '',
          'Email': user.email || '',
          'Телефон': user.phone || '-',
          'Роль': getRoleText(user.role),
          'Закрепленные катера': vessels,
          'Яхт-клуб': user.clubName || '-',
          'Задолженность (₽)': user.debt || 0,
          'Дата регистрации': user.createdAt ? format(new Date(user.createdAt), 'dd.MM.yyyy HH:mm') : '-',
        }
      })

      // Создаем рабочую книгу Excel
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Пользователи')

      // Настраиваем ширину столбцов
      const columnWidths = [
        { wch: 8 },  // ID
        { wch: 15 }, // Имя
        { wch: 15 }, // Фамилия
        { wch: 25 }, // Email
        { wch: 15 }, // Телефон
        { wch: 20 }, // Роль
        { wch: 30 }, // Закрепленные катера
        { wch: 20 }, // Яхт-клуб
        { wch: 15 }, // Задолженность
        { wch: 20 }, // Дата регистрации
      ]
      worksheet['!cols'] = columnWidths

      // Генерируем имя файла с текущей датой
      const fileName = `Пользователи_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.xlsx`

      // Сохраняем файл
      XLSX.writeFile(workbook, fileName)
    } catch (error: any) {
      console.error('Ошибка экспорта в Excel:', error)
      setError('Ошибка экспорта данных в Excel')
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      // Если уже сортируем по этому полю, меняем направление
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // Если новое поле, устанавливаем его и направление по умолчанию
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const sortUsers = (usersToSort: UserData[]): UserData[] => {
    if (!sortField) return usersToSort

    return [...usersToSort].sort((a, b) => {
      let aValue: any
      let bValue: any

      switch (sortField) {
        case 'id':
          aValue = a.id
          bValue = b.id
          break
        case 'firstName':
          aValue = a.firstName?.toLowerCase() || ''
          bValue = b.firstName?.toLowerCase() || ''
          break
        case 'lastName':
          aValue = a.lastName?.toLowerCase() || ''
          bValue = b.lastName?.toLowerCase() || ''
          break
        case 'role':
          aValue = getRoleText(a.role)
          bValue = getRoleText(b.role)
          break
        case 'vessels':
          aValue = a.vessels?.length || 0
          bValue = b.vessels?.length || 0
          break
        case 'clubName':
          aValue = a.clubName?.toLowerCase() || ''
          bValue = b.clubName?.toLowerCase() || ''
          break
        case 'email':
          aValue = a.email?.toLowerCase() || ''
          bValue = b.email?.toLowerCase() || ''
          break
        case 'phone':
          aValue = a.phone?.toLowerCase() || ''
          bValue = b.phone?.toLowerCase() || ''
          break
        case 'debt':
          aValue = a.debt || 0
          bValue = b.debt || 0
          break
        case 'createdAt':
          aValue = new Date(a.createdAt).getTime()
          bValue = new Date(b.createdAt).getTime()
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
  }

  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return <ChevronsUpDown className="h-4 w-4 ml-1 text-gray-400" />
    }
    if (sortDirection === 'asc') {
      return <ArrowUp className="h-4 w-4 ml-1 text-primary-600" />
    }
    return <ArrowDown className="h-4 w-4 ml-1 text-primary-600" />
  }

  // Проверка роли (дополнительная защита)
  if (currentUser && currentUser.role !== UserRole.SUPER_ADMIN) {
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
    return <LoadingAnimation message="Загрузка пользователей..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Пользователи</h1>
            <p className="mt-2 text-gray-600">Список всех зарегистрированных пользователей</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToExcel}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            title="Экспортировать в Excel"
          >
            <Download className="h-5 w-5 mr-2" />
            Экспорт в Excel
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            Добавить пользователя
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Поиск по фамилии, телефону или названию катера..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 bg-white"
          />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('id')}
                >
                  <div className="flex items-center">
                    ID
                    {getSortIcon('id')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('lastName')}
                >
                  <div className="flex items-center">
                    Имя и Фамилия
                    {getSortIcon('lastName')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('role')}
                >
                  <div className="flex items-center">
                    Роль
                    {getSortIcon('role')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('vessels')}
                >
                  <div className="flex items-center">
                    Закрепленные катера
                    {getSortIcon('vessels')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('clubName')}
                >
                  <div className="flex items-center">
                    Яхт-клуб
                    {getSortIcon('clubName')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('email')}
                >
                  <div className="flex items-center">
                    Контакты
                    {getSortIcon('email')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('debt')}
                >
                  <div className="flex items-center">
                    Задолженность
                    {getSortIcon('debt')}
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                  onClick={() => handleSort('createdAt')}
                >
                  <div className="flex items-center">
                    Дата регистрации
                    {getSortIcon('createdAt')}
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действия
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {(() => {
                const filteredUsers = users.filter((user) => {
                  if (!searchTerm) return true
                  
                  const searchLower = searchTerm.toLowerCase().trim()
                  
                  // Поиск по фамилии
                  const lastName = user.lastName?.toLowerCase() || ''
                  if (lastName.includes(searchLower)) return true
                  
                  // Поиск по телефону
                  const phone = user.phone?.toLowerCase() || ''
                  if (phone !== '-' && phone.includes(searchLower)) return true
                  
                  // Поиск по названию катера
                  if (user.vessels && user.vessels.length > 0) {
                    const vesselNames = user.vessels
                      .map((vessel) => vessel.name?.toLowerCase() || '')
                      .join(' ')
                    if (vesselNames.includes(searchLower)) return true
                  }
                  
                  return false
                })
                
                // Применяем сортировку к отфильтрованным пользователям
                const sortedUsers = sortUsers(filteredUsers)
                
                if (sortedUsers.length === 0 && users.length > 0) {
                  return (
                    <tr>
                      <td colSpan={9} className="px-6 py-12 text-center">
                        <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">Пользователи по запросу "{searchTerm}" не найдены</p>
                      </td>
                    </tr>
                  )
                }
                
                return sortedUsers.map((user) => (
                <tr 
                  key={user.id} 
                  onClick={() => navigate(`/users/${user.id}`)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      {(() => {
                        const hasAvatar = user.avatar && user.avatar.trim() && (user.avatar.startsWith('data:image') || user.avatar.startsWith('http'))
                        if (hasAvatar) {
                          return (
                            <img
                              src={user.avatar}
                              alt={`${user.firstName} ${user.lastName}`}
                              className="w-8 h-8 rounded-full object-cover border-2 border-gray-300 flex-shrink-0"
                              onError={(e) => {
                                console.error('Ошибка загрузки аватара:', user.avatar?.substring(0, 50))
                                e.currentTarget.style.display = 'none'
                              }}
                            />
                          )
                        }
                        return (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-300 flex-shrink-0">
                            <User className="h-5 w-5 text-gray-400" />
                          </div>
                        )
                      })()}
                      <div className="text-sm font-medium text-gray-900">#{user.id}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {user.firstName} {user.lastName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleColor(user.role)}`}>
                      {getRoleText(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.vessels && user.vessels.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {user.vessels.map((vessel) => (
                          <span
                            key={vessel.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              setSelectedVessel(vessel)
                              setShowVesselModal(true)
                            }}
                            className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800 hover:bg-green-200 cursor-pointer"
                            title={vessel.name}
                          >
                            {vessel.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500">Нет катеров</span>
                    )}
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
                    <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEdit(user)
                        }}
                        className="text-primary-600 hover:text-primary-900"
                        title="Редактировать"
                      >
                        <Edit2 className="h-5 w-5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(user.id)
                        }}
                        disabled={deleting || user.role === UserRole.SUPER_ADMIN || user.id === currentUser?.id}
                        className="text-red-600 hover:text-red-900 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Удалить"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
                ))
              })()}
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
                    <label htmlFor="add-clubs" className="block text-sm font-medium text-gray-700">
                      Яхт-клубы (можно выбрать несколько)
                    </label>
                    <select
                      id="add-clubs"
                      multiple
                      size={5}
                      value={addForm.clubIds.map(String)}
                      onChange={(e) => {
                        const selectedIds = Array.from(e.target.selectedOptions, option => parseInt(option.value))
                        setAddForm({ ...addForm, clubIds: selectedIds })
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

      {/* Модальное окно с информацией о судне */}
      {showVesselModal && selectedVessel && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowVesselModal(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <Ship className="h-6 w-6 text-primary-600 mr-2" />
                    Информация о судне
                  </h3>
                  <button
                    onClick={() => setShowVesselModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Название:</span>
                    <span className="font-semibold text-gray-900">{selectedVessel.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Тип:</span>
                    <span className="font-semibold text-gray-900">{selectedVessel.type}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">Длина:</span>
                    <span className="font-semibold text-gray-900">{selectedVessel.length} м</span>
                  </div>
                  {selectedVessel.width && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Ширина:</span>
                      <span className="font-semibold text-gray-900">{selectedVessel.width} м</span>
                    </div>
                  )}
                  {selectedVessel.heightAboveWaterline && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Высота над ватерлинией:</span>
                      <span className="font-semibold text-gray-900">{selectedVessel.heightAboveWaterline} м</span>
                    </div>
                  )}
                  {selectedVessel.registrationNumber && (
                    <div className="flex justify-between py-2 border-b border-gray-200">
                      <span className="text-gray-600">Регистрационный номер:</span>
                      <span className="font-semibold text-gray-900">{selectedVessel.registrationNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setShowVesselModal(false)
                    navigate(`/vessels/${selectedVessel.id}`)
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Открыть полную информацию
                </button>
                <button
                  type="button"
                  onClick={() => setShowVesselModal(false)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

