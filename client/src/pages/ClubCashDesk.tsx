import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { clubsService, clubFinanceService } from '../services/api'
import { CashPaymentMethod, CashTransactionType, Club, ClubCashTransaction, ClubPartner } from '../types'
import BackButton from '../components/BackButton'

export default function ClubCashDesk() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null)
  const [partners, setPartners] = useState<ClubPartner[]>([])
  const [transactions, setTransactions] = useState<ClubCashTransaction[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const [form, setForm] = useState({
    transactionType: CashTransactionType.INCOME,
    amount: '',
    paymentMethod: CashPaymentMethod.CASH,
    date: new Date().toISOString().split('T')[0],
    description: '',
    acceptedByPartnerId: '',
    paidByPartnerId: '',
    bookingId: '',
  })

  useEffect(() => {
    const load = async () => {
      try {
        const response = await clubsService.getAll({ limit: 200 })
        const allClubs = response.data || []
        setClubs(allClubs)
        if (allClubs.length > 0) setSelectedClubId(allClubs[0].id)
      } catch (e: any) {
        setError(e.error || e.message || 'Ошибка загрузки клубов')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedClubId) return
    loadData(selectedClubId)
  }, [selectedClubId])

  const loadData = async (clubId: number) => {
    try {
      const [partnersRes, txRes] = await Promise.all([
        clubFinanceService.getPartners(clubId),
        clubFinanceService.getCashTransactions(clubId),
      ])
      setPartners(Array.isArray(partnersRes) ? partnersRes : partnersRes.data || [])
      setTransactions(Array.isArray(txRes) ? txRes : txRes.data || [])
    } catch (e: any) {
      setError(e.error || e.message || 'Ошибка загрузки данных кассы')
    }
  }

  const totalIncome = useMemo(
    () =>
      transactions
        .filter((tx) => tx.transactionType === CashTransactionType.INCOME)
        .reduce((sum, tx) => sum + Number(tx.amount), 0),
    [transactions]
  )
  const totalExpense = useMemo(
    () =>
      transactions
        .filter((tx) => tx.transactionType === CashTransactionType.EXPENSE)
        .reduce((sum, tx) => sum + Number(tx.amount), 0),
    [transactions]
  )

  const handleCreate = async () => {
    if (!selectedClubId) return
    try {
      await clubFinanceService.createCashTransaction(selectedClubId, {
        transactionType: form.transactionType,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        date: form.date,
        description: form.description || null,
        bookingId: form.bookingId ? Number(form.bookingId) : null,
        acceptedByPartnerId:
          form.transactionType === CashTransactionType.INCOME && form.acceptedByPartnerId
            ? Number(form.acceptedByPartnerId)
            : null,
        paidByPartnerId:
          form.transactionType === CashTransactionType.EXPENSE && form.paidByPartnerId
            ? Number(form.paidByPartnerId)
            : null,
      })
      setForm({
        transactionType: CashTransactionType.INCOME,
        amount: '',
        paymentMethod: CashPaymentMethod.CASH,
        date: new Date().toISOString().split('T')[0],
        description: '',
        acceptedByPartnerId: '',
        paidByPartnerId: '',
        bookingId: '',
      })
      await loadData(selectedClubId)
    } catch (e: any) {
      setError(e.error || e.message || 'Ошибка создания операции')
    }
  }

  if (loading) return <div className="p-6">Загрузка...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-2xl font-bold">Касса клуба</h1>
      </div>

      {error && <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>}

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div>
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

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            className="border rounded px-3 py-2"
            value={form.transactionType}
            onChange={(e) => setForm({ ...form, transactionType: e.target.value as CashTransactionType })}
          >
            <option value={CashTransactionType.INCOME}>Приход</option>
            <option value={CashTransactionType.EXPENSE}>Расход</option>
          </select>
          <input
            type="number"
            className="border rounded px-3 py-2"
            placeholder="Сумма"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <select
            className="border rounded px-3 py-2"
            value={form.paymentMethod}
            onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as CashPaymentMethod })}
          >
            <option value={CashPaymentMethod.CASH}>Наличные</option>
            <option value={CashPaymentMethod.NON_CASH}>Безналичные</option>
          </select>
          <input
            type="date"
            className="border rounded px-3 py-2"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {form.transactionType === CashTransactionType.INCOME ? (
            <select
              className="border rounded px-3 py-2"
              value={form.acceptedByPartnerId}
              onChange={(e) => setForm({ ...form, acceptedByPartnerId: e.target.value })}
            >
              <option value="">Кто принял деньги</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <select
              className="border rounded px-3 py-2"
              value={form.paidByPartnerId}
              onChange={(e) => setForm({ ...form, paidByPartnerId: e.target.value })}
            >
              <option value="">Кто оплатил из своего кармана</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <input
            className="border rounded px-3 py-2"
            placeholder="ID бронирования (необязательно)"
            value={form.bookingId}
            onChange={(e) => setForm({ ...form, bookingId: e.target.value })}
          />
        </div>

        <textarea
          className="w-full border rounded px-3 py-2"
          placeholder="Описание"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />

        <button
          onClick={handleCreate}
          className="px-4 py-2 rounded bg-primary-600 text-white hover:bg-primary-700"
        >
          Добавить операцию
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Приход</p>
          <p className="text-xl font-semibold text-green-700">{totalIncome.toLocaleString('ru-RU')} ₽</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Расход</p>
          <p className="text-xl font-semibold text-red-700">{totalExpense.toLocaleString('ru-RU')} ₽</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-gray-500 text-sm">Итог</p>
          <p className="text-xl font-semibold">{(totalIncome - totalExpense).toLocaleString('ru-RU')} ₽</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Дата</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Тип</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Сумма</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Метод</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Партнер</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Бронирование</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Описание</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td className="px-4 py-3">{new Date(tx.date).toLocaleDateString('ru-RU')}</td>
                <td className="px-4 py-3">{tx.transactionType === CashTransactionType.INCOME ? 'Приход' : 'Расход'}</td>
                <td className="px-4 py-3">{Number(tx.amount).toLocaleString('ru-RU')} ₽</td>
                <td className="px-4 py-3">{tx.paymentMethod === CashPaymentMethod.CASH ? 'Нал' : 'Безнал'}</td>
                <td className="px-4 py-3">
                  {tx.transactionType === CashTransactionType.INCOME
                    ? tx.acceptedByPartner?.name || '—'
                    : tx.paidByPartner?.name || '—'}
                </td>
                <td className="px-4 py-3">
                  {tx.bookingId ? (
                    <Link
                      to="/bookings"
                      className="text-primary-600 hover:text-primary-700 underline-offset-2 hover:underline"
                      title={`Открыть бронирование #${tx.bookingId} в разделе бронирований`}
                    >
                      #{tx.bookingId}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3">{tx.description || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

