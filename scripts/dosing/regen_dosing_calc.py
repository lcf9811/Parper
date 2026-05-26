#!/usr/bin/env python3
"""根据进水流量和饱和率计算再生加药体积基准及配方参数"""
import json
import sys

params = json.loads(sys.stdin.read())

inlet_flow_m3h = params["inlet_flow_m3h"]
saturation_pct = params.get("saturation_pct", 80)
toxicity_inhibit_pct = params.get("toxicity_inhibit_pct", 0)
carbon_type = params.get("carbon_type", "sodium_acetate")

# 加药体积基准：V_120s = Q_m3h / 30
dose_basis_m3_120s = inlet_flow_m3h / 30

# 转盘频率设定（基于饱和率）
if saturation_pct >= 95:
    disk_frequency_hz = 40
elif saturation_pct >= 85:
    disk_frequency_hz = 35
else:
    disk_frequency_hz = 32

# 再生时间（基于饱和率）
if saturation_pct >= 95:
    regen_duration_s = 2400
elif saturation_pct >= 85:
    regen_duration_s = 2100
else:
    regen_duration_s = 1800

# 再生温度设定
regen_temp_set_c = 15.0

# 毒性紧急加药档位
toxicity_tier = None
dose_multiplier = None
if toxicity_inhibit_pct >= 70:
    toxicity_tier = "70_plus_critical"
    dose_multiplier = 1.8
elif toxicity_inhibit_pct >= 60:
    toxicity_tier = "60_70_emergency"
    dose_multiplier = 1.35
elif toxicity_inhibit_pct >= 40:
    toxicity_tier = "40_60_warning"
    dose_multiplier = 1.1

# 计算实际加药量（含毒性乘数）
actual_dose_m3 = round(dose_basis_m3_120s * (dose_multiplier or 1.0), 4)

# 碳源 C/N 比值
cn_ratios = {
    "sodium_acetate": 4.0,
    "methanol": 3.5,
    "glucose": 6.0,
}
cn_ratio = cn_ratios.get(carbon_type, 4.0)

result = {
    "status": "ok",
    "dose_basis_m3_120s": round(dose_basis_m3_120s, 4),
    "dose_basis_formula": "Q_m3h / 30",
    "actual_dose_m3": actual_dose_m3,
    "actual_dose_liters": round(actual_dose_m3 * 1000, 1),
    "disk_frequency_hz": disk_frequency_hz,
    "regen_duration_s": regen_duration_s,
    "regen_duration_min": regen_duration_s / 60,
    "regen_temp_set_c": regen_temp_set_c,
    "carbon_type": carbon_type,
    "cn_ratio": cn_ratio,
    "saturation_pct": saturation_pct,
    "toxicity_inhibit_pct": toxicity_inhibit_pct,
    "toxicity_tier": toxicity_tier,
    "dose_multiplier": dose_multiplier,
    "message": f"再生加药基准：{round(dose_basis_m3_120s*1000, 1)}L（120s）"
    + (f"，毒性乘数{dose_multiplier}，实际加药{round(actual_dose_m3*1000, 1)}L" if dose_multiplier else "")
}

print(json.dumps(result, ensure_ascii=False))
