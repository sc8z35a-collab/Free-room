"""
FREE-ROOM D12-500: Single Source of Truth Engineering Specification
====================================================================
Ultra-compact foldable garden accommodation dwelling.
Packed outer envelope: 520 mm (L) x 160 mm (W) x 480 mm (H) = 39.936 L
Deployed geometry: Regular Dodecagonal (12-sided) Tension-Ring Pavilion
  - Circumdiameter: 5.00 m (Flat-to-flat: 4.830 m)
  - Vertical Wall Height: 1.60 m (100% usable headroom right to the walls)
  - Apex Height: 2.90 m (Roof slope: 28.25 deg ≈ 5.4 sun pitch)
  - Floor Area: 18.75 m^2 (~11.6 Japanese tatami mats)
  - Interior Volume: 38.125 m^3 (954.7x volume expansion ratio!)
"""

import math
from dataclasses import dataclass, asdict

# =============================================================================
# 1. PACKED ENVELOPE CONSTRAINTS (STRICT — 0.0 mm OVERAGE ALLOWED)
# =============================================================================
PACKED_EXT_L_MM = 520.0   # Length (X) = 52.0 cm
PACKED_EXT_W_MM = 160.0   # Thickness (Z) = 16.0 cm
PACKED_EXT_H_MM = 480.0   # Height (Y) = 48.0 cm
PACKED_EXT_VOL_L = (PACKED_EXT_L_MM * PACKED_EXT_W_MM * PACKED_EXT_H_MM) / 1e6  # 39.936 L

# Structural clamshell case wall & frame allowances:
# - Outer skins: 2.0 mm high-modulus 3K carbon/epoxy composite panels (503 MPa, 1.33 g/cm^3)
# - Perimeter frame: 5.0 mm extruded 7075-T6 aluminum channel + EPDM waterproof gasket
# - Internal clear usable dimensions:
CASE_FRAME_MARGIN_XY_MM = 5.0   # per side -> 10.0 mm total on L and H
CASE_SKIN_THICK_MM = 2.5        # per face -> 5.0 mm total on Z (2mm CFRP + 0.5mm liner/flange)
CASE_DIVIDER_THICK_MM = 2.0     # internal rigid carbon/PE divider between Bay A and Bay B

INNER_L_MM = PACKED_EXT_L_MM - 2 * CASE_FRAME_MARGIN_XY_MM  # 510.0 mm
INNER_H_MM = PACKED_EXT_H_MM - 2 * CASE_FRAME_MARGIN_XY_MM  # 470.0 mm
INNER_W_MM = PACKED_EXT_W_MM - 2 * CASE_SKIN_THICK_MM       # 155.0 mm (total clear Z)

# Asymmetric clamshell split:
#   Bay A (Hardware & Concentric-Nested CFRP Frame): Z = 48.0 mm clear
#   Divider panel: 2.0 mm
#   Bay B (Membrane Envelope & R5.2 Insulated Air Mats): Z = 105.0 mm clear
#   Check: 2.5 + 48.0 + 2.0 + 105.0 + 2.5 = 160.0 mm EXACT!
BAY_A_Z_MM = 48.0
BAY_B_Z_MM = 105.0
assert abs((2 * CASE_SKIN_THICK_MM + BAY_A_Z_MM + CASE_DIVIDER_THICK_MM + BAY_B_Z_MM) - PACKED_EXT_W_MM) < 1e-6

BAY_A_VOL_L = (INNER_L_MM * INNER_H_MM * BAY_A_Z_MM) / 1e6  # 11.506 L
BAY_B_VOL_L = (INNER_L_MM * INNER_H_MM * BAY_B_Z_MM) / 1e6  # 25.169 L
INNER_NET_VOL_L = BAY_A_VOL_L + BAY_B_VOL_L                  # 36.674 L

