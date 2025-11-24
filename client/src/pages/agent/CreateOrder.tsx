import { FilePlus } from 'lucide-react'

export default function CreateOrder() {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <FilePlus className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Активные заказы</h2>
          <p className="text-gray-600">Функционал активных заказов будет доступен в ближайшее время</p>
        </div>
      </div>
    </div>
  )
}

