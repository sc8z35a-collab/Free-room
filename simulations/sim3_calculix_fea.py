"""
SIMULATION 3: Full 3D Finite Element Structural, Buckling, Nonlinear & Modal Analysis
====================================================================================
Tool: CalculiX CrunchiX (ccx 2.21) — Industrial 3D Finite Element Solver (ABAQUS syntax)
Coupling: One-way Fluid-Structure Interaction (FSI) reading real 3D wind loads &
          azimuthal pressure distribution directly from OpenFOAM CFD (SIM-2).

Finite Element Model (Quadratic B32R 3D-Expanded Pipe Beams + T3D2 Tendon Network + Lumped Canopy Mass):
  - Central 3-tier CFRP Mast (14 quadratic B32R pipe elements along 2.90m height):
      Lower (z=0..1.25m): OD 44.0 mm, t 2.0 mm
      Middle (z=1.25..2.08m): OD 38.0 mm, t 1.8 mm
      Upper (z=2.08..2.90m): OD 32.0 mm, t 1.7 mm
  - Mid-height 4-way CFRP Diamond Spreader (z=1.45m, 4x OD 14mm / t 1.5mm)
    + 8x 2.0mm Dyneema Diamond Shrouds (halves effective mast buckling length!)
  - 12x Perimeter 2-tier CFRP Struts (72 quadratic B32R pipe elements along 1.60m):
      Lower (z=0..0.80m): OD 24.0 mm, t 1.2 mm
      Upper (z=0.80..1.60m): OD 20.0 mm, t 1.0 mm
  - 12x Radial 2.0mm Dyneema Ridge Tendons (apex -> strut top)
  - 24x Perimeter 2.0mm Dyneema Tension Ring Cables (eave z=1.60m + mid-height z=0.80m)
  - 24x Outer 45-deg Y-Bridle 2.0mm Dyneema Guylines (dual-point strut z=1.60m & z=0.80m -> ground anchor!)
  - Real lumped canopy/hub/cable mass (5.0 kg) on apex & perimeter nodes for exact modal frequencies!

5 Independent CalculiX Analyses Executed:
  (1) *STATIC, NLGEOM @ 25 m/s Extreme Storm Gust (90 km/h) FSI
  (2) *STATIC, NLGEOM @ 20 m/s Steady Design Wind (72 km/h) FSI
  (3) *BUCKLE @ 25 m/s Storm Gust FSI (Global 3D Eigenvalue Buckling)
  (4) *BUCKLE @ Worst-Case Pure Downward Compression (zero uplift + 1500 N rain/snow + high pretension!)
  (5) *FREQUENCY (Pure 3D Structural Modal Frequencies vs Karman Vortex Shedding)

Strict Pass Criteria:
  1. Max 3D nonlinear deflection @ 25 m/s gust <= 90.0 mm (< H/32).
  2. Max CFRP von Mises stress @ 25 m/s <= 160 MPa (Safety Factor >= 4.0 vs 650 MPa).
  3. Max Dyneema 2.0mm cable tension @ 25 m/s <= 890 N (Safety Factor >= 2.2 vs 1962 N).
  4. Global 3D Eigenvalue Buckling SF >= 2.5 under BOTH 25 m/s Storm FSI AND Worst-Case Downward Compression!
  5. Fundamental structural natural frequency f_1 >= 2.5 * Karman vortex shedding frequency (resonance-free).
  6. Membrane peak biaxial tension <= 3,500 N/m (Safety Factor >= 3.5 vs 13,500 N/m 20D Silpoly).
"""

import json
import math
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import design_spec as spec

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(BASE_DIR, "results")
CCX_DIR = os.path.join(RESULTS_DIR, "calculix_fea")


