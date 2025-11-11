import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { clubsService, bookingsService } from '../services/api'
import { Club, UserRole, Booking } from '../types'
import { Anchor, MapPin, Phone, Mail, Globe, Plus, Trash2, Download, X, EyeOff, Eye, ShieldCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { format } from 'date-fns'
import * as XLSX from 'xlsx'
import { LoadingAnimation } from '../components/LoadingAnimation'

// Компонент для подсчета свободных мест с учетом бронирований
function FreeBerthsCount({ club, user }: { club: Club; user: any }) {
  const [count, setCount] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const calculateFreeBerths = async () => {
      if (!club.berths || !Array.isArray(club.berths) || club.berths.length === 0) {
        setCount(club.totalBerths || 0)
        setLoading(false)
        return
      }

      try {
        let clubBookings: Booking[] = []
        
        // Для гостя, VESSEL_OWNER и PENDING_VALIDATION загружаем бронирования клуба через getByClub
        // (так как у них может не быть своих клубов, и getAll не вернет все бронирования клуба)
        if (user?.role === UserRole.GUEST || user?.role === UserRole.VESSEL_OWNER || user?.role === UserRole.PENDING_VALIDATION || !user) {
          try {
            const response = await bookingsService.getByClub(club.id)
            clubBookings = (response as any)?.data || response || []
            if (!Array.isArray(clubBookings)) {
              clubBookings = []
            }
          } catch (error) {
            console.error(`Ошибка загрузки бронирований для клуба ${club.id}:`, error)
            clubBookings = []
          }
        } else {
          // Для других ролей (CLUB_OWNER, SUPER_ADMIN, ADMIN) используем getAll
          try {
            const response = await bookingsService.getAll({ limit: 1000 })
            const allBookings = (response as any)?.data || response || []
            clubBookings = Array.isArray(allBookings) 
              ? allBookings.filter((b: Booking) => 
                  b.clubId === club.id &&
                  (b.status === 'pending' || b.status === 'confirmed' || b.status === 'active')
                )
              : []
          } catch (error) {
            console.error('Ошибка загрузки бронирований:', error)
            clubBookings = []
          }
        }

        // Подсчитываем свободные места с учетом бронирований
        const availableCount = club.berths.filter((berth: any) => {
          // Проверяем базовую доступность места
          const isAvail = berth.isAvailable
          if (!(isAvail === true || isAvail === 'true' || isAvail === 1 || isAvail === '1')) {
            return false
          }
          
          // Проверяем, есть ли активные бронирования для этого места
          const hasActiveBooking = clubBookings.some((booking: Booking) => 
            booking.berthId === berth.id &&
            (booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'active')
          )
          
          return !hasActiveBooking
        }).length

        setCount(availableCount)
      } catch (error) {
        console.error('Ошибка подсчета свободных мест:', error)
        // В случае ошибки показываем количество мест с isAvailable = true
        const availableCount = club.berths.filter((berth: any) => {
          const isAvail = berth.isAvailable
          return isAvail === true || isAvail === 'true' || isAvail === 1 || isAvail === '1'
        }).length
        setCount(availableCount)
      } finally {
        setLoading(false)
      }
    }

    calculateFreeBerths()
  }, [club, user])

  if (loading) {
    return <span>-</span>
  }

  return <span>{count ?? 0}</span>
}

