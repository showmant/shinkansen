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

## 地図データのクレジット

- 日本の海岸線: [Natural Earth](https://www.naturalearthdata.com/) 1:10m Admin 0 – Countries
  (public domain)。`scripts/build-japan-geo.mjs` で北海道〜九州を抽出・簡略化し
  `src/map/japan-geo.ts` として同梱している(実行時の外部 fetch なし)。
- でんしゃ版の線路・駅の位置と都県の輪郭: 「国土数値情報 (鉄道データ N02 2025年度・行政区域データ N03 2025年)」
  (国土交通省, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/deed.ja)) <https://nlftp.mlit.go.jp/ksj/> を加工して作成。
  `scripts/build-densha-geo.mjs` で路線ごとに駅間の線路をたどって簡略化し、
  `src/densha/map/rail-geo.ts` / `src/densha/map/land-geo.ts` として同梱している(実行時の外部 fetch なし)。
  路線・駅を変えたら、スクリプト冒頭の手順でデータをダウンロードして再生成する。