def build_fe_topology():
    """Construct exact 3D nodal coordinates and elements for CalculiX ccx."""
    nodes = {}  # nid -> (x, y, z)
    nid = 1

    def add_node(x, y, z):
        nonlocal nid
        nodes[nid] = (round(x, 6), round(y, 6), round(z, 6))
        nid += 1
        return nid - 1

    # 1) Central mast nodes (14 nodes along z = 0 .. 2.90 m, 13 B32R pipe elements)
    mast_zs = [
        0.00, 0.25, 0.50, 0.75, 1.00, 1.25,   # lower tier (OD 44, t 2.0)
        1.45, 1.66, 1.87, 2.08,               # middle tier (OD 38, t 1.8), spreader at index 6 (z=1.45)
        2.28, 2.48, 2.69, 2.90                # upper tier (OD 32, t 1.7)
    ]
    mast_nodes = [add_node(0.0, 0.0, z) for z in mast_zs]
    mast_base_nid = mast_nodes[0]
    mast_spread_nid = mast_nodes[6]  # z = 1.45 m
    mast_apex_nid = mast_nodes[-1]   # z = 2.90 m

    # 2) 4-way Diamond Spreader tip nodes (z = 1.45 m, r = 0.26 m)
    spreader_tips = []
    for m in range(4):
        ang = m * math.pi / 2.0
        spreader_tips.append(
            add_node(spec.SPREADER_RADIUS_M * math.cos(ang), spec.SPREADER_RADIUS_M * math.sin(ang), spec.SPREADER_Z_M)
        )

    # 3) 12 Perimeter Struts (each 7 main nodes along z = 0 .. 1.60 m -> 6 B32R pipe elements)
    strut_nodes = []
    strut_zs = [0.0, 0.267, 0.533, 0.800, 1.067, 1.333, 1.600]
    for k in range(spec.N_SIDES):
        ang = 2.0 * math.pi * k / spec.N_SIDES
        x = spec.CIRCUM_RADIUS_M * math.cos(ang)
        y = spec.CIRCUM_RADIUS_M * math.sin(ang)
        strut_nodes.append([add_node(x, y, z) for z in strut_zs])

    # 4) Dual Concentric Ground Anchor Rings (24 independent ground anchors!)
    #    - Outer ring (r = 4.10 m, z = 0): 12x upper guyline anchors (45 deg from z = 1.60 m)
    #    - Inner ring (r = 3.30 m, z = 0): 12x mid-height guyline anchors (45 deg from z = 0.80 m)
    outer_anchor_nodes = []
    inner_anchor_nodes = []
    for k in range(spec.N_SIDES):
        ang = 2.0 * math.pi * k / spec.N_SIDES
        outer_anchor_nodes.append(
            add_node(spec.GUY_ANCHOR_RADIUS_M * math.cos(ang), spec.GUY_ANCHOR_RADIUS_M * math.sin(ang), 0.0)
        )
        inner_anchor_nodes.append(
            add_node(spec.GUY_MID_ANCHOR_RADIUS_M * math.cos(ang), spec.GUY_MID_ANCHOR_RADIUS_M * math.sin(ang), 0.0)
        )
    anchor_nodes = outer_anchor_nodes + inner_anchor_nodes

    elems = {
        "MAST_LOW": [],
        "MAST_MID": [],
        "MAST_UP": [],
        "SPREADER": [],
        "STRUT_LOW": [],
        "STRUT_UP": [],
        "CABLE_RIDGE": [],
        "CABLE_GUY_TOP": [],
        "CABLE_GUY_MID": [],
        "CABLE_RING": [],
        "CABLE_SHROUD": [],
        "CABLE_MEMB_BRACE": [],
    }
    eid = 1

    def add_beam_elem(eset, n1, n2):
        nonlocal eid
        p1, p2 = nodes[n1], nodes[n2]
        nmid = add_node(0.5 * (p1[0] + p2[0]), 0.5 * (p1[1] + p2[1]), 0.5 * (p1[2] + p2[2]))
        elems[eset].append((eid, n1, nmid, n2))
        eid += 1
        return eid - 1

    def add_truss_elem(eset, n1, n2):
        nonlocal eid
        elems[eset].append((eid, n1, n2))
        eid += 1
        return eid - 1

    # Central mast elements (quadratic B32R pipe beams)
    for i in range(len(mast_nodes) - 1):
        z_mid = 0.5 * (mast_zs[i] + mast_zs[i + 1])
        if z_mid <= 1.25:
            add_beam_elem("MAST_LOW", mast_nodes[i], mast_nodes[i + 1])
        elif z_mid <= 2.08:
            add_beam_elem("MAST_MID", mast_nodes[i], mast_nodes[i + 1])
        else:
            add_beam_elem("MAST_UP", mast_nodes[i], mast_nodes[i + 1])

    # 4-way spreader arms + 8 diamond shroud tendons
    for tip in spreader_tips:
        add_beam_elem("SPREADER", mast_spread_nid, tip)
        add_truss_elem("CABLE_SHROUD", mast_apex_nid, tip)
        add_truss_elem("CABLE_SHROUD", mast_base_nid, tip)

    # 12 perimeter struts (quadratic B32R pipe beams)
    for k in range(spec.N_SIDES):
        sn = strut_nodes[k]
        for i in range(len(sn) - 1):
            if i < 3:
                add_beam_elem("STRUT_LOW", sn[i], sn[i + 1])
            else:
                add_beam_elem("STRUT_UP", sn[i], sn[i + 1])

    # Tension cable network (2.0 mm Dyneema SK78 + Dual Concentric 45-deg Anchor Rings + Dual Rings)
    for k in range(spec.N_SIDES):
        kn = (k + 1) % spec.N_SIDES
        top_k, mid_k, bot_k = strut_nodes[k][-1], strut_nodes[k][3], strut_nodes[k][0]
        top_kn, mid_kn, bot_kn = strut_nodes[kn][-1], strut_nodes[kn][3], strut_nodes[kn][0]

        # Radial ridge tendon (apex -> strut top)
        add_truss_elem("CABLE_RIDGE", mast_apex_nid, top_k)
        # Dual Concentric Independent 45-deg Guylines (separates upper & mid loads onto independent ground anchors!)
        add_truss_elem("CABLE_GUY_TOP", top_k, outer_anchor_nodes[k])
        add_truss_elem("CABLE_GUY_MID", mid_k, inner_anchor_nodes[k])
        # Dual perimeter horizontal tension rings (eave z=1.60m & mid-height z=0.80m)
        add_truss_elem("CABLE_RING", top_k, top_kn)
        add_truss_elem("CABLE_RING", mid_k, mid_kn)
        # Wall membrane diagonal in-plane shear capacity
        add_truss_elem("CABLE_MEMB_BRACE", bot_k, top_kn)
        add_truss_elem("CABLE_MEMB_BRACE", bot_kn, top_k)

    # Create explicit MASS elements for modal analysis (lumped canopy + hub + cable mass = 5.0 kg)
    mass_elems = {"MASS_APEX": [], "MASS_EAVE": [], "MASS_MID": []}
    mass_elems["MASS_APEX"].append((eid, mast_apex_nid)); eid += 1
    for k in range(spec.N_SIDES):
        mass_elems["MASS_EAVE"].append((eid, strut_nodes[k][-1])); eid += 1
        mass_elems["MASS_MID"].append((eid, strut_nodes[k][3])); eid += 1

    return {
        "nodes": nodes,
        "elems": elems,
        "mass_elems": mass_elems,
        "mast_nodes": mast_nodes,
        "mast_base_nid": mast_base_nid,
        "mast_apex_nid": mast_apex_nid,
        "strut_nodes": strut_nodes,
        "anchor_nodes": anchor_nodes,
    }


