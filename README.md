# Match Hub

サッカー5大リーグのお気に入りクラブの日程・結果・順位をまとめて確認するPWAです。

## 初期構成

- GitHub Pagesで静的サイトを公開
- GitHub ActionsでAPI-Footballからデータを取得
- APIキーはRepository secret `API_FOOTBALL_KEY` に保存
- お気に入り・最推し・テーマ設定はブラウザのlocalStorageに保存

## セットアップ

1. Repository Settings → Secrets and variables → Actions
2. `API_FOOTBALL_KEY` を登録
3. Actionsの `Update football data` を手動実行
4. Settings → Pages → Source を `GitHub Actions` に設定

## 対応リーグ

- Premier League
- La Liga
- Serie A
- Bundesliga
- Ligue 1
