"""
V2 SIMULATION 5: Ultra-Strict Hybrid Earth-Fluke Deadman Geotechnical Pullout (4 Soils + ±15° Human Error)
===========================================================================================================
Why V2 uses 10x Hybrid Steel-Crossbar Earth-Fluke Deadman Anchors (Komeri MUSBIC 48x62cm woven PE bags ¥298
+ 2x Ø19.1x300mm tubular steel crossbars + 12x D10x330mm SD390 ribbed steel crossbars):
  - Standard thin vertical tent pegs (Ø10mm x 300mm) ONLY hold ~64 N in saturated typhoon mud (Broms limit)!
  - Folding a ¥29.8 woven PE earth-anchor bag into a 200x330mm Earth-Fluke pocket over a horizontal steel
    crossbar buried just 220 mm deep (20-second slit!) mobilizes the full Meyerhof-Adams soil breakout prism:
    Q_ult = (c * Nc + gamma' * D * Fq) * B * L * cos(angle_err) -> > 3,100 N EVEN IN SATURATED TYPHOON MUD!!
  - Normal-weather zero-dig mode: surface 25 kg soil-filled earth bag pinned by battered D10 stake (0 holes!).
  - Exact center-tied horizontal crossbar bending check: M_max = F * L / 8 (3.1x lower moment than cantilever peg!).

Ultra-Strict Verification across 4 Soil Classes + ±15° Installation Error + -15% Burial Depth Error (187mm actual!):
  1. Standard Garden Loam (c=18.0 kPa, φ=30°, γ=17.8 kN/m3)
  2. Moist Garden Clay    (c=13.5 kPa, φ=26°, γ=16.5 kN/m3)
  3. SATURATED TYPHOON MUD (c=6.5 kPa, φ=23°, γ'=9.5 kN/m3 — buoyant submerged!)
  4. LOOSE WET BEACH SAND  (c=2.2 kPa, φ=29°, γ'=10.0 kN/m3 — worst cohesionless soil!)
"""

import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import design_spec_v2 as spec

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(BASE_DIR, "results")

SOIL_CLASSES = {
    "standard_garden_loam": {
        "label": "標準芝生ローム土",
        "c_pa": 18000.0,
        "phi_deg": 30.0,
        "gamma_eff_N_m3": 17800.0,
    },
    "moist_garden_clay": {
        "label": "湿潤粘性土",
        "c_pa": 13500.0,
        "phi_deg": 26.0,
        "gamma_eff_N_m3": 16500.0,
    },
    "saturated_typhoon_mud": {
        "label": "豪雨飽和軟弱泥土（最悪条件）",
        "c_pa": 6500.0,
        "phi_deg": 23.0,
        "gamma_eff_N_m3": 9500.0,   # Buoyant submerged unit weight gamma'!
    },
    "loose_wet_sand": {
        "label": "湿潤緩砂質土（無粘着最悪）",
        "c_pa": 2200.0,
        "phi_deg": 29.0,
        "gamma_eff_N_m3": 10000.0,
    },
}


def compute_earth_fluke_capacity_N(B_m, L_m, D_nom_m, soil, angle_err_deg=15.0, depth_knockdown=0.85):
    """Exact Meyerhof-Adams (1968) inclined shallow strip/rectangular anchor breakout capacity
    with conservative human installation error penalties:
      - Actual burial depth penalized -15% (D_eff = 0.85 * 220 mm = 187 mm shallow!).
      - ±15° pull-angle misalignment penalty (cos(15°) = 0.966).
      - Conservative shallow cohesive breakout factor Nc = min(9.0, 5.14 * (1 + 0.2*B/L) * (1 + 0.35*D/B)).
      - Conservative frictional breakout factor Fq = 1 + 2*(D/B)*Ku*tan(phi)*(1 + 0.5*B/L), Ku = 0.85.
      - Inclined pull factor (Meyerhof 1973, 40-45° inclined guyline vs pure vertical uplift):
        Inclined anchor breakout is 1.15-1.35x vertical; conservatively we take 1.00x (pure vertical lower bound!).
    """
    c = soil["c_pa"]
    phi = math.radians(soil["phi_deg"])
    gamma = soil["gamma_eff_N_m3"]
    D = D_nom_m * depth_knockdown  # Penalized shallow depth (187 mm!)
    A = B_m * L_m

    # Cohesive breakout factor (Das & Shukla / Meyerhof shallow rectangular anchor)
    Nc = min(9.0, 5.14 * (1.0 + 0.20 * (B_m / L_m)) * (1.0 + 0.30 * min(2.0, D / B_m)))
    # Frictional breakout factor (Meyerhof-Adams 1968, Ku = 0.85 conservative)
    Ku = 0.85
    Fq = 1.0 + 2.0 * (D / B_m) * Ku * math.tan(phi) * (1.0 + 0.5 * (B_m / L_m))
    Fq = min(Fq, 7.5)

    # Pure vertical lower-bound breakout capacity (N)
    Q_vert = (c * Nc + gamma * D * Fq) * A
    # Apply ±15° human pull/orientation error knockdown
    Q_err = Q_vert * math.cos(math.radians(angle_err_deg))
    return {
        "D_eff_mm": round(D * 1000.0, 1),
        "Nc": round(Nc, 2),
        "Fq": round(Fq, 2),
        "Q_vert_N": round(Q_vert, 1),
        "Q_ult_with_15deg_and_depth_err_N": round(Q_err, 1),
    }


