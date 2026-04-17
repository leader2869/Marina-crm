import { useEffect, useMemo, useState } from 'react'
import { clubsService, clubFinanceService } from '../services/api'
import { Club, ClubPartner } from '../types'
import { Plus, Trash2, Save } from 'lucide-react'
import BackButton from '../components/BackButton'

export default function ClubPartners() {
  const [clubs, setClubs] = useState<Club[]>([])
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null)
  const [partners, setPartners] = useState<ClubPartner[]>([])
  const [name, setName] = useState('')
  const [sharePercent, setSharePercent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
        setError(e.error || e.message || 'Ошибка загрузки клубов')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!selectedClubId) return
    loadPartners(selectedClubId)
  }, [selectedClubId])

  const loadPartners = async (clubId: number) => {
    try {
      const response = await clubFinanceService.getPartners(clubId)
      const data = Array.isArray(response) ? response : response.data || []
      setPartners(data)
    } catch (e: any) {
      setError(e.error || e.message || 'Ошибка загрузки партнеров')
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
      await loadPartners(selectedClubId)
    } catch (e: any) {
      setError(e.error || e.message || 'Ошибка создания партнера')
    }
  }

  const handleDeletePartner = async (partnerId: number) => {
    if (!selectedClubId) return
    if (!confirm('Удалить партнера?')) return
    try {
      await clubFinanceService.deletePartner(selectedClubId, partnerId)
      await loadPartners(selectedClubId)
    } catch (e: any) {
      setError(e.error || e.message || 'Ошибка удаления партнера')
    }
  }

  if (loading) return <div className="p-6">Загрузка...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <h1 className="text-2xl font-bold">Партнеры яхт-клуба</h1>
      </div>

      {error && <div className="p-3 rounded bg-red-50 text-red-700 border border-red-200">{error}</div>}

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
              <th className="px-4 py-2 text-left text-xs uppercase text-gray-500">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {partners.map((partner) => (
              <tr key={partner.id}>
                <td className="px-4 py-3">{partner.name}</td>
                <td className="px-4 py-3">{Number(partner.sharePercent).toFixed(2)}%</td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleDeletePartner(partner.id)}
                    className="inline-flex items-center px-2 py-1 rounded text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Удалить
                  </button>
                </td>
              </tr>
            ))}
            {partners.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
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