# =============================================================================
# 2. DEPLOYED PAVILION GEOMETRY (REGULAR 12-GON TENSION-RING PAVILION)
# =============================================================================
N_SIDES = 12
CIRCUM_DIAMETER_M = 5.00
CIRCUM_RADIUS_M = CIRCUM_DIAMETER_M / 2.0                    # 2.500 m
SIDE_LENGTH_M = 2.0 * CIRCUM_RADIUS_M * math.sin(math.pi / N_SIDES)  # 1.2941 m
APOTHEM_M = CIRCUM_RADIUS_M * math.cos(math.pi / N_SIDES)    # 2.4148 m (flat-to-flat = 4.830 m)
PERIMETER_M = N_SIDES * SIDE_LENGTH_M                        # 15.529 m

WALL_HEIGHT_M = 1.60          # Vertical perimeter wall height (m)
APEX_HEIGHT_M = 2.90          # Central apex peak height (m)
ROOF_RISE_M = APEX_HEIGHT_M - WALL_HEIGHT_M                  # 1.300 m
EAVE_OVERHANG_M = 0.20        # Rain overhang beyond wall top (m)
BATHTUB_LIP_M = 0.16          # Waterproof floor vertical lip (m)
MUD_SKIRT_M = 0.12            # Outer weather/draft skirt (m)

ROOF_SLOPE_RAD = math.atan2(ROOF_RISE_M, APOTHEM_M)
ROOF_SLOPE_DEG = math.degrees(ROOF_SLOPE_RAD)                # 28.29 deg (~5.38 sun pitch)
RIDGE_SLOPE_RAD = math.atan2(ROOF_RISE_M, CIRCUM_RADIUS_M)
RIDGE_SLOPE_DEG = math.degrees(RIDGE_SLOPE_RAD)              # 27.47 deg
RIDGE_LENGTH_M = math.hypot(CIRCUM_RADIUS_M, ROOF_RISE_M)    # 2.8178 m

FLOOR_AREA_M2 = 3.0 * (CIRCUM_RADIUS_M ** 2)                 # 18.750 m^2 exact for regular 12-gon
TATAMI_COUNT = FLOOR_AREA_M2 / 1.62                          # 11.57 畳 (Chukyo/standard 1.62 m^2)
INTERIOR_VOLUME_M3 = FLOOR_AREA_M2 * WALL_HEIGHT_M + (1.0 / 3.0) * FLOOR_AREA_M2 * ROOF_RISE_M  # 38.125 m^3
VOLUME_EXPANSION_RATIO = (INTERIOR_VOLUME_M3 * 1000.0) / PACKED_EXT_VOL_L  # 954.65x
AREA_EXPANSION_RATIO = FLOOR_AREA_M2 / ((PACKED_EXT_L_MM * PACKED_EXT_H_MM) / 1e6)  # 75.12x

# Standing area (headroom >= 1.80 m)
R_STAND_M = CIRCUM_RADIUS_M * (APEX_HEIGHT_M - 1.80) / ROOF_RISE_M
STANDING_AREA_M2 = 3.0 * (min(CIRCUM_RADIUS_M, R_STAND_M) ** 2)  # 13.42 m^2 (71.6% of floor)

# Guyline anchoring geometry (Dual Concentric Anchor Rings -> eliminates concentrated pull-out!)
GUY_ANGLE_DEG = 45.0          # Optimal structural angle (horizontal = vertical)
GUY_ANGLE_RAD = math.radians(GUY_ANGLE_DEG)
GUY_OUTREACH_M = WALL_HEIGHT_M / math.tan(GUY_ANGLE_RAD)     # 1.60 m (upper guy from z=1.60m)
GUY_ANCHOR_RADIUS_M = CIRCUM_RADIUS_M + GUY_OUTREACH_M       # 4.10 m outer anchor ring (dia 8.20 m)
GUY_MID_ANCHOR_RADIUS_M = CIRCUM_RADIUS_M + 0.80             # 3.30 m inner anchor ring (mid guy from z=0.80m, 45 deg!)
GUY_LENGTH_M = math.hypot(GUY_OUTREACH_M, WALL_HEIGHT_M)     # 2.263 m
# Compact garden pitch mode (55 deg guy angle -> outer stake circle dia = 7.24 m)
GUY_COMPACT_OUTREACH_M = WALL_HEIGHT_M / math.tan(math.radians(55.0))  # 1.12 m

