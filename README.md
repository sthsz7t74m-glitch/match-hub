# Match Hub

欧州5大リーグ・UEFAチャンピオンズリーグのお気に入りクラブの日程・結果・順位をまとめて確認するPWAです。

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

## チャンピオンズリーグ

Sports HubまたはMatch Hub上部の「チャンピオンズリーグ」から日程・結果・リーグフェーズ順位を確認できます。ラウンド、試合状態、お気に入りで絞り込めます。時刻は日本時間です。

`FOOTBALL_DATA_TOKEN`を使う既存の更新ジョブが、5大リーグと合わせて`CL`の参加クラブ・試合・順位を取得します。国内リーグとCLでクラブIDを共有し、クラブの重複登録と順位の混同を避けています。API取得が失敗した場合は既存の公開JSONを上書きしません。トークンの契約・権限にCLが含まれている必要があります。

検証：`node --test tests/champions-league.test.mjs`
