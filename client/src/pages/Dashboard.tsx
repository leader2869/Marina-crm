import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { clubsService, bookingsService, clubFinanceService, vesselsService, vesselOwnerCashesService } from '../services/api'
import { ClubDashboardSummary, UserRole, BookingStatus, Vessel } from '../types'
import { Anchor, Ship, Calendar, DollarSign, TrendingUp, TrendingDown, Wallet, Receipt } from 'lucide-react'
import { LoadingAnimation } from '../components/LoadingAnimation'

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
  const [clubDashboard, setClubDashboard] = useState<ClubDashboardSummary | null>(null)
  const [clubList, setClubList] = useState<Array<{ id: number; name: string }>>([])
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null)
  const [clubSettlements, setClubSettlements] = useState<any[]>([])
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
        const isClubRole =
          user?.role === UserRole.CLUB_OWNER ||
          user?.role === UserRole.CLUB_STAFF ||
          isSuperAdminOrAdmin
        const clubsParams = isClubRole ? { limit: 200 } : isSuperAdminOrAdmin ? { limit: 1000 } : { limit: 1 }
        
        const [clubsRes, bookingsRes] = await Promise.all([
          clubsService.getAll(clubsParams),
          bookingsService.getAll({ limit: 1000 }), // Загружаем все бронирования для подсчета уникальных клубов
        ])

        if (isClubRole) {
          const allClubs = (clubsRes as any)?.data || []
          const mapped = (Array.isArray(allClubs) ? allClubs : []).map((c: any) => ({ id: c.id, name: c.name }))
          setClubList(mapped)
          if (mapped.length > 0) {
            setSelectedClubId((prev) => prev ?? mapped[0].id)
          }
        } else {
          setClubList([])
          setSelectedClubId(null)
        }

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

        if (
          user?.role === UserRole.CLUB_OWNER ||
          user?.role === UserRole.CLUB_STAFF ||
          user?.role === UserRole.SUPER_ADMIN ||
          user?.role === UserRole.ADMIN
        ) {
          try {
            const summary = await clubFinanceService.getDashboardSummary()
            setClubDashboard(summary as unknown as ClubDashboardSummary)
          } catch (error) {
            console.error('Ошибка загрузки клубной сводки дашборда:', error)
            setClubDashboard(null)
          }
        }
      } catch (error) {
        console.error('Ошибка загрузки статистики:', error)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [user])

  useEffect(() => {
    const loadSettlements = async () => {
      if (!selectedClubId) return
      try {
        const response = await clubFinanceService.getSettlements(selectedClubId)
        const data = response as any
        setClubSettlements(data?.settlements || [])
      } catch (error) {
        console.error('Ошибка загрузки взаиморасчетов для дашборда:', error)
        setClubSettlements([])
      }
    }
    loadSettlements()
  }, [selectedClubId])

  const statCards = [
    // Катера не показываем для владельца яхт-клуба
    ...(user?.role !== UserRole.CLUB_OWNER ? [{
      name: 'Катера',
      value: stats.vessels,
      icon: Ship,
      color: 'bg-green-500',
      href: '/vessels',
    }] : []),
  ]

  const clubFinanceCards = [
    {
      name: 'Собрано денег',
      value: `${Number(clubDashboard?.totalIncome || 0).toLocaleString('ru-RU')} ₽`,
      icon: TrendingUp,
      color: 'bg-emerald-500',
      href: '/club-cash',
    },
    {
      name: 'Расходы всего',
      value: `${Number((clubDashboard as any)?.totalExpense || 0).toLocaleString('ru-RU')} ₽`,
      icon: TrendingDown,
      color: 'bg-orange-500',
      href: '/club-cash',
    },
    {
      name: 'Дебиторка',
      value: `${Number(clubDashboard?.receivablesAmount || 0).toLocaleString('ru-RU')} ₽`,
      icon: Receipt,
      color: 'bg-red-500',
      href: '/club-expected-incomes',
    },
    {
      name: 'Ожидаемый приход',
      value: `${Number(clubDashboard?.expectedIncomeAmount || 0).toLocaleString('ru-RU')} ₽`,
      icon: DollarSign,
      color: 'bg-indigo-500',
      href: '/club-expected-incomes',
    },
    {
      name: 'Свободные места',
      value: Number(clubDashboard?.freeBerthsCount || 0).toLocaleString('ru-RU'),
      icon: Anchor,
      color: 'bg-blue-500',
      href: '/clubs',
    },
    {
      name: 'Брони',
      value: Number(stats.bookings || 0).toLocaleString('ru-RU'),
      icon: Calendar,
      color: 'bg-yellow-500',
      href: '/bookings',
    },
  ]

  if (loading) {
    return <LoadingAnimation message="Загрузка данных..." />
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <button
              key={stat.name}
              onClick={() => navigate(stat.href)}
              className="bg-white rounded-lg shadow p-6 w-full text-left hover:shadow-md transition-shadow"
            >
              <div className="flex items-center">
                <div className={`${stat.color} p-3 rounded-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4">
                  <p className="text-xs md:text-sm font-medium text-gray-600">{stat.name}</p>
                  <p className="text-base md:text-lg font-bold text-gray-900 break-all leading-tight">{stat.value}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {(user?.role === UserRole.CLUB_OWNER ||
        user?.role === UserRole.CLUB_STAFF ||
        user?.role === UserRole.SUPER_ADMIN ||
        user?.role === UserRole.ADMIN) && (
        <>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-5">
            {clubFinanceCards.map((stat) => {
              const Icon = stat.icon
              return (
                <button
                  key={stat.name}
                  onClick={() => navigate(stat.href)}
                  className="bg-white rounded-lg shadow p-6 w-full text-left hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center">
                    <div className={`${stat.color} p-3 rounded-lg`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="ml-4">
                      <p className="text-xs md:text-sm font-medium text-gray-600">{stat.name}</p>
                      <p className="text-base md:text-lg font-bold text-gray-900 break-all leading-tight">{stat.value}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          <div
            className="bg-white rounded-lg shadow p-6 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => navigate('/club-settlements')}
          >
            <div
              className="flex items-center justify-between gap-4 mb-4 flex-wrap"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-[17px] font-semibold text-gray-900">Взаиморасчеты партнеров</h2>
              {clubList.length > 0 && (
                <select
                  className="border rounded px-2 py-1.5 text-sm"
                  value={selectedClubId || ''}
                  onChange={(e) => setSelectedClubId(Number(e.target.value))}
                >
                  {clubList.map((club) => (
                    <option key={club.id} value={club.id}>
                      {club.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-2.5 py-2 text-left text-[11px] uppercase text-gray-500">Партнер</th>
                    <th className="px-2.5 py-2 text-left text-[11px] uppercase text-gray-500">Доля</th>
                    <th className="px-2.5 py-2 text-left text-[11px] uppercase text-gray-500">Приход</th>
                    <th className="px-2.5 py-2 text-left text-[11px] uppercase text-gray-500">Расход</th>
                    <th className="px-2.5 py-2 text-left text-[11px] uppercase text-gray-500">По доле</th>
                    <th className="px-2.5 py-2 text-left text-[11px] uppercase text-gray-500">Прошлый сез.</th>
                    <th className="px-2.5 py-2 text-left text-[11px] uppercase text-gray-500">Итог</th>
                    <th className="px-2.5 py-2 text-left text-[11px] uppercase text-gray-500">Итог+прошл.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 text-sm">
                  {clubSettlements.map((item: any) => (
                    <tr key={item.partnerId}>
                      <td className="px-2.5 py-2">{item.partnerName}</td>
                      <td className="px-2.5 py-2">{Number(item.sharePercent).toFixed(2)}%</td>
                      <td className="px-2.5 py-2">{Number(item.incomeAccepted).toLocaleString('ru-RU')} ₽</td>
                      <td className="px-2.5 py-2">{Number(item.expensesPaid).toLocaleString('ru-RU')} ₽</td>
                      <td className="px-2.5 py-2">{Number(item.entitled).toLocaleString('ru-RU')} ₽</td>
                      <td className="px-2.5 py-2">{Number(item.previousSeasonBalance || 0).toLocaleString('ru-RU')} ₽</td>
                      <td className="px-2.5 py-2">
                        <span className={Number(item.settlementAmount) >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                          {Number(item.settlementAmount).toLocaleString('ru-RU')} ₽
                        </span>
                      </td>
                      <td className="px-2.5 py-2">
                        <span className={Number(item.settlementWithPreviousSeason) >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                          {Number(item.settlementWithPreviousSeason).toLocaleString('ru-RU')} ₽
                        </span>
                      </td>
                    </tr>
                  ))}
                  {clubSettlements.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-4 py-6 text-center text-gray-500">
                        Нет данных для взаиморасчетов
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

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

    </div>
  )
}

