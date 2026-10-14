/** Bubble: satu komponen untuk semua konten melayang (isi + posisi). */
import { cleanup, render, screen } from "@testing-library/react";
import { describe, expect, it, afterEach, vi } from "vitest";
import { Bubble } from "./Bubble";

describe("Bubble", () => {
  afterEach(() => cleanup());

  it("default: pill di atas, berupa button bila ada onClick", () => {
    const onClick = vi.fn();
    render(<Bubble testId="b" onClick={onClick}>halo</Bubble>);
    const el = screen.getByTestId("b");
    expect(el.tagName).toBe("BUTTON");
    expect(el.className).toContain("dp-bubble--pill");
    expect(el.className).toContain("dp-bubble--top");
    el.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("tanpa onClick: div biasa", () => {
    render(<Bubble testId="b">info</Bubble>);
    expect(screen.getByTestId("b").tagName).toBe("DIV");
  });

  it("posisi bottom/left/right jadi kelas", () => {
    const { unmount } = render(<Bubble testId="b" position="bottom">x</Bubble>);
    expect(screen.getByTestId("b").className).toContain("dp-bubble--bottom");
    unmount();
    render(<Bubble testId="b2" position="left">x</Bubble>);
    expect(screen.getByTestId("b2").className).toContain("dp-bubble--left");
  });

  it("variant speech + as=div untuk anak interaktif (tanpa nested-button)", () => {
    render(
      <Bubble testId="b" variant="speech" as="div" onClick={() => {}}>
        teks <button>aksi</button>
      </Bubble>,
    );
    const el = screen.getByTestId("b");
    expect(el.tagName).toBe("DIV");
    expect(el.className).toContain("dp-bubble--speech");
  });

  it("kelas legacy diteruskan (kait pengukuran window)", () => {
    render(<Bubble testId="b" className="dp-bubble-temp">28°</Bubble>);
    expect(screen.getByTestId("b").className).toContain("dp-bubble-temp");
  });
});
