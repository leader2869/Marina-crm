import { useEffect, useMemo, useState } from 'react'
import BackButton from '../components/BackButton'
import { clubsService, clubFinanceService } from '../services/api'
import { CashTransactionType, Club, ClubCashTransaction } from '../types'

type ReportType = 'all' | CashTransactionType.INCOME | CashTransactionType.EXPENSE

export default function ReportsFinance() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null)
  const [transactions, setTransactions] = useState<ClubCashTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [reportType, setReportType] = useState<ReportType>('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  useEffect(() => {
    const loadClubs = async () => {
      try {
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
    loadClubs()
  }, [])

  useEffect(() => {
    const loadTransactions = async () => {
      if (!selectedClubId) return
      try {
        setLoading(true)
        const response = await clubFinanceService.getCashTransactions(selectedClubId)
        const items = Array.isArray(response) ? response : response.data || []
        setTransactions(items)
      } catch (e: any) {
        setError(e?.error || e?.message || 'Ошибка загрузки операций')
      } finally {
        setLoading(false)
      }
    }
    loadTransactions()
  }, [selectedClubId])

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (tx.transactionType === CashTransactionType.TRANSFER) return false
      if (reportType !== 'all' && tx.transactionType !== reportType) return false

      const txDate = new Date(tx.date)
      if (dateFrom) {
        const from = new Date(dateFrom)
        from.setHours(0, 0, 0, 0)
        if (txDate < from) return false
      }
      if (dateTo) {
        const to = new Date(dateTo)
        to.setHours(23, 59, 59, 999)
        if (txDate > to) return false
      }
      return true
    })
  }, [transactions, reportType, dateFrom, dateTo])

  const totalIncome = useMemo(
    () =>
      filteredTransactions
        .filter((tx) => tx.transactionType === CashTransactionType.INCOME)
        .reduce((sum, tx) => sum + Number(tx.amount), 0),
    [filteredTransactions]
  )
  const totalExpense = useMemo(
    () =>
      filteredTransactions
        .filter((tx) => tx.transactionType === CashTransactionType.EXPENSE)
        .reduce((sum, tx) => sum + Number(tx.amount), 0),
    [filteredTransactions]
  )

  if (loading && clubs.length === 0) return <div className="p-6">Загрузка...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold">Отчет по доходам и расходам</h1>
          <p className="text-gray-600">Формирование отчета по кассовым операциям клуба</p>
        </div>
      </div>

      {error && <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>}

      <div className="bg-white rounded-lg shadow p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <select
          className="border rounded px-3 py-2"
          value={selectedClubId || ''}
          onChange={(e) => setSelectedClubId(Number(e.target.value))}
        >
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
        <select
          className="border rounded px-3 py-2"
          value={reportType}
          onChange={(e) => setReportType(e.target.value as ReportType)}
        >
          <option value="all">Доходы и расходы</option>
          <option value={CashTransactionType.INCOME}>Только доходы</option>
          <option value={CashTransactionType.EXPENSE}>Только расходы</option>
        </select>
        <input
          type="date"
          className="border rounded px-3 py-2"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />
        <input
          type="date"
          className="border rounded px-3 py-2"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Доходы</p>
          <p className="text-2xl font-semibold text-green-700">{totalIncome.toLocaleString('ru-RU')} ₽</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Расходы</p>
          <p className="text-2xl font-semibold text-red-700">{totalExpense.toLocaleString('ru-RU')} ₽</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Дата</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Тип</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Сумма</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Описание</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredTransactions.map((tx) => (
              <tr key={tx.id}>
                <td className="px-4 py-3">{new Date(tx.date).toLocaleDateString('ru-RU')}</td>
                <td className="px-4 py-3">
                  {tx.transactionType === CashTransactionType.INCOME ? 'Доход' : 'Расход'}
                </td>
                <td className="px-4 py-3">{Number(tx.amount).toLocaleString('ru-RU')} ₽</td>
                <td className="px-4 py-3">{tx.description || '—'}</td>
              </tr>
            ))}
            {filteredTransactions.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={4}>
                  Нет данных для отчета
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
