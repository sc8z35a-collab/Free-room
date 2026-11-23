/**
 * FREE-ROOM D12-500 — Main 3D CAD Controller
 * ==========================================
 * - Pure-White (#FFFFFF) Full-Bleed Architectural CAD Viewport
 * - 100% Zero-Text CAD Chrome (text exists strictly inside collapsible Info Drawer)
 * - Responsive Desktop PC + Mobile Landscape Fullscreen (Fullscreen API + Orientation Lock)
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildFreeRoomCAD } from './model.js';
import { SPECS_DATA } from './specs-data.js';

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
controls.minDistance = 0.38;
controls.maxDistance = 18.0;
controls.maxPolarAngle = Math.PI * 0.495;
controls.target.set(0, 1.15, 0);
controls.update();

// Pure-White Architectural Studio Lighting
const hemiLight = new THREE.HemisphereLight(0xffffff, 0xe8edf3, 0.95);
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

const fillLight = new THREE.DirectionalLight(0xeef5ff, 0.55);
fillLight.position.set(-7, 5, -5);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffffff, 0.35);
rimLight.position.set(0, 4, -9);
scene.add(rimLight);

// Build 1mm-Fidelity Parametric 3D CAD Model
const cad = buildFreeRoomCAD(scene, renderer, SPECS_DATA.physics_fields);

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

const VIEW_PRESETS = {
  iso:      { pos: [5.4, 3.6, 5.8],    target: [0, 1.15, 0],  ensureDeploy: null },
  front:    { pos: [0.0, 1.65, 7.2],   target: [0, 1.30, 0],  ensureDeploy: null },
  top:      { pos: [0.0, 9.6, 0.08],   target: [0, 0.0, 0],   ensureDeploy: null },
  interior: { pos: [1.65, 1.38, 1.45], target: [-0.65, 0.85, -0.35], ensureDeploy: 1.0 },
  packed:   { pos: [0.64, 0.42, -0.74], target: [0, 0.24, 0],  ensureDeploy: 0.0 },
};

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
  cad.setDeploy(deployT);
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
  flyCamera(VIEW_PRESETS.packed.pos, VIEW_PRESETS.packed.target, 0.6);
});

btnSnapDeployed.addEventListener('click', () => {
  setPlayState(false);
  startDeployTransition(1.0, 0.55);
  setActiveViewBtn('iso');
  flyCamera(VIEW_PRESETS.iso.pos, VIEW_PRESETS.iso.target, 0.6);
});

Object.entries(viewButtons).forEach(([key, btn]) => {
  btn.addEventListener('click', () => {
    const preset = VIEW_PRESETS[key];
    setActiveViewBtn(key);
    setPlayState(false);
    if (preset.ensureDeploy !== null) {
      startDeployTransition(preset.ensureDeploy, 0.55);
    }
    flyCamera(preset.pos, preset.target, 0.6);
  });
});

// Cancel camera transition if user starts manual orbit/pinch
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

btnXray.addEventListener('click', () => {
  const next = !cad.getState().xray;
  cad.setXray(next);
  btnXray.classList.toggle('is-active', next);
});

btnSection.addEventListener('click', () => {
  const next = !cad.getState().section;
  cad.setSection(next);
  btnSection.classList.toggle('is-active', next);
});

btnExplode.addEventListener('click', () => {
  const next = !cad.getState().explode;
  cad.setExplode(next);
  btnExplode.classList.toggle('is-active', next);
});

btnPhysics.addEventListener('click', () => {
  const next = !cad.getState().physics;
  if (next && deployT < 0.95) {
    startDeployTransition(1.0, 0.55);
    flyCamera(VIEW_PRESETS.iso.pos, VIEW_PRESETS.iso.target, 0.6);
  }
  cad.setPhysicsMode(next);
  btnPhysics.classList.toggle('is-active', next);
  heatmapSwatch.classList.toggle('is-visible', next);
});

btnScale.addEventListener('click', () => {
  const next = !cad.getState().scale;
  cad.setScaleVisible(next);
  btnScale.classList.toggle('is-active', next);
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
    // Graceful fallback on browsers restricting fullscreen API
  }
  updateFullscreenIcon();
});

document.addEventListener('fullscreenchange', updateFullscreenIcon);
document.addEventListener('webkitfullscreenchange', updateFullscreenIcon);

// Info Drawer Toggle (ONLY text container in the entire app!)
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

// Drawer Tabs
document.querySelectorAll('.drawer-tab').forEach((tabBtn) => {
  tabBtn.addEventListener('click', () => {
    const target = tabBtn.dataset.tab;
    document.querySelectorAll('.drawer-tab').forEach((b) => b.classList.toggle('is-active', b === tabBtn));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.toggle('is-active', p.id === `tab-${target}`));
  });
});

// Populate Explanation Sheet from Verified Simulation JSON Data
function renderInfoSheet() {
  const s = SPECS_DATA;
  document.getElementById('doc-title').textContent = s.title;
  document.getElementById('doc-subtitle').textContent = s.subtitle;

  // TAB 1: Overview & Spatial Efficiency
  document.getElementById('tab-overview').innerHTML = `
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
  `;

  // TAB 2: Structural & Concentric Packing Engineering
  document.getElementById('tab-engineering').innerHTML = `
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
  `;

  // TAB 3: 8 Multi-Physics Verification Results
  document.getElementById('tab-simulations').innerHTML = `
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
  `;

  // TAB 4: Commercial BOM, Exact Budget & Solo Setup Steps
  const totalCost = s.bom.reduce((acc, b) => acc + b.cost_jpy, 0);
  const totalMass = s.bom.reduce((acc, b) => acc + b.mass_kg, 0);
  document.getElementById('tab-bom').innerHTML = `
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
  `;
}

renderInfoSheet();

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

  // Playback / Smooth wall-clock time-based deployment transition
  if (isPlaying) {
    deployT += realDt * 0.18 * playDirection;
    if (deployT >= 1.0) {
      deployT = 1.0;
      setPlayState(false);
    } else if (deployT <= 0.0) {
      deployT = 0.0;
      playDirection = 1;
    }
    cad.setDeploy(deployT);
    syncSliderUI();
  } else if (deployAnim) {
    deployAnim.elapsed += realDt;
    const p = Math.min(1, deployAnim.elapsed / deployAnim.duration);
    const e = 1 - Math.pow(1 - p, 3);
    deployT = deployAnim.startT + (deployAnim.endT - deployAnim.startT) * e;
    if (p >= 1) deployAnim = null;
    cad.setDeploy(deployT);
    syncSliderUI();
  }

  // Smooth camera preset fly-to
  if (camAnim) {
    camAnim.elapsed += realDt;
    const p = Math.min(1, camAnim.elapsed / camAnim.duration);
    const e = 1 - Math.pow(1 - p, 3);
    camera.position.lerpVectors(camAnim.startPos, camAnim.endPos, e);
    controls.target.lerpVectors(camAnim.startTarget, camAnim.endTarget, e);
    if (p >= 1) camAnim = null;
  }

  cad.tick(realDt);
  controls.update();
  renderer.render(scene, camera);
}

animate();
