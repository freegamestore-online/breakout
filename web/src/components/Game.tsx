import { useEffect, useRef } from "react";
import { Application, Graphics } from "pixi.js";

interface GameProps {
  onScore: (score: number) => void;
  onGameOver: () => void;
  paused?: boolean;
}

// --- Layout constants (computed relative to canvas size) ---
const BRICK_ROWS = 6;
const BRICK_COLS = 10;
const BRICK_GAP = 4;
const BRICK_TOP_OFFSET = 60;
const PADDLE_HEIGHT = 14;
const PADDLE_RADIUS = 7;
const BALL_RADIUS = 7;
const INITIAL_BALL_SPEED = 5;
const SPEED_INCREMENT = 0.3; // per level
const LIVES_TOTAL = 3;

const ROW_COLORS: number[] = [
  0xef4444, // red
  0xf97316, // orange
  0xeab308, // yellow
  0x22c55e, // green
  0x3b82f6, // blue
  0x8b5cf6, // violet
];

const ROW_POINTS: number[] = [60, 50, 40, 30, 20, 10];

interface Brick {
  x: number;
  y: number;
  w: number;
  h: number;
  color: number;
  points: number;
  alive: boolean;
  gfx: Graphics;
}

export function Game({ onScore, onGameOver, paused }: GameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onScoreRef = useRef(onScore);
  const onGameOverRef = useRef(onGameOver);
  const pausedRef = useRef(paused);
  onScoreRef.current = onScore;
  onGameOverRef.current = onGameOver;
  pausedRef.current = paused;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    const app = new Application();

    (async () => {
      await app.init({ resizeTo: container, background: "#0f172a" });
      if (destroyed) {
        app.destroy(true);
        return;
      }
      container.appendChild(app.canvas);

      const W = app.screen.width;
      const H = app.screen.height;

      // --- State ---
      let score = 0;
      let lives = LIVES_TOTAL;
      let level = 0;
      let ballSpeed = INITIAL_BALL_SPEED;
      let ballDX = ballSpeed * 0.7;
      let ballDY = -ballSpeed * 0.7;
      let paddleX = W / 2;
      const paddleY = H - 40;
      const paddleW = 100;
      let ballX = W / 2;
      let ballY = paddleY - BALL_RADIUS - 1;
      let ballAttached = true;
      let alive = true;

      // --- Graphics objects ---
      const paddleGfx = new Graphics();
      const ballGfx = new Graphics();
      const livesGfx = new Graphics();
      app.stage.addChild(paddleGfx);
      app.stage.addChild(ballGfx);
      app.stage.addChild(livesGfx);

      function drawPaddle() {
        paddleGfx.clear();
        paddleGfx.roundRect(
          paddleX - paddleW / 2,
          paddleY,
          paddleW,
          PADDLE_HEIGHT,
          PADDLE_RADIUS,
        ).fill(0xf8fafc);
      }

      function drawBall() {
        ballGfx.clear();
        ballGfx.circle(ballX, ballY, BALL_RADIUS).fill(0xfbbf24);
      }

      function drawLives() {
        livesGfx.clear();
        for (let i = 0; i < lives; i++) {
          livesGfx.circle(20 + i * 22, 20, 7).fill(0xef4444);
        }
      }

      // --- Bricks ---
      let bricks: Brick[] = [];

      function createBricks() {
        // Remove old brick graphics
        for (const b of bricks) {
          app.stage.removeChild(b.gfx);
          b.gfx.destroy();
        }
        bricks = [];

        const totalGapX = BRICK_GAP * (BRICK_COLS + 1);
        const brickW = (W - totalGapX) / BRICK_COLS;
        const brickH = 18;

        for (let row = 0; row < BRICK_ROWS; row++) {
          const color = ROW_COLORS[row % ROW_COLORS.length]!;
          const points = ROW_POINTS[row % ROW_POINTS.length]!;
          for (let col = 0; col < BRICK_COLS; col++) {
            const x = BRICK_GAP + col * (brickW + BRICK_GAP);
            const y = BRICK_TOP_OFFSET + row * (brickH + BRICK_GAP);
            const gfx = new Graphics();
            gfx.roundRect(x, y, brickW, brickH, 4).fill(color);
            app.stage.addChild(gfx);
            bricks.push({ x, y, w: brickW, h: brickH, color, points, alive: true, gfx });
          }
        }
      }

      function resetBall() {
        ballAttached = true;
        ballX = paddleX;
        ballY = paddleY - BALL_RADIUS - 1;
        const angle = -Math.PI / 4 + Math.random() * (-Math.PI / 2);
        ballDX = Math.cos(angle) * ballSpeed;
        ballDY = Math.sin(angle) * ballSpeed;
        if (ballDY > 0) ballDY = -ballDY; // always go up
      }

      function nextLevel() {
        level++;
        ballSpeed = INITIAL_BALL_SPEED + level * SPEED_INCREMENT;
        createBricks();
        resetBall();
      }

      // Initialize first level
      createBricks();
      drawPaddle();
      drawBall();
      drawLives();

      // --- Input ---
      const keys = new Set<string>();

      function onKeyDown(e: KeyboardEvent) {
        keys.add(e.key);
        if (ballAttached && (e.key === " " || e.key === "ArrowUp")) {
          ballAttached = false;
        }
      }
      function onKeyUp(e: KeyboardEvent) {
        keys.delete(e.key);
      }

      function onPointerMove(e: PointerEvent) {
        const rect = app.canvas.getBoundingClientRect();
        paddleX = ((e.clientX - rect.left) / rect.width) * W;
        paddleX = Math.max(paddleW / 2, Math.min(W - paddleW / 2, paddleX));
      }

      function onPointerDown() {
        if (ballAttached) {
          ballAttached = false;
        }
      }

      // Touch support
      function onTouchMove(e: TouchEvent) {
        const touch = e.touches[0];
        if (!touch) return;
        const rect = app.canvas.getBoundingClientRect();
        paddleX = ((touch.clientX - rect.left) / rect.width) * W;
        paddleX = Math.max(paddleW / 2, Math.min(W - paddleW / 2, paddleX));
      }

      function onTouchStart() {
        if (ballAttached) {
          ballAttached = false;
        }
      }

      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      app.canvas.addEventListener("pointermove", onPointerMove);
      app.canvas.addEventListener("pointerdown", onPointerDown);
      app.canvas.addEventListener("touchmove", onTouchMove, { passive: true });
      app.canvas.addEventListener("touchstart", onTouchStart, { passive: true });

      // --- Game loop ---
      app.ticker.add((ticker) => {
        if (!alive || pausedRef.current) return;
        const dt = Math.min(ticker.deltaTime, 3); // cap at ~3 frames

        // Keyboard paddle movement
        const paddleSpeed = 8 * dt;
        if (keys.has("ArrowLeft") || keys.has("a")) {
          paddleX -= paddleSpeed;
        }
        if (keys.has("ArrowRight") || keys.has("d")) {
          paddleX += paddleSpeed;
        }
        paddleX = Math.max(paddleW / 2, Math.min(W - paddleW / 2, paddleX));

        // Ball follows paddle when attached
        if (ballAttached) {
          ballX = paddleX;
          ballY = paddleY - BALL_RADIUS - 1;
          drawPaddle();
          drawBall();
          return;
        }

        // Move ball
        ballX += ballDX * dt;
        ballY += ballDY * dt;

        // Wall collisions
        if (ballX - BALL_RADIUS < 0) {
          ballX = BALL_RADIUS;
          ballDX = Math.abs(ballDX);
        }
        if (ballX + BALL_RADIUS > W) {
          ballX = W - BALL_RADIUS;
          ballDX = -Math.abs(ballDX);
        }
        if (ballY - BALL_RADIUS < 0) {
          ballY = BALL_RADIUS;
          ballDY = Math.abs(ballDY);
        }

        // Ball fell below paddle
        if (ballY + BALL_RADIUS > H) {
          lives--;
          drawLives();
          if (lives <= 0) {
            alive = false;
            onGameOverRef.current();
            return;
          }
          resetBall();
          drawPaddle();
          drawBall();
          return;
        }

        // Paddle collision
        if (
          ballDY > 0 &&
          ballY + BALL_RADIUS >= paddleY &&
          ballY + BALL_RADIUS <= paddleY + PADDLE_HEIGHT + 4 &&
          ballX >= paddleX - paddleW / 2 - BALL_RADIUS &&
          ballX <= paddleX + paddleW / 2 + BALL_RADIUS
        ) {
          // Reflect with angle based on where ball hit paddle
          const hitPos = (ballX - (paddleX - paddleW / 2)) / paddleW; // 0..1
          const angle = -Math.PI * 0.15 - hitPos * Math.PI * 0.7; // -165deg to -15deg range
          const speed = Math.sqrt(ballDX * ballDX + ballDY * ballDY);
          ballDX = Math.cos(angle) * speed;
          ballDY = Math.sin(angle) * speed;
          ballY = paddleY - BALL_RADIUS - 1;
        }

        // Brick collisions
        let bricksRemaining = 0;
        for (const brick of bricks) {
          if (!brick.alive) continue;
          bricksRemaining++;

          // AABB check with ball center + radius
          const closestX = Math.max(brick.x, Math.min(ballX, brick.x + brick.w));
          const closestY = Math.max(brick.y, Math.min(ballY, brick.y + brick.h));
          const distX = ballX - closestX;
          const distY = ballY - closestY;

          if (distX * distX + distY * distY <= BALL_RADIUS * BALL_RADIUS) {
            brick.alive = false;
            brick.gfx.visible = false;
            bricksRemaining--;
            score += brick.points;
            onScoreRef.current(score);

            // Determine bounce direction
            const overlapX = BALL_RADIUS - Math.abs(distX);
            const overlapY = BALL_RADIUS - Math.abs(distY);
            if (overlapX < overlapY) {
              ballDX = -ballDX;
            } else {
              ballDY = -ballDY;
            }
            break; // one brick per frame
          }
        }

        // All bricks cleared — next level
        if (bricksRemaining === 0) {
          nextLevel();
        }

        drawPaddle();
        drawBall();
      });

      // Initial draws
      drawLives();
    })();

    return () => {
      destroyed = true;
      app.destroy(true);
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}
