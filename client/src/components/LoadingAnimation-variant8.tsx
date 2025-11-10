// ВАРИАНТ 8: Простой и красивый парусник (минималистичный, но элегантный)
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
          <svg width="60" height="45" viewBox="0 0 60 45">
            {/* Корпус */}
            <path d="M8 32 L52 32 L50 38 L10 38 Z" fill="#7C3AED" className="boat-body" />
            {/* Палуба */}
            <path d="M10 32 L50 32 L48 35 L12 35 Z" fill="#A78BFA" />
            {/* Мачта */}
            <line x1="30" y1="32" x2="30" y2="10" stroke="#4B5563" strokeWidth="2" className="boat-mast" />
            {/* Парус */}
            <path d="M30 12 L30 30 L48 30 Z" fill="#F0F9FF" stroke="#CBD5E1" strokeWidth="0.5" className="boat-sail" />
            {/* Флаг */}
            <path d="M30 10 L30 13 L35 11.5 Z" fill="#F59E0B" className="boat-flag" />
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

