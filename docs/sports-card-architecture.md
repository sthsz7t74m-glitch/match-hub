# Sports event card architecture

試合カードは `assets/js/match-components.js` を唯一の共通入口とします。
ページ固有コードでカード全体のHTMLを組み立てず、競技別クラスへ表示用データを渡します。

```text
SportsEventCard
├─ SoccerMatchCard
└─ BaseballGameCard
```

## 共通基底クラス

`SportsEventCard` が次を担当します。

- カード外枠
- 上部メタ情報
- 左右チームの配置
- ロゴ／エンブレムとフォールバック
- 中央スコア領域
- 下部情報
- HTMLエスケープ
- data属性などの出力

共通CSSは `assets/css/match-components.css` の `sports-event-card*` クラスです。

## サッカー

`SoccerMatchCard` は次を追加します。

- ホームを左、アウェイを右に配置
- 試合状態
- PK・延長などの決着表示
- 大会、節、会場

既存APIとの互換用に `SportsHubComponents.matchCard()` と
`createMatchCardRenderer()` を残しています。

## 野球

`BaseballGameCard` は次を追加します。

- アウェイを左、ホームを右に配置
- イニング・試合状態
- 推しバッジ
- ダブルヘッダーの試合番号
- 会場、予告先発、シリーズ情報

MLB画面は `assets/js/mlb/mlb-card-view.js` で共通カードへ接続します。

## 修正ルール

カードに共通する変更は、最初に次を修正します。

```text
assets/js/match-components.js
assets/css/match-components.css
```

競技特有の項目だけを各サブクラスまたは接続アダプターへ追加します。
ページ固有CSSで共通レイアウトを上書きするのは避けます。
