import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { clubsService, berthsService, vesselsService, bookingsService, bookingRulesService } from '../services/api'
import { Club, Berth, Vessel } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { UserRole } from '../types'
import { MapPin, Phone, Mail, Globe, Anchor, Edit2, X, Plus, Trash2, Calendar, UserPlus, ShieldCheck } from 'lucide-react'
import { LoadingAnimation } from '../components/LoadingAnimation'

export default function ClubDetails() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [club, setClub] = useState<Club | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    address: '',
    latitude: '',
    longitude: '',
    phone: '',
    email: '',
    website: '',
    minRentalPeriod: '',
    maxRentalPeriod: '',
    basePrice: '',
    minPricePerMonth: '',
    season: '',
    rentalMonths: [] as number[],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showAddBerthModal, setShowAddBerthModal] = useState(false)
  const [showEditBerthModal, setShowEditBerthModal] = useState(false)
  const [selectedBerth, setSelectedBerth] = useState<Berth | null>(null)
  const [berthForm, setBerthForm] = useState({
    mode: 'single' as 'single' | 'multiple', // Режим: одно место или несколько
    number: '', // Номер для одного места
    length: '',
    width: '',
    notes: '',
    count: '1', // Количество мест для создания нескольких
  })
  const [savingBerth, setSavingBerth] = useState(false)
  const [deletingBerth, setDeletingBerth] = useState(false)
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [availableBerths, setAvailableBerths] = useState<Berth[]>([])
  const [userVessels, setUserVessels] = useState<Vessel[]>([])
  const [bookingForm, setBookingForm] = useState({
    berthId: '',
    vesselId: '',
    autoRenewal: false,
    tariffId: '',
  })
  const [creatingBooking, setCreatingBooking] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [berthBookings, setBerthBookings] = useState<Map<number, any[]>>(new Map())
  const [bookingRules, setBookingRules] = useState<any[]>([])

  useEffect(() => {
    if (id) {
      loadClub()
    }
  }, [id])

  useEffect(() => {
    if (club && club.berths) {
      loadBerthBookings()
    }
  }, [club])

  useEffect(() => {
    // Загружаем суда пользователя, если он судовладелец
    if (user?.role === UserRole.VESSEL_OWNER && user.id) {
      loadUserVessels()
    }
  }, [user])

  const loadUserVessels = async () => {
    try {
      const response = await vesselsService.getAll({ limit: 100 })
      const vessels = response.data || []
      // Фильтруем только суда текущего пользователя
      const userVesselsList = vessels.filter((vessel: Vessel) => vessel.ownerId === user?.id)
      setUserVessels(userVesselsList)
    } catch (error) {
      console.error('Ошибка загрузки судов:', error)
    }
  }

  const loadAvailableBerths = async () => {
    if (!id) return
    
    try {
      const response = await berthsService.getAvailableByClub(parseInt(id))
      setAvailableBerths((response as any).data || response || [])
    } catch (error) {
      console.error('Ошибка загрузки доступных мест:', error)
      setAvailableBerths([])
    }
  }

  const loadBerthBookings = async () => {
    if (!club || !club.berths) return
    
    try {
      // Для гостя, VESSEL_OWNER и PENDING_VALIDATION используем специальный endpoint для получения бронирований клуба
      // (так как у них может не быть своих клубов, и getAll не вернет все бронирования клуба)
      // Для других ролей (CLUB_OWNER, SUPER_ADMIN, ADMIN) используем getAll
      let allBookings: any[] = []
      
      if (user?.role === UserRole.GUEST || user?.role === UserRole.VESSEL_OWNER || user?.role === UserRole.PENDING_VALIDATION || !user) {
        try {
          const response = await bookingsService.getByClub(club.id)
          allBookings = (response as any)?.data || response || []
        } catch (error) {
          // Если не удалось загрузить через getByClub, пробуем getAll
          try {
            const response = await bookingsService.getAll({ limit: 1000 })
            allBookings = (response as any)?.data || response || []
          } catch (getAllError) {
            console.error('Ошибка загрузки бронирований:', getAllError)
            allBookings = []
          }
        }
      } else {
        try {
          const response = await bookingsService.getAll({ limit: 1000 })
          allBookings = (response as any)?.data || response || []
        } catch (error) {
          console.error('Ошибка загрузки бронирований:', error)
          allBookings = []
        }
      }
      
      // Фильтруем бронирования для мест этого клуба
      const bookingsMap = new Map<number, any[]>()
      
      club.berths.forEach((berth) => {
        const berthBookings = allBookings.filter((booking: any) => 
          booking.berthId === berth.id && 
          booking.clubId === club.id &&
          (booking.status === 'pending' || booking.status === 'confirmed' || booking.status === 'active')
        )
        if (berthBookings.length > 0) {
          bookingsMap.set(berth.id, berthBookings)
        }
      })
      
      setBerthBookings(bookingsMap)
    } catch (error) {
      console.error('Ошибка загрузки бронирований мест:', error)
    }
  }

  const getBerthStatus = (berth: Berth) => {
    const bookings = berthBookings.get(berth.id)
    if (!bookings || bookings.length === 0) {
      return { status: 'available', text: 'Доступен', color: 'text-green-600' }
    }
    
    // Проверяем статусы бронирований
    const hasPending = bookings.some((b: any) => b.status === 'pending')
    const hasConfirmed = bookings.some((b: any) => b.status === 'confirmed')
    const hasActive = bookings.some((b: any) => b.status === 'active')
    
    if (hasActive) {
      return { status: 'booked', text: 'Забронировано', color: 'text-red-600' }
    }
    if (hasConfirmed) {
      return { status: 'booked', text: 'Забронировано', color: 'text-red-600' }
    }
    if (hasPending) {
      return { status: 'pending', text: 'Ожидает', color: 'text-yellow-600' }
    }
    
    return { status: 'available', text: 'Доступен', color: 'text-green-600' }
  }

  const isBerthBookable = (berth: Berth) => {
    // Для PENDING_VALIDATION показываем все места, но только доступные можно бронировать
    if (!berth.isAvailable) return false
    const berthStatus = getBerthStatus(berth)
    return berthStatus.status === 'available'
  }
  
  // Для всех ролей (кроме гостя, который фильтруется на backend) показываем все места
  // PENDING_VALIDATION должен видеть все места, включая занятые

  const handleOpenBookingModalForBerth = (berth: Berth) => {
    setShowBookingModal(true)
    setBookingForm({
      berthId: berth.id.toString(),
      vesselId: userVessels.length > 0 ? userVessels[0].id.toString() : '',
      autoRenewal: false,
      tariffId: '',
    })
    // Загружаем доступные места без дат
    loadAvailableBerths()
    // Загружаем правила для клуба
    if (club) {
      loadBookingRules(club.id)
    }
  }

  const loadBookingRules = async (clubId: number) => {
    try {
      const response = await bookingRulesService.getByClub(clubId)
      const rulesData = Array.isArray(response) ? response : (response?.data || [])
      setBookingRules(rulesData)
    } catch (err: any) {
      console.error('Ошибка загрузки правил:', err)
      setBookingRules([])
    }
  }

  const handleCloseBookingModal = () => {
    setShowBookingModal(false)
    setBookingForm({
      berthId: '',
      vesselId: '',
      autoRenewal: false,
      tariffId: '',
    })
    setAvailableBerths([])
    setBookingRules([])
  }

  const handleCreateBooking = async () => {
    if (!club || !bookingForm.berthId || !bookingForm.vesselId) {
      setError('Заполните все обязательные поля')
      return
    }

    // Проверяем, есть ли тарифы для места, и если есть, то тариф должен быть выбран
    const berthFromClub = club.berths?.find(b => b.id.toString() === bookingForm.berthId)
    const availableTariffs = berthFromClub?.tariffBerths?.filter(tb => tb.tariff) || []
    if (availableTariffs.length > 0 && !bookingForm.tariffId) {
      setError('Выберите тариф для оплаты бронирования')
      return
    }

    setError('')
    setCreatingBooking(true)

    try {
      await bookingsService.create({
        clubId: club.id,
        berthId: parseInt(bookingForm.berthId),
        vesselId: parseInt(bookingForm.vesselId),
        autoRenewal: bookingForm.autoRenewal,
        tariffId: bookingForm.tariffId ? parseInt(bookingForm.tariffId) : null,
      })

      await loadClub()
      await loadBerthBookings()
      handleCloseBookingModal()
      alert('Бронирование успешно создано!')
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка создания бронирования')
    } finally {
      setCreatingBooking(false)
    }
  }

  const loadClub = async () => {
    try {
      const data = (await clubsService.getById(parseInt(id!))) as unknown as Club
      setClub(data)
      if (data) {
        setEditForm({
          name: data.name,
          description: data.description || '',
          address: data.address,
          latitude: data.latitude.toString(),
          longitude: data.longitude.toString(),
          phone: data.phone || '',
          email: data.email || '',
          website: data.website || '',
          minRentalPeriod: data.minRentalPeriod.toString(),
          maxRentalPeriod: data.maxRentalPeriod.toString(),
          basePrice: data.basePrice.toString(),
          minPricePerMonth: data.minPricePerMonth?.toString() || '',
          season: data.season?.toString() || new Date().getFullYear().toString(),
          rentalMonths: data.rentalMonths || [],
        })

        // Для гостя места уже загружены в getById (включая забронированные)
        // Места загружаются с isAvailable = true, но могут иметь активные бронирования
      }
    } catch (error) {
      console.error('Ошибка загрузки клуба:', error)
    } finally {
      setLoading(false)
    }
  }

  const canEdit = () => {
    if (!user || !club) return false
    return (
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.CLUB_OWNER && club.ownerId === user.id)
    )
  }

  const canManageBerths = () => {
    if (!user || !club) return false
    return (
      user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.CLUB_OWNER && club.ownerId === user.id)
    )
  }

  const handleSubmitForValidation = async () => {
    if (!club) return
    
    if (!confirm('Вы уверены, что хотите отправить этот яхт-клуб на проверку? После отправки клуб будет доступен для валидации суперадминистратором.')) {
      return
    }

    try {
      await clubsService.update(club.id, { isSubmittedForValidation: true })
      await loadClub()
      alert('Яхт-клуб успешно отправлен на проверку. После валидации суперадминистратором клуб станет доступен для бронирования.')
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка отправки яхт-клуба на проверку')
    }
  }

  const handleOpenAddBerth = () => {
    setBerthForm({
      mode: 'single',
      number: '',
      length: '20',
      width: '5',
      notes: '',
      count: '1',
    })
    setShowAddBerthModal(true)
  }

  const handleOpenEditBerth = (berth: Berth) => {
    setSelectedBerth(berth)
    setBerthForm({
      number: berth.number || '',
      length: berth.length.toString(),
      width: berth.width.toString(),
      pricePerDay: berth.pricePerDay?.toString() || '',
      notes: berth.notes || '',
    })
    setShowEditBerthModal(true)
  }

  const handleCloseBerthModal = () => {
    setShowAddBerthModal(false)
    setShowEditBerthModal(false)
    setSelectedBerth(null)
    setBerthForm({
      mode: 'single',
      number: '',
      length: '',
      width: '',
      notes: '',
      count: '1',
    })
  }

  const handleCreateBerth = async () => {
    if (!club) return

    setSavingBerth(true)
    setError('')

    try {
      const length = parseFloat(berthForm.length)
      const width = parseFloat(berthForm.width)
      const notes = berthForm.notes || null

      if (berthForm.mode === 'single') {
        // Создаем одно место с указанным номером
        if (!berthForm.number.trim()) {
          setError('Укажите номер места')
          setSavingBerth(false)
          return
        }

        await berthsService.create({
          clubId: club.id,
          number: berthForm.number.trim(),
          length: length,
          width: width,
          notes: notes,
        })

        await loadClub()
        handleCloseBerthModal()
        alert('Место успешно создано')
      } else {
        // Создаем несколько мест с автонумерацией
        const count = parseInt(berthForm.count) || 1
        if (count < 1) {
          setError('Количество мест должно быть больше 0')
          setSavingBerth(false)
          return
        }

        // Находим последний номер места
        const existingBerths = club.berths || []
        let lastNumber = 0
        
        // Пытаемся найти максимальный числовой номер
        for (const berth of existingBerths) {
          const num = parseInt(berth.number)
          if (!isNaN(num) && num > lastNumber) {
            lastNumber = num
          }
        }

        // Создаем места начиная с последнего номера + 1
        // В названии всегда добавляем слово "Место"
        for (let i = 1; i <= count; i++) {
          await berthsService.create({
            clubId: club.id,
            number: `Место ${lastNumber + i}`,
            length: length,
            width: width,
            notes: notes,
          })
        }

        await loadClub()
        handleCloseBerthModal()
        alert(`Успешно создано ${count} ${count === 1 ? 'место' : count < 5 ? 'места' : 'мест'} с номерами от ${lastNumber + 1} до ${lastNumber + count}`)
      }
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка создания места')
    } finally {
      setSavingBerth(false)
    }
  }

  const handleUpdateBerth = async () => {
    if (!selectedBerth) return

    setSavingBerth(true)
    setError('')

    try {
      await berthsService.update(selectedBerth.id, {
        number: berthForm.number,
        length: parseFloat(berthForm.length),
        width: parseFloat(berthForm.width),
        pricePerDay: berthForm.pricePerDay ? parseFloat(berthForm.pricePerDay) : null,
        notes: berthForm.notes || null,
      })

      await loadClub()
      handleCloseBerthModal()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка обновления места')
    } finally {
      setSavingBerth(false)
    }
  }

  const handleDeleteBerth = async (berthId: number) => {
    if (!confirm('Вы уверены, что хотите удалить это место?')) return

    setDeletingBerth(true)
    setError('')

    try {
      await berthsService.delete(berthId)
      await loadClub()
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка удаления места')
    } finally {
      setDeletingBerth(false)
    }
  }

  const handleSave = async () => {
    if (!club) return

    if (!editForm.season) {
      setError('Поле "Сезон" обязательно для заполнения')
      return
    }

    setError('')
    setSaving(true)

    try {
      const updateData = {
        name: editForm.name,
        description: editForm.description || null,
        address: editForm.address,
        latitude: parseFloat(editForm.latitude),
        longitude: parseFloat(editForm.longitude),
        phone: editForm.phone || null,
        email: editForm.email || null,
        website: editForm.website || null,
        minRentalPeriod: parseInt(editForm.minRentalPeriod),
        maxRentalPeriod: parseInt(editForm.maxRentalPeriod),
        basePrice: parseFloat(editForm.basePrice),
        minPricePerMonth: editForm.minPricePerMonth ? parseFloat(editForm.minPricePerMonth) : null,
        season: parseInt(editForm.season),
        rentalMonths: editForm.rentalMonths.length > 0 ? editForm.rentalMonths : null,
      }

      await clubsService.update(club.id, updateData)
      await loadClub()
      setEditing(false)
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка обновления клуба')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingAnimation message="Загрузка деталей клуба..." />
  }

  if (!club) {
    return <div className="text-center py-12">Клуб не найден</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{club.name}</h1>
          {club.description && <p className="mt-2 text-gray-600">{club.description}</p>}
        </div>
        <div className="flex items-center space-x-2">
          {canEdit() && (
            <button
              onClick={() => setEditing(!editing)}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Edit2 className="h-5 w-5 mr-2" />
              {editing ? 'Отмена' : 'Редактировать'}
            </button>
          )}
          {/* Кнопка "Отправить на проверку" для владельца клуба, если клуб еще не отправлен */}
          {user?.role === UserRole.CLUB_OWNER && club.ownerId === user.id && club.isSubmittedForValidation === false && (
            <button
              onClick={handleSubmitForValidation}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <ShieldCheck className="h-5 w-5 mr-2" />
              Отправить на проверку
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {editing ? (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Редактирование яхт-клуба</h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label htmlFor="edit-name" className="block text-sm font-medium text-gray-700">
                  Название *
                </label>
                <input
                  id="edit-name"
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-address" className="block text-sm font-medium text-gray-700">
                  Адрес *
                </label>
                <input
                  id="edit-address"
                  type="text"
                  required
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-latitude" className="block text-sm font-medium text-gray-700">
                  Широта *
                </label>
                <input
                  id="edit-latitude"
                  type="number"
                  step="any"
                  required
                  value={editForm.latitude}
                  onChange={(e) => setEditForm({ ...editForm, latitude: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-longitude" className="block text-sm font-medium text-gray-700">
                  Долгота *
                </label>
                <input
                  id="edit-longitude"
                  type="number"
                  step="any"
                  required
                  value={editForm.longitude}
                  onChange={(e) => setEditForm({ ...editForm, longitude: e.target.value })}
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
                <label htmlFor="edit-email" className="block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  id="edit-email"
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-website" className="block text-sm font-medium text-gray-700">
                  Веб-сайт
                </label>
                <input
                  id="edit-website"
                  type="url"
                  value={editForm.website}
                  onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-basePrice" className="block text-sm font-medium text-gray-700">
                  Базовая цена за день *
                </label>
                <input
                  id="edit-basePrice"
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={editForm.basePrice}
                  onChange={(e) => setEditForm({ ...editForm, basePrice: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-minPricePerMonth" className="block text-sm font-medium text-gray-700">
                  Минимальная цена за месяц
                </label>
                <input
                  id="edit-minPricePerMonth"
                  type="number"
                  min="0"
                  step="0.01"
                  value={editForm.minPricePerMonth}
                  onChange={(e) => setEditForm({ ...editForm, minPricePerMonth: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-minRentalPeriod" className="block text-sm font-medium text-gray-700">
                  Минимальный период аренды (дней) *
                </label>
                <input
                  id="edit-minRentalPeriod"
                  type="number"
                  required
                  min="1"
                  value={editForm.minRentalPeriod}
                  onChange={(e) => setEditForm({ ...editForm, minRentalPeriod: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              <div>
                <label htmlFor="edit-maxRentalPeriod" className="block text-sm font-medium text-gray-700">
                  Максимальный период аренды (дней) *
                </label>
                <input
                  id="edit-maxRentalPeriod"
                  type="number"
                  required
                  min="1"
                  value={editForm.maxRentalPeriod}
                  onChange={(e) => setEditForm({ ...editForm, maxRentalPeriod: e.target.value })}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="edit-season" className="block text-sm font-medium text-gray-700">
                Сезон (год) *
              </label>
              <input
                id="edit-season"
                type="number"
                required
                min="2000"
                max="2100"
                value={editForm.season}
                onChange={(e) => setEditForm({ ...editForm, season: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
              />
            </div>

            {/* Выбор месяцев аренды */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Период навигации
              </label>
              <div className="grid grid-cols-3 gap-2 border border-gray-300 rounded-md p-4">
                {[
                  { value: 1, name: 'Январь' },
                  { value: 2, name: 'Февраль' },
                  { value: 3, name: 'Март' },
                  { value: 4, name: 'Апрель' },
                  { value: 5, name: 'Май' },
                  { value: 6, name: 'Июнь' },
                  { value: 7, name: 'Июль' },
                  { value: 8, name: 'Август' },
                  { value: 9, name: 'Сентябрь' },
                  { value: 10, name: 'Октябрь' },
                  { value: 11, name: 'Ноябрь' },
                  { value: 12, name: 'Декабрь' },
                ].map((month) => (
                  <label
                    key={month.value}
                    className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={editForm.rentalMonths.includes(month.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditForm({
                            ...editForm,
                            rentalMonths: [...editForm.rentalMonths, month.value].sort((a, b) => a - b),
                          })
                        } else {
                          setEditForm({
                            ...editForm,
                            rentalMonths: editForm.rentalMonths.filter((m) => m !== month.value),
                          })
                        }
                      }}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-900">{month.name}</span>
                  </label>
                ))}
              </div>
              {editForm.rentalMonths.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  Выбрано месяцев: {editForm.rentalMonths.length} из 12
                </p>
              )}
            </div>

            <div>
              <label htmlFor="edit-description" className="block text-sm font-medium text-gray-700">
                Описание
              </label>
              <textarea
                id="edit-description"
                rows={4}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setError('')
                  if (club) {
                    setEditForm({
                      name: club.name,
                      description: club.description || '',
                      address: club.address,
                      latitude: club.latitude.toString(),
                      longitude: club.longitude.toString(),
                      phone: club.phone || '',
                      email: club.email || '',
                      website: club.website || '',
                      minRentalPeriod: club.minRentalPeriod.toString(),
                      maxRentalPeriod: club.maxRentalPeriod.toString(),
                      basePrice: club.basePrice.toString(),
                      minPricePerMonth: club.minPricePerMonth?.toString() || '',
                      season: club.season?.toString() || new Date().getFullYear().toString(),
                      rentalMonths: club.rentalMonths || [],
                    })
                  }
                }}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      ) : (
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
                <span className="text-gray-600">Всего мест:</span>
                <span className="font-semibold">{club.totalBerths}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Базовая цена за день:</span>
                <span className="font-semibold text-primary-600">
                  {club.basePrice.toLocaleString()} ₽
                </span>
              </div>
              {club.minPricePerMonth && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Минимальная цена за месяц:</span>
                  <span className="font-semibold text-primary-600">
                    {club.minPricePerMonth.toLocaleString()} ₽
                  </span>
                </div>
              )}
              {(() => {
                const formatNavigationPeriod = (months: number[] | null | undefined, season: number | null | undefined): string => {
                  if (!months || months.length === 0) {
                    return 'Не указан'
                  }

                  const monthNames = [
                    'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
                  ]

                  // Сортируем месяцы
                  const sortedMonths = [...months].sort((a, b) => a - b)

                  // Проверяем, идут ли месяцы подряд
                  let isConsecutive = true
                  for (let i = 1; i < sortedMonths.length; i++) {
                    if (sortedMonths[i] !== sortedMonths[i - 1] + 1) {
                      isConsecutive = false
                      break
                    }
                  }

                  if (isConsecutive && sortedMonths.length > 1) {
                    // Если месяцы идут подряд, показываем "С [первый] по [последний] [год]"
                    const firstMonth = monthNames[sortedMonths[0] - 1]
                    const lastMonth = monthNames[sortedMonths[sortedMonths.length - 1] - 1]
                    const year = season || new Date().getFullYear()
                    return `С ${firstMonth} по ${lastMonth} ${year}`
                  } else if (isConsecutive && sortedMonths.length === 1) {
                    // Если только один месяц
                    const month = monthNames[sortedMonths[0] - 1]
                    const year = season || new Date().getFullYear()
                    return `${month} ${year}`
                  } else {
                    // Если месяцы не подряд, показываем список
                    const monthList = sortedMonths.map(m => monthNames[m - 1]).join(', ')
                    const year = season || new Date().getFullYear()
                    return `${monthList} ${year}`
                  }
                }

                return (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Период навигации:</span>
                    <span className="font-semibold">{formatNavigationPeriod(club.rentalMonths, club.season)}</span>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {club.latitude && club.longitude && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Расположение</h2>
          <div className="w-full h-96 rounded-lg overflow-hidden border border-gray-200">
            <iframe
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://www.google.com/maps?q=${parseFloat(club.latitude.toString())},${parseFloat(club.longitude.toString())}&hl=ru&z=15&output=embed`}
              title={`Карта расположения ${club.name}`}
            />
          </div>
          <div className="mt-4 flex items-center text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2" />
            <span>{club.address}</span>
          </div>
          <div className="mt-2">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${parseFloat(club.latitude.toString())},${parseFloat(club.longitude.toString())}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              Открыть в Google Maps →
            </a>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Места</h2>
          {canManageBerths() && (
            <button
              onClick={handleOpenAddBerth}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Plus className="h-5 w-5 mr-2" />
              Добавить место
            </button>
          )}
        </div>

        {club.berths && club.berths.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {club.berths.map((berth) => (
              <div key={berth.id} className="border border-gray-200 rounded-lg p-4 relative">
                {canManageBerths() && (
                  <div className="absolute top-2 right-2 flex space-x-2">
                    <button
                      onClick={() => handleOpenEditBerth(berth)}
                      className="p-1 text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded"
                      title="Редактировать"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteBerth(berth.id)}
                      disabled={deletingBerth}
                      className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                      title="Удалить"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
                <div className="flex items-center mb-2">
                  <Anchor className="h-5 w-5 text-primary-600 mr-2" />
                  <span className="font-semibold">{berth.number}</span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Максимальная длина катера: {berth.length} м</div>
                  <div>Максимальная ширина катера: {berth.width} м</div>
                  {(() => {
                    // Проверяем, есть ли тарифы для этого места
                    const activeTariffs = berth.tariffBerths?.filter(tb => tb.tariff) || []
                    if (activeTariffs.length > 0) {
                      // Показываем тарифы
                      return (
                        <div className="space-y-1">
                          {activeTariffs.map((tb) => {
                            const tariff = tb.tariff!
                            const tariffTypeText = tariff.type === 'season_payment' ? 'за сезон' : 'в месяц'
                            return (
                              <div key={tb.id} className="text-primary-600 font-semibold">
                                {tariff.name}: {tariff.amount.toLocaleString()} ₽ {tariffTypeText}
                              </div>
                            )
                          })}
                        </div>
                      )
                    } else if (berth.pricePerDay) {
                      // Если нет тарифов, показываем pricePerDay
                      return (
                        <div className="text-primary-600 font-semibold">
                          {berth.pricePerDay.toLocaleString()} ₽/день
                        </div>
                      )
                    }
                    return null
                  })()}
                  <div className={`mt-2 ${getBerthStatus(berth).color} font-semibold`}>
                    {getBerthStatus(berth).text}
                  </div>
                </div>
                {club && club.isActive && isBerthBookable(berth) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    {user?.role === UserRole.VESSEL_OWNER ? (
                      <button
                        onClick={() => handleOpenBookingModalForBerth(berth)}
                        className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Забронировать
                      </button>
                    ) : (
                      <button
                        onClick={() => setShowRegisterModal(true)}
                        className="w-full flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Забронировать место
                      </button>
                    )}
                  </div>
                )}
                {club && club.isActive && !isBerthBookable(berth) && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <button
                      disabled
                      className="w-full flex items-center justify-center px-4 py-2 bg-gray-400 text-white rounded-lg cursor-not-allowed opacity-50"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Место недоступно
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Anchor className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Места не добавлены</p>
            {canManageBerths() && (
              <button
                onClick={handleOpenAddBerth}
                className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
              >
                Добавить первое место
              </button>
            )}
          </div>
        )}
      </div>

      {/* Модальное окно добавления места */}
      {showAddBerthModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={handleCloseBerthModal}></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Добавить место</h3>
                  <button
                    onClick={handleCloseBerthModal}
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
                  {/* Переключатель режима */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Режим создания
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="berth-mode"
                          value="single"
                          checked={berthForm.mode === 'single'}
                          onChange={(e) => setBerthForm({ ...berthForm, mode: 'single' })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Одно место</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="berth-mode"
                          value="multiple"
                          checked={berthForm.mode === 'multiple'}
                          onChange={(e) => setBerthForm({ ...berthForm, mode: 'multiple' })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Несколько мест</span>
                      </label>
                    </div>
                  </div>

                  {/* Поле для одного места */}
                  {berthForm.mode === 'single' && (
                    <div>
                      <label htmlFor="berth-number" className="block text-sm font-medium text-gray-700">
                        Номер места *
                      </label>
                      <input
                        id="berth-number"
                        type="text"
                        required
                        value={berthForm.number}
                        onChange={(e) => setBerthForm({ ...berthForm, number: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                        placeholder="Например: Место 1"
                      />
                    </div>
                  )}

                  {/* Поле для нескольких мест */}
                  {berthForm.mode === 'multiple' && (
                    <div>
                      <label htmlFor="berth-count" className="block text-sm font-medium text-gray-700">
                        Количество мест *
                      </label>
                      <input
                        id="berth-count"
                        type="number"
                        required
                        min="1"
                        value={berthForm.count}
                        onChange={(e) => setBerthForm({ ...berthForm, count: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                        placeholder="60"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Места будут созданы с номерами начиная с последнего свободного номера
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="berth-length" className="block text-sm font-medium text-gray-700">
                        Максимальная длина катера (м) *
                      </label>
                      <input
                        id="berth-length"
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={berthForm.length}
                        onChange={(e) => setBerthForm({ ...berthForm, length: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="berth-width" className="block text-sm font-medium text-gray-700">
                        Максимальная ширина катера (м) *
                      </label>
                      <input
                        id="berth-width"
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={berthForm.width}
                        onChange={(e) => setBerthForm({ ...berthForm, width: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="berth-notes" className="block text-sm font-medium text-gray-700">
                      Примечания
                    </label>
                    <textarea
                      id="berth-notes"
                      rows={3}
                      value={berthForm.notes}
                      onChange={(e) => setBerthForm({ ...berthForm, notes: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleCreateBerth}
                  disabled={savingBerth}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {savingBerth ? 'Создание...' : 'Создать'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseBerthModal}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно редактирования места */}
      {showEditBerthModal && selectedBerth && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75" onClick={handleCloseBerthModal}></div>
            </div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Редактировать место</h3>
                  <button
                    onClick={handleCloseBerthModal}
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
                    <label htmlFor="edit-berth-number" className="block text-sm font-medium text-gray-700">
                      Номер места *
                    </label>
                    <input
                      id="edit-berth-number"
                      type="text"
                      required
                      value={berthForm.number}
                      onChange={(e) => setBerthForm({ ...berthForm, number: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="edit-berth-length" className="block text-sm font-medium text-gray-700">
                        Максимальная длина катера (м) *
                      </label>
                      <input
                        id="edit-berth-length"
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={berthForm.length}
                        onChange={(e) => setBerthForm({ ...berthForm, length: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>

                    <div>
                      <label htmlFor="edit-berth-width" className="block text-sm font-medium text-gray-700">
                        Максимальная ширина катера (м) *
                      </label>
                      <input
                        id="edit-berth-width"
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={berthForm.width}
                        onChange={(e) => setBerthForm({ ...berthForm, width: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="edit-berth-price" className="block text-sm font-medium text-gray-700">
                      Цена за день (₽)
                    </label>
                    <input
                      id="edit-berth-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={berthForm.pricePerDay}
                      onChange={(e) => setBerthForm({ ...berthForm, pricePerDay: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  <div>
                    <label htmlFor="edit-berth-notes" className="block text-sm font-medium text-gray-700">
                      Примечания
                    </label>
                    <textarea
                      id="edit-berth-notes"
                      rows={3}
                      value={berthForm.notes}
                      onChange={(e) => setBerthForm({ ...berthForm, notes: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleUpdateBerth}
                  disabled={savingBerth}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {savingBerth ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseBerthModal}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно бронирования места */}
      {showBookingModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={handleCloseBookingModal} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Забронировать место</h3>
                  <button
                    onClick={handleCloseBookingModal}
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
                    <label htmlFor="booking-vessel" className="block text-sm font-medium text-gray-700">
                      Судно *
                    </label>
                    <select
                      id="booking-vessel"
                      required
                      value={bookingForm.vesselId}
                      onChange={(e) => setBookingForm({ ...bookingForm, vesselId: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    >
                      <option value="">Выберите судно</option>
                      {userVessels.map((vessel) => (
                        <option key={vessel.id} value={vessel.id}>
                          {vessel.name} ({vessel.type}, {vessel.length} м)
                        </option>
                      ))}
                    </select>
                    {userVessels.length === 0 && (
                      <p className="mt-1 text-sm text-gray-500">
                        У вас нет судов. Создайте судно на странице "Судна".
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="booking-berth" className="block text-sm font-medium text-gray-700">
                      Место *
                    </label>
                    <div className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-900">
                      {club?.berths?.find(b => b.id.toString() === bookingForm.berthId)?.number || 'Место не выбрано'}
                    </div>
                  </div>

                  {/* Выбор тарифа */}
                  {(() => {
                    const selectedBerth = club?.berths?.find(b => b.id.toString() === bookingForm.berthId)
                    const availableTariffs = selectedBerth?.tariffBerths?.filter(tb => tb.tariff) || []
                    
                    if (availableTariffs.length > 0) {
                      return (
                        <div>
                          <label htmlFor="booking-tariff" className="block text-sm font-medium text-gray-700">
                            Тариф оплаты *
                          </label>
                          <select
                            id="booking-tariff"
                            required
                            value={bookingForm.tariffId}
                            onChange={(e) => setBookingForm({ ...bookingForm, tariffId: e.target.value })}
                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                          >
                            <option value="">Выберите тариф</option>
                            {availableTariffs.map((tb) => {
                              const tariff = tb.tariff!
                              const tariffTypeText = tariff.type === 'season_payment' ? 'за сезон' : 'в месяц'
                              return (
                                <option key={tb.id} value={tariff.id}>
                                  {tariff.name} - {tariff.amount.toLocaleString()} ₽ {tariffTypeText}
                                </option>
                              )
                            })}
                          </select>
                          <p className="mt-1 text-xs text-gray-500">
                            Выберите тариф для оплаты бронирования
                          </p>
                        </div>
                      )
                    }
                    return null
                  })()}

                  {/* Расчет стоимости */}
                  {(() => {
                    if (!bookingForm.tariffId || !club) {
                      return null
                    }

                    const selectedBerth = club?.berths?.find(b => b.id.toString() === bookingForm.berthId)
                    const selectedTariffBerth = selectedBerth?.tariffBerths?.find(tb => tb.tariff?.id.toString() === bookingForm.tariffId)
                    const selectedTariff = selectedTariffBerth?.tariff

                    if (!selectedTariff) {
                      return null
                    }

                    let totalPrice = 0
                    let monthlyBreakdown: Array<{ month: string; amount: number }> = []
                    let appliedRules: any[] = []
                    let basePrice = 0 // Базовая стоимость (без залога)
                    let depositAmount = 0 // Сумма залога

                    // Убеждаемся, что amount это число
                    const tariffAmount = typeof selectedTariff.amount === 'number' 
                      ? selectedTariff.amount 
                      : parseFloat(String(selectedTariff.amount))

                    // Находим все правила для этого тарифа или общие правила для клуба
                    const applicableRules = bookingRules.filter(
                      (rule: any) => rule.tariffId === selectedTariff.id || rule.tariffId === null
                    )

                    // Ищем правило REQUIRE_DEPOSIT
                    const depositRule = applicableRules.find(
                      (rule: any) => rule.ruleType === 'require_deposit'
                    )
                    if (depositRule && depositRule.parameters && depositRule.parameters.depositAmount) {
                      depositAmount = parseFloat(String(depositRule.parameters.depositAmount))
                      appliedRules.push(depositRule)
                    }

                    if (selectedTariff.type === 'season_payment') {
                      // Оплата за весь сезон
                      basePrice = tariffAmount
                      totalPrice = basePrice + depositAmount
                    } else if (selectedTariff.type === 'monthly_payment') {
                      // Помесячная оплата - проверяем правила для тарифа
                      const clubRentalMonths = club.rentalMonths || []
                      const tariffMonths = selectedTariff.months || []
                      
                      // Находим пересечение месяцев навигации клуба и месяцев тарифа
                      let intersectionMonths = clubRentalMonths.filter(month => tariffMonths.includes(month))
                      
                      // Ищем правило REQUIRE_PAYMENT_MONTHS для этого тарифа
                      const paymentRule = applicableRules.find(
                        (rule: any) => rule.ruleType === 'require_payment_months'
                      )
                      
                      // Если есть правило REQUIRE_PAYMENT_MONTHS, используем месяцы из правила
                      if (paymentRule && paymentRule.parameters && paymentRule.parameters.months) {
                        const ruleMonths = paymentRule.parameters.months as number[]
                        // Берем только те месяцы из правила, которые есть в пересечении
                        intersectionMonths = intersectionMonths.filter(month => ruleMonths.includes(month))
                        appliedRules.push(paymentRule)
                      }
                      
                      // Сортируем месяцы
                      const sortedMonths = [...intersectionMonths].sort((a, b) => a - b)
                      
                      const seasonYear = club.season || new Date().getFullYear()
                      const monthNames = [
                        'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
                        'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
                      ]

                      // Инициализируем totalPrice как 0 перед циклом
                      totalPrice = 0
                      
                      sortedMonths.forEach((monthNumber) => {
                        const monthAmount = tariffAmount
                        monthlyBreakdown.push({
                          month: `${monthNames[monthNumber - 1]} ${seasonYear}`,
                          amount: monthAmount,
                        })
                        // Складываем сумму за каждый месяц
                        totalPrice = totalPrice + monthAmount
                      })
                      
                      // Базовая стоимость - сумма за месяцы
                      basePrice = totalPrice
                      // Добавляем залог к общей сумме
                      totalPrice = basePrice + depositAmount
                      
                      // Добавляем другие правила (MIN_BOOKING_PERIOD, MAX_BOOKING_PERIOD, CUSTOM)
                      const otherRules = applicableRules.filter(
                        (rule: any) => rule.ruleType !== 'require_payment_months' && 
                                       rule.ruleType !== 'require_deposit'
                      )
                      appliedRules.push(...otherRules)
                    }

                    return (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">Расчет стоимости</h4>
                        
                        <div className="space-y-2">
                          {/* Платеж за сезон или помесячная оплата */}
                          {selectedTariff.type === 'season_payment' && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-700">Платеж за сезон:</span>
                              <span className="font-medium text-gray-900">
                                {basePrice.toLocaleString()} ₽
                              </span>
                            </div>
                          )}

                          {selectedTariff.type === 'monthly_payment' && monthlyBreakdown.length > 0 && (
                            <div>
                              <p className="text-sm font-medium text-gray-700 mb-2">Сумма по месяцам:</p>
                              <div className="space-y-1 mb-2">
                                {monthlyBreakdown.map((item, index) => (
                                  <div key={index} className="flex justify-between text-sm">
                                    <span className="text-gray-600">{item.month}:</span>
                                    <span className="font-medium text-gray-900">
                                      {item.amount.toLocaleString()} ₽
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200">
                                <span className="text-gray-700 font-medium">Платеж за месяцы:</span>
                                <span className="font-medium text-gray-900">
                                  {basePrice.toLocaleString()} ₽
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Залог, если есть */}
                          {depositAmount > 0 && (
                            <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200">
                              <span className="text-gray-700">Залог:</span>
                              <span className="font-medium text-gray-900">
                                {depositAmount.toLocaleString()} ₽
                              </span>
                            </div>
                          )}

                          {/* Итого */}
                          <div className="flex justify-between items-center pt-2 border-t-2 border-gray-300">
                            <span className="text-sm font-semibold text-gray-900">Итого:</span>
                            <span className="text-lg font-bold text-primary-600">
                              {totalPrice.toLocaleString()} ₽
                            </span>
                          </div>

                          {/* Показываем информацию о примененных правилах */}
                          {appliedRules.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-xs font-medium text-gray-700 mb-1">Примененные правила:</p>
                              <div className="space-y-1">
                                {appliedRules.map((rule: any, index: number) => (
                                  <p key={index} className="text-xs text-blue-600 italic">
                                    • {rule.description}
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}

                  <div className="flex items-center">
                    <input
                      id="booking-auto-renewal"
                      type="checkbox"
                      checked={bookingForm.autoRenewal}
                      onChange={(e) => setBookingForm({ ...bookingForm, autoRenewal: e.target.checked })}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label htmlFor="booking-auto-renewal" className="ml-2 block text-sm text-gray-700">
                      Автоматическое продление
                    </label>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleCreateBooking}
                  disabled={(() => {
                    if (creatingBooking || userVessels.length === 0 || availableBerths.length === 0) {
                      return true
                    }
                    // Если есть тарифы для места, тариф должен быть выбран
                    const selectedBerth = club?.berths?.find(b => b.id.toString() === bookingForm.berthId)
                    const availableTariffs = selectedBerth?.tariffBerths?.filter(tb => tb.tariff) || []
                    if (availableTariffs.length > 0 && !bookingForm.tariffId) {
                      return true
                    }
                    return false
                  })()}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {creatingBooking ? 'Создание...' : 'Забронировать'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseBookingModal}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно предложения регистрации для гостя */}
      {showRegisterModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={() => setShowRegisterModal(false)} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">Регистрация для бронирования</h3>
                  <button
                    onClick={() => setShowRegisterModal(false)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-center mb-4">
                    <UserPlus className="h-12 w-12 text-primary-600" />
                  </div>
                  <p className="text-sm text-gray-600 text-center mb-4">
                    Для бронирования места необходимо зарегистрироваться в качестве <strong>Судовладельца</strong>.
                  </p>
                  <p className="text-sm text-gray-600 text-center mb-6">
                    После регистрации вы сможете:
                  </p>
                  <ul className="text-sm text-gray-600 space-y-2 mb-6">
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span>Бронировать места в яхт-клубах</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span>Управлять своими судами</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-600 mr-2">✓</span>
                      <span>Просматривать свои бронирования</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setShowRegisterModal(false)
                    navigate('/register')
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Зарегистрироваться как Судовладелец
                </button>
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
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

