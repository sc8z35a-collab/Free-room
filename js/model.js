/**
 * FREE-ROOM D12-500 — Precision Parametric 3D CAD Model Builder
 * ==============================================================
 * Scale: 1.0 Three.js unit = 1.0 meter (1 mm geometric fidelity)
 * Background: Pure White (#FFFFFF) architectural CAD aesthetic
 * Zero text inside 3D scene (strict compliance with zero-text CAD requirement)
 */

import * as THREE from 'three';

// Shared geometric constants synchronized with simulations/design_spec.py
export const DIMS = {
  // Packed Clamshell Case (EXACT 520 x 160 x 480 mm)
  PACK_L: 0.520,
  PACK_W: 0.160,
  PACK_H: 0.480,
  // Deployed Regular Dodecagon Pavilion
  N: 12,
  R: 2.500,             // Circumradius -> Diameter 5.00 m
  R_EAVE: 2.700,        // +200 mm rain overhang
  H_WALL: 1.600,        // Vertical perimeter wall height
  H_MID: 0.800,         // Mid-height Y-bridle & tension ring
  H_APEX: 2.900,        // Central mast apex height
  H_SPREADER: 1.450,    // Diamond spreader elevation
  R_SPREADER: 0.260,    // Spreader arm radius
  H_BATHTUB: 0.160,     // Waterproof bathtub floor lip
  R_ANCHOR: 4.100,      // 45-deg guyline stake circle radius (dia 8.20 m)
  LINER_GAP: 0.060,     // 60 mm ventilated double-skin roof gap
};

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function easeOutCubic(x) {
  const t = clamp01(x);
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutCubic(x) {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function phase(t, a, b) {
  return easeInOutCubic((t - a) / (b - a));
}

/** Generate subtle woven 3K carbon fiber procedural texture (no external images!) */
function createCarbonTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#1f2328';
  ctx.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 8) {
    for (let x = 0; x < 64; x += 8) {
      const parity = ((x + y) / 8) % 2;
      ctx.fillStyle = parity === 0 ? '#2b3038' : '#181b20';
      ctx.fillRect(x, y, 7, 4);
      ctx.fillStyle = parity === 0 ? '#181b20' : '#262b33';
      ctx.fillRect(x, y + 4, 7, 4);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Generate subtle ripstop grid texture for 20D Silpoly membrane */
function createRipstopTexture(baseHex, gridHex) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = gridHex;
  ctx.lineWidth = 1;
  for (let i = 0; i < 128; i += 16) {
    ctx.beginPath(); ctx.moveTo(i + 0.5, 0); ctx.lineTo(i + 0.5, 128); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i + 0.5); ctx.lineTo(128, i + 0.5); ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(14, 14);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Map normalized scalar [0..1] to scientific CFD/FEA blue->cyan->green->amber->red palette */
function scientificColor(norm) {
  const v = clamp01(norm);
  const stops = [
    [0.00, 0x25, 0x63, 0xeb],
    [0.28, 0x06, 0xb6, 0xd4],
    [0.52, 0x10, 0xb9, 0x81],
    [0.78, 0xf5, 0x9e, 0x0b],
    [1.00, 0xdc, 0x26, 0x26],
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (v <= b[0]) {
      const f = (v - a[0]) / (b[0] - a[0]);
      return new THREE.Color(
        (a[1] + (b[1] - a[1]) * f) / 255,
        (a[2] + (b[2] - a[2]) * f) / 255,
        (a[3] + (b[3] - a[3]) * f) / 255,
      );
    }
  }
  return new THREE.Color(0xdc / 255, 0x26 / 255, 0x26 / 255);
}

/** Add crisp architectural CAD edge lines to any mesh */
function addCadEdges(mesh, thresholdDeg = 22, color = 0x22262b, opacity = 0.28, clipPlanes = null) {
  const geo = new THREE.EdgesGeometry(mesh.geometry, thresholdDeg);
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    clippingPlanes: clipPlanes || [],
  });
  const lines = new THREE.LineSegments(geo, mat);
  mesh.add(lines);
  return lines;
}

/** Build a clean cylindrical segment between two Vector3 points */
function createCylinderBetween(p1, p2, radius, mat, radialSegs = 12) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radius, radius, len, radialSegs);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(p1).addScaledVector(dir, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

/** Update an existing cylinder mesh to span p1 -> p2 */
function updateCylinderBetween(mesh, p1, p2) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = Math.max(0.0001, dir.length());
  mesh.position.copy(p1).addScaledVector(dir, 0.5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
}

/** Build minimalist architectural 1.75m human scale figure (clean clay/graphite silhouette) */
function createHumanFigure(mat, sitting = false) {
  const g = new THREE.Group();
  if (!sitting) {
    // Standing 1.75 m human silhouette
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 14), mat);
    head.position.y = 1.64;
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.145, 0.42, 8, 16), mat);
    torso.position.y = 1.22;
    torso.scale.set(1.25, 1.0, 0.72);
    const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.062, 0.72, 6, 12), mat);
    legL.position.set(-0.09, 0.42, 0);
    const legR = legL.clone();
    legR.position.x = 0.09;
    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.046, 0.52, 6, 10), mat);
    armL.position.set(-0.23, 1.15, 0);
    armL.rotation.z = 0.08;
    const armR = armL.clone();
    armR.position.x = 0.23;
    armR.rotation.z = -0.08;
    g.add(head, torso, legL, legR, armL, armR);
  } else {
    // Reclining / resting silhouette on R5.2 sleeping mat (length 1.72 m along Z)
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.10, 16, 12), mat);
    head.position.set(0, 0.19, -0.68);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.48, 8, 14), mat);
    torso.rotation.x = Math.PI / 2;
    torso.scale.set(1.2, 1.0, 0.68);
    torso.position.set(0, 0.18, -0.22);
    const legs = new THREE.Mesh(new THREE.CapsuleGeometry(0.115, 0.68, 8, 14), mat);
    legs.rotation.x = Math.PI / 2;
    legs.scale.set(1.15, 1.0, 0.62);
    legs.position.set(0, 0.15, 0.42);
    g.add(head, torso, legs);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

/**
 * Main Parametric Pavilion CAD Assembly Builder
 * Returns controller object with:
 *   - root: THREE.Group
 *   - setDeploy(t: 0..1)
 *   - setXray(bool)
 *   - setSection(bool)
 *   - setExplode(bool)
 *   - setPhysicsMode(bool, cfdCpData)
 *   - setScaleVisible(bool)
 *   - tick(dt)  // animates CFD wind particles when physics mode is active
 */
