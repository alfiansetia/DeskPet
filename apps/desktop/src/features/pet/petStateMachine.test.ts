import { describe, expect, it } from "vitest";
import { canTransitionTo, isValidPetState, PET_STATES, STATE_FRAMES } from "./petStateMachine";

describe("petStateMachine (P1)", () => {
  it("covers all 8 PRD states + jump variant", () => {
    expect(PET_STATES).toHaveLength(9);
    for (const s of ["idle", "walk", "dragged", "react", "sleep", "speak", "reminder", "attention", "jump"]) {
      expect(isValidPetState(s)).toBe(true);
    }
  });

  it("rejects unknown states", () => {
    expect(isValidPetState("fly")).toBe(false);
    expect(isValidPetState("")).toBe(false);
  });

  it("every state has a positive frame count (missing asset falls back to idle)", () => {
    for (const s of PET_STATES) {
      expect(STATE_FRAMES[s]).toBeGreaterThan(0);
    }
  });

  it("drag allowed from any state; sleep exit constrained", () => {
    for (const s of PET_STATES) expect(canTransitionTo(s, "dragged")).toBe(true);
    expect(canTransitionTo("sleep", "idle")).toBe(true);
    expect(canTransitionTo("sleep", "walk")).toBe(false);
    expect(canTransitionTo("sleep", "speak")).toBe(false);
  });
});
