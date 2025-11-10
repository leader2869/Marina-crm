import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { clubsService, berthsService, tariffsService } from '../services/api'
import { Club, Berth, Tariff, TariffType } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { Anchor, Edit2, Save, X, Plus, Trash2, CheckSquare, Square } from 'lucide-react'
import { LoadingAnimation } from '../components/LoadingAnimation'

export default function Tariffs() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedClub, setSelectedClub] = useState<Club | null>(null)
  const [berths, setBerths] = useState<Berth[]>([])
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null)
  const [tariffForm, setTariffForm] = useState({
    name: '',
    type: TariffType.SEASON_PAYMENT,
    amount: '',
    season: new Date().getFullYear().toString(),
    selectedBerthIds: [] as number[],
    selectedMonths: [] as number[],
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadClubs()
  }, [])

  useEffect(() => {
    if (selectedClub) {
      loadBerths(selectedClub.id)
      loadTariffs(selectedClub.id)
    }
  }, [selectedClub])

  const loadClubs = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await clubsService.getAll({ limit: 100 })
      const clubsData = response.data || []
      // Фильтруем только клубы текущего владельца
      const ownerClubs = clubsData.filter((club: Club) => club.ownerId === user?.id)
      setClubs(ownerClubs)
      
      // Если есть клубы, выбираем первый по умолчанию
      if (ownerClubs.length > 0 && !selectedClub) {
        setSelectedClub(ownerClubs[0])
      }
    } catch (err: any) {
      console.error('Ошибка загрузки клубов:', err)
      setError(err.error || err.message || 'Ошибка загрузки клубов')
    } finally {
      setLoading(false)
    }
  }

  const loadBerths = async (clubId: number) => {
    try {
      const response = await berthsService.getByClub(clubId)
      const berthsData = (response as any)?.data || response || []
      setBerths(Array.isArray(berthsData) ? berthsData : [])
    } catch (err: any) {
      console.error('Ошибка загрузки мест:', err)
      setError(err.error || err.message || 'Ошибка загрузки мест')
    }
  }

  const loadTariffs = async (clubId: number) => {
    try {
      setError('')
      const response = await tariffsService.getByClub(clubId)
      // Axios interceptor уже разворачивает response.data, поэтому response - это уже данные
      const tariffsData = Array.isArray(response) ? response : (response?.data || [])
      setTariffs(tariffsData)
    } catch (err: any) {
      console.error('Ошибка загрузки тарифов:', err)
      setError(err.error || err.message || 'Ошибка загрузки тарифов')
      setTariffs([])
    }
  }

  const handleOpenAdd = () => {
    setTariffForm({
      name: '',
      type: TariffType.SEASON_PAYMENT,
      amount: '',
      season: selectedClub?.season?.toString() || new Date().getFullYear().toString(),
      selectedBerthIds: [],
      selectedMonths: [],
    })
    setShowAddModal(true)
  }

  const handleCloseAdd = () => {
    setShowAddModal(false)
    setEditingTariff(null)
    setTariffForm({
      name: '',
      type: TariffType.SEASON_PAYMENT,
      amount: '',
      season: new Date().getFullYear().toString(),
      selectedBerthIds: [],
      selectedMonths: [],
    })
  }

  const handleEditClick = (tariff: Tariff) => {
    setEditingTariff(tariff)
    setTariffForm({
      name: tariff.name,
      type: tariff.type,
      amount: tariff.amount.toString(),
      season: tariff.season.toString(),
      selectedBerthIds: tariff.berths?.map((b) => b.id) || [],
      selectedMonths: tariff.months || [],
    })
    setShowAddModal(true)
  }

  const handleToggleBerth = (berthId: number) => {
    setTariffForm((prev) => {
      const isSelected = prev.selectedBerthIds.includes(berthId)
      return {
        ...prev,
        selectedBerthIds: isSelected
          ? prev.selectedBerthIds.filter((id) => id !== berthId)
          : [...prev.selectedBerthIds, berthId],
      }
    })
  }

  const handleSelectAllBerths = () => {
    if (tariffForm.selectedBerthIds.length === berths.length) {
      setTariffForm((prev) => ({ ...prev, selectedBerthIds: [] }))
    } else {
      setTariffForm((prev) => ({ ...prev, selectedBerthIds: berths.map((b) => b.id) }))
    }
  }

  const handleSave = async () => {
    if (!selectedClub) return

    if (!tariffForm.name || !tariffForm.amount || !tariffForm.season) {
      alert('Заполните все обязательные поля')
      return
    }

    if (parseFloat(tariffForm.amount) < 0) {
      alert('Сумма не может быть отрицательной')
      return
    }

    if (tariffForm.selectedBerthIds.length === 0) {
      alert('Выберите хотя бы одно место для применения тарифа')
      return
    }

    // Для помесячной оплаты проверяем, что выбраны месяцы
    if (tariffForm.type === TariffType.MONTHLY_PAYMENT && tariffForm.selectedMonths.length === 0) {
      alert('Выберите хотя бы один месяц для помесячной оплаты')
      return
    }

    setSaving(true)
    try {
      const data = {
        clubId: selectedClub.id,
        name: tariffForm.name,
        type: tariffForm.type,
        amount: parseFloat(tariffForm.amount),
        season: parseInt(tariffForm.season),
        berthIds: tariffForm.selectedBerthIds,
        months: tariffForm.type === TariffType.MONTHLY_PAYMENT ? tariffForm.selectedMonths : null,
      }

      if (editingTariff) {
        const result = await tariffsService.update(editingTariff.id, data)
        console.log('Тариф обновлен:', result)
        alert('Тариф успешно обновлен')
      } else {
        const result = await tariffsService.create(data)
        console.log('Тариф создан:', result)
        alert('Тариф успешно создан')
      }

      // Закрываем модальное окно перед загрузкой тарифов
      handleCloseAdd()
      
      // Загружаем тарифы после закрытия модального окна (не блокируем закрытие при ошибке загрузки)
      try {
        await loadTariffs(selectedClub.id)
      } catch (loadError: any) {
        console.error('Ошибка загрузки тарифов после создания:', loadError)
        // Не показываем ошибку пользователю, так как тариф уже создан
      }
    } catch (err: any) {
      console.error('Ошибка сохранения тарифа:', err)
      alert(err.error || err.message || 'Ошибка сохранения тарифа')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (tariffId: number) => {
    if (!confirm('Вы уверены, что хотите удалить этот тариф?')) return

    try {
      await tariffsService.delete(tariffId)
      if (selectedClub) {
        await loadTariffs(selectedClub.id)
      }
      alert('Тариф успешно удален')
    } catch (err: any) {
      alert(err.error || err.message || 'Ошибка удаления тарифа')
    }
  }

  const getTariffTypeText = (type: TariffType) => {
    return type === TariffType.SEASON_PAYMENT ? 'Оплата всего сезона сразу' : 'Помесячная оплата'
  }

  if (loading) {
    return <LoadingAnimation message="Загрузка тарифов..." />
  }

  if (clubs.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded">
          <p>У вас пока нет яхт-клубов. Создайте клуб, чтобы управлять тарифами.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Тарифы</h1>
          <p className="mt-2 text-gray-600">Управление тарифами на места в ваших яхт-клубах</p>
        </div>
        {selectedClub && (
          <button
            onClick={handleOpenAdd}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить тариф
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}

      {/* Выбор клуба */}
      <div className="bg-white rounded-lg shadow p-6">
        <label htmlFor="club-select" className="block text-sm font-medium text-gray-700 mb-2">
          Выберите яхт-клуб:
        </label>
        <select
          id="club-select"
          value={selectedClub?.id || ''}
          onChange={(e) => {
            const club = clubs.find((c) => c.id === parseInt(e.target.value))
            setSelectedClub(club || null)
          }}
          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
        >
          <option value="">Выберите клуб...</option>
          {clubs.map((club) => (
            <option key={club.id} value={club.id}>
              {club.name}
            </option>
          ))}
        </select>
      </div>

      {/* Список тарифов */}
      {selectedClub && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedClub.name}</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Сезон: {selectedClub.season || 'Не указан'}
                </p>
              </div>
            </div>
          </div>

          {tariffs.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              <Anchor className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Тарифы еще не созданы</p>
              <p className="mt-2 text-sm">Нажмите "Добавить тариф" для создания нового тарифа</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Название
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Тип тарифа
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Сумма (руб)
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Сезон
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Места
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tariffs.map((tariff) => (
                    <tr key={tariff.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{tariff.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{getTariffTypeText(tariff.type)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          {parseFloat(tariff.amount.toString()).toFixed(2)} руб.
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{tariff.season}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {tariff.berths && tariff.berths.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {tariff.berths.slice(0, 5).map((berth) => (
                                <span
                                  key={berth.id}
                                  className="inline-flex items-center px-2 py-1 rounded-md bg-primary-100 text-primary-800 text-xs"
                                >
                                  {berth.number}
                                </span>
                              ))}
                              {tariff.berths.length > 5 && (
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-800 text-xs">
                                  +{tariff.berths.length - 5}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400">Нет мест</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEditClick(tariff)}
                            className="text-primary-600 hover:text-primary-900"
                            title="Редактировать"
                          >
                            <Edit2 className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(tariff.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Удалить"
                          >
                            <Trash2 className="h-5 w-5" />
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
      )}

      {/* Модальное окно добавления/редактирования тарифа */}
      {showAddModal && selectedClub && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              handleCloseAdd()
            }
          }}
        >
          <div 
            className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {editingTariff ? 'Редактировать тариф' : 'Добавить тариф'}
            </h2>

            <div className="space-y-4">
              {/* Название тарифа */}
              <div>
                <label htmlFor="tariff-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Название тарифа *
                </label>
                <input
                  id="tariff-name"
                  type="text"
                  value={tariffForm.name}
                  onChange={(e) => setTariffForm({ ...tariffForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                  placeholder="Например: Тариф на сезон 2025"
                />
              </div>

              {/* Тип тарифа */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Тип тарифа *
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value={TariffType.SEASON_PAYMENT}
                      checked={tariffForm.type === TariffType.SEASON_PAYMENT}
                      onChange={(e) => setTariffForm({ ...tariffForm, type: e.target.value as TariffType, selectedMonths: [] })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-900">Оплата всего сезона сразу</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      value={TariffType.MONTHLY_PAYMENT}
                      checked={tariffForm.type === TariffType.MONTHLY_PAYMENT}
                      onChange={(e) => setTariffForm({ ...tariffForm, type: e.target.value as TariffType })}
                      className="mr-2"
                    />
                    <span className="text-sm text-gray-900">Помесячная оплата (фиксированная ежемесячная ставка)</span>
                  </label>
                </div>
              </div>

              {/* Выбор месяцев для помесячной оплаты */}
              {tariffForm.type === TariffType.MONTHLY_PAYMENT && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Выберите месяцы для оплаты *
                  </label>
                  <div className="grid grid-cols-3 gap-2 border border-gray-300 rounded-md p-4">
                    {[
                      { value: 1, name: 'Январь' },
                      { value: 2, name: 'Февраль' },
                      { value: 3, name: 'Март' },
                      { value: 4, name: 'Апрель' },
                      { value: 5, name: 'Май' },
                      { value: 6, name: 'Июнь' },
                      { value: 7, name: 'Июль' },
                      { value: 8, name: 'Август' },
                      { value: 9, name: 'Сентябрь' },
                      { value: 10, name: 'Октябрь' },
                      { value: 11, name: 'Ноябрь' },
                      { value: 12, name: 'Декабрь' },
                    ].map((month) => (
                      <label
                        key={month.value}
                        className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={tariffForm.selectedMonths.includes(month.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setTariffForm({
                                ...tariffForm,
                                selectedMonths: [...tariffForm.selectedMonths, month.value].sort((a, b) => a - b),
                              })
                            } else {
                              setTariffForm({
                                ...tariffForm,
                                selectedMonths: tariffForm.selectedMonths.filter((m) => m !== month.value),
                              })
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-900">{month.name}</span>
                      </label>
                    ))}
                  </div>
                  {tariffForm.selectedMonths.length > 0 && (
                    <p className="mt-2 text-sm text-gray-600">
                      Выбрано месяцев: {tariffForm.selectedMonths.length} из 12
                    </p>
                  )}
                </div>
              )}

              {/* Сумма */}
              <div>
                <label htmlFor="tariff-amount" className="block text-sm font-medium text-gray-700 mb-1">
                  Сумма (руб) *
                </label>
                <input
                  id="tariff-amount"
                  type="number"
                  min="0"
                  step="0.01"
                  value={tariffForm.amount}
                  onChange={(e) => setTariffForm({ ...tariffForm, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                  placeholder="0.00"
                />
              </div>

              {/* Сезон */}
              <div>
                <label htmlFor="tariff-season" className="block text-sm font-medium text-gray-700 mb-1">
                  Сезон (год) *
                </label>
                <input
                  id="tariff-season"
                  type="number"
                  min="2000"
                  max="2100"
                  value={tariffForm.season}
                  onChange={(e) => setTariffForm({ ...tariffForm, season: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                />
              </div>

              {/* Выбор мест */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Выберите места для применения тарифа *
                  </label>
                  <button
                    type="button"
                    onClick={handleSelectAllBerths}
                    className="text-sm text-primary-600 hover:text-primary-900"
                  >
                    {tariffForm.selectedBerthIds.length === berths.length ? 'Снять все' : 'Выбрать все'}
                  </button>
                </div>
                <div className="border border-gray-300 rounded-md p-4 max-h-60 overflow-y-auto">
                  {berths.length === 0 ? (
                    <p className="text-sm text-gray-500">В этом клубе пока нет мест</p>
                  ) : (
                    <div className="space-y-2">
                      {berths.map((berth) => (
                        <label
                          key={berth.id}
                          className="flex items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={tariffForm.selectedBerthIds.includes(berth.id)}
                            onChange={() => handleToggleBerth(berth.id)}
                            className="mr-3"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900">{berth.number}</span>
                            <span className="text-sm text-gray-500 ml-2">
                              ({berth.length} × {berth.width} м)
                            </span>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
                {tariffForm.selectedBerthIds.length > 0 && (
                  <p className="mt-2 text-sm text-gray-600">
                    Выбрано мест: {tariffForm.selectedBerthIds.length} из {berths.length}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={handleCloseAdd}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                Отмена
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : editingTariff ? 'Сохранить' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
