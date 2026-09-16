const STORAGE_KEY = "shinkansen:muted";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function loadMuted(storage: StorageLike | undefined): boolean {
  try {
    return storage?.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function saveMuted(storage: StorageLike | undefined, muted: boolean): void {
  try {
    storage?.setItem(STORAGE_KEY, muted ? "1" : "0");
  } catch {
    // 保存できなくても今の画面では切り替わる
  }
}

export interface MuteButton {
  element: HTMLButtonElement;
  isMuted(): boolean;
}

export interface MuteButtonOptions {
  storage: StorageLike | undefined;
  onChange: (muted: boolean) => void;
}

/** 画面隅の大きなミュートボタン (🔊/🔇) */
export function createMuteButton({ storage, onChange }: MuteButtonOptions): MuteButton {
  let muted = loadMuted(storage);
  const element = document.createElement("button");
  element.type = "button";
  element.className = "mute-button";

  const render = () => {
    element.textContent = muted ? "🔇" : "🔊";
    element.setAttribute("aria-pressed", String(muted));
    element.setAttribute("aria-label", muted ? "おと を だす" : "おと を けす");
  };
  render();

  element.addEventListener("click", () => {
    muted = !muted;
    saveMuted(storage, muted);
    render();
    onChange(muted);
  });

  return { element, isMuted: () => muted };
}

/** localStorage はプライベートモード等でアクセス自体が例外になりうる */
export function browserStorage(): StorageLike | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}
