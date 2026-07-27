# Sports Hub 共通コンポーネント設計

## 方針

共通の構造・状態・ライフサイクルは基底クラスに置き、競技または画面固有の差だけをサブクラスで上書きする。

ページ固有CSSや文字列置換で共通UIを修正しない。変更箇所は次の順番で判断する。

1. 全競技に共通するか
2. サッカー／野球など競技単位で共通するか
3. そのページだけの差か

## コンポーネント階層

```text
SportsComponent
├─ SportsView
├─ SportsPageTabs
├─ SportsEmptyState
│  ├─ SportsScheduleEmptyState
│  ├─ SportsFavoritesEmptyState
│  └─ SportsDataEmptyState
├─ SportsHeader
│  ├─ SoccerHeader
│  └─ BaseballHeader
├─ SportsShell
│  ├─ SoccerHubShell
│  └─ BaseballHubShell
├─ SportsNavigation
│  ├─ SoccerNavigation
│  └─ BaseballNavigation
└─ SportsCalendar
   ├─ SoccerCalendar
   └─ BaseballCalendar
```

## イベントカード階層

```text
SportsEventCard
├─ SoccerMatchCard
└─ BaseballGameCard
```

共通部分：

- 外枠
- 上部メタ情報
- 左右チーム
- ロゴ／代替表示
- 中央スコア
- 下部情報
- LIVE・終了・推し等の状態

競技別部分：

- SoccerMatchCard：節、PK、延長、大会、ホーム／アウェイ
- BaseballGameCard：イニング、予告先発、シリーズ、試合番号、球場

## データ・サービス階層

```text
SportsRepository
├─ JsonRepository
├─ StorageRepository
├─ SportsCollectionRepository
│  └─ FavoriteRepository
└─ SettingsRepository

SportsService
├─ FavoriteService
├─ SportsCollectionService
│  ├─ SearchService
│  ├─ StandingService
│  └─ SportsEventService
│     ├─ MatchService
│     └─ BaseballGameService
└─ SportsEventModel
   ├─ SoccerMatchModel
   └─ BaseballGameModel
```

## 正式な名前空間

- `SportsCore`
- `SportsServices`
- `SportsRepositories`
- `SportsUI`
- `SportsHubComponents`

既存ページとの互換性維持のため、次の旧名は当面エイリアスとして残す。

- `FootballCore`
- `FootballServices`
- `FootballRepositories`
- `FootballUI`

新規実装では `Sports*` を使用する。

## 共通ヘッダー

ヘッダーは `SportsHeader` が描画・固定表示・高さ計測を担当する。

- 全Hubで画面上部に常時固定
- `ResizeObserver` で実際の高さをCSS変数へ反映
- 本文の上余白を自動調整
- サッカー／野球の差はHeaderサブクラスで扱う

## 空表示

空表示は `SportsEmptyState` 系で生成する。

一覧を再描画するたびに空状態も同じレンダリング経路を通す。初回だけDOMを後加工する方式は禁止する。

これにより、フィルター・期間変更・再読込後も点線カードと操作ボタンが消えない。

## 追加時の例

NBAを追加する場合：

```text
SportsEventCard
└─ BasketballGameCard

SportsHeader
└─ BasketballHeader

SportsShell
└─ BasketballHubShell

SportsCalendar
└─ BasketballCalendar
```

共通の基底クラスを変更せず、バスケットボール固有の正規化だけを追加する。
