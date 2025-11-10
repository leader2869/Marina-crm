// ВАРИАНТ 6: Красивый парусник (улучшенный)
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
          <svg width="70" height="50" viewBox="0 0 70 50">
            {/* Корпус */}
            <path d="M10 35 L60 35 L58 42 L12 42 Z" fill="#8B4513" className="boat-body" />
            {/* Палуба */}
            <path d="M12 35 L58 35 L56 38 L14 38 Z" fill="#D2691E" />
            {/* Мачта */}
            <line x1="35" y1="35" x2="35" y2="8" stroke="#654321" strokeWidth="2.5" className="boat-mast" />
            {/* Большой парус */}
            <path d="M35 12 L35 33 L55 33 Z" fill="#FFFFFF" stroke="#E5E7EB" strokeWidth="0.5" className="boat-sail" />
            {/* Маленький парус спереди */}
            <path d="M35 15 L35 30 L25 30 Z" fill="#F9FAFB" stroke="#E5E7EB" strokeWidth="0.5" className="boat-sail" />
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

