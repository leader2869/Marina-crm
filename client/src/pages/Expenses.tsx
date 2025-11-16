import { TrendingDown } from 'lucide-react'
import BackButton from '../components/BackButton'

export default function Expenses() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Расходы</h1>
          <p className="mt-2 text-gray-600">Управление расходами</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <TrendingDown className="h-6 w-6 text-red-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Расходы</h2>
        </div>
        <p className="text-gray-600">Модуль расходов в разработке</p>
      </div>
    </div>
  )
}

