import { useState, useEffect, useCallback, useRef } from 'react'
import { Gamepad2, Play, RotateCcw, Anchor, Ship } from 'lucide-react'
import BackButton from '../components/BackButton'

interface Position {
  x: number
  y: number
}

const GRID_SIZE = 20
const CELL_SIZE = 20
const INITIAL_SNAKE: Position[] = [{ x: 10, y: 10 }]
const INITIAL_DIRECTION = { x: 1, y: 0 }
const GAME_SPEED = 150

export default function MiniGames() {
  const [snake, setSnake] = useState<Position[]>(INITIAL_SNAKE)
  const [food, setFood] = useState<Position>({ x: 15, y: 15 })
  const [gameOver, setGameOver] = useState(false)
  const [score, setScore] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const directionRef = useRef<Position>(INITIAL_DIRECTION)
  const gameLoopRef = useRef<number | null>(null)

  // Генерация случайной позиции для еды
  const generateFood = useCallback((): Position => {
    const x = Math.floor(Math.random() * GRID_SIZE)
    const y = Math.floor(Math.random() * GRID_SIZE)
    return { x, y }
  }, [])

  // Проверка столкновения со стенами или собой
  const checkCollision = useCallback((head: Position, snakeBody: Position[]): boolean => {
    // Столкновение со стенами
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      return true
    }
    // Столкновение с собой
    return snakeBody.some((segment, index) => {
      if (index === 0) return false
      return segment.x === head.x && segment.y === head.y
    })
  }, [])

  // Игровой цикл
  useEffect(() => {
    if (!isPlaying || gameOver) {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
        gameLoopRef.current = null
      }
      return
    }

    gameLoopRef.current = window.setInterval(() => {
      setSnake((prevSnake) => {
        const newHead: Position = {
          x: prevSnake[0].x + directionRef.current.x,
          y: prevSnake[0].y + directionRef.current.y,
        }

        // Проверка столкновения
        if (checkCollision(newHead, prevSnake)) {
          setGameOver(true)
          setIsPlaying(false)
          return prevSnake
        }

        const newSnake = [newHead, ...prevSnake]

        // Проверка поедания еды
        if (newHead.x === food.x && newHead.y === food.y) {
          setScore((prev) => prev + 10)
          setFood(generateFood())
          return newSnake
        }

        // Удаляем хвост, если не съели еду
        return newSnake.slice(0, -1)
      })
    }, GAME_SPEED)

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current)
        gameLoopRef.current = null
      }
    }
  }, [isPlaying, gameOver, food, checkCollision, generateFood])

  // Обработка нажатий клавиш
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!isPlaying) return

      const key = e.key
      const newDirection = { ...directionRef.current }

      switch (key) {
        case 'ArrowUp':
          if (directionRef.current.y === 0) {
            newDirection.x = 0
            newDirection.y = -1
          }
          break
        case 'ArrowDown':
          if (directionRef.current.y === 0) {
            newDirection.x = 0
            newDirection.y = 1
          }
          break
        case 'ArrowLeft':
          if (directionRef.current.x === 0) {
            newDirection.x = -1
            newDirection.y = 0
          }
          break
        case 'ArrowRight':
          if (directionRef.current.x === 0) {
            newDirection.x = 1
            newDirection.y = 0
          }
          break
        default:
          return
      }

      directionRef.current = newDirection
      e.preventDefault()
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [isPlaying])

  // Начало игры
  const startGame = () => {
    setSnake(INITIAL_SNAKE)
    setFood(generateFood())
    directionRef.current = INITIAL_DIRECTION
    setGameOver(false)
    setScore(0)
    setIsPlaying(true)
  }

  // Перезапуск игры
  const resetGame = () => {
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current)
      gameLoopRef.current = null
    }
    setSnake(INITIAL_SNAKE)
    setFood(generateFood())
    directionRef.current = INITIAL_DIRECTION
    setGameOver(false)
    setScore(0)
    setIsPlaying(false)
  }

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

      {/* Игра Змейка */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Змейка</h2>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="text-lg font-semibold text-gray-700">
                Счет: <span className="text-primary-600">{score}</span>
              </div>
              {gameOver && (
                <div className="text-lg font-semibold text-red-600">
                  Игра окончена!
                </div>
              )}
            </div>
            <div className="flex gap-2">
              {!isPlaying && !gameOver && (
                <button
                  onClick={startGame}
                  className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Начать игру
                </button>
              )}
              {(gameOver || isPlaying) && (
                <button
                  onClick={resetGame}
                  className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Перезапустить
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Игровое поле */}
        <div className="flex flex-col items-center">
          <div
            className="border-4 border-gray-800 rounded-lg bg-gray-100"
            style={{
              width: GRID_SIZE * CELL_SIZE,
              height: GRID_SIZE * CELL_SIZE,
              position: 'relative',
            }}
          >
            {/* Якорь (еда) */}
            <div
              className="absolute flex items-center justify-center"
              style={{
                left: food.x * CELL_SIZE,
                top: food.y * CELL_SIZE,
                width: CELL_SIZE,
                height: CELL_SIZE,
              }}
            >
              <Anchor className="text-gray-800" size={CELL_SIZE - 4} />
            </div>

            {/* Катер */}
            {snake.map((segment, index) => (
              <div
                key={index}
                className="absolute flex items-center justify-center"
                style={{
                  left: segment.x * CELL_SIZE,
                  top: segment.y * CELL_SIZE,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  zIndex: snake.length - index,
                }}
              >
                {index === 0 ? (
                  <Ship 
                    className="text-primary-600" 
                    size={CELL_SIZE - 2}
                    style={{
                      filter: 'drop-shadow(0 0 4px rgba(37, 99, 235, 0.6))',
                    }}
                  />
                ) : (
                  <div
                    className="bg-primary-500 rounded-sm"
                    style={{
                      width: CELL_SIZE - 2,
                      height: CELL_SIZE - 2,
                    }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Инструкции */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg max-w-md">
            <h3 className="font-semibold text-gray-900 mb-2">Управление:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>⬆️ Стрелка вверх - движение вверх</li>
              <li>⬇️ Стрелка вниз - движение вниз</li>
              <li>⬅️ Стрелка влево - движение влево</li>
              <li>➡️ Стрелка вправо - движение вправо</li>
            </ul>
            <p className="text-sm text-gray-600 mt-3">
              Соберите как можно больше очков, собирая якоря. Управляйте катером и избегайте столкновений со стенами и собой!
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
