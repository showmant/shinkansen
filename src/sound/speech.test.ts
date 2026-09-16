import { describe, expect, it, vi } from "vitest";
import { lines } from "../data/lines";
import { trains } from "../data/trains";
import {
  arrivalSpeechText,
  createSpeaker,
  lineSpeechText,
  trainSpeechText,
  type SpeechSynthesisLike,
} from "./speech";

/** ひらがな・長音・空白・読み上げ用の句読点のみ */
const HIRAGANA_ONLY = /^[ぁ-ゖー 、。!！?？]+$/;

describe("読み上げテキスト", () => {
  it("カード選択: 愛称と始発・終着をひらがなで読む", () => {
    const hayabusa = trains.find((t) => t.id === "hayabusa");
    if (!hayabusa) throw new Error("hayabusa がない");
    expect(trainSpeechText(hayabusa)).toBe("はやぶさ! とうきょう から しんはこだてほくと まで はしるよ");
  });

  it.each(trains.map((t) => [t.id, t] as const))("全列車でひらがなのみのテキストが作れる (%s)", (_, train) => {
    expect(trainSpeechText(train)).toMatch(HIRAGANA_ONLY);
    expect(arrivalSpeechText(train)).toMatch(HIRAGANA_ONLY);
  });

  it("到着: fact を読む", () => {
    for (const train of trains) expect(arrivalSpeechText(train)).toContain(train.fact);
  });

  it.each(lines.map((l) => [l.id, l] as const))("路線名はひらがなのみで しんかんせん を区切って読む (%s)", (_, line) => {
    const text = lineSpeechText(line);
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

  it("前の読み上げを止めてから ja-JP で読む", () => {
    const synth = fakeSynth([{ lang: "en-US" }, { lang: "ja-JP", name: "Kyoko" }]);
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance, isMuted: () => false });
    speaker.speak("はやぶさ");
    expect(synth.cancel).toHaveBeenCalled();
    expect(synth.speak).toHaveBeenCalledTimes(1);
    const utterance = synth.speak.mock.calls[0][0] as unknown as FakeUtterance;
    expect(utterance.text).toBe("はやぶさ");
    expect(utterance.lang).toBe("ja-JP");
    expect(utterance.voice?.name).toBe("Kyoko");
  });

  it("ミュート中は読まない", () => {
    const synth = fakeSynth();
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance, isMuted: () => true });
    speaker.speak("はやぶさ");
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("日本語音声がない環境では無音で続ける", () => {
    const synth = fakeSynth([{ lang: "en-US" }]);
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance, isMuted: () => false });
    expect(() => speaker.speak("はやぶさ")).not.toThrow();
    expect(synth.speak).not.toHaveBeenCalled();
  });

  it("音声一覧がまだ読み込まれていなければ言語指定だけで読む", () => {
    const synth = fakeSynth([]);
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance, isMuted: () => false });
    speaker.speak("はやぶさ");
    expect(synth.speak).toHaveBeenCalledTimes(1);
  });

  it("Speech API 非対応でもエラーにならない", () => {
    const speaker = createSpeaker({ synth: undefined, Utterance: undefined, isMuted: () => false });
    expect(() => {
      speaker.speak("はやぶさ");
      speaker.cancel();
    }).not.toThrow();
  });

  it("API が例外を投げても握りつぶす", () => {
    const synth = fakeSynth();
    synth.speak.mockImplementation(() => {
      throw new Error("boom");
    });
    const speaker = createSpeaker({ synth, Utterance: FakeUtterance, isMuted: () => false });
    expect(() => speaker.speak("はやぶさ")).not.toThrow();
  });
});
