# FREE-ROOM D12-500 — Ultra-Compact Foldable Garden Dwelling (3D CAD & Multi-Physics Verification)

平地の庭で **縦 52 cm × 横 16 cm × 高さ 48 cm（39.94 L）** の折り畳み形態から、**床面積 18.75 ㎡（約 11.6 畳）・天井高 2.90 m・室内体積 38.13 m³（体積膨張率 955 倍）** へ展開する、工学的・物理的極限効率の折り畳み式宿泊住居の 3D CAD および 8大マルチフィジックス検証リポジトリです。

## 3D CAD ビューア（純白背景・説明以外文字ゼロ・PC＆スマホ横全画面対応）

ローカルHTTPサーバーまたは GitHub Pages で [index.html](./index.html) を開いて操作できます。

```bash
python3 -m http.server 8080
```

- **背景**: 純白一色（`#FFFFFF`）
- **UI**: 説明パネル（右上 `i` アイコン）を除く全コントロールは完全アイコンのみ（文字ゼロ）
- **対応画面**: PC表示 / スマホ横全画面表示（Fullscreen API + ランドスケープ対応）
- **主な機能**: 連続展開アニメーション（0%収納 ↔ 100%展開）、視点切替（等角・正面・平面・室内・52×16×48cm収納フォーカス）、X-Ray骨格透視、半断面カット、分解図、OpenFOAM CFD/CalculiX FEA 連成ヒートマップ＆気流可視化、人体スケール切替

## 8大マルチフィジックス厳格シミュレーション（36/36項目 100% 合格）

| # | 分野 | 使用ツール・理論 | 結果 |
|---|---|---|---|
| SIM-1 | 3Dソリッド幾何・衝突・収納 | Trimesh 3D Solid & Collision Check | **PASS** (520×160×480mm, 0/435衝突, 充填89.6%) |
| SIM-2 | 3D乱流風洞CFD解析 | OpenFOAM 1912 (`snappyHexMesh` + `simpleFoam` k-ω SST) | **PASS** (40,224セル, Cd=0.363, 対称誤差0.03%) |
| SIM-3 | 3D非線形FEA・座屈・モーダル | CalculiX 2.21 (`ccx`, B32Rパイプ + T3D2 + FSI) | **PASS** (25m/s変位9.08mm, SF=39x, 座屈7.4x/21.5x, 17.3Hz) |
| SIM-4 | 3D剛体多体動力学 | PyBullet 3D Physics Engine | **PASS** (低重心224mm, 傾斜安定17°/21°, 85kg載荷0°) |
| SIM-5 | 地盤工学アンカー引抜解析 | Mitsch-Clemence / Meyerhof-Adams ダブルヘリカル理論 | **PASS** (標準芝生1266N SF=2.39x, 豪雨湿潤土SF=1.35x@25m/s) |
| SIM-6 | 伝熱・湿り空気・換気・結露 | SciPy RK45 連立ODE + ASHRAE Psychrometrics | **PASS** (夏+0.61℃, 冬CO₂ 685ppm, 室内結露0.0g) |
| SIM-7 | 豪雨100mm/h排水・耐水圧 | Manning水理式・静水圧・ポンディング安定性 | **PASS** (水膜0.16mm, 屋根SF=21.3x, Λ=0.0038) |
| SIM-8 | 現実製造可能性(DFM/BOM) | 全11品目市販流通規格・公差+3%・1人設営 | **PASS** (13.50kg / +3%=13.91kg, 1人設営11分) |

詳細な設計仕様・BOM・設営手順は [docs/ENGINEERING_REPORT.md](./docs/ENGINEERING_REPORT.md) を参照してください。

### シミュレーション再実行

```bash
python3 simulations/run_all_simulations.py
python3 simulations/generate_cad_data.py
```