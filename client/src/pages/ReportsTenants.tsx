import { useEffect, useMemo, useState } from 'react'
import BackButton from '../components/BackButton'
import { clubsService, clubFinanceService } from '../services/api'
import { Club, ClubTenantReportResponse } from '../types'

export default function ReportsTenants() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null)
  const [tenantReport, setTenantReport] = useState<ClubTenantReportResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
    const loadTenantReport = async () => {
      if (!selectedClubId) return
      try {
        setLoading(true)
        const response = await clubFinanceService.getTenantReport(selectedClubId)
        setTenantReport(response as unknown as ClubTenantReportResponse)
      } catch (e: any) {
        setError(e?.error || e?.message || 'Ошибка загрузки отчета')
        setTenantReport(null)
      } finally {
        setLoading(false)
      }
    }
    loadTenantReport()
  }, [selectedClubId])

  const occupiedItems = tenantReport?.occupiedItems || []
  const totals = useMemo(
    () =>
      occupiedItems.reduce(
        (acc, item) => ({
          acceptedAmount: acc.acceptedAmount + Number(item.acceptedAmount),
          expectedAmount: acc.expectedAmount + Number(item.expectedAmount),
        }),
        { acceptedAmount: 0, expectedAmount: 0 }
      ),
    [occupiedItems]
  )

  if (loading && clubs.length === 0) return <div className="p-6">Загрузка...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold">Отчет по арендаторам</h1>
          <p className="text-gray-600">Свободные и занятые места, платежи и контакты арендаторов</p>
        </div>
      </div>

      {error && <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>}

      <div className="bg-white rounded-lg shadow p-4">
        <select
          className="border rounded px-3 py-2 max-w-sm w-full"
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Свободных мест</p>
          <p className="text-2xl font-semibold text-green-700">
            {Number(tenantReport?.freeBerthsCount || 0).toLocaleString('ru-RU')}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Занятых мест</p>
          <p className="text-2xl font-semibold text-blue-700">
            {Number(tenantReport?.occupiedBerthsCount || 0).toLocaleString('ru-RU')}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-500">Всего мест</p>
          <p className="text-2xl font-semibold text-gray-900">
            {Number(tenantReport?.totalBerths || 0).toLocaleString('ru-RU')}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Место</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">ФИО</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Телефон</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Принято</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Ожидается</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {occupiedItems.map((item) => (
              <tr key={item.bookingId}>
                <td className="px-4 py-3">{item.berthNumber}</td>
                <td className="px-4 py-3">{item.renterFullName}</td>
                <td className="px-4 py-3">{item.renterPhone}</td>
                <td className="px-4 py-3 text-green-700 font-medium">
                  {Number(item.acceptedAmount).toLocaleString('ru-RU')} ₽
                </td>
                <td className="px-4 py-3 text-amber-700 font-medium">
                  {Number(item.expectedAmount).toLocaleString('ru-RU')} ₽
                </td>
              </tr>
            ))}
            {occupiedItems.length === 0 && (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={5}>
                  Нет данных по занятым местам
                </td>
              </tr>
            )}
          </tbody>
          {occupiedItems.length > 0 && (
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td className="px-4 py-3 font-semibold text-gray-900" colSpan={3}>
                  Итого
                </td>
                <td className="px-4 py-3 text-green-700 font-semibold">
                  {totals.acceptedAmount.toLocaleString('ru-RU')} ₽
                </td>
                <td className="px-4 py-3 text-amber-700 font-semibold">
                  {totals.expectedAmount.toLocaleString('ru-RU')} ₽
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
