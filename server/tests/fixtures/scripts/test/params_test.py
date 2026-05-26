#!/usr/bin/env python3
"""读取 stdin JSON 参数并回显"""
import json
import sys

params = json.loads(sys.stdin.read())
result = {"status": "ok", "received_params": params}
print(json.dumps(result, ensure_ascii=False))
