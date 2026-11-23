"""
FREE-ROOM V2 "AERO-PRISM P300" — Master 9-Domain Ultra-Strict Multi-Physics Verification Runner
==============================================================================================
Executes all 9 local industrial & probabilistic physics solvers sequentially and compiles
`v2/simulations/results/master_verification_report_v2.json`:
  SIM-1: Trimesh 3D Solid Geometry, Zero-Case Soft-Roll (+5% tol) & 2D Zero-Waste Cutting
  SIM-2: OpenFOAM 3-Azimuth (0°/45°/90°) 3D Turbulent Wind Tunnel CFD (k-omega SST, up to 30 m/s)
  SIM-3: CalculiX 2.21 6-Case 3D Nonlinear FEA (*STATIC NLGEOM, *BUCKLE, *FREQUENCY, 0.65x joint knockdown)
  SIM-4: PyBullet 3D Rigid-Body Multibody Dynamics (1.0m Drop, 5° Slope, 30 m/s Gust Impulse, 95kg Occupant)
  SIM-5: Dual-Mechanism Broms+Meyerhof Geotechnical Anchor Pullout (4 Soil Classes + ±15° Human Error)
  SIM-6: 7-Layer 100% Rain Non-Ingress Guarantee (50k Lagrangian Droplets @ 150mm/h + 30m/s + 200mm Flood)
  SIM-7: 72-Hour Coupled Transient Diurnal Hygrothermal & CO2 ODE (Summer 38°C / Winter -5°C / Typhoon 100%RH)
  SIM-8: 50,000-Trial Stochastic Monte Carlo Reliability & Sobol Global Sensitivity (16 Uncertainties)
  SIM-9: Zero-Cheating Budget (<=¥6,000), Zero-Case/CNC/Electric/Intl-Shipping & DFM Compliance Audit
"""

import datetime
import json
import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(BASE_DIR, "results")
sys.path.insert(0, BASE_DIR)

import sim1_geometry_packing_v2 as sim1
import sim2_openfoam_cfd_v2 as sim2
import sim3_calculix_fea_v2 as sim3
import sim4_pybullet_mbd_v2 as sim4
import sim5_geotech_anchor_v2 as sim5
import sim6_rain_zero_ingress_v2 as sim6
import sim7_hygrothermal_72h_v2 as sim7
import sim8_montecarlo_reliability_v2 as sim8
import sim9_bom_dfm_compliance_v2 as sim9


def main():
    sims = [sim1, sim2, sim3, sim4, sim5, sim6, sim7, sim8, sim9]
    results = []
    total_checks = 0
    passed_checks = 0

    for mod in sims:
        res = mod.run()
        results.append(res)
        chk = res["checks"]
        total_checks += len(chk)
        passed_checks += sum(1 for v in chk.values() if v)

    all_passed = all(r["passed"] for r in results) and (passed_checks == total_checks)
    master = {
        "project": "FREE-ROOM V2 AERO-PRISM P300",
        "timestamp_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "all_passed": all_passed,
        "total_simulations": len(results),
        "simulations_passed": sum(1 for r in results if r["passed"]),
        "total_checks": total_checks,
        "passed_checks": passed_checks,
        "pass_rate_pct": round(passed_checks / max(1, total_checks) * 100.0, 2),
        "summary_table": [
            {
                "simulation": r["simulation"],
                "passed": r["passed"],
                "checks_passed": sum(1 for v in r["checks"].values() if v),
                "checks_total": len(r["checks"]),
            }
            for r in results
        ],
    }

    out_path = os.path.join(RESULTS_DIR, "master_verification_report_v2.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(master, f, indent=2, ensure_ascii=False)

    print("\n" + "=" * 72)
    print(f"MASTER V2 ULTRA-STRICT VERIFICATION: {passed_checks} / {total_checks} CHECKS ({master['pass_rate_pct']}%)")
    for row in master["summary_table"]:
        status = "PASS" if row["passed"] else "FAIL"
        print(f"  [{status}] {row['checks_passed']}/{row['checks_total']} | {row['simulation']}")
    print("=" * 72)
    return 0 if all_passed else 1


if __name__ == "__main__":
    sys.exit(main())
