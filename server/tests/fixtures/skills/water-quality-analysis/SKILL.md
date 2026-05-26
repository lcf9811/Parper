---
name: water-quality-analysis
description: 水质参数分析与异常诊断
capabilities:
  - type: web_api
    name: query_scada_data
    description: 从 SCADA 系统查询实时水质参数
    url: "http://127.0.0.1:9999/api/v1/sensor/realtime"
    method: GET
    headers:
      Authorization: "Bearer ${SCADA_API_TOKEN}"
    parameters:
      - name: station_id
        type: string
        required: true
        description: "监测站点ID，如 INLET_POOL_01"
      - name: params
        type: string
        required: false
        description: "参数列表，逗号分隔，如 ph,do,cod,tn,tp"
    response_mapping:
      ph: "进水pH值"
      do: "溶解氧(mg/L)"
      cod: "化学需氧量(mg/L)"
      tn: "总氮(mg/L)"
      tp: "总磷(mg/L)"
---

# 水质参数分析与异常诊断

## 1. 能力定义

本技能用于分析水处理工艺中的水质参数，包括：
- pH 值、溶解氧、COD、总氮、总磷等关键指标
- 参数异常诊断与处理建议
