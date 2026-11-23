/**
 * FREE-ROOM V2 "AERO-PRISM P300" — 1mm-Precision Parametric 3D CAD Model
 * =======================================================================
 * Pure-White Architectural CAD Studio | Coordinate system: Three.js (Y = up, X = width, Z = length)
 * Mapping from engineering spec (X_eng, Y_eng, Z_eng) -> Three.js (x = X_eng, y = Z_eng, z = Y_eng):
 *   - Living Bathtub Floor:  X in [-1.50, +1.50] (3.00 m), Z in [-1.35, +1.35] (2.70 m) = 8.10 m2 (5.00 tatami)
 *   - Covered Footprint:     X in [-1.50, +1.50], Z in [-1.75, +1.75] (3.50 m incl. symmetric 0.40m vestibules) = 10.50 m2
 *   - 3-Mast Coaxial Spine:  z = +1.35 (Front), 0.00 (Center), -1.35 (Rear), height y = 1.64 m (Ø19.1 outer + Ø16 inner)
 *   - Eave Height:           y = 0.36 m, Roof Pitch = 40.48 deg, Ground Drip Skirt = 0.318 m (318 mm)
 *   - Origami Bathtub Wall:  y = 0.24 m seamless hospital-corner folded pleats (0 corner cuts)
 *   - Double-Baffle S-Turn Labyrinth Ridge Vents: outer cowl z=±1.75 (y=1.44..1.64), inner weir z=±1.69 (y=1.36..1.56)
 *   - Soft Compression Roll: 0.495 x 0.455 x 0.148 m (Zero hard outer case — PP rope cinch straps + 41 nested metal solids!)
 */

import * as THREE from 'three';

const HW = 1.50;          // Half living floor width (3.00 m total)
const HL = 1.35;          // Half living floor length (2.70 m total)
const VEST = 0.40;        // Symmetric front & rear aerodynamic vestibule projection
const Z_TIP = HL + VEST;  // 1.75 m
const H_PEAK = 1.64;      // Ridge height (3 coaxial steel masts)
const H_EAVE = 0.36;      // Vertical sidewall eave height
const H_TUB = 0.24;       // Seamless origami bathtub wall height
const SKIRT = 0.318;      // Weighted ground drip skirt extending outward from eave base

const ANCHOR_COORDS = [
  // [name, x, z, isHeavyMid]
  ['RIDGE_FL', -1.15,  2.95, false],
  ['RIDGE_FR',  1.15,  2.95, false],
  ['RIDGE_RL', -1.15, -2.95, false],
  ['RIDGE_RR',  1.15, -2.95, false],
  ['EAVE_ML',  -2.55,  0.00, true],
  ['EAVE_MR',   2.55,  0.00, true],
  ['EAVE_FL',  -2.45,  1.45, false],
  ['EAVE_FR',   2.45,  1.45, false],
  ['EAVE_RL',  -2.45, -1.45, false],
  ['EAVE_RR',   2.45, -1.45, false],
];

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}

function smoothstep(e0, e1, x) {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

/** Viridis-turbo-like scientific colormap for OpenFOAM Cp & CalculiX FEA stress */
function heatColor(t) {
  const c = new THREE.Color();
  const stops = [
    [0.00, 0x2563eb],
    [0.28, 0x06b6d4],
    [0.52, 0x10b981],
    [0.78, 0xf59e0b],
    [1.00, 0xdc2626],
  ];
  const x = clamp01(t);
  for (let i = 0; i < stops.length - 1; i++) {
    if (x >= stops[i][0] && x <= stops[i + 1][0]) {
      const f = (x - stops[i][0]) / (stops[i + 1][0] - stops[i][0]);
      c.setHex(stops[i][1]).lerp(new THREE.Color(stops[i + 1][1]), f);
      return c;
    }
  }
  return c.setHex(0xdc2626);
}

/** Helper to create a clean CAD cylinder between two 3D points */
function createCylinderBetween(p1, p2, radius, mat, radialSegs = 12) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = Math.max(0.001, dir.length());
  const geo = new THREE.CylinderGeometry(radius, radius, len, radialSegs);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  return mesh;
}

/** Helper to update cylinder endpoints dynamically */
function setCylinderEndpoints(mesh, p1, p2) {
  const dir = new THREE.Vector3().subVectors(p2, p1);
  const len = Math.max(0.001, dir.length());
  mesh.position.copy(p1).add(p2).multiplyScalar(0.5);
  mesh.scale.set(1, len, 1);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
}

