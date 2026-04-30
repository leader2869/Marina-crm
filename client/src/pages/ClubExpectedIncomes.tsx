import { useEffect, useMemo, useState } from 'react'
import BackButton from '../components/BackButton'
import { clubsService, clubFinanceService } from '../services/api'
import { Club, ClubExpectedIncomeItem, ClubExpectedIncomesResponse, PaymentStatus } from '../types'

export default function ClubExpectedIncomes() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null)
  const [items, setItems] = useState<ClubExpectedIncomeItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>('all')

  const formatAmount = (amount: number) => Number(amount).toLocaleString('ru-RU')

  const loadClubs = async () => {
    try {
      setLoading(true)
      const response = await clubsService.getAll({ limit: 200 })
      const allClubs = response.data || []
      setClubs(allClubs)
      if (allClubs.length > 0) {
        setSelectedClubId(allClubs[0].id)
      }
    } catch (e: any) {
      setError(e?.error || e?.message || 'Ошибка загрузки клубов')
    } finally {
      setLoading(false)
    }
  }

  const loadExpectedIncomes = async (clubId: number) => {
    try {
      setLoading(true)
      setError('')
      const response = (await clubFinanceService.getExpectedIncomes(clubId)) as unknown as ClubExpectedIncomesResponse
      setItems(response.items || [])
    } catch (e: any) {
      setError(e?.error || e?.message || 'Ошибка загрузки ожидаемых приходов')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadClubs()
  }, [])

  useEffect(() => {
    if (!selectedClubId) return
    setSelectedMonthKey('all')
    loadExpectedIncomes(selectedClubId)
  }, [selectedClubId])

  const monthOptions = useMemo(() => {
    const monthMap = new Map<string, string>()
    items.forEach((item) => {
      const date = new Date(item.dueDate)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!monthMap.has(monthKey)) {
        monthMap.set(
          monthKey,
          date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
        )
      }
    })

    return Array.from(monthMap.entries())
      .sort(([a], [b]) => (a > b ? 1 : -1))
      .map(([key, label]) => ({ key, label }))
  }, [items])

  const visibleItems = useMemo(() => {
    if (selectedMonthKey === 'all') return items
    return items.filter((item) => {
      const date = new Date(item.dueDate)
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      return monthKey === selectedMonthKey
    })
  }, [items, selectedMonthKey])

  const visibleTotalAmount = useMemo(
    () => visibleItems.reduce((sum, item) => sum + Number(item.amount), 0),
    [visibleItems]
  )

  const visibleOverdueAmount = useMemo(
    () =>
      visibleItems
        .filter((item) => item.isOverdue || item.status === PaymentStatus.OVERDUE)
        .reduce((sum, item) => sum + Number(item.amount), 0),
    [visibleItems]
  )

  const notOverdueAmount = useMemo(
    () => visibleItems.filter((item) => !item.isOverdue).reduce((sum, item) => sum + Number(item.amount), 0),
    [visibleItems]
  )

  if (loading && clubs.length === 0) return <div className="p-6">Загрузка...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold">Ожидаемые приходы</h1>
          <p className="text-gray-600">Сколько еще должны оплатить по забронированным местам</p>
        </div>
      </div>

      {error && <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>}

      <div className="bg-white rounded-lg shadow p-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">Клуб</label>
        <select
          className="w-full border rounded px-3 py-2"
          value={selectedClubId || ''}
          onChange={(e) => setSelectedClubId(Number(e.target.value))}
        >
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Всего ожидаем</p>
          <p className="text-2xl font-semibold text-primary-700">{formatAmount(visibleTotalAmount)} ₽</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Просрочено</p>
          <p className="text-2xl font-semibold text-red-700">{formatAmount(visibleOverdueAmount)} ₽</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Ожидается в срок</p>
          <p className="text-2xl font-semibold text-green-700">{formatAmount(notOverdueAmount)} ₽</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSelectedMonthKey('all')}
            className={`px-3 py-1.5 rounded text-sm ${
              selectedMonthKey === 'all'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
            }`}
          >
            Все месяцы
          </button>
          {monthOptions.map((month) => (
            <button
              key={month.key}
              type="button"
              onClick={() => setSelectedMonthKey(month.key)}
              className={`px-3 py-1.5 rounded text-sm capitalize ${
                selectedMonthKey === month.key
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
              }`}
            >
              {month.label}
            </button>
          ))}
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Срок оплаты</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Статус</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Сумма</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Место</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Судно</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Владелец</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Бронирование</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {visibleItems.map((item) => (
              <tr key={item.paymentId}>
                <td className="px-4 py-3">{new Date(item.dueDate).toLocaleDateString('ru-RU')}</td>
                <td className="px-4 py-3">
                  {item.status === PaymentStatus.OVERDUE || item.isOverdue ? (
                    <span className="text-red-700">Просрочен</span>
                  ) : (
                    <span className="text-amber-700">Ожидает оплату</span>
                  )}
                </td>
                <td className="px-4 py-3 font-medium">{formatAmount(item.amount)} ₽</td>
                <td className="px-4 py-3">{item.berthNumber || '—'}</td>
                <td className="px-4 py-3">{item.vesselName || '—'}</td>
                <td className="px-4 py-3">{item.vesselOwnerName || '—'}</td>
                <td className="px-4 py-3">#{item.bookingId}</td>
              </tr>
            ))}
            {visibleItems.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                  Нет ожидаемых приходов
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