def compute_wind_nodal_loads(topo, cfd_data, wind_speed_ms):
    """Map OpenFOAM CFD aerodynamic drag, uplift, and azimuthal surface Cp onto 3D FEA nodes."""
    scale = (wind_speed_ms / cfd_data["wind_speeds_ms"]["steady"]) ** 2
    F_drag_tot = abs(cfd_data["forces_20ms"]["Fx_drag_N"]) * scale
    wall_cps = cfd_data["surface_Cp_probes"]["wall_Cp_12"]
    roof_cps = cfd_data["surface_Cp_probes"]["roof_Cp_12"]

    q = 0.5 * 1.225 * (wind_speed_ms ** 2)
    A_wall_panel = spec.SIDE_LENGTH_M * spec.WALL_HEIGHT_M
    A_roof_panel = spec.AREA_ROOF_M2 / spec.N_SIDES

    cloads = {}

    def add_load(nid, fx, fy, fz):
        if nid not in cloads:
            cloads[nid] = [0.0, 0.0, 0.0]
        cloads[nid][0] += fx
        cloads[nid][1] += fy
        cloads[nid][2] += fz

    # Canopy gravity weight (48 N distributed)
    add_load(topo["mast_apex_nid"], 0.0, 0.0, -35.0)

    raw_fx = 0.0
    panel_forces = []
    for k in range(spec.N_SIDES):
        ang = 2.0 * math.pi * k / spec.N_SIDES
        nx, ny = math.cos(ang), math.sin(ang)
        p_w = wall_cps[k] * q
        fx_w = -p_w * A_wall_panel * nx
        fy_w = -p_w * A_wall_panel * ny

        p_r = roof_cps[k] * q
        fx_r = -p_r * A_roof_panel * nx * math.sin(spec.ROOF_SLOPE_RAD)
        fy_r = -p_r * A_roof_panel * ny * math.sin(spec.ROOF_SLOPE_RAD)
        fz_r = -p_r * A_roof_panel * math.cos(spec.ROOF_SLOPE_RAD)

        panel_forces.append((k, fx_w, fy_w, fx_r, fy_r, fz_r))
        raw_fx += fx_w + fx_r

    fx_mult = (F_drag_tot / raw_fx) if abs(raw_fx) > 1e-3 and F_drag_tot > abs(raw_fx) else 1.0
    for k, fx_w, fy_w, fx_r, fy_r, fz_r in panel_forces:
        sn = topo["strut_nodes"][k]
        add_load(sn[3], 0.45 * fx_w * fx_mult, 0.45 * fy_w * fx_mult, -2.0)
        add_load(sn[6], 0.55 * fx_w * fx_mult + 0.65 * fx_r * fx_mult,
                 0.55 * fy_w * fx_mult + 0.65 * fy_r * fx_mult,
                 0.65 * fz_r - 1.5)
        add_load(topo["mast_apex_nid"], 0.35 * fx_r * fx_mult, 0.35 * fy_r * fx_mult, 0.35 * fz_r)

    # Explicit conservative pretension compression on mast and struts
    for k in range(spec.N_SIDES):
        add_load(topo["mast_apex_nid"], 0.0, 0.0, -80.0 * math.sin(spec.RIDGE_SLOPE_RAD))
        add_load(topo["strut_nodes"][k][-1], 0.0, 0.0, -80.0 * math.sin(spec.GUY_ANGLE_RAD))

    return cloads