export default function Clubs() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [deleting, setDeleting] = useState(false)
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
    season: new Date().getFullYear().toString(),
  })

  useEffect(() => {
    loadClubs()
  }, [showHidden])

  const loadClubs = async () => {
    try {
      setLoading(true)
      const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN
      const isClubOwner = user?.role === UserRole.CLUB_OWNER
      const params: any = { limit: 100 }
      if (showHidden && isSuperAdmin) {
        params.showHidden = 'true'
      }
      const response = await clubsService.getAll(params)
      const clubsData = response.data || []
      
      // Бэкенд уже фильтрует клубы для владельца клуба (только его клубы)
      // Для суперадмина с флагом showHidden показываем все, иначе только активные и валидированные
      // Для остальных ролей (VESSEL_OWNER, GUEST и т.д.) всегда показываем только активные и валидированные
      // Для владельца клуба бэкенд уже вернул только его клубы, но для безопасности проверяем еще раз
      let filteredClubs = clubsData
      
      if (showHidden && isSuperAdmin) {
        // Суперадмин видит все клубы
        filteredClubs = clubsData
      } else if (isClubOwner) {
        // Для владельца клуба показываем только его клубы (бэкенд уже отфильтровал, но проверяем для безопасности)
        filteredClubs = clubsData.filter((club: Club) => club.ownerId === user?.id)
      } else {
        // Для остальных - только активные, валидированные и отправленные на валидацию
        filteredClubs = clubsData.filter((club: Club) => 
          club.isActive === true && 
          club.isValidated === true && 
          club.isSubmittedForValidation === true
        )
      }
      
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

  // handleHide удалена, так как кнопка "Скрыть" была удалена
  // Используется только handleUnpublish

  const handleRestore = async (clubId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Подтверждение
    if (!confirm('Вы уверены, что хотите восстановить этот яхт-клуб? Клуб станет активным и будет опубликован.')) return

    setRestoring(true)

    try {
      await clubsService.restore(clubId)
      await loadClubs()
      alert('Яхт-клуб успешно восстановлен и опубликован.')
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

  const handleSubmitForValidation = async (clubId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('Вы уверены, что хотите отправить этот яхт-клуб на проверку? После отправки клуб получит статус "Ожидает валидации" и попадет в меню валидации суперадминистратора.')) return

    try {
      await clubsService.update(clubId, { 
        isSubmittedForValidation: true,
        isValidated: false,
        isActive: true,
        rejectionComment: null // Сбрасываем комментарий об отказе при повторной отправке
      })
      await loadClubs()
      alert('Яхт-клуб успешно отправлен на проверку. Клуб получил статус "Ожидает валидации" и попал в меню валидации суперадминистратора.')
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка отправки яхт-клуба на проверку')
    }
  }

  const handleValidate = async (clubId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('Вы уверены, что хотите валидировать этот яхт-клуб? После валидации клуб будет виден всем пользователям.')) return

    try {
      await clubsService.update(clubId, { isValidated: true })
      await loadClubs()
      alert('Яхт-клуб успешно валидирован')
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка валидации яхт-клуба')
    }
  }

  const handlePublish = async (clubId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('Вы уверены, что хотите опубликовать этот яхт-клуб? Клуб будет виден всем пользователям.')) return

    try {
      await clubsService.update(clubId, { 
        isSubmittedForValidation: true,
        isValidated: true,
        isActive: true,
        rejectionComment: null
      })
      await loadClubs()
      alert('Яхт-клуб успешно опубликован')
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка публикации яхт-клуба')
    }
  }

  const handleUnpublish = async (clubId: number, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    if (!confirm('Вы уверены, что хотите снять этот яхт-клуб с публикации? Клуб станет недоступным для бронирования, попадет в скрытые яхт-клубы. Все связи останутся.')) return

    try {
      // Используем метод hide для скрытия клуба
      await clubsService.hide(clubId)
      await loadClubs()
      alert('Яхт-клуб успешно снят с публикации. Клуб стал недоступным для бронирования и попал в скрытые яхт-клубы. Все связи остались.')
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка снятия с публикации')
    }
  }

  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN
  const isAdmin = user?.role === UserRole.ADMIN
  const isClubOwner = user?.role === UserRole.CLUB_OWNER
  const isPendingValidation = user?.role === UserRole.PENDING_VALIDATION
  const canManageClubs = isSuperAdmin || isAdmin || isClubOwner || isPendingValidation

  const handleOpenAdd = () => {
    // Проверяем роль Guest
    if (user?.role === UserRole.GUEST) {
      alert('Для добавления яхт-клуба необходимо зарегистрироваться. Пожалуйста, зарегистрируйтесь как владелец яхт-клуба.')
      return
    }
    
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
      season: new Date().getFullYear().toString(),
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
      season: new Date().getFullYear().toString(),
    })
    setError('')
  }

  const handleCreate = async () => {
    if (!addForm.name || !addForm.address || !addForm.latitude || !addForm.longitude || !addForm.season) {
      setError('Заполните все обязательные поля: Название, Адрес, Широта, Долгота, Сезон')
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
        season: addForm.season ? parseInt(addForm.season) : null,
      }

      const response = await clubsService.create(createData) as any
      await loadClubs()
      handleCloseAdd()
      // Показываем сообщение о необходимости отправки на валидацию
      alert('Яхт-клуб успешно создан! Клуб виден только вам. Вы можете отправить клуб на проверку суперадминистратору, нажав кнопку "Отправить на проверку". После валидации клуб станет доступен для бронирования.')
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
    return <LoadingAnimation message="Загрузка клубов..." />
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
          <>
            {user?.role === UserRole.PENDING_VALIDATION ? (
              <div className="px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                Ваш аккаунт ожидает валидации суперадминистратором. Вы не можете добавлять клубы до завершения валидации.
              </div>
            ) : (
              <button
                onClick={handleOpenAdd}
                className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                <Plus className="h-5 w-5 mr-2" />
                Добавить клуб
              </button>
            )}
          </>
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
            className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6 flex flex-col h-full ${
              club.isActive === false ? 'opacity-60 border-2 border-gray-300' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center flex-1">
                <Anchor className="h-8 w-8 text-primary-600 mr-3 flex-shrink-0" />
                <div className="flex-1 min-h-[80px]">
                  <h3 className="text-xl font-semibold text-gray-900">
                    {club.name}
                    {club.isActive === false && (
                      <span className="ml-2 text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                        Скрыт
                      </span>
                    )}
                  </h3>
                  {/* Статус публикации отображается только для суперадминистратора, администратора и владельца клуба */}
                  {(isSuperAdmin || isAdmin || (isClubOwner && club.ownerId === user?.id)) && (
                    <div className="mt-2 flex justify-center">
                      {club.rejectionComment && (
                        <span className="text-xs bg-red-600 text-white px-2 py-1 rounded font-semibold whitespace-nowrap inline-block">
                          Отказано в публикации
                        </span>
                      )}
                      {/* Если клуб скрыт, показываем статус "Не опубликован" */}
                      {!club.rejectionComment && club.isActive === false && (
                        <span className="text-xs bg-red-500 text-white px-2 py-1 rounded font-semibold whitespace-nowrap inline-block">
                          Не опубликован
                        </span>
                      )}
                      {!club.rejectionComment && club.isActive !== false && club.isSubmittedForValidation === false && (
                        <span className="text-xs bg-red-500 text-white px-2 py-1 rounded font-semibold whitespace-nowrap inline-block">
                          Не опубликован
                        </span>
                      )}
                      {!club.rejectionComment && club.isActive !== false && club.isSubmittedForValidation === true && club.isValidated === false && (
                        <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-1 rounded font-semibold whitespace-nowrap inline-block">
                          Ожидает валидации
                        </span>
                      )}
                      {!club.rejectionComment && club.isActive !== false && club.isSubmittedForValidation === true && club.isValidated === true && (
                        <span className="text-xs bg-purple-500 text-white px-2 py-1 rounded font-semibold whitespace-nowrap inline-block">
                          Опубликован
                        </span>
                      )}
                    </div>
                  )}
                  {/* Комментарий об отказе для владельца клуба */}
                  {isClubOwner && club.ownerId === user?.id && club.rejectionComment && (
                    <div className="mt-2 ml-6 p-3 bg-red-50 border border-red-200 rounded-md">
                      <p className="text-sm font-semibold text-red-800 mb-1">Комментарий суперадминистратора:</p>
                      <p className="text-sm text-red-700">{club.rejectionComment}</p>
                    </div>
                  )}
                  <div className="mt-2 min-h-[40px] flex items-center justify-center">
                    {club.season ? (
                      <div className="text-xl font-semibold text-white bg-green-500 px-3 py-1 rounded inline-block">
                        Сезон: {club.season}
                      </div>
                    ) : (
                      <div className="min-h-[40px]"></div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex space-x-2">
                {/* Кнопки для суперадминистратора */}
                {isSuperAdmin && (
                  <>
                    {club.isSubmittedForValidation === true && club.isValidated === false && (
                      <button
                        onClick={(e) => handleValidate(club.id, e)}
                        disabled={deleting || restoring}
                        className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded disabled:opacity-50"
                        title="Валидировать клуб"
                      >
                        <ShieldCheck className="h-5 w-5" />
                      </button>
                    )}
                    {(club.isActive === false || !club.isActive) && (
                      <button
                        onClick={(e) => handleRestore(club.id, e)}
                        disabled={restoring || deleting || hiding}
                        className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded disabled:opacity-50"
                        title="Восстановить и опубликовать клуб"
                      >
                        <Eye className="h-5 w-5" />
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
                  </>
                )}
              </div>
            </div>
            <div className="flex-1 flex flex-col">
              {club.description && (
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{club.description}</p>
              )}
              <div className="space-y-2 flex-1">
                <div className="flex items-center text-sm text-gray-600">
                  <MapPin className="h-4 w-4 mr-2 flex-shrink-0" />
                  {club.address}
                </div>
                {club.phone && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                    {club.phone}
                  </div>
                )}
                {club.email && (
                  <div className="flex items-center text-sm text-gray-600">
                    <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
                    {club.email}
                  </div>
                )}
                {club.website && (
                  <div className="flex items-center text-sm text-primary-600">
                    <Globe className="h-4 w-4 mr-2 flex-shrink-0" />
                    {club.website}
                  </div>
                )}
              </div>
              <div className="mt-auto pt-4 border-t border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Всего мест:</span>
                  <span className="font-semibold">{club.totalBerths}</span>
                </div>
                <div className="flex justify-between text-sm mt-2">
                  <span className="text-gray-600">Свободных мест:</span>
                  <span className="font-semibold text-green-600">
                    <FreeBerthsCount club={club} user={user} />
                  </span>
                </div>
                {/* Кнопка "Опубликовать" для владельца клуба, если клуб еще не отправлен или был отклонен */}
                {isClubOwner && club.ownerId === user?.id && (club.isSubmittedForValidation === false || club.rejectionComment) && (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleSubmitForValidation(club.id, e)
                    }}
                    className="mt-3 w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    {club.rejectionComment ? 'Повторно отправить на проверку' : 'Опубликовать'}
                  </button>
                )}
                {/* Кнопка "Опубликовать" для суперадминистратора, если клуб скрыт (снят с публикации) */}
                {isSuperAdmin && club.isActive === false && (club.isSubmittedForValidation === false || club.isValidated === false) && (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handlePublish(club.id, e)
                    }}
                    className="mt-3 w-full flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Опубликовать
                  </button>
                )}
                {/* Кнопка "Снять с публикации" для владельца клуба и суперадминистратора, если клуб опубликован */}
                {(isSuperAdmin || (isClubOwner && club.ownerId === user?.id)) && club.isSubmittedForValidation === true && club.isValidated === true && (
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleUnpublish(club.id, e)
                    }}
                    className="mt-3 w-full flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
                  >
                    <X className="h-4 w-4 mr-2" />
                    Снять с публикации
                  </button>
                )}
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

                  <div>
                    <label htmlFor="add-season" className="block text-sm font-medium text-gray-700">
                      Сезон (год) *
                    </label>
                    <input
                      id="add-season"
                      type="number"
                      required
                      min="2000"
                      max="2100"
                      value={addForm.season}
                      onChange={(e) => setAddForm({ ...addForm, season: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
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

