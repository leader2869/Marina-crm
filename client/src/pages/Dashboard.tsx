import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { clubsService, bookingsService, vesselsService, vesselOwnerCashesService } from '../services/api'
import { UserRole, BookingStatus, Vessel } from '../types'
import { Anchor, Ship, Calendar, DollarSign, TrendingUp, TrendingDown, Wallet } from 'lucide-react'
import { LoadingAnimation } from '../components/LoadingAnimation'
import BackButton from '../components/BackButton'

export default function Dashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState({
    clubs: 0,
    vessels: 0,
    bookings: 0,
    totalIncome: 0,
    totalExpense: 0,
  })
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [vesselBalances, setVesselBalances] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  // Функция для загрузки баланса катера
  const loadVesselBalance = async (vesselId: number): Promise<number> => {
    try {
      // Загружаем все кассы катера
      const cashesResponse = await vesselOwnerCashesService.getAll({ 
        limit: 100, 
        vesselId: vesselId 
      })
      const vesselCashes = cashesResponse.data || []
      
      // Загружаем баланс для каждой кассы и суммируем
      let totalBalance = 0
      for (const cash of vesselCashes) {
        try {
          const balanceResponse: any = await vesselOwnerCashesService.getBalance(cash.id)
          if (balanceResponse && typeof balanceResponse.balance === 'number') {
            totalBalance += balanceResponse.balance
          }
        } catch (error) {
          console.error(`Ошибка загрузки баланса кассы ${cash.id}:`, error)
        }
      }
      
      return totalBalance
    } catch (error) {
      console.error(`Ошибка загрузки баланса катера ${vesselId}:`, error)
      return 0
    }
  }

  useEffect(() => {
    const loadStats = async () => {
      try {
        // Для суперадмина и администратора загружаем все опубликованные клубы
        // Для остальных ролей загружаем с минимальным лимитом (нужен только total)
        const isSuperAdminOrAdmin = user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN
        const clubsParams = isSuperAdminOrAdmin ? { limit: 1000 } : { limit: 1 }
        
        const [clubsRes, bookingsRes] = await Promise.all([
          clubsService.getAll(clubsParams),
          bookingsService.getAll({ limit: 1000 }), // Загружаем все бронирования для подсчета уникальных клубов
        ])

        // Для супер-администратора загружаем все судна, для остальных - только свои
        let vesselsCount = 0
        let userVessels: Vessel[] = []
        if (user?.role === UserRole.SUPER_ADMIN) {
          const vesselsRes = await vesselsService.getAll({ limit: 1 })
          vesselsCount = (vesselsRes as any)?.data?.total || (vesselsRes as any)?.total || 0
        } else {
          // Загружаем катера пользователя
          if (user?.role === UserRole.VESSEL_OWNER) {
            const vesselsRes = await vesselsService.getAll({ limit: 100 })
            const allVessels = (vesselsRes as any)?.data || []
            userVessels = allVessels.filter((vessel: Vessel) => vessel.ownerId === user?.id)
            setVessels(userVessels)
            vesselsCount = userVessels.length
            
            // Загружаем балансы для всех катеров
            const balances: Record<number, number> = {}
            for (const vessel of userVessels) {
              balances[vessel.id] = await loadVesselBalance(vessel.id)
            }
            setVesselBalances(balances)
          } else {
            vesselsCount = user?.vessels?.length || 0
          }
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
        } else if (user?.role === UserRole.SUPER_ADMIN || user?.role === UserRole.ADMIN) {
          // Для суперадмина и администратора считаем все опубликованные клубы (активные, валидированные, отправленные на валидацию)
          const allClubs = (clubsRes as any)?.data || []
          const publishedClubs = allClubs.filter((club: any) => 
            club.isActive === true && 
            club.isValidated === true && 
            club.isSubmittedForValidation === true
          )
          clubsCount = publishedClubs.length
        } else {
          // Для остальных ролей используем общее количество клубов из ответа
          clubsCount = (clubsRes as any)?.data?.total || (clubsRes as any)?.total || 0
        }

        // Для судовладельца загружаем приходы и расходы из касс
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
      name: 'Приходы',
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
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Дашборд</h1>
          <p className="mt-2 text-gray-600">
            Добро пожаловать, {user?.firstName} {user?.lastName}!
          </p>
        </div>
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

      {/* Балансы катеров для судовладельца */}
      {user?.role === UserRole.VESSEL_OWNER && vessels.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Wallet className="h-6 w-6 text-primary-600 mr-2" />
              Баланс катеров
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vessels.map((vessel) => {
              const vesselBalance = vesselBalances[vessel.id] || 0
              return (
                <div
                  key={vessel.id}
                  onClick={() => navigate(`/cash?vesselId=${vessel.id}`)}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer hover:border-primary-500"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary-100 p-2 rounded-lg">
                        <Ship className="h-5 w-5 text-primary-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{vessel.name}</h3>
                        <p className="text-sm text-gray-500">{vessel.type}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-lg font-bold ${
                        vesselBalance >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {Number(vesselBalance).toLocaleString('ru-RU', { 
                          minimumFractionDigits: 2, 
                          maximumFractionDigits: 2 
                        })} ₽
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

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

