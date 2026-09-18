import { describe, expect, it, vi } from "vitest";
import { createVoicePlayer, type AudioLike } from "./voice-player";
import { speech, voiceKey } from "./voices";

class FakeAudio implements AudioLike {
  src = "";
  pause = vi.fn();
  private onError: (() => void) | null = null;
  private start: (() => void) | null = null;

  play() {
    return new Promise<void>((resolve) => {
      this.start = resolve;
    });
  }

  addEventListener(_type: "error", listener: () => void) {
    this.onError = listener;
  }

  /** 再生が始まった */
  started() {
    this.start?.();
  }

  /** ファイルが読めなかった */
  errored() {
    this.onError?.();
  }
}

function setup() {
  const created: FakeAudio[] = [];
  const player = createVoicePlayer({
    url: (key) => `/base/voices/${key}.mp3`,
    createAudio: () => {
      const audio = new FakeAudio();
      created.push(audio);
      return audio;
    },
  });
  return { player, created };
}

const hayabusa = speech("zundamon", "はやぶさ");
const kodama = speech("metan", "こだま");

describe("createVoicePlayer", () => {
  it("キーから音声ファイルの URL を作って鳴らす", async () => {
    const { player, created } = setup();
    const playing = player.play(hayabusa);
    expect(created[0].src).toBe(`/base/voices/${voiceKey(hayabusa)}.mp3`);
    created[0].started();
    await expect(playing).resolves.toBeUndefined();
  });

  it("audio 要素は 1 つだけ作って使い回す (iOS で後から鳴らせるように)", () => {
    const { player, created } = setup();
    void player.play(hayabusa).catch(() => {});
    void player.play(kodama).catch(() => {});
    expect(created).toHaveLength(1);
    expect(created[0].src).toBe(`/base/voices/${voiceKey(kodama)}.mp3`);
  });

  it("次を鳴らすとき前の音声を止める", () => {
    const { player, created } = setup();
    void player.play(hayabusa).catch(() => {});
    void player.play(kodama).catch(() => {});
    expect(created[0].pause).toHaveBeenCalled();
  });

  it("stop で止める", () => {
    const { player, created } = setup();
    void player.play(hayabusa).catch(() => {});
    player.stop();
    expect(created[0].pause).toHaveBeenCalled();
  });

  it("鳴らす前の stop では何も起きない", () => {
    const { player, created } = setup();
    expect(() => player.stop()).not.toThrow();
    expect(created).toHaveLength(0);
  });

  it("ファイルが無い (error イベント) なら reject する", async () => {
    const { player, created } = setup();
    const playing = player.play(hayabusa);
    created[0].errored();
    await expect(playing).rejects.toThrow();
  });
});
