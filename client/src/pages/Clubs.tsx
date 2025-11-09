import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clubsService } from '../services/api'
import { Club, UserRole } from '../types'
import { Anchor, MapPin, Phone, Mail, Globe, Plus, Trash2, Download, X, EyeOff, Eye } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'

export default function Clubs() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [hiding, setHiding] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [addForm, setAddForm] = useState({
    name: '',
    description: '',
    address: '',
    latitude: '',
    longitude: '',
    phone: '',
    email: '',
    website: '',
    totalBerths: '0',
    minRentalPeriod: '1',
    maxRentalPeriod: '365',
    basePrice: '0',
    minPricePerMonth: '',
  })

  useEffect(() => {
    loadClubs()
  }, [showHidden])

  const loadClubs = async () => {
    try {
      setLoading(true)
      const params: any = { limit: 100 }
      if (showHidden && isSuperAdmin) {
        params.showHidden = 'true'
      }
      const response = await clubsService.getAll(params)
      const clubsData = response.data || []
      
      // Для суперадмина с флагом showHidden показываем все, иначе только активные
      // Для остальных ролей (VESSEL_OWNER, GUEST и т.д.) всегда показываем только активные
      const filteredClubs = showHidden && isSuperAdmin 
        ? clubsData 
        : clubsData.filter((club: Club) => club.isActive === true)
      
      setClubs(filteredClubs)
    } catch (error) {
      console.error('Ошибка загрузки клубов:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredClubs = clubs.filter((club) =>
    club.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    club.address.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleHide = async (clubId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Подтверждение
    if (!confirm('Вы уверены, что хотите скрыть этот яхт-клуб? Клуб станет неактивным, все связи с пользователями будут оборваны.')) return

    setHiding(true)

    try {
      await clubsService.hide(clubId)
      await loadClubs()
      alert('Яхт-клуб успешно скрыт. Все связи оборваны.')
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка скрытия яхт-клуба')
    } finally {
      setHiding(false)
    }
  }

  const handleRestore = async (clubId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Подтверждение
    if (!confirm('Вы уверены, что хотите восстановить этот яхт-клуб? Клуб станет активным.')) return

    setRestoring(true)

    try {
      await clubsService.restore(clubId)
      await loadClubs()
      alert('Яхт-клуб успешно восстановлен.')
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка восстановления яхт-клуба')
    } finally {
      setRestoring(false)
    }
  }

  const handleDelete = async (clubId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Первое подтверждение
    if (!confirm('Вы уверены, что хотите удалить этот яхт-клуб?')) return

    // Второе подтверждение
    if (!confirm('ВНИМАНИЕ! Это действие необратимо. Данные будут удалены из базы данных. Продолжить?')) return

    setDeleting(true)

    try {
      await clubsService.delete(clubId)
      await loadClubs()
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка удаления яхт-клуба')
    } finally {
      setDeleting(false)
    }
  }

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN
  const isAdmin = user?.role === UserRole.ADMIN
  const isClubOwner = user?.role === UserRole.CLUB_OWNER
  const canManageClubs = isSuperAdmin || isAdmin || isClubOwner

  const handleOpenAdd = () => {
    setShowAddModal(true)
    setAddForm({
      name: '',
      description: '',
      address: '',
      latitude: '',
      longitude: '',
      phone: '',
      email: '',
      website: '',
      totalBerths: '0',
      minRentalPeriod: '1',
      maxRentalPeriod: '365',
      basePrice: '0',
      minPricePerMonth: '',
    })
    setError('')
  }

  const handleCloseAdd = () => {
    setShowAddModal(false)
    setAddForm({
      name: '',
      description: '',
      address: '',
      latitude: '',
      longitude: '',
      phone: '',
      email: '',
      website: '',
      totalBerths: '0',
      minRentalPeriod: '1',
      maxRentalPeriod: '365',
      basePrice: '0',
      minPricePerMonth: '',
    })
    setError('')
  }

  const handleCreate = async () => {
    if (!addForm.name || !addForm.address || !addForm.latitude || !addForm.longitude) {
      setError('Заполните все обязательные поля: Название, Адрес, Широта, Долгота')
      return
    }

    setError('')
    setCreating(true)

    try {
      const createData: any = {
        name: addForm.name,
        description: addForm.description || null,
        address: addForm.address,
        latitude: parseFloat(addForm.latitude),
        longitude: parseFloat(addForm.longitude),
        phone: addForm.phone || null,
        email: addForm.email || null,
        website: addForm.website || null,
        totalBerths: parseInt(addForm.totalBerths) || 0,
        minRentalPeriod: parseInt(addForm.minRentalPeriod) || 1,
        maxRentalPeriod: parseInt(addForm.maxRentalPeriod) || 365,
        basePrice: parseFloat(addForm.basePrice) || 0,
        minPricePerMonth: addForm.minPricePerMonth ? parseFloat(addForm.minPricePerMonth) : null,
      }

      const response = await clubsService.create(createData) as any
      await loadClubs()
      handleCloseAdd()
      // Перенаправляем на страницу деталей созданного клуба
      if (response && response.club && response.club.id) {
        navigate(`/clubs/${response.club.id}`)
      } else if (response && response.id) {
        navigate(`/clubs/${response.id}`)
      }
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка создания яхт-клуба')
    } finally {
      setCreating(false)
    }
  }

  const exportToExcel = async () => {
    try {
      // Загружаем все яхт-клубы для экспорта
      const response = await clubsService.getAll({ limit: 10000 })
      const allClubs = response.data || []

      // Подготавливаем данные для Excel
      const excelData = allClubs.map((club: Club) => {
        return {
          'ID': club.id,
          'Название': club.name || '',
          'Описание': club.description || '-',
          'Адрес': club.address || '',
          'Широта': club.latitude || 0,
          'Долгота': club.longitude || 0,
          'Телефон': club.phone || '-',
          'Email': club.email || '-',
          'Веб-сайт': club.website || '-',
          'Всего мест': club.totalBerths || 0,
          'Мин. период аренды (дней)': club.minRentalPeriod || 0,
          'Макс. период аренды (дней)': club.maxRentalPeriod || 0,
          'Базовая цена за день (₽)': club.basePrice || 0,
          'Мин. цена за месяц (₽)': club.minPricePerMonth || '-',
          'Активен': club.isActive ? 'Да' : 'Нет',
          'Владелец (Имя)': club.owner?.firstName || '-',
          'Владелец (Фамилия)': club.owner?.lastName || '-',
          'Email владельца': club.owner?.email || '-',
          'Телефон владельца': club.owner?.phone || '-',
          'Дата создания': club.createdAt ? format(new Date(club.createdAt), 'dd.MM.yyyy HH:mm') : '-',
          'Дата обновления': club.updatedAt ? format(new Date(club.updatedAt), 'dd.MM.yyyy HH:mm') : '-',
        }
      })

      // Создаем рабочую книгу Excel
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Яхт-клубы')

      // Настраиваем ширину столбцов
      const columnWidths = [
        { wch: 8 },  // ID
        { wch: 25 }, // Название
        { wch: 40 }, // Описание
        { wch: 30 }, // Адрес
        { wch: 12 }, // Широта
        { wch: 12 }, // Долгота
        { wch: 15 }, // Телефон
        { wch: 25 }, // Email
        { wch: 25 }, // Веб-сайт
        { wch: 12 }, // Всего мест
        { wch: 20 }, // Мин. период аренды
        { wch: 20 }, // Макс. период аренды
        { wch: 20 }, // Базовая цена за день
        { wch: 20 }, // Мин. цена за месяц
        { wch: 10 }, // Активен
        { wch: 15 }, // Владелец (Имя)
        { wch: 15 }, // Владелец (Фамилия)
        { wch: 25 }, // Email владельца
        { wch: 18 }, // Телефон владельца
        { wch: 20 }, // Дата создания
        { wch: 20 }, // Дата обновления
      ]
      worksheet['!cols'] = columnWidths

      // Генерируем имя файла с текущей датой
      const fileName = `Яхт-клубы_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}.xlsx`

      // Сохраняем файл
      XLSX.writeFile(workbook, fileName)
    } catch (error: any) {
      console.error('Ошибка экспорта в Excel:', error)
      alert('Ошибка экспорта данных в Excel')
    }
  }

  if (loading) {
    return <div className="text-center py-12">Загрузка...</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Яхт-клубы</h1>
          <p className="mt-2 text-gray-600">Управление яхт-клубами</p>
        </div>
        {isSuperAdmin && (
          <div className="flex gap-3">
            <button
              onClick={() => setShowHidden(!showHidden)}
              className={`flex items-center px-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                showHidden
                  ? 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 focus:ring-gray-400'
              }`}
            >
              {showHidden ? <Eye className="h-5 w-5 mr-2" /> : <EyeOff className="h-5 w-5 mr-2" />}
              {showHidden ? 'Скрыть скрытые' : 'Показать скрытые'}
            </button>
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
              Добавить клуб
            </button>
          </div>
        )}
        {canManageClubs && !isSuperAdmin && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Plus className="h-5 w-5 mr-2" />
            Добавить клуб
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-4">
        <input
          type="text"
          placeholder="Поиск по названию или адресу..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredClubs.map((club) => (
          <Link
            key={club.id}
            to={`/clubs/${club.id}`}
            className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 ${
              club.isActive === false ? 'opacity-60 border-2 border-gray-300' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center">
                <Anchor className="h-8 w-8 text-primary-600 mr-3" />
                <h3 className="text-xl font-semibold text-gray-900">
                  {club.name}
                  {club.isActive === false && (
                    <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                      Скрыт
                    </span>
                  )}
                </h3>
              </div>
              {isSuperAdmin && (
                <div className="flex space-x-2">
                  {club.isActive === false ? (
                    <button
                      onClick={(e) => handleRestore(club.id, e)}
                      disabled={restoring || deleting || hiding}
                      className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded disabled:opacity-50"
                      title="Восстановить клуб"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                  ) : (
                    <button
                      onClick={(e) => handleHide(club.id, e)}
                      disabled={hiding || deleting || restoring}
                      className="p-1 text-orange-600 hover:text-orange-700 hover:bg-orange-50 rounded disabled:opacity-50"
                      title="Скрыть клуб"
                    >
                      <EyeOff className="h-5 w-5" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDelete(club.id, e)}
                    disabled={deleting || hiding || restoring}
                    className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                    title="Удалить"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              )}
            </div>
            {club.description && (
              <p className="text-gray-600 text-sm mb-4 line-clamp-2">{club.description}</p>
            )}
            <div className="space-y-2">
              <div className="flex items-center text-sm text-gray-600">
                <MapPin className="h-4 w-4 mr-2" />
                {club.address}
              </div>
              {club.phone && (
                <div className="flex items-center text-sm text-gray-600">
                  <Phone className="h-4 w-4 mr-2" />
                  {club.phone}
                </div>
              )}
              {club.email && (
                <div className="flex items-center text-sm text-gray-600">
                  <Mail className="h-4 w-4 mr-2" />
                  {club.email}
                </div>
              )}
              {club.website && (
                <div className="flex items-center text-sm text-primary-600">
                  <Globe className="h-4 w-4 mr-2" />
                  {club.website}
                </div>
              )}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Всего мест:</span>
                <span className="font-semibold">{club.totalBerths}</span>
              </div>
              <div className="flex justify-between text-sm mt-2">
                <span className="text-gray-600">Свободных мест:</span>
                <span className="font-semibold text-green-600">
                  {(() => {
                    // Проверяем, загружены ли места
                    if (!club.berths || !Array.isArray(club.berths) || club.berths.length === 0) {
                      // Если места не загружены, показываем общее количество (предполагаем, что все свободны)
                      return club.totalBerths || 0
                    }
                    // Подсчитываем свободные места
                    // Проверяем isAvailable как boolean, string или number
                    const availableCount = club.berths.filter((berth: any) => {
                      const isAvail = berth.isAvailable
                      // Проверяем разные варианты значения isAvailable
                      // true, 'true', 1, '1' - все считаются свободными
                      if (isAvail === true || isAvail === 'true' || isAvail === 1 || isAvail === '1') {
                        return true
                      }
                      // false, 'false', 0, '0' - занятые
                      return false
                    }).length
                    return availableCount
                  })()}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filteredClubs.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Anchor className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Клубы не найдены</p>
        </div>
      )}

      {/* Модальное окно создания клуба */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={handleCloseAdd} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Создать новый яхт-клуб</h3>
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

                <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                  <div>
                    <label htmlFor="add-name" className="block text-sm font-medium text-gray-700">
                      Название *
                    </label>
                    <input
                      id="add-name"
                      type="text"
                      required
                      value={addForm.name}
                      onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="add-description" className="block text-sm font-medium text-gray-700">
                      Описание
                    </label>
                    <textarea
                      id="add-description"
                      rows={3}
                      value={addForm.description}
                      onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="add-address" className="block text-sm font-medium text-gray-700">
                      Адрес *
                    </label>
                    <input
                      id="add-address"
                      type="text"
                      required
                      value={addForm.address}
                      onChange={(e) => setAddForm({ ...addForm, address: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="add-latitude" className="block text-sm font-medium text-gray-700">
                        Широта *
                      </label>
                      <input
                        id="add-latitude"
                        type="number"
                        step="any"
                        required
                        value={addForm.latitude}
                        onChange={(e) => setAddForm({ ...addForm, latitude: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="add-longitude" className="block text-sm font-medium text-gray-700">
                        Долгота *
                      </label>
                      <input
                        id="add-longitude"
                        type="number"
                        step="any"
                        required
                        value={addForm.longitude}
                        onChange={(e) => setAddForm({ ...addForm, longitude: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
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
                      <label htmlFor="add-email" className="block text-sm font-medium text-gray-700">
                        Email
                      </label>
                      <input
                        id="add-email"
                        type="email"
                        value={addForm.email}
                        onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="add-website" className="block text-sm font-medium text-gray-700">
                      Веб-сайт
                    </label>
                    <input
                      id="add-website"
                      type="url"
                      value={addForm.website}
                      onChange={(e) => setAddForm({ ...addForm, website: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="add-totalBerths" className="block text-sm font-medium text-gray-700">
                        Всего мест
                      </label>
                      <input
                        id="add-totalBerths"
                        type="number"
                        min="0"
                        value={addForm.totalBerths}
                        onChange={(e) => setAddForm({ ...addForm, totalBerths: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="add-basePrice" className="block text-sm font-medium text-gray-700">
                        Базовая цена за день (₽)
                      </label>
                      <input
                        id="add-basePrice"
                        type="number"
                        min="0"
                        step="0.01"
                        value={addForm.basePrice}
                        onChange={(e) => setAddForm({ ...addForm, basePrice: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="add-minRentalPeriod" className="block text-sm font-medium text-gray-700">
                        Мин. период аренды (дней)
                      </label>
                      <input
                        id="add-minRentalPeriod"
                        type="number"
                        min="1"
                        value={addForm.minRentalPeriod}
                        onChange={(e) => setAddForm({ ...addForm, minRentalPeriod: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="add-maxRentalPeriod" className="block text-sm font-medium text-gray-700">
                        Макс. период аренды (дней)
                      </label>
                      <input
                        id="add-maxRentalPeriod"
                        type="number"
                        min="1"
                        value={addForm.maxRentalPeriod}
                        onChange={(e) => setAddForm({ ...addForm, maxRentalPeriod: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="add-minPricePerMonth" className="block text-sm font-medium text-gray-700">
                      Мин. цена за месяц (₽)
                    </label>
                    <input
                      id="add-minPricePerMonth"
                      type="number"
                      min="0"
                      step="0.01"
                      value={addForm.minPricePerMonth}
                      onChange={(e) => setAddForm({ ...addForm, minPricePerMonth: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
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
    </div>
  )
}