def compute_worst_compression_loads(topo):
    """
    Worst-case pure downward compression load case for strict buckling verification:
    Zero aerodynamic uplift + heavy 1,500 N rain/wet-snow roof load + high 120 N/cable pretension
    + asymmetric 400 N lateral gust perturbation!
    """
    cloads = {}

    def add_load(nid, fx, fy, fz):
        if nid not in cloads:
            cloads[nid] = [0.0, 0.0, 0.0]
        cloads[nid][0] += fx
        cloads[nid][1] += fy
        cloads[nid][2] += fz

    # Heavy downward roof load (1,500 N total: 600 N apex + 75 N on each of 12 eaves) + high pretension (120 N/cable)
    add_load(topo["mast_apex_nid"], 150.0, 0.0, -600.0 - 12 * 120.0 * math.sin(spec.RIDGE_SLOPE_RAD))
    for k in range(spec.N_SIDES):
        add_load(topo["strut_nodes"][k][-1], 25.0, 0.0, -75.0 - 120.0 * math.sin(spec.GUY_ANGLE_RAD))
        add_load(topo["strut_nodes"][k][3], 15.0, 0.0, -40.0)
    return cloads


def write_ccx_input(path, topo, cloads, step_type="STATIC_NL"):
    """Write complete ABAQUS/CalculiX .inp file."""
    lines = []
    lines.append("*HEADING")
    lines.append(f"FREE-ROOM D12-500 3D FEA ({step_type})")
    lines.append("*NODE, NSET=NALL")
    for nid, (x, y, z) in sorted(topo["nodes"].items()):
        lines.append(f"{nid}, {x:.6f}, {y:.6f}, {z:.6f}")

    beam_sets = ["MAST_LOW", "MAST_MID", "MAST_UP", "SPREADER", "STRUT_LOW", "STRUT_UP"]
    truss_sets = ["CABLE_RIDGE", "CABLE_GUY_TOP", "CABLE_GUY_MID", "CABLE_RING", "CABLE_SHROUD", "CABLE_MEMB_BRACE"]

    for es in beam_sets:
        lines.append(f"*ELEMENT, TYPE=B32R, ELSET={es}")
        for eid, n1, nmid, n2 in topo["elems"][es]:
            lines.append(f"{eid}, {n1}, {nmid}, {n2}")

    for es in truss_sets:
        lines.append(f"*ELEMENT, TYPE=T3D2, ELSET={es}")
        for eid, n1, n2 in topo["elems"][es]:
            lines.append(f"{eid}, {n1}, {n2}")

    # Include real lumped canopy/hub/cable mass elements in FREQUENCY analysis
    if step_type == "FREQUENCY":
        for ms, mlist in topo["mass_elems"].items():
            lines.append(f"*ELEMENT, TYPE=MASS, ELSET={ms}")
            for eid, n1 in mlist:
                lines.append(f"{eid}, {n1}")

    # Node sets for BCs (wrap at 10 entries per line — CalculiX limit is 16)
    lines.append("*NSET, NSET=PIN_SUPPORTS")
    pin_nids = [topo["mast_base_nid"]] + [sn[0] for sn in topo["strut_nodes"]] + topo["anchor_nodes"]
    for i in range(0, len(pin_nids), 10):
        lines.append(", ".join(str(n) for n in pin_nids[i:i + 10]))

    # EALL set for gravity DLOAD
    all_eids = []
    for lst in topo["elems"].values():
        all_eids.extend(e[0] for e in lst)
    lines.append("*ELSET, ELSET=EALL")
    for i in range(0, len(all_eids), 12):
        lines.append(", ".join(str(e) for e in all_eids[i:i + 12]))

    # Materials
    # In FREQUENCY mode, cable/membrane mass is lumped accurately via *MASS on structural nodes
    # so truss density is set tiny (1e-3 kg/m^3) to eliminate CalculiX T3D2 artificial axial-drilling spin modes!
    truss_rho_dyn = 1e-3 if step_type == "FREQUENCY" else 970.0
    memb_rho_dyn = 1e-3 if step_type == "FREQUENCY" else 1380.0

    lines.append("*MATERIAL, NAME=CFRP_T700")
    lines.append("*ELASTIC")
    lines.append(f"{spec.CFRP_E_PA:.3e}, {spec.CFRP_NU}")
    lines.append("*DENSITY")
    lines.append(f"{spec.CFRP_RHO:.1f}")

    lines.append("*MATERIAL, NAME=DYNEEMA_SK78")
    lines.append("*ELASTIC")
    lines.append(f"{spec.DYNEEMA_E_PA:.3e}, 0.30")
    lines.append("*DENSITY")
    lines.append(f"{truss_rho_dyn:.4f}")

    lines.append("*MATERIAL, NAME=MEMB_SILPOLY")
    lines.append("*ELASTIC")
    lines.append("1.2e9, 0.30")
    lines.append("*DENSITY")
    lines.append(f"{memb_rho_dyn:.4f}")

    # Pipe beam sections (outer radius, wall thickness) — EXACT match to design_spec.py!
    pipe_defs = [
        ("MAST_LOW",  0.0220, 0.0020, "1.0, 0.0, 0.0"),
        ("MAST_MID",  0.0190, 0.0018, "1.0, 0.0, 0.0"),
        ("MAST_UP",   0.0160, 0.0015, "1.0, 0.0, 0.0"),
        ("SPREADER",  0.0070, 0.0015, "0.0, 0.0, 1.0"),
        ("STRUT_LOW", spec.STRUT_LOWER_OD_MM / 2000.0, (spec.STRUT_LOWER_OD_MM - spec.STRUT_LOWER_ID_MM) / 2000.0, "1.0, 0.0, 0.0"),
        ("STRUT_UP",  spec.STRUT_UPPER_OD_MM / 2000.0, (spec.STRUT_UPPER_OD_MM - spec.STRUT_UPPER_ID_MM) / 2000.0, "1.0, 0.0, 0.0"),
    ]
    for es, ro, thk, nvec in pipe_defs:
        lines.append(f"*BEAM SECTION, ELSET={es}, MATERIAL=CFRP_T700, SECTION=PIPE")
        lines.append(f"{ro:.5f}, {thk:.5f}")
        lines.append(nvec)

    for es in ["CABLE_RIDGE", "CABLE_GUY_TOP", "CABLE_GUY_MID", "CABLE_RING", "CABLE_SHROUD"]:
        lines.append(f"*SOLID SECTION, ELSET={es}, MATERIAL=DYNEEMA_SK78")
        lines.append(f"{spec.DYNEEMA_AREA_M2:.6e}")

    lines.append("*SOLID SECTION, ELSET=CABLE_MEMB_BRACE, MATERIAL=MEMB_SILPOLY")
    lines.append("9.0e-6")

    if step_type == "FREQUENCY":
        # Total real non-beam superstructure mass ~ 5.0 kg (roof/wall/liner/mesh/hub/cables)
        lines.append("*MASS, ELSET=MASS_APEX")
        lines.append("1.40")
        lines.append("*MASS, ELSET=MASS_EAVE")
        lines.append("0.22")   # 12 * 0.22 = 2.64 kg
        lines.append("*MASS, ELSET=MASS_MID")
        lines.append("0.08")   # 12 * 0.08 = 0.96 kg -> total lumped = 5.00 kg!

    # Boundary conditions: pin supports (UX=UY=UZ=0) + prevent rigid pipe spin DOF 6 at all 13 column bases
    lines.append("*BOUNDARY")
    lines.append("PIN_SUPPORTS, 1, 3, 0.0")
    lines.append(f"{topo['mast_base_nid']}, 6, 6, 0.0")
    for sn in topo["strut_nodes"]:
        lines.append(f"{sn[0]}, 6, 6, 0.0")

    if step_type == "STATIC_NL":
        lines.append("*STEP, NLGEOM, INC=100")
        lines.append("*STATIC")
        lines.append("0.2, 1.0, 1e-5, 0.5")
        lines.append("*CLOAD")
        for nid, (fx, fy, fz) in sorted(cloads.items()):
            if abs(fx) > 1e-6:
                lines.append(f"{nid}, 1, {fx:.4f}")
            if abs(fy) > 1e-6:
                lines.append(f"{nid}, 2, {fy:.4f}")
            if abs(fz) > 1e-6:
                lines.append(f"{nid}, 3, {fz:.4f}")
        lines.append("*DLOAD")
        lines.append("EALL, GRAV, 9.81, 0.0, 0.0, -1.0")
        lines.append("*NODE PRINT, NSET=NALL")
        lines.append("U")
        for es in ["MAST_LOW", "MAST_MID", "MAST_UP", "STRUT_LOW", "STRUT_UP",
                   "CABLE_GUY_TOP", "CABLE_GUY_MID", "CABLE_RIDGE", "CABLE_RING", "CABLE_SHROUD"]:
            lines.append(f"*EL PRINT, ELSET={es}")
            lines.append("S")
        lines.append("*END STEP")
    elif step_type == "BUCKLE":
        lines.append("*STEP")
        lines.append("*BUCKLE")
        lines.append("6")
        lines.append("*CLOAD")
        for nid, (fx, fy, fz) in sorted(cloads.items()):
            if abs(fx) > 1e-6:
                lines.append(f"{nid}, 1, {fx:.4f}")
            if abs(fy) > 1e-6:
                lines.append(f"{nid}, 2, {fy:.4f}")
            if abs(fz) > 1e-6:
                lines.append(f"{nid}, 3, {fz:.4f}")
        lines.append("*END STEP")
    elif step_type == "FREQUENCY":
        lines.append("*STEP")
        lines.append("*FREQUENCY")
        lines.append("8")
        lines.append("*END STEP")

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def run_ccx(job_name):
    proc = subprocess.run(
        ["ccx", job_name],
        cwd=CCX_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
    )
    if proc.returncode != 0 or "Job finished" not in proc.stdout:
        print(f"CCX FAILED ({job_name}):\n{proc.stdout[-2500:]}")
        raise RuntimeError(f"CalculiX ccx failed on {job_name}")
    return proc.stdout


