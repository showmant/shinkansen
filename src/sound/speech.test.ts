import { describe, expect, it, vi } from "vitest";
import { lines } from "../data/lines";
import { trains } from "../data/trains";
import {
  arrivalSpeech,
  createSpeaker,
  lineSpeech,
  trainSpeech,
  type SpeechSynthesisLike,
} from "./speech";
import type { VoicePlayer } from "./voice-player";
import { speech } from "./voices";

/** ひらがな・長音・空白・読み上げ用の句読点のみ */
const HIRAGANA_ONLY = /^[ぁ-ゖー 、。!！?？]+$/;

describe("読み上げテキスト", () => {
  it("カード選択: 愛称と始発・終着をひらがなで読む", () => {
    const hayabusa = trains.find((t) => t.id === "hayabusa");
    if (!hayabusa) throw new Error("hayabusa がない");
    expect(trainSpeech(hayabusa).text).toBe("はやぶさ! とうきょう から しんはこだてほくと まで はしるよ");
  });

  it.each(trains.map((t) => [t.id, t] as const))("全列車でひらがなのみのテキストが作れる (%s)", (_, train) => {
    expect(trainSpeech(train).text).toMatch(HIRAGANA_ONLY);
    expect(arrivalSpeech(train).text).toMatch(HIRAGANA_ONLY);
  });

  it("到着: fact を読む", () => {
    for (const train of trains) expect(arrivalSpeech(train).text).toContain(train.fact);
  });

  it("発車と到着は同じ列車なら同じキャラクターの声", () => {
    for (const train of trains) expect(arrivalSpeech(train).voice).toBe(trainSpeech(train).voice);
  });

  it.each(lines.map((l) => [l.id, l] as const))("路線名はひらがなのみで しんかんせん を区切って読む (%s)", (_, line) => {
    const { text } = lineSpeech(line);
    expect(text).toMatch(HIRAGANA_ONLY);
    expect(text.endsWith(" しんかんせん")).toBe(true);
  });
});

describe("createSpeaker", () => {
  class FakeUtterance {
    lang = "";
    rate = 1;
    pitch = 1;
    volume = 1;
    voice: SpeechSynthesisVoice | null = null;
    constructor(public text: string) {}
  }

  const fakeSynth = (voices: Partial<SpeechSynthesisVoice>[] = [{ lang: "ja-JP" }]) =>
    ({
      speak: vi.fn(),
      cancel: vi.fn(),
      getVoices: vi.fn(() => voices as SpeechSynthesisVoice[]),
    }) satisfies SpeechSynthesisLike;

  const fakeVoices = (result: Promise<void>) =>
    ({ play: vi.fn(() => result), stop: vi.fn() }) satisfies VoicePlayer;

  const hayabusa = speech("zundamon", "はやぶさ");

  it("VOICEVOX の音声があればそれを鳴らし、ブラウザ読み上げは使わない", async () => {
    const synth = fakeSynth();
    const voices = fakeVoices(Promise.resolve());
    const speaker = createSpeaker({ voices, synth, Utterance: FakeUtterance, isMuted: () => false });
    speaker.speak(hayabusa);
    await Promise.resolve();
    expect(voices.play).toHaveBeenCalledWith(hayabusa);
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("音声ファイルを鳴らせなければブラウザ読み上げに落ちる", async () => {
    const synth = fakeSynth();
    const voices = fakeVoices(Promise.reject(new Error("404")));
    const speaker = createSpeaker({ voices, synth, Utterance: FakeUtterance, isMuted: () => false });
    speaker.speak(hayabusa);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it("次の読み上げに切り替わったら、前の失敗で読み上げ直さない", async () => {
    const synth = fakeSynth();
    const voices = fakeVoices(Promise.reject(new Error("止めた")));
    const speaker = createSpeaker({ voices, synth, Utterance: FakeUtterance, isMuted: () => false });
    speaker.speak(hayabusa);
    speaker.cancel();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("前の読み上げを止めてから ja-JP で読む", () => {
    const synth = fakeSynth([{ lang: "en-US" }, { lang: "ja-JP", name: "Kyoko" }]);
    const speaker = createSpeaker({ voices: undefined, synth, Utterance: FakeUtterance, isMuted: () => false });
    speaker.speak(hayabusa);
    expect(synth.cancel).toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    const utterance = synth.speak.mock.calls[0][0] as unknown as FakeUtterance;
    expect(utterance.text).toBe("はやぶさ");
    expect(utterance.lang).toBe("ja-JP");
    expect(utterance.voice?.name).toBe("Kyoko");
  });

  it("ミュート中は読まない", () => {
    const synth = fakeSynth();
    const voices = fakeVoices(Promise.resolve());
    const speaker = createSpeaker({ voices, synth, Utterance: FakeUtterance, isMuted: () => true });
    speaker.speak(hayabusa);
    expect(voices.play).not.toHaveBeenCalled();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("日本語音声がない環境では無音で続ける", () => {
    const synth = fakeSynth([{ lang: "en-US" }]);
    const speaker = createSpeaker({ voices: undefined, synth, Utterance: FakeUtterance, isMuted: () => false });
    expect(() => speaker.speak(hayabusa)).not.toThrow();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("音声一覧がまだ読み込まれていなければ言語指定だけで読む", () => {
    const synth = fakeSynth([]);
    const speaker = createSpeaker({ voices: undefined, synth, Utterance: FakeUtterance, isMuted: () => false });
    speaker.speak(hayabusa);
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it("Speech API 非対応でもエラーにならない", () => {
    const speaker = createSpeaker({ voices: undefined, synth: undefined, Utterance: undefined, isMuted: () => false });
    expect(() => {
      speaker.speak(hayabusa);
      speaker.cancel();
    }).not.toThrow();
  });

  it("API が例外を投げても握りつぶす", () => {
    const synth = fakeSynth();
    synth.speak.mockImplementation(() => {
      throw new Error("boom");
    });
    const speaker = createSpeaker({ voices: undefined, synth, Utterance: FakeUtterance, isMuted: () => false });
    expect(() => speaker.speak(hayabusa)).not.toThrow();
  });
});
