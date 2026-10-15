import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchNtfyCache, normalizeApiWatch, normalizeServer, normalizeTopic,
  ntfyPollUrl, ntfySseUrl, parseNtfyMessage, parseNtfyPollText, testNtfy, testSubscribe,
} from "./apiwatch";

beforeEach(() => { localStorage.clear(); });

describe("normalize (topic saja di setting)", () => {
  it("default aman: mati, topic kosong", () => {
    const c = normalizeApiWatch({});
    expect(c.enabled).toBe(false);
    expect(c.topic).toBe("");
    expect(c.server).toBe("https://ntfy.sh");
    expect(c.lastMsgId).toBeNull();
  });

  it("topic valid lolos, invalid -> kosong", () => {
    expect(normalizeTopic("contoh-topik")).toBe("contoh-topik");
    expect(normalizeTopic("a-b_c9")).toBe("a-b_c9");
    expect(normalizeTopic("ada spasi")).toBe("");
    expect(normalizeTopic("")).toBe("");
    expect(normalizeTopic("x".repeat(65))).toBe("");
  });

  it("server invalid -> default ntfy.sh", () => {
    expect(normalizeServer("")).toBe("https://ntfy.sh");
    expect(normalizeServer("ftp://x")).toBe("https://ntfy.sh");
    expect(normalizeServer("https://ntfy.domain.id/")).toBe("https://ntfy.domain.id");
  });

  it("migrasi config polling lama (baseUrl ntfy) -> topic", () => {
    const c = normalizeApiWatch({ baseUrl: "https://ntfy.sh/contoh-topik/sse" } as never);
    expect(c.topic).toBe("contoh-topik");
    // self-host ntfy ikut migrasi
    const c2 = normalizeApiWatch({ baseUrl: "https://ntfy.kantor.id/topik-ku_1/json?poll=1" } as never);
    expect(c2.topic).toBe("topik-ku_1");
    // URL API polling lama yang multi-segmen JANGAN jadi topic
    const d = normalizeApiWatch({ baseUrl: "https://contoh.id/api/notif" } as never);
    expect(d.topic).toBe("");
    const e = normalizeApiWatch({ baseUrl: "https://contoh.id/api/notif-histories/poll" } as never);
    expect(e.topic).toBe("");
  });
});

describe("URL ntfy", () => {
  it("sse + poll", () => {
    expect(ntfySseUrl("https://ntfy.sh", "contoh-topik")).toBe("https://ntfy.sh/contoh-topik/sse");
    expect(ntfyPollUrl("https://ntfy.sh/", "contoh-topik")).toBe("https://ntfy.sh/contoh-topik/json?poll=1");
    expect(ntfySseUrl("https://ntfy.sh", "contoh-topik", "abc")).toBe("https://ntfy.sh/contoh-topik/sse?since=abc");
  });
});

describe("parse pesan ntfy", () => {
  it("event message -> item", () => {
    const it1 = parseNtfyMessage({ id: "abc", event: "message", topic: "contoh-topik", title: "Judul contoh", message: "isi", time: 1760416081 });
    expect(it1).toMatchObject({ key: "abc", title: "Judul contoh", body: "isi" });
    expect(it1?.sentAt).toBe(new Date(1760416081 * 1000).toISOString());
  });

  it("tanpa title -> pakai potongan message", () => {
    const it1 = parseNtfyMessage({ id: "x1", event: "message", message: "halo dunia" });
    expect(it1?.title).toBe("halo dunia");
  });

  it("bukan message / rusak -> null, tak pernah throw", () => {
    expect(parseNtfyMessage({ id: "k", event: "keepalive" })).toBeNull();
    expect(parseNtfyMessage({ event: "message" })).toBeNull();
    expect(parseNtfyMessage(null)).toBeNull();
    expect(parseNtfyMessage("sampah")).toBeNull();
  });

  it("NDJSON poll -> list item, baris rusak dilewat", () => {
    const text = [
      JSON.stringify({ id: "a", event: "message", title: "T1", message: "B1", time: 1 }),
      "bukan json",
      JSON.stringify({ event: "open" }),
      JSON.stringify({ id: "b", event: "message", title: "T2", message: "B2", time: 2 }),
    ].join("\n");
    const items = parseNtfyPollText(text);
    expect(items.map((i) => i.key)).toEqual(["a", "b"]);
    expect(parseNtfyPollText("")).toEqual([]);
  });
});

