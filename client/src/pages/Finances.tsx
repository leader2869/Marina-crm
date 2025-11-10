import { useState } from 'react'
import { DollarSign, TrendingUp, TrendingDown, PieChart } from 'lucide-react'

export default function Finances() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Финансы</h1>
        <p className="mt-2 text-gray-600">Управление доходами и расходами</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingUp className="h-6 w-6 text-green-600 mr-2" />
            Доходы
          </h2>
          <p className="text-gray-600">Модуль доходов в разработке</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <TrendingDown className="h-6 w-6 text-red-600 mr-2" />
            Расходы
          </h2>
          <p className="text-gray-600">Модуль расходов в разработке</p>
        </div>

        <div className="bg-white rounded-lg shadow p-6 lg:col-span-2">
          <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
            <PieChart className="h-6 w-6 text-primary-600 mr-2" />
            Аналитика
          </h2>
          <p className="text-gray-600">Финансовая аналитика в разработке</p>
        </div>
      </div>
    </div>
  )
}

