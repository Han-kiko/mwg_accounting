import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, Space, Statistic, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

// Board config: 20x20 cells, 24px each
const GRID = 20;
const CELL = 24;
const BOARD = GRID * CELL;

const HIGH_SCORE_KEY = 'snake-high-score';

type Point = { x: number; y: number };
type Direction = 'up' | 'down' | 'left' | 'right';
type Phase = 'ready' | 'running' | 'over';

const DELTA: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

// The snake must never reverse 180 degrees into itself
const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

// Arrow keys and W/A/S/D both work
const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  w: 'up',
  s: 'down',
  a: 'left',
  d: 'right',
};

const INITIAL_SNAKE: Point[] = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
];

// Pick a random cell that is not occupied by the snake
function randomFood(snake: Point[]): Point {
  const occupied = new Set(snake.map((p) => p.y * GRID + p.x));
  const free: Point[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!occupied.has(y * GRID + x)) free.push({ x, y });
    }
  }
  return free[Math.floor(Math.random() * free.length)];
}

interface GameState {
  snake: Point[];
  food: Point;
  direction: Direction;
  pendingDirection: Direction;
  over: boolean;
}

const initialState = (): GameState => ({
  snake: [...INITIAL_SNAKE],
  food: randomFood(INITIAL_SNAKE),
  direction: 'right',
  pendingDirection: 'right',
  over: false,
});

export default function SnakeGamePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('ready');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => Number(localStorage.getItem(HIGH_SCORE_KEY)) || 0);
  const [newRecord, setNewRecord] = useState(false);

  // Game state lives in a ref so ticks only repaint the canvas, never re-render React
  const stateRef = useRef<GameState>(initialState());

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = stateRef.current;

    // Scale drawing coordinates so CSS pixels map to the full backing store (high-DPI fix)
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, BOARD, BOARD);

    // Grid lines
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = 1;
    for (let i = 1; i < GRID; i++) {
      ctx.beginPath();
      ctx.moveTo(i * CELL, 0);
      ctx.lineTo(i * CELL, BOARD);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * CELL);
      ctx.lineTo(BOARD, i * CELL);
      ctx.stroke();
    }

    // Food
    ctx.fillStyle = '#ff4d4f';
    ctx.fillRect(s.food.x * CELL + 2, s.food.y * CELL + 2, CELL - 4, CELL - 4);

    // Snake body, darker head
    s.snake.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? '#237804' : '#52c41a';
      ctx.fillRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }, []);

  // On mount: set the canvas backing resolution (for high-DPI screens) and paint the first frame
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = BOARD * dpr;
    canvas.height = BOARD * dpr;
    draw();
  }, [draw]);

  const gameOver = useCallback(() => {
    stateRef.current.over = true;
    setPhase('over');
    if (score > highScore) {
      localStorage.setItem(HIGH_SCORE_KEY, String(score));
      setHighScore(score);
      setNewRecord(true);
    }
  }, [score, highScore]);

  // Main loop: the interval between moves shrinks as the score grows (speeds up)
  useEffect(() => {
    if (phase !== 'running') return;
    const speedMs = Math.max(70, 160 - Math.floor(score / 50) * 15);
    const timer = window.setInterval(() => {
      const s = stateRef.current;
      if (s.over) return;
      const dir = s.pendingDirection;
      const head = { x: s.snake[0].x + DELTA[dir].x, y: s.snake[0].y + DELTA[dir].y };

      // Hit a wall
      if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
        gameOver();
        return;
      }

      const eats = head.x === s.food.x && head.y === s.food.y;
      // When eating, the tail stays (snake grows); otherwise the tail cell frees up
      const body = eats ? s.snake : s.snake.slice(0, -1);

      // Hit itself
      if (body.some((p) => p.x === head.x && p.y === head.y)) {
        gameOver();
        return;
      }

      s.snake = [head, ...body];
      s.direction = dir;
      if (eats) {
        s.food = randomFood(s.snake);
        setScore((prev) => prev + 10);
      }
      draw();
    }, speedMs);
    return () => window.clearInterval(timer);
  }, [phase, score, draw, gameOver]);

  // Keyboard controls
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const dir = KEY_TO_DIRECTION[e.key];
      if (!dir) return;
      e.preventDefault();
      const s = stateRef.current;
      // Reject a reversal: compare against the direction that will actually be applied next
      if (OPPOSITE[dir] === s.pendingDirection) return;
      if (phase === 'ready') {
        s.pendingDirection = dir;
        setPhase('running');
      } else if (phase === 'running') {
        s.pendingDirection = dir;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [phase]);

  const startGame = () => {
    stateRef.current = initialState();
    setScore(0);
    setNewRecord(false);
    setPhase('running');
  };

  return (
    <Card title="贪吃蛇">
      <Space direction="vertical" size={16} align="center" style={{ width: '100%' }}>
        <Space size={64}>
          <Statistic title="本局得分" value={score} />
          <Statistic title="历史最高分" value={highScore} />
        </Space>
        <div style={{ position: 'relative' }}>
          <canvas
            ref={canvasRef}
            style={{ display: 'block', width: BOARD, height: BOARD, borderRadius: 8, background: '#fafafa' }}
          />
          {phase !== 'running' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                padding: 24,
                background: 'rgba(0, 0, 0, 0.55)',
                borderRadius: 8,
                color: '#fff',
                textAlign: 'center',
              }}
            >
              {phase === 'ready' ? (
                <>
                  <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
                    按方向键开始（或 W/A/S/D）
                  </Typography.Title>
                  <Typography.Text style={{ color: 'rgba(255,255,255,0.85)' }}>
                    吃到红色食物得分，越吃越快；撞墙或撞到自己游戏结束
                  </Typography.Text>
                </>
              ) : (
                <>
                  <Typography.Title level={4} style={{ color: '#fff', margin: 0 }}>
                    游戏结束
                  </Typography.Title>
                  {newRecord && (
                    <Typography.Text style={{ color: '#ffd666', fontSize: 16 }}>🎉 新纪录！</Typography.Text>
                  )}
                  <Typography.Text style={{ color: 'rgba(255,255,255,0.85)' }}>
                    本局得分：{score}
                  </Typography.Text>
                  <Button type="primary" icon={<ReloadOutlined />} onClick={startGame}>
                    再来一局
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </Space>
    </Card>
  );
}
