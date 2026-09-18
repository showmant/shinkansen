# しんかんせん ちず

3さい むけ の 新幹線 と 電車 の 地図 ウェブアプリ。

- トップ (`index.html`): 「しんかんせん」「でんしゃ」をえらぶ
- しんかんせん (`shinkansen.html`): 日本地図と新幹線
- でんしゃ (`densha.html`): 東京都・神奈川県の JR・私鉄 (町田周辺は駅を多めに、町田駅に おうちマーク)

## 開発

```sh
npm install
npm run dev    # 開発サーバー
npm test       # データ整合性テスト (Vitest)
npm run lint   # 型チェック (tsc --noEmit)
npm run build  # dist/ に出力 (base: /shinkansen/)
```

main への push で GitHub Actions が GitHub Pages にデプロイする
(リポジトリの Settings → Pages → Source を「GitHub Actions」にしておくこと)。

## 読み上げ音声 (VOICEVOX)

読み上げは [VOICEVOX](https://voicevox.hiroshiba.jp/) で事前に作った mp3 (`public/voices/`) を鳴らす。
列車・路線ごとに 8 人のキャラクターを割り当てているので、えらぶ でんしゃ によって こえ が かわる。
音声ファイルが無い / 鳴らせない環境では、これまでどおりブラウザ標準の読み上げにフォールバックする。

しゃべる文は `src/sound/voice-catalog.ts` に全部並べてある。列車・路線・ひとこと (fact) を
足したり直したりしたら、VOICEVOX エンジンを Docker で立てて音声を作り直すこと
(作り忘れは `npm test` が落ちて気づける)。

```sh
docker run --rm -p '127.0.0.1:50021:50021' voicevox/voicevox_engine:cpu-latest
npm run voices              # 足りない音声だけ作る (要 ffmpeg)
npm run voices -- --force   # 全部作り直す
```

ひらがなだけの文は単語の中の「は」まで助詞と解釈されて「ワ」と読まれてしまうため
(よこはません → ヨコワマセン)、合成に投げるときだけカタカナに置き換えている
(`scripts/build-voices.mjs` の `readingOf`)。

## 音声のクレジット

読み上げ音声は VOICEVOX で作成した。各ボイスライブラリの規約にしたがい、
以下のクレジットを画面下と README に表示している。

VOICEVOX:ずんだもん / VOICEVOX:四国めたん / VOICEVOX:春日部つむぎ / VOICEVOX:雨晴はう /
VOICEVOX:九州そら / VOICEVOX:冥鳴ひまり / VOICEVOX:白上虎太郎 / VOICEVOX:玄野武宏

## 地図データのクレジット

- 日本の海岸線: [Natural Earth](https://www.naturalearthdata.com/) 1:10m Admin 0 – Countries
  (public domain)。`scripts/build-japan-geo.mjs` で北海道〜九州を抽出・簡略化し
  `src/map/japan-geo.ts` として同梱している(実行時の外部 fetch なし)。
- でんしゃ版の線路・駅の位置と都県の輪郭: 「国土数値情報 (鉄道データ N02 2025年度・行政区域データ N03 2025年)」
  (国土交通省, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja)) <https://nlftp.mlit.go.jp/ksj/> を加工して作成。
  `scripts/build-densha-geo.mjs` で路線ごとに駅間の線路をたどって簡略化し、
  `src/densha/map/rail-geo.ts` / `src/densha/map/land-geo.ts` として同梱している(実行時の外部 fetch なし)。
  路線・駅を変えたら、スクリプト冒頭の手順でデータをダウンロードして再生成する。
