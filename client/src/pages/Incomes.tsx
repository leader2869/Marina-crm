import { useState, useEffect } from 'react'
import { TrendingUp, Plus, Edit2, Trash2, X, Tag } from 'lucide-react'
import { 
  incomeCategoriesService, 
  incomesService, 
  vesselsService, 
  vesselOwnerCashesService 
} from '../services/api'
import { 
  IncomeCategory, 
  Income, 
  Vessel, 
  VesselOwnerCash, 
  CashPaymentMethod, 
  Currency 
} from '../types'
import { LoadingAnimation } from '../components/LoadingAnimation'
import { format } from 'date-fns'
import { useAuth } from '../contexts/AuthContext'

export default function Incomes() {
  const { user } = useAuth()
  const [categories, setCategories] = useState<IncomeCategory[]>([])
  const [incomes, setIncomes] = useState<Income[]>([])
  const [vessels, setVessels] = useState<Vessel[]>([])
  const [cashes, setCashes] = useState<VesselOwnerCash[]>([])
  const [loading, setLoading] = useState(true)
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [incomesLoading, setIncomesLoading] = useState(false)
  
  // Модальные окна
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  const [showIncomeModal, setShowIncomeModal] = useState(false)
  const [editingCategory, setEditingCategory] = useState<IncomeCategory | null>(null)
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  
  // Фильтры
  const [selectedCategory, setSelectedCategory] = useState<number | ''>('')
  const [selectedVessel, setSelectedVessel] = useState<number | ''>('')
  const [selectedCash, setSelectedCash] = useState<number | ''>('')
  
  // Формы
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
  })
  
  const [incomeForm, setIncomeForm] = useState({
    categoryId: '',
    vesselId: '',
    cashId: '',
    amount: '',
    currency: Currency.RUB,
    paymentMethod: CashPaymentMethod.CASH,
    date: format(new Date(), 'yyyy-MM-dd'),
    description: '',
    counterparty: '',
  })

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    loadIncomes()
  }, [selectedCategory, selectedVessel, selectedCash])

  useEffect(() => {
    if (incomeForm.vesselId) {
      loadCashesForVessel(parseInt(incomeForm.vesselId))
    } else {
      setCashes([])
      setIncomeForm({ ...incomeForm, cashId: '' })
    }
  }, [incomeForm.vesselId])

  const loadData = async () => {
    try {
      setLoading(true)
      await Promise.all([
        loadCategories(),
        loadVessels(),
        loadIncomes(),
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
      const response = await incomeCategoriesService.getAll({ limit: 100 })
      setCategories(response.data || [])
    } catch (error: any) {
      console.error('Ошибка загрузки категорий:', error)
      alert(error.error || error.message || 'Ошибка загрузки категорий')
    } finally {
      setCategoriesLoading(false)
    }
  }

  const loadVessels = async () => {
    try {
      const response = await vesselsService.getAll({ limit: 100 })
      const vesselsData = response.data || []
      const userVessels = vesselsData.filter((vessel: Vessel) => vessel.ownerId === user?.id)
      setVessels(userVessels)
    } catch (error: any) {
      console.error('Ошибка загрузки катеров:', error)
    }
  }

  const loadCashesForVessel = async (vesselId: number) => {
    try {
      const response = await vesselOwnerCashesService.getAll({ 
        limit: 100, 
        vesselId 
      })
      setCashes(response.data || [])
    } catch (error: any) {
      console.error('Ошибка загрузки касс:', error)
    }
  }

  const loadIncomes = async () => {
    try {
      setIncomesLoading(true)
      const params: any = { limit: 1000 }
      if (selectedCategory) {
        params.categoryId = selectedCategory
      }
      if (selectedVessel) {
        params.vesselId = selectedVessel
      }
      if (selectedCash) {
        params.cashId = selectedCash
      }
      const response = await incomesService.getAll(params)
      setIncomes(response.data || [])
    } catch (error: any) {
      console.error('Ошибка загрузки приходов:', error)
      alert(error.error || error.message || 'Ошибка загрузки приходов')
    } finally {
      setIncomesLoading(false)
    }
  }

  const handleOpenCategoryModal = (category?: IncomeCategory) => {
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
    try {
      if (!categoryForm.name.trim()) {
        alert('Название категории обязательно')
        return
      }

      if (editingCategory) {
        await incomeCategoriesService.update(editingCategory.id, categoryForm)
      } else {
        await incomeCategoriesService.create(categoryForm)
      }
      
      await loadCategories()
      handleCloseCategoryModal()
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка сохранения категории')
    }
  }

  const handleDeleteCategory = async (categoryId: number) => {
    if (!confirm('Вы уверены, что хотите удалить эту категорию?')) return

    try {
      await incomeCategoriesService.delete(categoryId)
      await loadCategories()
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка удаления категории')
    }
  }

  const handleOpenIncomeModal = (income?: Income) => {
    if (income) {
      setEditingIncome(income)
      setIncomeForm({
        categoryId: income.categoryId.toString(),
        vesselId: income.vesselId.toString(),
        cashId: income.cashId.toString(),
        amount: income.amount.toString(),
        currency: income.currency as Currency,
        paymentMethod: income.paymentMethod as CashPaymentMethod,
        date: format(new Date(income.date), 'yyyy-MM-dd'),
        description: income.description || '',
        counterparty: income.counterparty || '',
      })
      loadCashesForVessel(income.vesselId)
    } else {
      setEditingIncome(null)
      setIncomeForm({
        categoryId: '',
        vesselId: '',
        cashId: '',
        amount: '',
        currency: Currency.RUB,
        paymentMethod: CashPaymentMethod.CASH,
        date: format(new Date(), 'yyyy-MM-dd'),
        description: '',
        counterparty: '',
      })
      setCashes([])
    }
    setShowIncomeModal(true)
  }

  const handleCloseIncomeModal = () => {
    setShowIncomeModal(false)
    setEditingIncome(null)
    setIncomeForm({
      categoryId: '',
      vesselId: '',
      cashId: '',
      amount: '',
      currency: Currency.RUB,
      paymentMethod: CashPaymentMethod.CASH,
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      counterparty: '',
    })
    setCashes([])
  }

  const handleSaveIncome = async () => {
    try {
      if (!incomeForm.categoryId) {
        alert('Выберите категорию прихода')
        return
      }
      if (!incomeForm.vesselId) {
        alert('Выберите катер')
        return
      }
      if (!incomeForm.cashId) {
        alert('Выберите кассу')
        return
      }
      if (!incomeForm.amount || parseFloat(incomeForm.amount) <= 0) {
        alert('Введите корректную сумму')
        return
      }

      const incomeData = {
        ...incomeForm,
        amount: parseFloat(incomeForm.amount),
        categoryId: parseInt(incomeForm.categoryId),
        vesselId: parseInt(incomeForm.vesselId),
        cashId: parseInt(incomeForm.cashId),
      }

      if (editingIncome) {
        await incomesService.update(editingIncome.id, incomeData)
      } else {
        await incomesService.create(incomeData)
      }
      
      await loadIncomes()
      handleCloseIncomeModal()
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка сохранения прихода')
    }
  }

  const handleDeleteIncome = async (incomeId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот приход?')) return

    try {
      await incomesService.delete(incomeId)
      await loadIncomes()
    } catch (error: any) {
      alert(error.error || error.message || 'Ошибка удаления прихода')
    }
  }

  const totalIncome = incomes.reduce((sum, income) => sum + income.amount, 0)

  if (loading) {
    return <LoadingAnimation message="Загрузка приходов..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Приходы</h1>
          <p className="mt-2 text-gray-600">Управление категориями и приходами</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleOpenCategoryModal()}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            Создать категорию
          </button>
          <button
            onClick={() => handleOpenIncomeModal()}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            Добавить приход
          </button>
        </div>
      </div>

      {/* Статистика */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-6 w-6 text-green-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Общие приходы</h2>
        </div>
        <div className="bg-green-50 p-6 rounded-lg">
          <p className="text-sm text-gray-600 mb-2">Сумма приходов</p>
          <p className="text-4xl font-bold text-green-600">
            {totalIncome.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Всего приходов: {incomes.length}
          </p>
        </div>
      </div>

      {/* Категории */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Tag className="h-5 w-5 mr-2" />
            Категории приходов
          </h2>
        </div>
        {categoriesLoading ? (
          <LoadingAnimation message="Загрузка категорий..." />
        ) : categories.length === 0 ? (
          <p className="text-gray-500 text-sm">Нет категорий. Создайте первую категорию.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map((category) => (
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
            ))}
          </div>
        )}
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Фильтры</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              Катер
            </label>
            <select
              value={selectedVessel}
              onChange={(e) => setSelectedVessel(e.target.value ? parseInt(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Все катера</option>
              {vessels.map((vessel) => (
                <option key={vessel.id} value={vessel.id}>
                  {vessel.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Касса
            </label>
            <select
              value={selectedCash}
              onChange={(e) => setSelectedCash(e.target.value ? parseInt(e.target.value) : '')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Все кассы</option>
              {vessels.flatMap((vessel) => {
                // Здесь нужно загрузить кассы для каждого катера, но для упрощения показываем только выбранный катер
                if (selectedVessel && vessel.id === selectedVessel) {
                  return cashes.map((cash) => (
                    <option key={cash.id} value={cash.id}>
                      {cash.name} ({vessel.name})
                    </option>
                  ))
                }
                return []
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Список приходов */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Список приходов</h2>
        </div>
        {incomesLoading ? (
          <div className="p-12 text-center">
            <LoadingAnimation message="Загрузка приходов..." />
          </div>
        ) : incomes.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">Приходы не найдены</p>
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
                    Категория
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Катер
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Касса
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
                {incomes.map((income) => (
                  <tr key={income.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {format(new Date(income.date), 'dd.MM.yyyy')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {income.category?.name || 'Не указана'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {income.vessel?.name || 'Не указан'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {income.cash?.name || 'Не указана'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                      {income.amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {income.currency}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {income.paymentMethod === CashPaymentMethod.CASH ? 'Наличные' : 'Безналичные'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {income.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenIncomeModal(income)}
                          className="text-primary-600 hover:text-primary-900"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteIncome(income.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
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
                      placeholder="Например: Приход от аренды катера"
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
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {editingCategory ? 'Сохранить' : 'Создать'}
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

      {/* Модальное окно прихода */}
      {showIncomeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={handleCloseIncomeModal}
            />
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingIncome ? 'Редактировать приход' : 'Добавить приход'}
                  </h3>
                  <button onClick={handleCloseIncomeModal} className="text-gray-400 hover:text-gray-500">
                    <X className="h-6 w-6" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Категория прихода *
                    </label>
                    <select
                      value={incomeForm.categoryId}
                      onChange={(e) => setIncomeForm({ ...incomeForm, categoryId: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                    >
                      <option value="">Выберите категорию</option>
                      {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Катер *
                    </label>
                    <select
                      value={incomeForm.vesselId}
                      onChange={(e) => setIncomeForm({ ...incomeForm, vesselId: e.target.value, cashId: '' })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
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
                      Касса *
                    </label>
                    <select
                      value={incomeForm.cashId}
                      onChange={(e) => setIncomeForm({ ...incomeForm, cashId: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      disabled={!incomeForm.vesselId}
                    >
                      <option value="">Выберите кассу</option>
                      {cashes.map((cash) => (
                        <option key={cash.id} value={cash.id}>
                          {cash.name}
                        </option>
                      ))}
                    </select>
                    {!incomeForm.vesselId && (
                      <p className="mt-1 text-sm text-gray-500">Сначала выберите катер</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Сумма *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={incomeForm.amount}
                        onChange={(e) => setIncomeForm({ ...incomeForm, amount: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Валюта
                      </label>
                      <select
                        value={incomeForm.currency}
                        onChange={(e) => setIncomeForm({ ...incomeForm, currency: e.target.value as Currency })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value={Currency.RUB}>RUB</option>
                        <option value={Currency.USD}>USD</option>
                        <option value={Currency.EUR}>EUR</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Способ оплаты *
                      </label>
                      <select
                        value={incomeForm.paymentMethod}
                        onChange={(e) => setIncomeForm({ ...incomeForm, paymentMethod: e.target.value as CashPaymentMethod })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      >
                        <option value={CashPaymentMethod.CASH}>Наличные</option>
                        <option value={CashPaymentMethod.NON_CASH}>Безналичные</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">
                        Дата *
                      </label>
                      <input
                        type="date"
                        value={incomeForm.date}
                        onChange={(e) => setIncomeForm({ ...incomeForm, date: e.target.value })}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Описание
                    </label>
                    <textarea
                      value={incomeForm.description}
                      onChange={(e) => setIncomeForm({ ...incomeForm, description: e.target.value })}
                      rows={3}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Описание прихода (необязательно)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Контрагент
                    </label>
                    <input
                      type="text"
                      value={incomeForm.counterparty}
                      onChange={(e) => setIncomeForm({ ...incomeForm, counterparty: e.target.value })}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                      placeholder="Контрагент (необязательно)"
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSaveIncome}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  {editingIncome ? 'Сохранить' : 'Добавить'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseIncomeModal}
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
