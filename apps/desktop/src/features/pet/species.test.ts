import { describe, expect, it } from "vitest";
import { characterIdFor, isPetSpecies, PET_SPECIES } from "./species";

describe("species", () => {
  it("mendaftarkan kucing + ular + kodok + hantu + penguin", () => {
    expect(PET_SPECIES.map((s) => s.id)).toEqual(["cat", "snake", "frog", "owl", "penguin"]);
  });

  it("validasi spesies", () => {
    expect(isPetSpecies("cat")).toBe(true);
    expect(isPetSpecies("snake")).toBe(true);
    expect(isPetSpecies("frog")).toBe(true);
    expect(isPetSpecies("owl")).toBe(true);
    expect(isPetSpecies("penguin")).toBe(true);
    expect(isPetSpecies("naga")).toBe(false);
    expect(isPetSpecies(undefined)).toBe(false);
  });

  it("characterId kanonis per spesies", () => {
    expect(characterIdFor("cat")).toBe("deskpet.cat");
    expect(characterIdFor("snake")).toBe("deskpet.snake");
    expect(characterIdFor("frog")).toBe("deskpet.frog");
    expect(characterIdFor("owl")).toBe("deskpet.owl");
    expect(characterIdFor("penguin")).toBe("deskpet.penguin");
  });
});