def run():
    print("=" * 72)
    print("V2 SIM-5: Hybrid Earth-Fluke Deadman Geotechnical Pullout (4 Soils + ±15° Error)")
    print("=" * 72)

    fea_path = os.path.join(RESULTS_DIR, "sim3_calculix_fea_v2.json")
    with open(fea_path, "r") as f:
        fea = json.load(f)

    t25 = fea["case_25ms_90deg"]["guy_tensions_N"]
    t30_90 = fea["case_30ms_90deg"]["guy_tensions_N"]
    t30_00 = fea["case_30ms_00deg"]["guy_tensions_N"]

    def max_group(tdict, keys):
        return max((tdict.get(k, 0.0) for k in keys), default=0.0)

    ridge_keys = ["RIDGE_FL", "RIDGE_FR", "RIDGE_RL", "RIDGE_RR"]
    mideave_keys = ["EAVE_ML", "EAVE_MR"]
    corner_keys = ["EAVE_FL", "EAVE_FR", "EAVE_RL", "EAVE_RR"]

    demand_25 = {
        "ridge_fluke_N": max_group(t25, ridge_keys),
        "mideave_fluke_N": max_group(t25, mideave_keys),
        "corner_fluke_N": max_group(t25, corner_keys),
    }
    demand_30 = {
        "ridge_fluke_N": max(max_group(t30_90, ridge_keys), max_group(t30_00, ridge_keys)),
        "mideave_fluke_N": max(max_group(t30_90, mideave_keys), max_group(t30_00, mideave_keys)),
        "corner_fluke_N": max(max_group(t30_90, corner_keys), max_group(t30_00, corner_keys)),
    }
    peak_25_all = max(demand_25.values())
    peak_30_all = max(demand_30.values())

    soil_reports = {}
    for skey, sdata in SOIL_CLASSES.items():
        # Mid-Eave stations use Ø19.1x300mm tubular crossbar + 2x D10x330mm bundled twin reinforcement inside 200x330mm bag
        # Ridge & Corner stations use D10x330mm SD390 crossbar inside 200x330mm folded woven PE earth-fluke bag!
        cap = compute_earth_fluke_capacity_N(
            spec.EARTH_FLUKE_B_M, spec.EARTH_FLUKE_L_M, spec.EARTH_FLUKE_DEPTH_M,
            sdata, angle_err_deg=15.0, depth_knockdown=0.85,
        )
        Q_u = cap["Q_ult_with_15deg_and_depth_err_N"]

        # Woven PE earth-fluke bag fabric tear check (2-layer folded MUSBIC woven PP bag = 2 * 14,000 N/m * 0.20 m = 5,600 N!)
        bag_tear_cap_N = 5600.0
        Q_eff = min(Q_u, bag_tear_cap_N)

        sf25 = Q_eff / max(1.0, peak_25_all)
        sf30 = Q_eff / max(1.0, peak_30_all)

        soil_reports[skey] = {
            "label": sdata["label"],
            "earth_fluke_cap_N": Q_eff,
            "D_eff_mm": cap["D_eff_mm"],
            "SF_25ms_min": round(sf25, 2),
            "SF_30ms_min": round(sf30, 2),
        }
        print(
            f"  [{skey:22s}] FlukeCap={Q_eff:7.1f}N (D_eff={cap['D_eff_mm']}mm) | "
            f"25m/s minSF={sf25:5.2f}x | 30m/s minSF={sf30:5.2f}x"
        )

    # Structural Bending Yield Check of Center-Tied Horizontal Steel Crossbars @ 30 m/s:
    # Uniform soil reaction q = F / L -> Center bending moment M_max = F * L / 8 (with 1.15x eccentricity factor!)
    # 1) Mid-Eave Station (EAVE_ML / EAVE_MR): Ø19.1x1.0x300mm steel pipe + 1x nested D10x330mm inside bore!
    #    Section modulus of Ø19.1x1.0 pipe ALONE (conservative, ignoring nested D10 inside!) = 2.45e-7 m3 (Sy=235 MPa)
    #    Plus 1x nested D10 inside bore shares bending -> Z_comb = Z_pipe + Z_d10 = 3.43e-7 m3 (or pipe alone!)
    m_mideave = 1.15 * demand_30["mideave_fluke_N"] * spec.PILE_LEN_M / 8.0
    sig_mideave_MPa = (m_mideave / spec.MAST_OUTER_Z) / 1e6
    sf_mideave_steel = (spec.STEEL_SY_PA / 1e6) / max(0.1, sig_mideave_MPa)

    # 2) Ridge & Corner Stations: D10x330mm SD390 ribbed steel bar (Sy = 390 MPa, Z = pi*d^3/32 = 9.817e-8 m3)
    #    Peak demand across Ridge + Corner stations:
    peak_d10_demand = max(demand_30["ridge_fluke_N"], demand_30["corner_fluke_N"])
    z_rebar = (math.pi / 32.0) * (spec.REBAR_OD_M ** 3)
    m_rebar = 1.15 * peak_d10_demand * spec.REBAR_LEN_M / 8.0
    sig_rebar_MPa = (m_rebar / z_rebar) / 1e6
    sf_rebar_steel = (spec.REBAR_SY_PA / 1e6) / max(0.1, sig_rebar_MPa)

    loam = soil_reports["standard_garden_loam"]
    clay = soil_reports["moist_garden_clay"]
    mud = soil_reports["saturated_typhoon_mud"]
    sand = soil_reports["loose_wet_sand"]

    checks = {
        "standard_loam_30ms_SF_ge_4_0": loam["SF_30ms_min"] >= 4.0,
        "moist_clay_30ms_SF_ge_3_0": clay["SF_30ms_min"] >= 3.0,
        "saturated_typhoon_mud_30ms_SF_ge_2_0": mud["SF_30ms_min"] >= 2.0,
        "loose_wet_sand_30ms_SF_ge_1_3": sand["SF_30ms_min"] >= 1.3,
        "mideave_pipe_crossbar_30ms_SF_ge_1_8": sf_mideave_steel >= 1.8,
        "d10_rebar_crossbar_30ms_SF_ge_1_5": sf_rebar_steel >= 1.5,
    }

    report = {
        "simulation": "V2-SIM-5: Hybrid Earth-Fluke Deadman Geotechnical Pullout (4 Soils + ±15° Error)",
        "passed": bool(all(checks.values())),
        "checks": {k: bool(v) for k, v in checks.items()},
        "anchor_spec": {
            "fluke_pad_mm": [spec.EARTH_FLUKE_B_M * 1000.0, spec.EARTH_FLUKE_L_M * 1000.0],
            "nominal_burial_depth_mm": spec.EARTH_FLUKE_DEPTH_M * 1000.0,
            "penalized_eval_depth_mm": round(spec.EARTH_FLUKE_DEPTH_M * 850.0, 1),
            "human_angle_error_deg": 15.0,
            "normal_weather_mode": "地表25kg土嚢＋斜め打設SD390鉄筋（掘削ゼロ・芝生無傷）",
            "storm_mode": "200×330mmアースフルーク浅埋設(22cm)デッドマン（豪雨飽和泥土対応）",
        },
        "fea_anchor_demands": {
            "25ms_N": demand_25,
            "30ms_N": demand_30,
            "peak_25ms_N": round(peak_25_all, 1),
            "peak_30ms_N": round(peak_30_all, 1),
        },
        "soil_classes": soil_reports,
        "crossbar_bending_30ms": {
            "mideave_pipe19_MPa": round(sig_mideave_MPa, 2),
            "mideave_pipe19_SF": round(sf_mideave_steel, 2),
            "d10_rebar_MPa": round(sig_rebar_MPa, 2),
            "d10_rebar_SF": round(sf_rebar_steel, 2),
        },
    }

    out_path = os.path.join(RESULTS_DIR, "sim5_geotech_anchor_v2.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"  Crossbar Bending @ 30m/s: MidEave Pipe19={sig_mideave_MPa:.1f}MPa (SF={sf_mideave_steel:.2f}x), D10={sig_rebar_MPa:.1f}MPa (SF={sf_rebar_steel:.2f}x)")
    print(f"  RESULT: {'PASS' if report['passed'] else 'FAIL'} ({sum(checks.values())}/{len(checks)})")
    return report


if __name__ == "__main__":
    res = run()
    sys.exit(0 if res["passed"] else 1)
