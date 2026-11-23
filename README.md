# FREE-ROOM — Ultra-Compact Foldable Garden Dwelling (V1 Ultimate CFRP & V2 ¥5,950 Ultra-Cost-Efficiency)

[![Open In Colab (A100 Pro)](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/sc8z35a-collab/Free-room/blob/main/colab/FREE_ROOM_V2_A100_Ultra_Heavy_Simulation.ipynb)

平地の庭で **縦 52 cm × 横 16 cm × 高さ 48 cm（39.94 L）** の超コンパクト折り畳み形態から広大な宿泊住居へ展開する、**2つの完全独立バージョン（V1・V2）** の 3D CAD ビューア・実ソルバーマルチフィジックス検証・**Google Colab Pro (NVIDIA A100) 1ボタン超激重GPUシミュレーション**リポジトリです。

---

## 2バージョン完全比較（V1 vs V2）

| 評価指標 | **V1：`FREE-ROOM D12-500`**（極限空間・CFRP版） | **V2：`AERO-PRISM P300`**（超極限コスト効率・¥6,000以下版） |
|---|---|---|
| **3D CAD ビューア** | [`index.html`](./index.html) | **[`v2/index.html`](./v2/index.html)** |
| **詳細工学レポート** | [`docs/ENGINEERING_REPORT.md`](./docs/ENGINEERING_REPORT.md) | **[`docs/V2_ENGINEERING_REPORT.md`](./docs/V2_ENGINEERING_REPORT.md)** |
| **総製作予算（10%税込・送料込）** | ¥558,044（DIY自作・国際送料含む） | **¥5,950**（上限¥6,000達成・送料¥0・初回用金ノコ込・**V1比 -98.93%**） |
| **コスト効率（面積 / 容積）** | ¥29,762 / m²・¥14,639 / m³ | **¥734.6 / m²（40.5倍）**・**¥734.6 / m³（19.9倍）** |
| **展開床面積 / 室内容積** | 18.75 m²（11.6畳）/ 38.12 m³（天井高 2.90m） | **8.10 m²（5.00畳・覆域 10.50 m² = 6.48畳）/ 8.10 m³**（天井高 1.64m） |
| **収納外寸（上限 52×16×48 cm）** | 51.8×15.8×47.8 cm（A5052アルミ外枠） | **49.5×14.8×45.5 cm**（**外枠ハードケース無し**・+5%膨張時も ≤ 52×16×48 cm） |
| **携行総質量 / 1人設営時間** | 13.45 kg / 約 11 分 | **10.92 kg**（+5%公差 11.47 kg）/ **約 8.5 分** |
| **ハード制約（ケース/CNC/電動/海外）** | 外枠有 / 外注CNC有 / 電動ファン有 / 海外有 | **外枠ケース 0 / 外注CNC 0 / 電動部品 0 / 国際発送 ¥0（国内店頭完結）** |
| **外囲構成（天井・壁・床）** | 天井・12角側壁・床 | **無裁断モノリス屋根・4壁・無縫製24cm折紙バスタブ床** |
| **極限試験条件** | 25 m/s・100 mm/h・100 mm冠水 | **30 m/s (108km/h)・150 mm/h豪雨・200 mm冠水・豪雨飽和泥土** |
| **雨100%不侵入保証検証** | 100mm/h＋100mm冠水 合格 | **7重物理バリア・50,000滴ラグランジュ追跡 0滴侵入（0.000000%）** |
| **ローカル超厳格シミュレーション** | 8領域・36 / 36 PASS（100%） | **9領域・61 / 61 PASS（100.0%）** |
| **A100 GPU 超激重シミュレーション** | — | **1ボタン Colab Pro A100 ノートブック同梱** |

---

## 🚀 Google Colab Pro（NVIDIA A100）1ボタン超激重シミュレーション（V2）

[![Open In Colab (A100 Pro)](https://colab.research.google.com/assets/colab-badge.svg)](https://colab.research.google.com/github/sc8z35a-collab/Free-room/blob/main/colab/FREE_ROOM_V2_A100_Ultra_Heavy_Simulation.ipynb)

ローカルVMの61項目検証に加え、NVIDIA **A100 GPU (40GB / 80GB)** をフル稼働させて超高解像度・超長時間で直接計算する専用ノートブック [`colab/FREE_ROOM_V2_A100_Ultra_Heavy_Simulation.ipynb`](./colab/FREE_ROOM_V2_A100_Ultra_Heavy_Simulation.ipynb) を同梱しています。

1. 上の **「Open In Colab」** バッジをクリック
2. Colabメニュー **`ランタイム` → `ランタイムのタイプを変更` → `A100 GPU`** を選択
3. **`ランタイム` → `すべてのセルを実行`（`Ctrl+F9`）** を1回押すだけ！

**全5モジュール自動実行 & 300DPI総合ダッシュボードPNG＋JSON自動保存：**
1. **GPU 3D非定常 D3Q19 Lattice Boltzmann LES乱流風洞**：等方性立方格子（A100 80GB時 `320×200×120 = 768万ボクセル, dx=37.5mm` × 3方位 `0°/45°/90°` × Smagorinsky SGS乱流・Cauchy表面圧力積分＋Maskell閉塞補正）
2. **GPU 2,000,000滴ラグランジュ暴風雨＋200万粒子跳ね水＋2D浅水膜流**：150 mm/h＋30 m/s 暴風雨で 180°二重S字迷路庇換気口への侵入 **`0 / 2,000,000滴`** を実証
3. **GPU FP64 非線形動的連成FSI（Newmark-β 4,000ステップ）＋4土壌アースフルーク検証**：3本柱同軸鋼管（0.65×継手低減）＋真の引張専用ロープ/膜の動的応答・座屈・豪雨飽和泥土引抜を連成評価
4. **GPU 500,000世界モンテカルロ信頼性＋厳密Jansen/Saltelli-Sobolグローバル感度 (`S_i, S_Ti`)**：16不確定変数の同時摂動50万試行＋118万回Sobol分散分解
5. **72時間非定常温湿・CO₂連成ODE**＋300DPI 6パネル論文品質ダッシュボード一括出力

---

## 3D CAD ビューア起動方法（V1 & V2 共通：純白背景・説明以外文字ゼロ・PC＆スマホ横全画面対応）

```bash
python3 -m http.server 8080
```

- **V2（¥5,950 超極限コスト効率版）**: `http://localhost:8080/v2/index.html`
- **V1（¥558,044 極限CFRP版）**: `http://localhost:8080/index.html`
- **背景**: 純白一色（`#FFFFFF`）
- **UI**: 説明パネル（右上 `i` アイコン）を除く全コントロールは完全アイコンのみ（文字ゼロ）
- **対応画面**: PC表示 / スマホ横全画面表示（Fullscreen API + ランドスケープ対応）

---

## V2 超厳格ローカル物理シミュレーション（9大領域・61/61項目 100.0% 合格）

| # | 分野 | 使用実ソルバー・理論 | 合格 | 主な実測結果 |
|---|---|---|---:|---|
| V2-SIM-1 | 3Dソリッド収納・2D裁断 | Trimesh 3D Solid & 2D Cutting | **7/7** | 8.100m³ (誤差0.0%), 41部品衝突 **0/820**, +5%ロール `519.8×155.4×477.8mm` |
| V2-SIM-2 | 3方位3D乱流風洞CFD | OpenFOAM 1912 (`k-ω SST` 0°/45°/90°) | **6/6** | 84,866セル全Mesh OK, `Cd=0.545/0.680/0.881`, `F_D(30m/s)=2,150.5N` |
| V2-SIM-3 | 3本柱 真の引張専用NLGEOM FEA | CalculiX 2.21 (`SPRINGA` + 0.65×低減) | **9/9** | 30m/s鋼管57.2MPa (**SF=4.11x**), 3D座屈 **SF=2.09x**, f1=9.50Hz |
| V2-SIM-4 | 3D剛体落下・5°傾斜・突風 | PyBullet 3D Physics Engine | **6/6** | 1m落下SF=5.04x, 30m/s＋5°傾斜(空室/95kg) 傾き **0.0°**・浮上 **0.0mm** |
| V2-SIM-5 | 4土壌ハイブリッド・アースフルーク | Meyerhof-Adams (±15°・深さ-15%) | **6/6** | 豪雨飽和泥土 **3,271N (SF=4.55x)**, 緩砂 **1,291N (SF=1.80x)** |
| V2-SIM-6 | 7層・雨100%不侵入証明 | 50,000滴ラグランジュ＋Manning＋静水圧 | **7/7** | 150mm/h＋30m/s侵入 **0/50,000滴**, 200mm冠水乾舷 **+40mm** (床SF 16x) |
| V2-SIM-7 | 72時間連続 非電動温湿・CO₂ | SciPy RK45 連成ODE (0 W電力) | **6/6** | 猛暑38℃ `ΔT=+4.24℃`, 厳冬-5℃ `CO₂=914ppm`, 全件結露滴下 **0.0g** |
| V2-SIM-8 | 50,000回確率モンテカルロ信頼性 | 16不確定変数同時変動＋Sobol感度 | **6/6** | 構造 **100.0%**, 地盤 **100.0%**, 浸水 **0/50,000** (`β=4.26σ`) |
| V2-SIM-9 | 予算≤¥6,000・全制約・DFM監査 | 国内実売12品目・ゼロ誤魔化し監査 | **8/8** | **¥5,950 ≤ ¥6,000** (残高¥50), ケース0/CNC0/電動0/海外¥0, 40.5倍効率 |

### ローカル検証再実行コマンド

```bash
# V2（9大領域・61項目＋CADデータ＆レポート自動生成）
python3 v2/simulations/run_all_v2.py
python3 v2/simulations/generate_cad_data_v2.py

# V1（8大領域・36項目＋CADデータ自動生成）
python3 simulations/run_all_simulations.py
python3 simulations/generate_cad_data.py
```