describe("fetchNtfyCache / testNtfy (mock network)", () => {
  const cfg = normalizeApiWatch({ enabled: true, server: "https://ntfy.sh", topic: "contoh-topik" });

  it("tanpa topic -> gagal cepat tanpa network", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    try {
      const r = await fetchNtfyCache(normalizeApiWatch({ enabled: true }));
      expect(r.ok).toBe(false);
      expect(r.error).toBe("isi topic dulu");
      expect(spy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("sukses: hit URL poll ntfy + parse NDJSON", async () => {
    const line = JSON.stringify({ id: "abc", event: "message", title: "T", message: "B", time: 10 });
    const spy = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => `${line}\n` });
    vi.stubGlobal("fetch", spy);
    try {
      const r = await fetchNtfyCache(cfg);
      expect(r.ok).toBe(true);
      expect(spy.mock.calls[0][0]).toBe("https://ntfy.sh/contoh-topik/json?poll=1");
      expect(r.cache.items.map((i) => i.key)).toEqual(["abc"]);
      expect(r.cache.latestMsgId).toBe("abc");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("HTTP error -> ok:false tanpa throw", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" }));
    try {
      const r = await fetchNtfyCache(cfg);
      expect(r.ok).toBe(false);
      expect(r.error).toBe("HTTP 404");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("testNtfy tanpa ubah simpanan + kembalikan preview", async () => {
    const line = JSON.stringify({ id: "z", event: "message", title: "Judul contoh", message: "isi panjang", time: 5 });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => `${line}\n` }));
    try {
      const r = await testNtfy("https://ntfy.sh", "contoh-topik");
      expect(r.ok).toBe(true);
      expect(r.latestMsgId).toBe("z");
      expect(r.previewTitle).toBe("Judul contoh");
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("testNtfy topic kosong -> pesan isi dulu", async () => {
    const r = await testNtfy("https://ntfy.sh", "ada spasi");
    expect(r.ok).toBe(false);
    expect(r.error).toContain("isi topic dulu");
  });
});

describe("testSubscribe (verifikasi SSE live)", () => {
  const RealES = (globalThis as Record<string, unknown>).EventSource;

  const stubES = (fire: "open" | "error") => {
    const instances: Array<{ close: () => void; url: string; closed: boolean }> = [];
    class FakeES {
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((ev: unknown) => void) | null = null;
      url: string;
      closed = false;
      constructor(url: string) {
        this.url = url;
        instances.push(this);
        setTimeout(() => {
          if (fire === "open") this.onopen?.();
          else this.onerror?.();
        }, 0);
      }
      close() { this.closed = true; }
    }
    vi.stubGlobal("EventSource", FakeES);
    return instances;
  };

  it("topic kosong -> gagal tanpa buka koneksi", async () => {
    const spy = vi.fn();
    vi.stubGlobal("EventSource", spy);
    try {
      const r = await testSubscribe("https://ntfy.sh", "ada spasi", 500);
      expect(r.ok).toBe(false);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
      if (RealES !== undefined) vi.stubGlobal("EventSource", RealES);
    }
  });

  it("server EventSource dibuka ke URL SSE + open -> ok:true", async () => {
    const instances = stubES("open");
    try {
      const r = await testSubscribe("https://ntfy.sh", "contoh-topik", 2000);
      expect(r.ok).toBe(true);
      expect(r.error).toBeNull();
      expect(instances).toHaveLength(1);
      expect(instances[0].url).toBe("https://ntfy.sh/contoh-topik/sse");
      expect(instances[0].closed).toBe(true); // langsung ditutup lagi
    } finally {
      vi.unstubAllGlobals();
      if (RealES !== undefined) vi.stubGlobal("EventSource", RealES);
    }
  });

  it("error SSE -> ok:false", async () => {
    stubES("error");
    try {
      const r = await testSubscribe("https://ntfy.sh", "contoh-topik", 2000);
      expect(r.ok).toBe(false);
      expect(r.error).toContain("SSE");
    } finally {
      vi.unstubAllGlobals();
      if (RealES !== undefined) vi.stubGlobal("EventSource", RealES);
    }
  });

  it("subscribeNtfy lanjut dari lastMsgId (?since=) agar pesan terlewat ke-replay", async () => {
    const seen: Array<{ url: string; closed: boolean; close: () => void }> = [];
    class QuietES {
      url: string;
      closed = false;
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((ev: unknown) => void) | null = null;
      constructor(url: string) { this.url = url; seen.push(this); }
      close() { this.closed = true; }
    }
    vi.stubGlobal("EventSource", QuietES);
    try {
      const { subscribeNtfy: sub } = await import("./apiwatch");
      const unsub = sub(
        normalizeApiWatch({ enabled: true, server: "https://ntfy.sh", topic: "contoh-topik", lastMsgId: "abc123" }),
        { onItem: () => {} },
      );
      expect(seen).toHaveLength(1);
      expect(seen[0].url).toBe("https://ntfy.sh/contoh-topik/sse?since=abc123");
      unsub();
      expect(seen[0].closed).toBe(true);
    } finally {
      vi.unstubAllGlobals();
      if (RealES !== undefined) vi.stubGlobal("EventSource", RealES);
    }
  });
});
