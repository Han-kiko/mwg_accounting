import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Card, Space, Statistic, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

// 棋盘配置：20×20 格，每格 24 像素，棋盘边长 20×24 = 480 像素
const GRID = 20;
const CELL = 24;
const BOARD = GRID * CELL;

// 最高分存在浏览器本地存储里的键名。
// 刻意不写进账本数据库——游戏成绩不该混进账单数据，账本备份也不受影响。
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

// 蛇不能原地掉头（那样等于立刻撞到自己），所以要知道每个方向的反方向是什么
const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

// 按键映射：方向键和 W/A/S/D 都能用来操作
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

/**
 * 随机挑一个没被蛇占住的格子放食物。
 * 做法：先把蛇身占的格子编号收进集合（用 y*GRID+x 把二维坐标压成一个整数，
 * 这样查起来快），再把所有空格子收集起来，从中随便挑一个。
 */
function randomFood(snake: Point[]): Point {
  const occupied = new Set(snake.map((p) => p.y * GRID + p.x));
  const free: Point[] = [];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      if (!occupied.has(y * GRID + x)) free.push({ x, y });
    }
  }
  // 蛇把整个棋盘占满时一个空格都没有（要 3970 分才会发生，实际碰不到）。
  // 返回一个棋盘外的位置：画不出来，但不会因为读到 undefined 而崩掉。
  if (free.length === 0) return { x: -1, y: -1 };
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

  // 游戏状态放在 ref 里而不是 state：每走一步只重画 canvas，不触发 React 重新渲染。
  // 蛇一秒要走好几步，用 state 的话界面会被反复重画拖卡。
  const stateRef = useRef<GameState>(initialState());

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const s = stateRef.current;

    // 把绘图坐标按屏幕缩放比放大，让 CSS 像素对上实际的物理像素。
    // 高分屏（Windows 缩放 125%、150% 之类）不做这一步，画面会糊或者只画出一角。
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, BOARD, BOARD);

    // 画网格线（浅灰细线，方便看清格子边界）
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

    // 画食物：红色方块，四周各留 2 像素空隙，看起来像颗珠子
    ctx.fillStyle = '#ff4d4f';
    ctx.fillRect(s.food.x * CELL + 2, s.food.y * CELL + 2, CELL - 4, CELL - 4);

    // 画蛇身。蛇头是数组第 0 个，用深一点的绿色，和身子区分开
    s.snake.forEach((p, i) => {
      ctx.fillStyle = i === 0 ? '#237804' : '#52c41a';
      ctx.fillRect(p.x * CELL + 1, p.y * CELL + 1, CELL - 2, CELL - 2);
    });
  }, []);

  // 页面刚打开时：设好画布的实际分辨率（高分屏要乘缩放比），并画出第一帧。
  // 这样还没开始玩之前，也能看见棋盘和蛇的初始位置。
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

  // 主循环：定时器每隔一小段时间让蛇走一步。
  // 分数越高间隔越短，也就是「越吃越快」；最快封顶在 70 毫秒一步，再快就没法操作了。
  useEffect(() => {
    if (phase !== 'running') return;
    const speedMs = Math.max(70, 160 - Math.floor(score / 50) * 15);
    const timer = window.setInterval(() => {
      const s = stateRef.current;
      if (s.over) return;
      const dir = s.pendingDirection;
      const head = { x: s.snake[0].x + DELTA[dir].x, y: s.snake[0].y + DELTA[dir].y };

      // 撞墙：蛇头跑出棋盘范围就结束
      if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) {
        gameOver();
        return;
      }

      const eats = head.x === s.food.x && head.y === s.food.y;
      // 吃到食物时尾巴不动（蛇就长长一节）；没吃到时尾巴让出来，长度保持不变
      const body = eats ? s.snake : s.snake.slice(0, -1);

      // 撞到自己身上
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

  // 键盘控制：按下方向键或 W/A/S/D，就改变蛇下一步要去的方向
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const dir = KEY_TO_DIRECTION[e.key];
      if (!dir) return;
      e.preventDefault();
      const s = stateRef.current;
      // 不允许原地掉头。注意这里比的是「下一步真正要走的方向」（pendingDirection），
      // 而不是当前方向——连续快速按两个键时蛇还没走出去，比当前方向会漏判。
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
