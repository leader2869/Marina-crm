import { Gamepad2 } from 'lucide-react'
import BackButton from '../components/BackButton'

export default function MiniGames() {
  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <BackButton />
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Gamepad2 className="h-8 w-8 text-primary-600 mr-3" />
            Мини игры
          </h1>
          <p className="mt-2 text-gray-600">Развлекательные мини-игры</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="text-center py-12">
          <Gamepad2 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Мини игры</h2>
          <p className="text-gray-600">Функционал мини-игр будет доступен в ближайшее время</p>
        </div>
      </div>
    </div>
  )
}

