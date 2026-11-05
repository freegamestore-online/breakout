import { useEffect, useRef } from "react";
import { useGameSounds } from "@freegamestore/games";
import { Application, Graphics } from "pixi.js";
import { brickLayout, BRICK_COLS, type BrickRect } from "../lib/bricks";

interface GameProps {
  onScore: (score: number) => void;
  onLives: (lives: number) => void;
  onGameOver: () => void;
  paused?: boolean;
}

// --- Layout constants (computed relative to canvas size) ---
const PADDLE_HEIGHT = 22;
const PADDLE_RADIUS = 11;
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

interface Brick extends BrickRect {
  color: number;
  points: number;
  alive: boolean;
  gfx: Graphics;
}

export function Game({ onScore, onLives, onGameOver, paused }: GameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onScoreRef = useRef(onScore);
  const onLivesRef = useRef(onLives);
  const onGameOverRef = useRef(onGameOver);
  const pausedRef = useRef(paused);
  const sounds = useGameSounds();
  const soundsRef = useRef(sounds);
  onScoreRef.current = onScore;
  onLivesRef.current = onLives;
  onGameOverRef.current = onGameOver;
  pausedRef.current = paused;
  soundsRef.current = sounds;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let destroyed = false;
    let removeKeyListeners = () => {};
    const app = new Application();

    (async () => {
      await app.init({
        resizeTo: container,
        background: "#0f172a",
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      if (destroyed) {
        app.destroy(true);
        return;
      }
      container.appendChild(app.canvas);

      // app.screen.{width,height} can change when the container resizes
      // (window resize, phone rotation, sidebar collapsing). Read them through
      // helpers so paddle/ball positions track the current canvas size instead
      // of getting frozen at the values present on first mount.
      const screenW = () => app.screen.width;
      const screenH = () => app.screen.height;
      // Paddle sits 6% of the canvas height above the bottom, clamped to a
      // minimum 50px margin so it's never glued to the edge on tall screens
      // or invisibly below the viewport on small ones.
      const paddleYFromBottom = () => Math.max(50, screenH() * 0.06);
      const getPaddleY = () => screenH() - paddleYFromBottom();

      // --- State ---
      let score = 0;
      let lives = LIVES_TOTAL;
      let level = 0;
      let ballSpeed = INITIAL_BALL_SPEED;
      let ballDX = ballSpeed * 0.7;
      let ballDY = -ballSpeed * 0.7;
      let paddleX = screenW() / 2;
      const paddleW = 100;
      let ballX = screenW() / 2;
      let ballY = getPaddleY() - BALL_RADIUS - 1;
      let ballAttached = true;
      let alive = true;

      // --- Graphics objects ---
      const paddleGfx = new Graphics();
      const ballGfx = new Graphics();
      app.stage.addChild(paddleGfx);
      app.stage.addChild(ballGfx);

      function drawPaddle() {
        paddleGfx.clear();
        paddleGfx.roundRect(
          paddleX - paddleW / 2,
          getPaddleY(),
          paddleW,
          PADDLE_HEIGHT,
          PADDLE_RADIUS,
        ).fill(0xf8fafc);
      }

      function drawBall() {
        ballGfx.clear();
        ballGfx.circle(ballX, ballY, BALL_RADIUS).fill(0xfbbf24);
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

        brickLayout(screenW()).forEach((rect, i) => {
          const row = Math.floor(i / BRICK_COLS);
          const brick: Brick = {
            ...rect,
            color: ROW_COLORS[row % ROW_COLORS.length]!,
            points: ROW_POINTS[row % ROW_POINTS.length]!,
            alive: true,
            gfx: new Graphics(),
          };
          drawBrick(brick);
          app.stage.addChild(brick.gfx);
          bricks.push(brick);
        });
      }

      function drawBrick(b: Brick) {
        b.gfx.clear();
        b.gfx.roundRect(b.x, b.y, b.w, b.h, 4).fill(b.color);
      }

      // Bricks are laid out from the canvas width, so re-flow them (keeping
      // which ones are broken) and keep the ball/paddle proportionally placed
      // when the canvas resizes (rotation, window resize).
      let lastW = screenW();
      let lastH = screenH();
      app.renderer.on("resize", (w: number, h: number) => {
        brickLayout(w).forEach((rect, i) => {
          const brick = bricks[i]!;
          Object.assign(brick, rect);
          drawBrick(brick);
        });
        if (lastW > 0 && lastH > 0) {
          paddleX *= w / lastW;
          ballX *= w / lastW;
          ballY *= h / lastH;
        }
        lastW = w;
        lastH = h;
        drawPaddle();
        drawBall();
      });

      function resetBall() {
        ballAttached = true;
        ballX = paddleX;
        ballY = getPaddleY() - BALL_RADIUS - 1;
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
      onLivesRef.current(lives);

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
        paddleX = ((e.clientX - rect.left) / rect.width) * screenW();
        paddleX = Math.max(paddleW / 2, Math.min(screenW() - paddleW / 2, paddleX));
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
        paddleX = ((touch.clientX - rect.left) / rect.width) * screenW();
        paddleX = Math.max(paddleW / 2, Math.min(screenW() - paddleW / 2, paddleX));
      }

      function onTouchStart() {
        if (ballAttached) {
          ballAttached = false;
        }
      }

      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      removeKeyListeners = () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
      };
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
        paddleX = Math.max(paddleW / 2, Math.min(screenW() - paddleW / 2, paddleX));

        // Ball follows paddle when attached
        if (ballAttached) {
          ballX = paddleX;
          ballY = getPaddleY() - BALL_RADIUS - 1;
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
        if (ballX + BALL_RADIUS > screenW()) {
          ballX = screenW() - BALL_RADIUS;
          ballDX = -Math.abs(ballDX);
        }
        if (ballY - BALL_RADIUS < 0) {
          ballY = BALL_RADIUS;
          ballDY = Math.abs(ballDY);
        }

        // Ball fell below paddle
        if (ballY + BALL_RADIUS > screenH()) {
          lives--;
          onLivesRef.current(lives);
          if (lives <= 0) {
            alive = false;
            soundsRef.current.playGameOver();
            onGameOverRef.current();
            return;
          }
          resetBall();
          drawPaddle();
          drawBall();
          return;
        }

        // Paddle collision
        const paddleY = getPaddleY();
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
          soundsRef.current.playMove();
        }

        // Brick collisions
        for (const brick of bricks) {
          if (!brick.alive) continue;

          // AABB check with ball center + radius
          const closestX = Math.max(brick.x, Math.min(ballX, brick.x + brick.w));
          const closestY = Math.max(brick.y, Math.min(ballY, brick.y + brick.h));
          const distX = ballX - closestX;
          const distY = ballY - closestY;

          if (distX * distX + distY * distY <= BALL_RADIUS * BALL_RADIUS) {
            brick.alive = false;
            brick.gfx.visible = false;
            score += brick.points;
            onScoreRef.current(score);
            soundsRef.current.playScore();

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
        if (!bricks.some((b) => b.alive)) {
          soundsRef.current.playClear();
          nextLevel();
        }

        drawPaddle();
        drawBall();
      });
    })();

    return () => {
      destroyed = true;
      removeKeyListeners();
      app.destroy(true);
    };
  }, []);

  return <div ref={containerRef} className="w-full h-full overflow-hidden" />;
}
