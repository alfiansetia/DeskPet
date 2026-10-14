import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PetCanvas } from "./PetCanvas";

describe("PetCanvas", () => {
  it("renders with state + accessible label, survives missing assets", () => {
    render(<PetCanvas state="idle" reducedMotion={false} onTap={vi.fn()} />);
    const el = screen.getByTestId("pet-canvas");
    expect(el).toHaveAttribute("data-state", "idle");
    expect(el).toHaveAttribute("aria-label", expect.stringContaining("idle"));
    expect(el).toHaveAttribute("data-character", "deskpet.cat");
  });

  it("applies reduced-motion class", () => {
    render(<PetCanvas state="walk" reducedMotion onTap={vi.fn()} />);
    expect(screen.getByTestId("pet-canvas").className).toContain("dp-reduced");
  });

  it("renders sprite view with PRD §13 asset mappings (single cat species)", () => {
    render(<PetCanvas state="react" reducedMotion={false} onTap={vi.fn()} />);
    const sprite = screen.getByTestId("pet-sprite");
    expect(sprite).toBeInTheDocument();
    expect(sprite.style.backgroundImage).toContain("/assets/characters/cat/react.png");
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

  it("legacy characterId tetap di-map ke kucing (tidak rusak)", () => {
    const { unmount } = render(
      <PetCanvas state="walk" reducedMotion={false} characterId="deskpet.cat.orange" onTap={vi.fn()} />
    );
    let sprite = screen.getByTestId("pet-sprite");
    expect(sprite.style.backgroundImage).toContain("/assets/characters/cat/walk.png");
    expect(screen.getByTestId("pet-canvas")).toHaveAttribute("data-character", "deskpet.cat");
    unmount();

    render(
      <PetCanvas state="idle" reducedMotion={false} characterId="deskpet.cat.black" onTap={vi.fn()} />
    );
    sprite = screen.getByTestId("pet-sprite");
    expect(sprite.style.backgroundImage).toContain("/assets/characters/cat/idle.png");
  });

  it("default palette = lavender tanpa recolor (pakai PNG asli)", () => {
    render(<PetCanvas state="idle" reducedMotion={false} onTap={vi.fn()} />);
    const el = screen.getByTestId("pet-canvas");
    expect(el).toHaveAttribute("data-palette", "lavender");
    expect(screen.getByTestId("pet-sprite").style.backgroundImage)
      .toContain("/assets/characters/cat/idle.png");
  });

  it("preset sky menandai palette", () => {
    render(
      <PetCanvas state="idle" reducedMotion={false} paletteId="sky" onTap={vi.fn()} />
    );
    expect(screen.getByTestId("pet-canvas")).toHaveAttribute("data-palette", "sky");
  });

  it("spesies ular memakai folder snake + palette yang sama", () => {
    const { unmount } = render(
      <PetCanvas state="idle" reducedMotion={false} species="snake" onTap={vi.fn()} />
    );
    let el = screen.getByTestId("pet-canvas");
    expect(el).toHaveAttribute("data-character", "deskpet.snake");
    expect(screen.getByTestId("pet-sprite").style.backgroundImage)
      .toContain("/assets/characters/snake/idle.png");
    unmount();

    render(
      <PetCanvas state="walk" reducedMotion={false} species="snake" paletteId="matcha" onTap={vi.fn()} />
    );
    el = screen.getByTestId("pet-canvas");
    expect(el).toHaveAttribute("data-palette", "matcha");
    expect(screen.getByTestId("pet-sprite").style.backgroundImage)
      .toContain("/assets/characters/snake/walk.png");
  });

  it("spesies tak dikenal jatuh ke kucing", () => {
    render(
      <PetCanvas state="idle" reducedMotion={false} species="naga" onTap={vi.fn()} />
    );
    const el = screen.getByTestId("pet-canvas");
    expect(el).toHaveAttribute("data-character", "deskpet.cat");
    expect(screen.getByTestId("pet-sprite").style.backgroundImage)
      .toContain("/assets/characters/cat/idle.png");
  });

  it("spesies kodok memakai folder frog", () => {
    render(
      <PetCanvas state="jump" reducedMotion={false} species="frog" paletteId="matcha" onTap={vi.fn()} />
    );
    const el = screen.getByTestId("pet-canvas");
    expect(el).toHaveAttribute("data-character", "deskpet.frog");
    expect(el).toHaveAttribute("data-palette", "matcha");
    expect(el.className).toContain("dp-species--frog");
    expect(screen.getByTestId("pet-sprite").style.backgroundImage)
      .toContain("/assets/characters/frog/jump.png");
  });

  it("topi overlay dirender bila diminta", () => {
    const { unmount } = render(
      <PetCanvas state="idle" reducedMotion={false} hat="cap" onTap={vi.fn()} />
    );
    const hat = screen.getByTestId("pet-hat");
    expect(hat).toHaveAttribute("data-hat", "cap");
    expect(hat.textContent).toBe("🧢");
    unmount();

    render(<PetCanvas state="idle" reducedMotion={false} onTap={vi.fn()} />);
    expect(screen.queryByTestId("pet-hat")).toBeNull();
  });
});
