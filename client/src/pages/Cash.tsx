import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Wallet, Plus, Edit2, Trash2, ArrowUp, ArrowDown, Search, X, EyeOff, Eye, Ship } from 'lucide-react'
import { vesselOwnerCashesService, vesselsService, incomeCategoriesService, expenseCategoriesService } from '../services/api'
import { VesselOwnerCash, CashTransaction, CashBalance, CashTransactionType, CashPaymentMethod, Currency, Vessel, IncomeCategory, VesselOwnerExpenseCategory } from '../types'
import { LoadingAnimation } from '../components/LoadingAnimation'
import BackButton from '../components/BackButton'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'

export default function Cash() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [vesselBalances, setVesselBalances] = useState<Record<number, number>>({})
  const [selectedVessel, setSelectedVessel] = useState<Vessel | null>(null)
  const [cashes, setCashes] = useState<VesselOwnerCash[]>([])
  const [selectedCash, setSelectedCash] = useState<VesselOwnerCash | null>(null)
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [balance, setBalance] = useState<CashBalance | null>(null)
  const [incomeCategories, setIncomeCategories] = useState<IncomeCategory[]>([])
  const [expenseCategories, setExpenseCategories] = useState<VesselOwnerExpenseCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [vesselsLoading, setVesselsLoading] = useState(true)
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [savingTransaction, setSavingTransaction] = useState(false)
  const [showCashModal, setShowCashModal] = useState(false)
  const [showTransactionModal, setShowTransactionModal] = useState(false)
  const [isTransactionTypeLocked, setIsTransactionTypeLocked] = useState(false)
  const [editingCash, setEditingCash] = useState<VesselOwnerCash | null>(null)
  const [editingTransaction, setEditingTransaction] = useState<CashTransaction | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('')
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  const [showHiddenCashes, setShowHiddenCashes] = useState(false)

  const [cashForm, setCashForm] = useState({
    name: '',
    description: '',
    vesselId: '',
  })

  const [transactionForm, setTransactionForm] = useState({
    transactionType: CashTransactionType.INCOME,
    amount: '',
    currency: Currency.RUB,
    paymentMethod: CashPaymentMethod.CASH,
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    counterparty: '',
    categoryId: '',
    expenseCategoryId: '',
  })

  useEffect(() => {
    loadVessels()
    loadIncomeCategories()
    loadExpenseCategories()
  }, [searchParams])

  useEffect(() => {
    if (selectedVessel) {
      loadCashes()
      // Обновляем баланс катера при изменении выбора
      if (selectedVessel.id && !vesselBalances[selectedVessel.id]) {
        loadVesselBalance(selectedVessel.id).then((balance) => {
          setVesselBalances(prev => ({ ...prev, [selectedVessel.id]: balance }))
        })
      }
    } else {
      setCashes([])
      setSelectedCash(null)
      setTransactions([])
      setBalance(null)
    }
  }, [selectedVessel, showHiddenCashes])

  useEffect(() => {
    if (selectedCash) {
      loadTransactions()
      loadBalance()
    }
  }, [selectedCash, filterType, filterPaymentMethod, dateFrom, dateTo])

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

  const loadVessels = async () => {
    try {
      setVesselsLoading(true)
      const response = await vesselsService.getAll({ limit: 100 })
      const vesselsData = response.data || []
      // Фильтруем только катера текущего пользователя
      const userVessels = vesselsData.filter((vessel: Vessel) => vessel.ownerId === user?.id)
      setVessels(userVessels)
      
      // Загружаем балансы для всех катеров
      const balances: Record<number, number> = {}
      for (const vessel of userVessels) {
        balances[vessel.id] = await loadVesselBalance(vessel.id)
      }
      setVesselBalances(balances)
      
      // Проверяем, есть ли vesselId в URL параметрах
      const vesselIdParam = searchParams.get('vesselId')
      if (vesselIdParam) {
        const vesselId = parseInt(vesselIdParam)
        const vessel = userVessels.find((v: Vessel) => v.id === vesselId)
        if (vessel) {
          setSelectedVessel(vessel)
          // Удаляем параметр из URL после использования
          setSearchParams({}, { replace: true })
        } else if (userVessels.length > 0) {
          // Если катер не найден, выбираем первый
          setSelectedVessel(userVessels[0])
        }
      } else if (userVessels.length > 0 && !selectedVessel) {
        setSelectedVessel(userVessels[0])
      }
    } catch (error: any) {
      console.error('Ошибка загрузки катеров:', error)
      alert(error.error || error.message || 'Ошибка загрузки катеров')
    } finally {
      setVesselsLoading(false)
      setLoading(false)
    }
  }

  const loadCashes = async () => {
    if (!selectedVessel) return

    try {
      setLoading(true)
      const params: any = { limit: 100, vesselId: selectedVessel.id }
      if (showHiddenCashes) {
        params.includeHidden = true
      }
      const response = await vesselOwnerCashesService.getAll(params)
      const cashesData = response.data || []
      // Сортируем: сначала активные кассы, потом скрытые
      const sortedCashes = [...cashesData].sort((a, b) => {
        if (a.isActive && !b.isActive) return -1
        if (!a.isActive && b.isActive) return 1
        return 0
      })
      setCashes(sortedCashes)
      if (sortedCashes.length > 0 && !selectedCash) {
        // Выбираем первую активную кассу, если есть
        const activeCash = sortedCashes.find((c: VesselOwnerCash) => c.isActive) || sortedCashes[0]
        setSelectedCash(activeCash)
      } else if (sortedCashes.length === 0) {
        setSelectedCash(null)
        setTransactions([])
        setBalance(null)
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
      // Проверяем структуру ответа - может быть response.data или response напрямую
      const transactionsData = response?.data || response || []
      setTransactions(Array.isArray(transactionsData) ? transactionsData : [])
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

  const loadIncomeCategories = async () => {
    try {
      const response = await incomeCategoriesService.getAll({ limit: 100 })
      setIncomeCategories(response.data || [])
    } catch (error: any) {
      console.error('Ошибка загрузки категорий приходов:', error)
    }
  }

  const loadExpenseCategories = async () => {
    try {
      const response = await expenseCategoriesService.getAll({ limit: 100 })
      setExpenseCategories(response.data || [])
    } catch (error: any) {
      console.error('Ошибка загрузки категорий расходов:', error)
    }
  }

  const handleOpenCashModal = (cash?: VesselOwnerCash) => {
    if (cash) {
      setEditingCash(cash)
      setCashForm({
        name: cash.name,
        description: cash.description || '',
        vesselId: (cash.vesselId || selectedVessel?.id)?.toString() || '',
      })
    } else {
      setEditingCash(null)
      setCashForm({
        name: '',
        description: '',
        vesselId: selectedVessel?.id?.toString() || '',
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
      vesselId: selectedVessel?.id?.toString() || '',
    })
  }

  const handleSaveCash = async () => {
    if (!cashForm.name.trim()) {
      alert('Название кассы обязательно')
      return
    }

    if (!cashForm.vesselId) {
      alert('Необходимо выбрать катер')
      return
    }

    try {
      const cashData = {
        ...cashForm,
        vesselId: parseInt(cashForm.vesselId),
      }
      if (editingCash) {
        await vesselOwnerCashesService.update(editingCash.id, cashData)
      } else {
        await vesselOwnerCashesService.create(cashData)
      }
      await loadCashes()
      // Обновляем баланс катера после изменения кассы
      if (selectedVessel?.id) {
        const newBalance = await loadVesselBalance(selectedVessel.id)
        setVesselBalances(prev => ({ ...prev, [selectedVessel.id]: newBalance }))
      }
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
      // Обновляем баланс катера после удаления кассы
      if (selectedVessel?.id) {
        const newBalance = await loadVesselBalance(selectedVessel.id)
        setVesselBalances(prev => ({ ...prev, [selectedVessel.id]: newBalance }))
      }
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
      // Обновляем баланс катера после скрытия кассы
      if (selectedVessel?.id) {
        const newBalance = await loadVesselBalance(selectedVessel.id)
        setVesselBalances(prev => ({ ...prev, [selectedVessel.id]: newBalance }))
      }
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка скрытия кассы')
    }
  }

  const handleRestoreCash = async (cash: VesselOwnerCash) => {
    if (!confirm(`Восстановить кассу "${cash.name}"?`)) return

    try {
      await vesselOwnerCashesService.update(cash.id, { isActive: true })
      await loadCashes()
      // Обновляем баланс катера после восстановления кассы
      if (selectedVessel?.id) {
        const newBalance = await loadVesselBalance(selectedVessel.id)
        setVesselBalances(prev => ({ ...prev, [selectedVessel.id]: newBalance }))
      }
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка восстановления кассы')
    }
  }

  const handleOpenTransactionModal = (transaction?: CashTransaction, lockType: boolean = false, transactionType?: CashTransactionType) => {
    if (transaction) {
      setEditingTransaction(transaction)
      setIsTransactionTypeLocked(false) // При редактировании можно менять тип
      setTransactionForm({
        transactionType: transaction.transactionType,
        amount: transaction.amount.toString(),
        currency: transaction.currency as Currency,
        paymentMethod: transaction.paymentMethod,
        date: format(new Date(transaction.date), 'yyyy-MM-dd'),
        description: transaction.description || '',
        counterparty: transaction.counterparty || '',
        categoryId: transaction.categoryId?.toString() || '',
        expenseCategoryId: transaction.expenseCategoryId?.toString() || '',
      })
    } else {
      setEditingTransaction(null)
      setIsTransactionTypeLocked(lockType) // Блокируем тип, если открыто из кнопки
      setTransactionForm({
        transactionType: transactionType || transactionForm.transactionType || CashTransactionType.INCOME,
        amount: '',
        currency: Currency.RUB,
        paymentMethod: CashPaymentMethod.CASH,
        date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        counterparty: '',
        categoryId: '',
        expenseCategoryId: '',
      })
    }
    setShowTransactionModal(true)
  }

  const handleCloseTransactionModal = () => {
    setShowTransactionModal(false)
    setEditingTransaction(null)
    setIsTransactionTypeLocked(false)
    setTransactionForm({
      transactionType: CashTransactionType.INCOME,
      amount: '',
      currency: Currency.RUB,
      paymentMethod: CashPaymentMethod.CASH,
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      counterparty: '',
      categoryId: '',
      expenseCategoryId: '',
    })
  }

  const handleSaveTransaction = async () => {
    if (savingTransaction) return // Предотвращаем повторное нажатие
    
    if (!selectedCash) {
      alert('Выберите кассу')
      return
    }

    if (!transactionForm.amount || parseFloat(transactionForm.amount) <= 0) {
      alert('Введите корректную сумму')
      return
    }

    try {
      setSavingTransaction(true)
      
      const categoryIdValue = transactionForm.transactionType === CashTransactionType.INCOME 
        && transactionForm.categoryId && transactionForm.categoryId !== '' 
        ? parseInt(transactionForm.categoryId) 
        : null;
      
      const expenseCategoryIdValue = transactionForm.transactionType === CashTransactionType.EXPENSE 
        && transactionForm.expenseCategoryId && transactionForm.expenseCategoryId !== '' 
        ? parseInt(transactionForm.expenseCategoryId) 
        : null;
      
      const transactionData = {
        transactionType: transactionForm.transactionType,
        amount: transactionForm.amount,
        currency: transactionForm.currency,
        paymentMethod: transactionForm.paymentMethod,
        date: transactionForm.date,
        description: transactionForm.description || undefined,
        counterparty: transactionForm.counterparty || undefined,
        categoryId: categoryIdValue,
        expenseCategoryId: expenseCategoryIdValue,
      }
      if (editingTransaction) {
        await vesselOwnerCashesService.updateTransaction(
          selectedCash.id,
          editingTransaction.id,
          transactionData
        )
      } else {
        await vesselOwnerCashesService.createTransaction(selectedCash.id, transactionData)
      }
      await loadTransactions()
      await loadBalance()
      // Обновляем баланс катера после изменения транзакции
      if (selectedVessel?.id) {
        const newBalance = await loadVesselBalance(selectedVessel.id)
        setVesselBalances(prev => ({ ...prev, [selectedVessel.id]: newBalance }))
      }
      handleCloseTransactionModal()
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка сохранения транзакции')
    } finally {
      setSavingTransaction(false)
    }
  }

  const handleDeleteTransaction = async (transaction: CashTransaction) => {
    if (!selectedCash) return

    if (!confirm('Вы уверены, что хотите удалить эту транзакцию?')) return

    try {
      await vesselOwnerCashesService.deleteTransaction(selectedCash.id, transaction.id)
      await loadTransactions()
      await loadBalance()
      // Обновляем баланс катера после удаления транзакции
      if (selectedVessel?.id) {
        const newBalance = await loadVesselBalance(selectedVessel.id)
        setVesselBalances(prev => ({ ...prev, [selectedVessel.id]: newBalance }))
      }
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

  if (vesselsLoading || (loading && !selectedVessel)) {
    return <LoadingAnimation message={vesselsLoading ? "Загрузка катеров..." : "Загрузка касс..."} />
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Касса</h1>
            <p className="mt-2 text-gray-600">Управление кассами и транзакциями</p>
          </div>
        </div>
      </div>

      {/* Выбор катера */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Выбор катера</h2>
        </div>
        {vessels.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет катеров. Сначала добавьте катер.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {vessels.map((vessel) => {
              const vesselBalance = vesselBalances[vessel.id] || 0
              return (
                <div
                  key={vessel.id}
                  onClick={() => setSelectedVessel(vessel)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedVessel?.id === vessel.id
                      ? 'bg-primary-50 border-2 border-primary-500'
                      : 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                  }`}
                >
                  <Ship className="h-4 w-4 text-gray-600" />
                  <span className="font-medium text-gray-900">{vessel.name}</span>
                  <span className={`text-sm font-semibold ${
                    vesselBalance >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ({Number(vesselBalance).toLocaleString('ru-RU', { 
                      minimumFractionDigits: 2, 
                      maximumFractionDigits: 2 
                    })} ₽)
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Выбор кассы */}
      {selectedVessel && (
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Выбор кассы для катера "{selectedVessel.name}"</h2>
            <div className="flex gap-2">
              <button
                onClick={() => setShowHiddenCashes(!showHiddenCashes)}
                className="flex items-center px-3 py-1.5 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700"
              >
                {showHiddenCashes ? (
                  <>
                    <Eye className="h-4 w-4 mr-1" />
                    Скрыть скрытые
                  </>
                ) : (
                  <>
                    <EyeOff className="h-4 w-4 mr-1" />
                    Показать скрытые
                  </>
                )}
              </button>
              <button
                onClick={() => handleOpenCashModal()}
                className="flex items-center px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700"
              >
                <Plus className="h-4 w-4 mr-1" />
                Создать кассу
              </button>
            </div>
          </div>
          {cashes.length === 0 ? (
            <p className="text-gray-500 text-sm">Нет касс для этого катера. Создайте первую кассу.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {cashes.map((cash) => (
                <div
                  key={cash.id}
                  onClick={() => setSelectedCash(cash)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                    selectedCash?.id === cash.id
                      ? 'bg-primary-50 border-2 border-primary-500'
                      : cash.isActive
                      ? 'bg-gray-50 border-2 border-transparent hover:bg-gray-100'
                      : 'bg-gray-100 border-2 border-gray-300 hover:bg-gray-200 opacity-75'
                  }`}
                >
                  <Wallet className={`h-4 w-4 ${cash.isActive ? 'text-gray-600' : 'text-gray-400'}`} />
                  <span className={`font-medium ${cash.isActive ? 'text-gray-900' : 'text-gray-500'}`}>
                    {cash.name}
                  </span>
                  {!cash.isActive && (
                    <span className="text-xs text-gray-400 bg-gray-200 px-2 py-0.5 rounded">Скрыта</span>
                  )}
                  {cash.description && (
                    <span className={`text-sm ${cash.isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                      ({cash.description})
                    </span>
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
                    {cash.isActive ? (
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
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRestoreCash(cash)
                        }}
                        className="p-1 text-gray-600 hover:text-green-600"
                        title="Восстановить кассу"
                      >
                        <Eye className="h-3 w-3" />
                      </button>
                    )}
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
      )}

      {/* Детали кассы и транзакции */}
      {selectedCash ? (
            <div className="space-y-6">
              {/* Заголовок и кнопки */}
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">{selectedCash.name}</h2>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        handleOpenTransactionModal(undefined, true, CashTransactionType.INCOME)
                      }}
                      className="flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                    >
                      <ArrowDown className="h-4 w-4 mr-1" />
                      Приход
                    </button>
                    <button
                      onClick={() => {
                        handleOpenTransactionModal(undefined, true, CashTransactionType.EXPENSE)
                      }}
                      className="flex items-center px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                    >
                      <ArrowUp className="h-4 w-4 mr-1" />
                      Расход
                    </button>
                  </div>
                </div>
              
              {/* Баланс кассы */}
              {balance && (
                <div>

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
              </div>

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
                          Категория
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
                          <td colSpan={8} className="px-6 py-4 text-center">
                            <LoadingAnimation message="Загрузка транзакций..." />
                          </td>
                        </tr>
                      ) : filteredTransactions.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-4 text-center text-gray-500">
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
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                              {transaction.transactionType === CashTransactionType.INCOME 
                                ? (transaction.incomeCategory ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                      {transaction.incomeCategory.name}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">Без категории</span>
                                  ))
                                : (transaction.expenseCategory ? (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                      {transaction.expenseCategory.name}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">Без категории</span>
                                  ))
                              }
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
                          Катер *
                        </label>
                        <select
                          value={cashForm.vesselId}
                          onChange={(e) => setCashForm({ ...cashForm, vesselId: e.target.value })}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                          disabled={!!editingCash}
                        >
                          <option value="">Выберите катер</option>
                          {vessels.map((vessel) => (
                            <option key={vessel.id} value={vessel.id}>
                              {vessel.name}
                            </option>
                          ))}
                        </select>
                      </div>
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
                      disabled={isTransactionTypeLocked}
                      className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 ${
                        isTransactionTypeLocked 
                          ? 'bg-gray-100 cursor-not-allowed' 
                          : 'bg-white'
                      }`}
                    >
                      <option value={CashTransactionType.INCOME}>Приход</option>
                      <option value={CashTransactionType.EXPENSE}>Расход</option>
                    </select>
                    {isTransactionTypeLocked && (
                      <p className="mt-1 text-xs text-gray-500">
                        Тип транзакции выбран автоматически
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      {transactionForm.transactionType === CashTransactionType.INCOME ? 'Категория прихода' : 'Категория расхода'}
                    </label>
                    <select
                      value={transactionForm.transactionType === CashTransactionType.INCOME 
                        ? transactionForm.categoryId 
                        : transactionForm.expenseCategoryId}
                      onChange={(e) => {
                        if (transactionForm.transactionType === CashTransactionType.INCOME) {
                          setTransactionForm({ ...transactionForm, categoryId: e.target.value, expenseCategoryId: '' })
                        } else {
                          setTransactionForm({ ...transactionForm, expenseCategoryId: e.target.value, categoryId: '' })
                        }
                      }}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    >
                      <option value="">Без категории</option>
                      {transactionForm.transactionType === CashTransactionType.INCOME
                        ? incomeCategories
                            .filter((cat) => cat.isActive)
                            .map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))
                        : expenseCategories
                            .filter((cat) => cat.isActive)
                            .map((category) => (
                              <option key={category.id} value={category.id}>
                                {category.name}
                              </option>
                            ))}
                    </select>
                    {transactionForm.transactionType === CashTransactionType.INCOME 
                      ? incomeCategories.filter((cat) => cat.isActive).length === 0 && (
                          <p className="mt-1 text-xs text-gray-500">
                            Нет доступных категорий. Создайте категории в разделе "Приходы"
                          </p>
                        )
                      : expenseCategories.filter((cat) => cat.isActive).length === 0 && (
                          <p className="mt-1 text-xs text-gray-500">
                            Нет доступных категорий. Создайте категории в разделе "Расходы"
                          </p>
                        )}
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
                  disabled={savingTransaction}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm ${
                    savingTransaction
                      ? 'bg-primary-400 cursor-not-allowed'
                      : 'bg-primary-600 hover:bg-primary-700'
                  }`}
                >
                  {savingTransaction 
                    ? 'Сохранение...' 
                    : editingTransaction 
                      ? 'Сохранить' 
                      : 'Создать'}
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
