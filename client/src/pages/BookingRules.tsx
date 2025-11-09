import { useEffect, useState } from 'react'
import { clubsService, tariffsService, bookingRulesService } from '../services/api'
import { Club, Tariff } from '../types'
import { useAuth } from '../contexts/AuthContext'
import { Anchor, Save, X, Plus, Trash2, Edit2 } from 'lucide-react'

export enum BookingRuleType {
  REQUIRE_PAYMENT_MONTHS = 'require_payment_months',
  MIN_BOOKING_PERIOD = 'min_booking_period',
  MAX_BOOKING_PERIOD = 'max_booking_period',
  REQUIRE_DEPOSIT = 'require_deposit',
  CUSTOM = 'custom',
}

export interface BookingRule {
  id: number
  description: string
  ruleType: BookingRuleType
  parameters: Record<string, any> | null
  clubId: number
  tariffId: number | null
  club?: Club
  tariff?: Tariff | null
  createdAt: string
  updatedAt: string
}

const ruleTypeLabels: Record<BookingRuleType, string> = {
  [BookingRuleType.REQUIRE_PAYMENT_MONTHS]: 'Требовать оплату за несколько месяцев сразу',
  [BookingRuleType.MIN_BOOKING_PERIOD]: 'Минимальный период бронирования',
  [BookingRuleType.MAX_BOOKING_PERIOD]: 'Максимальный период бронирования',
  [BookingRuleType.REQUIRE_DEPOSIT]: 'Требовать залог',
  [BookingRuleType.CUSTOM]: 'Произвольное правило',
}

const monthNames = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'
]

