import { useEffect, useState, Fragment } from 'react'
import { bookingsService, paymentsService, clubFinanceService } from '../services/api'
import { Booking, UserRole, BookingStatus, Payment, PaymentStatus, CashPaymentMethod, ClubPartner, ClubPartnerManager } from '../types'
import { Calendar, ChevronDown, ChevronUp, User, Ship, Phone, Mail, X, CreditCard, Trash2, CheckCircle2 } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { LoadingAnimation } from '../components/LoadingAnimation'
import BackButton from '../components/BackButton'

export default function Bookings() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBookings, setExpandedBookings] = useState<Set<number>>(new Set())
  const [cancelling, setCancelling] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [bookingPayments, setBookingPayments] = useState<Map<number, Payment[]>>(new Map())
  const [loadingPayments, setLoadingPayments] = useState<Set<number>>(new Set())
  const [clubPartnersByClubId, setClubPartnersByClubId] = useState<Map<number, ClubPartner[]>>(new Map())
  const [partnerManagersByClubId, setPartnerManagersByClubId] = useState<Map<number, ClubPartnerManager[]>>(new Map())
  const [paymentModal, setPaymentModal] = useState<{ booking: Booking; payment: Payment } | null>(null)
  const [acceptPaymentForm, setAcceptPaymentForm] = useState({
    paymentMethod: CashPaymentMethod.CASH,
    acceptedByPartnerId: '',
    acceptedByManagerId: '',
  })
  const [confirmingPayment, setConfirmingPayment] = useState(false)

  useEffect(() => {
    loadBookings()
  }, [])

  const loadBookings = async () => {
    try {
      const response = await bookingsService.getAll({ limit: 100 })
      setBookings(response.data || [])
    } catch (error) {
      console.error('Ошибка загрузки бронирований:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800'
      case 'active':
        return 'bg-blue-100 text-blue-800'
      case 'completed':
        return 'bg-gray-100 text-gray-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      pending: 'Ожидает',
      confirmed: 'Подтверждено',
      active: 'Активно',
      completed: 'Завершено',
      cancelled: 'Отменено',
    }
    return statusMap[status] || status
  }

  const toggleBookingDetails = async (bookingId: number) => {
    const newExpanded = new Set(expandedBookings)
    const isCurrentlyExpanded = newExpanded.has(bookingId)
    
    if (isCurrentlyExpanded) {
      newExpanded.delete(bookingId)
    } else {
      newExpanded.add(bookingId)
      
      // Для VESSEL_OWNER и CLUB_OWNER загружаем платежи для активных бронирований
      const booking = bookings.find(b => b.id === bookingId)
      if ((user?.role === UserRole.VESSEL_OWNER || user?.role === UserRole.CLUB_OWNER) && booking && (booking.status === BookingStatus.ACTIVE || booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.PENDING)) {
        await loadUpcomingPayments(bookingId)
      }
    }
    setExpandedBookings(newExpanded)
  }

  const loadUpcomingPayments = async (bookingId: number, force = false) => {
    if (loadingPayments.has(bookingId) || (!force && bookingPayments.has(bookingId))) {
      return // Уже загружаем или уже загружены
    }

    setLoadingPayments(prev => new Set(prev).add(bookingId))
    try {
      const response = await paymentsService.getAll({ 
        bookingId, 
        limit: 100 
      })
      const allPayments: Payment[] = response.data || []
      
      // Показываем все платежи бронирования, сортируем по dueDate (ближайшие первыми)
      allPayments.sort((a, b) => {
        const dateA = new Date(a.dueDate).getTime()
        const dateB = new Date(b.dueDate).getTime()
        return dateA - dateB
      })
      
      setBookingPayments(prev => {
        const newMap = new Map(prev)
        newMap.set(bookingId, allPayments)
        return newMap
      })
    } catch (error) {
      console.error('Ошибка загрузки платежей для бронирования:', error)
    } finally {
      setLoadingPayments(prev => {
        const newSet = new Set(prev)
        newSet.delete(bookingId)
        return newSet
      })
    }
  }

  const loadClubPartners = async (clubId: number): Promise<ClubPartner[]> => {
    const cached = clubPartnersByClubId.get(clubId)
    if (cached) {
      return cached
    }
    const response = await clubFinanceService.getPartners(clubId)
    const partners = Array.isArray(response) ? response : response.data || []
    setClubPartnersByClubId((prev) => {
      const next = new Map(prev)
      next.set(clubId, partners)
      return next
    })
    return partners
  }

  const loadPartnerManagers = async (clubId: number): Promise<ClubPartnerManager[]> => {
    const cached = partnerManagersByClubId.get(clubId)
    if (cached) {
      return cached
    }
    const response = await clubFinanceService.getPartnerManagers(clubId)
    const managers = Array.isArray(response) ? response : response.data || []
    setPartnerManagersByClubId((prev) => {
      const next = new Map(prev)
      next.set(clubId, managers)
      return next
    })
    return managers
  }

  const isClubOwner = user?.role === UserRole.CLUB_OWNER
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN
  const isVesselOwner = user?.role === UserRole.VESSEL_OWNER
  const canViewDetails = isClubOwner || isSuperAdmin || isVesselOwner

  const canCancelBooking = (booking: Booking) => {
    if (isSuperAdmin || user?.role === UserRole.ADMIN) return true
    if (isClubOwner && booking.club?.ownerId === user?.id) return true
    if (booking.vesselOwnerId === user?.id) return true
    return false
  }

  const handleCancelBooking = async (bookingId: number) => {
    if (!confirm('Вы уверены, что хотите отменить это бронирование?')) {
      return
    }

    setCancelling(bookingId)
    try {
      await bookingsService.cancel(bookingId)
      await loadBookings()
      alert('Бронирование успешно отменено')
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка отмены бронирования')
    } finally {
      setCancelling(null)
    }
  }

  const handleDeleteBooking = async (bookingId: number) => {
    if (!confirm('Вы уверены, что хотите удалить это бронирование из базы данных? Это действие необратимо и удалит все связанные платежи.')) {
      return
    }

    if (!confirm('ВНИМАНИЕ! Это действие удалит бронирование и все связанные платежи навсегда. Продолжить?')) {
      return
    }

    setDeleting(bookingId)
    try {
      await bookingsService.delete(bookingId)
      await loadBookings()
      alert('Бронирование успешно удалено')
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка удаления бронирования')
    } finally {
      setDeleting(null)
    }
  }

  const openAcceptPaymentModal = async (booking: Booking, payment: Payment) => {
    try {
      await loadClubPartners(booking.clubId)
      await loadPartnerManagers(booking.clubId)
      setAcceptPaymentForm({
        paymentMethod: CashPaymentMethod.CASH,
        acceptedByPartnerId: '',
        acceptedByManagerId: '',
      })
      setPaymentModal({ booking, payment })
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка загрузки партнеров клуба')
    }
  }

  const closeAcceptPaymentModal = () => {
    if (confirmingPayment) return
    setPaymentModal(null)
  }

  const handleConfirmPayment = async () => {
    if (!paymentModal) return
    if (!acceptPaymentForm.acceptedByPartnerId) {
      alert('Выберите партнера, который принял оплату')
      return
    }
    if (!acceptPaymentForm.acceptedByManagerId) {
      alert('Выберите менеджера, который принял оплату')
      return
    }

    setConfirmingPayment(true)
    try {
      await paymentsService.updateStatus(paymentModal.payment.id, {
        status: PaymentStatus.PAID,
        paidDate: new Date().toISOString(),
        cashPaymentMethod: acceptPaymentForm.paymentMethod,
        acceptedByPartnerId: Number(acceptPaymentForm.acceptedByPartnerId),
        acceptedByManagerId: Number(acceptPaymentForm.acceptedByManagerId),
      })
      await loadUpcomingPayments(paymentModal.booking.id, true)
      await loadBookings()
      setPaymentModal(null)
      alert('Оплата принята и добавлена в кассу клуба')
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка обновления статуса оплаты')
    } finally {
      setConfirmingPayment(false)
    }
  }

  const getManualBookingCustomerName = (booking: Booking): string | null => {
    if (!booking.notes?.startsWith('Ручное бронирование владельцем клуба.')) {
      return null
    }
    const match = booking.notes.match(/Клиент:\s*(.+?),\s*телефон:/i)
    return match?.[1]?.trim() || null
  }

  if (loading) {
    return <LoadingAnimation message="Загрузка бронирований..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Бронирования</h1>
            <p className="mt-2 text-gray-600">Управление бронированиями</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Клуб
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Место
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Судно
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Период
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Сумма
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Статус
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {bookings.map((booking) => {
              const isExpanded = expandedBookings.has(booking.id)
              return (
                <Fragment key={booking.id}>
                  <tr
                    className={`hover:bg-gray-50 ${canViewDetails ? 'cursor-pointer' : ''}`}
                    onClick={() => canViewDetails && toggleBookingDetails(booking.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {canViewDetails && (
                          <span className="mr-2">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-gray-400" />
                            )}
                          </span>
                        )}
                        <div className="text-sm font-medium text-gray-900">{booking.club?.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {booking.berth ? (
                          <span className="font-semibold">{booking.berth.number}</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{booking.vessel?.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {format(new Date(booking.startDate), 'dd.MM.yyyy')} -{' '}
                        {format(new Date(booking.endDate), 'dd.MM.yyyy')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {booking.totalPrice.toLocaleString()} ₽
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                            booking.status
                          )}`}
                        >
                          {getStatusText(booking.status)}
                        </span>
                        {canCancelBooking(booking) &&
                          booking.status !== BookingStatus.CANCELLED &&
                          booking.status !== BookingStatus.COMPLETED && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCancelBooking(booking.id)
                              }}
                              disabled={cancelling === booking.id}
                              className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                              title="Отменить бронирование"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        {isVesselOwner &&
                          booking.status === BookingStatus.CANCELLED &&
                          booking.vesselOwnerId === user?.id && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteBooking(booking.id)
                              }}
                              disabled={deleting === booking.id}
                              className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                              title="Удалить бронирование из базы данных (необратимо)"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && canViewDetails && (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-6">
                          {/* Платежи для VESSEL_OWNER и CLUB_OWNER */}
                          {(isVesselOwner || isClubOwner) && (booking.status === BookingStatus.ACTIVE || booking.status === BookingStatus.CONFIRMED || booking.status === BookingStatus.PENDING) && (
                            <div className="bg-white rounded-lg p-4 shadow-sm">
                              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                <CreditCard className="h-5 w-5 mr-2 text-primary-600" />
                                Платежи по бронированию
                              </h3>
                              {loadingPayments.has(booking.id) ? (
                                <div className="text-center py-4">
                                  <LoadingAnimation message="Загрузка платежей..." />
                                </div>
                              ) : (
                                (() => {
                                  const payments = bookingPayments.get(booking.id) || []
                                  if (payments.length === 0) {
                                    return (
                                      <p className="text-sm text-gray-500">Нет платежей</p>
                                    )
                                  }
                                  return (
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                          <tr>
                                            {isClubOwner && (
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Плательщик
                                              </th>
                                            )}
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                              Сумма
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                              Срок оплаты
                                            </th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                              Статус
                                            </th>
                                            {isClubOwner && (
                                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Действие
                                              </th>
                                            )}
                                          </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                          {payments.map((payment) => (
                                            <tr key={payment.id} className="hover:bg-gray-50">
                                              {isClubOwner && (
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                  <div className="text-sm text-gray-900">
                                                    {getManualBookingCustomerName(booking) ||
                                                      (payment.payer
                                                        ? `${payment.payer.firstName || ''} ${payment.payer.lastName || ''}`.trim() || payment.payer.phone || '—'
                                                        : '—')}
                                                  </div>
                                                </td>
                                              )}
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="text-sm font-semibold text-gray-900">
                                                  {payment.amount.toLocaleString('ru-RU')} {payment.currency}
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="text-sm text-gray-900">
                                                  {format(new Date(payment.dueDate), 'dd.MM.yyyy HH:mm')}
                                                </div>
                                              </td>
                                              <td className="px-4 py-3 whitespace-nowrap">
                                                <span
                                                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                    payment.status === PaymentStatus.PENDING
                                                      ? 'bg-yellow-100 text-yellow-800'
                                                      : payment.status === PaymentStatus.OVERDUE
                                                      ? 'bg-red-100 text-red-800'
                                                      : payment.status === PaymentStatus.PAID
                                                      ? 'bg-green-100 text-green-800'
                                                      : payment.status === PaymentStatus.CANCELLED
                                                      ? 'bg-red-100 text-red-800'
                                                      : payment.status === PaymentStatus.REFUNDED
                                                      ? 'bg-gray-100 text-gray-800'
                                                      : 'bg-gray-100 text-gray-800'
                                                  }`}
                                                >
                                                  {payment.status === PaymentStatus.PENDING
                                                    ? 'Ожидает оплаты'
                                                    : payment.status === PaymentStatus.OVERDUE
                                                    ? 'Просрочено'
                                                    : payment.status === PaymentStatus.PAID
                                                    ? 'Оплачено'
                                                    : payment.status === PaymentStatus.CANCELLED
                                                    ? 'Отменен'
                                                    : payment.status === PaymentStatus.REFUNDED
                                                    ? 'Возвращено'
                                                    : payment.status}
                                                </span>
                                              </td>
                                              {isClubOwner && (
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                  {(payment.status === PaymentStatus.PENDING || payment.status === PaymentStatus.OVERDUE) ? (
                                                    <button
                                                      onClick={(e) => {
                                                        e.stopPropagation()
                                                        openAcceptPaymentModal(booking, payment)
                                                      }}
                                                      className="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded bg-green-600 text-white hover:bg-green-700"
                                                      title="Отметить оплату как полученную"
                                                    >
                                                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                                                      Принять оплату
                                                    </button>
                                                  ) : (
                                                    <span className="text-xs text-gray-400">—</span>
                                                  )}
                                                </td>
                                              )}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )
                                })()
                              )}
                            </div>
                          )}

                          {/* Информация о пользователе и катере (для CLUB_OWNER и SUPER_ADMIN) */}
                          {(isClubOwner || isSuperAdmin) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {/* Информация о пользователе */}
                              <div className="bg-white rounded-lg p-4 shadow-sm">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                  <User className="h-5 w-5 mr-2 text-primary-600" />
                                  Информация о пользователе
                                </h3>
                                {booking.vesselOwner ? (
                                  <div className="space-y-3">
                                    <div>
                                      <span className="text-sm text-gray-600">Имя:</span>
                                      <p className="text-sm font-medium text-gray-900">
                                        {booking.vesselOwner.firstName} {booking.vesselOwner.lastName}
                                      </p>
                                    </div>
                                    {booking.vesselOwner.email && (
                                      <div className="flex items-center">
                                        <Mail className="h-4 w-4 text-gray-400 mr-2" />
                                        <span className="text-sm text-gray-600">Email: </span>
                                        <span className="text-sm font-medium text-gray-900 ml-1">
                                          {booking.vesselOwner.email}
                                        </span>
                                      </div>
                                    )}
                                    {booking.vesselOwner.phone && (
                                      <div className="flex items-center">
                                        <Phone className="h-4 w-4 text-gray-400 mr-2" />
                                        <span className="text-sm text-gray-600">Телефон: </span>
                                        <span className="text-sm font-medium text-gray-900 ml-1">
                                          {booking.vesselOwner.phone}
                                        </span>
                                      </div>
                                    )}
                                    {booking.notes?.startsWith('Ручное бронирование владельцем клуба.') && (
                                      <div className="pt-2 border-t border-gray-100">
                                        <span className="text-sm text-gray-600">Клиент (ручная бронь):</span>
                                        <p className="text-sm font-medium text-gray-900 mt-1">{booking.notes}</p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500">Информация о пользователе недоступна</p>
                                )}
                              </div>

                              {/* Информация о катере */}
                              <div className="bg-white rounded-lg p-4 shadow-sm">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                                  <Ship className="h-5 w-5 mr-2 text-primary-600" />
                                  Информация о катере
                                </h3>
                                {booking.vessel ? (
                                  <div className="space-y-3">
                                    <div>
                                      <span className="text-sm text-gray-600">Название:</span>
                                      <p className="text-sm font-medium text-gray-900">{booking.vessel.name}</p>
                                    </div>
                                    <div>
                                      <span className="text-sm text-gray-600">Тип:</span>
                                      <p className="text-sm font-medium text-gray-900">{booking.vessel.type}</p>
                                    </div>
                                    <div>
                                      <span className="text-sm text-gray-600">Длина:</span>
                                      <p className="text-sm font-medium text-gray-900">{booking.vessel.length} м</p>
                                    </div>
                                    {booking.vessel.width && (
                                      <div>
                                        <span className="text-sm text-gray-600">Ширина:</span>
                                        <p className="text-sm font-medium text-gray-900">{booking.vessel.width} м</p>
                                      </div>
                                    )}
                                    {booking.vessel.heightAboveWaterline && (
                                      <div>
                                        <span className="text-sm text-gray-600">Высота над ватерлинией:</span>
                                        <p className="text-sm font-medium text-gray-900">
                                          {booking.vessel.heightAboveWaterline} м
                                        </p>
                                      </div>
                                    )}
                                    {booking.vessel.registrationNumber && (
                                      <div>
                                        <span className="text-sm text-gray-600">Регистрационный номер:</span>
                                        <p className="text-sm font-medium text-gray-900">
                                          {booking.vessel.registrationNumber}
                                        </p>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500">Информация о катере недоступна</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>

      {bookings.length === 0 && (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Бронирования не найдены</p>
        </div>
      )}

      {paymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white rounded-xl shadow-xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Принять оплату</h3>
              <button
                type="button"
                onClick={closeAcceptPaymentModal}
                className="text-gray-400 hover:text-gray-600"
                disabled={confirmingPayment}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div className="text-sm text-gray-600">
                Сумма: <span className="font-semibold text-gray-900">{paymentModal.payment.amount.toLocaleString('ru-RU')} {paymentModal.payment.currency}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Как принята оплата</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={acceptPaymentForm.paymentMethod}
                  onChange={(e) =>
                    setAcceptPaymentForm((prev) => ({
                      ...prev,
                      paymentMethod: e.target.value as CashPaymentMethod,
                    }))
                  }
                  disabled={confirmingPayment}
                >
                  <option value={CashPaymentMethod.CASH}>Наличные</option>
                  <option value={CashPaymentMethod.NON_CASH}>Безналичные</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Кто принял оплату</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={acceptPaymentForm.acceptedByPartnerId}
                  onChange={(e) =>
                    setAcceptPaymentForm((prev) => ({
                      ...prev,
                      acceptedByPartnerId: e.target.value,
                      acceptedByManagerId: '',
                    }))
                  }
                  disabled={confirmingPayment}
                >
                  <option value="">Выберите партнера</option>
                  {(clubPartnersByClubId.get(paymentModal.booking.clubId) || []).map((partner) => (
                    <option key={partner.id} value={partner.id}>
                      {partner.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Какой менеджер принял оплату</label>
                <select
                  className="w-full border rounded px-3 py-2"
                  value={acceptPaymentForm.acceptedByManagerId}
                  onChange={(e) =>
                    setAcceptPaymentForm((prev) => ({
                      ...prev,
                      acceptedByManagerId: e.target.value,
                    }))
                  }
                  disabled={confirmingPayment || !acceptPaymentForm.acceptedByPartnerId}
                >
                  <option value="">Выберите менеджера</option>
                  {(partnerManagersByClubId.get(paymentModal.booking.clubId) || [])
                    .filter((manager) => String(manager.partnerId) === acceptPaymentForm.acceptedByPartnerId)
                    .map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.user
                          ? `${manager.user.lastName || ''} ${manager.user.firstName || ''}`.trim() || manager.user.email
                          : `Менеджер #${manager.id}`}
                      </option>
                    ))}
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-200">
              <button
                type="button"
                onClick={closeAcceptPaymentModal}
                className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
                disabled={confirmingPayment}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
                disabled={confirmingPayment}
              >
                {confirmingPayment ? 'Сохранение...' : 'Подтвердить оплату'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

