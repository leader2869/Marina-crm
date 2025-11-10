// ВАРИАНТ 4: Классический парусник с двумя парусами
import React from 'react'

interface LoadingAnimationProps {
  message?: string
  fullScreen?: boolean
}

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ 
  message = 'Загрузка...',
  fullScreen = false 
}) => {
  const containerClass = fullScreen 
    ? 'flex items-center justify-center min-h-screen'
    : 'flex items-center justify-center py-12'

  return (
    <div className={containerClass}>
      <div className="flex flex-col items-center justify-center">
        <div className="boat-container">
          <svg width="70" height="55" viewBox="0 0 70 55">
            {/* Корпус */}
            <path d="M8 38 L62 38 L58 46 L12 46 Z" fill="#8B4513" className="boat-body" />
            {/* Палуба */}
            <path d="M12 38 L58 38 L55 42 L15 42 Z" fill="#D2691E" />
            {/* Главная мачта */}
            <line x1="35" y1="38" x2="35" y2="8" stroke="#654321" strokeWidth="2.5" className="boat-mast" />
            {/* Передняя мачта */}
            <line x1="20" y1="38" x2="20" y2="18" stroke="#654321" strokeWidth="2" className="boat-mast" />
            {/* Главный парус */}
            <path d="M35 12 L35 35 L52 35 Z" fill="#FFFFFF" className="boat-sail" />
            {/* Передний парус */}
            <path d="M20 20 L20 35 L35 35 Z" fill="#F3F4F6" className="boat-sail" />
            {/* Флаг */}
            <path d="M35 8 L35 12 L40 10 Z" fill="#DC2626" className="boat-flag" />
          </svg>
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm font-medium text-gray-600 animate-pulse">{message}</p>
        </div>
      </div>
      <style>{`
        .boat-container { animation: boatSway 2s ease-in-out infinite; }
        .boat-body { animation: boatBounce 2.5s ease-in-out infinite; }
        .boat-mast { animation: mastSway 2s ease-in-out infinite; transform-origin: bottom center; }
        .boat-sail { animation: sailFlap 1.5s ease-in-out infinite; }
        .boat-flag { animation: flagWave 1s ease-in-out infinite; transform-origin: left center; }
        @keyframes boatSway { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-3deg); } 75% { transform: rotate(3deg); } }
        @keyframes boatBounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        @keyframes mastSway { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(-1.5deg); } 75% { transform: rotate(1.5deg); } }
        @keyframes sailFlap { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(1.08); } }
        @keyframes flagWave { 0%, 100% { transform: rotate(0deg); } 50% { transform: rotate(15deg); } }
      `}</style>
    </div>
  )
}