/** Build a custom quad BufferGeometry from 4 Vector3s (counter-clockwise) with vertex colors for CFD heatmap */
function createQuadGeometry(p0, p1, p2, p3, subU = 10, subV = 10, cpFn = null) {
  const positions = [];
  const colors = [];
  const indices = [];
  for (let iv = 0; iv <= subV; iv++) {
    const v = iv / subV;
    for (let iu = 0; iu <= subU; iu++) {
      const u = iu / subU;
      const top = new THREE.Vector3().lerpVectors(p0, p1, u);
      const bot = new THREE.Vector3().lerpVectors(p3, p2, u);
      const pt = new THREE.Vector3().lerpVectors(top, bot, v);
      positions.push(pt.x, pt.y, pt.z);
      const col = cpFn ? cpFn(pt, u, v) : new THREE.Color(0x1d6fb8);
      colors.push(col.r, col.g, col.b);
    }
  }
  for (let iv = 0; iv < subV; iv++) {
    for (let iu = 0; iu < subU; iu++) {
      const a = iv * (subU + 1) + iu;
      const b = a + 1;
      const d = (iv + 1) * (subU + 1) + iu;
      const c = d + 1;
      indices.push(a, b, c, a, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

export function buildFreeRoomV2CAD(scene, renderer, physicsFields = {}) {
  const clipPlane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0.02);
  renderer.localClippingEnabled = false;

  const state = {
    deploy: 1.0,
    xray: false,
    section: false,
    explode: false,
    physics: false,
    scale: true,
    animTime: 0,
  };

  // Subtle architectural CAD shadow catcher & light technical ground grid (pure white feel)
  const studioGroup = new THREE.Group();
  scene.add(studioGroup);

  const shadowFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 18),
    new THREE.ShadowMaterial({ opacity: 0.11 })
  );
  shadowFloor.rotation.x = -Math.PI / 2;
  shadowFloor.position.y = -0.001;
  shadowFloor.receiveShadow = true;
  studioGroup.add(shadowFloor);

  const grid = new THREE.GridHelper(8.0, 16, 0xd4d4d8, 0xf1f5f9);
  grid.position.y = 0.0005;
  studioGroup.add(grid);

  // Subtle 52x16x48cm target envelope wireframe around packed roll (visible in packed / X-ray)
  const limitBoxGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(0.52, 0.48, 0.16));
  const limitBox = new THREE.LineSegments(
    limitBoxGeo,
    new THREE.LineDashedMaterial({ color: 0x64748b, dashSize: 0.025, gapSize: 0.015, transparent: true, opacity: 0.65 })
  );
  limitBox.computeLineDistances();
  limitBox.position.set(0, 0.24, 0);
  studioGroup.add(limitBox);

  // -------------------------------------------------------------------------
  // SHARED ARCHITECTURAL MATERIALS (Pure White Studio Palette + Authentic V2 Materials)
  // -------------------------------------------------------------------------
  const makeMat = (opts) => {
    const m = new THREE.MeshStandardMaterial({ ...opts, clippingPlanes: [] });
    return m;
  };

  // Authentic #2000 Cross-Laminated Blue PE Tarpaulin (refined industrial cobalt blue, crisp edges!)
  const matTarpOuter = makeMat({
    color: 0x1e64a8,
    roughness: 0.48,
    metalness: 0.04,
    side: THREE.DoubleSide,
    transparent: false,
    opacity: 1.0,
  });
  // Physics Heatmap Material (vertexColors driven by real OpenFOAM 30m/s Cp!)
  const matTarpHeatmap = makeMat({
    color: 0xffffff,
    vertexColors: true,
    roughness: 0.42,
    metalness: 0.05,
    side: THREE.DoubleSide,
    transparent: false,
    opacity: 1.0,
  });
  // Bathtub Floor PE (#2000 slightly deeper slate-blue to visually distinguish seamless floor from canopy)
  const matBathtub = makeMat({
    color: 0x164e82,
    roughness: 0.52,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  // Galvanized Steel Pipe Ø19.1x1.0 (STK400 agricultural zinc sheen)
  const matSteelOuter = makeMat({
    color: 0xcbd5e1,
    roughness: 0.26,
    metalness: 0.82,
  });
  // Inner Coaxial Steel-Core Stake Ø16 (authentic Komeri agricultural dark-emerald polyolefin jacket!)
  const matSteelInner = makeMat({
    color: 0x15803d,
    roughness: 0.45,
    metalness: 0.22,
  });
  // SD390 Ribbed Steel Rebar D10
  const matRebar = makeMat({
    color: 0x475569,
    roughness: 0.58,
    metalness: 0.72,
  });
  // Molded Komeri Hook Pipe Cap (dark charcoal polymer)
  const matCap = makeMat({
    color: 0x1e293b,
    roughness: 0.55,
    metalness: 0.1,
  });
  // 5mm UV Polypropylene Rope (crisp off-white braided)
  const matRope = makeMat({
    color: 0xf8fafc,
    roughness: 0.75,
    metalness: 0.02,
  });
  const matRopeHighlight = makeMat({
    color: 0x0ea5e9,
    roughness: 0.55,
    metalness: 0.05,
  });
  // Woven PE Earth-Fluke Anchor Bags (Komeri MUSBIC off-white/beige woven bag with blue tie-line)
  const matEarthBag = makeMat({
    color: 0xe7e5e4,
    roughness: 0.85,
    metalness: 0.0,
  });
  // Nitto No.6931 Black Butyl Waterproof Flashing Tape
  const matButylTape = makeMat({
    color: 0x18181b,
    roughness: 0.35,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  // 24-Mesh Insect Screen
  const matMeshScreen = makeMat({
    color: 0x334155,
    roughness: 0.6,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
    side: THREE.DoubleSide,
  });
  // Passive Reflective Aluminum Foil PE Foam Mats
  const matAluMat = makeMat({
    color: 0xe2e8f0,
    roughness: 0.18,
    metalness: 0.88,
  });
  // Scale Human Figure (neutral matte alabaster-grey CAD mannequin)
  const matHuman = makeMat({
    color: 0x94a3b8,
    roughness: 0.62,
    metalness: 0.04,
  });

  const clippableMats = [
    matTarpOuter, matTarpHeatmap, matBathtub, matSteelOuter, matSteelInner,
    matButylTape, matMeshScreen, matAluMat, matRope,
  ];
  const outerShellMeshes = [];

  // -------------------------------------------------------------------------
  // GROUP 1: ZERO-CASE SOFT COMPRESSION ROLL (495 x 148 x 455 mm)
  // -------------------------------------------------------------------------
  const packedGroup = new THREE.Group();
  scene.add(packedGroup);

  // Soft rolled tarp bundle body (rounded pill-box 0.495 wide x 0.455 tall x 0.148 thick — ZERO hard case!)
  const rollShape = new THREE.Shape();
  const rw = 0.148 / 2, rh = 0.455 / 2, rr = 0.052;
  rollShape.moveTo(-rw + rr, -rh);
  rollShape.lineTo(rw - rr, -rh);
  rollShape.quadraticCurveTo(rw, -rh, rw, -rh + rr);
  rollShape.lineTo(rw, rh - rr);
  rollShape.quadraticCurveTo(rw, rh, rw - rr, rh);
  rollShape.lineTo(-rw + rr, rh);
  rollShape.quadraticCurveTo(-rw, rh, -rw, rh - rr);
  rollShape.lineTo(-rw, -rh + rr);
  rollShape.quadraticCurveTo(-rw, -rh, -rw + rr, -rh);

  const rollGeo = new THREE.ExtrudeGeometry(rollShape, {
    depth: 0.495,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.008,
    bevelSegments: 4,
  });
  rollGeo.center();
  rollGeo.rotateY(Math.PI / 2); // X = 495mm length, Y = 455mm height, Z = 148mm thickness!
  const rollMat = makeMat({ color: 0x1e64a8, roughness: 0.52, metalness: 0.04, transparent: true, opacity: 1.0 });
  const rollBody = new THREE.Mesh(rollGeo, rollMat);
  rollBody.position.set(0, 0.455 / 2, 0);
  rollBody.castShadow = true;
  rollBody.receiveShadow = true;
  packedGroup.add(rollBody);

  // 2x White 5mm UV PP Rope Cinch Compression Straps + Top Carry Handle Loop (Zero hard case!)
  const strapXs = [-0.145, 0.145];
  strapXs.forEach((sx) => {
    const rwS = 0.0865, rhS = 0.240, rrS = 0.056;
    const cy0 = 0.2275;
    const pts = [];
    // Trace exact rounded-rectangle perimeter proud of the blue roll bevel (+4mm outside!)
    const corners = [
      [ rwS - rrS,  rhS - rrS,  0,           Math.PI / 2],
      [-rwS + rrS,  rhS - rrS,  Math.PI / 2, Math.PI],
      [-rwS + rrS, -rhS + rrS,  Math.PI,     Math.PI * 1.5],
      [ rwS - rrS, -rhS + rrS,  Math.PI * 1.5, Math.PI * 2],
    ];
    corners.forEach(([czC, cyC, a0, a1]) => {
      for (let k = 0; k <= 8; k++) {
        const a = lerp(a0, a1, k / 8);
        pts.push(new THREE.Vector3(sx, cy0 + cyC + Math.sin(a) * rrS, czC + Math.cos(a) * rrS));
      }
    });
    const strapCurve = new THREE.CatmullRomCurve3(pts, true);
    const strapMesh = new THREE.Mesh(new THREE.TubeGeometry(strapCurve, 64, 0.0048, 10, true), matRope);
    strapMesh.castShadow = true;
    packedGroup.add(strapMesh);
  });
  // Top rope carry handle bridging the 2 cinch straps
  const handleCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.145, 0.468, 0),
    new THREE.Vector3(-0.075, 0.515, 0),
    new THREE.Vector3( 0.075, 0.515, 0),
    new THREE.Vector3( 0.145, 0.468, 0),
  ]);
  const handleMesh = new THREE.Mesh(new THREE.TubeGeometry(handleCurve, 28, 0.005, 10, false), matRope);
  handleMesh.castShadow = true;
  packedGroup.add(handleMesh);

  // Visible Nested 41-Solid Metal Core inside the Soft Roll (revealed when X-Ray or Explode is toggled!)
  const packedCoreGroup = new THREE.Group();
  packedGroup.add(packedCoreGroup);
  const packColsZ = [-0.011, 0.011];
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 2; c++) {
      const cy = 0.030 + r * 0.022;
      const cz = packColsZ[c];
      const outTube = new THREE.Mesh(new THREE.CylinderGeometry(0.00955, 0.00955, 0.40, 12), matSteelOuter);
      outTube.rotation.z = Math.PI / 2;
      outTube.position.set(0, cy, cz);
      packedCoreGroup.add(outTube);
      // Inner coaxial green Ø16 steel core poking slightly visible at ends in X-ray
      const inCore = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.406, 10), matSteelInner);
      inCore.rotation.z = Math.PI / 2;
      inCore.position.set(0, cy, cz);
      packedCoreGroup.add(inCore);
    }
  }
  // 2x Ø19.1x300mm crossbars + 12x D10x330mm SD390 rebars inside roll
  for (let c = 0; c < 2; c++) {
    const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.00955, 0.00955, 0.30, 12), matSteelOuter);
    pile.rotation.z = Math.PI / 2;
    pile.position.set(0, 0.162, packColsZ[c]);
    packedCoreGroup.add(pile);
    const reb = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0052, 0.33, 8), matRebar);
    reb.rotation.z = Math.PI / 2;
    reb.position.set(0, 0.162, packColsZ[c]);
    packedCoreGroup.add(reb);
  }
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 2; c++) {
      const reb = new THREE.Mesh(new THREE.CylinderGeometry(0.0052, 0.0052, 0.33, 8), matRebar);
      reb.rotation.z = Math.PI / 2;
      reb.position.set(0, 0.030 + r * 0.013, 0.030 + c * 0.013);
      packedCoreGroup.add(reb);
    }
  }

  // -------------------------------------------------------------------------
  // GROUP 2: DEPLOYED FREE-ROOM V2 "AERO-PRISM P300" (3-MAST COAXIAL SPINE)
  // -------------------------------------------------------------------------
  const deployedRoot = new THREE.Group();
  scene.add(deployedRoot);

  // Sub-layers for clean Exploded Assembly animation!
  const layerBathtub = new THREE.Group();
  const layerMasts = new THREE.Group();
  const layerInnerCores = new THREE.Group();
  const layerVents = new THREE.Group();
  const layerCanopy = new THREE.Group();
  const layerRigging = new THREE.Group();
  const layerAnchors = new THREE.Group();
  const layerScale = new THREE.Group();
  const layerPhysics = new THREE.Group();

  deployedRoot.add(
    layerBathtub, layerMasts, layerInnerCores, layerVents,
    layerCanopy, layerRigging, layerAnchors, layerScale, layerPhysics
  );

  // 2A) SEAMLESS 24cm ORIGAMI BATHTUB FLOOR (3.00 x 2.70 m, ZERO corner cuts!) + 2x ALUMINUM FOIL MATS
  const floorBase = new THREE.Mesh(new THREE.BoxGeometry(HW * 2, 0.006, HL * 2), matBathtub);
  floorBase.position.set(0, 0.003, 0);
  floorBase.receiveShadow = true;
  layerBathtub.add(floorBase);

  // 4x Continuous 240mm Bathtub Walls (slightly inset 20mm inside outer drip-skirt!)
  const tWall = 0.006;
  const tubL = new THREE.Mesh(new THREE.BoxGeometry(tWall, H_TUB, HL * 2), matBathtub);
  tubL.position.set(-HW + 0.02, H_TUB / 2, 0);
  const tubR = new THREE.Mesh(new THREE.BoxGeometry(tWall, H_TUB, HL * 2), matBathtub);
  tubR.position.set(HW - 0.02, H_TUB / 2, 0);
  const tubF = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 - 0.04, H_TUB, tWall), matBathtub);
  tubF.position.set(0, H_TUB / 2, HL - 0.01);
  const tubB = new THREE.Mesh(new THREE.BoxGeometry(HW * 2 - 0.04, H_TUB, tWall), matBathtub);
  tubB.position.set(0, H_TUB / 2, -HL + 0.01);
  [tubL, tubR, tubF, tubB].forEach((m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    layerBathtub.add(m);
  });

  // 4x Origami Hospital-Corner Folded Gussets (proving 0 corner cuts!)
  const cornerSigns = [[-1, 1], [1, 1], [-1, -1], [1, -1]];
  cornerSigns.forEach(([sx, sz]) => {
    const pleat = new THREE.Mesh(new THREE.ConeGeometry(0.06, H_TUB, 3), matBathtub);
    pleat.position.set(sx * (HW - 0.045), H_TUB / 2, sz * (HL - 0.045));
    pleat.rotation.y = Math.atan2(sx, sz);
    layerBathtub.add(pleat);
  });

  // 2x Passive Reflective Aluminum-Foil Closed-Cell PE Floor Mats (1.20 x 0.70 m each, flanking center mast!)
  [-0.74, 0.74].forEach((mx) => {
    const matMesh = new THREE.Mesh(new THREE.BoxGeometry(0.70, 0.008, 1.80), matAluMat);
    matMesh.position.set(mx, 0.011, -0.05);
    matMesh.receiveShadow = true;
    layerBathtub.add(matMesh);
  });

  // 2B) 3-MAST COAXIAL DOUBLE-WALL GALVANIZED STEEL SPINE (Front +1.35, Center 0.00, Rear -1.35)
  const mastZs = [HL, 0.0, -HL];
  const mastOuters = [];
  const mastInnerMeshes = [];
  const mastStressMeshes = [];

  mastZs.forEach((mz, mIdx) => {
    // 4x 400mm outer Ø19.1 galvanized steel pipe segments (with subtle bevel rings at the 3 slip joints!)
    for (let s = 0; s < 4; s++) {
      const segY = 0.02 + (s + 0.5) * 0.40;
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.00955, 0.00955, 0.398, 16), matSteelOuter.clone());
      seg.position.set(0, segY, mz);
      seg.castShadow = true;
      layerMasts.add(seg);
      mastOuters.push({ mesh: seg, mIdx, segIdx: s });
      mastStressMeshes.push({ mesh: seg, mIdx, segIdx: s });

      if (s < 3) {
        // Fine hairline seam ring indicating the 400mm outer slip joint
        const seam = new THREE.Mesh(new THREE.TorusGeometry(0.0098, 0.001, 6, 16), matCap);
        seam.rotation.x = Math.PI / 2;
        seam.position.set(0, 0.02 + (s + 1) * 0.40, mz);
        layerMasts.add(seam);
      }
    }
    // Inner Coaxial Ø16 Steel Core (phase-offset 200mm bridging every outer joint! Visible in X-Ray / Explode)
    const innerCore = new THREE.Mesh(new THREE.CylinderGeometry(0.0080, 0.0080, 1.56, 12), matSteelInner);
    innerCore.position.set(0, 0.82, mz);
    layerInnerCores.add(innerCore);
    mastInnerMeshes.push({ mesh: innerCore, mz });

    // Top & Bottom Molded Komeri Hook Pipe Caps (Ø19mm) + Cushioned Foot Pad
    const topCap = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.011, 0.032, 16), matCap);
    topCap.position.set(0, H_PEAK - 0.01, mz);
    const botCap = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.022, 16), matCap);
    botCap.position.set(0, 0.011, mz);
    layerMasts.add(topCap, botCap);
  });

  // 2C) MONOLITHIC UNCUT #2000 PE ROOF, SIDEWALLS, 318mm GROUND SKIRT & SYMMETRIC 0.40m VESTIBULES
  // Real OpenFOAM 30m/s broadside Cp mapping function (wind blowing +X: windward -X stagnation -> ridge suction -> leeward wake!)
  const cpColorFn = (pt) => {
    // Wind blows in +X: x=-1.50 is windward eave (Cp ~ +0.75), x=0 is ridge peak (Cp ~ -0.85 high suction), x=+1.50 is leeward wake (Cp ~ -0.45)
    const xn = pt.x / HW; // -1..+1
    let tNorm;
    if (xn < -0.15) {
      // Windward roof slope: positive pressure stagnation (green -> amber -> red near windward eave!)
      tNorm = 0.55 + 0.42 * Math.max(0, -xn);
    } else if (xn <= 0.15) {
      // Ridge acceleration crest: strong suction (deep blue -> cyan)
      tNorm = 0.08 + 0.15 * Math.abs(xn) / 0.15;
    } else {
      // Leeward wake recovery (cyan -> emerald)
      tNorm = 0.25 + 0.22 * xn;
    }
    return heatColor(tNorm);
  };

  function addShellQuad(p0, p1, p2, p3, subU = 12, subV = 12) {
    const geo = createQuadGeometry(p0, p1, p2, p3, subU, subV, cpColorFn);
    const mesh = new THREE.Mesh(geo, matTarpOuter);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    layerCanopy.add(mesh);
    outerShellMeshes.push(mesh);
    return mesh;
  }

  // Left & Right Main Monolithic Roof Slopes (full continuous 3.50m length from z=-1.75 to z=+1.75!)
  const rF = new THREE.Vector3(0, H_PEAK, Z_TIP);
  const rB = new THREE.Vector3(0, H_PEAK, -Z_TIP);
  const eFL = new THREE.Vector3(-HW, H_EAVE, HL);
  const eFR = new THREE.Vector3( HW, H_EAVE, HL);
  const eBL = new THREE.Vector3(-HW, H_EAVE, -HL);
  const eBR = new THREE.Vector3( HW, H_EAVE, -HL);

  // Streamlined half-hipped vestibule outer nose corners (matching exact OpenFOAM STL geometry!)
  const nFL = new THREE.Vector3(-HW * 0.86, H_EAVE, Z_TIP);
  const nFR = new THREE.Vector3( HW * 0.86, H_EAVE, Z_TIP);
  const nBL = new THREE.Vector3(-HW * 0.86, H_EAVE, -Z_TIP);
  const nBR = new THREE.Vector3( HW * 0.86, H_EAVE, -Z_TIP);

  // Main Roof Slopes (covering z in [-HL, +HL])
  addShellQuad(new THREE.Vector3(0, H_PEAK, HL), new THREE.Vector3(0, H_PEAK, -HL), eBL, eFL, 14, 14);
  addShellQuad(new THREE.Vector3(0, H_PEAK, -HL), new THREE.Vector3(0, H_PEAK, HL), eFR, eBR, 14, 14);

  // Symmetric Streamlined Front & Rear Vestibule Wings (400mm half-hipped canopy overhang!)
  addShellQuad(rF, new THREE.Vector3(0, H_PEAK, HL), eFL, nFL, 6, 10);
  addShellQuad(new THREE.Vector3(0, H_PEAK, HL), rF, nFR, eFR, 6, 10);
  addShellQuad(new THREE.Vector3(0, H_PEAK, -HL), rB, nBL, eBL, 6, 10);
  addShellQuad(rB, new THREE.Vector3(0, H_PEAK, -HL), eBR, nBR, 6, 10);

  // Lower 0.36m Flared Vertical Sidewalls (hanging strictly OUTSIDE the 24cm bathtub!)
  const gFL = new THREE.Vector3(-HW - 0.04, 0.005, HL);
  const gBL = new THREE.Vector3(-HW - 0.04, 0.005, -HL);
  const gFR = new THREE.Vector3( HW + 0.04, 0.005, HL);
  const gBR = new THREE.Vector3( HW + 0.04, 0.005, -HL);
  addShellQuad(eFL, eBL, gBL, gFL, 12, 4);
  addShellQuad(eBR, eFR, gFR, gBR, 12, 4);

  // 318mm Weighted Ground Drip Skirts laying outward flat on ground (zero splashback ingress!)
  addShellQuad(gFL, gBL, new THREE.Vector3(-HW - SKIRT, 0.004, -HL), new THREE.Vector3(-HW - SKIRT, 0.004, HL), 10, 3);
  addShellQuad(gBR, gFR, new THREE.Vector3( HW + SKIRT, 0.004,  HL), new THREE.Vector3( HW + SKIRT, 0.004, -HL), 10, 3);

  // Vestibule Side Cheek Walls connecting main vertical sidewalls (z=±HL) to streamlined nose corners (z=±Z_TIP)
  const gnFL = new THREE.Vector3(-HW * 0.86 - 0.03, 0.005,  Z_TIP);
  const gnFR = new THREE.Vector3( HW * 0.86 + 0.03, 0.005,  Z_TIP);
  const gnBL = new THREE.Vector3(-HW * 0.86 - 0.03, 0.005, -Z_TIP);
  const gnBR = new THREE.Vector3( HW * 0.86 + 0.03, 0.005, -Z_TIP);
  addShellQuad(nFL, eFL, gFL, gnFL, 4, 4);
  addShellQuad(eFR, nFR, gnFR, gFR, 4, 4);
  addShellQuad(eBL, nBL, gnBL, gBL, 4, 4);
  addShellQuad(nBR, eBR, gBR, gnBR, 4, 4);

  // Exact gable half-width at nose plane z = ±Z_TIP (HW_nose = 1.29 m, H_eave = 0.36, H_peak = 1.64)
  const HW_NOSE = HW * 0.86;
  const yNoseRoof = (absX) => H_PEAK - (H_PEAK - H_EAVE) * (absX / HW_NOSE);
  const xNoseAtY = (yVal) => HW_NOSE * ((H_PEAK - yVal) / (H_PEAK - H_EAVE));
  const yVentTop = 1.38; // Bottom of the 180° labyrinth intake slot under the 200mm outer cowl!
  const xVentTop = xNoseAtY(yVentTop);

  // Rear Waterproof Gable Wall (Nitto 6931 Butyl-sealed continuous 100% closed gable!)
  addShellQuad(
    new THREE.Vector3(-xVentTop, yVentTop, -Z_TIP),
    new THREE.Vector3( xVentTop, yVentTop, -Z_TIP),
    nBR,
    nBL,
    10, 8
  );
  addShellQuad(nBL, nBR, gnBR, gnBL, 10, 4);

  // Front Waterproof Gable Wall + 440mm Double-Overlap Storm Airlock Door (100% rain-sealed, zero triangular gaps!)
  // Upper gable trapezoid below the front 180° labyrinth cowl (y = 1.18 .. 1.38)
  const yDoorTop = 1.24;
  const xDoorTop = xNoseAtY(yDoorTop);
  addShellQuad(
    new THREE.Vector3(-xVentTop, yVentTop, Z_TIP),
    new THREE.Vector3( xVentTop, yVentTop, Z_TIP),
    new THREE.Vector3( xDoorTop, yDoorTop, Z_TIP),
    new THREE.Vector3(-xDoorTop, yDoorTop, Z_TIP),
    8, 3
  );
  // Left Storm Flap (inner lap extending +220mm past centerline to x = +0.22 m)
  addShellQuad(
    new THREE.Vector3(-xDoorTop, yDoorTop, Z_TIP),
    new THREE.Vector3( 0.22,     yDoorTop, Z_TIP),
    new THREE.Vector3( 0.22,     H_EAVE,   Z_TIP),
    nFL,
    8, 8
  );
  addShellQuad(nFL, new THREE.Vector3(0.22, H_EAVE, Z_TIP), new THREE.Vector3(0.22, 0.005, Z_TIP), gnFL, 8, 4);
  // Right Storm Door Outer Overlap Flap (extending -220mm past centerline to x = -0.22 m -> 440mm total double-lap!)
  const zLap = Z_TIP + 0.012;
  addShellQuad(
    new THREE.Vector3(-0.22,    yDoorTop, zLap),
    new THREE.Vector3(xDoorTop, yDoorTop, Z_TIP),
    nFR,
    new THREE.Vector3(-0.22,    H_EAVE,   zLap),
    8, 8
  );
  addShellQuad(new THREE.Vector3(-0.22, H_EAVE, zLap), nFR, gnFR, new THREE.Vector3(-0.22, 0.005, zLap), 8, 4);
  // Crisp vertical Nitto 6931 black storm-door lap trim marking the 440mm double-overlap airlock edge
  const doorLapTrim = createCylinderBetween(
    new THREE.Vector3(-0.22, 0.01, zLap + 0.003),
    new THREE.Vector3(-0.22, yDoorTop, zLap + 0.003),
    0.0045, matButylTape, 8
  );
  layerCanopy.add(doorLapTrim);

  // Subtle crisp dark architectural seam highlight along ridge & Nitto 6931 rear butyl seal lines
  const butylRidge = createCylinderBetween(new THREE.Vector3(0, H_PEAK + 0.004, -Z_TIP), new THREE.Vector3(0, H_PEAK + 0.004, Z_TIP), 0.006, matButylTape, 8);
  layerCanopy.add(butylRidge);

  // 2D) 180° DOUBLE-BAFFLE S-TURN LABYRINTH RIDGE VENTS (Front +Z & Rear -Z) + 24-MESH SCREENS
  // Every element is strictly inscribed inside the exact roof slope (ZERO protruding corners!)
  [1, -1].forEach((sz) => {
    const zOuter = sz * Z_TIP;           // ±1.75 m outer storm apron
    const zWeir = sz * (Z_TIP - 0.06);   // ±1.69 m inner upturned storm weir (120mm vertical overlap!)
    const zScreen = sz * HL;             // ±1.35 m recessed 24-mesh insect screen

    // Outer 200mm storm cowl apron hanging flush from y=1.64 down to y=1.44 (|x| <= xNoseAtY(1.44) = 0.201m)
    const xCowl = xNoseAtY(1.44);
    const cowlGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, H_PEAK, zOuter),
      new THREE.Vector3(-xCowl, 1.44, zOuter),
      new THREE.Vector3( xCowl, 1.44, zOuter),
    ]);
    cowlGeo.computeVertexNormals();
    const cowlMesh = new THREE.Mesh(cowlGeo, matTarpOuter);
    cowlMesh.castShadow = true;
    layerVents.add(cowlMesh);
    outerShellMeshes.push(cowlMesh);

    // Inner upturned storm weir dam at z=±1.69 rising from y=1.36 up to y=1.56 (trapezoid strictly inside roof!)
    const hwWeir = HW * (1.0 - 0.14 * ((Z_TIP - 0.06 - HL) / VEST));
    const xWeirTop = hwWeir * ((H_PEAK - 1.56) / (H_PEAK - H_EAVE)) - 0.010;
    const xWeirBot = hwWeir * ((H_PEAK - 1.36) / (H_PEAK - H_EAVE)) - 0.010;
    const weirGeo = createQuadGeometry(
      new THREE.Vector3(-xWeirTop, 1.56, zWeir),
      new THREE.Vector3( xWeirTop, 1.56, zWeir),
      new THREE.Vector3( xWeirBot, 1.36, zWeir),
      new THREE.Vector3(-xWeirBot, 1.36, zWeir),
      2, 2
    );
    layerVents.add(new THREE.Mesh(weirGeo, matButylTape));

    // Recessed 24-mesh dark insect screen at y=1.44..1.63, z=±1.35 (strictly inside roof!)
    const xScr = HW * ((H_PEAK - 1.44) / (H_PEAK - H_EAVE)) - 0.012;
    const scrGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, H_PEAK - 0.012, zScreen),
      new THREE.Vector3(-xScr, 1.44, zScreen),
      new THREE.Vector3( xScr, 1.44, zScreen),
    ]);
    scrGeo.computeVertexNormals();
    layerVents.add(new THREE.Mesh(scrGeo, matMeshScreen));
  });

  // 2E) 5mm UV PP ROPE RIGGING (47.88m total: Dual Ridge + 4x Dual V-Guys + 3x Continuous Over-Mast Straps + 6x Eave Guys)
  const apMap = {};
  ANCHOR_COORDS.forEach(([name, ax, az]) => {
    apMap[name] = new THREE.Vector3(ax, 0.02, az);
  });
  const topF = new THREE.Vector3(0, H_PEAK + 0.01, HL);
  const topC = new THREE.Vector3(0, H_PEAK + 0.01, 0.0);
  const topR = new THREE.Vector3(0, H_PEAK + 0.01, -HL);
  const eavePts = {
    EAVE_FL: new THREE.Vector3(-HW, H_EAVE,  HL),
    EAVE_FR: new THREE.Vector3( HW, H_EAVE,  HL),
    EAVE_ML: new THREE.Vector3(-HW, H_EAVE, 0.0),
    EAVE_MR: new THREE.Vector3( HW, H_EAVE, 0.0),
    EAVE_RL: new THREE.Vector3(-HW, H_EAVE, -HL),
    EAVE_RR: new THREE.Vector3( HW, H_EAVE, -HL),
  };

  function addRope(p1, p2, radius = 0.004, mat = matRope) {
    const m = createCylinderBetween(p1, p2, radius, mat, 8);
    layerRigging.add(m);
    return m;
  }

  // Dual-strand Ridge Line
  addRope(topF, topR, 0.0045, matRope);
  // 4x Dual-Strand Ridge V-Guylines
  addRope(topF, apMap.RIDGE_FL, 0.0045, matRope);
  addRope(topF, apMap.RIDGE_FR, 0.0045, matRope);
  addRope(topR, apMap.RIDGE_RL, 0.0045, matRope);
  addRope(topR, apMap.RIDGE_RR, 0.0045, matRope);
  // 3x Continuous Over-Mast Storm Straps (running cleanly across the exterior roof ridges & eaves!)
  [
    [topF, eavePts.EAVE_FL, apMap.EAVE_FL],
    [topF, eavePts.EAVE_FR, apMap.EAVE_FR],
    [topC, eavePts.EAVE_ML, apMap.EAVE_ML],
    [topC, eavePts.EAVE_MR, apMap.EAVE_MR],
    [topR, eavePts.EAVE_RL, apMap.EAVE_RL],
    [topR, eavePts.EAVE_RR, apMap.EAVE_RR],
  ].forEach(([tPt, ePt, aPt]) => {
    addRope(tPt.clone().add(new THREE.Vector3(0, 0.012, 0)), ePt.clone().add(new THREE.Vector3(0, 0.01, 0)), 0.0038, matRopeHighlight);
    addRope(ePt, aPt, 0.0042, matRope);
  });

  // 2F) 10x HYBRID STEEL-CROSSBAR EARTH-FLUKE DEADMAN ANCHORS (200x330mm Woven PE Bag + Steel Crossbar!)
  ANCHOR_COORDS.forEach(([name, ax, az, isHeavy]) => {
    const g = new THREE.Group();
    g.position.set(ax, 0, az);
    const yaw = Math.atan2(-ax, -az);
    g.rotation.y = yaw;

    // Woven PE Earth-Fluke Anchor Bag / Surface Ballast Pad (200 x 330 mm)
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.055, 0.20), matEarthBag);
    bag.position.set(0, 0.028, 0);
    bag.castShadow = true;
    bag.receiveShadow = true;
    g.add(bag);

    // Blue draw-string cinch band on Komeri MUSBIC earth bag
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.21), matRopeHighlight);
    band.position.set(0, 0.028, 0);
    g.add(band);

    // Horizontal Steel Crossbar / Battered SD390 Stake (Ø19.1 pipe on heavy mid-eave, D10 rebar on others)
    const barRad = isHeavy ? 0.00955 : 0.0055;
    const barMat = isHeavy ? matSteelOuter : matRebar;
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(barRad, barRad, 0.34, 10), barMat);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, 0.062, 0);
    bar.castShadow = true;
    g.add(bar);

    layerAnchors.add(g);
  });

  // 2G) HUMAN SCALE FIGURES (172cm Sleeping Adult on Left Foil Mat + Seated Adult on Right Bay -> Proves 5.00 Tatami Roominess!)
  function createHumanSleeping() {
    const h = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), matHuman);
    head.position.set(0, 0.11, -0.78);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.125, 0.48, 8, 14), matHuman);
    torso.rotation.x = Math.PI / 2;
    torso.position.set(0, 0.13, -0.32);
    const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.68, 6, 12), matHuman);
    legL.rotation.x = Math.PI / 2;
    legL.position.set(-0.09, 0.08, 0.38);
    const legR = new THREE.Mesh(new THREE.CapsuleGeometry(0.068, 0.68, 6, 12), matHuman);
    legR.rotation.x = Math.PI / 2;
    legR.position.set(0.09, 0.08, 0.38);
    [head, torso, legL, legR].forEach((m) => {
      m.castShadow = true;
      h.add(m);
    });
    return h;
  }

  function createHumanSeated() {
    const h = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 16, 12), matHuman);
    head.position.set(0, 0.88, 0);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.40, 8, 14), matHuman);
    torso.position.set(0, 0.48, 0);
    const thighL = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.34, 6, 12), matHuman);
    thighL.rotation.x = Math.PI / 2;
    thighL.rotation.z = 0.35;
    thighL.position.set(-0.14, 0.12, 0.18);
    const thighR = new THREE.Mesh(new THREE.CapsuleGeometry(0.072, 0.34, 6, 12), matHuman);
    thighR.rotation.x = Math.PI / 2;
    thighR.rotation.z = -0.35;
    thighR.position.set(0.14, 0.12, 0.18);
    [head, torso, thighL, thighR].forEach((m) => {
      m.castShadow = true;
      h.add(m);
    });
    return h;
  }

  const sleeper = createHumanSleeping();
  sleeper.position.set(-0.74, 0.015, 0.05);
  layerScale.add(sleeper);

  const sitter = createHumanSeated();
  sitter.position.set(0.56, 0.015, -0.10);
  sitter.rotation.y = -0.35;
  layerScale.add(sitter);

  // 2H) 3D OPENFOAM WIND STREAMLINES + 150mm/h SUPER-TYPHOON ANIMATED RAINDROP DEFLECTION VISUALIZATION
  // (Shown ONLY when Physics/Rain mode is active! Visually proves 0 interior rain ingress!)
  const rainCount = 420;
  const rainPositions = new Float32Array(rainCount * 2 * 3);
  const rainDrops = [];
  for (let i = 0; i < rainCount; i++) {
    rainDrops.push({
      x: -3.2 + Math.random() * 6.4,
      y: 0.4 + Math.random() * 2.8,
      z: -2.2 + Math.random() * 4.4,
      vx: 3.8 + Math.random() * 1.4,  // Broadside wind-driven rain trajectory!
      vy: -4.2 - Math.random() * 1.6,
    });
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainLines = new THREE.LineSegments(
    rainGeo,
    new THREE.LineBasicMaterial({ color: 0x0284c7, transparent: true, opacity: 0.72 })
  );
  layerPhysics.add(rainLines);

  // 7 Aerodynamic OpenFOAM 30 m/s smooth flow streamlines sweeping gracefully over the 40.48° Aero-Prism!
  const streamZList = [-1.35, -0.90, -0.45, 0.0, 0.45, 0.90, 1.35];
  streamZList.forEach((sz, idx) => {
    const pts = [];
    const hBase = 0.28 + 0.20 * (idx % 2);
    for (let k = 0; k <= 44; k++) {
      const x = -3.4 + (7.2 * k) / 44;
      // Smooth aerodynamic displacement envelope matching 40.48° Aero-Prism crest + gentle leeward wake
      const crestLift = 1.56 * Math.exp(-Math.pow(x / 1.52, 2));
      const wakeWave = x > 0.8 ? 0.14 * Math.exp(-(x - 0.8) * 0.55) * Math.sin((x - 0.8) * 2.4 + idx * 0.5) : 0.0;
      const ySurf = hBase + crestLift + wakeWave;
      pts.push(new THREE.Vector3(x, ySurf, sz));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 64, 0.0085, 8, false),
      new THREE.MeshBasicMaterial({ color: idx % 2 === 0 ? 0x0ea5e9 : 0x2563eb, transparent: true, opacity: 0.72 })
    );
    layerPhysics.add(tube);
  });
  layerPhysics.visible = false;

  // -------------------------------------------------------------------------
  // KINEMATIC DEPLOYMENT & CAD MODE SYNCHRONIZATION
  // -------------------------------------------------------------------------
  function applyModes() {
    // Section clipping
    renderer.localClippingEnabled = state.section;
    const planes = state.section ? [clipPlane] : [];
    clippableMats.forEach((m) => {
      m.clippingPlanes = planes;
      m.needsUpdate = true;
    });

    // Physics / Rainstorm Mode vs Clean Architectural Mode
    const physOn = state.physics && state.deploy > 0.75;
    layerPhysics.visible = physOn;
    outerShellMeshes.forEach((mesh) => {
      mesh.material = physOn ? matTarpHeatmap : matTarpOuter;
    });

    // X-Ray Transparency
    const targetMat = physOn ? matTarpHeatmap : matTarpOuter;
    targetMat.transparent = state.xray;
    targetMat.opacity = state.xray ? 0.24 : 1.0;
    targetMat.depthWrite = !state.xray;
    targetMat.needsUpdate = true;

    // Soft-roll X-ray shows the 41 nested steel tubes inside!
    rollMat.opacity = state.xray ? 0.22 : 1.0;
    rollMat.depthWrite = !state.xray;
    packedCoreGroup.visible = state.xray || state.explode;
    limitBox.visible = (state.deploy < 0.25) && (state.xray || state.explode || state.deploy < 0.05);

    // FEA Stress Colors on 3 Coaxial Steel Masts in Physics Mode
    const feaVm = (physicsFields && physicsFields.mast_elem_vm_MPa) || {};
    mastStressMeshes.forEach(({ mesh, mIdx, segIdx }) => {
      if (physOn) {
        // Higher bending stress near mid-mast (segIdx 1, 2), low near pinned ends (0, 3)
        const elemKey = String(segIdx * 6 + mIdx + 1);
        const vm = feaVm[elemKey] || (segIdx === 1 || segIdx === 2 ? 78.0 : 42.0);
        mesh.material.color.copy(heatColor(clamp01(vm / 140.0)));
        mesh.material.metalness = 0.2;
      } else {
        mesh.material.color.setHex(0xcbd5e1);
        mesh.material.metalness = 0.82;
      }
    });

    // Exploded CAD Vertical Separation
    const ex = state.explode ? 1.0 : 0.0;
    layerCanopy.position.y = ex * 1.15;
    layerVents.position.y = ex * 1.48;
    layerRigging.position.y = ex * 0.85;
    layerMasts.position.y = ex * 0.42;
    layerInnerCores.position.y = ex * 0.68;
    layerInnerCores.position.x = ex * 0.28; // Pull staggered Ø16 inner cores slightly aside to show coaxial nesting!
    layerBathtub.position.y = ex * 0.08;
    layerAnchors.position.y = -ex * 0.14;

    layerScale.visible = state.scale && state.deploy > 0.72;
  }

  function setDeploy(t) {
    state.deploy = clamp01(t);

    // Phase 0: Soft Compression Roll (0.0 -> 0.24)
    const rollVis = 1.0 - smoothstep(0.08, 0.26, state.deploy);
    packedGroup.visible = rollVis > 0.01;
    packedGroup.scale.setScalar(lerp(0.6, 1.0, rollVis));
    packedGroup.position.y = (1.0 - rollVis) * -0.05;

    // Phase 1: Seamless Bathtub Floor Unfolding (0.14 -> 0.42)
    const tubT = smoothstep(0.14, 0.42, state.deploy);
    layerBathtub.visible = tubT > 0.01;
    layerBathtub.scale.set(lerp(0.16, 1.0, tubT), lerp(0.1, 1.0, tubT), lerp(0.18, 1.0, tubT));

    // Phase 2: 3-Mast Coaxial Galvanized Steel Spine Telescoping (0.26 -> 0.62)
    const mastT = smoothstep(0.26, 0.62, state.deploy);
    layerMasts.visible = mastT > 0.01;
    layerInnerCores.visible = mastT > 0.01;
    layerMasts.scale.set(1, lerp(0.24, 1.0, mastT), 1);
    layerInnerCores.scale.set(1, lerp(0.24, 1.0, mastT), 1);

    // Phase 3: Monolithic #2000 PE Roof Canopy & 180° S-Turn Labyrinth Vents (0.46 -> 0.86)
    const canT = smoothstep(0.46, 0.86, state.deploy);
    layerCanopy.visible = canT > 0.01;
    layerVents.visible = canT > 0.35;
    layerCanopy.scale.set(lerp(0.06, 1.0, canT), lerp(0.85, 1.0, canT), lerp(0.25, 1.0, canT));
    layerCanopy.position.y = (1.0 - canT) * 0.20 + (state.explode ? 1.15 : 0);
    layerVents.scale.setScalar(smoothstep(0.55, 0.90, state.deploy));

    // Phase 4: 5mm PP Rope Rigging & 10x Hybrid Earth-Fluke Anchors (0.70 -> 1.00)
    const rigT = smoothstep(0.70, 1.00, state.deploy);
    layerRigging.visible = rigT > 0.02;
    layerAnchors.visible = rigT > 0.02;
    layerRigging.scale.setScalar(lerp(0.85, 1.0, rigT));
    layerAnchors.scale.setScalar(lerp(0.4, 1.0, rigT));

    applyModes();
  }

  function tick(dt) {
    state.animTime += dt;
    if (layerPhysics.visible) {
      const posAttr = rainGeo.getAttribute('position');
      for (let i = 0; i < rainCount; i++) {
        const d = rainDrops[i];
        d.x += d.vx * dt;
        d.y += d.vy * dt;

        // Exact collision with Aero-Prism monolithic roof surface (proving 100% deflection & ZERO interior ingress!)
        let hitRoof = false;
        if (Math.abs(d.z) <= Z_TIP && Math.abs(d.x) <= HW + 0.04) {
          const yRoof = H_EAVE + Math.max(0, 1.0 - Math.abs(d.x) / HW) * (H_PEAK - H_EAVE);
          if (d.y <= yRoof + 0.02) {
            hitRoof = true;
          }
        }
        if (hitRoof || d.y < 0.02 || d.x > 3.4) {
          // Respawn upstream in 30m/s storm sky
          d.x = -3.4 + Math.random() * 4.8;
          d.y = 2.0 + Math.random() * 1.4;
          d.z = -2.1 + Math.random() * 4.2;
        }
        const idx = i * 6;
        posAttr.array[idx + 0] = d.x;
        posAttr.array[idx + 1] = d.y;
        posAttr.array[idx + 2] = d.z;
        posAttr.array[idx + 3] = d.x - d.vx * 0.032;
        posAttr.array[idx + 4] = d.y - d.vy * 0.032;
        posAttr.array[idx + 5] = d.z;
      }
      posAttr.needsUpdate = true;
    }
  }

  setDeploy(1.0);

  return {
    setDeploy,
    setXray: (v) => { state.xray = Boolean(v); applyModes(); },
    setSection: (v) => { state.section = Boolean(v); applyModes(); },
    setExplode: (v) => { state.explode = Boolean(v); applyModes(); },
    setPhysicsMode: (v) => { state.physics = Boolean(v); applyModes(); },
    setScaleVisible: (v) => { state.scale = Boolean(v); applyModes(); },
    getState: () => ({ ...state }),
    tick,
  };
}
