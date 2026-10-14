import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PetCanvas } from "./PetCanvas";

describe("PetCanvas", () => {
  it("renders with state + accessible label, survives missing assets", () => {
    render(<PetCanvas state="idle" reducedMotion={false} onTap={vi.fn()} />);
    const el = screen.getByTestId("pet-canvas");
    expect(el).toHaveAttribute("data-state", "idle");
    expect(el).toHaveAttribute("aria-label", expect.stringContaining("idle"));
    expect(el).toHaveAttribute("data-character", "deskpet.cat.lavender");
  });

  it("applies reduced-motion class", () => {
    render(<PetCanvas state="walk" reducedMotion onTap={vi.fn()} />);
    expect(screen.getByTestId("pet-canvas").className).toContain("dp-reduced");
  });

  it("renders sprite view with PRD §13 asset mappings", () => {
    render(<PetCanvas state="react" reducedMotion={false} onTap={vi.fn()} />);
    const sprite = screen.getByTestId("pet-sprite");
    expect(sprite).toBeInTheDocument();
    expect(sprite.style.backgroundImage).toContain("/assets/characters/lavender-cat/react.png");
  });

  it("falls back to CSS placeholder when forcePlaceholder is requested", () => {
    render(
      <PetCanvas
        state="sleep"
        reducedMotion={false}
        onTap={vi.fn()}
        forcePlaceholder={true}
      />
    );
    const el = screen.getByTestId("pet-canvas");
    expect(el).toHaveAttribute("data-render-mode", "placeholder");
    expect(screen.queryByTestId("pet-sprite")).not.toBeInTheDocument();
  });

  it("correctly resolves sprite paths for orange-cat and black-cat", () => {
    const { unmount } = render(
      <PetCanvas state="walk" reducedMotion={false} characterId="deskpet.cat.orange" onTap={vi.fn()} />
    );
    let sprite = screen.getByTestId("pet-sprite");
    expect(sprite.style.backgroundImage).toContain("/assets/characters/orange-cat/walk.png");
    unmount();

    render(
      <PetCanvas state="idle" reducedMotion={false} characterId="deskpet.cat.black" onTap={vi.fn()} />
    );
    sprite = screen.getByTestId("pet-sprite");
    expect(sprite.style.backgroundImage).toContain("/assets/characters/black-cat/idle.png");
  });
});
