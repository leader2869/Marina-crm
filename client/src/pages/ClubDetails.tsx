import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  clubsService,
  berthsService,
  vesselsService,
  bookingsService,
  bookingRulesService,
  clubFinanceService,
} from '../services/api'
import { Club, Berth, Vessel, ClubTenantReportResponse } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { UserRole } from '../types'
import { MapPin, Phone, Mail, Globe, Anchor, Edit2, X, Plus, Trash2, UserPlus, ShieldCheck } from 'lucide-react'
import { LoadingAnimation } from '../components/LoadingAnimation'
import BackButton from '../components/BackButton'

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
    photos: [] as string[],
  })
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
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
    pricePerDay: '', // Цена за день (используется только при редактировании)
  })
  const [savingBerth, setSavingBerth] = useState(false)
  const [deletingBerth, setDeletingBerth] = useState(false)
  const [selectedBerths, setSelectedBerths] = useState<Set<number>>(new Set())
  const [showBookingModal, setShowBookingModal] = useState(false)
  const [availableBerths, setAvailableBerths] = useState<Berth[]>([])
  const [userVessels, setUserVessels] = useState<Vessel[]>([])
  const [bookingForm, setBookingForm] = useState({
    berthId: '',
    vesselId: '',
    autoRenewal: false,
    tariffId: '',
    customerFullName: '',
    customerPhone: '',
  })
  const [creatingBooking, setCreatingBooking] = useState(false)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [berthBookings, setBerthBookings] = useState<Map<number, any[]>>(new Map())
  const [bookingRules, setBookingRules] = useState<any[]>([])
  const [tenantReport, setTenantReport] = useState<ClubTenantReportResponse | null>(null)
  const [selectedOccupiedBerth, setSelectedOccupiedBerth] = useState<{
    berthNumber: string
    renterFullName: string
    renterPhone: string
    acceptedAmount: number
    expectedAmount: number
  } | null>(null)
  const [berthsViewMode, setBerthsViewMode] = useState<'scheme' | 'list'>('scheme')
  const availableBerthIds = new Set(availableBerths.map((b) => b.id))
  const freeBerthsCount = (club?.berths || []).filter((berth) => availableBerthIds.has(berth.id)).length

  useEffect(() => {
    if (id) {
      loadClub()
      loadAvailableBerths()
    }
  }, [id])

  useEffect(() => {
    if (club && club.berths) {
      loadBerthBookings()
    }
  }, [club])

  useEffect(() => {
    if (club?.id) {
      const canLoadTenantReport =
        user?.role === UserRole.SUPER_ADMIN ||
        user?.role === UserRole.ADMIN ||
        user?.role === UserRole.CLUB_OWNER ||
        user?.role === UserRole.CLUB_STAFF
      if (canLoadTenantReport) {
        loadTenantReport(club.id)
      } else {
        setTenantReport(null)
      }
    }
  }, [club?.id, user?.role])

  useEffect(() => {
    if (!infoMessage) return
    const timeout = setTimeout(() => setInfoMessage(''), 2500)
    return () => clearTimeout(timeout)
  }, [infoMessage])

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
      // Используем узкий endpoint по клубу, чтобы не тянуть тяжелые выборки getAll(limit=1000)
      // и не провоцировать таймауты на production.
      let allBookings: any[] = []
      
      if (user?.role === UserRole.GUEST || user?.role === UserRole.VESSEL_OWNER || user?.role === UserRole.PENDING_VALIDATION || !user) {
        try {
          const response = await bookingsService.getByClub(club.id)
          allBookings = (response as any)?.data || response || []
        } catch (error) {
          console.error('Ошибка загрузки бронирований:', error)
          allBookings = []
        }
      } else {
        try {
          const response = await bookingsService.getByClub(club.id)
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

  const loadTenantReport = async (clubId: number) => {
    try {
      const response = await clubFinanceService.getTenantReport(clubId)
      setTenantReport(response as unknown as ClubTenantReportResponse)
    } catch (error) {
      console.error('Ошибка загрузки отчета по арендаторам:', error)
      setTenantReport(null)
    }
  }

  const hasActiveTariffForBerth = (berth: Berth) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tariffBerths = berth.tariffBerths || []
    return tariffBerths.some((tb: any) => {
      const tariff = tb?.tariff
      if (!tariff) return false

      if (!tariff.startDate && !tariff.endDate) return true

      if (tariff.startDate) {
        const startDate = new Date(tariff.startDate)
        startDate.setHours(0, 0, 0, 0)
        if (today < startDate) return false
      }

      if (tariff.endDate) {
        const endDate = new Date(tariff.endDate)
        endDate.setHours(23, 59, 59, 999)
        if (today > endDate) return false
      }

      return true
    })
  }

  const getBerthStatus = (berth: Berth) => {
    const bookings = berthBookings.get(berth.id)

    if (bookings && bookings.length > 0) {
      // Проверяем статусы бронирований
      const hasPending = bookings.some((b: any) => b.status === 'pending')
      const hasConfirmed = bookings.some((b: any) => b.status === 'confirmed')
      const hasActive = bookings.some((b: any) => b.status === 'active')

      if (hasActive || hasConfirmed) {
        return { status: 'booked', text: 'Забронировано', color: 'text-red-600' }
      }
      if (hasPending) {
        return { status: 'pending', text: 'Ожидает', color: 'text-yellow-600' }
      }
    }

    if (!hasActiveTariffForBerth(berth)) {
      return { status: 'no_tariff', text: 'Нет тарифа', color: 'text-yellow-600' }
    }

    if (!availableBerthIds.has(berth.id)) {
      return { status: 'booked', text: 'Недоступен', color: 'text-red-600' }
    }

    return { status: 'available', text: 'Доступен', color: 'text-green-600' }
  }

  const isBerthBookable = (berth: Berth) => {
    // Источник истины по доступности — backend endpoint /berths/club/:id/available
    // (учитывает статусы брони и блокирующие статусы оплат).
    return berth.isAvailable && availableBerthIds.has(berth.id) && hasActiveTariffForBerth(berth)
  }
  
  // Для всех ролей (кроме гостя, который фильтруется на backend) показываем все места
  // PENDING_VALIDATION должен видеть все места, включая занятые

  const handleOpenBookingModalForBerth = (berth: Berth) => {
    setShowBookingModal(true)
    setBookingForm({
      berthId: berth.id.toString(),
      vesselId:
        user?.role === UserRole.VESSEL_OWNER && userVessels.length > 0
          ? userVessels[0].id.toString()
          : '',
      autoRenewal: false,
      tariffId: '',
      customerFullName: '',
      customerPhone: '',
    })
    // Загружаем доступные места без дат
    loadAvailableBerths()
    // Загружаем правила для клуба
    if (club) {
      loadBookingRules(club.id)
    }
  }

  const sortedBerths = useMemo(() => {
    const berths = club?.berths || []
    return [...berths].sort((a, b) => {
      const aNum = parseInt((a.number || '').replace(/\D+/g, ''), 10)
      const bNum = parseInt((b.number || '').replace(/\D+/g, ''), 10)
      if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && aNum !== bNum) {
        return aNum - bNum
      }
      return (a.number || '').localeCompare(b.number || '', 'ru')
    })
  }, [club?.berths])

  const tenantByBerthId = useMemo(() => {
    const map = new Map<number, ClubTenantReportResponse['occupiedItems'][number]>()
    ;(tenantReport?.occupiedItems || []).forEach((item) => {
      map.set(item.berthId, item)
    })
    return map
  }, [tenantReport])

  const berthByNumericNumber = useMemo(() => {
    const map = new Map<number, Berth>()
    sortedBerths.forEach((berth) => {
      const parsed = parseInt((berth.number || '').replace(/\D+/g, ''), 10)
      if (!Number.isNaN(parsed)) {
        map.set(parsed, berth)
      }
    })
    return map
  }, [sortedBerths])

  const guestBerth = useMemo(() => {
    // Сначала ищем явное гостевое место по имени
    const byName = sortedBerths.find((berth) => {
      const normalized = (berth.number || '').toLowerCase()
      return normalized.includes('guest') || normalized.includes('гост')
    })
    if (byName) return byName

    // Фолбэк для текущей схемы: гостевое место соответствует месту 75
    return berthByNumericNumber.get(75) || null
  }, [sortedBerths, berthByNumericNumber])

  const handleBerthSchemeClick = (berth: Berth) => {
    if (isBerthBookable(berth)) {
      handleOpenBookingModalForBerth(berth)
      return
    }

    const isClubOwner = user?.role === UserRole.CLUB_OWNER && club?.ownerId === user?.id
    if (!isClubOwner) {
      setInfoMessage('Место забронировано')
      return
    }

    const info = tenantByBerthId.get(berth.id)
    if (!info) return

    setSelectedOccupiedBerth({
      berthNumber: info.berthNumber,
      renterFullName: info.renterFullName,
      renterPhone: info.renterPhone,
      acceptedAmount: Number(info.acceptedAmount),
      expectedAmount: Number(info.expectedAmount),
    })
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
      customerFullName: '',
      customerPhone: '',
    })
    setBookingRules([])
  }

  const handleCreateBooking = async () => {
    const isClubOwnerBooking = user?.role === UserRole.CLUB_OWNER && club?.ownerId === user?.id

    if (!club || !bookingForm.berthId) {
      setError('Заполните все обязательные поля')
      return
    }

    if (!isClubOwnerBooking && !bookingForm.vesselId) {
      setError('Выберите судно для бронирования')
      return
    }

    if (isClubOwnerBooking && (!bookingForm.customerFullName.trim() || !bookingForm.customerPhone.trim())) {
      setError('Укажите ФИО и телефон клиента')
      return
    }

    // Проверяем, что у места есть тарифы и тариф выбран
    const berthFromClub = club.berths?.find(b => b.id.toString() === bookingForm.berthId)
    const availableTariffs = berthFromClub?.tariffBerths?.filter(tb => tb.tariff) || []
    
    if (availableTariffs.length === 0) {
      setError('Невозможно забронировать место без тарифа. Обратитесь к администратору клуба.')
      return
    }
    
    if (!bookingForm.tariffId) {
      setError('Выберите тариф для оплаты бронирования')
      return
    }

    // Проверка длины и ширины катера относительно максимальных размеров места
    // ВАЖНО: Преобразуем в числа для корректного сравнения (избегаем лексикографического сравнения строк)
    const selectedVessel = userVessels.find(v => v.id.toString() === bookingForm.vesselId)
    if (!isClubOwnerBooking && selectedVessel && berthFromClub) {
      // Проверка длины
      const vesselLength = parseFloat(String(selectedVessel.length).replace(',', '.'))
      const berthLength = parseFloat(String(berthFromClub.length).replace(',', '.'))
      
      if (!isNaN(vesselLength) && !isNaN(berthLength) && vesselLength > berthLength) {
        setError(`Длина катера (${vesselLength.toFixed(2)} м) превышает максимальную длину места (${berthLength.toFixed(2)} м). Бронирование невозможно.`)
        return
      }
      
      // Проверка ширины
      if (selectedVessel.width && berthFromClub.width) {
        const vesselWidth = parseFloat(String(selectedVessel.width).replace(',', '.'))
        const berthWidth = parseFloat(String(berthFromClub.width).replace(',', '.'))
        
        if (!isNaN(vesselWidth) && !isNaN(berthWidth) && vesselWidth > berthWidth) {
          setError(`Ширина катера (${vesselWidth.toFixed(2)} м) превышает максимальную ширину места (${berthWidth.toFixed(2)} м). Бронирование невозможно.`)
          return
        }
      } else if (selectedVessel.width && !berthFromClub.width) {
        setError('У места не указана максимальная ширина. Пожалуйста, обратитесь к администратору.')
        return
      } else if (!selectedVessel.width) {
        setError('У катера не указана ширина. Пожалуйста, укажите ширину катера перед бронированием.')
        return
      }
    }

    setError('')
    setCreatingBooking(true)

    try {
      const payload: any = {
        clubId: club.id,
        berthId: parseInt(bookingForm.berthId),
        autoRenewal: bookingForm.autoRenewal,
        tariffId: bookingForm.tariffId ? parseInt(bookingForm.tariffId) : null,
      }

      if (isClubOwnerBooking) {
        payload.customerFullName = bookingForm.customerFullName.trim()
        payload.customerPhone = bookingForm.customerPhone.trim()
      } else {
        payload.vesselId = parseInt(bookingForm.vesselId)
      }

      await bookingsService.create(payload)

      await loadClub()
      await loadBerthBookings()
      await loadAvailableBerths()
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
        let parsedPhotos: string[] = []
        if (data.logo) {
          try {
            const parsed = JSON.parse(data.logo)
            if (Array.isArray(parsed)) {
              parsedPhotos = parsed.filter((item) => typeof item === 'string')
            } else if (typeof data.logo === 'string') {
              parsedPhotos = [data.logo]
            }
          } catch {
            parsedPhotos = [data.logo]
          }
        }

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
          photos: parsedPhotos,
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
      pricePerDay: '',
    })
    setShowAddBerthModal(true)
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
      pricePerDay: '',
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
        // Обрабатываем как обычные числа, так и названия вида "Место 1", "Место 2" и т.д.
        for (const berth of existingBerths) {
          let num = 0
          // Если название начинается с "Место ", извлекаем число после него
          if (berth.number.startsWith('Место ')) {
            num = parseInt(berth.number.replace('Место ', ''))
          } else {
            // Иначе пытаемся распарсить как число
            num = parseInt(berth.number)
          }
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

  const handleSelectAllBerths = () => {
    if (!club || !club.berths) return
    
    if (selectedBerths.size === club.berths.length) {
      // Если все выбраны, снимаем выбор
      setSelectedBerths(new Set())
    } else {
      // Выбираем все
      setSelectedBerths(new Set(club.berths.map(b => b.id)))
    }
  }

  const handleDeleteSelectedBerths = async () => {
    if (selectedBerths.size === 0) return

    const count = selectedBerths.size
    if (!confirm(`Вы уверены, что хотите удалить ${count} ${count === 1 ? 'место' : count < 5 ? 'места' : 'мест'}?`)) return

    setDeletingBerth(true)
    setError('')

    try {
      // Удаляем все выбранные места
      const deletePromises = Array.from(selectedBerths).map(berthId => 
        berthsService.delete(berthId)
      )
      await Promise.all(deletePromises)
      
      await loadClub()
      setSelectedBerths(new Set())
      alert(`Успешно удалено ${count} ${count === 1 ? 'место' : count < 5 ? 'места' : 'мест'}`)
    } catch (err: any) {
      setError(err.error || err.message || 'Ошибка удаления мест')
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
        logo: editForm.photos.length > 0 ? JSON.stringify(editForm.photos) : null,
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

  const compressImageToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) {
        reject(new Error('Файл должен быть изображением'))
        return
      }

      const reader = new FileReader()
      reader.onloadend = () => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxWidth = 1400
          const maxHeight = 900
          let width = img.width
          let height = img.height

          if (width > maxWidth) {
            height = (height * maxWidth) / width
            width = maxWidth
          }
          if (height > maxHeight) {
            width = (width * maxHeight) / height
            height = maxHeight
          }

          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            reject(new Error('Не удалось обработать изображение'))
            return
          }
          ctx.drawImage(img, 0, 0, width, height)
          resolve(canvas.toDataURL('image/jpeg', 0.8))
        }
        img.onerror = () => reject(new Error('Ошибка загрузки изображения'))
        img.src = reader.result as string
      }
      reader.readAsDataURL(file)
    })

  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    if (editForm.photos.length + files.length > 7) {
      setError(`Можно загрузить максимум 7 фото. Сейчас: ${editForm.photos.length}.`)
      return
    }

    setUploadingPhoto(true)
    setError('')
    try {
      const newPhotos = [...editForm.photos]
      for (const file of Array.from(files)) {
        const base64 = await compressImageToBase64(file)
        newPhotos.push(base64)
      }
      setEditForm((prev) => ({ ...prev, photos: newPhotos }))
    } catch (err: any) {
      setError(err?.message || 'Ошибка загрузки фото')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleRemovePhoto = (index: number) => {
    setEditForm((prev) => ({
      ...prev,
      photos: prev.photos.filter((_, i) => i !== index),
    }))
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
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{club.name}</h1>
            {club.description && <p className="mt-2 text-gray-600">{club.description}</p>}
          </div>
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

      {infoMessage && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded">
          {infoMessage}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Фотографии клуба ({editForm.photos.length}/7)
              </label>
              <label className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg cursor-pointer hover:bg-primary-700">
                {uploadingPhoto ? 'Загрузка...' : 'Загрузить фото'}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploadingPhoto || editForm.photos.length >= 7}
                  onChange={(e) => {
                    handlePhotoUpload(e.target.files)
                    e.currentTarget.value = ''
                  }}
                  className="hidden"
                />
              </label>
              {editForm.photos.length > 0 && (
                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {editForm.photos.map((photo, index) => (
                    <div key={`${photo.slice(0, 24)}-${index}`} className="relative group">
                      <img
                        src={photo}
                        alt={`Фото клуба ${index + 1}`}
                        className="w-full h-24 object-cover rounded border"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(index)}
                        className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 py-1 rounded opacity-90 hover:opacity-100"
                      >
                        Удалить
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setEditing(false)
                  setError('')
                  if (club) {
                    let parsedPhotos: string[] = []
                    if (club.logo) {
                      try {
                        const parsed = JSON.parse(club.logo)
                        if (Array.isArray(parsed)) {
                          parsedPhotos = parsed.filter((item) => typeof item === 'string')
                        } else {
                          parsedPhotos = [club.logo]
                        }
                      } catch {
                        parsedPhotos = [club.logo]
                      }
                    }
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
                      photos: parsedPhotos,
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
                <span className="text-gray-600">Свободных мест:</span>
                <span className="font-semibold text-primary-600">
                  {freeBerthsCount}
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
          <div className="flex items-center gap-2">
            {canManageBerths() && club.berths && club.berths.length > 0 && (
              <>
                <button
                  onClick={handleSelectAllBerths}
                  className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 text-sm"
                >
                  {selectedBerths.size === club.berths.length ? 'Снять выбор' : 'Выбрать все'}
                </button>
                {selectedBerths.size > 0 && (
                  <button
                    onClick={handleDeleteSelectedBerths}
                    disabled={deletingBerth}
                    className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 text-sm disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Удалить ({selectedBerths.size})
                  </button>
                )}
              </>
            )}
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
        </div>

        {sortedBerths.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Схема мест</h3>
            <p className="text-sm text-gray-600 mb-3">
              Авто-шаблон построен по количеству мест. Нажмите на свободное место для бронирования.
              Владельцу клуба по занятому месту показывается информация об арендаторе и суммах.
            </p>
            <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-gray-700">
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded bg-green-500" />
                Свободно
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded bg-yellow-400" />
                Нет тарифа
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded bg-red-500" />
                Занято
              </span>
            </div>
            <div className="mb-3 inline-flex rounded-lg border border-gray-200 bg-white p-1">
              <button
                type="button"
                onClick={() => setBerthsViewMode('scheme')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  berthsViewMode === 'scheme'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Схема
              </button>
              <button
                type="button"
                onClick={() => setBerthsViewMode('list')}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  berthsViewMode === 'list'
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                Список
              </button>
            </div>

            {berthsViewMode === 'scheme' && (
              <div className="overflow-auto rounded-lg border border-gray-200 bg-[#d9edf3] p-2">
                <svg width="3000" height="620" viewBox="0 500 2820 240" className="min-w-[2600px]">
                <defs>
                  <g id="scheme-boat-vertical">
                    <path d="M3,0 L15,0 L18,6 L18,46 L15,52 L3,52 L0,46 L0,6 Z" />
                  </g>
                  <g id="scheme-boat-horizontal">
                    <path d="M0,3 L0,15 L6,18 L46,18 L52,15 L52,3 L46,0 L6,0 Z" />
                  </g>
                </defs>

                <rect x="0" y="0" width="3400" height="760" fill="#d9edf3" />
                <rect x="0" y="640" width="3400" height="120" fill="#efe5cf" />
                <text x="1410" y="470" textAnchor="middle" fontSize="24" fontWeight="700" fill="#1e3a8a">
                  река Ждановка
                </text>

                <g transform="translate(1660,76)">
                  {/* Малый понтон и Guest */}
                  <g transform="translate(-254,-26)">
                    {(() => {
                      const status = guestBerth ? getBerthStatus(guestBerth) : null
                      const fill =
                        status?.status === 'booked'
                          ? '#ef4444'
                          : status?.status === 'no_tariff'
                            ? '#facc15'
                            : status?.status === 'available'
                              ? '#22c55e'
                              : '#9ca3af'
                      const stroke = status ? '#7f1d1d' : '#6b7280'

                      return (
                        <g
                          onClick={() => guestBerth && handleBerthSchemeClick(guestBerth)}
                          style={{ cursor: guestBerth ? 'pointer' : 'default' }}
                        >
                          <g transform="translate(25,520) scale(1,1)" fill={fill} stroke={stroke} strokeWidth="1">
                            <use href="#scheme-boat-horizontal" />
                          </g>
                          <text x="51" y="529" textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#111827">
                            Гостевое место
                          </text>
                        </g>
                      )
                    })()}
                    <rect x="0" y="540" width="102" height="22" rx="3" fill="#626b79" />
                  </g>

                  {/* Понтон у Guest + лестница */}
                  <g transform="translate(-268,0)">
                    <rect x="0" y="540" width="130" height="24" rx="3" fill="#626b79" />
                    <rect x="65" y="568" width="65" height="76" rx="2" fill="#8b95a5" stroke="#5b6472" strokeWidth="1" />
                    <line x1="67" y1="578" x2="128" y2="578" stroke="#5b6472" strokeWidth="1" />
                    <line x1="67" y1="588" x2="128" y2="588" stroke="#5b6472" strokeWidth="1" />
                    <line x1="67" y1="598" x2="128" y2="598" stroke="#5b6472" strokeWidth="1" />
                    <line x1="67" y1="608" x2="128" y2="608" stroke="#5b6472" strokeWidth="1" />
                    <line x1="67" y1="618" x2="128" y2="618" stroke="#5b6472" strokeWidth="1" />
                    <line x1="67" y1="628" x2="128" y2="628" stroke="#5b6472" strokeWidth="1" />
                    <line x1="67" y1="638" x2="128" y2="638" stroke="#5b6472" strokeWidth="1" />
                  </g>

                  {/* Основная линия понтонов */}
                  {[
                    { offset: -1638, berths: [75], xs: [39], horizontal: true, fingers: [] as number[] },
                    { offset: -1502, berths: [74, 73, 72, 71], xs: [6, 44, 66, 104], fingers: [30, 86] },
                    { offset: -1368, berths: [70, 69, 68, 67], xs: [6, 44, 66, 104], fingers: [30, 86] },
                    { offset: -1234, berths: [66, 65, 64, 63], xs: [6, 44, 66, 104], fingers: [30, 86] },
                    { offset: -1100, berths: [62, 61, 60, 59], xs: [6, 44, 66, 104], fingers: [30, 86] },
                    { offset: -966, berths: [58, 57, 56, 55], xs: [6, 44, 66, 104], fingers: [30, 86] },
                    { offset: -832, berths: [54, 53, 52, 51], xs: [6, 44, 66, 104], fingers: [30, 86] },
                    { offset: -698, berths: [50, 49, 48, 47], xs: [6, 44, 66, 104], fingers: [30, 86] },
                    { offset: -564, berths: [46, 45, 44, 43], xs: [6, 44, 66, 104], fingers: [30, 86] },
                    { offset: -430, berths: [42, 41, 40, 39], xs: [6, 44, 66, 104], fingers: [30, 86] },
                    { offset: -295, berths: [], xs: [], fingers: [] as number[] },
                    { offset: -134, berths: [38, 37, 36, 35], xs: [6, 44, 66, 104], fingers: [30, 86] },
                    { offset: 0, berths: [34, 33, 32, 31], xs: [6, 44, 66, 104], fingers: [30, 86] },
                    { offset: 134, berths: [30, 29, 28, 27], xs: [6, 44, 66, 104], fingers: [30, 86] },
                    { offset: 268, berths: [26, 25, 24, 23], xs: [6, 44, 66, 104], fingers: [30, 86] },
                    { offset: 402, berths: [22, 21, 20, 19], xs: [6, 44, 66, 104], fingers: [30, 86] },
                    { offset: 536, berths: [18, 17, 16, 15], xs: [6, 44, 66, 104], fingers: [30, 86] },
                    { offset: 670, berths: [14, 13, 12, 11], xs: [6, 44, 66, 104], fingers: [30, 86] },
                    { offset: 804, berths: [10, 9, 8, 7, 6, 5], xs: [0, 24, 40, 64, 80, 104], fingers: [16, 56, 96] },
                    { offset: 938, berths: [4, 3, 2, 1], xs: [6, 44, 66, 104], fingers: [30, 86] },
                  ].map((module) => (
                    <g key={`module-${module.offset}`} transform={`translate(${module.offset},0)`}>
                      <rect x="0" y="540" width="130" height="24" rx="3" fill="#626b79" />
                      {module.fingers.map((fx) => (
                        <rect key={`finger-${fx}`} x={fx} y="458" width="10" height="82" fill="#7a8493" />
                      ))}

                      {module.berths.map((berthNumber, index) => {
                        const berth = berthByNumericNumber.get(berthNumber)
                        const berthStatus = berth ? getBerthStatus(berth) : null
                        const fill =
                          berthStatus?.status === 'booked'
                            ? '#ef4444'
                            : berthStatus?.status === 'no_tariff'
                              ? '#facc15'
                              : berthStatus?.status === 'available'
                                ? '#22c55e'
                                : '#9ca3af'
                        const stroke = berthStatus ? '#7f1d1d' : '#6b7280'
                        const isHorizontal = module.horizontal === true
                        const boatX = module.xs[index]
                        const boatY = isHorizontal ? 520 : berthNumber >= 5 && berthNumber <= 10 ? 486 : 482
                        const boatScale = berthNumber >= 5 && berthNumber <= 10 ? 0.85 : 1

                        return (
                          <g
                            key={`berth-${berthNumber}`}
                            onClick={() => berth && handleBerthSchemeClick(berth)}
                            style={{ cursor: berth ? 'pointer' : 'default' }}
                          >
                            {isHorizontal ? (
                              <g transform={`translate(${boatX},${boatY})`} fill={fill} stroke={stroke} strokeWidth="1">
                                <use href="#scheme-boat-horizontal" />
                              </g>
                            ) : (
                              <g
                                transform={`translate(${boatX},${boatY}) scale(${boatScale},${boatScale})`}
                                fill={fill}
                                stroke={stroke}
                                strokeWidth="1"
                              >
                                <use href="#scheme-boat-vertical" />
                              </g>
                            )}
                            <text
                              x={isHorizontal ? boatX + 26 : module.xs[index] + 9}
                              y={isHorizontal ? boatY + 9 : 508}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              fontSize="10"
                              fill="#111827"
                            >
                              {berthNumber}
                            </text>
                          </g>
                        )
                      })}
                    </g>
                  ))}
                </g>
              </svg>
              </div>
            )}
            {berthsViewMode === 'list' && (
              <div className="mt-2">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Список мест</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                {sortedBerths.map((berth) => {
                  const status = getBerthStatus(berth)
                  const statusClass =
                    status.status === 'booked'
                      ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
                      : status.status === 'no_tariff'
                        ? 'border-yellow-200 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                        : 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'

                  return (
                    <button
                      key={`scheme-list-${berth.id}`}
                      type="button"
                      onClick={() => handleBerthSchemeClick(berth)}
                      className={`rounded-lg border px-3 py-2 text-left transition-colors ${statusClass}`}
                    >
                      <div className="text-sm font-semibold">{berth.number}</div>
                      <div className="text-xs">{status.text}</div>
                    </button>
                  )
                })}
              </div>
              </div>
            )}
          </div>
        )}
        {sortedBerths.length === 0 && (
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
                          onChange={() => setBerthForm({ ...berthForm, mode: 'single' })}
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
                          onChange={() => setBerthForm({ ...berthForm, mode: 'multiple' })}
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
                  {user?.role === UserRole.CLUB_OWNER && club?.ownerId === user?.id ? (
                    <>
                      <div>
                        <label htmlFor="booking-customer-name" className="block text-sm font-medium text-gray-700">
                          ФИО клиента *
                        </label>
                        <input
                          id="booking-customer-name"
                          type="text"
                          value={bookingForm.customerFullName}
                          onChange={(e) => setBookingForm({ ...bookingForm, customerFullName: e.target.value })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                          placeholder="Иванов Иван Иванович"
                        />
                      </div>
                      <div>
                        <label htmlFor="booking-customer-phone" className="block text-sm font-medium text-gray-700">
                          Телефон клиента *
                        </label>
                        <input
                          id="booking-customer-phone"
                          type="tel"
                          value={bookingForm.customerPhone}
                          onChange={(e) => setBookingForm({ ...bookingForm, customerPhone: e.target.value })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                          placeholder="+7 900 000-00-00"
                        />
                      </div>
                    </>
                  ) : (
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
                  )}

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
                    const today = new Date()
                    today.setHours(0, 0, 0, 0)
                    
                    // Фильтруем тарифы: показываем только действующие (если указаны даты)
                    const availableTariffs = selectedBerth?.tariffBerths?.filter(tb => {
                      if (!tb.tariff) return false
                      const tariff = tb.tariff
                      
                      // Если даты не указаны, тариф действует всегда
                      if (!tariff.startDate && !tariff.endDate) return true
                      
                      // Проверяем дату начала
                      if (tariff.startDate) {
                        const startDate = new Date(tariff.startDate)
                        startDate.setHours(0, 0, 0, 0)
                        if (today < startDate) return false
                      }
                      
                      // Проверяем дату окончания
                      if (tariff.endDate) {
                        const endDate = new Date(tariff.endDate)
                        endDate.setHours(23, 59, 59, 999)
                        if (today > endDate) return false
                      }
                      
                      return true
                    }) || []
                    
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
                              let tariffTypeText = tariff.type === 'season_payment' ? 'за сезон' : 'в месяц'
                              let displayAmount = tariff.amount
                              
                              // Для помесячной оплаты определяем сумму за месяц
                              if (tariff.type === 'monthly_payment') {
                                if (tariff.monthlyAmounts && Object.keys(tariff.monthlyAmounts).length > 0) {
                                  const amounts = Object.values(tariff.monthlyAmounts)
                                  const minAmount = Math.min(...amounts)
                                  const maxAmount = Math.max(...amounts)
                                  
                                  if (minAmount === maxAmount) {
                                    // Если все суммы одинаковые, показываем одну сумму
                                    displayAmount = minAmount
                                  } else {
                                    // Если суммы разные, показываем диапазон
                                    displayAmount = minAmount
                                    tariffTypeText = `в месяц (от ${minAmount.toLocaleString()} до ${maxAmount.toLocaleString()} ₽)`
                                  }
                                } else {
                                  // Если monthlyAmounts нет, используем общую сумму деленную на количество месяцев
                                  const monthsCount = tariff.months?.length || 1
                                  displayAmount = tariff.amount / monthsCount
                                }
                              }
                              
                              return (
                                <option key={tb.id} value={tariff.id}>
                                  {tariff.name} - {displayAmount.toLocaleString()} ₽ {tariffTypeText}
                                </option>
                              )
                            })}
                          </select>
                          <p className="mt-1 text-xs text-gray-500">
                            Выберите тариф для оплаты бронирования
                          </p>
                        </div>
                      )
                    } else {
                      return (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                          <p className="text-sm font-medium text-red-800">
                            Невозможно забронировать место без тарифа
                          </p>
                          <p className="mt-1 text-xs text-red-600">
                            Обратитесь к администратору клуба для настройки тарифа.
                          </p>
                        </div>
                      )
                    }
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

                    // Находим все правила для этого тарифа/клуба и текущего места
                    const applicableRules = bookingRules.filter((rule: any) => {
                      const byTariff = rule.tariffId === selectedTariff.id || rule.tariffId === null
                      if (!byTariff) return false
                      const berthIds = rule.parameters?.berthIds
                      if (!Array.isArray(berthIds) || berthIds.length === 0) return true
                      const normalizedBerthIds = berthIds.map((id: any) => Number(id)).filter((id: number) => !Number.isNaN(id))
                      return selectedBerth ? normalizedBerthIds.includes(Number(selectedBerth.id)) : false
                    })

                    // Ищем правило REQUIRE_DEPOSIT
                    const depositRule = applicableRules.find(
                      (rule: any) => rule.ruleType === 'require_deposit'
                    )
                    if (depositRule && depositRule.parameters && depositRule.parameters.depositAmount) {
                      depositAmount = parseFloat(String(depositRule.parameters.depositAmount))
                      appliedRules.push(depositRule)
                    }

                    // Ищем правило REQUIRE_MEMBERSHIP_FEE
                    const membershipFeeRule = applicableRules.find(
                      (rule: any) =>
                        rule.ruleType === 'require_membership_fee' ||
                        (rule.ruleType === 'custom' && typeof rule.parameters?.membershipFeeAmount !== 'undefined')
                    )
                    const membershipFeeAmount = membershipFeeRule?.parameters?.membershipFeeAmount
                      ? parseFloat(String(membershipFeeRule.parameters.membershipFeeAmount))
                      : 0
                    if (membershipFeeRule) {
                      appliedRules.push(membershipFeeRule)
                    }

                    if (selectedTariff.type === 'season_payment') {
                      // Оплата за весь сезон
                      basePrice = tariffAmount
                      totalPrice = basePrice + depositAmount + membershipFeeAmount
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
                        // Если есть monthlyAmounts, используем сумму для конкретного месяца, иначе используем общую сумму
                        let monthAmount = tariffAmount
                        if (selectedTariff.monthlyAmounts && selectedTariff.monthlyAmounts[monthNumber]) {
                          monthAmount = parseFloat(String(selectedTariff.monthlyAmounts[monthNumber]))
                        }
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
                      totalPrice = basePrice + depositAmount + membershipFeeAmount
                      
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

                          {membershipFeeAmount > 0 && (
                            <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200">
                              <span className="text-gray-700">Членский взнос:</span>
                              <span className="font-medium text-gray-900">
                                {membershipFeeAmount.toLocaleString()} ₽
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
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleCreateBooking}
                  disabled={(() => {
                    const isClubOwnerBooking = user?.role === UserRole.CLUB_OWNER && club?.ownerId === user?.id
                    if (creatingBooking || availableBerths.length === 0) {
                      return true
                    }
                    if (!isClubOwnerBooking && userVessels.length === 0) {
                      return true
                    }
                    // Проверяем наличие тарифов для места
                    const selectedBerth = club?.berths?.find(b => b.id.toString() === bookingForm.berthId)
                    const availableTariffs = selectedBerth?.tariffBerths?.filter(tb => tb.tariff) || []
                    
                    // Если нет тарифов, кнопка заблокирована
                    if (availableTariffs.length === 0) {
                      return true
                    }
                    
                    // Если есть тарифы, но тариф не выбран, кнопка заблокирована
                    if (!bookingForm.tariffId) {
                      return true
                    }

                    if (isClubOwnerBooking) {
                      if (!bookingForm.customerFullName.trim() || !bookingForm.customerPhone.trim()) {
                        return true
                      }
                    } else if (!bookingForm.vesselId) {
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

      {selectedOccupiedBerth && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setSelectedOccupiedBerth(null)}
            />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Информация по месту {selectedOccupiedBerth.berthNumber}
                  </h3>
                  <button
                    onClick={() => setSelectedOccupiedBerth(null)}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">ФИО арендатора:</span>
                    <span className="font-semibold text-gray-900">{selectedOccupiedBerth.renterFullName || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Телефон:</span>
                    <span className="font-semibold text-gray-900">{selectedOccupiedBerth.renterPhone || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Принято:</span>
                    <span className="font-semibold text-green-700">
                      {selectedOccupiedBerth.acceptedAmount.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Ожидается:</span>
                    <span className="font-semibold text-amber-700">
                      {selectedOccupiedBerth.expectedAmount.toLocaleString('ru-RU')} ₽
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOccupiedBerth(null)
                    navigate('/bookings')
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Открыть бронирования
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedOccupiedBerth(null)}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Закрыть
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

