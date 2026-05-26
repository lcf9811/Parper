#!/usr/bin/env python3
"""根据 DO 偏差计算曝气量调节幅度"""
import json
import sys

params = json.loads(sys.stdin.read())

do_value = params["do_value_mg_l"]
do_setpoint = params["do_setpoint_mg_l"]
do_deadband = params.get("do_deadband_mg_l", 0.3)
tmp_kpa = params.get("tmp_kpa")

do_low = do_value < (do_setpoint - do_deadband)
do_high = do_value > (do_setpoint + do_deadband)

if do_low:
    do_deviation = do_setpoint - do_value
    # DO 偏差越大，调节幅度越大，最大 20%
    aeration_delta_pct = min(round(do_deviation * 10, 1), 20)
    aeration_adjust = "increase"
    action = f"增大曝气量 {aeration_delta_pct}%"
    if tmp_kpa is not None and tmp_kpa > 30:
        # TMP 过高时限制增幅
        aeration_delta_pct = min(aeration_delta_pct, 5)
        action = f"增大曝气量 {aeration_delta_pct}%（受 TMP={tmp_kpa}kPa 限幅）"
elif do_high:
    do_deviation = do_value - do_setpoint
    aeration_delta_pct = min(round(do_deviation * 8, 1), 15)
    aeration_adjust = "decrease"
    action = f"减小曝气量 {aeration_delta_pct}%"
else:
    aeration_delta_pct = 0
    aeration_adjust = "hold"
    action = "DO 正常，维持当前曝气量"

result = {
    "status": "ok",
    "do_value_mg_l": do_value,
    "do_setpoint_mg_l": do_setpoint,
    "do_deadband_mg_l": do_deadband,
    "do_low": do_low,
    "do_high": do_high,
    "aeration_adjust": aeration_adjust,
    "aeration_delta_pct": aeration_delta_pct,
    "recommended_action": action,
    "tmp_kpa": tmp_kpa,
    "tmp_interlock_ok": tmp_kpa is None or tmp_kpa <= 30,
}

print(json.dumps(result, ensure_ascii=False))
