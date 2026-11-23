"""
SIMULATION 1: 3D Solid Geometry, Interference/Collision & Exact Packing Verification
==================================================================================
Tools: trimesh (3D B-Rep / mesh solid modeling), exact analytical cylinder & AABB
       collision matrix, concentric nesting clearance verification, and conservative
       real-world folded fabric volumetric packing inside 520 x 160 x 480 mm.

Strict Pass Criteria:
  1. External packed envelope <= 520.0 x 160.0 x 480.0 mm (0.00 mm overage).
  2. Every single rigid hardware part placed inside Bay A (510 x 470 x 48 mm)
     with ZERO 3D overlap (max penetration = 0.000 mm) and minimum clearance >= 0.5 mm.
  3. Concentric Matryoshka nesting radial clearance >= 0.5 mm (diametral >= 1.0 mm)
     for every nested tube and stake.
  4. Bay B (510 x 470 x 105 mm = 25.17 L) total conservative folded volume <= 92.0% fill.
  5. Deployed 3D pavilion kinematic/geometric closure error < 0.5 mm.
"""

import json
import math
import os
import sys
import numpy as np
import trimesh

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import design_spec as spec


def make_box_mesh(cx, cy, cz, sx, sy, sz):
    m = trimesh.creation.box(extents=[sx, sy, sz])
    m.apply_translation([cx, cy, cz])
    return m


def make_cyl_x_mesh(x0, length, cy, cz, radius, sections=24):
    """Cylinder aligned along X axis from x0 to x0 + length."""
    m = trimesh.creation.cylinder(radius=radius, height=length, sections=sections)
    # Default trimesh cylinder is along Z; rotate 90 deg around Y -> along X
    R = trimesh.transformations.rotation_matrix(math.pi / 2.0, [0, 1, 0])
    m.apply_transform(R)
    m.apply_translation([x0 + length / 2.0, cy, cz])
    return m


