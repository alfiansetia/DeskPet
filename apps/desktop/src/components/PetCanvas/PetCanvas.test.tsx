import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PetCanvas } from "./PetCanvas";

describe("PetCanvas", () => {
  it("renders with state + accessible label, survives missing assets", () => {
    render(<PetCanvas state="idle" reducedMotion={false} onTap={vi.fn()} />);
    const el = screen.getByTestId("pet-canvas");
    expect(el).toHaveAttribute("data-state", "idle");
    expect(el).toHaveAttribute("aria-label", expect.stringContaining("idle"));
  });

  it("applies reduced-motion class", () => {
    render(<PetCanvas state="walk" reducedMotion onTap={vi.fn()} />);
    expect(screen.getByTestId("pet-canvas").className).toContain("dp-reduced");
  });
});
