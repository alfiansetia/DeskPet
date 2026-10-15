import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useWindowHover } from "./useWindowHover";

function fire(type: string, init: MouseEventInit = {}) {
  act(() => {
    window.dispatchEvent(new window.MouseEvent(type, { bubbles: true, ...init }));
  });
}

describe("useWindowHover", () => {
  it("awal false; mouseover/mousemove -> true", () => {
    const { result, unmount } = renderHook(() => useWindowHover());
    expect(result.current).toBe(false);
    fire("mouseover");
    expect(result.current).toBe(true);
    unmount();
    const r2 = renderHook(() => useWindowHover());
    fire("mousemove");
    expect(r2.result.current).toBe(true);
    r2.unmount();
  });

  it("mouseout ke luar dokumen (relatedTarget null) -> false", () => {
    const { result, unmount } = renderHook(() => useWindowHover());
    fire("mouseover");
    expect(result.current).toBe(true);
    fire("mouseout", { relatedTarget: null });
    expect(result.current).toBe(false);
    unmount();
  });

  it("mouseout antar elemen dalam dokumen -> tetap true", () => {
    const { result, unmount } = renderHook(() => useWindowHover());
    const inner = document.createElement("div");
    document.body.appendChild(inner);
    try {
      fire("mouseover");
      fire("mouseout", { relatedTarget: inner });
      expect(result.current).toBe(true);
    } finally {
      inner.remove();
      unmount();
    }
  });

  it("document mouseleave / window blur -> false", () => {
    const { result, unmount } = renderHook(() => useWindowHover());
    fire("mouseover");
    expect(result.current).toBe(true);
    act(() => {
      document.dispatchEvent(new window.MouseEvent("mouseleave", { bubbles: false }));
    });
    expect(result.current).toBe(false);
    fire("mouseover");
    act(() => {
      window.dispatchEvent(new window.Event("blur"));
    });
    expect(result.current).toBe(false);
    unmount();
  });
});
