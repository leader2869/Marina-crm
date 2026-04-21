import { useEffect, useMemo, useState } from 'react'
import { clubsService, clubFinanceService } from '../services/api'
import { Club, ClubPartner, ClubPartnerManager, User, UserRole } from '../types'
import { Plus, Trash2 } from 'lucide-react'
import BackButton from '../components/BackButton'
import { useAuth } from '../contexts/AuthContext'

export default function ClubPartners() {
  const { user } = useAuth()
  const canEditPartners =
    !!user &&
    (user.role === UserRole.SUPER_ADMIN ||
      user.role === UserRole.ADMIN ||
      user.role === UserRole.CLUB_OWNER)
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null)
  const [partners, setPartners] = useState<ClubPartner[]>([])
  const [clubUsers, setClubUsers] = useState<User[]>([])
  const [partnerManagers, setPartnerManagers] = useState<ClubPartnerManager[]>([])
  const [managerUserByPartner, setManagerUserByPartner] = useState<Record<number, string>>({})
  const [creatingManagerForPartnerId, setCreatingManagerForPartnerId] = useState<number | null>(null)
  const [newManagerByPartner, setNewManagerByPartner] = useState<Record<number, {
    email: string
    password: string
    firstName: string
    lastName: string
    phone: string
  }>>({})
  const [name, setName] = useState('')
  const [sharePercent, setSharePercent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const toErrorText = (value: unknown, fallback: string): string => {
    if (typeof value === 'string' && value.trim()) return value
    if (value && typeof value === 'object') {
      const v = value as any
      if (typeof v.message === 'string' && v.message.trim()) return v.message
      if (typeof v.error === 'string' && v.error.trim()) return v.error
      try {
        return JSON.stringify(v)
      } catch {
        return fallback
      }
    }
    return fallback
  }

  const totalShare = useMemo(
    () => partners.reduce((sum, p) => sum + Number(p.sharePercent), 0),
    [partners]
  )

  useEffect(() => {
    const load = async () => {
      try {
        const response = await clubsService.getAll({ limit: 200 })
        const allClubs = response.data || []
        setClubs(allClubs)
        if (allClubs.length > 0) {
          setSelectedClubId(allClubs[0].id)
        }
      } catch (e: any) {
        setError(toErrorText(e?.error || e?.message || e, 'Ошибка загрузки клубов'))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedClubId) return
    loadInitialData(selectedClubId)
  }, [selectedClubId])

  const loadInitialData = async (clubId: number) => {
    try {
      const [partnersRes, usersRes] = await Promise.all([
        clubFinanceService.getPartners(clubId),
        clubFinanceService.getClubUsers(clubId),
      ])
      let managersData: ClubPartnerManager[] = []
      try {
        const managersRes = await clubFinanceService.getPartnerManagers(clubId)
        managersData = Array.isArray(managersRes) ? managersRes : managersRes.data || []
      } catch (managersError: any) {
        // Не блокируем страницу партнеров, если менеджеры временно недоступны
        setError(toErrorText(managersError?.error || managersError?.message || managersError, 'Ошибка загрузки менеджеров партнеров'))
      }
      const partnersData = Array.isArray(partnersRes) ? partnersRes : partnersRes.data || []
      const usersData = Array.isArray(usersRes) ? usersRes : usersRes.data || []
      setPartners(partnersData)
      setClubUsers(usersData)
      setPartnerManagers(managersData)
    } catch (e: any) {
      setError(toErrorText(e?.error || e?.message || e, 'Ошибка загрузки партнеров'))
    }
  }

  const handleAddPartner = async () => {
    if (!selectedClubId || !name.trim() || !sharePercent) return
    try {
      await clubFinanceService.createPartner(selectedClubId, {
        name: name.trim(),
        sharePercent: Number(sharePercent),
      })
      setName('')
      setSharePercent('')
      await loadInitialData(selectedClubId)
    } catch (e: any) {
      setError(toErrorText(e?.error || e?.message || e, 'Ошибка создания партнера'))
    }
  }

  const handleDeletePartner = async (partnerId: number) => {
    if (!selectedClubId) return
    if (!confirm('Удалить партнера?')) return
    try {
      await clubFinanceService.deletePartner(selectedClubId, partnerId)
      await loadInitialData(selectedClubId)
    } catch (e: any) {
      setError(toErrorText(e?.error || e?.message || e, 'Ошибка удаления партнера'))
    }
  }

  const handleAssignExistingManager = async (partnerId: number) => {
    if (!selectedClubId) return
    const userId = managerUserByPartner[partnerId]
    if (!userId) return
    try {
      await clubFinanceService.createPartnerManager(selectedClubId, {
        partnerId,
        userId: Number(userId),
      })
      setManagerUserByPartner((prev) => ({ ...prev, [partnerId]: '' }))
      await loadInitialData(selectedClubId)
    } catch (e: any) {
      setError(toErrorText(e?.error || e?.message || e, 'Ошибка привязки менеджера'))
    }
  }

  const handleCreateManagerAccount = async (partnerId: number) => {
    if (!selectedClubId) return
    const managerData = newManagerByPartner[partnerId]
    if (!managerData?.email || !managerData?.password || !managerData?.firstName || !managerData?.lastName) {
      setError('Для нового менеджера заполните email, пароль, имя и фамилию')
      return
    }
    try {
      await clubFinanceService.createPartnerManager(selectedClubId, {
        partnerId,
        userData: {
          ...managerData,
          role: UserRole.CLUB_STAFF,
        },
      })
      setNewManagerByPartner((prev) => ({
        ...prev,
        [partnerId]: { email: '', password: '', firstName: '', lastName: '', phone: '' },
      }))
      setCreatingManagerForPartnerId(null)
      await loadInitialData(selectedClubId)
    } catch (e: any) {
      setError(toErrorText(e?.error || e?.message || e, 'Ошибка создания менеджера'))
    }
  }

  const handleDeleteManager = async (managerId: number) => {
    if (!selectedClubId) return
    if (!confirm('Отвязать менеджера от партнера?')) return
    try {
      await clubFinanceService.deletePartnerManager(selectedClubId, managerId)
      await loadInitialData(selectedClubId)
    } catch (e: any) {
      setError(toErrorText(e?.error || e?.message || e, 'Ошибка удаления менеджера'))
    }
  }

  const getManagersForPartner = (partnerId: number) =>
    partnerManagers.filter((manager) => manager.partnerId === partnerId)

  if (loading) return <div className="p-6">Загрузка...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-2xl font-bold">Партнеры яхт-клуба</h1>
      </div>

      {error && <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>}

      {!canEditPartners && (
        <div className="p-3 rounded bg-blue-50 text-blue-800 border border-blue-200 text-sm">
          Режим просмотра: настройку партнёров и менеджеров может менять только владелец клуба или администратор.
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Клуб</label>
          <select
            className="w-full border rounded px-3 py-2"
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

        {canEditPartners && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Имя партнера</label>
              <input
                className="w-full border rounded px-3 py-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Например, Партнер 1"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Доля (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                className="w-full border rounded px-3 py-2"
                value={sharePercent}
                onChange={(e) => setSharePercent(e.target.value)}
              />
            </div>
            <button
              onClick={handleAddPartner}
              className="inline-flex items-center justify-center px-4 py-2 rounded bg-primary-600 text-white hover:bg-primary-700"
            >
              <Plus className="h-4 w-4 mr-1" />
              Добавить
            </button>
          </div>
        )}

        <div className="text-sm text-gray-600">
          Сумма долей: <span className="font-semibold">{totalShare.toFixed(2)}%</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Партнер</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Доля</th>
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Менеджеры партнера</th>
              {canEditPartners && (
                <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Действия</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {partners.map((partner) => (
              <tr key={partner.id}>
                <td className="px-4 py-3">{partner.name}</td>
                <td className="px-4 py-3">{Number(partner.sharePercent).toFixed(2)}%</td>
                <td className="px-4 py-3">
                  <div className="space-y-2">
                    <div className="space-y-1">
                      {getManagersForPartner(partner.id).length === 0 ? (
                        <div className="text-sm text-gray-400">Менеджеры не добавлены</div>
                      ) : (
                        getManagersForPartner(partner.id).map((manager) => (
                          <div key={manager.id} className="flex items-center justify-between text-sm border rounded px-2 py-1">
                            <span>
                              {manager.user
                                ? `${manager.user.lastName || ''} ${manager.user.firstName || ''}`.trim() || manager.user.email
                                : `Менеджер #${manager.id}`}
                            </span>
                            {canEditPartners && (
                              <button
                                onClick={() => handleDeleteManager(manager.id)}
                                className="text-red-600 hover:text-red-700"
                              >
                                Удалить
                              </button>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {canEditPartners && (
                    <div className="flex gap-2">
                      <select
                        className="border rounded px-2 py-1 text-sm flex-1"
                        value={managerUserByPartner[partner.id] || ''}
                        onChange={(e) =>
                          setManagerUserByPartner((prev) => ({ ...prev, [partner.id]: e.target.value }))
                        }
                      >
                        <option value="">Выбрать существующий аккаунт</option>
                        {clubUsers.map((u) => (
                          <option key={u.id} value={u.id}>
                            {`${u.lastName || ''} ${u.firstName || ''}`.trim() || u.email}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleAssignExistingManager(partner.id)}
                        className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-sm"
                      >
                        Привязать
                      </button>
                    </div>
                    )}

                    {canEditPartners && (
                    <button
                      onClick={() =>
                        setCreatingManagerForPartnerId(
                          creatingManagerForPartnerId === partner.id ? null : partner.id
                        )
                      }
                      className="text-sm text-primary-600 hover:text-primary-700"
                    >
                      {creatingManagerForPartnerId === partner.id ? 'Скрыть форму нового менеджера' : 'Создать новый аккаунт менеджера'}
                    </button>
                    )}

                    {canEditPartners && creatingManagerForPartnerId === partner.id && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 bg-gray-50 p-2 rounded">
                        <input
                          className="border rounded px-2 py-1 text-sm"
                          placeholder="Имя"
                          value={newManagerByPartner[partner.id]?.firstName || ''}
                          onChange={(e) =>
                            setNewManagerByPartner((prev) => ({
                              ...prev,
                              [partner.id]: { ...(prev[partner.id] || { email: '', password: '', firstName: '', lastName: '', phone: '' }), firstName: e.target.value },
                            }))
                          }
                        />
                        <input
                          className="border rounded px-2 py-1 text-sm"
                          placeholder="Фамилия"
                          value={newManagerByPartner[partner.id]?.lastName || ''}
                          onChange={(e) =>
                            setNewManagerByPartner((prev) => ({
                              ...prev,
                              [partner.id]: { ...(prev[partner.id] || { email: '', password: '', firstName: '', lastName: '', phone: '' }), lastName: e.target.value },
                            }))
                          }
                        />
                        <input
                          className="border rounded px-2 py-1 text-sm"
                          placeholder="Email"
                          value={newManagerByPartner[partner.id]?.email || ''}
                          onChange={(e) =>
                            setNewManagerByPartner((prev) => ({
                              ...prev,
                              [partner.id]: { ...(prev[partner.id] || { email: '', password: '', firstName: '', lastName: '', phone: '' }), email: e.target.value },
                            }))
                          }
                        />
                        <input
                          className="border rounded px-2 py-1 text-sm"
                          placeholder="Телефон"
                          value={newManagerByPartner[partner.id]?.phone || ''}
                          onChange={(e) =>
                            setNewManagerByPartner((prev) => ({
                              ...prev,
                              [partner.id]: { ...(prev[partner.id] || { email: '', password: '', firstName: '', lastName: '', phone: '' }), phone: e.target.value },
                            }))
                          }
                        />
                        <input
                          type="password"
                          className="border rounded px-2 py-1 text-sm md:col-span-2"
                          placeholder="Пароль"
                          value={newManagerByPartner[partner.id]?.password || ''}
                          onChange={(e) =>
                            setNewManagerByPartner((prev) => ({
                              ...prev,
                              [partner.id]: { ...(prev[partner.id] || { email: '', password: '', firstName: '', lastName: '', phone: '' }), password: e.target.value },
                            }))
                          }
                        />
                        <button
                          onClick={() => handleCreateManagerAccount(partner.id)}
                          className="px-2 py-1 rounded bg-primary-600 text-white hover:bg-primary-700 text-sm md:col-span-2"
                        >
                          Создать и привязать менеджера
                        </button>
                      </div>
                    )}
                  </div>
                </td>
                {canEditPartners && (
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDeletePartner(partner.id)}
                    className="inline-flex items-center px-2 py-1 rounded text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Удалить
                  </button>
                </td>
                )}
              </tr>
            ))}
            {partners.length === 0 && (
              <tr>
                <td colSpan={canEditPartners ? 4 : 3} className="px-4 py-6 text-center text-gray-500">
                  Партнеры не добавлены
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