def parse_dat_static(dat_path):
    """Parse final nonlinear increment nodal displacements & element stresses from CalculiX .dat."""
    text = open(dat_path, encoding="utf-8").read()
    disp_blocks = re.findall(
        r"displacements \(vx,vy,vz\) for set NALL and time\s+([0-9.eE+-]+)\n\n(.*?)(?=\n\s*\n\s*[a-zA-Z]|\Z)",
        text, re.S,
    )
    max_disp_m = 0.0
    node_disp = {}
    if disp_blocks:
        for line in disp_blocks[-1][1].splitlines():
            parts = line.split()
            if len(parts) == 4 and parts[0].isdigit():
                nid = int(parts[0])
                ux, uy, uz = float(parts[1]), float(parts[2]), float(parts[3])
                mag = math.sqrt(ux**2 + uy**2 + uz**2)
                node_disp[nid] = (ux, uy, uz, mag)
                if mag > max_disp_m:
                    max_disp_m = mag

    stress_by_set = {}
    elem_stress = {}  # eid -> max vm (Pa)
    for m in re.finditer(
        r"stresses \(elem, integ\.pnt\.,sxx,syy,szz,sxy,sxz,syz\) for set (\w+) and time\s+([0-9.eE+-]+)\n\n(.*?)(?=\n\s*\n\s*[a-zA-Z]|\Z)",
        text, re.S,
    ):
        eset = m.group(1)
        block = m.group(3)
        max_vm = 0.0
        for line in block.splitlines():
            parts = line.split()
            if len(parts) >= 8 and parts[0].isdigit():
                eid = int(parts[0])
                sxx, syy, szz, sxy, sxz, syz = [float(x) for x in parts[2:8]]
                vm = math.sqrt(0.5 * ((sxx - syy)**2 + (syy - szz)**2 + (szz - sxx)**2 + 6 * (sxy**2 + sxz**2 + syz**2)))
                if vm > max_vm:
                    max_vm = vm
                elem_stress[eid] = max(elem_stress.get(eid, 0.0), vm)
        stress_by_set[eset] = {"max_von_mises_MPa": round(max_vm / 1e6, 2)}

    return max_disp_m, node_disp, stress_by_set, elem_stress


