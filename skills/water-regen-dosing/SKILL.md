---
name: water-regen-dosing
description: 吸附线再生与突发加药；饱和≥80%或调度触发再生序列；毒性紧急档触发加药；加药体积基准=瞬时流速×120s；与切线/停进水联动见 water-adsorption-saturation、water-inlet-toxicity-flow。
capabilities:
  - type: web_api
    name: query_regen_scada_data
    description: 从 SCADA 系统查询再生相关实时数据（饱和率、进水流量、毒性抑制率等）
    url: "http://scada-server/api/v1/plc/adsorption_line"
    method: GET
    headers:
      Authorization: "Bearer ${SCADA_API_TOKEN}"
    parameters:
      - name: line_id
        type: number
        required: true
        description: "吸附线编号，如 1、2、3"
      - name: params
        type: string
        required: false
        description: "参数列表，逗号分隔，如 saturation_pct,inlet_flow_m3h,toxicity_inhibit_pct"
    response_mapping:
      saturation_pct: "饱和率(%)"
      inlet_flow_m3h: "进水流量(m³/h)"
      toxicity_inhibit_pct: "毒性抑制率(%)"
      line_status: "线状态"
  - type: python_script
    name: calculate_regen_dosing
    description: 根据进水流量和饱和率计算再生加药体积基准（Q×120s）及配方参数
    script: "scripts/dosing/regen_dosing_calc.py"
    parameters:
      - name: inlet_flow_m3h
        type: number
        required: true
        description: "进水瞬时流量(m³/h)"
      - name: saturation_pct
        type: number
        required: true
        description: "当前饱和率(%)"
      - name: toxicity_inhibit_pct
        type: number
        required: false
        default: 0
        description: "毒性抑制率(%)"
      - name: carbon_type
        type: string
        required: false
        default: "sodium_acetate"
        description: "碳源类型：sodium_acetate(乙酸钠)/methanol(甲醇)/glucose(葡萄糖)"
    output_format: "table"
---

# 再生与突发加药（不含 MBR）

> **拆分说明**：MBR 溶解氧与曝气见独立 Skill **`water-mbr-do-aeration`**。本 Skill 仅覆盖 **再生** + **突发加药**。  
> 资料对齐：`requirement/三工序系统架构说明.md`、`requirement/规则及约束条件_抽取.md`、`scada_plc_data/plc_business_data_model.md`。

## 自动执行指令

当本 Skill 被加载时，**必须主动调用以下能力完成实际操作，不可仅返回分析文本**：

1. 若触发条件满足（饱和≥80% 或毒性超标），**立即调用 `calculate_regen_dosing`** 计算实际加药量并输出结果
2. 若需要获取实时 SCADA 数据，**调用 `query_regen_scada_data`** 查询后再执行计算
3. 最终输出必须包含：加药体积基准、实际加药量（升）、转盘频率、再生时长、再生温度等具体数值

## 触发条件

| 分支 | 条件 |
|------|------|
| **再生** | 该线 **饱和率 ≥ 80%**，或 **调度/审批** 下达再生窗口 |
| **突发加药** | 进水毒性抑制率 **60%–70%**（规则稿：最低流量 + 紧急加药），或配置的 **毒性超标** 档位 |

再生序列：**停该线进水** →（可选切备用线、延时）→ **启再生** → 设定 **加药基准（Q×120s）、转盘频率、再生时间、再生温度**。  
与 **≥60% 停进水** 的边界见 `water-inlet-toxicity-flow`；切线只填 `close_line`，见 `coordinated-line-switch-eval`。

## 加药体积基准

`V_120s_m³ = Q_m³/h × (120/3600) = Q_m³/h / 30`；泵设定由配方/毒性档位换算。

---

## 编排 / Hook：如何「触发」本 Skill（示例）

以下为 **建议载荷**：实际以项目 Hook（如 `three_process_telemetry`、专用 `regen_eval` 等）为准。智能体或编排器在 **饱和≥80** 或 **毒性落入紧急加药档** 时加载本 Skill。

### 示例 A：仅评估再生（饱和已 82%）

**请求 / 输入上下文（示例 JSON）**

```json
{
  "skill": "water-regen-dosing",
  "reason": "adsorption_saturation_high",
  "line_id": 1,
  "inlet_flow_m3h": 1.2,
  "saturation_pct": 82,
  "toxicity_inhibit_pct": 25,
  "line_switch_state": { "running": [1, 2], "standby": [3] },
  "policy": { "immediate_line_switch": false }
}
```

**响应（示例 JSON）**

```json
{
  "skill": "water-regen-dosing",
  "line_id": 1,
  "regen": {
    "triggered": true,
    "reason": "saturation_pct>=80",
    "steps": ["stop_inlet", "wait_interlocks", "start_regen", "set_params"],
    "dose_basis_m3_120s": 0.04,
    "dose_basis_formula": "Q_m3h/30",
    "disk_frequency_hz": 32,
    "regen_duration_s": 1800,
    "regen_temp_set_c": 15.0,
    "close_line_suggested": 1,
    "note": "切线仅填 close_line；即时联动时调 coordinated-line-switch-eval"
  },
  "emergency_dosing": {
    "triggered": false,
    "toxicity_inhibit_pct": 25,
    "toxicity_tier": null,
    "dose_basis_m3_120s": null,
    "dose_multiplier": null
  }
}
```

### 示例 B：仅突发加药（毒性 65%，再生不触发）

**请求 / 输入上下文（示例 JSON）**

```json
{
  "skill": "water-regen-dosing",
  "reason": "inlet_toxicity_emergency_dosing_band",
  "line_id": 1,
  "inlet_flow_m3h": 0.45,
  "saturation_pct": 45,
  "toxicity_inhibit_pct": 65,
  "toxicity_tier": "60_70_emergency",
  "line_switch_state": { "running": [1, 2], "standby": [3] }
}
```

**响应（示例 JSON）**

```json
{
  "skill": "water-regen-dosing",
  "line_id": 1,
  "regen": {
    "triggered": false,
    "reason": "saturation_below_threshold",
    "steps": []
  },
  "emergency_dosing": {
    "triggered": true,
    "reason": "toxicity_inhibit_60_70",
    "toxicity_inhibit_pct": 65,
    "toxicity_tier": "60_70_emergency",
    "dose_basis_m3_120s": 0.015,
    "dose_multiplier": 1.35,
    "pump_setpoints": { "dosing_pump_profile": "emergency_1", "note": "PLC 点名以点表为准" },
    "precedence_note": "若 inhibit>=60 须先满足停进水/切线策略，见 water-inlet-toxicity-flow"
  }
}
```

### 示例 C：再生与加药同时相关（高饱和 + 高毒性）

编排可先跑 `water-inlet-toxicity-flow` 再跑本 Skill；响应可同时 `regen.triggered` 与 `emergency_dosing.triggered` 为 `true`（现场联锁决定执行顺序）。

---

## 关联

| Skill / 文档 | 用途 |
|----------------|------|
| `water-mbr-do-aeration` | MBR DO / 曝气（与本 Skill 独立） |
| `water-adsorption-saturation` | 饱和与换线 |
| `water-inlet-toxicity-flow` | 毒性分档与停进水 |
| `water-mbr-regen-dosing` | 已合并叙述的索引（若仍存在）— 新集成优先用本 Skill + `water-mbr-do-aeration` |