export default function BookingRules() {
  const { user } = useAuth()
  const [clubs, setClubs] = useState<Club[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedClub, setSelectedClub] = useState<Club | null>(null)
  const [tariffs, setTariffs] = useState<Tariff[]>([])
  const [rules, setRules] = useState<BookingRule[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingRule, setEditingRule] = useState<BookingRule | null>(null)
  const [ruleForm, setRuleForm] = useState({
    clubId: '',
    tariffId: '',
    ruleType: BookingRuleType.REQUIRE_PAYMENT_MONTHS,
    description: '',
    selectedMonths: [] as number[],
    minPeriod: '',
    maxPeriod: '',
    depositAmount: '',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadClubs()
  }, [])

  useEffect(() => {
    if (selectedClub) {
      loadTariffs(selectedClub.id)
      loadRules(selectedClub.id)
    }
  }, [selectedClub])

  const loadClubs = async () => {
    try {
      setLoading(true)
      setError('')
      const response = await clubsService.getAll({ limit: 100 })
      const clubsData = response.data || []
      const ownerClubs = clubsData.filter((club: Club) => club.ownerId === user?.id)
      setClubs(ownerClubs)
      
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

  const loadTariffs = async (clubId: number) => {
    try {
      const response = await tariffsService.getByClub(clubId)
      const tariffsData = Array.isArray(response) ? response : (response?.data || [])
      setTariffs(tariffsData)
    } catch (err: any) {
      console.error('Ошибка загрузки тарифов:', err)
    }
  }

  const loadRules = async (clubId: number) => {
    try {
      const response = await bookingRulesService.getByClub(clubId)
      const rulesData = Array.isArray(response) ? response : (response?.data || [])
      setRules(rulesData)
    } catch (err: any) {
      console.error('Ошибка загрузки правил:', err)
      setRules([])
    }
  }

  const handleOpenAdd = () => {
    setRuleForm({
      clubId: selectedClub?.id.toString() || '',
      tariffId: '',
      ruleType: BookingRuleType.REQUIRE_PAYMENT_MONTHS,
      description: '',
      selectedMonths: [],
      minPeriod: '',
      maxPeriod: '',
      depositAmount: '',
    })
    setEditingRule(null)
    setShowAddModal(true)
  }

  const handleCloseAdd = () => {
    setShowAddModal(false)
    setEditingRule(null)
    setRuleForm({
      clubId: '',
      tariffId: '',
      ruleType: BookingRuleType.REQUIRE_PAYMENT_MONTHS,
      description: '',
      selectedMonths: [],
      minPeriod: '',
      maxPeriod: '',
      depositAmount: '',
    })
  }

  const handleEditClick = (rule: BookingRule) => {
    setEditingRule(rule)
    setRuleForm({
      clubId: rule.clubId.toString(),
      tariffId: rule.tariffId?.toString() || '',
      ruleType: rule.ruleType,
      description: rule.description,
      selectedMonths: rule.parameters?.months || [],
      minPeriod: rule.parameters?.minPeriod?.toString() || '',
      maxPeriod: rule.parameters?.maxPeriod?.toString() || '',
      depositAmount: rule.parameters?.depositAmount?.toString() || '',
    })
    setShowAddModal(true)
  }

  const handleToggleMonth = (month: number) => {
    setRuleForm((prev) => {
      const isSelected = prev.selectedMonths.includes(month)
      return {
        ...prev,
        selectedMonths: isSelected
          ? prev.selectedMonths.filter((m) => m !== month)
          : [...prev.selectedMonths, month].sort((a, b) => a - b),
      }
    })
  }

  const handleSave = async () => {
    if (!ruleForm.clubId || !ruleForm.description) {
      alert('Заполните все обязательные поля')
      return
    }

    try {
      setSaving(true)
      setError('')

      let parameters: Record<string, any> | null = null

      switch (ruleForm.ruleType) {
        case BookingRuleType.REQUIRE_PAYMENT_MONTHS:
          if (ruleForm.selectedMonths.length === 0) {
            alert('Выберите хотя бы один месяц')
            return
          }
          parameters = { months: ruleForm.selectedMonths }
          break
        case BookingRuleType.MIN_BOOKING_PERIOD:
          if (!ruleForm.minPeriod) {
            alert('Укажите минимальный период')
            return
          }
          parameters = { minPeriod: parseInt(ruleForm.minPeriod) }
          break
        case BookingRuleType.MAX_BOOKING_PERIOD:
          if (!ruleForm.maxPeriod) {
            alert('Укажите максимальный период')
            return
          }
          parameters = { maxPeriod: parseInt(ruleForm.maxPeriod) }
          break
        case BookingRuleType.REQUIRE_DEPOSIT:
          if (!ruleForm.depositAmount) {
            alert('Укажите сумму залога')
            return
          }
          parameters = { depositAmount: parseFloat(ruleForm.depositAmount) }
          break
        default:
          parameters = null
      }

      const ruleData = {
        clubId: parseInt(ruleForm.clubId),
        tariffId: ruleForm.tariffId ? parseInt(ruleForm.tariffId) : null,
        ruleType: ruleForm.ruleType,
        description: ruleForm.description,
        parameters,
      }

      if (editingRule) {
        await bookingRulesService.update(editingRule.id, ruleData)
      } else {
        await bookingRulesService.create(ruleData)
      }

      await loadRules(parseInt(ruleForm.clubId))
      handleCloseAdd()
      alert(editingRule ? 'Правило успешно обновлено!' : 'Правило успешно создано!')
    } catch (err: any) {
      console.error('Ошибка сохранения правила:', err)
      setError(err.error || err.message || 'Ошибка сохранения правила')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (ruleId: number) => {
    if (!confirm('Вы уверены, что хотите удалить это правило?')) {
      return
    }

    try {
      await bookingRulesService.delete(ruleId)

      if (selectedClub) {
        await loadRules(selectedClub.id)
      }
      alert('Правило успешно удалено!')
    } catch (err: any) {
      console.error('Ошибка удаления правила:', err)
      alert(err.error || err.message || 'Ошибка удаления правила')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Загрузка...</div>
      </div>
    )
  }

  if (clubs.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <Anchor className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            У вас нет яхт-клубов
          </h3>
          <p className="text-gray-500">
            Создайте яхт-клуб, чтобы настроить правила бронирования
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Правила бронирования</h1>
          <button
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Добавить правило
          </button>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Выбор клуба */}
        <div className="mb-6">
          <label htmlFor="club-select" className="block text-sm font-medium text-gray-700 mb-2">
            Выберите яхт-клуб
          </label>
          <select
            id="club-select"
            value={selectedClub?.id || ''}
            onChange={(e) => {
              const club = clubs.find(c => c.id === parseInt(e.target.value))
              setSelectedClub(club || null)
            }}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
          >
            {clubs.map((club) => (
              <option key={club.id} value={club.id}>
                {club.name}
              </option>
            ))}
          </select>
        </div>

        {/* Список правил */}
        {selectedClub && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Правила для "{selectedClub.name}"
            </h2>
            {rules.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                Правила бронирования не установлены. Нажмите "Добавить правило", чтобы создать первое правило.
              </div>
            ) : (
              <div className="space-y-4">
                {rules.map((rule) => (
                  <div key={rule.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {ruleTypeLabels[rule.ruleType]}
                          </span>
                          {rule.tariff && (
                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                              Тариф: {rule.tariff.name}
                            </span>
                          )}
                          {!rule.tariff && (
                            <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">
                              Для всех тарифов
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{rule.description}</p>
                        {rule.parameters && (
                          <div className="text-xs text-gray-500">
                            {rule.ruleType === BookingRuleType.REQUIRE_PAYMENT_MONTHS && rule.parameters.months && (
                              <div>
                                Месяцы: {rule.parameters.months.map((m: number) => monthNames[m - 1]).join(', ')}
                              </div>
                            )}
                            {rule.ruleType === BookingRuleType.MIN_BOOKING_PERIOD && (
                              <div>Минимальный период: {rule.parameters.minPeriod} дней</div>
                            )}
                            {rule.ruleType === BookingRuleType.MAX_BOOKING_PERIOD && (
                              <div>Максимальный период: {rule.parameters.maxPeriod} дней</div>
                            )}
                            {rule.ruleType === BookingRuleType.REQUIRE_DEPOSIT && (
                              <div>Сумма залога: {rule.parameters.depositAmount} ₽</div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleEditClick(rule)}
                          className="p-2 text-gray-600 hover:text-primary-600 hover:bg-primary-50 rounded"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
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
        )}
      </div>

      {/* Модальное окно добавления/редактирования правила */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={handleCloseAdd} />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    {editingRule ? 'Редактировать правило' : 'Добавить правило'}
                  </h3>
                  <button
                    onClick={handleCloseAdd}
                    className="text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="rule-club" className="block text-sm font-medium text-gray-700 mb-2">
                      Яхт-клуб *
                    </label>
                    <select
                      id="rule-club"
                      required
                      value={ruleForm.clubId}
                      onChange={(e) => setRuleForm({ ...ruleForm, clubId: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    >
                      <option value="">Выберите яхт-клуб</option>
                      {clubs.map((club) => (
                        <option key={club.id} value={club.id}>
                          {club.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="rule-tariff" className="block text-sm font-medium text-gray-700 mb-2">
                      Тариф
                    </label>
                    <select
                      id="rule-tariff"
                      value={ruleForm.tariffId}
                      onChange={(e) => setRuleForm({ ...ruleForm, tariffId: e.target.value })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    >
                      <option value="">Для всех тарифов</option>
                      {tariffs.map((tariff) => (
                        <option key={tariff.id} value={tariff.id}>
                          {tariff.name}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-gray-500">
                      Если не выбран тариф, правило будет применяться ко всем тарифам выбранного клуба
                    </p>
                  </div>

                  <div>
                    <label htmlFor="rule-type" className="block text-sm font-medium text-gray-700 mb-2">
                      Тип правила *
                    </label>
                    <select
                      id="rule-type"
                      required
                      value={ruleForm.ruleType}
                      onChange={(e) => setRuleForm({ ...ruleForm, ruleType: e.target.value as BookingRuleType })}
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    >
                      {Object.entries(ruleTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label htmlFor="rule-description" className="block text-sm font-medium text-gray-700 mb-2">
                      Описание правила *
                    </label>
                    <textarea
                      id="rule-description"
                      required
                      rows={3}
                      value={ruleForm.description}
                      onChange={(e) => setRuleForm({ ...ruleForm, description: e.target.value })}
                      placeholder="Опишите правило бронирования..."
                      className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                    />
                  </div>

                  {/* Параметры в зависимости от типа правила */}
                  {ruleForm.ruleType === BookingRuleType.REQUIRE_PAYMENT_MONTHS && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Выберите месяцы, за которые требуется оплата *
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {monthNames.map((month, index) => {
                          const monthNumber = index + 1
                          const isSelected = ruleForm.selectedMonths.includes(monthNumber)
                          return (
                            <button
                              key={monthNumber}
                              type="button"
                              onClick={() => handleToggleMonth(monthNumber)}
                              className={`px-3 py-2 text-sm rounded-md border ${
                                isSelected
                                  ? 'bg-primary-600 text-white border-primary-600'
                                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              {month}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {ruleForm.ruleType === BookingRuleType.MIN_BOOKING_PERIOD && (
                    <div>
                      <label htmlFor="rule-min-period" className="block text-sm font-medium text-gray-700 mb-2">
                        Минимальный период (дней) *
                      </label>
                      <input
                        id="rule-min-period"
                        type="number"
                        min="1"
                        required
                        value={ruleForm.minPeriod}
                        onChange={(e) => setRuleForm({ ...ruleForm, minPeriod: e.target.value })}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>
                  )}

                  {ruleForm.ruleType === BookingRuleType.MAX_BOOKING_PERIOD && (
                    <div>
                      <label htmlFor="rule-max-period" className="block text-sm font-medium text-gray-700 mb-2">
                        Максимальный период (дней) *
                      </label>
                      <input
                        id="rule-max-period"
                        type="number"
                        min="1"
                        required
                        value={ruleForm.maxPeriod}
                        onChange={(e) => setRuleForm({ ...ruleForm, maxPeriod: e.target.value })}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>
                  )}

                  {ruleForm.ruleType === BookingRuleType.REQUIRE_DEPOSIT && (
                    <div>
                      <label htmlFor="rule-deposit" className="block text-sm font-medium text-gray-700 mb-2">
                        Сумма залога (₽) *
                      </label>
                      <input
                        id="rule-deposit"
                        type="number"
                        min="0"
                        step="0.01"
                        required
                        value={ruleForm.depositAmount}
                        onChange={(e) => setRuleForm({ ...ruleForm, depositAmount: e.target.value })}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-gray-900 bg-white"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-primary-600 text-base font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  <Save className="inline-block h-4 w-4 mr-2" />
                  {saving ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  type="button"
                  onClick={handleCloseAdd}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  <X className="inline-block h-4 w-4 mr-2" />
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
