import { useEffect, useState } from 'react'
import { activityLogsService } from '../services/api'
import { FileText, Filter } from 'lucide-react'
import { LoadingAnimation } from '../components/LoadingAnimation'
import { format } from 'date-fns'

interface ActivityLog {
  id: number
  activityType: string
  entityType: string
  entityId: number | null
  description: string | null
  oldValues: Record<string, any> | null
  newValues: Record<string, any> | null
  ipAddress: string | null
  userAgent: string | null
  createdAt: string
  user: {
    id: number
    firstName: string
    lastName: string
    email: string
  } | null
}

const activityTypeLabels: Record<string, string> = {
  create: 'Создание',
  update: 'Обновление',
  delete: 'Удаление',
  login: 'Вход',
  logout: 'Выход',
  view: 'Просмотр',
  other: 'Другое',
}

const entityTypeLabels: Record<string, string> = {
  user: 'Пользователь',
  club: 'Яхт-клуб',
  vessel: 'Судно',
  booking: 'Бронирование',
  berth: 'Место',
  payment: 'Платеж',
  tariff: 'Тариф',
  booking_rule: 'Правило бронирования',
  other: 'Другое',
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState({
    entityType: '',
    activityType: '',
    userId: '',
    startDate: '',
    endDate: '',
  })

  useEffect(() => {
    loadLogs()
  }, [page])

  const loadLogs = async () => {
    try {
      setLoading(true)
      const params: any = {
        page,
        limit: 50,
      }

      if (filters.entityType) params.entityType = filters.entityType
      if (filters.activityType) params.activityType = filters.activityType
      if (filters.userId) params.userId = parseInt(filters.userId)
      if (filters.startDate) params.startDate = filters.startDate
      if (filters.endDate) params.endDate = filters.endDate

      const response: any = await activityLogsService.getAll(params)
      console.log('Ответ от API логов:', response)
      
      // API interceptor уже возвращает response.data, поэтому обращаемся напрямую к полям
      const logsData = response?.logs || []
      const totalPagesData = response?.totalPages || 1
      const totalData = response?.total || 0
      
      console.log('Обработанные данные:', { logsData, totalPagesData, totalData })
      
      setLogs(logsData)
      setTotalPages(totalPagesData)
      setTotal(totalData)
    } catch (error) {
      console.error('Ошибка загрузки логов:', error)
      setError('Ошибка загрузки логов. Проверьте консоль для деталей.')
    } finally {
      setLoading(false)
    }
  }

  const handleFilterChange = (key: string, value: string) => {
    setFilters({ ...filters, [key]: value })
  }

  const applyFilters = () => {
    setPage(1)
    loadLogs()
  }

  const clearFilters = () => {
    setFilters({
      entityType: '',
      activityType: '',
      userId: '',
      startDate: '',
      endDate: '',
    })
    setPage(1)
    // Загружаем логи после сброса фильтров
    setTimeout(() => {
      loadLogs()
    }, 0)
  }

  if (loading && logs.length === 0) {
    return <LoadingAnimation />
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <FileText className="h-6 w-6" />
          Логи активности
        </h1>
        <p className="text-gray-600 mt-1">Все действия пользователей в системе</p>
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}
      </div>

      {/* Фильтры */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="h-5 w-5 text-gray-500" />
          <h2 className="font-semibold text-gray-900">Фильтры</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Вид пользователя
            </label>
            <select
              value={filters.entityType}
              onChange={(e) => handleFilterChange('entityType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Все</option>
              {Object.entries(entityTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Тип действия
            </label>
            <select
              value={filters.activityType}
              onChange={(e) => handleFilterChange('activityType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Все</option>
              {Object.entries(activityTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ID пользователя
            </label>
            <input
              type="number"
              value={filters.userId}
              onChange={(e) => handleFilterChange('userId', e.target.value)}
              placeholder="ID пользователя"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата начала
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Дата окончания
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <button
            onClick={applyFilters}
            className="px-4 py-2 text-sm text-white bg-primary-600 rounded-md hover:bg-primary-700 font-medium"
          >
            Применить фильтры
          </button>
          <button
            onClick={clearFilters}
            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Сбросить фильтры
          </button>
        </div>
      </div>

      {/* Статистика */}
      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="text-sm text-gray-600">
          Всего записей: <span className="font-semibold">{total}</span>
        </div>
      </div>

      {/* Таблица логов */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата/Время
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Пользователь
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действие
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Пользователь
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Описание
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP адрес
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {logs.length === 0 && !loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    Логи не найдены. Попробуйте изменить фильтры или выполните какое-либо действие в системе.
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {format(new Date(log.createdAt), 'dd.MM.yyyy HH:mm:ss')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {log.user ? (
                      <div>
                        <div className="font-medium">
                          {log.user.firstName} {log.user.lastName}
                        </div>
                        <div className="text-gray-500 text-xs">{log.user.email}</div>
                      </div>
                    ) : (
                      <span className="text-gray-400">Система</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {activityTypeLabels[log.activityType] || log.activityType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">
                        {entityTypeLabels[log.entityType] || log.entityType}
                      </div>
                      {log.entityId && (
                        <div className="text-gray-500 text-xs">ID: {log.entityId}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    <div className="max-w-md">
                      {log.description || '-'}
                      {log.oldValues && (
                        <div className="mt-1 text-xs text-gray-500">
                          <div className="font-semibold">Было:</div>
                          <pre className="whitespace-pre-wrap text-xs">
                            {JSON.stringify(log.oldValues, null, 2)}
                          </pre>
                        </div>
                      )}
                      {log.newValues && (
                        <div className="mt-1 text-xs text-gray-500">
                          <div className="font-semibold">Стало:</div>
                          <pre className="whitespace-pre-wrap text-xs">
                            {JSON.stringify(log.newValues, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {log.ipAddress || '-'}
                  </td>
                </tr>
              ))
              )}
            </tbody>
          </table>
        </div>

        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="text-sm text-gray-700">
              Страница {page} из {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Назад
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Вперед
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

