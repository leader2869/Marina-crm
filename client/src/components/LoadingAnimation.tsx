// Анимация загрузки с 20 разными вариантами яхт/катеров (случайный выбор)
import React, { useMemo } from 'react'

interface LoadingAnimationProps {
  message?: string
  fullScreen?: boolean
}

// 20 разных вариантов яхт/катеров
const boatVariants = [
  // Вариант 1: Современная яхта с двумя парусами
  () => (
    <>
      <path d="M10 35 L60 35 L55 42 L15 42 Z" fill="#1E3A8A" className="boat-body" />
      <path d="M15 35 L55 35 L52 38 L18 38 Z" fill="#3B82F6" />
      <line x1="35" y1="35" x2="35" y2="10" stroke="#1F2937" strokeWidth="2" className="boat-mast" />
      <path d="M35 15 L35 32 L50 32 Z" fill="#FFFFFF" className="boat-sail" />
      <path d="M35 12 L35 28 L20 28 Z" fill="#E5E7EB" className="boat-sail" />
      <path d="M35 10 L35 14 L40 12 Z" fill="#EF4444" className="boat-flag" />
    </>
  ),
  
  // Вариант 2: Классический парусник с одной мачтой
  () => (
    <>
      <path d="M8 38 L62 38 L60 46 L10 46 Z" fill="#8B4513" className="boat-body" />
      <path d="M10 38 L60 38 L58 42 L12 42 Z" fill="#D2691E" />
      <line x1="35" y1="38" x2="35" y2="12" stroke="#654321" strokeWidth="2.5" className="boat-mast" />
      <path d="M35 15 L35 35 L55 35 Z" fill="#FFFFFF" className="boat-sail" />
      <path d="M35 12 L35 30 L20 30 Z" fill="#F3F4F6" className="boat-sail" />
      <path d="M35 12 L35 16 L40 14 Z" fill="#DC2626" className="boat-flag" />
    </>
  ),
  
  // Вариант 3: Моторный катер
  () => (
    <>
      <path d="M8 40 L62 40 L60 48 L10 48 Z" fill="#2563EB" className="boat-body" />
      <path d="M10 40 L60 40 L58 44 L12 44 Z" fill="#3B82F6" />
      <rect x="20" y="36" width="30" height="8" fill="#1E40AF" rx="2" />
      <rect x="24" y="38" width="5" height="5" fill="#93C5FD" rx="1" />
      <rect x="32" y="38" width="5" height="5" fill="#93C5FD" rx="1" />
      <rect x="40" y="38" width="5" height="5" fill="#93C5FD" rx="1" />
      <rect x="48" y="38" width="5" height="5" fill="#93C5FD" rx="1" />
    </>
  ),
  
  // Вариант 4: Парусник с двумя мачтами
  () => (
    <>
      <path d="M10 40 L60 40 L58 48 L12 48 Z" fill="#8B4513" className="boat-body" />
      <path d="M12 40 L58 40 L56 44 L14 44 Z" fill="#D2691E" />
      <line x1="25" y1="40" x2="25" y2="15" stroke="#654321" strokeWidth="3" className="boat-mast" />
      <line x1="45" y1="40" x2="45" y2="10" stroke="#654321" strokeWidth="3.5" className="boat-mast" />
      <path d="M25 18 L25 38 L15 38 Z" fill="#F9FAFB" className="boat-sail" />
      <path d="M45 12 L45 38 L60 38 Z" fill="#FFFFFF" className="boat-sail" />
      <path d="M45 10 L45 14 L50 12 Z" fill="#EF4444" className="boat-flag" />
    </>
  ),
  
  // Вариант 5: Современная яхта (синяя)
  () => (
    <>
      <path d="M8 42 L62 42 L60 50 L10 50 Z" fill="#1E40AF" className="boat-body" />
      <path d="M10 42 L60 42 L58 46 L12 46 Z" fill="#3B82F6" />
      <path d="M18 34 L52 34 L50 42 L20 42 Z" fill="#1E3A8A" />
      <rect x="24" y="36" width="8" height="5" fill="#60A5FA" rx="1" />
      <rect x="34" y="36" width="8" height="5" fill="#60A5FA" rx="1" />
      <rect x="44" y="36" width="8" height="5" fill="#60A5FA" rx="1" />
    </>
  ),
  
  // Вариант 6: Классический парусник (коричневый)
  () => (
    <>
      <path d="M10 38 L60 38 L58 46 L12 46 Z" fill="#8B4513" className="boat-body" />
      <path d="M12 38 L58 38 L56 42 L14 42 Z" fill="#A0522D" />
      <line x1="35" y1="38" x2="35" y2="10" stroke="#654321" strokeWidth="3" className="boat-mast" />
      <path d="M35 12 L35 36 L52 36 Z" fill="#FFFFFF" className="boat-sail" />
      <path d="M35 10 L35 14 L40 12 Z" fill="#DC2626" className="boat-flag" />
    </>
  ),
  
  // Вариант 7: Катер с кабиной
  () => (
    <>
      <path d="M8 40 L62 40 L60 48 L10 48 Z" fill="#0F172A" className="boat-body" />
      <path d="M10 40 L60 40 L58 44 L12 44 Z" fill="#1E293B" />
      <path d="M20 32 L50 32 L48 40 L22 40 Z" fill="#1E293B" />
      <rect x="24" y="34" width="6" height="5" fill="#60A5FA" rx="1" />
      <rect x="32" y="34" width="6" height="5" fill="#60A5FA" rx="1" />
      <rect x="40" y="34" width="6" height="5" fill="#60A5FA" rx="1" />
    </>
  ),
  
  // Вариант 8: Яхта с флайбриджем
  () => (
    <>
      <path d="M10 40 L60 40 L58 48 L12 48 Z" fill="#1E3A8A" className="boat-body" />
      <path d="M12 40 L58 40 L56 44 L14 44 Z" fill="#3B82F6" />
      <path d="M18 32 L52 32 L50 40 L20 40 Z" fill="#1E293B" />
      <path d="M22 28 L48 28 L46 32 L24 32 Z" fill="#334155" />
      <rect x="26" y="34" width="7" height="5" fill="#93C5FD" rx="1" />
      <rect x="35" y="34" width="7" height="5" fill="#93C5FD" rx="1" />
      <rect x="44" y="34" width="7" height="5" fill="#93C5FD" rx="1" />
    </>
  ),
  
  // Вариант 9: Парусник с большим парусом
  () => (
    <>
      <path d="M10 38 L60 38 L58 46 L12 46 Z" fill="#8B4513" className="boat-body" />
      <path d="M12 38 L58 38 L56 42 L14 42 Z" fill="#D2691E" />
      <line x1="35" y1="38" x2="35" y2="8" stroke="#654321" strokeWidth="3" className="boat-mast" />
      <path d="M35 10 L35 36 L58 36 Z" fill="#FFFFFF" className="boat-sail" />
      <path d="M35 8 L35 12 L42 10 Z" fill="#EF4444" className="boat-flag" />
    </>
  ),
  
  // Вариант 10: Катер с антенной
  () => (
    <>
      <path d="M8 40 L62 40 L60 48 L10 48 Z" fill="#1E40AF" className="boat-body" />
      <path d="M10 40 L60 40 L58 44 L12 44 Z" fill="#3B82F6" />
      <rect x="20" y="34" width="30" height="8" fill="#1E3A8A" rx="2" />
      <rect x="24" y="36" width="6" height="5" fill="#93C5FD" rx="1" />
      <rect x="32" y="36" width="6" height="5" fill="#93C5FD" rx="1" />
      <rect x="40" y="36" width="6" height="5" fill="#93C5FD" rx="1" />
      <circle cx="25" cy="32" r="2" fill="#64748B" />
      <line x1="25" y1="32" x2="25" y2="28" stroke="#475569" strokeWidth="1.5" />
    </>
  ),
  
  // Вариант 11: Яхта с двумя парусами (белый корпус)
  () => (
    <>
      <path d="M10 38 L60 38 L58 46 L12 46 Z" fill="#E5E7EB" className="boat-body" />
      <path d="M12 38 L58 38 L56 42 L14 42 Z" fill="#F3F4F6" />
      <line x1="35" y1="38" x2="35" y2="10" stroke="#4B5563" strokeWidth="2" className="boat-mast" />
      <path d="M35 15 L35 36 L50 36 Z" fill="#FFFFFF" className="boat-sail" />
      <path d="M35 12 L35 28 L20 28 Z" fill="#F9FAFB" className="boat-sail" />
      <path d="M35 10 L35 14 L40 12 Z" fill="#EF4444" className="boat-flag" />
    </>
  ),
  
  // Вариант 12: Катер с широкой кабиной
  () => (
    <>
      <path d="M8 40 L62 40 L60 48 L10 48 Z" fill="#0F172A" className="boat-body" />
      <path d="M10 40 L60 40 L58 44 L12 44 Z" fill="#334155" />
      <path d="M15 30 L55 30 L53 40 L17 40 Z" fill="#1E293B" />
      <rect x="20" y="32" width="8" height="6" fill="#60A5FA" rx="1" />
      <rect x="30" y="32" width="8" height="6" fill="#60A5FA" rx="1" />
      <rect x="40" y="32" width="8" height="6" fill="#60A5FA" rx="1" />
    </>
  ),
  
  // Вариант 13: Парусник с тремя парусами
  () => (
    <>
      <path d="M10 38 L60 38 L58 46 L12 46 Z" fill="#8B4513" className="boat-body" />
      <path d="M12 38 L58 38 L56 42 L14 42 Z" fill="#D2691E" />
      <line x1="35" y1="38" x2="35" y2="8" stroke="#654321" strokeWidth="3" className="boat-mast" />
      <path d="M35 10 L35 36 L55 36 Z" fill="#FFFFFF" className="boat-sail" />
      <path d="M35 12 L35 30 L20 30 Z" fill="#F3F4F6" className="boat-sail" />
      <path d="M35 15 L35 28 L25 28 Z" fill="#F9FAFB" className="boat-sail" />
      <path d="M35 8 L35 12 L42 10 Z" fill="#EF4444" className="boat-flag" />
    </>
  ),
  
  // Вариант 14: Современный катер (темный)
  () => (
    <>
      <path d="M8 40 L62 40 L60 48 L10 48 Z" fill="#0F172A" className="boat-body" />
      <path d="M10 40 L60 40 L58 44 L12 44 Z" fill="#1E293B" />
      <path d="M20 32 L50 32 L48 40 L22 40 Z" fill="#1E293B" />
      <path d="M22 30 L48 30 L46 32 L24 32 Z" fill="#334155" />
      <rect x="26" y="34" width="6" height="5" fill="#60A5FA" rx="1" />
      <rect x="34" y="34" width="6" height="5" fill="#60A5FA" rx="1" />
      <rect x="42" y="34" width="6" height="5" fill="#60A5FA" rx="1" />
    </>
  ),
  
  // Вариант 15: Яхта с панорамными окнами
  () => (
    <>
      <path d="M10 40 L60 40 L58 48 L12 48 Z" fill="#1E40AF" className="boat-body" />
      <path d="M12 40 L58 40 L56 44 L14 44 Z" fill="#3B82F6" />
      <path d="M18 32 L52 32 L50 40 L20 40 Z" fill="#1E3A8A" />
      <rect x="20" y="34" width="12" height="5" fill="#60A5FA" rx="1" />
      <rect x="34" y="34" width="12" height="5" fill="#60A5FA" rx="1" />
      <rect x="48" y="34" width="12" height="5" fill="#60A5FA" rx="1" />
    </>
  ),
  
  // Вариант 16: Классический парусник (маленький)
  () => (
    <>
      <path d="M12 36 L58 36 L56 44 L14 44 Z" fill="#8B4513" className="boat-body" />
      <path d="M14 36 L56 36 L54 40 L16 40 Z" fill="#D2691E" />
      <line x1="35" y1="36" x2="35" y2="12" stroke="#654321" strokeWidth="2.5" className="boat-mast" />
      <path d="M35 14 L35 34 L50 34 Z" fill="#FFFFFF" className="boat-sail" />
      <path d="M35 12 L35 16 L40 14 Z" fill="#DC2626" className="boat-flag" />
    </>
  ),
  
  // Вариант 17: Катер с двумя кабинами
  () => (
    <>
      <path d="M8 40 L62 40 L60 48 L10 48 Z" fill="#2563EB" className="boat-body" />
      <path d="M10 40 L60 40 L58 44 L12 44 Z" fill="#3B82F6" />
      <path d="M18 32 L38 32 L36 40 L20 40 Z" fill="#1E40AF" />
      <path d="M40 32 L60 32 L58 40 L42 40 Z" fill="#1E40AF" />
      <rect x="22" y="34" width="5" height="5" fill="#93C5FD" rx="1" />
      <rect x="44" y="34" width="5" height="5" fill="#93C5FD" rx="1" />
    </>
  ),
  
  // Вариант 18: Яхта с высоким флайбриджем
  () => (
    <>
      <path d="M10 40 L60 40 L58 48 L12 48 Z" fill="#1E3A8A" className="boat-body" />
      <path d="M12 40 L58 40 L56 44 L14 44 Z" fill="#3B82F6" />
      <path d="M18 30 L52 30 L50 40 L20 40 Z" fill="#1E293B" />
      <path d="M22 24 L48 24 L46 30 L24 30 Z" fill="#334155" />
      <rect x="26" y="32" width="7" height="6" fill="#93C5FD" rx="1" />
      <rect x="35" y="32" width="7" height="6" fill="#93C5FD" rx="1" />
      <rect x="44" y="32" width="7" height="6" fill="#93C5FD" rx="1" />
    </>
  ),
  
  // Вариант 19: Парусник с двумя мачтами (компактный)
  () => (
    <>
      <path d="M10 38 L60 38 L58 46 L12 46 Z" fill="#8B4513" className="boat-body" />
      <path d="M12 38 L58 38 L56 42 L14 42 Z" fill="#D2691E" />
      <line x1="28" y1="38" x2="28" y2="18" stroke="#654321" strokeWidth="2.5" className="boat-mast" />
      <line x1="42" y1="38" x2="42" y2="14" stroke="#654321" strokeWidth="3" className="boat-mast" />
      <path d="M28 20 L28 36 L18 36 Z" fill="#F9FAFB" className="boat-sail" />
      <path d="M42 16 L42 36 L54 36 Z" fill="#FFFFFF" className="boat-sail" />
      <path d="M42 14 L42 18 L48 16 Z" fill="#EF4444" className="boat-flag" />
    </>
  ),
  
  // Вариант 20: Катер с радаром
  () => (
    <>
      <path d="M8 40 L62 40 L60 48 L10 48 Z" fill="#0F172A" className="boat-body" />
      <path d="M10 40 L60 40 L58 44 L12 44 Z" fill="#1E293B" />
      <path d="M20 32 L50 32 L48 40 L22 40 Z" fill="#1E293B" />
      <rect x="24" y="34" width="6" height="5" fill="#60A5FA" rx="1" />
      <rect x="32" y="34" width="6" height="5" fill="#60A5FA" rx="1" />
      <rect x="40" y="34" width="6" height="5" fill="#60A5FA" rx="1" />
      <circle cx="26" cy="30" r="2.5" fill="#64748B" />
      <line x1="26" y1="30" x2="26" y2="26" stroke="#475569" strokeWidth="1.5" />
      <circle cx="26" cy="26" r="1" fill="#94A3B8" />
    </>
  ),
]