# =============================================================================
# 3. STRUCTURAL MEMBERS (STANDARD COMMERCIAL CFRP & 7075-T6 SPECIFICATIONS)
# =============================================================================
# Material properties (conservative engineering design values):
# Roll-wrapped UD (70%) + 3K Twill (30%) Toray T700S Carbon/Epoxy Tubes:
CFRP_E_PA = 115.0e9           # Longitudinal Young's modulus (Pa) [T700S 70%UD/30%woven typical 120-135 GPa]
CFRP_G_PA = 5.5e9             # Shear modulus (Pa)
CFRP_NU = 0.28                # Poisson's ratio
CFRP_RHO = 1550.0             # Density (kg/m^3)
CFRP_SIGMA_ULT_PA = 650.0e6   # Conservative compressive/bending design strength (Pa) [actual ~900-1200 MPa]

# 7075-T6 Aerospace Aluminum Alloy (Hubs, ferrules, case frame, screw anchor shafts):
AL7075_E_PA = 71.7e9
AL7075_NU = 0.33
AL7075_RHO = 2810.0
AL7075_YIELD_PA = 503.0e6

# 2.0 mm Dyneema (SK78 UHMWPE core + braided polyester UV sheath):
DYNEEMA_DIA_MM = 2.0
DYNEEMA_AREA_M2 = math.pi * (0.001 ** 2) * 0.65  # effective load-bearing UHMWPE core cross-section
DYNEEMA_E_PA = 55.0e9         # Effective braided rope modulus (Pa)
DYNEEMA_BREAK_N = 1962.0      # 200 kgf verified commercial breaking load
DYNEEMA_RHO_G_PER_M = 2.8

# --- A) Central Main Mast (7-section 3-tier concentric-nested CFRP + mid-height Diamond Shroud) ---
MAST_SEG_LEN_MM = 460.0
MAST_OVERLAP_MM = 50.0
MAST_SECTIONS = [
    ("lower",  3, 44.0, 40.0, 2.0),  # 3 outer carrier tubes (occupy 460 x 134 x 44 mm in Bay A)
    ("middle", 2, 38.0, 34.4, 1.8),  # 2 tubes nest inside lower #1 and #2 (2.0 mm dia clearance!)
    ("upper",  2, 32.0, 29.0, 1.5),  # 2 tubes nest inside middle #1 and #2 (2.4 mm dia clearance!)
]
# Mid-height 4-way folding CFRP diamond spreader at z = 1.45 m:
SPREADER_Z_M = 1.45
SPREADER_RADIUS_M = 0.26
SPREADER_OD_MM = 14.0
SPREADER_ID_MM = 11.0

# --- B) 12x Perimeter Vertical Struts (4-section 2-tier concentric-nested CFRP) ---
STRUT_COUNT = N_SIDES         # 12 struts
STRUT_SEG_LEN_MM = 440.0
STRUT_OVERLAP_MM = 53.33
STRUT_LOWER_OD_MM = 24.0      # 2 lower sections per strut -> 24 carrier tubes total
STRUT_LOWER_ID_MM = 21.6      # wall = 1.2 mm (standard ultralight roll-wrapped T700S tube)
STRUT_UPPER_OD_MM = 20.0      # 2 upper sections per strut -> nest inside lower tubes (1.6 mm dia clearance!)
STRUT_UPPER_ID_MM = 18.0      # wall = 1.0 mm -> inner bore 18.0 mm houses ALL 24 screw shafts + 12 floor pins!

