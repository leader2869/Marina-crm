import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Settings, Users, X } from 'lucide-react'
import BackButton from '../components/BackButton'
import { LoadingAnimation } from '../components/LoadingAnimation'
import { clubsService, clubFinanceService } from '../services/api'
import {
  CLUB_STAFF_PERMISSION_KEYS,
  CLUB_STAFF_PERMISSION_LABELS,
  DEFAULT_CLUB_STAFF_PERMISSIONS,
} from '../constants/clubStaffPermissions'
import { Club, ClubStaffMember, ClubStaffPermission } from '../types'

export default function ClubEmployees() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null)
  const [employees, setEmployees] = useState<ClubStaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingStaff, setLoadingStaff] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [editingEmployee, setEditingEmployee] = useState<ClubStaffMember | null>(null)
  const [editAccessEnabled, setEditAccessEnabled] = useState(true)
  const [editPermissions, setEditPermissions] = useState<ClubStaffPermission[]>([
    ...DEFAULT_CLUB_STAFF_PERMISSIONS,
  ])

  const loadStaff = async (clubId: number) => {
    try {
      setLoadingStaff(true)
      setError('')
      const response = await clubFinanceService.getClubStaff(clubId)
      const list = (Array.isArray(response) ? response : response.data || []) as ClubStaffMember[]
      setEmployees(list)
    } catch (e: unknown) {
      const err = e as { error?: string; message?: string }
      setError(err?.error || err?.message || 'Ошибка загрузки сотрудников')
      setEmployees([])
    } finally {
      setLoadingStaff(false)
    }
  }

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
    void loadStaff(selectedClubId)
  }, [selectedClubId])

  const sortedEmployees = useMemo(() => {
    return [...employees].sort((a, b) => {
      const nameA = `${a.lastName || ''} ${a.firstName || ''}`.trim() || a.email
      const nameB = `${b.lastName || ''} ${b.firstName || ''}`.trim() || b.email
      return nameA.localeCompare(nameB, 'ru')
    })
  }, [employees])

  const openEditModal = (employee: ClubStaffMember) => {
    setEditingEmployee(employee)
    setEditAccessEnabled(employee.accessEnabled !== false)
    setEditPermissions([...employee.permissions])
  }

  const closeEditModal = () => {
    setEditingEmployee(null)
  }

  const togglePermission = (key: ClubStaffPermission) => {
    setEditPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    )
  }

  const handleSaveAccess = async () => {
    if (!editingEmployee || !selectedClubId) return
    if (editAccessEnabled && editPermissions.length === 0) {
      setError('Выберите хотя бы один раздел для доступа')
      return
    }
    try {
      setSaving(true)
      setError('')
      await clubFinanceService.updateClubStaffAccess(selectedClubId, editingEmployee.id, {
        accessEnabled: editAccessEnabled,
        permissions: editPermissions,
      })
      await loadStaff(selectedClubId)
      closeEditModal()
    } catch (e: unknown) {
      const err = e as { error?: string; message?: string }
      setError(err?.error || err?.message || 'Ошибка сохранения прав')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <LoadingAnimation message="Загрузка..." />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Сотрудники</h1>
          <p className="mt-1 text-sm text-gray-600">
            Управление доступом и разделами для сотрудников яхт-клуба
          </p>
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
                      Доступ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Разделы
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Действия
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedEmployees.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-500">
                        Сотрудники не найдены
                      </td>
                    </tr>
                  )}
                  {sortedEmployees.map((employee) => {
                    const fullName =
                      `${employee.lastName || ''} ${employee.firstName || ''}`.trim() || '—'
                    const accessOn = employee.accessEnabled !== false
                    return (
                      <tr key={employee.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {fullName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{employee.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              accessOn ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {accessOn ? 'Открыт' : 'Закрыт'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {accessOn
                            ? employee.permissions
                                .map((p) => CLUB_STAFF_PERMISSION_LABELS[p])
                                .join(', ')
                            : '—'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => openEditModal(employee)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 text-gray-700"
                          >
                            <Settings className="h-4 w-4" />
                            Права
                          </button>
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

      {editingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg bg-white rounded-xl shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">
                Права: {editingEmployee.firstName} {editingEmployee.lastName}
              </h3>
              <button type="button" onClick={closeEditModal} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-5">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editAccessEnabled}
                  onChange={(e) => setEditAccessEnabled(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600"
                />
                <span className="text-sm font-medium text-gray-900">Доступ к системе открыт</span>
              </label>
              <p className="text-xs text-gray-500">
                Снимите галочку, чтобы полностью закрыть доступ сотрудника к этому яхт-клубу.
              </p>

              {editAccessEnabled && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-900">Доступные разделы</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {CLUB_STAFF_PERMISSION_KEYS.map((key) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 p-2 rounded border border-gray-200 cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={editPermissions.includes(key)}
                          onChange={() => togglePermission(key)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600"
                        />
                        <span className="text-sm text-gray-800">{CLUB_STAFF_PERMISSION_LABELS[key]}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-200">
              <button
                type="button"
                onClick={closeEditModal}
                className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSaveAccess}
                disabled={saving}
                className="px-4 py-2 text-sm rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50"
              >
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
