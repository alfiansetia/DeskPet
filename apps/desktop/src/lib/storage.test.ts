import { describe, expect, it } from "vitest";
import { loadJSON } from "./storage";

describe("storage helper", () => {
  it("returns fallback on missing/corrupt data", () => {
    expect(loadJSON("deskpet:missing", 42)).toBe(42);
    localStorage.setItem("deskpet:bad", "{not-json");
    expect(loadJSON("deskpet:bad", "fb")).toBe("fb");
  });
});
