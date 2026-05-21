import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users } from 'lucide-react'
import BackButton from '../components/BackButton'
import { LoadingAnimation } from '../components/LoadingAnimation'
import { clubsService, clubFinanceService } from '../services/api'
import { Club, User, UserRole } from '../types'

export default function ClubEmployees() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null)
  const [employees, setEmployees] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const loadClubs = async () => {
      try {
        setLoading(true)
        setError('')
        const response = await clubsService.getAll({ limit: 200 })
        const allClubs = (response.data || []) as Club[]
        setClubs(allClubs)
        if (allClubs.length > 0) {
          setSelectedClubId(allClubs[0].id)
        }
      } catch (e: unknown) {
        const err = e as { error?: string; message?: string }
        setError(err?.error || err?.message || 'Ошибка загрузки клубов')
      } finally {
        setLoading(false)
      }
    }
    void loadClubs()
  }, [])

  useEffect(() => {
    if (!selectedClubId) return

    const loadStaff = async () => {
      try {
        setLoadingStaff(true)
        setError('')
        const response = await clubFinanceService.getClubUsers(selectedClubId)
        const users = (Array.isArray(response) ? response : response.data || []) as User[]
        setEmployees(users.filter((u) => u.role === UserRole.CLUB_STAFF))
      } catch (e: unknown) {
        const err = e as { error?: string; message?: string }
        setError(err?.error || err?.message || 'Ошибка загрузки сотрудников')
        setEmployees([])
      } finally {
        setLoadingStaff(false)
      }
    }
    void loadStaff()
  }, [selectedClubId])

  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      const nameA = `${a.lastName || ''} ${a.firstName || ''}`.trim() || a.email
      const nameB = `${b.lastName || ''} ${b.firstName || ''}`.trim() || b.email
      return nameA.localeCompare(nameB, 'ru')
    })
  }, [employees])

  if (loading) {
    return <LoadingAnimation message="Загрузка..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Сотрудники</h1>
          <p className="mt-1 text-sm text-gray-600">Сотрудники яхт-клуба с доступом к системе</p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200 text-sm">{error}</div>
      )}

      {clubs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Нет доступных яхт-клубов</p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow p-4">
            <label htmlFor="club-employees-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Яхт-клуб
            </label>
            <select
              id="club-employees-filter"
              className="w-full max-w-md border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900 bg-white"
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

          <p className="text-sm text-gray-600">
            Создать аккаунт сотрудника можно в разделе{' '}
            <Link to="/club-partners" className="text-primary-600 hover:text-primary-700 font-medium">
              Финансы → Партнеры
            </Link>
            .
          </p>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            {loadingStaff ? (
              <div className="p-8 text-center text-gray-500 text-sm">Загрузка сотрудников...</div>
            ) : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      ФИО
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Телефон
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Статус
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {!loadingStaff && sortedEmployees.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">
                        Сотрудники не найдены
                      </td>
                    </tr>
                  )}
                  {sortedEmployees.map((employee) => {
                    const fullName =
                      `${employee.lastName || ''} ${employee.firstName || ''}`.trim() || '—'
                    const isActive = employee.isActive !== false
                    return (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {fullName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{employee.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {employee.phone || '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {isActive ? 'Активен' : 'Неактивен'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

        </>
      )}
    </div>
  )
}
