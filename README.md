# SetFlow

iPhone向け筋トレ記録PWA。Mac不要、GitHub Pagesで配信します。

## MVP
- 種目別の重量・回数・休憩秒数を記録
- 前回の重量と回数を再利用
- セット完了で保存し、休憩タイマー開始
- 休憩時間±15秒調整
- 履歴、JSONバックアップと復元
- オフラインキャッシュ（初回接続後）

## 公開
GitHub → Settings → Pages → Deploy from a branch → main / (root)。公開後 https://sutbun.github.io/setflow/ をiPhone Safariで開き、共有 → ホーム画面に追加。

## 注意
記録は端末のlocalStorage内にのみ保存され、端末間で同期しません。画面ロック中の正確な通知音は保証しません。データ消去に備えてJSONバックアップを定期的に作成してください。

開発規約: https://github.com/sutbun/ai-dev
