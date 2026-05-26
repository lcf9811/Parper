---
name: water-mbr-do-aeration
description: MBR 溶解氧监测与曝气调节；再生后或主链水入 MBR 域时重点巡检；DO 低于设定/死区下沿则增大曝气；与再生/加药解耦，见 water-regen-dosing。
capabilities:
  - type: web_api
    name: query_mbr_do_data
    description: 从 SCADA 系统查询 MBR 溶解氧、跨膜压差、液位等实时数据
    url: "http://scada-server/api/v1/plc/mbr_zone"
    method: GET
    headers:
      Authorization: "Bearer ${SCADA_API_TOKEN}"
    parameters:
      - name: mbr_zone_id
        type: string
        required: true
        description: "MBR 区域编号，如 MBR-1、MBR-2"
      - name: params
        type: string
        required: false
        description: "参数列表，逗号分隔，如 do_value_mg_l,tmp_kpa,water_level_m"
    response_mapping:
      do_value_mg_l: "溶解氧(mg/L)"
      do_setpoint_mg_l: "DO设定值(mg/L)"
      tmp_kpa: "跨膜压差(kPa)"
      water_level_m: "液位(m)"
  - type: python_script
    name: calculate_aeration_adjust
    description: 根据 DO 偏差计算曝气量调节幅度
    script: "scripts/dosing/aeration_calc.py"
    parameters:
      - name: do_value_mg_l
        type: number
        required: true
        description: "当前溶解氧浓度(mg/L)"
      - name: do_setpoint_mg_l
        type: number
        required: true
        description: "DO 设定值(mg/L)"
      - name: do_deadband_mg_l
        type: number
        required: false
        default: 0.3
        description: "DO 死区范围(mg/L)"
      - name: tmp_kpa
        type: number
        required: false
        description: "跨膜压差(kPa)，用于联锁限幅"
    output_format: "table"
---

# MBR：溶解氧与曝气

> **拆分说明**：再生与突发加药见 **`water-regen-dosing`**。本 Skill **仅** MBR 域：DO 监测、曝气增减、与 TMP/液位等联锁提示。  
> 点位域参考：`scada_plc_data/plc_business_data_model.md`（`PROC_COOLING_MBR`，如 DO、跨膜压差）。

## 自动执行指令

当本 Skill 被加载时，**必须主动调用以下能力完成实际操作，不可仅返回分析文本**：

1. 若 DO 低于设定下限（DO < 设定值 - 死区），**调用 `calculate_aeration_adjust`** 计算曝气调节幅度并输出结果
2. 若需要获取实时 MBR 数据，**调用 `query_mbr_do_data`** 查询后再执行计算
3. 最终输出必须包含：当前 DO、DO 设定值、调节方向（增大/减小/保持）、调节幅度（%）、建议操作

## 触发条件

| 条件 | 说明 |
|------|------|
| **调节曝气** | **DO < 设定下限** 或 **DO < 设定值 − 死区**（持续或去抖后触发） |
| **加强巡检**（可选） | **再生结束事件** 后配置时间窗内提高采样频率，直至 DO 稳定 |

本 Skill **不因** 饱和率≥80% 单独触发再生；再生由 `water-regen-dosing` 处理，本 Skill 消费其后的 **工艺阶段** 或 **遥测中的 MBR 段**。

---

## 编排 / Hook：如何「触发」本 Skill（示例）

周期性遥测、或再生完成 Hook、或 SCADA 告警路由到 `mbr_do_eval` 时加载本 Skill。

### 示例 A：DO 偏低，建议增大曝气

**请求 / 输入上下文（示例 JSON）**

```json
{
  "skill": "water-mbr-do-aeration",
  "reason": "periodic_mbr_scan",
  "mbr_zone_id": "MBR-1",
  "do_value_mg_l": 1.2,
  "do_setpoint_mg_l": 2.5,
  "do_deadband_mg_l": 0.3,
  "tmp_kpa": 12.4,
  "post_regen_watch": true,
  "regen_ended_at": "2026-05-08T10:15:00+08:00"
}
```

**响应（示例 JSON）**

```json
{
  "skill": "water-mbr-do-aeration",
  "mbr_zone_id": "MBR-1",
  "do_low": true,
  "do_value_mg_l": 1.2,
  "do_setpoint_mg_l": 2.5,
  "aeration_adjust": "increase",
  "aeration_delta_pct": 8,
  "ramp_rate_limit": "per_site_config",
  "tmp_kpa": 12.4,
  "tmp_interlock_ok": true,
  "recommended_action": "raise_blower_or_valve_with_ramp",
  "note": "若 TMP 超阈须限幅或走反洗策略，以现场规程为准"
}
```

### 示例 B：DO 正常，不调节

**请求 / 输入上下文（示例 JSON）**

```json
{
  "skill": "water-mbr-do-aeration",
  "reason": "periodic_mbr_scan",
  "mbr_zone_id": "MBR-1",
  "do_value_mg_l": 2.6,
  "do_setpoint_mg_l": 2.5,
  "do_deadband_mg_l": 0.3
}
```

**响应（示例 JSON）**

```json
{
  "skill": "water-mbr-do-aeration",
  "mbr_zone_id": "MBR-1",
  "do_low": false,
  "do_value_mg_l": 2.6,
  "aeration_adjust": "hold",
  "aeration_delta_pct": 0,
  "recommended_action": "none"
}
```

---

## 关联

| Skill / 文档 | 用途 |
|----------------|------|
| `water-regen-dosing` | 再生与加药 |
| `water-treatment-rules-kb` | 总阈值与架构引用 |
| `plc_business_data_model.md` | DO、曝气、TMP 测点域 |
