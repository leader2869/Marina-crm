import { useState, useEffect } from 'react'
import { Wallet, Plus, Edit2, Trash2, ArrowUp, ArrowDown, Search, X, EyeOff } from 'lucide-react'
import { vesselOwnerCashesService } from '../services/api'
import { VesselOwnerCash, CashTransaction, CashBalance, CashTransactionType, CashPaymentMethod, Currency } from '../types'
import { LoadingAnimation } from '../components/LoadingAnimation'
import { format } from 'date-fns'

export default function Cash() {
  const [cashes, setCashes] = useState<VesselOwnerCash[]>([])
  const [selectedCash, setSelectedCash] = useState<VesselOwnerCash | null>(null)
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [balance, setBalance] = useState<CashBalance | null>(null)
  const [loading, setLoading] = useState(true)
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [showCashModal, setShowCashModal] = useState(false)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [editingCash, setEditingCash] = useState<VesselOwnerCash | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<CashTransaction | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')

  const [cashForm, setCashForm] = useState({
    name: '',
    description: '',
  })

  const [transactionForm, setTransactionForm] = useState({
    transactionType: CashTransactionType.INCOME,
    amount: '',
    currency: Currency.RUB,
    paymentMethod: CashPaymentMethod.CASH,
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    counterparty: '',
  })

  useEffect(() => {
    loadCashes()
  }, [])

  useEffect(() => {
    if (selectedCash) {
      loadTransactions()
      loadBalance()
    }
  }, [selectedCash, filterType, filterPaymentMethod, dateFrom, dateTo])

  const loadCashes = async () => {
    try {
      setLoading(true)
      const response = await vesselOwnerCashesService.getAll({ limit: 100 })
      const cashesData = response.data || []
      setCashes(cashesData)
      if (cashesData.length > 0 && !selectedCash) {
        setSelectedCash(cashesData[0])
      }
    } catch (error: any) {
      console.error('Ошибка загрузки касс:', error)
      alert(error.error || error.message || 'Ошибка загрузки касс')
    } finally {
      setLoading(false)
    }
  }

  const loadTransactions = async () => {
    if (!selectedCash) return

    try {
      setTransactionsLoading(true)
      const params: any = { limit: 100 }
      if (filterType) params.transactionType = filterType
      if (filterPaymentMethod) params.paymentMethod = filterPaymentMethod
      if (dateFrom) params.startDate = dateFrom
      if (dateTo) params.endDate = dateTo

      const response = await vesselOwnerCashesService.getTransactions(selectedCash.id, params)
      const transactionsData = response.data || []
      setTransactions(transactionsData)
    } catch (error: any) {
      console.error('Ошибка загрузки транзакций:', error)
      alert(error.error || error.message || 'Ошибка загрузки транзакций')
    } finally {
      setTransactionsLoading(false)
    }
  }

  const loadBalance = async () => {
    if (!selectedCash) return

    try {
      const params: any = {}
      if (dateFrom) params.startDate = dateFrom
      if (dateTo) params.endDate = dateTo
      const response: any = await vesselOwnerCashesService.getBalance(selectedCash.id, params)
      setBalance(response as CashBalance)
    } catch (error: any) {
      console.error('Ошибка загрузки баланса:', error)
    }
  }

  const handleOpenCashModal = (cash?: VesselOwnerCash) => {
    if (cash) {
      setEditingCash(cash)
      setCashForm({
        name: cash.name,
        description: cash.description || '',
      })
    } else {
      setEditingCash(null)
      setCashForm({
        name: '',
        description: '',
      })
    }
    setShowCashModal(true)
  }

  const handleCloseCashModal = () => {
    setShowCashModal(false)
    setEditingCash(null)
    setCashForm({
      name: '',
      description: '',
    })
  }

  const handleSaveCash = async () => {
    if (!cashForm.name.trim()) {
      alert('Название кассы обязательно')
      return
    }

    try {
      if (editingCash) {
        await vesselOwnerCashesService.update(editingCash.id, cashForm)
      } else {
        await vesselOwnerCashesService.create(cashForm)
      }
      await loadCashes()
      handleCloseCashModal()
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка сохранения кассы')
    }
  }

  const handleDeleteCash = async (cash: VesselOwnerCash) => {
    if (!confirm(`Вы уверены, что хотите удалить кассу "${cash.name}"?`)) return

    try {
      await vesselOwnerCashesService.delete(cash.id)
      if (selectedCash?.id === cash.id) {
        setSelectedCash(null)
        setTransactions([])
        setBalance(null)
      }
      await loadCashes()
    } catch (error: any) {
      const errorMessage = error.error || error.message || 'Ошибка удаления кассы'
      // Если ошибка связана с наличием транзакций, предлагаем скрыть кассу
      if (errorMessage.includes('транзакций')) {
        if (confirm(`${errorMessage}\n\nСкрыть кассу вместо удаления?`)) {
          await handleHideCash(cash)
        }
      } else {
        alert(errorMessage)
      }
    }
  }

  const handleHideCash = async (cash: VesselOwnerCash) => {
    if (!confirm(`Скрыть кассу "${cash.name}"? Кассу можно будет восстановить позже.`)) return

    try {
      await vesselOwnerCashesService.update(cash.id, { isActive: false })
      if (selectedCash?.id === cash.id) {
        setSelectedCash(null)
        setTransactions([])
        setBalance(null)
      }
      await loadCashes()
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка скрытия кассы')
    }
  }

  const handleOpenTransactionModal = (transaction?: CashTransaction) => {
    if (transaction) {
      setEditingTransaction(transaction)
      setTransactionForm({
        transactionType: transaction.transactionType,
        amount: transaction.amount.toString(),
        currency: transaction.currency as Currency,
        paymentMethod: transaction.paymentMethod,
        date: format(new Date(transaction.date), 'yyyy-MM-dd'),
        description: transaction.description || '',
        counterparty: transaction.counterparty || '',
      })
    } else {
      setEditingTransaction(null)
      setTransactionForm({
        transactionType: CashTransactionType.INCOME,
        amount: '',
        currency: Currency.RUB,
        paymentMethod: CashPaymentMethod.CASH,
        date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        counterparty: '',
      })
    }
    setShowTransactionModal(true)
  }

  const handleCloseTransactionModal = () => {
    setShowTransactionModal(false)
    setEditingTransaction(null)
    setTransactionForm({
      transactionType: CashTransactionType.INCOME,
      amount: '',
      currency: Currency.RUB,
      paymentMethod: CashPaymentMethod.CASH,
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      counterparty: '',
    })
  }

  const handleSaveTransaction = async () => {
    if (!selectedCash) {
      alert('Выберите кассу')
      return
    }

    if (!transactionForm.amount || parseFloat(transactionForm.amount) <= 0) {
      alert('Введите корректную сумму')
      return
    }

    try {
      if (editingTransaction) {
        await vesselOwnerCashesService.updateTransaction(
          selectedCash.id,
          editingTransaction.id,
          transactionForm
        )
      } else {
        await vesselOwnerCashesService.createTransaction(selectedCash.id, transactionForm)
      }
      await loadTransactions()
      await loadBalance()
      handleCloseTransactionModal()
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка сохранения транзакции')
    }
  }

  const handleDeleteTransaction = async (transaction: CashTransaction) => {
    if (!selectedCash) return

    if (!confirm('Вы уверены, что хотите удалить эту транзакцию?')) return

    try {
      await vesselOwnerCashesService.deleteTransaction(selectedCash.id, transaction.id)
      await loadTransactions()
      await loadBalance()
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка удаления транзакции')
    }
  }

  const filteredTransactions = transactions.filter((transaction) => {
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      return (
        transaction.description?.toLowerCase().includes(searchLower) ||
        transaction.counterparty?.toLowerCase().includes(searchLower) ||
        transaction.amount.toString().includes(searchTerm)
      )
    }
    return true
  })

  if (loading) {
    return <LoadingAnimation message="Загрузка касс..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Касса</h1>
          <p className="mt-2 text-gray-600">Управление кассами и транзакциями</p>
        </div>
      </div>

      {/* Выбор кассы сверху */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Выбор кассы</h2>
          <button
            onClick={() => handleOpenCashModal()}
            className="flex items-center px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
          >
            <Plus className="h-4 w-4 mr-1" />
            Создать кассу
          </button>
        </div>
        {cashes.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет касс. Создайте первую кассу.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {cashes.map((cash) => (
              <div
                key={cash.id}
                onClick={() => setSelectedCash(cash)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                  selectedCash?.id === cash.id
                    ? 'bg-primary-50 border-2 border-primary-500'
                    : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                }`}
              >
                <Wallet className="h-4 w-4 text-gray-600" />
                <span className="font-medium text-gray-900">{cash.name}</span>
                {cash.description && (
                  <span className="text-sm text-gray-600">({cash.description})</span>
                )}
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleOpenCashModal(cash)
                    }}
                    className="p-1 text-gray-600 hover:text-primary-600"
                    title="Редактировать"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleHideCash(cash)
                    }}
                    className="p-1 text-gray-600 hover:text-orange-600"
                    title="Скрыть кассу"
                  >
                    <EyeOff className="h-3 w-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteCash(cash)
                    }}
                    className="p-1 text-gray-600 hover:text-red-600"
                    title="Удалить кассу (только если нет транзакций)"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Детали кассы и транзакции */}
      {selectedCash ? (
            <div className="space-y-6">
              {/* Баланс кассы */}
              {balance && (
                <div className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">{selectedCash.name}</h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleOpenTransactionModal()}
                        className="flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                      >
                        <ArrowDown className="h-4 w-4 mr-1" />
                        Приход
                      </button>
                      <button
                        onClick={() => {
                          setTransactionForm((prev) => ({
                            ...prev,
                            transactionType: CashTransactionType.EXPENSE,
                          }))
                          handleOpenTransactionModal()
                        }}
                        className="flex items-center px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                      >
                        <ArrowUp className="h-4 w-4 mr-1" />
                        Расход
                      </button>
                    </div>
                  </div>

                  {/* Выбор периода */}
                  <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4 flex-wrap">
                      <label className="text-sm font-medium text-gray-700">Период:</label>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">От:</label>
                        <input
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-gray-600">До:</label>
                        <input
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                          className="px-3 py-1.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 bg-white"
                        />
                      </div>
                      {(dateFrom || dateTo) && (
                        <button
                          onClick={() => {
                            setDateFrom('')
                            setDateTo('')
                          }}
                          className="px-3 py-1.5 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                        >
                          Сбросить
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Приход</p>
                      <p className="text-2xl font-bold text-green-600">
                        {balance.totalIncome.toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Расход</p>
                      <p className="text-2xl font-bold text-red-600">
                        {balance.totalExpense.toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Баланс</p>
                      <p
                        className={`text-2xl font-bold ${
                          balance.balance >= 0 ? 'text-blue-600' : 'text-red-600'
                        }`}
                      >
                        {balance.balance.toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Наличные</p>
                      <p className="text-2xl font-bold text-gray-700">
                        {balance.balanceByPaymentMethod.cash.toLocaleString('ru-RU')} ₽
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Фильтры */}
              <div className="bg-white rounded-lg shadow p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Поиск..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 bg-white"
                    />
                  </div>
                  <select
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 bg-white"
                  >
                    <option value="">Все типы</option>
                    <option value={CashTransactionType.INCOME}>Приход</option>
                    <option value={CashTransactionType.EXPENSE}>Расход</option>
                  </select>
                  <select
                    value={filterPaymentMethod}
                    onChange={(e) => setFilterPaymentMethod(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-900 bg-white"
                  >
                    <option value="">Все способы</option>
                    <option value={CashPaymentMethod.CASH}>Наличные</option>
                    <option value={CashPaymentMethod.NON_CASH}>Безналичные</option>
                  </select>
                  {(filterType || filterPaymentMethod || searchTerm) && (
                    <button
                      onClick={() => {
                        setFilterType('')
                        setFilterPaymentMethod('')
                        setSearchTerm('')
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
                    >
                      Сбросить
                    </button>
                  )}
                </div>
              </div>

              {/* Таблица транзакций */}
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Дата
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Тип
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Сумма
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Способ оплаты
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Описание
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                          Контрагент
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                          Действия
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {transactionsLoading ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 text-center">
                            <LoadingAnimation message="Загрузка транзакций..." />
                          </td>
                        </tr>
                      ) : filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                            Нет транзакций
                          </td>
                        </tr>
                      ) : (
                        filteredTransactions.map((transaction) => (
                          <tr key={transaction.id} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {format(new Date(transaction.date), 'dd.MM.yyyy')}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              {transaction.transactionType === CashTransactionType.INCOME ? (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-green-100 text-green-800">
                                  <ArrowDown className="h-3 w-3 mr-1" />
                                  Приход
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-red-100 text-red-800">
                                  <ArrowUp className="h-3 w-3 mr-1" />
                                  Расход
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                              {transaction.amount.toLocaleString('ru-RU')} ₽
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {transaction.paymentMethod === CashPaymentMethod.CASH
                                ? 'Наличные'
                                : 'Безналичные'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {transaction.description || '-'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {transaction.counterparty || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex justify-end gap-2">
                                <button
                                  onClick={() => handleOpenTransactionModal(transaction)}
                                  className="text-primary-600 hover:text-primary-900"
                                  title="Редактировать"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteTransaction(transaction)}
                                  className="text-red-600 hover:text-red-900"
                                  title="Удалить"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Выберите кассу для просмотра транзакций</p>
        </div>
      )}

      {/* Модальное окно создания/редактирования кассы */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={handleCloseCashModal}
            />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingCash ? 'Редактировать кассу' : 'Создать кассу'}
                  </h3>
                  <button onClick={handleCloseCashModal} className="text-gray-400 hover:text-gray-500">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Название кассы *
                    </label>
                    <input
                      type="text"
                      value={cashForm.name}
                      onChange={(e) => setCashForm({ ...cashForm, name: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      placeholder="Например: Касса капитана"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Описание</label>
                    <textarea
                      value={cashForm.description}
                      onChange={(e) => setCashForm({ ...cashForm, description: e.target.value })}
                      rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      placeholder="Описание кассы (необязательно)"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSaveCash}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {editingCash ? 'Сохранить' : 'Создать'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseCashModal}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно создания/редактирования транзакции */}
      {showTransactionModal && selectedCash && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={handleCloseTransactionModal}
            />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingTransaction
                      ? 'Редактировать транзакцию'
                      : transactionForm.transactionType === CashTransactionType.INCOME
                      ? 'Добавить приход'
                      : 'Добавить расход'}
                  </h3>
                  <button
                    onClick={handleCloseTransactionModal}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Тип транзакции *</label>
                    <select
                      value={transactionForm.transactionType}
                      onChange={(e) =>
                        setTransactionForm({
                          ...transactionForm,
                          transactionType: e.target.value as CashTransactionType,
                        })
                      }
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    >
                      <option value={CashTransactionType.INCOME}>Приход</option>
                      <option value={CashTransactionType.EXPENSE}>Расход</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Сумма *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={transactionForm.amount}
                      onChange={(e) => setTransactionForm({ ...transactionForm, amount: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Валюта</label>
                    <select
                      value={transactionForm.currency}
                      onChange={(e) =>
                        setTransactionForm({ ...transactionForm, currency: e.target.value as Currency })
                      }
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    >
                      <option value={Currency.RUB}>RUB</option>
                      <option value={Currency.USD}>USD</option>
                      <option value={Currency.EUR}>EUR</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Способ оплаты *</label>
                    <select
                      value={transactionForm.paymentMethod}
                      onChange={(e) =>
                        setTransactionForm({
                          ...transactionForm,
                          paymentMethod: e.target.value as CashPaymentMethod,
                        })
                      }
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    >
                      <option value={CashPaymentMethod.CASH}>Наличные</option>
                      <option value={CashPaymentMethod.NON_CASH}>Безналичные</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Дата *</label>
                    <input
                      type="date"
                      value={transactionForm.date}
                      onChange={(e) => setTransactionForm({ ...transactionForm, date: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Описание</label>
                    <textarea
                      value={transactionForm.description}
                      onChange={(e) =>
                        setTransactionForm({ ...transactionForm, description: e.target.value })
                      }
                      rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      placeholder="Описание транзакции"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Контрагент</label>
                    <input
                      type="text"
                      value={transactionForm.counterparty}
                      onChange={(e) =>
                        setTransactionForm({ ...transactionForm, counterparty: e.target.value })
                      }
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      placeholder="Имя контрагента"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSaveTransaction}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {editingTransaction ? 'Сохранить' : 'Создать'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseTransactionModal}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
