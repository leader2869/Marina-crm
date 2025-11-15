import { Wallet } from 'lucide-react'

export default function Cash() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Касса</h1>
        <p className="mt-2 text-gray-600">Управление кассой</p>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center mb-4">
          <Wallet className="h-6 w-6 text-primary-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900">Касса</h2>
        </div>
        <p className="text-gray-600">Модуль кассы в разработке</p>
      </div>
    </div>
  )
}

