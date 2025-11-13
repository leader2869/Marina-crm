import { useEffect, useState, Fragment } from 'react'
import { bookingsService } from '../services/api'
import { Booking, UserRole, BookingStatus } from '../types'
import { Calendar, ChevronDown, ChevronUp, User, Ship, Phone, Mail, X } from 'lucide-react'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'
import { LoadingAnimation } from '../components/LoadingAnimation'

export default function Bookings() {
  const { user } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBookings, setExpandedBookings] = useState<Set<number>>(new Set())
  const [cancelling, setCancelling] = useState<number | null>(null)

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

  const toggleBookingDetails = (bookingId: number) => {
    const newExpanded = new Set(expandedBookings)
    if (newExpanded.has(bookingId)) {
      newExpanded.delete(bookingId)
    } else {
      newExpanded.add(bookingId)
    }
    setExpandedBookings(newExpanded)
  }

  const isClubOwner = user?.role === UserRole.CLUB_OWNER
  const isSuperAdmin = user?.role === UserRole.SUPER_ADMIN
  const canViewDetails = isClubOwner || isSuperAdmin

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

  if (loading) {
    return <LoadingAnimation message="Загрузка бронирований..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Бронирования</h1>
          <p className="mt-2 text-gray-600">Управление бронированиями</p>
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
                      </div>
                    </td>
                  </tr>
                  {isExpanded && canViewDetails && (
                    <tr>
                      <td colSpan={6} className="px-6 py-4 bg-gray-50">
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
    </div>
  )
}

