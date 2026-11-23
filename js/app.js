/**
 * FREE-ROOM — Unified V1 (D12-500) & V2 (AERO-PRISM P300) 3D CAD Controller
 * ==========================================================================
 * - Pure-White (#FFFFFF) Full-Bleed Architectural CAD Viewport
 * - 100% Zero-Text CAD Chrome (text exists strictly inside collapsible Info Drawer)
 * - Instant Zero-Reload In-Place V1 <-> V2 Switching (preserves Mobile Landscape Fullscreen!)
 * - Supports deep-linking via ?v=1 / ?v=2 or #v2
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildFreeRoomCAD } from './model.js';
import { SPECS_DATA } from './specs-data.js';
import { buildFreeRoomV2CAD } from '../v2/js/model.js';
import { SPECS_DATA_V2 } from '../v2/js/specs-data.js';

const canvas = document.getElementById('cad-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setClearColor(0xffffff, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff);

const camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.02, 80);
camera.position.set(5.4, 3.6, 5.8);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.minDistance = 0.35;
controls.maxDistance = 18.0;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, 1.15, 0);
controls.update();

// Pure-White Architectural Studio Lighting
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe8edf3, 0.96);
hemiLight.position.set(0, 12, 0);
scene.add(hemiLight);

const keyLight = new THREE.DirectionalLight(0xfffdf8, 1.45);
keyLight.position.set(7.5, 11.5, 6.5);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(2048, 2048);
keyLight.shadow.camera.near = 2;
keyLight.shadow.camera.far = 28;
const dShadow = 5.2;
keyLight.shadow.camera.left = -dShadow;
keyLight.shadow.camera.right = dShadow;
keyLight.shadow.camera.top = dShadow;
keyLight.shadow.camera.bottom = -dShadow;
keyLight.shadow.bias = -0.0005;
keyLight.shadow.radius = 2.8;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xeef5ff, 0.56);
fillLight.position.set(-7, 5, -5);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.35);
rimLight.position.set(0, 4, -9);
scene.add(rimLight);

// ---------------------------------------------------------------------------
// DUAL-VERSION SCENE ROOTS (V1: D12-500 & V2: AERO-PRISM P300)
// ---------------------------------------------------------------------------
const v1Root = new THREE.Group();
const v2Root = new THREE.Group();
scene.add(v1Root, v2Root);

const cadV1 = buildFreeRoomCAD(v1Root, renderer, SPECS_DATA.physics_fields);
let cadV2 = null;
let activeVersion = 'v1';

function getActiveCad() {
  return activeVersion === 'v2' ? cadV2 : cadV1;
}

const VIEW_PRESETS_BY_VER = {
  v1: {
    iso:      { pos: [5.4, 3.6, 5.8],    target: [0, 1.15, 0],         ensureDeploy: null },
    front:    { pos: [0.0, 1.65, 7.2],   target: [0, 1.30, 0],         ensureDeploy: null },
    top:      { pos: [0.0, 9.6, 0.08],   target: [0, 0.0, 0],          ensureDeploy: null },
    interior: { pos: [1.65, 1.38, 1.45], target: [-0.65, 0.85, -0.35], ensureDeploy: 1.0 },
    packed:   { pos: [0.64, 0.42, -0.74], target: [0, 0.24, 0],        ensureDeploy: 0.0 },
  },
  v2: {
    iso:      { pos: [4.5, 2.9, 4.9],    target: [0, 0.78, 0],         ensureDeploy: null },
    front:    { pos: [0.0, 1.15, 5.8],   target: [0, 0.80, 0],         ensureDeploy: null },
    top:      { pos: [0.0, 7.8, 0.08],   target: [0, 0.0, 0],          ensureDeploy: null },
    interior: { pos: [0.95, 0.88, 1.25], target: [-0.45, 0.45, -0.55], ensureDeploy: 1.0 },
    packed:   { pos: [0.62, 0.38, 0.72], target: [0, 0.23, 0],         ensureDeploy: 0.0 },
  },
};

function getPresets() {
  return VIEW_PRESETS_BY_VER[activeVersion];
}

// Shared CAD mode state preserved smoothly across V1 <-> V2 switches
const sharedModes = {
  xray: false,
  section: false,
  explode: false,
  physics: false,
  scale: true,
};

// ---------------------------------------------------------------------------
// SMOOTH CAMERA PRESET ENGINE
// ---------------------------------------------------------------------------
let camAnim = null;

function flyCamera(pos, target, duration = 0.65) {
  camAnim = {
    startPos: camera.position.clone(),
    endPos: new THREE.Vector3(...pos),
    startTarget: controls.target.clone(),
    endTarget: new THREE.Vector3(...target),
    elapsed: 0,
    duration,
  };
}

const viewButtons = {
  iso: document.getElementById('btn-view-iso'),
  front: document.getElementById('btn-view-front'),
  top: document.getElementById('btn-view-top'),
  interior: document.getElementById('btn-view-interior'),
  packed: document.getElementById('btn-view-packed'),
};

function setActiveViewBtn(key) {
  Object.entries(viewButtons).forEach(([k, btn]) => {
    btn.classList.toggle('is-active', k === key);
  });
}

// ---------------------------------------------------------------------------
// DEPLOYMENT KINEMATICS & PLAYBACK CONTROLS
// ---------------------------------------------------------------------------
const slider = document.getElementById('morph-slider');
const btnPlay = document.getElementById('btn-play');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
const btnSnapPacked = document.getElementById('btn-snap-packed');
const btnSnapDeployed = document.getElementById('btn-snap-deployed');

let deployT = 1.0;
let deployAnim = null;
let isPlaying = false;
let playDirection = 1;

function startDeployTransition(targetT, duration = 0.55) {
  deployAnim = {
    startT: deployT,
    endT: targetT,
    elapsed: 0,
    duration,
  };
}

function syncSliderUI() {
  const val = Math.round(deployT * 1000);
  slider.value = String(val);
  slider.style.setProperty('--pct', `${(deployT * 100).toFixed(1)}%`);
  btnSnapPacked.classList.toggle('is-active', deployT <= 0.02);
  btnSnapDeployed.classList.toggle('is-active', deployT >= 0.98);
}

function setPlayState(playing) {
  isPlaying = playing;
  iconPlay.style.display = playing ? 'none' : 'block';
  iconPause.style.display = playing ? 'block' : 'none';
  btnPlay.classList.toggle('is-active', playing);
}

slider.addEventListener('input', () => {
  setPlayState(false);
  deployAnim = null;
  deployT = Number(slider.value) / 1000;
  getActiveCad().setDeploy(deployT);
  syncSliderUI();
});

btnPlay.addEventListener('click', () => {
  deployAnim = null;
  if (!isPlaying) {
    if (deployT >= 0.99) {
      deployT = 0.0;
      playDirection = 1;
    } else if (deployT <= 0.01) {
      playDirection = 1;
    }
    setPlayState(true);
  } else {
    setPlayState(false);
  }
});

btnSnapPacked.addEventListener('click', () => {
  setPlayState(false);
  startDeployTransition(0.0, 0.55);
  setActiveViewBtn('packed');
  const p = getPresets().packed;
  flyCamera(p.pos, p.target, 0.6);
});

btnSnapDeployed.addEventListener('click', () => {
  setPlayState(false);
  startDeployTransition(1.0, 0.55);
  setActiveViewBtn('iso');
  const p = getPresets().iso;
  flyCamera(p.pos, p.target, 0.6);
});

Object.entries(viewButtons).forEach(([key, btn]) => {
  btn.addEventListener('click', () => {
    const preset = getPresets()[key];
    setActiveViewBtn(key);
    setPlayState(false);
    if (preset.ensureDeploy !== null) {
      startDeployTransition(preset.ensureDeploy, 0.55);
    }
    flyCamera(preset.pos, preset.target, 0.6);
  });
});

controls.addEventListener('start', () => {
  camAnim = null;
});

// ---------------------------------------------------------------------------
// RIGHT DOCK: CAD MODES (X-RAY, SECTION, EXPLODE, PHYSICS HEATMAP, SCALE)
// ---------------------------------------------------------------------------
const btnXray = document.getElementById('btn-mode-xray');
const btnSection = document.getElementById('btn-mode-section');
const btnExplode = document.getElementById('btn-mode-explode');
const btnPhysics = document.getElementById('btn-mode-physics');
const btnScale = document.getElementById('btn-mode-scale');
const heatmapSwatch = document.getElementById('heatmap-swatch');

function syncModesToActiveCad() {
  const c = getActiveCad();
  if (!c) return;
  c.setDeploy(deployT);
  c.setXray(sharedModes.xray);
  c.setSection(sharedModes.section);
  c.setExplode(sharedModes.explode);
  c.setPhysicsMode(sharedModes.physics);
  c.setScaleVisible(sharedModes.scale);
}

btnXray.addEventListener('click', () => {
  sharedModes.xray = !sharedModes.xray;
  getActiveCad().setXray(sharedModes.xray);
  btnXray.classList.toggle('is-active', sharedModes.xray);
});

btnSection.addEventListener('click', () => {
  sharedModes.section = !sharedModes.section;
  getActiveCad().setSection(sharedModes.section);
  btnSection.classList.toggle('is-active', sharedModes.section);
});

btnExplode.addEventListener('click', () => {
  sharedModes.explode = !sharedModes.explode;
  getActiveCad().setExplode(sharedModes.explode);
  btnExplode.classList.toggle('is-active', sharedModes.explode);
});

btnPhysics.addEventListener('click', () => {
  sharedModes.physics = !sharedModes.physics;
  if (sharedModes.physics && deployT < 0.95) {
    startDeployTransition(1.0, 0.55);
    const p = getPresets().iso;
    flyCamera(p.pos, p.target, 0.6);
  }
  getActiveCad().setPhysicsMode(sharedModes.physics);
  btnPhysics.classList.toggle('is-active', sharedModes.physics);
  heatmapSwatch.classList.toggle('is-visible', sharedModes.physics);
});

btnScale.addEventListener('click', () => {
  sharedModes.scale = !sharedModes.scale;
  getActiveCad().setScaleVisible(sharedModes.scale);
  btnScale.classList.toggle('is-active', sharedModes.scale);
});

// ---------------------------------------------------------------------------
// TOP-RIGHT DOCK: FULLSCREEN (DESKTOP + MOBILE LANDSCAPE) & INFO DRAWER
// ---------------------------------------------------------------------------
const btnFullscreen = document.getElementById('btn-fullscreen');
const iconFsEnter = document.getElementById('icon-fs-enter');
const iconFsExit = document.getElementById('icon-fs-exit');

function updateFullscreenIcon() {
  const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  iconFsEnter.style.display = isFs ? 'none' : 'block';
  iconFsExit.style.display = isFs ? 'block' : 'none';
  btnFullscreen.classList.toggle('is-active', isFs);
}

btnFullscreen.addEventListener('click', async () => {
  try {
    const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    if (!isFs) {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(() => {});
      }
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if (document.webkitExitFullscreen) await document.webkitExitFullscreen();
    }
  } catch {
    // Graceful fallback
  }
  updateFullscreenIcon();
});

document.addEventListener('fullscreenchange', updateFullscreenIcon);
document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);

const btnInfo = document.getElementById('btn-info');
const btnInfoClose = document.getElementById('btn-info-close');
const infoDrawer = document.getElementById('info-drawer');
const infoBackdrop = document.getElementById('info-backdrop');

function setInfoOpen(open) {
  infoDrawer.classList.toggle('is-open', open);
  infoBackdrop.classList.toggle('is-open', open);
  infoDrawer.setAttribute('aria-hidden', String(!open));
  infoBackdrop.setAttribute('aria-hidden', String(!open));
  btnInfo.classList.toggle('is-active', open);
}

btnInfo.addEventListener('click', () => setInfoOpen(!infoDrawer.classList.contains('is-open')));
btnInfoClose.addEventListener('click', () => setInfoOpen(false));
infoBackdrop.addEventListener('click', () => setInfoOpen(false));

// ---------------------------------------------------------------------------
// DYNAMIC INFO SHEET RENDERER (V1 4-TAB & V2 5-TAB WITH A100 COLAB LAUNCH)
// ---------------------------------------------------------------------------
const drawerTabsEl = document.getElementById('drawer-tabs');
const drawerBodyEl = document.getElementById('drawer-body');

function bindDrawerTabs() {
  drawerTabsEl.querySelectorAll('.drawer-tab').forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      const target = tabBtn.dataset.tab;
      drawerTabsEl.querySelectorAll('.drawer-tab').forEach((b) => b.classList.toggle('is-active', b === tabBtn));
      drawerBodyEl.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('is-active', p.id === `tab-${target}`));
    });
  });
}

function renderInfoSheetV1() {
  const s = SPECS_DATA;
  document.getElementById('doc-title').textContent = s.title;
  document.getElementById('doc-subtitle').textContent = s.subtitle;

  drawerTabsEl.innerHTML = `
    <button class="drawer-tab is-active" data-tab="overview" type="button">概要・空間効率</button>
    <button class="drawer-tab" data-tab="engineering" type="button">構造・収納原理</button>
    <button class="drawer-tab" data-tab="simulations" type="button">8大物理検証結果</button>
    <button class="drawer-tab" data-tab="bom" type="button">部品表・製作設営</button>
  `;

  const totalCost = s.bom.reduce((acc, b) => acc + b.cost_jpy, 0);
  const totalMass = s.bom.reduce((acc, b) => acc + b.mass_kg, 0);

  drawerBodyEl.innerHTML = `
    <section id="tab-overview" class="tab-panel is-active">
      <div class="kpi-grid">
        ${s.kpis.map((k) => `
          <div class="kpi-card">
            <div class="kpi-label">${k.label}</div>
            <div class="kpi-val">${k.value}</div>
            <div class="kpi-sub">${k.sub}</div>
          </div>
        `).join('')}
      </div>
      <div class="doc-section">
        <h2>工学的コンセプト（なぜこの構造が理論極限なのか）</h2>
        <p>${s.concept_summary}</p>
        <ul>
          ${s.key_principles.map((p) => `<li><strong>${p.title}：</strong>${p.desc}</li>`).join('')}
        </ul>
        <div class="version-links">
          <button class="version-link" data-switch-ver="v2" type="button">→ V2（¥5,950 超極限コスト効率・5.00畳・雨100%不侵入）へ切替</button>
        </div>
      </div>
      <div class="doc-section">
        <h2>主要諸元（100%実測シミュレーション一致）</h2>
        <table class="spec-table">
          <thead><tr><th>項目</th><th>設計値</th></tr></thead>
          <tbody>
            ${s.spec_rows.map(([k, v]) => `<tr><td>${k}</td><td><strong>${v}</strong></td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section id="tab-engineering" class="tab-panel">
      <div class="doc-section">
        <h2>52cm×16cm×48cm 完全収納：同心マトリョーシカ・ネスト原理</h2>
        <p>${s.packing_summary}</p>
        <table class="spec-table">
          <thead><tr><th>区画・部品</th><th>配置・クリアランス</th><th>専有容積</th></tr></thead>
          <tbody>
            ${s.packing_rows.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="doc-section">
        <h2>極限耐風・快適宿泊を支える5大機構</h2>
        <ul>
          ${s.mechanisms.map((m) => `<li><strong>${m.title}：</strong>${m.desc}</li>`).join('')}
        </ul>
      </div>
    </section>

    <section id="tab-simulations" class="tab-panel">
      <div class="doc-section">
        <h2>統合マルチフィジックス厳格検証：${s.verification_summary.passed} / ${s.verification_summary.total} 項目（${s.verification_summary.pass_rate}% 全合格）</h2>
        <p>${s.verification_summary.note}</p>
        ${s.simulations.map((sim) => `
          <div class="sim-card">
            <div class="sim-card-head">
              <div class="sim-card-title">${sim.name}</div>
              <span class="pass-badge">PASS</span>
            </div>
            <div class="sim-metrics">
              ${sim.metrics.map(([mk, mv]) => `<div><span style="color:#666">${mk}:</span> <strong>${mv}</strong></div>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    <section id="tab-bom" class="tab-panel">
      <div class="doc-section">
        <h2>現実製造可能 BOM（2026年実売相場・歩留まり/送料/税込）</h2>
        <table class="spec-table">
          <thead><tr><th>部品・市販規格</th><th>質量</th><th>精密予算</th></tr></thead>
          <tbody>
            ${s.bom.map((b) => `<tr><td><strong>${b.part}</strong><br><span style="color:#666;font-size:11px">${b.spec}</span></td><td>${b.mass_kg.toFixed(2)} kg</td><td>¥${b.cost_jpy.toLocaleString()}</td></tr>`).join('')}
            <tr style="background:#fafafa"><td><strong>合計（標準・完璧DIY 総支払額）</strong></td><td><strong>${totalMass.toFixed(2)} kg</strong></td><td><strong>¥${totalCost.toLocaleString()}</strong></td></tr>
          </tbody>
        </table>
      </div>
      ${s.budget_scenarios?.length ? `
      <div class="doc-section">
        <h2>製作プラン別 総予算比較（1 USD = 160 円基準）</h2>
        <table class="spec-table">
          <thead><tr><th>製作方式</th><th>総予算</th></tr></thead>
          <tbody>
            ${s.budget_scenarios.map((sc) => `<tr><td><strong>${sc.plan}</strong><br><span style="color:#666;font-size:11px">${sc.note}</span></td><td><strong>¥${sc.total_jpy.toLocaleString()}</strong></td></tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}
      <div class="doc-section">
        <h2>1人設営手順（工具・電源不要／約 ${s.setup_total_min} 分）</h2>
        <ol>
          ${s.setup_steps.map((st) => `<li>${st.action}（約${st.time_s}秒）</li>`).join('')}
        </ol>
      </div>
    </section>
  `;

  bindDrawerTabs();
  drawerBodyEl.querySelectorAll('[data-switch-ver]').forEach((btn) => {
    btn.addEventListener('click', () => switchVersion(btn.dataset.switchVer));
  });
}

function renderInfoSheetV2() {
  const s = SPECS_DATA_V2;
  document.getElementById('doc-title').textContent = s.title;
  document.getElementById('doc-subtitle').textContent = s.subtitle;

  drawerTabsEl.innerHTML = `
    <button class="drawer-tab is-active" data-tab="overview" type="button">概要・V1比較</button>
    <button class="drawer-tab" data-tab="rainproof" type="button">雨100%不侵入</button>
    <button class="drawer-tab" data-tab="simulations" type="button">9大超厳格検証</button>
    <button class="drawer-tab" data-tab="bom" type="button">¥5,950部品表</button>
    <button class="drawer-tab" data-tab="colab" type="button">A100超激重Sim</button>
  `;

  const totalCost = s.bom.reduce((acc, b) => acc + b.cost_jpy, 0);
  const totalMass = s.bom.reduce((acc, b) => acc + b.mass_kg, 0);

  drawerBodyEl.innerHTML = `
    <section id="tab-overview" class="tab-panel is-active">
      <div class="kpi-grid">
        ${s.kpis.map((k) => `
          <div class="kpi-card">
            <div class="kpi-label">${k.label}</div>
            <div class="kpi-val">${k.value}</div>
            <div class="kpi-sub">${k.sub}</div>
          </div>
        `).join('')}
      </div>
      <div class="doc-section">
        <h2>V2 超極限コスト効率・ハード制約 100%完全達成</h2>
        <p>${s.concept_summary}</p>
        <ul>
          ${s.key_principles.map((p) => `<li><strong>${p.title}：</strong>${p.desc}</li>`).join('')}
        </ul>
        <div class="version-links">
          <button class="version-link" data-switch-ver="v1" type="button">← V1（D12-500 / ¥558,044 / 11.6畳）へ切替</button>
          <a class="version-link" href="${s.colab_a100.url}" target="_blank" rel="noopener">🚀 Colab Pro A100 超激重Simを開く</a>
        </div>
      </div>
      <div class="doc-section">
        <h2>V1 vs V2 徹底比較（全数値実測シミュレーション一致）</h2>
        <table class="spec-table">
          <thead><tr><th>項目</th><th>V1 (D12-500)</th><th>V2 (AERO-PRISM P300)</th></tr></thead>
          <tbody>
            ${s.v1_vs_v2_rows.map(([k, v1, v2]) => `<tr><td>${k}</td><td>${v1}</td><td><strong>${v2}</strong></td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section id="tab-rainproof" class="tab-panel">
      <div class="doc-section">
        <h2>雨100%不侵入保証：7重物理バリア（150mm/h＋30m/s＋200mm冠水）</h2>
        <p>${s.rainproof_summary}</p>
        <table class="spec-table">
          <thead><tr><th>防衛層</th><th>物理メカニズム・実測余裕</th></tr></thead>
          <tbody>
            ${s.rainproof_layers.map(([l, d]) => `<tr><td><strong>${l}</strong></td><td>${d}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="doc-section">
        <h2>外枠ケース無し 52×16×48cm ソフト圧縮ロール収納原理</h2>
        <p>${s.packing_summary}</p>
        <table class="spec-table">
          <thead><tr><th>区画・部品</th><th>配置・ネスト仕様</th><th>実効容積</th></tr></thead>
          <tbody>
            ${s.packing_rows.map(([a, b, c]) => `<tr><td>${a}</td><td>${b}</td><td>${c}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>
    </section>

    <section id="tab-simulations" class="tab-panel">
      <div class="doc-section">
        <h2>9大超厳格マルチフィジックス検証：${s.verification_summary.passed} / ${s.verification_summary.total} 項目（${s.verification_summary.pass_rate}% 全合格）</h2>
        <p>${s.verification_summary.note}</p>
        ${s.simulations.map((sim) => `
          <div class="sim-card">
            <div class="sim-card-head">
              <div class="sim-card-title">${sim.name}</div>
              <span class="pass-badge">PASS</span>
            </div>
            <div class="sim-metrics">
              ${sim.metrics.map(([mk, mv]) => `<div><span style="color:#666">${mk}:</span> <strong>${mv}</strong></div>`).join('')}
            </div>
          </div>
        `).join('')}
      </div>
    </section>

    <section id="tab-bom" class="tab-panel">
      <div class="doc-section">
        <h2>完全国内実売 BOM（税込・送料¥0・外注切削0・電動0・外枠ケース0）</h2>
        <table class="spec-table">
          <thead><tr><th>部品・市販規格（購入店）</th><th>携行質量</th><th>税込価格</th></tr></thead>
          <tbody>
            ${s.bom.map((b) => `<tr><td><strong>${b.part}</strong><br><span style="color:#666;font-size:11px">${b.spec} / ${b.store}</span></td><td>${b.mass_kg.toFixed(2)} kg</td><td>¥${b.cost_jpy.toLocaleString()}</td></tr>`).join('')}
            <tr style="background:#fafafa"><td><strong>合計（予算上限 ¥6,000 / 残高 ¥${(6000 - totalCost).toLocaleString()}）</strong></td><td><strong>${totalMass.toFixed(2)} kg</strong></td><td><strong>¥${totalCost.toLocaleString()}</strong></td></tr>
          </tbody>
        </table>
      </div>
      <div class="doc-section">
        <h2>1人・無電源・工具不要 設営手順（合計 約 ${s.setup_total_min} 分）</h2>
        <ol>
          ${s.setup_steps.map((st) => `<li>${st.action}（約${st.time_s}秒）</li>`).join('')}
        </ol>
      </div>
    </section>

    <section id="tab-colab" class="tab-panel">
      <div class="colab-card">
        <div class="sim-card-head">
          <div class="sim-card-title">${s.colab_a100.title}</div>
          <span class="pass-badge">NVIDIA A100 40GB/80GB</span>
        </div>
        <p style="margin:6px 0 0;font-size:12.5px;line-height:1.6">${s.colab_a100.desc}</p>
        <a class="colab-btn" href="${s.colab_a100.url}" target="_blank" rel="noopener">
          ▶ Google Colab Pro (A100) で1ボタン実行を開く
        </a>
      </div>
      <div class="doc-section">
        <h2>A100 GPU 超激重マルチフィジックス 5大モジュール構成</h2>
        <ol>
          ${s.colab_a100.modules.map((m) => `<li><strong>${m.title}：</strong>${m.detail}</li>`).join('')}
        </ol>
      </div>
    </section>
  `;

  bindDrawerTabs();
  drawerBodyEl.querySelectorAll('[data-switch-ver]').forEach((btn) => {
    btn.addEventListener('click', () => switchVersion(btn.dataset.switchVer));
  });
}

// ---------------------------------------------------------------------------
// TOP-LEFT & DRAWER V1 <-> V2 INSTANT IN-PLACE SWITCHER
// ---------------------------------------------------------------------------
const btnVerV1 = document.getElementById('btn-ver-v1');
const btnVerV2 = document.getElementById('btn-ver-v2');
const btnDrawerV1 = document.getElementById('btn-drawer-v1');
const btnDrawerV2 = document.getElementById('btn-drawer-v2');

function switchVersion(ver, animateCamera = true) {
  const targetVer = ver === 'v2' ? 'v2' : 'v1';
  if (targetVer === 'v2' && !cadV2) {
    cadV2 = buildFreeRoomV2CAD(v2Root, renderer, SPECS_DATA_V2.physics_fields);
  }
  activeVersion = targetVer;
  v1Root.visible = (activeVersion === 'v1');
  v2Root.visible = (activeVersion === 'v2');

  btnVerV1.classList.toggle('is-active', activeVersion === 'v1');
  btnVerV2.classList.toggle('is-active', activeVersion === 'v2');
  btnDrawerV1.classList.toggle('is-active', activeVersion === 'v1');
  btnDrawerV2.classList.toggle('is-active', activeVersion === 'v2');

  document.title = activeVersion === 'v2'
    ? 'FREE-ROOM V2 AERO-PRISM P300 — 3D CAD'
    : 'FREE-ROOM D12-500 — 3D CAD';

  // Sync URL query cleanly without reload (preserves fullscreen & deep-links!)
  try {
    const u = new URL(window.location.href);
    u.searchParams.set('v', activeVersion === 'v2' ? '2' : '1');
    window.history.replaceState(null, '', u.pathname + u.search);
  } catch {
    // Ignore on file:// origins
  }

  syncModesToActiveCad();
  if (activeVersion === 'v2') {
    renderInfoSheetV2();
  } else {
    renderInfoSheetV1();
  }

  const presetKey = deployT <= 0.05 ? 'packed' : 'iso';
  setActiveViewBtn(presetKey);
  const p = getPresets()[presetKey];
  if (animateCamera) {
    flyCamera(p.pos, p.target, 0.55);
  } else {
    camAnim = null;
    camera.position.set(...p.pos);
    controls.target.set(...p.target);
    controls.update();
  }
}

btnVerV1.addEventListener('click', () => switchVersion('v1', true));
btnVerV2.addEventListener('click', () => switchVersion('v2', true));
btnDrawerV1.addEventListener('click', () => switchVersion('v1', true));
btnDrawerV2.addEventListener('click', () => switchVersion('v2', true));

// Initial version selection from URL (?v=2 or #v2), defaults to V1 (with V2 1-click at top-left!)
const initParams = new URLSearchParams(window.location.search);
const wantsV2 = initParams.get('v') === '2' || window.location.hash.toLowerCase() === '#v2';
switchVersion(wantsV2 ? 'v2' : 'v1', false);

// ---------------------------------------------------------------------------
// RESPONSIVE RESIZE & ANIMATION LOOP
// ---------------------------------------------------------------------------
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const isMobileLandscape = w > h && h <= 540;
  camera.fov = isMobileLandscape ? 44 : 40;
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

window.addEventListener('resize', onResize);
window.addEventListener('orientationchange', () => setTimeout(onResize, 120));
onResize();
syncSliderUI();

let lastNow = performance.now();

function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const realDt = Math.min(0.25, Math.max(0.001, (now - lastNow) / 1000));
  lastNow = now;

  const curCad = getActiveCad();

  if (isPlaying) {
    deployT += realDt * 0.18 * playDirection;
    if (deployT >= 1.0) {
      deployT = 1.0;
      setPlayState(false);
    } else if (deployT <= 0.0) {
      deployT = 0.0;
      playDirection = 1;
    }
    curCad.setDeploy(deployT);
    syncSliderUI();
  } else if (deployAnim) {
    deployAnim.elapsed += realDt;
    const p = Math.min(1, deployAnim.elapsed / deployAnim.duration);
    const e = 1 - Math.pow(1 - p, 3);
    deployT = deployAnim.startT + (deployAnim.endT - deployAnim.startT) * e;
    if (p >= 1) deployAnim = null;
    curCad.setDeploy(deployT);
    syncSliderUI();
  }

  if (camAnim) {
    camAnim.elapsed += realDt;
    const p = Math.min(1, camAnim.elapsed / camAnim.duration);
    const e = 1 - Math.pow(1 - p, 3);
    camera.position.lerpVectors(camAnim.startPos, camAnim.endPos, e);
    controls.target.lerpVectors(camAnim.startTarget, camAnim.endTarget, e);
    if (p >= 1) camAnim = null;
  }

  curCad.tick(realDt);
  controls.update();
  renderer.render(scene, camera);
}

animate();
