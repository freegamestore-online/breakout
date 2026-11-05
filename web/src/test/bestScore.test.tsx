import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("../components/Game", () => ({ Game: () => null }));

import App from "../App";

describe("best score", () => {
  it("falls back to 0 when the stored value is corrupt", () => {
    localStorage.setItem("freebreakout-best", "not-a-number");
    render(<App />);
    expect(screen.queryByText("NaN")).toBeNull();
  });
});
