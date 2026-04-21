import { useEffect, useState } from 'react'
import { clubsService, clubFinanceService } from '../services/api'
import { Club } from '../types'
import BackButton from '../components/BackButton'

type SettlementItem = {
  partnerId: number
  partnerName: string
  sharePercent: number
  incomeAccepted: number
  expensesPaid: number
  transferredIn?: number
  transferredOut?: number
  entitled: number
  actualPosition: number
  previousSeasonBalance: number
  settlementAmount: number
  settlementWithPreviousSeason: number
}

export default function ClubSettlements() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null)
  const [totals, setTotals] = useState({ totalIncome: 0, totalExpense: 0, netProfit: 0 })
  const [settlements, setSettlements] = useState<SettlementItem[]>([])
  const [savingPartnerId, setSavingPartnerId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const toErrorText = (value: unknown, fallback: string): string => {
    if (typeof value === 'string' && value.trim()) return value
    if (value && typeof value === 'object') {
      const v = value as any
      if (typeof v.message === 'string' && v.message.trim()) return v.message
      if (typeof v.error === 'string' && v.error.trim()) return v.error
      try {
        return JSON.stringify(v)
      } catch {
        return fallback
      }
    }
    return fallback
  }

  useEffect(() => {
    const load = async () => {
      try {
        const response = await clubsService.getAll({ limit: 200 })
        const allClubs = response.data || []
        setClubs(allClubs)
        if (allClubs.length > 0) setSelectedClubId(allClubs[0].id)
      } catch (e: any) {
        setError(toErrorText(e?.error || e?.message || e, 'Ошибка загрузки клубов'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedClubId) return
    loadSettlements(selectedClubId)
  }, [selectedClubId])

  const loadSettlements = async (clubId: number) => {
    try {
      const response = await clubFinanceService.getSettlements(clubId)
      const data = response as any
      setTotals(data.totals || { totalIncome: 0, totalExpense: 0, netProfit: 0 })
      setSettlements(data.settlements || [])
    } catch (e: any) {
      setError(toErrorText(e?.error || e?.message || e, 'Ошибка загрузки взаиморасчетов'))
    }
  }

  const updatePreviousSeasonBalance = async (partnerId: number, value: string) => {
    if (!selectedClubId) return
    const parsed = Number(value || 0)
    if (!Number.isFinite(parsed)) {
      setError('Некорректное значение баланса прошлого сезона')
      return
    }
    setSavingPartnerId(partnerId)
    setError('')
    try {
      await clubFinanceService.updatePartner(selectedClubId, partnerId, {
        previousSeasonBalance: parsed,
      })
      await loadSettlements(selectedClubId)
    } catch (e: any) {
      setError(toErrorText(e?.error || e?.message || e, 'Ошибка сохранения баланса прошлого сезона'))
    } finally {
      setSavingPartnerId(null)
    }
  }

  if (loading) return <div className="p-6">Загрузка...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-2xl font-bold">Взаиморасчеты партнеров</h1>
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
          <p className="text-sm text-gray-500">Общий приход</p>
          <p className="text-xl font-semibold text-green-700">{totals.totalIncome.toLocaleString('ru-RU')} ₽</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Общий расход</p>
          <p className="text-xl font-semibold text-red-700">{totals.totalExpense.toLocaleString('ru-RU')} ₽</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Чистый результат</p>
          <p className="text-xl font-semibold">{totals.netProfit.toLocaleString('ru-RU')} ₽</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Партнер</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Доля</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Принял приходов</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Оплатил расходов</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Должно быть по доле</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Баланс прошлого сезона</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Итог (текущий сезон)</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Итог с учетом прошлого сезона</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {settlements.map((item) => (
              <tr key={item.partnerId}>
                <td className="px-4 py-3">{item.partnerName}</td>
                <td className="px-4 py-3">{Number(item.sharePercent).toFixed(2)}%</td>
                <td className="px-4 py-3">{Number(item.incomeAccepted).toLocaleString('ru-RU')} ₽</td>
                <td className="px-4 py-3">{Number(item.expensesPaid).toLocaleString('ru-RU')} ₽</td>
                <td className="px-4 py-3">{Number(item.entitled).toLocaleString('ru-RU')} ₽</td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={Number(item.previousSeasonBalance || 0)}
                    className="w-40 border rounded px-2 py-1"
                    onBlur={(e) => updatePreviousSeasonBalance(item.partnerId, e.target.value)}
                    disabled={savingPartnerId === item.partnerId}
                  />
                </td>
                <td className="px-4 py-3">
                  <span className={item.settlementAmount >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                    {Number(item.settlementAmount).toLocaleString('ru-RU')} ₽
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={item.settlementWithPreviousSeason >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}>
                    {Number(item.settlementWithPreviousSeason).toLocaleString('ru-RU')} ₽
                  </span>
                </td>
              </tr>
            ))}
            {settlements.length === 0 && (
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
  )
}