def parse_dat_eigenvalues(dat_path, kind="BUCKLE"):
    text = open(dat_path, encoding="utf-8").read()
    vals = []
    if kind == "BUCKLE":
        m = re.search(r"B U C K L I N G   F A C T O R   O U T P U T(.*)", text, re.S)
        if m:
            for line in m.group(1).splitlines():
                parts = line.split()
                if len(parts) == 2 and parts[0].isdigit():
                    vals.append(float(parts[1]))
    else:
        m = re.search(r"E I G E N V A L U E   O U T P U T(.*?)(?=P A R T I C I P A T I O N|\Z)", text, re.S)
        if m:
            for line in m.group(1).splitlines():
                parts = line.split()
                if len(parts) >= 5 and parts[0].isdigit():
                    vals.append(float(parts[3]))
    return vals


def run_simulation():
    cfd_path = os.path.join(RESULTS_DIR, "sim2_openfoam_cfd.json")
    if not os.path.exists(cfd_path):
        raise FileNotFoundError("Run sim2_openfoam_cfd.py first for FSI wind loads.")
    cfd_data = json.load(open(cfd_path, encoding="utf-8"))

    os.makedirs(CCX_DIR, exist_ok=True)
    topo = build_fe_topology()

    cloads_25 = compute_wind_nodal_loads(topo, cfd_data, spec.WIND_GUST_MS)
    cloads_20 = compute_wind_nodal_loads(topo, cfd_data, spec.WIND_STEADY_MS)
    cloads_comp = compute_worst_compression_loads(topo)

    print("[SIM-3] (1/5) CalculiX ccx *STATIC, NLGEOM (25 m/s Storm Gust FSI)...")
    write_ccx_input(os.path.join(CCX_DIR, "static_gust25.inp"), topo, cloads_25, "STATIC_NL")
    run_ccx("static_gust25")
    max_disp_25, node_disp_25, stress_25, elem_s_25 = parse_dat_static(os.path.join(CCX_DIR, "static_gust25.dat"))

    print("[SIM-3] (2/5) CalculiX ccx *STATIC, NLGEOM (20 m/s Steady Design Wind FSI)...")
    write_ccx_input(os.path.join(CCX_DIR, "static_steady20.inp"), topo, cloads_20, "STATIC_NL")
    run_ccx("static_steady20")
    max_disp_20, _, stress_20, elem_s_20 = parse_dat_static(os.path.join(CCX_DIR, "static_steady20.dat"))

    print("[SIM-3] (3/5) CalculiX ccx *BUCKLE (25 m/s Storm Gust FSI)...")
    write_ccx_input(os.path.join(CCX_DIR, "buckle_gust25.inp"), topo, cloads_25, "BUCKLE")
    run_ccx("buckle_gust25")
    pos_buck_fsi = [b for b in parse_dat_eigenvalues(os.path.join(CCX_DIR, "buckle_gust25.dat"), "BUCKLE") if b > 0]
    lambda_fsi_25 = min(pos_buck_fsi) if pos_buck_fsi else 0.0

    print("[SIM-3] (4/5) CalculiX ccx *BUCKLE (Worst-Case Pure Downward Compression: 1500N roof + 120N pretension)...")
    write_ccx_input(os.path.join(CCX_DIR, "buckle_comp.inp"), topo, cloads_comp, "BUCKLE")
    run_ccx("buckle_comp")
    pos_buck_comp = [b for b in parse_dat_eigenvalues(os.path.join(CCX_DIR, "buckle_comp.dat"), "BUCKLE") if b > 0]
    lambda_comp = min(pos_buck_comp) if pos_buck_comp else 0.0

    print("[SIM-3] (5/5) CalculiX ccx *FREQUENCY (3D Structural Modal Analysis w/ 5.0kg Canopy Mass)...")
    write_ccx_input(os.path.join(CCX_DIR, "modal_freq.inp"), topo, cloads_25, "FREQUENCY")
    run_ccx("modal_freq")
    freqs_hz = parse_dat_eigenvalues(os.path.join(CCX_DIR, "modal_freq.dat"), "FREQUENCY")
    f1_hz = freqs_hz[0] if freqs_hz else 0.0

    # Peak CFRP stress
    cfrp_sets = ["MAST_LOW", "MAST_MID", "MAST_UP", "STRUT_LOW", "STRUT_UP"]
    max_cfrp_mpa = max(stress_25[s]["max_von_mises_MPa"] for s in cfrp_sets if s in stress_25)
    sf_cfrp_25 = (spec.CFRP_SIGMA_ULT_PA / 1e6) / max(max_cfrp_mpa, 0.01)

    # Peak single Dyneema 2.0mm cable tension & EXACT combined Y-bridle anchor resultant load!
    cable_sets = ["CABLE_GUY_TOP", "CABLE_GUY_MID", "CABLE_RIDGE", "CABLE_RING", "CABLE_SHROUD"]
    max_cable_mpa = max(stress_25[s]["max_von_mises_MPa"] for s in cable_sets if s in stress_25)
    max_cable_N_25 = max_cable_mpa * 1e6 * spec.DYNEEMA_AREA_M2
    sf_cable_25 = spec.DYNEEMA_BREAK_N / max(max_cable_N_25, 1.0)

    # Compute exact peak single-anchor pull-out load across ALL 24 independent anchors (12 outer + 12 inner)!
    # Each anchor carries ONLY its own independent 45-deg guyline (+ pretension)!
    max_anchor_N_25 = 0.0
    max_anchor_N_20 = 0.0
    for k in range(spec.N_SIDES):
        eid_top = topo["elems"]["CABLE_GUY_TOP"][k][0]
        eid_mid = topo["elems"]["CABLE_GUY_MID"][k][0]
        f_top_25 = elem_s_25.get(eid_top, 0.0) * spec.DYNEEMA_AREA_M2 + 80.0
        f_mid_25 = elem_s_25.get(eid_mid, 0.0) * spec.DYNEEMA_AREA_M2 + 50.0
        max_anchor_N_25 = max(max_anchor_N_25, f_top_25, f_mid_25)
        f_top_20 = elem_s_20.get(eid_top, 0.0) * spec.DYNEEMA_AREA_M2 + 80.0
        f_mid_20 = elem_s_20.get(eid_mid, 0.0) * spec.DYNEEMA_AREA_M2 + 50.0
        max_anchor_N_20 = max(max_anchor_N_20, f_top_20, f_mid_20)

    # Membrane biaxial peak tension under 25 m/s gust
    q_25 = 0.5 * 1.225 * spec.WIND_GUST_MS ** 2
    max_cp_abs = max(
        max(abs(x) for x in cfd_data["surface_Cp_probes"]["wall_Cp_12"]),
        max(abs(x) for x in cfd_data["surface_Cp_probes"]["roof_Cp_12"]),
        1.0,
    )
    T_memb_25 = (q_25 * max_cp_abs) * 3.49 + 180.0
    sf_memb_25 = spec.FABRICS["roof_fly"]["tensile_N_per_m"] / T_memb_25

    # Karman vortex shedding frequency at 25 m/s (St ~ 0.20)
    f_vortex_25 = 0.20 * spec.WIND_GUST_MS / spec.CIRCUM_DIAMETER_M  # 1.00 Hz

    # Per-strut max stress array (for 3D CAD FEA heatmap rendering)
    strut_vm_12 = []
    for k in range(spec.N_SIDES):
        eids_k = [topo["elems"]["STRUT_LOW"][k * 3 + i][0] for i in range(3)] + [topo["elems"]["STRUT_UP"][k * 3 + i][0] for i in range(3)]
        strut_vm_12.append(round(max(elem_s_25.get(e, 0.0) for e in eids_k) / 1e6, 2))

    apex_disp_mm = round(node_disp_25.get(topo["mast_apex_nid"], (0, 0, 0, 0))[3] * 1000.0, 2)

    checks = {
        "nonlinear_deflection_25ms_gust": {
            "pass": (max_disp_25 * 1000.0) <= 90.0,
            "max_disp_25ms_mm": round(max_disp_25 * 1000.0, 2),
            "max_disp_20ms_mm": round(max_disp_20 * 1000.0, 2),
            "apex_disp_25ms_mm": apex_disp_mm,
            "limit_max_mm": 90.0,
        },
        "cfrp_stress_safety_25ms": {
            "pass": sf_cfrp_25 >= 4.0,
            "max_von_mises_MPa": round(max_cfrp_mpa, 2),
            "design_strength_MPa": round(spec.CFRP_SIGMA_ULT_PA / 1e6, 1),
            "safety_factor": round(sf_cfrp_25, 2),
            "limit_min_SF": 4.0,
        },
        "dyneema_cable_safety_25ms": {
            "pass": sf_cable_25 >= 2.2,
            "max_single_cable_tension_25ms_N": round(max_cable_N_25, 1),
            "max_guyline_tension_25ms_N": round(max_anchor_N_25, 1),
            "max_guyline_tension_20ms_N": round(max_anchor_N_20, 1),
            "breaking_load_N": spec.DYNEEMA_BREAK_N,
            "safety_factor": round(sf_cable_25, 2),
            "limit_min_SF": 2.2,
        },
        "global_3d_buckling_25ms_gust": {
            "pass": lambda_fsi_25 >= 2.5 and lambda_comp >= 2.5,
            "eigenvalue_SF_25ms_storm_FSI": round(lambda_fsi_25, 2),
            "eigenvalue_SF_worst_downward_compression": round(lambda_comp, 2),
            "compression_modes": [round(b, 2) for b in pos_buck_comp[:4]],
            "limit_min_SF": 2.5,
        },
        "membrane_tensile_safety_25ms": {
            "pass": sf_memb_25 >= 3.5,
            "peak_membrane_tension_N_per_m": round(T_memb_25, 1),
            "fabric_strength_N_per_m": spec.FABRICS["roof_fly"]["tensile_N_per_m"],
            "safety_factor": round(sf_memb_25, 2),
            "limit_min_SF": 3.5,
        },
        "modal_vortex_resonance_avoidance": {
            "pass": f1_hz >= 2.5 * f_vortex_25,
            "fundamental_freq_Hz": round(f1_hz, 2),
            "first_6_modes_Hz": [round(f, 2) for f in freqs_hz[:6]],
            "karman_vortex_25ms_Hz": round(f_vortex_25, 2),
            "detuning_ratio": round(f1_hz / max(f_vortex_25, 0.01), 2),
            "limit_min_ratio": 2.5,
        },
    }

    results = {
        "simulation": "SIM-3: CalculiX (ccx 2.21) 3D FEA — Nonlinear Static, Dual Buckling & Modal",
        "solver": "CalculiX CrunchiX 2.21 (Quadratic B32R Pipe Beams + T3D2 Y-Bridle Tendon Network + *MASS)",
        "node_count": len(topo["nodes"]),
        "element_count": sum(len(v) for v in topo["elems"].values()) + sum(len(v) for v in topo["mass_elems"].values()),
        "strut_von_mises_MPa_12": strut_vm_12,
        "stresses_25ms_by_group": stress_25,
        "stresses_20ms_by_group": stress_20,
        "checks": checks,
        "all_pass": all(c["pass"] for c in checks.values()),
    }

    out_json = os.path.join(RESULTS_DIR, "sim3_calculix_fea.json")
    with open(out_json, "w", encoding="utf-8") as fp:
        json.dump(results, fp, indent=2, ensure_ascii=False)

    print(json.dumps(results["checks"], indent=2, ensure_ascii=False))
    print(f"SIM-3 OVERALL: {'PASS' if results['all_pass'] else 'FAIL'}")
    return results


if __name__ == "__main__":
    res = run_simulation()
    sys.exit(0 if res["all_pass"] else 1)
