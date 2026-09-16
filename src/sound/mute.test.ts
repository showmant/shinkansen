// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { createMuteButton, loadMuted, saveMuted, type StorageLike } from "./mute";

const memoryStorage = (): StorageLike => {
  const data = new Map<string, string>();
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => {
      data.set(k, v);
    },
  };
};

const throwingStorage: StorageLike = {
  getItem: () => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("denied");
  },
};

describe("ミュート状態の保存", () => {
  it("保存した値を読み戻せる。未保存なら音あり", () => {
    const storage = memoryStorage();
    expect(loadMuted(storage)).toBe(false);
    saveMuted(storage, true);
    expect(loadMuted(storage)).toBe(true);
    saveMuted(storage, false);
    expect(loadMuted(storage)).toBe(false);
  });

  it("storage が使えなくても例外にしない", () => {
    expect(loadMuted(throwingStorage)).toBe(false);
    expect(() => saveMuted(throwingStorage, true)).not.toThrow();
    expect(loadMuted(undefined)).toBe(false);
  });
});

describe("createMuteButton", () => {
  it("クリックで 🔊/🔇 が切り替わり、保存とコールバックが走る", () => {
    const storage = memoryStorage();
    const onChange = vi.fn();
    const mute = createMuteButton({ storage, onChange });
    expect(mute.isMuted()).toBe(false);
    expect(mute.element.textContent).toBe("🔊");
    expect(mute.element.getAttribute("aria-pressed")).toBe("false");

    mute.element.click();
    expect(mute.isMuted()).toBe(true);
    expect(mute.element.textContent).toBe("🔇");
    expect(mute.element.getAttribute("aria-pressed")).toBe("true");
    expect(onChange).toHaveBeenCalledWith(true);
    expect(loadMuted(storage)).toBe(true);
  });

  it("保存済みのミュート状態で始まる (リロード後も保持)", () => {
    const storage = memoryStorage();
    saveMuted(storage, true);
    const mute = createMuteButton({ storage, onChange: () => {} });
    expect(mute.isMuted()).toBe(true);
    expect(mute.element.textContent).toBe("🔇");
  });
});
