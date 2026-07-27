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
- チーム領域のリンク／ボタン化
- キーボード操作とアクセシブルなラベル
- 中央スコア領域
- 下部情報
- HTMLエスケープ
- data属性などの出力

共通CSSは `assets/css/match-components.css` の `sports-event-card*` クラスです。

## チーム詳細への遷移

左右のチームデータに次のいずれかを指定すると、ロゴ・チーム名・補足情報を含む側面全体が操作可能になります。

```javascript
{
  id: 'team-id',
  name: 'チーム名',
  logo: '...',
  href: './team-detail.html?id=team-id',
  ariaLabel: 'チーム名の詳細を見る'
}
```

ページ内で処理する場合は `attributes` または `action` を使用します。

```javascript
{
  id: 'team-id',
  name: 'チーム名',
  attributes: {
    'data-open-team': 'team-id'
  }
}
```

基底クラスが自動的に次を付与します。

- `data-sports-team-id`
- `data-sports-team-side`
- `aria-label`
- ボタン／リンクの共通タップ表現

試合カード全体の操作とチーム詳細の操作を分離し、チーム側を押した場合はページ側でイベント伝播を止めます。

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
球団詳細は `MLBTeamDetailView` と `MLBTeamDetailController` が基底View／Controllerを継承して表示します。

## 修正ルール

カードに共通する変更は、最初に次を修正します。

```text
assets/js/match-components.js
assets/css/match-components.css
```

競技特有の項目だけを各サブクラスまたは接続アダプターへ追加します。
ページ固有CSSで共通レイアウトを上書きするのは避けます。
