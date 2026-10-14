/** autostart.ts: cek/pasang/copot + selaraskan niat vs OS. */
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/plugin-autostart", () => ({
  enable: vi.fn(),
  disable: vi.fn(),
  isEnabled: vi.fn(),
}));

import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { ensureAutostart, getAutostartState, setAutostart } from "./autostart";

const mockIsEnabled = vi.mocked(isEnabled);
const mockEnable = vi.mocked(enable);
const mockDisable = vi.mocked(disable);

describe("getAutostartState", () => {
  beforeEach(() => vi.clearAllMocks());

  it("enabled bila OS terpasang", async () => {
    mockIsEnabled.mockResolvedValue(true);
    await expect(getAutostartState()).resolves.toBe("enabled");
  });

  it("disabled bila belum terpasang", async () => {
    mockIsEnabled.mockResolvedValue(false);
    await expect(getAutostartState()).resolves.toBe("disabled");
  });

  it("unsupported bila backend tak ada (preview)", async () => {
    mockIsEnabled.mockRejectedValue(new Error("no backend"));
    await expect(getAutostartState()).resolves.toBe("unsupported");
  });
});

describe("setAutostart", () => {
  beforeEach(() => vi.clearAllMocks());

  it("on -> enable, off -> disable", async () => {
    mockEnable.mockResolvedValue(undefined);
    mockDisable.mockResolvedValue(undefined);
    await setAutostart(true);
    expect(mockEnable).toHaveBeenCalledOnce();
    await setAutostart(false);
    expect(mockDisable).toHaveBeenCalledOnce();
  });
});

describe("ensureAutostart (selaraskan niat vs OS)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mau on + belum pasang -> pasang", async () => {
    mockIsEnabled.mockResolvedValue(false);
    mockEnable.mockResolvedValue(undefined);
    await expect(ensureAutostart(true)).resolves.toBe("enabled");
    expect(mockEnable).toHaveBeenCalledOnce();
  });

  it("mau on + sudah pasang -> tidak ngapa-ngapain", async () => {
    mockIsEnabled.mockResolvedValue(true);
    await expect(ensureAutostart(true)).resolves.toBe("enabled");
    expect(mockEnable).not.toHaveBeenCalled();
  });

  it("mau off + masih pasang -> copot", async () => {
    mockIsEnabled.mockResolvedValue(true);
    mockDisable.mockResolvedValue(undefined);
    await expect(ensureAutostart(false)).resolves.toBe("disabled");
    expect(mockDisable).toHaveBeenCalledOnce();
  });

  it("gagal pasang non-strict -> diam, lapor disabled", async () => {
    mockIsEnabled.mockResolvedValue(false);
    mockEnable.mockRejectedValue(new Error("denied"));
    await expect(ensureAutostart(true)).resolves.toBe("disabled");
  });

  it("gagal pasang strict -> throw (untuk pesan error UI)", async () => {
    mockIsEnabled.mockResolvedValue(false);
    mockEnable.mockRejectedValue(new Error("denied"));
    await expect(ensureAutostart(true, true)).rejects.toThrow("denied");
  });

  it("unsupported -> teruskan apa adanya", async () => {
    mockIsEnabled.mockRejectedValue(new Error("no backend"));
    await expect(ensureAutostart(true)).resolves.toBe("unsupported");
    expect(mockEnable).not.toHaveBeenCalled();
  });
});
