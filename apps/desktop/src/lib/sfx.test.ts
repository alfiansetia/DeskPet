import { describe, expect, it } from "vitest";
import { playPetSound } from "./sfx";

describe("sfx", () => {
  it("no-op aman tanpa AudioContext / saat bisu", () => {
    expect(() => playPetSound(true)).not.toThrow();
    expect(() => playPetSound(false)).not.toThrow();
  });
});