def run_simulation():
    results = {
        "simulation": "SIM-1: 3D Solid Geometry, Collision & Exact 52x16x48cm Packing (Trimesh)",
        "checks": {},
        "components_bay_a": [],
        "components_bay_b": [],
        "nesting_clearances_mm": {},
    }

    # -------------------------------------------------------------------------
    # CHECK 1: External Envelope (EXACT <= 520 x 160 x 480 mm)
    # -------------------------------------------------------------------------
    ext_ok = (
        spec.PACKED_EXT_L_MM <= 520.0 + 1e-9
        and spec.PACKED_EXT_W_MM <= 160.0 + 1e-9
        and spec.PACKED_EXT_H_MM <= 480.0 + 1e-9
    )
    results["checks"]["external_envelope_exact"] = {
        "pass": ext_ok,
        "measured_mm": [spec.PACKED_EXT_L_MM, spec.PACKED_EXT_W_MM, spec.PACKED_EXT_H_MM],
        "limit_mm": [520.0, 160.0, 480.0],
        "volume_L": round(spec.PACKED_EXT_VOL_L, 4),
    }

    # -------------------------------------------------------------------------
    # CHECK 2: Concentric Matryoshka Nesting Clearances (Diametral >= 1.0 mm)
    # -------------------------------------------------------------------------
    clearances = {
        "mast_lower_ID_to_middle_OD": round(40.0 - 38.0, 2),       # 2.0 mm dia (1.0 mm radial)
        "mast_middle_ID_to_upper_OD": round(34.4 - 32.0, 2),       # 2.4 mm dia (1.2 mm radial)
        "mast_upper_ID_to_spreader_OD": round(28.6 - 14.0, 2),     # 14.6 mm dia (fits 2 spreaders + foam)
        "strut_lower_ID_to_upper_OD": round(spec.STRUT_LOWER_ID_MM - spec.STRUT_UPPER_OD_MM, 2),
        "strut_upper_ID_to_Ystake_OD": round(spec.STRUT_UPPER_ID_MM - spec.MAIN_STAKE_CIRCUM_DIA_MM, 2),
        "strut_upper_ID_to_Vstake_OD": round(spec.STRUT_UPPER_ID_MM - 14.0, 2),
        "mast_lower3_ID_to_minipump_OD": round(40.0 - 36.0, 2),    # 4.0 mm dia (tiny 36mm USB-C pump)
    }
    min_clr = min(clearances.values())
    results["nesting_clearances_mm"] = clearances
    results["checks"]["concentric_nesting_clearance"] = {
        "pass": min_clr >= 1.0,
        "min_diametral_clearance_mm": min_clr,
        "limit_min_mm": 1.0,
    }

    # Also check nested length fit inside outer tubes!
    # 24 Y-stakes (250 mm) + 12 V-stakes (180 mm):
    # Each of the 24 upper strut tubes is 440 mm long -> 1 Y-stake (250mm) fits easily in tubes 1..24,
    # and in tubes 1..12 there is 440 - 250 = 190 mm remaining -> 180 mm V-stake fits right behind it!
    # 250 + 180 = 430 mm <= 440 mm (10 mm foam stopper clearance!)
    stake_stack_len = spec.MAIN_STAKE_LEN_MM + spec.FLOOR_STAKE_LEN_MM  # 430 mm
    results["checks"]["nested_stake_axial_fit"] = {
        "pass": stake_stack_len <= spec.STRUT_SEG_LEN_MM - 5.0,
        "stake_pair_len_mm": stake_stack_len,
        "tube_bore_len_mm": spec.STRUT_SEG_LEN_MM,
        "clearance_mm": round(spec.STRUT_SEG_LEN_MM - stake_stack_len, 2),
    }

    # -------------------------------------------------------------------------
    # CHECK 3: Exact 3D Coordinate Placement & Collision Check inside Bay A
    # Bay A local coordinates: X in [0, 510], Y in [0, 470], Z in [0, 48] mm
    # -------------------------------------------------------------------------
    placed_solids = []  # list of dict(name, type, mesh, params)

    # A) 3 Outer Mast Carrier Tubes (OD 44.0 mm, L 460.0 mm), along X at X=[4, 464]
    #    Centered in Z at Z = 24.0 mm (Z range [2.0, 46.0] -> 2.0 mm clearance top & bottom!)
    #    Y centers: 24.0, 70.0, 116.0 mm (pitch = 46.0 mm -> 2.0 mm gap between tubes!)
    for i in range(3):
        cy = 24.0 + i * 46.0
        cz = 24.0
        r = 22.0
        m = make_cyl_x_mesh(4.0, 460.0, cy, cz, r)
        placed_solids.append({
            "name": f"mast_carrier_{i+1}",
            "kind": "cyl_x",
            "x0": 4.0, "x1": 464.0, "cy": cy, "cz": cz, "r": r,
            "mesh": m,
        })

    # B) 24 Perimeter Strut Carrier Tubes (OD 24.0 mm, L 440.0 mm), along X at X=[4, 444]
    #    Arranged in optimal HEXAGONAL STAGGERED 2-LAYER CLOSE-PACKING!
    #    Row 1 (bottom, 12 tubes): Z = 12.5 mm (Z range [0.5, 24.5]), Y pitch = 25.4 mm
    #      Y starts at 152.0 mm -> 152.0 + 11*25.4 = 431.4 mm (max Y = 443.4 mm <= 470.0 mm!)
    #    Row 2 (top, 12 tubes, staggered by +12.7 mm in Y):
    #      Vertical delta_z = sqrt((24.0 + 1.2)^2 - 12.7^2) = sqrt(635.04 - 161.29) = 21.77 mm
    #      Let's use delta_z = 22.2 mm -> Z = 12.5 + 22.2 = 34.7 mm (Z range [22.7, 46.7] <= 48.0 mm!)
    #      Y starts at 152.0 + 12.7 = 164.7 mm -> 164.7 + 11*25.4 = 444.1 mm (max Y = 456.1 mm <= 470.0 mm!)
    y_start = 152.0
    pitch_y = 25.4
    z_row1 = 12.5
    z_row2 = 34.7
    r_strut = 12.0
    for i in range(12):
        cy1 = y_start + i * pitch_y
        placed_solids.append({
            "name": f"strut_carrier_low_{i+1}",
            "kind": "cyl_x",
            "x0": 4.0, "x1": 444.0, "cy": cy1, "cz": z_row1, "r": r_strut,
            "mesh": make_cyl_x_mesh(4.0, 440.0, cy1, z_row1, r_strut),
        })
        cy2 = y_start + pitch_y * 0.5 + i * pitch_y
        placed_solids.append({
            "name": f"strut_carrier_hi_{i+1}",
            "kind": "cyl_x",
            "x0": 4.0, "x1": 444.0, "cy": cy2, "cz": z_row2, "r": r_strut,
            "mesh": make_cyl_x_mesh(4.0, 440.0, cy2, z_row2, r_strut),
        })

    # C) Auxiliary Hardware Tray in remaining X zone [448, 506] (58 mm wide x 320 mm tall x 44 mm deep!)
    #    Wait: mast ends at X=464 for Y in [0, 140], and struts end at X=444 for Y in [140, 468]!
    #    Let's place exact non-overlapping hardware blocks:
    #    1) CNC 7075-T6 Apex Hub + 12 Strut Caps tray: X=[448, 506] (58mm), Y=[146, 306] (160mm), Z=[2, 46] (44mm)
    #       (Apex hub OD = 130 mm x 36 mm thick fits vertically inside 160 x 44 mm? Wait: diameter 130mm in Y, thickness 36mm in Z, X needs 130mm!
    #        AHA! Catch! A 130mm dia disc lying flat in Y-Z needs 130mm in Z -> WON'T FIT in 48mm Z!
    #        It must lie flat in X-Y plane (thickness in Z = 36mm <= 48mm), so it needs 130mm x 130mm in X-Y!
    #        Let's verify! In Bay A, X=[448..506] is only 58mm wide! Good thing we ran exact 3D placement!!)
    #    FIX (REAL ENGINEERING!):
    #    Place the flat 130mm CNC Apex Hub (dia 130mm x H 34mm) in a dedicated recessed pocket in Bay B corner
    #    OR adjust Apex Hub to a slim 96mm CNC 7075-T6 Splined Ring Hub (OD 96mm x H 28mm, fits flat in Bay B corner tray),
    #    AND use Bay A's X=[448, 506], Y=[146, 466], Z=[2, 46] (58 x 320 x 44 mm = 0.817 L) for:
    #      - 12x CNC 7075-T6 Strut Tip Caps & Base Ferrules tray: X=[448, 506], Y=[146, 290], Z=[2, 46]
    #      - Dyneema 2.0mm Cable Spools (24 lines + tensioners): X=[448, 506], Y=[294, 466], Z=[2, 46]
    #      - Stake Strike Hammer Cap + Repair Kit: X=[468, 506], Y=[6, 136], Z=[2, 46]
    aux_boxes = [
        ("strut_caps_ferrules_tray", 448.0, 506.0, 146.0, 290.0, 2.0, 46.0),
        ("dyneema_cable_spool_tray", 448.0, 506.0, 294.0, 466.0, 2.0, 46.0),
        ("strike_cap_repair_tray",   468.0, 506.0,   6.0, 136.0, 2.0, 46.0),
    ]
    for name, x0, x1, y0, y1, z0, z1 in aux_boxes:
        cx, cy, cz = 0.5*(x0+x1), 0.5*(y0+y1), 0.5*(z0+z1)
        sx, sy, sz = x1-x0, y1-y0, z1-z0
        placed_solids.append({
            "name": name,
            "kind": "box",
            "x0": x0, "x1": x1, "y0": y0, "y1": y1, "z0": z0, "z1": z1,
            "mesh": make_box_mesh(cx, cy, cz, sx, sy, sz),
        })

    # Verify EVERY solid stays strictly inside Bay A [0, 510] x [0, 470] x [0, 48] mm
    bay_a_bounds_ok = True
    max_bound_violation = 0.0
    for s in placed_solids:
        bmin, bmax = s["mesh"].bounds
        v = max(
            -bmin[0], -bmin[1], -bmin[2],
            bmax[0] - spec.INNER_L_MM,
            bmax[1] - spec.INNER_H_MM,
            bmax[2] - spec.BAY_A_Z_MM,
        )
        if v > max_bound_violation:
            max_bound_violation = v
        if v > 1e-6:
            bay_a_bounds_ok = False
        results["components_bay_a"].append({
            "name": s["name"],
            "bounds_min_mm": [round(float(x), 2) for x in bmin],
            "bounds_max_mm": [round(float(x), 2) for x in bmax],
            "volume_cm3": round(float(s["mesh"].volume) / 1000.0, 1),
        })

    # Pairwise EXACT analytical & mesh distance / collision verification across ALL pairs!
    min_pair_gap_mm = 1e9
    collisions = []
    n_solids = len(placed_solids)
    for i in range(n_solids):
        for j in range(i + 1, n_solids):
            a, b = placed_solids[i], placed_solids[j]
            if a["kind"] == "cyl_x" and b["kind"] == "cyl_x":
                # Check X overlap first
                gap_x = max(a["x0"] - b["x1"], b["x0"] - a["x1"])
                dist_yz = math.hypot(a["cy"] - b["cy"], a["cz"] - b["cz"]) - (a["r"] + b["r"])
                gap = max(gap_x, dist_yz)
            else:
                # Exact AABB gap (conservative lower bound on gap for box-cyl and box-box)
                amin, amax = a["mesh"].bounds
                bmin, bmax = b["mesh"].bounds
                gx = max(amin[0] - bmax[0], bmin[0] - amax[0])
                gy = max(amin[1] - bmax[1], bmin[1] - amax[1])
                gz = max(amin[2] - bmax[2], bmin[2] - amax[2])
                gap = max(gx, gy, gz)
            if gap < min_pair_gap_mm:
                min_pair_gap_mm = gap
            if gap < 0.0:
                collisions.append((a["name"], b["name"], round(gap, 3)))

    results["checks"]["bay_a_bounds_fit"] = {
        "pass": bay_a_bounds_ok,
        "max_bound_violation_mm": round(max(0.0, max_bound_violation), 4),
        "bay_a_dims_mm": [spec.INNER_L_MM, spec.INNER_H_MM, spec.BAY_A_Z_MM],
    }
    results["checks"]["bay_a_zero_3d_collision"] = {
        "pass": len(collisions) == 0 and min_pair_gap_mm >= 0.5,
        "pair_count_checked": n_solids * (n_solids - 1) // 2,
        "collision_count": len(collisions),
        "min_inter_part_gap_mm": round(min_pair_gap_mm, 3),
        "limit_min_gap_mm": 0.5,
        "collisions": collisions,
    }

    # -------------------------------------------------------------------------
    # CHECK 4: Bay B Volumetric Packing (Fabrics + Air Mats + Apex Hub Pocket)
    # Bay B = 510 x 470 x 105 mm = 25.1685 L
    # -------------------------------------------------------------------------
    bay_b_items = []
    total_bay_b_L = 0.0
    for key, f in spec.FABRICS.items():
        vol_L = f["area_m2"] * f["pack_L_per_m2"]
        bay_b_items.append({
            "name": key,
            "material": f["material"],
            "area_m2": round(f["area_m2"], 2),
            "pack_factor_L_per_m2": f["pack_L_per_m2"],
            "packed_vol_L": round(vol_L, 3),
        })
        total_bay_b_L += vol_L

    # Zippers, seam tape, corner webbing, line-locks
    zippers_vol_L = 1.40
    bay_b_items.append({"name": "ykk5_zippers_webbing_hardware", "packed_vol_L": zippers_vol_L})
    total_bay_b_L += zippers_vol_L

    # CNC 7075-T6 Apex Hub (OD 110 mm x 28 mm flat ring) + Base Mast Socket (OD 70 mm x 35 mm)
    apex_hub_box_L = (120.0 * 120.0 * 32.0) / 1e6  # 0.461 L
    bay_b_items.append({"name": "cnc_apex_hub_and_base_socket", "packed_vol_L": round(apex_hub_box_L, 3)})
    total_bay_b_L += apex_hub_box_L

    # 48x Detachable PA66-GF30 helical anchor flight discs (OD 52mm x 3.5mm), coin-stacked in 2 sleeves (108 x 54 x 86 mm = 0.50 L)
    helix_discs_L = (108.0 * 54.0 * 86.0) / 1e6  # 0.502 L
    bay_b_items.append({"name": "48x_bayonet_helical_flight_discs", "packed_vol_L": round(helix_discs_L, 3)})
    total_bay_b_L += helix_discs_L

    # 2x R5.2 Insulated Sleeping Mats (folded flat: 450 x 220 x 18 mm = 1.782 L each)
    mats_vol_L = spec.SLEEP_MAT_COUNT * spec.SLEEP_MAT_PACKED_L_EACH  # 3.60 L
    bay_b_items.append({"name": "2x_R5.2_insulated_air_mats", "packed_vol_L": round(mats_vol_L, 3)})
    total_bay_b_L += mats_vol_L

    bay_b_fill_pct = 100.0 * total_bay_b_L / spec.BAY_B_VOL_L
    results["components_bay_b"] = bay_b_items
    results["checks"]["bay_b_conservative_packing"] = {
        "pass": bay_b_fill_pct <= 92.0,
        "used_vol_L": round(total_bay_b_L, 3),
        "capacity_vol_L": round(spec.BAY_B_VOL_L, 3),
        "fill_pct": round(bay_b_fill_pct, 2),
        "margin_L": round(spec.BAY_B_VOL_L - total_bay_b_L, 3),
        "limit_max_fill_pct": 92.0,
    }

    # -------------------------------------------------------------------------
    # CHECK 5: Deployed Pavilion 3D Mesh Generation & Kinematic Closure
    # Also export watertight STL for OpenFOAM 3D CFD wind tunnel!
    # -------------------------------------------------------------------------
    R = spec.CIRCUM_RADIUS_M
    hw = spec.WALL_HEIGHT_M
    Hp = spec.APEX_HEIGHT_M
    n = spec.N_SIDES

    verts = []
    # 0..11: bottom perimeter (z=0)
    for k in range(n):
        ang = 2.0 * math.pi * k / n
        verts.append([R * math.cos(ang), R * math.sin(ang), 0.0])
    # 12..23: wall top / eave junction (z=hw)
    for k in range(n):
        ang = 2.0 * math.pi * k / n
        verts.append([R * math.cos(ang), R * math.sin(ang), hw])
    # 24: apex (0, 0, Hp)
    verts.append([0.0, 0.0, Hp])
    # 25: floor center (0, 0, 0)
    verts.append([0.0, 0.0, 0.0])

    faces = []
    for k in range(n):
        kn = (k + 1) % n
        # Floor triangle (normal down -Z)
        faces.append([25, kn, k])
        # Wall quad (2 triangles, normal outward)
        faces.append([k, kn, 12 + kn])
        faces.append([k, 12 + kn, 12 + k])
        # Roof triangle (normal outward-up)
        faces.append([12 + k, 12 + kn, 24])

    pav_mesh = trimesh.Trimesh(vertices=np.array(verts), faces=np.array(faces), process=True)
    trimesh.repair.fix_normals(pav_mesh)
    vol_mesh = float(abs(pav_mesh.volume))
    vol_analytic = spec.INTERIOR_VOLUME_M3
    vol_err_pct = abs(vol_mesh - vol_analytic) / vol_analytic * 100.0

    # Save watertight STL for OpenFOAM CFD!
    stl_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results", "pavilion_d12_500.stl")
    os.makedirs(os.path.dirname(stl_path), exist_ok=True)
    pav_mesh.export(stl_path)

    # Verify assembled member length closure:
    mast_assembled_mm = 7 * spec.MAST_SEG_LEN_MM - 6 * spec.MAST_OVERLAP_MM - 20.0  # -20mm base socket seat
    strut_assembled_mm = 4 * spec.STRUT_SEG_LEN_MM - 3 * spec.STRUT_OVERLAP_MM
    mast_err_mm = abs(mast_assembled_mm - spec.APEX_HEIGHT_M * 1000.0)
    strut_err_mm = abs(strut_assembled_mm - spec.WALL_HEIGHT_M * 1000.0)

    results["checks"]["deployed_kinematic_closure"] = {
        "pass": pav_mesh.is_watertight and vol_err_pct < 0.05 and mast_err_mm < 0.5 and strut_err_mm < 0.5,
        "stl_watertight": bool(pav_mesh.is_watertight),
        "mesh_volume_m3": round(vol_mesh, 4),
        "analytic_volume_m3": round(vol_analytic, 4),
        "volume_error_pct": round(vol_err_pct, 5),
        "mast_closure_err_mm": round(mast_err_mm, 3),
        "strut_closure_err_mm": round(strut_err_mm, 3),
        "stl_exported": stl_path,
    }

    results["all_pass"] = all(c["pass"] for c in results["checks"].values())
    out_json = os.path.join(os.path.dirname(os.path.abspath(__file__)), "results", "sim1_geometry_packing.json")
    with open(out_json, "w", encoding="utf-8") as fp:
        json.dump(results, fp, indent=2, ensure_ascii=False)

    print(json.dumps(results["checks"], indent=2, ensure_ascii=False))
    print(f"SIM-1 OVERALL: {'PASS' if results['all_pass'] else 'FAIL'}")
    return results


if __name__ == "__main__":
    res = run_simulation()
    sys.exit(0 if res["all_pass"] else 1)
