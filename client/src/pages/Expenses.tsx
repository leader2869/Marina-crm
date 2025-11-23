import { useState, useEffect } from 'react'
import { TrendingDown, Plus, Edit2, Trash2, X, Tag, Wallet } from 'lucide-react'
import { 
  expenseCategoriesService, 
  vesselOwnerCashesService 
} from '../services/api'
import { 
  VesselOwnerExpenseCategory, 
  CashTransaction,
  CashTransactionType,
  CashPaymentMethod
} from '../types'
import { LoadingAnimation } from '../components/LoadingAnimation'
import { format } from 'date-fns'
import BackButton from '../components/BackButton'

export default function Expenses() {
  const [categories, setCategories] = useState<VesselOwnerExpenseCategory[]>([])
  const [transactions, setTransactions] = useState<CashTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [transactionsLoading, setTransactionsLoading] = useState(false)
  const [savingCategory, setSavingCategory] = useState(false)
  const [assigningCategory, setAssigningCategory] = useState(false)
  
  // Модальные окна
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showAssignCategoryModal, setShowAssignCategoryModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<VesselOwnerExpenseCategory | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<CashTransaction | null>(null)
  
  // Фильтры
  const [selectedCategory, setSelectedCategory] = useState<number | ''>('')
  const [dateFrom, setDateFrom] = useState<string>('')
  const [dateTo, setDateTo] = useState<string>('')
  
  // Формы
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadTransactions()
  }, [selectedCategory, dateFrom, dateTo])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadCategories(),
        loadTransactions(),
      ])
    } catch (error) {
      console.error('Ошибка загрузки данных:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadCategories = async () => {
    try {
      setCategoriesLoading(true)
      const response = await expenseCategoriesService.getAll({ limit: 100 })
      setCategories(response.data || [])
    } catch (error: any) {
      console.error('Ошибка загрузки категорий:', error)
      alert(error.error || error.message || 'Ошибка загрузки категорий')
    } finally {
      setCategoriesLoading(false)
    }
  }

  const loadTransactions = async () => {
    try {
      setTransactionsLoading(true)
      // Загружаем все кассы пользователя
      const cashesResponse = await vesselOwnerCashesService.getAll({ limit: 100 })
      const cashes = cashesResponse.data || []
      
      // Загружаем все транзакции типа EXPENSE из всех касс
      const allTransactions: CashTransaction[] = []
      for (const cash of cashes) {
        try {
          const params: any = {
            limit: 1000,
            transactionType: CashTransactionType.EXPENSE,
          }
          if (selectedCategory) params.expenseCategoryId = selectedCategory
          if (dateFrom) params.startDate = dateFrom
          if (dateTo) params.endDate = dateTo
          
          const transactionsResponse = await vesselOwnerCashesService.getTransactions(
            cash.id,
            params
          )
          const cashTransactions = transactionsResponse.data || []
          allTransactions.push(...cashTransactions)
        } catch (error) {
          console.error(`Ошибка загрузки транзакций для кассы ${cash.id}:`, error)
        }
      }
      
      // Сортируем по дате (новые сначала)
      allTransactions.sort((a, b) => {
        const dateA = new Date(a.date).getTime()
        const dateB = new Date(b.date).getTime()
        return dateB - dateA
      })
      
      setTransactions(allTransactions)
    } catch (error: any) {
      console.error('Ошибка загрузки транзакций:', error)
      alert(error.error || error.message || 'Ошибка загрузки транзакций')
    } finally {
      setTransactionsLoading(false)
    }
  }

  const handleOpenCategoryModal = (category?: VesselOwnerExpenseCategory) => {
    if (category) {
      setEditingCategory(category)
      setCategoryForm({
        name: category.name,
        description: category.description || '',
      })
    } else {
      setEditingCategory(null)
      setCategoryForm({
        name: '',
        description: '',
      })
    }
    setShowCategoryModal(true)
  }

  const handleCloseCategoryModal = () => {
    setShowCategoryModal(false)
    setEditingCategory(null)
    setCategoryForm({
      name: '',
      description: '',
    })
  }

  const handleSaveCategory = async () => {
    if (savingCategory) return // Предотвращаем повторное нажатие
    
    if (!categoryForm.name.trim()) {
      alert('Название категории обязательно')
      return
    }

    try {
      setSavingCategory(true)
      
      if (editingCategory) {
        await expenseCategoriesService.update(editingCategory.id, categoryForm)
      } else {
        await expenseCategoriesService.create(categoryForm)
      }
      
      await loadCategories()
      handleCloseCategoryModal()
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка сохранения категории')
    } finally {
      setSavingCategory(false)
    }
  }

  const handleDeleteCategory = async (categoryId: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту категорию?')) return

    try {
      await expenseCategoriesService.delete(categoryId)
      await loadCategories()
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка удаления категории')
    }
  }

  const handleOpenAssignCategoryModal = (transaction: CashTransaction) => {
    setSelectedTransaction(transaction)
    setShowAssignCategoryModal(true)
  }

  const handleCloseAssignCategoryModal = () => {
    setShowAssignCategoryModal(false)
    setSelectedTransaction(null)
  }

  const handleAssignCategory = async (categoryId: number | null) => {
    if (!selectedTransaction || assigningCategory) return

    try {
      setAssigningCategory(true)
      await vesselOwnerCashesService.updateTransaction(
        selectedTransaction.cashId,
        selectedTransaction.id,
        { expenseCategoryId: categoryId || null }
      )
      await loadTransactions()
      handleCloseAssignCategoryModal()
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка привязки категории')
    } finally {
      setAssigningCategory(false)
    }
  }

  // Группируем транзакции по категориям для статистики
  const transactionsByCategory = transactions.reduce((acc, transaction) => {
    const categoryId = transaction.expenseCategoryId || 0
    const categoryName = transaction.expenseCategory?.name || 'Без категории'
    if (!acc[categoryId]) {
      acc[categoryId] = {
        categoryId,
        categoryName,
        transactions: [],
        total: 0,
      }
    }
    acc[categoryId].transactions.push(transaction)
    acc[categoryId].total += transaction.amount
    return acc
  }, {} as Record<number, { categoryId: number; categoryName: string; transactions: CashTransaction[]; total: number }>)

  const totalExpense = Number(transactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0))
  const uncategorizedTotal = Number(transactions
    .filter(t => !t.expenseCategoryId)
    .reduce((sum, t) => sum + Number(t.amount), 0))

  if (loading) {
    return <LoadingAnimation message="Загрузка расходов..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <BackButton />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Расходы</h1>
            <p className="mt-2 text-gray-600">Управление категориями расходов и просмотр расходов из касс</p>
          </div>
        </div>
        <button
          onClick={() => handleOpenCategoryModal()}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="h-5 w-5 mr-2" />
          Создать категорию
        </button>
      </div>

      {/* Статистика */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <TrendingDown className="h-6 w-6 text-red-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Общие расходы</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Общая сумма расходов</p>
            <p className="text-3xl font-bold text-red-600">
              {Number(totalExpense).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Всего транзакций: {transactions.length}
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">С категориями</p>
            <p className="text-3xl font-bold text-blue-600">
              {Number(totalExpense - uncategorizedTotal).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {Object.keys(transactionsByCategory).filter(k => k !== '0').length} категорий
            </p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Без категорий</p>
            <p className="text-3xl font-bold text-yellow-600">
              {Number(uncategorizedTotal).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {transactions.filter(t => !t.expenseCategoryId).length} транзакций
            </p>
          </div>
        </div>
      </div>

      {/* Категории */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Tag className="h-5 w-5 mr-2" />
            Категории расходов
          </h2>
        </div>
        {categoriesLoading ? (
          <LoadingAnimation message="Загрузка категорий..." />
        ) : categories.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет категорий. Создайте первую категорию.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => {
              const categoryTransactions = transactions.filter(t => t.expenseCategoryId === category.id)
              const categoryTotal = Number(categoryTransactions.reduce((sum, t) => sum + Number(t.amount), 0))
              return (
                <div
                  key={category.id}
                  className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{category.name}</h3>
                      {category.description && (
                        <p className="text-sm text-gray-600 mt-1">{category.description}</p>
                      )}
                      <p className="text-sm text-red-600 font-semibold mt-2">
                        {Number(categoryTotal).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {categoryTransactions.length} транзакций
                      </p>
                    </div>
                    <div className="flex gap-1 ml-2">
                      <button
                        onClick={() => handleOpenCategoryModal(category)}
                        className="p-1 text-gray-600 hover:text-primary-600"
                        title="Редактировать"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(category.id)}
                        className="p-1 text-gray-600 hover:text-red-600"
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Фильтры</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Категория
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value ? parseInt(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Все категории</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата от
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата до
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div className="flex items-end">
            {(dateFrom || dateTo) && (
              <button
                onClick={() => {
                  setDateFrom('')
                  setDateTo('')
                }}
                className="w-full px-3 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Сбросить даты
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Список транзакций */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Расходы из касс</h2>
        </div>
        {transactionsLoading ? (
          <div className="p-12 text-center">
            <LoadingAnimation message="Загрузка расходов..." />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingDown className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Расходы не найдены</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Дата
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Касса
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Категория
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Сумма
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Способ оплаты
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Описание
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Действия
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(transaction.date), 'dd.MM.yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center">
                        <Wallet className="h-4 w-4 mr-1 text-gray-400" />
                        {transaction.cash?.name || 'Не указана'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.expenseCategory ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          {transaction.expenseCategory.name}
                        </span>
                      ) : (
                        <span className="text-gray-400">Без категории</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {transaction.amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {transaction.currency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {transaction.paymentMethod === CashPaymentMethod.CASH ? 'Наличные' : 'Безналичные'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {transaction.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleOpenAssignCategoryModal(transaction)}
                        className="text-primary-600 hover:text-primary-900"
                        title="Привязать категорию"
                      >
                        <Tag className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Модальное окно категории */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={handleCloseCategoryModal}
            />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingCategory ? 'Редактировать категорию' : 'Создать категорию'}
                  </h3>
                  <button onClick={handleCloseCategoryModal} className="text-gray-400 hover:text-gray-500">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Название категории *
                    </label>
                    <input
                      type="text"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Например: Расход на топливо"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Описание</label>
                    <textarea
                      value={categoryForm.description}
                      onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                      rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Описание категории (необязательно)"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSaveCategory}
                  disabled={savingCategory}
                  className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm ${
                    savingCategory
                      ? 'bg-primary-400 cursor-not-allowed'
                      : 'bg-primary-600 hover:bg-primary-700'
                  }`}
                >
                  {savingCategory ? 'Сохранение...' : editingCategory ? 'Сохранить' : 'Создать'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseCategoryModal}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно привязки категории */}
      {showAssignCategoryModal && selectedTransaction && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={handleCloseAssignCategoryModal}
            />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    Привязать категорию к расходу
                  </h3>
                  <button onClick={handleCloseAssignCategoryModal} className="text-gray-400 hover:text-gray-500">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 mb-2">
                      Сумма: <span className="font-semibold">{selectedTransaction.amount.toLocaleString('ru-RU')} {selectedTransaction.currency}</span>
                    </p>
                    <p className="text-sm text-gray-600 mb-4">
                      Дата: <span className="font-semibold">{format(new Date(selectedTransaction.date), 'dd.MM.yyyy')}</span>
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Категория
                    </label>
                    <select
                      value={selectedTransaction.expenseCategoryId || ''}
                      onChange={(e) => {
                        const newCategoryId = e.target.value ? parseInt(e.target.value) : null
                        handleAssignCategory(newCategoryId)
                      }}
                      disabled={assigningCategory}
                      className={`mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 ${
                        assigningCategory ? 'bg-gray-100 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="">Без категории</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleCloseAssignCategoryModal}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Закрыть
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
