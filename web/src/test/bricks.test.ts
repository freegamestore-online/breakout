import { describe, it, expect } from "vitest";
import { brickLayout, BRICK_ROWS, BRICK_COLS } from "../lib/bricks";

describe("brickLayout", () => {
  it.each([320, 800, 1280])("spans the full width of a %ipx canvas", (width) => {
    const rects = brickLayout(width);
    expect(rects).toHaveLength(BRICK_ROWS * BRICK_COLS);
    const last = rects[BRICK_COLS - 1]!;
    expect(rects[0]!.x).toBeCloseTo(4);
    expect(last.x + last.w).toBeCloseTo(width - 4);
  });
});
