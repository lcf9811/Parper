#!/usr/bin/env python3
"""根据进水水质计算所需碳源投加量"""
import json
import sys

params = json.loads(sys.stdin.read())

inflow_tn = params["inflow_tn"]
outflow_tn_limit = params.get("outflow_tn_limit", 15)
flow_rate = params.get("flow_rate", 10000)
carbon_type = params.get("carbon_type", "sodium_acetate")

cn_ratios = {
    "sodium_acetate": 4.0,
    "methanol": 3.5,
    "glucose": 6.0,
}

tn_to_remove = inflow_tn - outflow_tn_limit
if tn_to_remove <= 0:
    result = {"status": "ok", "message": f"进水TN({inflow_tn})已低于限值({outflow_tn_limit})，无需加碳源", "dosage_kg_d": 0}
    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0)

cn_ratio = cn_ratios.get(carbon_type, 4.0)
dosage_kg_d = tn_to_remove * cn_ratio * flow_rate / 1000

result = {
    "status": "ok",
    "carbon_type": carbon_type,
    "tn_removed_mg_l": tn_to_remove,
    "cn_ratio": cn_ratio,
    "flow_rate_m3_d": flow_rate,
    "dosage_kg_d": round(dosage_kg_d, 2),
    "dosage_kg_h": round(dosage_kg_d / 24, 2),
    "message": f"建议{carbon_type}投加量：{dosage_kg_d:.2f} kg/d ({dosage_kg_d/24:.2f} kg/h)"
}

print(json.dumps(result, ensure_ascii=False))
