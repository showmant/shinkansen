import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { voiceCatalog } from "./voice-catalog";
import { voiceCharacters, voiceCredit, voiceFor, voiceKey } from "./voices";

const voicesDir = fileURLToPath(new URL("../../public/voices", import.meta.url));
const catalog = voiceCatalog();

describe("VOICEVOX の音声", () => {
  it("キャラクターごとに VOICEVOX の話者 ID が重ならない", () => {
    const speakers = voiceCharacters.map((c) => c.speaker);
    expect(new Set(speakers).size).toBe(speakers.length);
  });

  it("どのキャラクターにも出番がある", () => {
    const used = new Set(catalog.map((c) => c.voice));
    expect([...used].sort()).toEqual(voiceCharacters.map((c) => c.id).sort());
  });

  it("同じ列車・路線はいつも同じ声", () => {
    expect(voiceFor("hayabusa")).toBe(voiceFor("hayabusa"));
  });

  it("音声キーが衝突しない", () => {
    const keys = catalog.map(voiceKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("クレジットに全キャラクターが載る", () => {
    for (const character of voiceCharacters) expect(voiceCredit()).toContain(`VOICEVOX:${character.name}`);
  });

  // データを足したら `npm run voices` で音声を作り直す (README 参照)
  it("しゃべる文にはすべて音声ファイルがあり、余分なファイルもない", () => {
    const files = new Set(readdirSync(voicesDir).filter((f) => f.endsWith(".mp3")));
    const missing = catalog.filter((c) => !files.has(`${voiceKey(c)}.mp3`)).map((c) => `${voiceKey(c)} ${c.text}`);
    const extra = [...files].filter((f) => !catalog.some((c) => `${voiceKey(c)}.mp3` === f));
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });
});
