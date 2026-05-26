---
name: water-dosing-optimization
description: 加药量优化计算
capabilities:
  - type: python_script
    name: calculate_carbon_source
    description: 根据进水水质计算所需碳源投加量
    script: "scripts/dosing/carbon_source_calc.py"
    parameters:
      - name: inflow_tn
        type: number
        required: true
        description: "进水总氮浓度(mg/L)"
      - name: outflow_tn_limit
        type: number
        required: false
        default: 15
        description: "出水总氮限值(mg/L)，默认15"
      - name: flow_rate
        type: number
        required: false
        default: 10000
        description: "处理水量(m³/d)，默认10000"
      - name: carbon_type
        type: string
        required: false
        default: "sodium_acetate"
        description: "碳源类型：sodium_acetate(乙酸钠)/methanol(甲醇)/glucose(葡萄糖)"
    output_format: "table"
---

# 加药量优化计算

## 1. 能力定义

本技能用于根据进水水质参数计算最优加药量，包括：
- 碳源投加量计算（乙酸钠、甲醇、葡萄糖）
- 除磷剂投加量计算
- 絮凝剂投加量计算
