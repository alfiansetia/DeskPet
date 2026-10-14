import { describe, expect, it } from "vitest";
import { allGreetings, randomGreeting } from "./greetings";

describe("randomGreeting", () => {
  it("selalu dari pool spesiesnya", () => {
    for (let i = 0; i < 50; i++) {
      expect(allGreetings("frog")).toContain(randomGreeting("frog"));
      expect(allGreetings("snake")).toContain(randomGreeting("snake"));
    }
  });

  it("prioritas: happy > hungry > rain > base", () => {
    const rnd = () => 0; // deterministik: indeks 0
    expect(randomGreeting("cat", { happy: true, hungry: true, raining: true }, rnd)).toBe("hehe~");
    expect(randomGreeting("cat", { hungry: true, raining: true }, rnd)).toBe("laper nih, minta makan dong");
    // raining + rnd<0.35 -> frasa hujan indeks berikutnya (rnd kedua = 0)
    let calls = 0;
    const seq = () => [0.1, 0][calls++];
    expect(randomGreeting("cat", { raining: true }, seq)).toBe("hujan nih, di dalam aja ya~");
    // raining + rnd>=0.35 -> pool base (indeks floor(0.9*7)=6)
    expect(randomGreeting("cat", { raining: true }, () => 0.9)).toBe("hari ini ceria!");
  });

  it("spesies tak dikenal jatuh ke kucing", () => {
    expect(allGreetings("naga" as never)).toEqual(allGreetings("cat"));
  });
});
