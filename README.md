# herd

牧羊犬を操作して羊の群れを導くブラウザゲーム。

## 開発

```sh
npm install
npm run dev        # 開発サーバー (http://localhost:5173)
npm test           # ユニットテスト (Vitest)
npm run build      # 型チェック + 本番ビルド (dist/)
npm run preview    # ビルド結果の確認
```

## デプロイ

`main` への push で GitHub Actions がテスト・ビルドし、GitHub Pages にデプロイする。
初回はリポジトリの Settings → Pages → Source を **GitHub Actions** にしておく。
