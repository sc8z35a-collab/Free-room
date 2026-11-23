"""
MASTER VERIFICATION RUNNER: FREE-ROOM D12-500 Multi-Physics & Engineering Suite
===============================================================================
Executes all 8 independent physics, structural, fluid, geotechnical, thermal,
hydraulic, multibody, and manufacturability simulations sequentially with strict
FSI data coupling:

  SIM-1 -> Trimesh 3D Solid Geometry, Interference/Collision & 52x16x48cm Packing
  SIM-2 -> OpenFOAM 3D Turbulent RANS Wind Tunnel CFD (k-omega SST, 20 & 25 m/s)
  SIM-3 -> CalculiX (ccx) 3D FEA Nonlinear Static, Eigenvalue Buckling & Modal (FSI)
  SIM-4 -> PyBullet 3D Rigid-Body & Articulated Clamshell Multibody Dynamics
  SIM-5 -> Geotechnical Rankine/Broms/Meyerhof Anchor Pull-Out (4 Soil Types)
  SIM-6 -> SciPy RK45 Coupled Thermal, Psychrometric, Stack Ventilation & Condensation
  SIM-7 -> Extreme 100 mm/h Rainfall Runoff, Hydrostatic Head & Ponding Stability
  SIM-8 -> Commercial DFM/DFA Manufacturability, BOM, Mass Tolerance & Solo Ergonomics

Exits with code 0 ONLY if 100% of checks across ALL 8 simulations PASS.
"""

import json
import os
import sys
import time

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(BASE_DIR, "results")
sys.path.insert(0, BASE_DIR)

import design_spec as spec
import sim1_geometry_packing
import sim2_openfoam_cfd
import sim3_calculix_fea
import sim4_pybullet_mbd
import sim5_geotech_anchor
import sim6_thermal_hygro
import sim7_rain_ponding
import sim8_bom_dfm


def main():
    t0 = time.time()
    os.makedirs(RESULTS_DIR, exist_ok=True)

    suites = [
        ("SIM-1", sim1_geometry_packing.run_simulation),
        ("SIM-2", sim2_openfoam_cfd.run_simulation),
        ("SIM-3", sim3_calculix_fea.run_simulation),
        ("SIM-4", sim4_pybullet_mbd.run_simulation),
        ("SIM-5", sim5_geotech_anchor.run_simulation),
        ("SIM-6", sim6_thermal_hygro.run_simulation),
        ("SIM-7", sim7_rain_ponding.run_simulation),
        ("SIM-8", sim8_bom_dfm.run_simulation),
    ]

    master = {
        "design_spec": spec.get_summary_dict(),
        "simulations": {},
        "total_checks": 0,
        "passed_checks": 0,
        "failed_checks": [],
        "all_100_percent_pass": False,
    }

    for key, fn in suites:
        print("\n" + "=" * 78)
        print(f"RUNNING {key} ...")
        print("=" * 78)
        res = fn()
        master["simulations"][key] = res
        for cname, cdata in res["checks"].items():
            master["total_checks"] += 1
            if cdata["pass"]:
                master["passed_checks"] += 1
            else:
                master["failed_checks"].append(f"{key}::{cname}")

    master["pass_rate_pct"] = round(100.0 * master["passed_checks"] / max(1, master["total_checks"]), 2)
    master["all_100_percent_pass"] = (master["passed_checks"] == master["total_checks"])
    master["elapsed_sec"] = round(time.time() - t0, 2)

    out_path = os.path.join(RESULTS_DIR, "master_verification_report.json")
    with open(out_path, "w", encoding="utf-8") as fp:
        json.dump(master, fp, indent=2, ensure_ascii=False)

    print("\n" + "#" * 78)
    print(f"MASTER VERIFICATION SUMMARY ({master['elapsed_sec']} s)")
    print(f"  Checks Passed : {master['passed_checks']} / {master['total_checks']} ({master['pass_rate_pct']}%)")
    if master["failed_checks"]:
        print(f"  FAILED CHECKS : {master['failed_checks']}")
    else:
        print("  STATUS        : 100% ALL PASS — CERTIFIED BUILDABLE & PHYSICALLY VERIFIED")
    print("#" * 78)

    sys.exit(0 if master["all_100_percent_pass"] else 1)


if __name__ == "__main__":
    main()
