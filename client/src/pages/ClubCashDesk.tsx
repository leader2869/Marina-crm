import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { clubsService, clubFinanceService, isRequestAborted } from '../services/api'
import { CashPaymentMethod, CashTransactionType, Club, ClubCashTransaction, ClubPartner, ClubPartnerManager, UserRole } from '../types'
import BackButton from '../components/BackButton'
import { useAuth } from '../contexts/AuthContext'
import { staffHasPermission } from '../utils/clubStaffAccess'
import { useCancellableEffect } from '../hooks/useCancellableEffect'

export default function ClubCashDesk() {
  const { user } = useAuth()
  const canEditCash =
    !!user &&
    (user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.CLUB_OWNER ||
      (user.role === UserRole.CLUB_STAFF && staffHasPermission(user, 'club_cash_edit')))
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null)
  const [partners, setPartners] = useState<ClubPartner[]>([])
  const [partnerManagers, setPartnerManagers] = useState<ClubPartnerManager[]>([])
  const [transactions, setTransactions] = useState<ClubCashTransaction[]>([])
  const [filters, setFilters] = useState({
    transactionType: 'all',
    partnerId: 'all',
    dateFrom: '',
    dateTo: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [dataLoading, setDataLoading] = useState(false)
  const [savingCashSetting, setSavingCashSetting] = useState(false)

  const selectedClub = useMemo(
    () => clubs.find((club) => club.id === selectedClubId) ?? null,
    [clubs, selectedClubId]
  )
  const cashPaymentsOpen = selectedClub?.cashPaymentsEnabled !== false
  const canManageCashSettings =
    !!user &&
    !!selectedClub &&
    (user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      (user.role === UserRole.CLUB_OWNER && selectedClub.ownerId === user.id))

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

  const [form, setForm] = useState({
    transactionType: CashTransactionType.INCOME,
    amount: '',
    paymentMethod: CashPaymentMethod.CASH,
    date: new Date().toISOString().split('T')[0],
    description: '',
    acceptedByPartnerId: '',
    acceptedByManagerId: '',
    paidByPartnerId: '',
    paidByManagerId: '',
    bookingId: '',
  })

  useCancellableEffect(async (signal) => {
    setLoading(true)
    setError('')
    try {
      const response = await clubsService.getAll({ limit: 50 }, { signal })
      if (signal.aborted) return
      const allClubs = response.data || []
      setClubs(allClubs)
      if (allClubs.length > 0) setSelectedClubId(allClubs[0].id)
    } catch (e: any) {
      if (!isRequestAborted(e)) {
        setError(toErrorText(e?.error || e?.message || e, 'Ошибка загрузки клубов'))
      }
    } finally {
      if (!signal.aborted) setLoading(false)
    }
  }, [user])

  useCancellableEffect(async (signal) => {
    if (!selectedClubId) return
    setDataLoading(true)
    setError('')
    try {
      const desk = await clubFinanceService.getCashDesk(selectedClubId, { signal })
      if (signal.aborted) return
      const payload = desk as {
        partners?: ClubPartner[]
        partnerManagers?: ClubPartnerManager[]
        transactions?: ClubCashTransaction[]
        data?: {
          partners?: ClubPartner[]
          partnerManagers?: ClubPartnerManager[]
          transactions?: ClubCashTransaction[]
        }
      }
      const data = payload.data ?? payload
      setPartners(Array.isArray(data.partners) ? data.partners : [])
      setPartnerManagers(Array.isArray(data.partnerManagers) ? data.partnerManagers : [])
      setTransactions(Array.isArray(data.transactions) ? data.transactions : [])
    } catch (e: any) {
      if (!isRequestAborted(e)) {
        setError(toErrorText(e?.error || e?.message || e, 'Ошибка загрузки данных кассы'))
      }
    } finally {
      if (!signal.aborted) setDataLoading(false)
    }
  }, [selectedClubId])

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

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (filters.transactionType !== 'all' && tx.transactionType !== filters.transactionType) {
        return false
      }

      if (filters.partnerId !== 'all') {
        const selectedPartnerId = Number(filters.partnerId)
        const isMatchedByPartner =
          tx.acceptedByPartnerId === selectedPartnerId || tx.paidByPartnerId === selectedPartnerId
        if (!isMatchedByPartner) {
          return false
        }
      }

      if (filters.dateFrom) {
        const txDate = new Date(tx.date)
        const fromDate = new Date(filters.dateFrom)
        fromDate.setHours(0, 0, 0, 0)
        if (txDate < fromDate) {
          return false
        }
      }

      if (filters.dateTo) {
        const txDate = new Date(tx.date)
        const toDate = new Date(filters.dateTo)
        toDate.setHours(23, 59, 59, 999)
        if (txDate > toDate) {
          return false
        }
      }

      return true
    })
  }, [filters, transactions])

  const filteredTotals = useMemo(() => {
    const income = filteredTransactions
      .filter((tx) => tx.transactionType === CashTransactionType.INCOME)
      .reduce((sum, tx) => sum + Number(tx.amount), 0)

    const expense = filteredTransactions
      .filter((tx) => tx.transactionType === CashTransactionType.EXPENSE)
      .reduce((sum, tx) => sum + Number(tx.amount), 0)

    const transfer = filteredTransactions
      .filter((tx) => tx.transactionType === CashTransactionType.TRANSFER)
      .reduce((sum, tx) => sum + Number(tx.amount), 0)

    return {
      income,
      expense,
      transfer,
      result: income - expense,
    }
  }, [filteredTransactions])

  const reloadCashDesk = async (clubId: number) => {
    setDataLoading(true)
    try {
      const desk = await clubFinanceService.getCashDesk(clubId)
      const payload = desk as any
      const data = payload.data ?? payload
      setPartners(Array.isArray(data.partners) ? data.partners : [])
      setPartnerManagers(Array.isArray(data.partnerManagers) ? data.partnerManagers : [])
      setTransactions(Array.isArray(data.transactions) ? data.transactions : [])
    } catch (e: any) {
      setError(toErrorText(e?.error || e?.message || e, 'Ошибка загрузки данных кассы'))
    } finally {
      setDataLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!selectedClubId || !cashPaymentsOpen) return
    try {
      await clubFinanceService.createCashTransaction(selectedClubId, {
        transactionType: form.transactionType,
        amount: Number(form.amount),
        paymentMethod: form.paymentMethod,
        date: form.date,
        description: form.description || null,
        bookingId: form.bookingId ? Number(form.bookingId) : null,
        acceptedByPartnerId:
          (form.transactionType === CashTransactionType.INCOME || form.transactionType === CashTransactionType.TRANSFER) && form.acceptedByPartnerId
            ? Number(form.acceptedByPartnerId)
            : null,
        acceptedByManagerId:
          (form.transactionType === CashTransactionType.INCOME || form.transactionType === CashTransactionType.TRANSFER) && form.acceptedByManagerId
            ? Number(form.acceptedByManagerId)
            : null,
        paidByPartnerId:
          (form.transactionType === CashTransactionType.EXPENSE || form.transactionType === CashTransactionType.TRANSFER) && form.paidByPartnerId
            ? Number(form.paidByPartnerId)
            : null,
        paidByManagerId:
          form.transactionType === CashTransactionType.TRANSFER && form.paidByManagerId
            ? Number(form.paidByManagerId)
            : null,
      })
      setForm({
        transactionType: CashTransactionType.INCOME,
        amount: '',
        paymentMethod: CashPaymentMethod.CASH,
        date: new Date().toISOString().split('T')[0],
        description: '',
        acceptedByPartnerId: '',
        acceptedByManagerId: '',
        paidByPartnerId: '',
        paidByManagerId: '',
        bookingId: '',
      })
      await reloadCashDesk(selectedClubId)
    } catch (e: any) {
      setError(toErrorText(e?.error || e?.message || e, 'Ошибка создания операции'))
    }
  }

  const handleToggleCashPayments = async () => {
    if (!selectedClub || !canManageCashSettings) return
    setSavingCashSetting(true)
    setError('')
    try {
      const nextValue = !cashPaymentsOpen
      await clubsService.update(selectedClub.id, { cashPaymentsEnabled: nextValue })
      setClubs((prev) =>
        prev.map((club) =>
          club.id === selectedClub.id ? { ...club, cashPaymentsEnabled: nextValue } : club
        )
      )
    } catch (e: any) {
      setError(toErrorText(e?.error || e?.message || e, 'Не удалось изменить настройку кассы'))
    } finally {
      setSavingCashSetting(false)
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

      {!canEditCash && (
        <div className="p-3 rounded bg-blue-50 text-blue-800 border border-blue-200 text-sm">
          Режим просмотра: вносить приходы и расходы могут владелец клуба или сотрудник с правом «Касса: приходы и расходы». Приём оплат по бронированиям — в разделе «Бронирования» (отдельное право).
        </div>
      )}

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

        {canManageCashSettings && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded border border-gray-200 bg-gray-50">
            <div>
              <p className="text-sm font-medium text-gray-900">Приём платежей в кассу</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {cashPaymentsOpen
                  ? 'Можно принимать оплаты по бронированиям и добавлять операции вручную'
                  : 'Новые платежи и операции временно недоступны'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleCashPayments}
              disabled={savingCashSetting}
              className={`px-4 py-2 rounded text-sm font-medium text-white disabled:opacity-60 ${
                cashPaymentsOpen ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {savingCashSetting
                ? 'Сохранение...'
                : cashPaymentsOpen
                ? 'Закрыть приём платежей'
                : 'Открыть приём платежей'}
            </button>
          </div>
        )}

        {!cashPaymentsOpen && (
          <div className="p-3 rounded bg-amber-50 text-amber-900 border border-amber-200 text-sm">
            Приём платежей в кассу закрыт владельцем клуба. Просмотр истории доступен, новые операции и приём оплат по бронированиям недоступны.
          </div>
        )}

        {canEditCash && cashPaymentsOpen && (
        <>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <select
            className="border rounded px-3 py-2"
            value={form.transactionType}
            onChange={(e) => setForm({ ...form, transactionType: e.target.value as CashTransactionType })}
          >
            <option value={CashTransactionType.INCOME}>Приход</option>
            <option value={CashTransactionType.EXPENSE}>Расход</option>
            <option value={CashTransactionType.TRANSFER}>Перевод</option>
          </select>
          <input
            className="border rounded px-3 py-2"
            type="number"
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
            <option value={CashPaymentMethod.NON_CASH}>Безнал</option>
          </select>
          <input
            className="border rounded px-3 py-2"
            type="date"
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
          />
        </div>

        <div className={`grid grid-cols-1 ${form.transactionType === CashTransactionType.TRANSFER ? 'md:grid-cols-5' : 'md:grid-cols-3'} gap-3`}>
          {form.transactionType === CashTransactionType.TRANSFER && (
            <select
              className="border rounded px-3 py-2"
              value={form.paidByPartnerId}
              onChange={(e) => setForm({ ...form, paidByPartnerId: e.target.value, paidByManagerId: '' })}
            >
              <option value="">С кого списать</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {form.transactionType === CashTransactionType.TRANSFER && (
            <select
              className="border rounded px-3 py-2"
              value={form.paidByManagerId}
              onChange={(e) => setForm({ ...form, paidByManagerId: e.target.value })}
              disabled={!form.paidByPartnerId}
            >
              <option value="">С какого менеджера списываем</option>
              {partnerManagers
                .filter((m) => String(m.partnerId) === form.paidByPartnerId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.user
                      ? `${m.user.lastName || ''} ${m.user.firstName || ''}`.trim() || m.user.email
                      : `Менеджер #${m.id}`}
                  </option>
                ))}
            </select>
          )}
          {form.transactionType === CashTransactionType.INCOME || form.transactionType === CashTransactionType.TRANSFER ? (
            <select
              className="border rounded px-3 py-2"
              value={form.acceptedByPartnerId}
              onChange={(e) => setForm({ ...form, acceptedByPartnerId: e.target.value, acceptedByManagerId: '' })}
            >
              <option value="">
                {form.transactionType === CashTransactionType.TRANSFER
                  ? 'Кому перевели'
                  : 'Кто принял деньги'}
              </option>
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
              onChange={(e) => setForm({ ...form, paidByPartnerId: e.target.value, paidByManagerId: '' })}
            >
              <option value="">
                Кто оплатил из своего кармана
              </option>
              {partners.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          {form.transactionType === CashTransactionType.INCOME || form.transactionType === CashTransactionType.TRANSFER ? (
            <select
              className="border rounded px-3 py-2"
              value={form.acceptedByManagerId}
              onChange={(e) => setForm({ ...form, acceptedByManagerId: e.target.value })}
              disabled={!form.acceptedByPartnerId}
            >
              <option value="">
                {form.transactionType === CashTransactionType.TRANSFER
                  ? 'Какой менеджер принимает перевод'
                  : 'Какой менеджер принял деньги'}
              </option>
              {partnerManagers
                .filter((m) => String(m.partnerId) === form.acceptedByPartnerId)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.user
                      ? `${m.user.lastName || ''} ${m.user.firstName || ''}`.trim() || m.user.email
                      : `Менеджер #${m.id}`}
                  </option>
                ))}
            </select>
          ) : (
            <div className="border rounded px-3 py-2 text-sm text-gray-400 flex items-center">
              Для расхода менеджер не требуется
            </div>
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
        </>
        )}
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
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <select
              className="border rounded px-3 py-2"
              value={filters.transactionType}
              onChange={(e) => setFilters((prev) => ({ ...prev, transactionType: e.target.value }))}
            >
              <option value="all">Все типы</option>
              <option value={CashTransactionType.INCOME}>Приход</option>
              <option value={CashTransactionType.EXPENSE}>Расход</option>
              <option value={CashTransactionType.TRANSFER}>Перевод</option>
            </select>

            <select
              className="border rounded px-3 py-2"
              value={filters.partnerId}
              onChange={(e) => setFilters((prev) => ({ ...prev, partnerId: e.target.value }))}
            >
              <option value="all">Все партнеры</option>
              {partners.map((partner) => (
                <option key={partner.id} value={partner.id}>
                  {partner.name}
                </option>
              ))}
            </select>

            <input
              type="date"
              className="border rounded px-3 py-2"
              value={filters.dateFrom}
              onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
            />

            <input
              type="date"
              className="border rounded px-3 py-2"
              value={filters.dateTo}
              onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
            />
          </div>
        </div>

        {dataLoading ? (
          <p className="p-6 text-sm text-gray-500">Загрузка операций…</p>
        ) : (
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Дата</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Тип</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Сумма</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Метод</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Партнер</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Менеджер</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Бронирование</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Описание</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredTransactions.map((tx) => (
              <tr key={tx.id}>
                <td className="px-4 py-3">{new Date(tx.date).toLocaleDateString('ru-RU')}</td>
                <td className="px-4 py-3">
                  {tx.transactionType === CashTransactionType.INCOME
                    ? 'Приход'
                    : tx.transactionType === CashTransactionType.EXPENSE
                    ? 'Расход'
                    : 'Перевод'}
                </td>
                <td className="px-4 py-3">{Number(tx.amount).toLocaleString('ru-RU')} ₽</td>
                <td className="px-4 py-3">{tx.paymentMethod === CashPaymentMethod.CASH ? 'Нал' : 'Безнал'}</td>
                <td className="px-4 py-3">
                  {tx.transactionType === CashTransactionType.INCOME
                    ? tx.acceptedByPartner?.name || '—'
                    : tx.transactionType === CashTransactionType.EXPENSE
                    ? tx.paidByPartner?.name || '—'
                    : `${tx.paidByPartner?.name || '—'} -> ${tx.acceptedByPartner?.name || '—'}`}
                </td>
                <td className="px-4 py-3">
                  {tx.transactionType === CashTransactionType.TRANSFER
                    ? `${tx.paidByManager?.user
                        ? `${tx.paidByManager.user.lastName || ''} ${tx.paidByManager.user.firstName || ''}`.trim() ||
                          tx.paidByManager.user.email
                        : '—'} -> ${
                        tx.acceptedByManager?.user
                          ? `${tx.acceptedByManager.user.lastName || ''} ${tx.acceptedByManager.user.firstName || ''}`.trim() ||
                            tx.acceptedByManager.user.email
                          : '—'
                      }`
                    : tx.acceptedByManager?.user
                    ? `${tx.acceptedByManager.user.lastName || ''} ${tx.acceptedByManager.user.firstName || ''}`.trim() ||
                      tx.acceptedByManager.user.email
                    : '—'}
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
            {filteredTransactions.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={8}>
                  По выбранным фильтрам операции не найдены
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td className="px-4 py-3 text-sm font-semibold text-gray-900" colSpan={2}>
                Итого (по фильтру)
              </td>
              <td className="px-4 py-3 text-sm">
                <div className="space-y-0.5">
                  <div className="text-green-700 font-semibold">
                    Приход: {filteredTotals.income.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-red-700 font-semibold">
                    Расход: {filteredTotals.expense.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className="text-blue-700 font-semibold">
                    Переводы: {filteredTotals.transfer.toLocaleString('ru-RU')} ₽
                  </div>
                  <div className={`font-bold ${filteredTotals.result >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    Результат: {filteredTotals.result.toLocaleString('ru-RU')} ₽
                  </div>
                </div>
              </td>
              <td colSpan={5}></td>
            </tr>
          </tfoot>
        </table>
        )}
      </div>
    </div>
  )
}
