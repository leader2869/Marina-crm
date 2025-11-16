import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { clubsService, bookingsService, vesselsService, vesselOwnerCashesService } from '../services/api'
import { UserRole, BookingStatus } from '../types'
import { Anchor, Ship, Calendar, DollarSign, TrendingUp, TrendingDown } from 'lucide-react'
import { LoadingAnimation } from '../components/LoadingAnimation'

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    clubs: 0,
    vessels: 0,
    bookings: 0,
    totalIncome: 0,
    totalExpense: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const [clubsRes, bookingsRes] = await Promise.all([
          clubsService.getAll({ limit: 1 }),
          bookingsService.getAll({ limit: 1000 }), // Загружаем все бронирования для подсчета уникальных клубов
        ])

        // Для супер-администратора загружаем все судна, для остальных - только свои
        let vesselsCount = 0
        if (user?.role === UserRole.SUPER_ADMIN) {
          const vesselsRes = await vesselsService.getAll({ limit: 1 })
          vesselsCount = (vesselsRes as any)?.data?.total || (vesselsRes as any)?.total || 0
        } else {
          vesselsCount = user?.vessels?.length || 0
        }

        // Подсчет яхт-клубов
        let clubsCount = 0
        if (user?.role === UserRole.VESSEL_OWNER) {
          // Для судовладельца считаем уникальные яхт-клубы из его активных бронирований
          const allBookings = (bookingsRes as any)?.data || []
          const activeBookings = allBookings.filter((booking: any) => booking.status !== BookingStatus.CANCELLED)
          const uniqueClubIds = new Set<number>()
          activeBookings.forEach((booking: any) => {
            if (booking.clubId) {
              uniqueClubIds.add(booking.clubId)
            }
          })
          clubsCount = uniqueClubIds.size
        } else {
          // Для остальных ролей используем общее количество клубов
          clubsCount = (clubsRes as any)?.data?.total || (clubsRes as any)?.total || 0
        }

        // Для судовладельца загружаем доходы и расходы из касс
        let totalIncome = 0
        let totalExpense = 0
        
        if (user?.role === UserRole.VESSEL_OWNER) {
          try {
            const [incomeRes, expenseRes] = await Promise.all([
              vesselOwnerCashesService.getTotalIncome(),
              vesselOwnerCashesService.getTotalExpense(),
            ])
            totalIncome = (incomeRes as any)?.totalIncome || 0
            totalExpense = (expenseRes as any)?.totalExpense || 0
          } catch (error) {
            console.error('Ошибка загрузки доходов/расходов:', error)
          }
        }

        // Подсчет бронирований
        let bookingsCount = 0
        if (user?.role === UserRole.VESSEL_OWNER) {
          // Для судовладельца считаем количество только активных бронирований (исключаем отмененные)
          const allBookings = (bookingsRes as any)?.data || []
          const activeBookings = allBookings.filter((booking: any) => booking.status !== BookingStatus.CANCELLED)
          bookingsCount = activeBookings.length
        } else {
          // Для остальных ролей используем total из ответа
          bookingsCount = (bookingsRes as any)?.data?.total || (bookingsRes as any)?.total || 0
        }

        setStats({
          clubs: clubsCount,
          vessels: vesselsCount,
          bookings: bookingsCount,
          totalIncome,
          totalExpense,
        })
      } catch (error) {
        console.error('Ошибка загрузки статистики:', error)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [user])

  const statCards = [
    {
      name: 'Яхт-клубы',
      value: stats.clubs,
      icon: Anchor,
      color: 'bg-blue-500',
    },
    // Катера не показываем для владельца яхт-клуба
    ...(user?.role !== UserRole.CLUB_OWNER ? [{
      name: 'Катера',
      value: stats.vessels,
      icon: Ship,
      color: 'bg-green-500',
    }] : []),
    {
      name: 'Брони',
      value: stats.bookings,
      icon: Calendar,
      color: 'bg-yellow-500',
    },
    {
      name: 'Доходы',
      value: `${stats.totalIncome.toLocaleString()} ₽`,
      icon: TrendingUp,
      color: 'bg-emerald-500',
    },
    {
      name: 'Расходы',
      value: `${stats.totalExpense.toLocaleString()} ₽`,
      icon: TrendingDown,
      color: 'bg-red-500',
    },
  ]

  if (loading) {
    return <LoadingAnimation message="Загрузка данных..." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Дашборд</h1>
        <p className="mt-2 text-gray-600">
          Добро пожаловать, {user?.firstName} {user?.lastName}!
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.name} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Быстрые действия</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <a
            href="/clubs"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Anchor className="h-6 w-6 text-primary-600 mb-2" />
            <p className="font-medium text-gray-900">Управление клубами</p>
          </a>
          {/* Мои катера не показываем для владельца яхт-клуба */}
          {user?.role !== UserRole.CLUB_OWNER && (
            <a
              href="/vessels"
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Ship className="h-6 w-6 text-primary-600 mb-2" />
              <p className="font-medium text-gray-900">Мои катера</p>
            </a>
          )}
          <a
            href="/bookings"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Calendar className="h-6 w-6 text-primary-600 mb-2" />
            <p className="font-medium text-gray-900">Брони</p>
          </a>
          <a
            href="/finances"
            className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <DollarSign className="h-6 w-6 text-primary-600 mb-2" />
            <p className="font-medium text-gray-900">Финансы</p>
          </a>
        </div>
      </div>
    </div>
  )
}

