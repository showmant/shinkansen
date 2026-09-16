# しんかんせん ちず

3さい むけ の 新幹線 と 日本地図 の ウェブアプリ。

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
