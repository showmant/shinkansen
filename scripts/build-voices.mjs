// VOICEVOX (https://voicevox.hiroshiba.jp/) で読み上げ音声を作り、public/voices/*.mp3 に置く。
// GitHub Pages は静的配信なので、しゃべる文は src/sound/voice-catalog.ts に全部並べて事前生成する。
//
// 使い方:
//   docker run --rm -p '127.0.0.1:50021:50021' voicevox/voicevox_engine:cpu-latest
//   npm run voices              # 足りない音声だけ作る
//   npm run voices -- --force   # 全部作り直す
//
// 生成した音声を使うにはクレジット表記が要る (README と画面フッターに出している)。
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

const ENGINE = process.env.VOICEVOX_URL ?? "http://127.0.0.1:50021";
/** 同時に投げる合成リクエスト数 (CPU 版エンジンはこれくらいが頭打ち) */
const CONCURRENCY = 4;

const root = fileURLToPath(new URL("..", import.meta.url));
const outDir = join(root, "public", "voices");
const force = process.argv.includes("--force");

/**
 * VOICEVOX に渡す読み。画面に出す文はそのままで、合成に投げる文字列だけ直す。
 *
 * 1. ひらがなだけの文だと単語の中の「は」まで助詞とみなされて「ワ」と読まれてしまう
 *    (よこはません → ヨコワマセン)。単独で置かれた助詞の「は」以外はカタカナにする。
 * 2. 読み上げ文は 3さい 向けに分かち書きしてあるが、VOICEVOX は空白ひとつごとに
 *    ポーズ入りのアクセント句を切るので、そのまま渡すと「とうきょう、から、はかた、まで」と
 *    ぶつ切りになる。空白を落として文節のまとめ方をエンジンに任せると
 *    「トオキョオカラ/ハカタマ'デ」とつながり、ポーズは「!」「。」「、」だけになる。
 */
const readingOf = (text) =>
  text
    .replace(/は/g, (ha, at) => (text[at - 1] === " " && text[at + 1] === " " ? ha : "ハ"))
    .replace(/\s+/g, "");

/** 3さい が聞き取りやすいように、少しゆっくり・抑揚を強めに */
const tune = (query) => ({
  ...query,
  speedScale: 0.95,
  intonationScale: 1.1,
  prePhonemeLength: 0.1,
  postPhonemeLength: 0.25,
});

async function engineFetch(path, init) {
  const res = await fetch(`${ENGINE}${path}`, init);
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${res.statusText}`);
  return res;
}

async function synthesize(speaker, text) {
  const query = await (
    await engineFetch(`/audio_query?speaker=${speaker}&text=${encodeURIComponent(text)}`, { method: "POST" })
  ).json();
  const wav = await engineFetch(`/synthesis?speaker=${speaker}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tune(query)),
  });
  return { wav: Buffer.from(await wav.arrayBuffer()), kana: query.kana };
}

/** 24kHz モノラルの mp3 に落とす (1 文あたり 20KB 前後) */
function toMp3(wav, dest, wavPath) {
  writeFileSync(wavPath, wav);
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", "-i", wavPath,
    "-codec:a", "libmp3lame", "-b:a", "64k", "-ac", "1", "-ar", "24000", dest]);
}

/** items を CONCURRENCY 本のワーカーで順に処理する */
async function forEachLimited(items, worker) {
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < items.length) {
        const index = next;
        next += 1;
        await worker(items[index], index);
      }
    }),
  );
}

const server = await createServer({ configFile: false, root, server: { middlewareMode: true }, appType: "custom" });
try {
  const { voiceCatalog } = await server.ssrLoadModule("/src/sound/voice-catalog.ts");
  const { voiceCharacters, voiceKey } = await server.ssrLoadModule("/src/sound/voices.ts");
  const speakerOf = new Map(voiceCharacters.map((c) => [c.id, c.speaker]));

  const catalog = voiceCatalog().map((speech) => ({ ...speech, key: voiceKey(speech) }));
  const keys = new Set(catalog.map((c) => c.key));
  if (keys.size !== catalog.length) throw new Error("音声キーが衝突している (voiceKey のハッシュを見直すこと)");

  mkdirSync(outDir, { recursive: true });
  const todo = catalog.filter((c) => force || !existsSync(join(outDir, `${c.key}.mp3`)));
  console.log(`読み上げ ${catalog.length} 文 / これから作る ${todo.length} 文 (キャラクター ${voiceCharacters.length} 人)`);

  const tmp = mkdtempSync(join(tmpdir(), "voicevox-"));
  let done = 0;
  await forEachLimited(todo, async (item) => {
    const speaker = speakerOf.get(item.voice);
    if (speaker === undefined) throw new Error(`unknown voice: ${item.voice}`);
    const { wav, kana } = await synthesize(speaker, readingOf(item.text));
    toMp3(wav, join(outDir, `${item.key}.mp3`), join(tmp, `${item.key}.wav`));
    done += 1;
    console.log(`[${done}/${todo.length}] ${item.voice} ${item.text}\n            ${kana}`);
  });
  rmSync(tmp, { recursive: true, force: true });

  // カタログから消えた文の音声は残さない
  const stale = readdirSync(outDir).filter((f) => f.endsWith(".mp3") && !keys.has(f.slice(0, -4)));
  for (const file of stale) rmSync(join(outDir, file));
  if (stale.length > 0) console.log(`使われなくなった音声 ${stale.length} 件を削除した`);
} finally {
  await server.close();
}