export function buildFreeRoomCAD(scene, renderer, simPhysicsData) {
  const root = new THREE.Group();
  scene.add(root);

  // Clipping plane for Half-Section CAD Cutaway (cuts X > 0.001)
  const sectionPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.001);
  const clipList = [];

  // ---------------------------------------------------------------------------
  // MATERIALS (Crisp Architectural / Industrial CAD Palette on Pure White)
  // ---------------------------------------------------------------------------
  const carbonTex = createCarbonTexture();
  const silpolyTex = createRipstopTexture('#f4f2ec', 'rgba(30,34,40,0.055)');
  const floorTex = createRipstopTexture('#3a424c', 'rgba(255,255,255,0.06)');

  const matCFRP = new THREE.MeshStandardMaterial({
    map: carbonTex,
    color: 0xffffff,
    roughness: 0.36,
    metalness: 0.22,
  });

  const matAl7075 = new THREE.MeshStandardMaterial({
    color: 0xd0d6de,
    roughness: 0.25,
    metalness: 0.82,
  });

  const matAlAccent = new THREE.MeshStandardMaterial({
    color: 0xc86432, // anodized copper-terracotta aerospace accent for CNC hubs & Y-stakes
    roughness: 0.30,
    metalness: 0.72,
  });

  const matRoofOuter = new THREE.MeshStandardMaterial({
    map: silpolyTex,
    color: 0xf6f4ee, // High solar reflectance light-sand white 20D Silpoly
    roughness: 0.62,
    metalness: 0.02,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.96,
    clippingPlanes: clipList,
  });

  const matWallOuter = new THREE.MeshStandardMaterial({
    map: silpolyTex,
    color: 0xeae6dc,
    roughness: 0.68,
    metalness: 0.02,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.95,
    clippingPlanes: clipList,
  });

  const matLiner = new THREE.MeshStandardMaterial({
    color: 0xdce4ee, // Low-E aluminized silver radiant inner roof liner
    roughness: 0.35,
    metalness: 0.55,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.88,
    clippingPlanes: clipList,
  });

  const matMeshScreen = new THREE.MeshStandardMaterial({
    color: 0x2c323a,
    roughness: 0.9,
    transparent: true,
    opacity: 0.26,
    side: THREE.DoubleSide,
    clippingPlanes: clipList,
  });

  const matFloor = new THREE.MeshStandardMaterial({
    map: floorTex,
    color: 0x454e59,
    roughness: 0.72,
    metalness: 0.05,
    side: THREE.DoubleSide,
    clippingPlanes: clipList,
  });

  const matSleepMat = new THREE.MeshStandardMaterial({
    color: 0x3b6e8c, // R-5.2 technical insulated mat slate-blue
    roughness: 0.55,
    metalness: 0.06,
  });

  const matDyneema = new THREE.MeshStandardMaterial({
    color: 0x2c353f,
    roughness: 0.5,
    metalness: 0.1,
  });

  const matDyneemaReflect = new THREE.MeshStandardMaterial({
    color: 0xd97706, // high-vis reflective tracer on outer Y-bridle guylines
    roughness: 0.45,
    metalness: 0.15,
  });

  const matHuman = new THREE.MeshStandardMaterial({
    color: 0x8b95a1,
    roughness: 0.65,
    metalness: 0.05,
    transparent: true,
    opacity: 0.72,
  });

  // Ground shadow catcher (Invisible pure white floor — ONLY casts crisp ultra-soft architectural shadow!)
  const shadowFloor = new THREE.Mesh(
    new THREE.CircleGeometry(7.0, 64),
    new THREE.ShadowMaterial({ opacity: 0.11 }),
  );
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = -0.001;
  shadowFloor.receiveShadow = true;
  root.add(shadowFloor);

  // Subtle CAD architectural footprint reference ring on the pure-white floor (thin hairline)
  const footprintRingPts = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    footprintRingPts.push(new THREE.Vector3(Math.cos(a) * DIMS.R_ANCHOR, 0.0015, Math.sin(a) * DIMS.R_ANCHOR));
  }
  const footprintRing = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(footprintRingPts),
    new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.10 }),
  );
  root.add(footprintRing);

  // ---------------------------------------------------------------------------
  // 1. CLAMSHELL CASE (EXACT 520 x 160 x 480 mm -> OPENS 180° INTO 960 x 520 mm HUB)
  // ---------------------------------------------------------------------------
  const caseAssembly = new THREE.Group();
  root.add(caseAssembly);

  // Two equal 80mm deep structural halves (520 x 480 x 80 mm each) joined along bottom hinge
  const halfDepth = DIMS.PACK_W / 2; // 0.080 m
  const shellWall = 0.006;

  const matCaseBack = matCFRP.clone();
  matCaseBack.transparent = true;
  matCaseBack.opacity = 1.0;

  function buildClamshellHalf(isBayA) {
    const g = new THREE.Group();
    // Outer backing plate (520 x 480 x 6 mm) — becomes translucent in X-Ray mode to inspect 1mm Matryoshka packing!
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(DIMS.PACK_L, DIMS.PACK_H, shellWall),
      matCaseBack,
    );
    back.castShadow = true;
    back.receiveShadow = true;
    addCadEdges(back, 25, 0x000000, 0.35);

    // 4 aluminum perimeter rim channels (7075-T6 frame, depth = halfDepth)
    const rimTop = new THREE.Mesh(new THREE.BoxGeometry(DIMS.PACK_L, shellWall, halfDepth), matAl7075);
    const rimBot = rimTop.clone();
    const rimL = new THREE.Mesh(new THREE.BoxGeometry(shellWall, DIMS.PACK_H - 2 * shellWall, halfDepth), matAl7075);
    const rimR = rimL.clone();

    const zSign = isBayA ? -1 : 1;
    // Local coords of half: hinge line is at y = 0, z = 0; body extends y in [0, PACK_H], z in [0, zSign * halfDepth]
    back.position.set(0, DIMS.PACK_H / 2, zSign * (halfDepth - shellWall / 2));
    rimTop.position.set(0, DIMS.PACK_H - shellWall / 2, zSign * halfDepth / 2);
    rimBot.position.set(0, shellWall / 2, zSign * halfDepth / 2);
    rimL.position.set(-DIMS.PACK_L / 2 + shellWall / 2, DIMS.PACK_H / 2, zSign * halfDepth / 2);
    rimR.position.set(DIMS.PACK_L / 2 - shellWall / 2, DIMS.PACK_H / 2, zSign * halfDepth / 2);

    [rimTop, rimBot, rimL, rimR].forEach((r) => {
      r.castShadow = true;
      r.receiveShadow = true;
      addCadEdges(r, 25, 0x111111, 0.25);
    });

    // Subtle integrated top carry handle on Bay A outer rim + latches
    if (isBayA) {
      const handleBar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.014, 0.024), matAl7075);
      handleBar.position.set(0, DIMS.PACK_H + 0.008, 0);
      g.add(handleBar);
    }

    g.add(back, rimTop, rimBot, rimL, rimR);
    return g;
  }

  const caseHalfA = buildClamshellHalf(true);
  const caseHalfB = buildClamshellHalf(false);
  // Hinge pivot group at ground (y = 0, z = 0)
  const hingePivotA = new THREE.Group();
  const hingePivotB = new THREE.Group();
  hingePivotA.add(caseHalfA);
  hingePivotB.add(caseHalfB);
  caseAssembly.add(hingePivotA, hingePivotB);

  // Stainless steel hinge pins along the seam
  for (const hx of [-0.18, 0.0, 0.18]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 12), matAl7075);
    pin.rotation.z = Math.PI / 2;
    pin.position.set(hx, 0.006, 0);
    caseAssembly.add(pin);
  }

  // ---------------------------------------------------------------------------
  // 1B. PACKED INTERNAL CONTENTS (1mm-EXACT SIM-1 LAYOUT — VISIBLE AT t < 0.35!)
  // ---------------------------------------------------------------------------
  const packedContentsGroup = new THREE.Group();
  hingePivotA.add(packedContentsGroup); // Rides with Bay A when closed/opening

  // 3 Outer Mast Carrier Tubes (OD 44mm, L 460mm) at Y = 24, 70, 116 mm (exact SIM-1!)
  for (let i = 0; i < 3; i++) {
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.460, 18), matCFRP);
    tube.rotation.z = Math.PI / 2;
    tube.position.set(-0.020, 0.024 + i * 0.046 + 0.005, -0.052);
    // Concentric inner nested rings visible at tube end!
    if (i < 2) {
      const inner1 = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.464, 16), matAl7075);
      inner1.rotation.z = Math.PI / 2;
      inner1.position.copy(tube.position);
      const inner2 = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.468, 16), matAlAccent);
      inner2.rotation.z = Math.PI / 2;
      inner2.position.copy(tube.position);
      packedContentsGroup.add(inner1, inner2);
    }
    packedContentsGroup.add(tube);
  }

  // 24 Perimeter Strut Carrier Tubes in Exact Hexagonal Staggered 2-Layer Close-Packing (SIM-1!)
  for (let i = 0; i < 12; i++) {
    const cy1 = 0.157 + i * 0.0254;
    const cy2 = 0.157 + 0.0127 + i * 0.0254;
    const t1 = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.440, 12), matCFRP);
    t1.rotation.z = Math.PI / 2;
    t1.position.set(-0.030, cy1, -0.063);
    const t2 = t1.clone();
    t2.position.set(-0.030, cy2, -0.0408);
    // Visible nested stake tips inside tubes
    const tip1 = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.443, 8), matAlAccent);
    tip1.rotation.z = Math.PI / 2;
    tip1.position.copy(t1.position);
    packedContentsGroup.add(t1, t2, tip1);
  }

  // Aux trays (ferrules, Dyneema cable spools, strike cap) at X = +0.222 m
  const auxTray = new THREE.Mesh(new THREE.BoxGeometry(0.054, 0.43, 0.042), matAl7075);
  auxTray.position.set(0.222, 0.240, -0.052);
  addCadEdges(auxTray, 25, 0x111111, 0.25);
  packedContentsGroup.add(auxTray);

  // Bay B Packed Contents (Folded Fabrics + 2x Flat-Folded R5.2 Air Mats + CNC Apex Hub — strictly inside z < 0.074m!)
  const packedBayBGroup = new THREE.Group();
  hingePivotB.add(packedBayBGroup);

  const foldedFloor = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.19, 0.036), matFloor);
  foldedFloor.position.set(0, 0.105, 0.022);
  const foldedCanopy = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.24, 0.036), matRoofOuter);
  foldedCanopy.position.set(0, 0.33, 0.022);
  const foldedMats = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.026), matSleepMat);
  foldedMats.position.set(-0.01, 0.34, 0.056);
  const packedHub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.024, 24), matAlAccent);
  packedHub.rotation.x = Math.PI / 2;
  packedHub.position.set(0.16, 0.08, 0.056);
  [foldedFloor, foldedCanopy, foldedMats].forEach((m) => addCadEdges(m, 25, 0x111111, 0.18));
  packedBayBGroup.add(foldedFloor, foldedCanopy, foldedMats, packedHub);

  // ---------------------------------------------------------------------------
  // 2. CENTRAL 3-TIER CFRP MAST + 4-WAY DIAMOND SPREADER + 8 SHROUDS + APEX HUB
  // ---------------------------------------------------------------------------
  const mastGroup = new THREE.Group();
  root.add(mastGroup);

  const mastTierLow = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 1.25, 24), matCFRP);
  const mastTierMid = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.85, 24), matCFRP);
  const mastTierUp  = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.85, 24), matCFRP);
  // Machined 7075-T6 coupler rings + anodized central base load-spreader socket on unfolded clamshell hub
  const collar1 = new THREE.Mesh(new THREE.CylinderGeometry(0.0245, 0.0245, 0.045, 24), matAl7075);
  const collar2 = new THREE.Mesh(new THREE.CylinderGeometry(0.0215, 0.0215, 0.045, 24), matAl7075);
  const mastBaseSocket = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.048, 0.056, 24), matAlAccent);
  mastBaseSocket.position.y = 0.042;

  [mastTierLow, mastTierMid, mastTierUp, collar1, collar2, mastBaseSocket].forEach((m) => {
    m.castShadow = true;
    mastGroup.add(m);
  });

  // CNC 7075-T6 Apex Tension Ring Hub (12 radial cable lugs + roof vent dome cap)
  const apexHubGroup = new THREE.Group();
  const apexCore = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.062, 0.036, 12), matAlAccent);
  const apexVentCap = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.09, 12), matRoofOuter);
  apexVentCap.position.y = 0.075;
  addCadEdges(apexVentCap, 15, 0x22262b, 0.25);
  apexHubGroup.add(apexCore, apexVentCap);
  mastGroup.add(apexHubGroup);

  // Mid-height 4-way CFRP Diamond Spreader + 8 Dyneema Shrouds
  const spreaderGroup = new THREE.Group();
  const spreaderCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.05, 16), matAlAccent);
  spreaderGroup.add(spreaderCollar);
  const spreaderArms = [];
  for (let m = 0; m < 4; m++) {
    const ang = m * Math.PI / 2;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, DIMS.R_SPREADER, 10), matCFRP);
    arm.rotation.z = Math.PI / 2;
    const pivot = new THREE.Group();
    pivot.rotation.y = ang;
    arm.position.x = DIMS.R_SPREADER / 2;
    const tipCap = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), matAl7075);
    tipCap.position.x = DIMS.R_SPREADER;
    pivot.add(arm, tipCap);
    spreaderGroup.add(pivot);
    spreaderArms.push(pivot);
  }
  mastGroup.add(spreaderGroup);

  const shroudUnitCyl = new THREE.CylinderGeometry(0.0018, 0.0018, 1.0, 6);
  const shroudMeshes = [];
  for (let i = 0; i < 8; i++) {
    const sm = new THREE.Mesh(shroudUnitCyl, matDyneema);
    mastGroup.add(sm);
    shroudMeshes.push(sm);
  }

  // ---------------------------------------------------------------------------
  // 3. 12 PERIMETER 2-TIER CFRP STRUTS + DUAL RINGS + Y-BRIDLE GUYLINES + 36 STAKES
  // ---------------------------------------------------------------------------
  const skeletonGroup = new THREE.Group();
  root.add(skeletonGroup);

  const strutMeshes = [];
  const ridgeCableMeshes = [];
  const guyTopMeshes = [];
  const guyMidMeshes = [];
  const ringTopMeshes = [];
  const ringMidMeshes = [];
  const stakePairGroups = [];
  const floorStakeMeshes = [];

  const cableUnitGeo = new THREE.CylinderGeometry(0.0022, 0.0022, 1.0, 6);

  // Build individual strut materials so FEA heatmap can color each strut accurately!
  const strutMats = [];
  for (let k = 0; k < DIMS.N; k++) {
    const sMat = matCFRP.clone();
    strutMats.push(sMat);
    const sg = new THREE.Group();
    const lo = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.80, 14), sMat);
    lo.position.y = 0.40;
    const hi = new THREE.Mesh(new THREE.CylinderGeometry(0.010, 0.010, 0.80, 14), sMat);
    hi.position.y = 1.20;
    const midJoint = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.036, 14), matAl7075);
    midJoint.position.y = 0.80;
    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.013, 0.030, 12), matAlAccent);
    topCap.position.y = 1.60;
    lo.castShadow = true;
    hi.castShadow = true;
    sg.add(lo, hi, midJoint, topCap);
    skeletonGroup.add(sg);
    strutMeshes.push(sg);

    // Cables
    const rc = new THREE.Mesh(cableUnitGeo, matDyneema);
    const gt = new THREE.Mesh(cableUnitGeo, matDyneemaReflect);
    const gm = new THREE.Mesh(cableUnitGeo, matDyneemaReflect);
    const rt = new THREE.Mesh(cableUnitGeo, matDyneema);
    const rm = new THREE.Mesh(cableUnitGeo, matDyneema);
    skeletonGroup.add(rc, gt, gm, rt, rm);
    ridgeCableMeshes.push(rc);
    guyTopMeshes.push(gt);
    guyMidMeshes.push(gm);
    ringTopMeshes.push(rt);
    ringMidMeshes.push(rm);

    // Outer Ring (r=4.10m) & Inner Ring (r=3.30m) Double-Helical 320mm Screw Anchors (24 main anchors!)
    const makeHelicalAnchor = () => {
      const hg = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.006, 0.14, 10), matAlAccent);
      shaft.position.y = 0.05;
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.018, 6), matAl7075);
      head.position.y = 0.12;
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.005, 16), matCFRP);
      flange.position.y = 0.015;
      hg.add(shaft, head, flange);
      hg.rotation.z = -0.35; // driven aligned with 45 deg pull
      hg.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      return hg;
    };
    const outerAnchor = makeHelicalAnchor();
    const innerAnchor = makeHelicalAnchor();
    skeletonGroup.add(outerAnchor, innerAnchor);
    stakePairGroups.push({ outer: outerAnchor, inner: innerAnchor });

    // Floor corner 180mm Titanium V-stake (12 floor stakes)
    const fstk = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.002, 0.08, 3), matAl7075);
    fstk.position.y = 0.025;
    skeletonGroup.add(fstk);
    floorStakeMeshes.push(fstk);
  }

  // ---------------------------------------------------------------------------
  // 4. WATERPROOF MEMBRANE ENVELOPE (ROOF, EAVES, WALLS, DOORS, PANORAMA MESH, LINER, FLOOR)
  // ---------------------------------------------------------------------------
  const floorGroup = new THREE.Group();
  const roofGroup = new THREE.Group();
  const linerGroup = new THREE.Group();
  const wallGroup = new THREE.Group();
  root.add(floorGroup, wallGroup, linerGroup, roofGroup);

  // Build 12-gon Bathtub Floor (flat base + 160 mm vertical waterproof rim)
  const floorBaseGeo = new THREE.CylinderGeometry(DIMS.R, DIMS.R, 0.012, DIMS.N);
  // Align vertices with angles 2*pi*k/12 (Three.js CylinderGeometry starts at +Z; rotate Y by pi/2? Let's build exact vertices!)
  function buildRegular12RoofGeo(radiusOuter, yBase, yApex, vertexColors = null) {
    const positions = [];
    const colors = [];
    for (let k = 0; k < DIMS.N; k++) {
      const a0 = (2 * Math.PI * k) / DIMS.N;
      const a1 = (2 * Math.PI * (k + 1)) / DIMS.N; // No modulo wrap so midpoint am stays cleanly between a0 and a1!
      const am = 0.5 * (a0 + a1);
      const p0 = [radiusOuter * Math.cos(a0), yBase, radiusOuter * Math.sin(a0)];
      const p1 = [radiusOuter * Math.cos(a1), yBase, radiusOuter * Math.sin(a1)];
      const pMidEdge = [radiusOuter * Math.cos(am) * 0.994, yBase + 0.008, radiusOuter * Math.sin(am) * 0.994];
      const pApex = [0, yApex, 0];

      // 2 sub-triangles per gore for crisp catenary & smooth vertex color
      positions.push(...p0, ...pApex, ...pMidEdge);
      positions.push(...pMidEdge, ...pApex, ...p1);
      if (vertexColors) {
        const c = vertexColors[k];
        for (let v = 0; v < 6; v++) colors.push(c.r, c.g, c.b);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    if (vertexColors) {
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    }
    geo.computeVertexNormals();
    return geo;
  }

  // Exact 12-gon Floor Mesh (inset 12mm inside outer wall to eliminate any Z-fighting!)
  const floorPos = [];
  const rimPos = [];
  const rFloor = DIMS.R - 0.012;
  for (let k = 0; k < DIMS.N; k++) {
    const a0 = (2 * Math.PI * k) / DIMS.N;
    const a1 = (2 * Math.PI * (k + 1)) / DIMS.N;
    const x0 = rFloor * Math.cos(a0), z0 = rFloor * Math.sin(a0);
    const x1 = rFloor * Math.cos(a1), z1 = rFloor * Math.sin(a1);
    floorPos.push(0, 0.010, 0, x1, 0.010, z1, x0, 0.010, z0);
    // 160 mm vertical bathtub rim
    rimPos.push(x0, 0.010, z0, x1, 0.010, z1, x1, DIMS.H_BATHTUB, z1);
    rimPos.push(x0, 0.010, z0, x1, DIMS.H_BATHTUB, z1, x0, DIMS.H_BATHTUB, z0);
  }
  const fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.Float32BufferAttribute(floorPos, 3));
  fGeo.computeVertexNormals();
  const floorMesh = new THREE.Mesh(fGeo, matFloor);
  floorMesh.receiveShadow = true;
  addCadEdges(floorMesh, 20, 0x111111, 0.22, clipList);

  const rGeo = new THREE.BufferGeometry();
  rGeo.setAttribute('position', new THREE.Float32BufferAttribute(rimPos, 3));
  rGeo.computeVertexNormals();
  const rimMesh = new THREE.Mesh(rGeo, matFloor);
  addCadEdges(rimMesh, 20, 0x111111, 0.28, clipList);
  floorGroup.add(floorMesh, rimMesh);

  // Outer Roof Fly (with 200 mm rain eave overhang)
  const yEave = DIMS.H_WALL - (DIMS.H_APEX - DIMS.H_WALL) * (DIMS.R_EAVE - DIMS.R) / DIMS.R;
  const roofGeo = buildRegular12RoofGeo(DIMS.R_EAVE, yEave, DIMS.H_APEX);
  const roofMesh = new THREE.Mesh(roofGeo, matRoofOuter);
  roofMesh.castShadow = true;
  roofMesh.receiveShadow = true;
  addCadEdges(roofMesh, 12, 0x1e242c, 0.22, clipList);
  roofGroup.add(roofMesh);

  // Low-E Aluminized Anti-Condensation Inner Roof Liner (60 mm ventilated air gap below outer roof!)
  const linerGeo = buildRegular12RoofGeo(DIMS.R - 0.05, DIMS.H_WALL - DIMS.LINER_GAP, DIMS.H_APEX - DIMS.LINER_GAP * 1.4);
  const linerMesh = new THREE.Mesh(linerGeo, matLiner);
  addCadEdges(linerMesh, 14, 0x334155, 0.16, clipList);
  linerGroup.add(linerMesh);

  // 12 Perimeter Vertical Walls:
  //   - Panels k = 0 and k = 6: Opposite Wide Architectural Entry Doors (partially open/rolled arch so interior is inviting!)
  //   - Panels k = 2, 4, 8, 10: Panoramic Mesh Windows with Lower Privacy Sill (0.70m) & Upper Vent
  //   - Panels k = 1, 3, 5, 7, 9, 11: Full Weatherproof 20D Silpoly Vertical Wall Panels with Lower 10cm Intake Vent
  const wallPanels = []; // store for CFD Cp color mapping!
  for (let k = 0; k < DIMS.N; k++) {
    const a0 = (2 * Math.PI * k) / DIMS.N;
    const a1 = (2 * Math.PI * ((k + 1) % DIMS.N)) / DIMS.N;
    const x0 = DIMS.R * Math.cos(a0), z0 = DIMS.R * Math.sin(a0);
    const x1 = DIMS.R * Math.cos(a1), z1 = DIMS.R * Math.sin(a1);

    const isDoor = (k === 0 || k === 6);
    const isWindow = (k === 2 || k === 4 || k === 8 || k === 10);

    const makeQuad = (ya, yb, mat, frac0 = 0, frac1 = 1) => {
      const lx0 = x0 + (x1 - x0) * frac0, lz0 = z0 + (z1 - z0) * frac0;
      const lx1 = x0 + (x1 - x0) * frac1, lz1 = z0 + (z1 - z0) * frac1;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute([
        lx0, ya, lz0, lx1, ya, lz1, lx1, yb, lz1,
        lx0, ya, lz0, lx1, yb, lz1, lx0, yb, lz0,
      ], 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      addCadEdges(mesh, 15, 0x1f242c, 0.24, clipList);
      return mesh;
    };

    const panelGrp = new THREE.Group();
    if (isDoor) {
      // Wide entry doorway: side jambs + top header + mesh half-panel
      panelGrp.add(makeQuad(0.01, DIMS.H_WALL, matWallOuter, 0.0, 0.14));
      panelGrp.add(makeQuad(0.01, DIMS.H_WALL, matWallOuter, 0.86, 1.0));
      panelGrp.add(makeQuad(DIMS.H_WALL - 0.12, DIMS.H_WALL, matWallOuter, 0.14, 0.86));
      panelGrp.add(makeQuad(DIMS.H_BATHTUB, DIMS.H_WALL - 0.12, matMeshScreen, 0.50, 0.86));
    } else if (isWindow) {
      // Lower solid weather wall (0..0.68m) + Panoramic 15D Bug Mesh Window (0.68..1.46m) + Upper valance
      panelGrp.add(makeQuad(0.01, 0.68, matWallOuter));
      panelGrp.add(makeQuad(0.68, 1.46, matMeshScreen));
      panelGrp.add(makeQuad(1.46, DIMS.H_WALL, matWallOuter));
    } else {
      // Solid 20D Silpoly wall + upper perimeter ventilation strip (1.48..1.60m shielded by 20cm eave!)
      panelGrp.add(makeQuad(0.01, 1.48, matWallOuter));
      panelGrp.add(makeQuad(1.48, DIMS.H_WALL, matMeshScreen));
    }
    wallGroup.add(panelGrp);
    wallPanels.push(panelGrp);
  }

  // ---------------------------------------------------------------------------
  // 5. INTERIOR LIVING LAYOUT (2x R-5.2 AIR MATS + 1.75m HUMAN SCALE FIGURES)
  // ---------------------------------------------------------------------------
  const interiorGroup = new THREE.Group();
  root.add(interiorGroup);

  const sleepMats = [];
  const matOffsets = [
    { x: -1.18, z: -0.52, ry: 0.0 },
    { x: -1.18, z: +0.52, ry: 0.0 },
  ];
  for (const cfg of matOffsets) {
    const mg = new THREE.Group();
    // 1.95m (X) x 0.65m (Z) x 0.075m (Y) R-5.2 baffled insulated sleeping mat (39 cm clean aisle between mats!)
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.075, 0.65), matSleepMat);
    body.position.y = 0.052;
    body.castShadow = true;
    body.receiveShadow = true;
    addCadEdges(body, 25, 0x0f172a, 0.18);
    // Subtle pillow contour at outer end
    const pillow = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.072, 0.46), matRoofOuter);
    pillow.position.set(-0.74, 0.115, 0);
    mg.add(body, pillow);
    mg.position.set(cfg.x, 0, cfg.z);
    mg.rotation.y = cfg.ry;
    interiorGroup.add(mg);
    sleepMats.push(mg);
  }

  // Human scale silhouettes: 1 standing (1.75 m tall!) + 1 resting on sleeping mat
  const humanScaleGroup = new THREE.Group();
  const humanStanding = createHumanFigure(matHuman, false);
  humanStanding.position.set(0.95, 0.012, 0.55);
  humanStanding.rotation.y = -0.6;
  const humanSleeping = createHumanFigure(matHuman, true);
  humanSleeping.position.set(-1.18, 0.025, -0.52);
  humanSleeping.rotation.y = -Math.PI / 2; // align head with pillow at -X end!
  humanScaleGroup.add(humanStanding, humanSleeping);
  interiorGroup.add(humanScaleGroup);

  // ---------------------------------------------------------------------------
  // 6. OPENFOAM 3D CFD WIND STREAMLINES & SURFACE Cp + CALCULIX FEA HEATMAP LAYER
  // ---------------------------------------------------------------------------
  const physicsGroup = new THREE.Group();
  physicsGroup.visible = false;
  root.add(physicsGroup);

  const cfdWallCp = simPhysicsData?.cfd?.wall_Cp_12 || [-0.26, -0.26, -0.25, -0.52, -0.60, 0.41, 0.87, 0.41, -0.60, -0.52, -0.25, -0.26];
  const cfdRoofCp = simPhysicsData?.cfd?.roof_Cp_12 || [-0.38, -0.51, -0.77, -0.92, -0.88, -0.55, -0.38, -0.55, -0.88, -0.92, -0.77, -0.51];
  const feaStrutVm = simPhysicsData?.fea?.strut_von_mises_MPa_12 || [10, 10, 11, 13, 14, 15, 16.2, 15, 14, 13, 11, 10];

  // Cp-colored overlay roof & wall surfaces (map Cp in [-1.0, +0.9] -> [0, 1])
  const roofCpColors = cfdRoofCp.map((cp) => scientificColor((cp + 1.0) / 1.9));
  const roofHeatGeo = buildRegular12RoofGeo(DIMS.R_EAVE + 0.008, yEave + 0.008, DIMS.H_APEX + 0.012, roofCpColors);
  const roofHeatMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
    depthWrite: false,
    clippingPlanes: clipList,
  });
  physicsGroup.add(new THREE.Mesh(roofHeatGeo, roofHeatMat));

  // Wall Cp heatmap overlay
  const wallHeatPos = [];
  const wallHeatCol = [];
  for (let k = 0; k < DIMS.N; k++) {
    const a0 = (2 * Math.PI * k) / DIMS.N;
    const a1 = (2 * Math.PI * ((k + 1) % DIMS.N)) / DIMS.N;
    const rH = DIMS.R + 0.012;
    const x0 = rH * Math.cos(a0), z0 = rH * Math.sin(a0);
    const x1 = rH * Math.cos(a1), z1 = rH * Math.sin(a1);
    wallHeatPos.push(x0, 0.02, z0, x1, 0.02, z1, x1, DIMS.H_WALL, z1);
    wallHeatPos.push(x0, 0.02, z0, x1, DIMS.H_WALL, z1, x0, DIMS.H_WALL, z0);
    const col = scientificColor((cfdWallCp[k] + 1.0) / 1.9);
    for (let v = 0; v < 6; v++) wallHeatCol.push(col.r, col.g, col.b);
  }
  const whGeo = new THREE.BufferGeometry();
  whGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallHeatPos, 3));
  whGeo.setAttribute('color', new THREE.Float32BufferAttribute(wallHeatCol, 3));
  physicsGroup.add(new THREE.Mesh(whGeo, roofHeatMat));

  // 3D Aerodynamic Streamlines flowing along +X over & around the D12-500 pavilion
  const streamlines = [];
  const streamParticles = [];
  const particleGeo = new THREE.SphereGeometry(0.045, 8, 8);
  const particleMat = new THREE.MeshBasicMaterial({ color: 0x0284c7 });

  const zLanes = [-2.6, -1.6, -0.7, 0.0, 0.7, 1.6, 2.6];
  const yLanes = [0.65, 1.55, 2.45];
  for (const zl of zLanes) {
    for (const yl of yLanes) {
      if (Math.abs(zl) > 1.8 && yl > 1.8) continue;
      const pts = [];
      for (let i = 0; i <= 36; i++) {
        const x = -5.2 + (i / 36) * 10.8;
        const rHoriz = Math.hypot(x, zl);
        // Smooth potential-like deflection around cylinder + conical roof
        let y = yl;
        let z = zl;
        if (rHoriz < 3.6) {
          const influence = Math.exp(-Math.pow(rHoriz / 2.35, 2));
          // Vertical rise over conical roof
          const roofH = Math.max(0, DIMS.H_APEX - (rHoriz / DIMS.R) * (DIMS.H_APEX - DIMS.H_WALL));
          if (Math.abs(zl) < 2.2) {
            y = Math.max(yl, roofH * influence + 0.35 * influence + yl * (1 - 0.35 * influence));
          }
          // Lateral wrap-around
          if (Math.abs(zl) > 0.05) {
            z = zl + Math.sign(zl) * 0.85 * influence * (1.0 - yl / 3.2);
          }
        }
        pts.push(new THREE.Vector3(x, Math.max(0.18, y), z));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const lineGeo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
      const lineMat = new THREE.LineBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.32 });
      const line = new THREE.Line(lineGeo, lineMat);
      physicsGroup.add(line);
      streamlines.push(curve);

      const pMesh = new THREE.Mesh(particleGeo, particleMat);
      physicsGroup.add(pMesh);
      streamParticles.push({ mesh: pMesh, curve, u: Math.random() });
    }
  }

  // ---------------------------------------------------------------------------
  // STATE & KINEMATIC UPDATE ENGINE (t in [0..1])
  // ---------------------------------------------------------------------------
  const state = {
    t: 1.0,
    xray: false,
    section: false,
    explode: false,
    physics: false,
    scale: true,
    explodeFactor: 0.0,
    targetExplode: 0.0,
  };

  function applyKinematics() {
    const t = state.t;
    const ex = state.explodeFactor; // 0..1 exploded CAD vertical offset

    // Phase 1 [0.00..0.22]: Clamshell case tilts down & unfolds 180 deg flat on ground (960 x 520 x 80 mm)
    const pCase = phase(t, 0.00, 0.22);
    // At t=0: case stands upright vertically (520 L along X, 480 H along Y, 160 W along Z).
    // As pCase -> 1: Half A swings -90 deg around X to lie flat on Z in [-0.48, 0], Half B swings +90 deg to Z in [0, +0.48]!
    hingePivotA.rotation.x = -pCase * (Math.PI / 2);
    hingePivotB.rotation.x = +pCase * (Math.PI / 2);
    // Elevate case cleanly above floorMesh (y=0.010) when unfolded flat so bottom rests at y=0.014 without clipping
    caseAssembly.position.y = pCase * (halfDepth + 0.014) - ex * 0.45;

    // Internal packed bundles smoothly shrink/hide as components unpack & erect
    const unpackFade = 1.0 - phase(t, 0.16, 0.34);
    packedContentsGroup.visible = unpackFade > 0.02;
    packedBayBGroup.visible = unpackFade > 0.02;
    packedContentsGroup.scale.setScalar(Math.max(0.001, unpackFade));
    packedBayBGroup.scale.setScalar(Math.max(0.001, unpackFade));

    // Phase 2 [0.18..0.44]: Bathtub floor unfurls & Central 3-tier CFRP Mast telescopes to 2.90 m
    const pFloor = phase(t, 0.18, 0.42);
    const pMast = phase(t, 0.22, 0.48);

    floorGroup.visible = pFloor > 0.01;
    floorGroup.scale.set(Math.max(0.01, pFloor), Math.max(0.01, pFloor), Math.max(0.01, pFloor));
    floorGroup.position.y = -ex * 0.15;

    mastGroup.visible = pMast > 0.01;
    mastGroup.position.y = ex * 0.35;
    const hNow = Math.max(0.15, pMast * DIMS.H_APEX);
    // 3 telescoping tiers smoothly extend from base
    const hLow = Math.min(1.25, hNow);
    const hMid = Math.max(0.01, Math.min(0.85, hNow - 1.22));
    const hUp  = Math.max(0.01, Math.min(0.85, hNow - 2.05));
    mastTierLow.scale.set(1, hLow / 1.25, 1);
    mastTierLow.position.y = hLow / 2;
    mastTierMid.scale.set(1, hMid / 0.85, 1);
    mastTierMid.position.y = Math.max(hLow * 0.5, hLow + hMid / 2 - 0.03);
    mastTierUp.scale.set(1, hUp / 0.85, 1);
    mastTierUp.position.y = Math.max(hLow * 0.5, hNow - hUp / 2);
    collar1.position.y = Math.min(1.25, hNow * 0.45);
    collar2.position.y = Math.min(2.08, hNow * 0.72);
    apexHubGroup.position.y = hNow + ex * 0.85;

    // 4-way Diamond Spreader unfolds smoothly once mast passes 1.45 m
    const pSpread = phase(t, 0.38, 0.56);
    spreaderGroup.visible = pSpread > 0.02;
    spreaderGroup.position.y = Math.min(DIMS.H_SPREADER, hNow * 0.5);
    const spreadRad = DIMS.R_SPREADER * pSpread;
    spreaderArms.forEach((piv) => piv.scale.set(Math.max(0.01, pSpread), 1, 1));

    // Update 8 diamond shrouds (apex -> 4 spreader tips -> base)
    const pApexV = new THREE.Vector3(0, hNow, 0);
    const pBaseV = new THREE.Vector3(0, 0.06, 0);
    for (let m = 0; m < 4; m++) {
      const ang = m * Math.PI / 2;
      const tipV = new THREE.Vector3(spreadRad * Math.cos(ang), spreaderGroup.position.y, spreadRad * Math.sin(ang));
      shroudMeshes[m * 2].visible = pSpread > 0.05;
      shroudMeshes[m * 2 + 1].visible = pSpread > 0.05;
      if (pSpread > 0.05) {
        updateCylinderBetween(shroudMeshes[m * 2], pApexV, tipV);
        updateCylinderBetween(shroudMeshes[m * 2 + 1], pBaseV, tipV);
      }
    }

    // Phase 3 [0.40..0.68]: 12 Perimeter Struts move radially out to R = 2.50 m & rise to 1.60 m
    const pStrutRad = phase(t, 0.38, 0.58);
    const pStrutH = phase(t, 0.46, 0.68);
    const pGuy = phase(t, 0.58, 0.82);

    skeletonGroup.visible = pStrutRad > 0.01;
    const rCur = 0.20 + (DIMS.R - 0.20) * pStrutRad;
    const hStrutCur = Math.max(0.05, DIMS.H_WALL * pStrutH);
    const hMidCur = hStrutCur * 0.5;
    const rAnchCur = rCur + (DIMS.R_ANCHOR - DIMS.R) * pGuy;
    const apexWorld = new THREE.Vector3(0, hNow + ex * 0.35, 0);

    for (let k = 0; k < DIMS.N; k++) {
      const ang = (2 * Math.PI * k) / DIMS.N;
      const angNext = (2 * Math.PI * ((k + 1) % DIMS.N)) / DIMS.N;
      const sx = rCur * Math.cos(ang), sz = rCur * Math.sin(ang);
      const nx = rCur * Math.cos(angNext), nz = rCur * Math.sin(angNext);
      const ax = rAnchCur * Math.cos(ang), az = rAnchCur * Math.sin(ang);
      const rMidAnchCur = rCur + (3.30 - DIMS.R) * pGuy;
      const mx = rMidAnchCur * Math.cos(ang), mz = rMidAnchCur * Math.sin(ang);

      const sg = strutMeshes[k];
      sg.position.set(sx, ex * 0.20, sz);
      sg.scale.set(1, hStrutCur / DIMS.H_WALL, 1);

      const pTop = new THREE.Vector3(sx, hStrutCur + ex * 0.20, sz);
      const pMid = new THREE.Vector3(sx, hMidCur + ex * 0.20, sz);
      const pTopNext = new THREE.Vector3(nx, hStrutCur + ex * 0.20, nz);
      const pMidNext = new THREE.Vector3(nx, hMidCur + ex * 0.20, nz);
      const pAnchOuter = new THREE.Vector3(ax, 0.06, az);
      const pAnchInner = new THREE.Vector3(mx, 0.06, mz);

      // Radial Ridge Tendon
      ridgeCableMeshes[k].visible = pStrutH > 0.08;
      if (ridgeCableMeshes[k].visible) updateCylinderBetween(ridgeCableMeshes[k], apexWorld, pTop);

      // Perimeter Dual Tension Rings (top eave + mid-height 0.80 m!)
      ringTopMeshes[k].visible = pStrutH > 0.20;
      ringMidMeshes[k].visible = pStrutH > 0.20;
      if (ringTopMeshes[k].visible) {
        updateCylinderBetween(ringTopMeshes[k], pTop, pTopNext);
        updateCylinderBetween(ringMidMeshes[k], pMid, pMidNext);
      }

      // Dual Concentric Independent 45-deg Guylines & 24 Double-Helical Screw Anchors
      guyTopMeshes[k].visible = pGuy > 0.05;
      guyMidMeshes[k].visible = pGuy > 0.05;
      stakePairGroups[k].outer.visible = pGuy > 0.15;
      stakePairGroups[k].inner.visible = pGuy > 0.15;
      if (pGuy > 0.05) {
        updateCylinderBetween(guyTopMeshes[k], pTop, pAnchOuter);
        updateCylinderBetween(guyMidMeshes[k], pMid, pAnchInner);
        stakePairGroups[k].outer.position.set(ax, 0, az);
        stakePairGroups[k].outer.rotation.y = -ang;
        stakePairGroups[k].inner.position.set(mx, 0, mz);
        stakePairGroups[k].inner.rotation.y = -ang;
      }

      // Floor corner Ti stakes
      floorStakeMeshes[k].visible = pFloor > 0.5;
      floorStakeMeshes[k].position.set((DIMS.R + 0.06) * Math.cos(ang), 0.02, (DIMS.R + 0.06) * Math.sin(ang));
    }

    // Phase 4 [0.58..0.88]: Roof Fly, Low-E Liner, and 12 Vertical Walls deploy & tension cleanly
    const pMembrane = phase(t, 0.56, 0.86);
    roofGroup.visible = pMembrane > 0.02;
    linerGroup.visible = pMembrane > 0.05;
    wallGroup.visible = pMembrane > 0.12;

    if (pMembrane > 0.02) {
      const mScaleXZ = 0.25 + 0.75 * pMembrane;
      const mScaleY = 0.20 + 0.80 * pMembrane;
      roofGroup.scale.set(mScaleXZ, mScaleY, mScaleXZ);
      roofGroup.position.y = (1 - pMembrane) * 0.4 + ex * 1.15;

      linerGroup.scale.set(mScaleXZ, mScaleY, mScaleXZ);
      linerGroup.position.y = (1 - pMembrane) * 0.3 + ex * 0.70;

      wallGroup.scale.set(mScaleXZ, Math.max(0.02, phase(t, 0.62, 0.88)), mScaleXZ);
      wallGroup.position.y = ex * 0.35;
    }

    // Phase 5 [0.82..1.00]: 2x R-5.2 Air Mats inflate + Human Scale figures appear
    const pInterior = phase(t, 0.82, 1.00);
    interiorGroup.visible = pInterior > 0.02;
    sleepMats.forEach((mg) => {
      mg.scale.set(0.3 + 0.7 * pInterior, 0.15 + 0.85 * pInterior, 0.3 + 0.7 * pInterior);
      mg.position.y = -ex * 0.05;
    });
    humanScaleGroup.visible = state.scale && pInterior > 0.5;
    humanScaleGroup.scale.setScalar(Math.max(0.01, phase(t, 0.86, 1.00)));

    // Footprint hairline & Physics overlay only when deployed
    footprintRing.visible = t > 0.55;
    physicsGroup.visible = state.physics && t > 0.92;
  }

  function applyVisualModes() {
    // Section clipping plane
    clipList.length = 0;
    if (state.section) {
      clipList.push(sectionPlane);
      renderer.localClippingEnabled = true;
    } else {
      renderer.localClippingEnabled = false;
    }

    // X-Ray transparency on outer membrane AND clamshell backing plates so concentric internal packing & frame shine
    if (state.xray) {
      matRoofOuter.opacity = 0.16;
      matWallOuter.opacity = 0.14;
      matLiner.opacity = 0.22;
      matCaseBack.opacity = 0.16;
      matRoofOuter.depthWrite = false;
      matWallOuter.depthWrite = false;
      matCaseBack.depthWrite = false;
    } else if (state.physics) {
      matRoofOuter.opacity = 0.38;
      matWallOuter.opacity = 0.35;
      matLiner.opacity = 0.20;
      matCaseBack.opacity = 1.0;
      matRoofOuter.depthWrite = true;
      matWallOuter.depthWrite = true;
      matCaseBack.depthWrite = true;
    } else {
      matRoofOuter.opacity = 0.96;
      matWallOuter.opacity = 0.95;
      matLiner.opacity = 0.88;
      matCaseBack.opacity = 1.0;
      matRoofOuter.depthWrite = true;
      matWallOuter.depthWrite = true;
      matCaseBack.depthWrite = true;
    }

    // CalculiX FEA stress coloring on 12 perimeter struts when physics mode is active
    for (let k = 0; k < DIMS.N; k++) {
      if (state.physics) {
        const vm = feaStrutVm[k] || 12.0;
        // Scale 0..20 MPa for clear structural stress gradient visualization
        const col = scientificColor(vm / 18.0);
        strutMats[k].map = null;
        strutMats[k].color.copy(col);
        strutMats[k].needsUpdate = true;
      } else {
        strutMats[k].map = carbonTex;
        strutMats[k].color.setHex(0xffffff);
        strutMats[k].needsUpdate = true;
      }
    }

    applyKinematics();
  }

  // Initial state: fully deployed (t = 1.0)
  applyVisualModes();

  return {
    root,
    getState: () => ({ ...state }),
    setDeploy(tVal) {
      state.t = clamp01(tVal);
      applyKinematics();
    },
    setXray(flag) {
      state.xray = Boolean(flag);
      applyVisualModes();
    },
    setSection(flag) {
      state.section = Boolean(flag);
      applyVisualModes();
    },
    setExplode(flag) {
      state.explode = Boolean(flag);
      state.targetExplode = state.explode ? 1.0 : 0.0;
    },
    setPhysicsMode(flag) {
      state.physics = Boolean(flag);
      applyVisualModes();
    },
    setScaleVisible(flag) {
      state.scale = Boolean(flag);
      applyKinematics();
    },
    tick(dt) {
      // Smooth spring transition for Exploded View
      if (Math.abs(state.explodeFactor - state.targetExplode) > 0.001) {
        state.explodeFactor += (state.targetExplode - state.explodeFactor) * Math.min(1, dt * 6.5);
        applyKinematics();
      }
      // Animate OpenFOAM aerodynamic particles along 3D streamlines
      if (physicsGroup.visible) {
        for (const sp of streamParticles) {
          sp.u = (sp.u + dt * 0.28) % 1.0;
          sp.curve.getPointAt(sp.u, sp.mesh.position);
        }
      }
    },
  };
}
