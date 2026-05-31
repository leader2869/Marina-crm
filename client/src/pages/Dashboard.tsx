import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { dashboardService, clubFinanceService } from '../services/api'
import { ClubDashboardSummary, UserRole, Vessel } from '../types'
import { Anchor, Ship, Calendar, DollarSign, TrendingUp, TrendingDown, Wallet, Receipt } from 'lucide-react'
import { LoadingAnimation } from '../components/LoadingAnimation'
import { staffHasAnyClubAccess, staffHasPermission } from '../utils/clubStaffAccess'

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
  const [settlementsLoadedClubId, setSettlementsLoadedClubId] = useState<number | null>(null)
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [vesselBalances, setVesselBalances] = useState<Record<number, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await dashboardService.getStats()
        setStats(data.stats)
        setClubList(data.clubList)
        setSelectedClubId(data.defaultClubId)
        setClubDashboard(data.clubDashboard)
        setVessels(data.vessels as Vessel[])
        setVesselBalances(data.vesselBalances)
      } catch (error) {
        console.error('Ошибка загрузки статистики:', error)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [user])

  const canViewClubSettlements =
    user?.role === UserRole.CLUB_OWNER ||
    user?.role === UserRole.SUPER_ADMIN ||
    user?.role === UserRole.ADMIN ||
    (user?.role === UserRole.CLUB_STAFF && staffHasPermission(user, 'club_settlements'))

  useEffect(() => {
    const loadSettlements = async () => {
      if (!selectedClubId || !canViewClubSettlements) return
      if (selectedClubId === settlementsLoadedClubId) return
      try {
        const response = await clubFinanceService.getSettlements(selectedClubId)
        const data = response as any
        setClubSettlements(data?.settlements || [])
        setSettlementsLoadedClubId(selectedClubId)
      } catch (error) {
        console.error('Ошибка загрузки взаиморасчетов для дашборда:', error)
        setClubSettlements([])
      }
    }
    loadSettlements()
  }, [selectedClubId, canViewClubSettlements, settlementsLoadedClubId])

  const statCards = [
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
      {user?.role === UserRole.CLUB_STAFF && !staffHasAnyClubAccess(user) && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
          Доступ к яхт-клубу закрыт владельцем. Обратитесь к администратору клуба для восстановления доступа.
        </div>
      )}
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

          {canViewClubSettlements && (
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
          )}
        </>
      )}

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
                        {Number(vesselBalance).toLocaleString('ru-RU')} ₽
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
