import { useState, useEffect } from 'react'
import { TrendingUp } from 'lucide-react'
import { vesselOwnerCashesService } from '../services/api'
import { LoadingAnimation } from '../components/LoadingAnimation'

export default function Incomes() {
  const [totalIncome, setTotalIncome] = useState<number>(0)
  const [cashesCount, setCashesCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTotalIncome()
  }, [])

  const loadTotalIncome = async () => {
    try {
      setLoading(true)
      const response: any = await vesselOwnerCashesService.getTotalIncome()
      setTotalIncome(response.totalIncome || 0)
      setCashesCount(response.cashesCount || 0)
    } catch (error: any) {
      console.error('Ошибка загрузки приходов:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <LoadingAnimation message="Загрузка приходов..." />
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Приходы</h1>
        <p className="mt-2 text-gray-600">Общая сумма приходов из всех касс</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-6 w-6 text-green-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Общие приходы</h2>
        </div>
        
        <div className="mt-6">
          <div className="bg-green-50 p-6 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Сумма приходов за весь период</p>
            <p className="text-4xl font-bold text-green-600">
              {totalIncome.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Из {cashesCount} {cashesCount === 1 ? 'кассы' : cashesCount < 5 ? 'касс' : 'касс'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