export const LoadingAnimation: React.FC<LoadingAnimationProps> = ({ 
  message = 'Загрузка...',
  fullScreen = false 
}) => {
  const containerClass = fullScreen 
    ? 'flex items-center justify-center min-h-screen'
    : 'flex items-center justify-center py-12'

  // Случайный выбор варианта яхты при каждом рендере
  const randomVariant = useMemo(() => {
    return Math.floor(Math.random() * boatVariants.length)
  }, [])

  const BoatComponent = boatVariants[randomVariant]

  return (
    <div className={containerClass}>
      <div className="flex flex-col items-center justify-center">
        <div className="boat-container">
          <svg width="210" height="150" viewBox="0 0 70 50" className="boat">
            {/* Волны - для всех вариантов */}
            <g className="waves">
              {/* Волна 1 */}
              <path d="M0 42 Q20 38 40 42 T70 42 L70 50 L0 50 Z" fill="#3B82F6" opacity="0.4" className="wave-1" />
              {/* Волна 2 */}
              <path d="M0 44 Q15 40 30 44 T60 44 T70 44 L70 50 L0 50 Z" fill="#60A5FA" opacity="0.5" className="wave-2" />
              {/* Волна 3 */}
              <path d="M0 46 Q10 42 20 46 T40 46 T60 46 T70 46 L70 50 L0 50 Z" fill="#93C5FD" opacity="0.6" className="wave-3" />
            </g>
            
            {/* Случайно выбранная яхта/катер */}
            <BoatComponent />
          </svg>
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm font-medium text-gray-600 animate-pulse">{message}</p>
        </div>
      </div>
      <style>{`
        .boat-container { 
          animation: boatSway 2s ease-in-out infinite; 
        }
        .boat {
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
        }
        .boat-body { 
          animation: boatBounce 2.5s ease-in-out infinite; 
        }
        .boat-mast { 
          animation: mastSway 2s ease-in-out infinite; 
          transform-origin: bottom center; 
        }
        .boat-sail { 
          animation: sailFlap 1.5s ease-in-out infinite; 
        }
        .boat-flag { 
          animation: flagWave 1s ease-in-out infinite; 
          transform-origin: left center; 
        }
        @keyframes boatSway { 
          0%, 100% { transform: rotate(0deg); } 
          25% { transform: rotate(-3deg); } 
          75% { transform: rotate(3deg); } 
        }
        @keyframes boatBounce { 
          0%, 100% { transform: translateY(0); } 
          50% { transform: translateY(-2px); } 
        }
        @keyframes mastSway { 
          0%, 100% { transform: rotate(0deg); } 
          25% { transform: rotate(-1.5deg); } 
          75% { transform: rotate(1.5deg); } 
        }
        @keyframes sailFlap { 
          0%, 100% { transform: scaleY(1); } 
          50% { transform: scaleY(1.08); } 
        }
        @keyframes flagWave { 
          0%, 100% { transform: rotate(0deg); } 
          50% { transform: rotate(15deg); } 
        }
        .wave-1 {
          animation: wave1 3s ease-in-out infinite;
        }
        .wave-2 {
          animation: wave2 4s ease-in-out infinite;
        }
        .wave-3 {
          animation: wave3 5s ease-in-out infinite;
        }
        @keyframes wave1 {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(-10px);
          }
        }
        @keyframes wave2 {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(15px);
          }
        }
        @keyframes wave3 {
          0%, 100% {
            transform: translateX(0);
          }
          50% {
            transform: translateX(-8px);
          }
        }
      `}</style>
    </div>
  )
}

export default LoadingAnimation
