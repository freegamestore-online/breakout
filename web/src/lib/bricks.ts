export const BRICK_ROWS = 6;
export const BRICK_COLS = 10;
const BRICK_GAP = 4;
const BRICK_TOP_OFFSET = 60;
const BRICK_HEIGHT = 18;

export interface BrickRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Row-major brick rectangles spanning a canvas of the given width. */
export function brickLayout(width: number): BrickRect[] {
  const w = (width - BRICK_GAP * (BRICK_COLS + 1)) / BRICK_COLS;
  const rects: BrickRect[] = [];
  for (let row = 0; row < BRICK_ROWS; row++) {
    for (let col = 0; col < BRICK_COLS; col++) {
      rects.push({
        x: BRICK_GAP + col * (w + BRICK_GAP),
        y: BRICK_TOP_OFFSET + row * (BRICK_HEIGHT + BRICK_GAP),
        w,
        h: BRICK_HEIGHT,
      });
    }
  }
  return rects;
}