# =============================================================================
# 4. TEXTILE ENVELOPE & INSULATION SPECIFICATIONS (REAL COMMERCIAL FABRICS)
# =============================================================================
R_EAVE_M = CIRCUM_RADIUS_M + EAVE_OVERHANG_M
ROOF_SLANT_EAVE_M = math.hypot(R_EAVE_M, ROOF_RISE_M * (R_EAVE_M / CIRCUM_RADIUS_M))
AREA_ROOF_M2 = 0.5 * (N_SIDES * 2.0 * R_EAVE_M * math.sin(math.pi / N_SIDES)) * ROOF_SLANT_EAVE_M
AREA_WALL_M2 = PERIMETER_M * (WALL_HEIGHT_M + MUD_SKIRT_M)
AREA_FLOOR_TUB_M2 = FLOOR_AREA_M2 + PERIMETER_M * BATHTUB_LIP_M
AREA_MESH_M2 = PERIMETER_M * 0.60 + 2.0 * (1.20 * 1.50) + 1.10
AREA_LINER_M2 = AREA_ROOF_M2 * 0.85

FABRICS = {
    "roof_fly": {
        "material": "20D Ripstop Silpoly (Silicone/PU 3000mm HH, 0.5% water absorption)",
        "area_m2": AREA_ROOF_M2,
        "gsm": 42.0,
        "pack_L_per_m2": 0.155,
        "hh_mm": 3000.0,
        "tensile_N_per_m": 13500.0,
        "thickness_mm": 0.045,
        "E_membrane_Pa": 1.2e9,
    },
    "perimeter_wall": {
        "material": "20D Ripstop Silpoly (Silicone/PU 3000mm HH, UV-stabilized)",
        "area_m2": AREA_WALL_M2,
        "gsm": 42.0,
        "pack_L_per_m2": 0.155,
        "hh_mm": 3000.0,
        "tensile_N_per_m": 13500.0,
        "thickness_mm": 0.045,
        "E_membrane_Pa": 1.2e9,
    },
    "bathtub_floor": {
        "material": "30D High-Tenacity Nylon 6.6 Ripstop (TPU/PU 5000mm HH)",
        "area_m2": AREA_FLOOR_TUB_M2,
        "gsm": 60.0,
        "pack_L_per_m2": 0.215,
        "hh_mm": 5000.0,
        "tensile_N_per_m": 22000.0,
        "thickness_mm": 0.068,
        "E_membrane_Pa": 1.5e9,
    },
    "bug_mesh": {
        "material": "15D No-See-Um Nylon Monofilament Mesh",
        "area_m2": AREA_MESH_M2,
        "gsm": 20.0,
        "pack_L_per_m2": 0.095,
        "hh_mm": 0.0,
        "tensile_N_per_m": 4500.0,
        "thickness_mm": 0.030,
        "E_membrane_Pa": 0.4e9,
    },
    "thermal_liner": {
        "material": "15D Breathable Ripstop w/ Low-E Reflective Dot Matrix (ε=0.15)",
        "area_m2": AREA_LINER_M2,
        "gsm": 28.0,
        "pack_L_per_m2": 0.120,
        "hh_mm": 0.0,
        "tensile_N_per_m": 6000.0,
        "thickness_mm": 0.035,
        "E_membrane_Pa": 0.6e9,
    },
}

# Integrated Sleeping Insulation System (included INSIDE the 52x16x48 cm box!)
SLEEP_MAT_COUNT = 2
SLEEP_MAT_DEPLOYED_M = (1.95, 0.65, 0.075)
SLEEP_MAT_R_VALUE_SI = 0.916
SLEEP_MAT_R_VALUE_US = 5.2
SLEEP_MAT_PACKED_L_EACH = 1.80
SLEEP_MAT_WEIGHT_KG_EACH = 0.44

# Ground Anchor System:
# 24x 320mm 7075-T6 Tubular Shaft + Bayonet PA66-GF30 Double-Helical Screw Anchors (Dh = 52mm)
#   - 12x Outer Ring (r=4.10m, upper guys) + 12x Inner Ring (r=3.30m, mid guys)
#   - Shafts (OD 12mm x 320mm) nest 100% INSIDE the 24 hollow ID 18.0mm upper strut tubes!
#   - 48x Detachable bayonet helical flight discs (OD 52mm x 3.5mm) coin-stack flat in 0.46 L inside Bay B!
# 12x 110mm Titanium Floor Corner Pins nest directly behind shafts (320 + 110 = 430mm <= 440mm tube bore!)
MAIN_STAKES_COUNT = 24
MAIN_STAKE_LEN_MM = 320.0
MAIN_STAKE_SHAFT_OD_MM = 12.0
MAIN_STAKE_HELIX_DIA_MM = 52.0
MAIN_STAKE_CIRCUM_DIA_MM = 12.0  # Shaft OD inside strut tube (bayonet flights stacked flat!)
MAIN_STAKE_WEIGHT_G = 38.0       # 12mm hollow 7075-T6 shaft (22g) + 2x PA66-GF30 52mm helical flights (16g)
FLOOR_STAKES_COUNT = 12
FLOOR_STAKE_LEN_MM = 110.0       # 110mm Titanium bathtub corner stakes (320 + 110 = 430mm <= 440mm!)
FLOOR_STAKE_WEIGHT_G = 9.0

# =============================================================================
# 5. ENVIRONMENTAL DESIGN ENVELOPE (STRICT PASS CRITERIA)
# =============================================================================
WIND_STEADY_MS = 20.0         # Design steady wind speed (72 km/h - Beaufort 8-9 gale)
WIND_GUST_MS = 25.0           # Extreme 3-sec gust survival wind speed (90 km/h - Beaufort 10 storm)
RAIN_EXTREME_MM_H = 100.0     # Extreme Japanese torrential downpour (猛烈な雨 100 mm/h)
SUMMER_T_EXT_C = 34.0
SUMMER_RH_EXT = 0.75
SUMMER_SOLAR_W_M2 = 850.0
WINTER_T_EXT_C = 0.0
WINTER_RH_EXT = 0.85
OCCUPANTS_DESIGN = 2          # Nominal sleeping test (capacity up to 6-8 persons!)
MAX_CAPACITY_PERSONS = 6

def get_summary_dict():
    return {
        "name": "FREE-ROOM D12-500",
        "packed_mm": [PACKED_EXT_L_MM, PACKED_EXT_W_MM, PACKED_EXT_H_MM],
        "packed_vol_L": round(PACKED_EXT_VOL_L, 3),
        "inner_net_vol_L": round(INNER_NET_VOL_L, 3),
        "n_sides": N_SIDES,
        "circum_diameter_m": CIRCUM_DIAMETER_M,
        "flat_width_m": round(2.0 * APOTHEM_M, 3),
        "side_length_m": round(SIDE_LENGTH_M, 3),
        "wall_height_m": WALL_HEIGHT_M,
        "apex_height_m": APEX_HEIGHT_M,
        "roof_slope_deg": round(ROOF_SLOPE_DEG, 2),
        "floor_area_m2": round(FLOOR_AREA_M2, 2),
        "tatami": round(TATAMI_COUNT, 1),
        "standing_area_m2": round(STANDING_AREA_M2, 2),
        "interior_volume_m3": round(INTERIOR_VOLUME_M3, 2),
        "volume_expansion_ratio": round(VOLUME_EXPANSION_RATIO, 1),
        "area_expansion_ratio": round(AREA_EXPANSION_RATIO, 1),
        "guy_outreach_m": round(GUY_OUTREACH_M, 2),
        "footprint_dia_45deg_m": round(2.0 * GUY_ANCHOR_RADIUS_M, 2),
        "footprint_dia_compact_m": round(CIRCUM_DIAMETER_M + 2.0 * GUY_COMPACT_OUTREACH_M, 2),
    }

if __name__ == "__main__":
    import json
    print(json.dumps(get_summary_dict(), indent=2, ensure_ascii=False))
