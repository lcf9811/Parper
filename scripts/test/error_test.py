#!/usr/bin/env python3
"""错误退出码测试"""
import sys
print("Error: something went wrong", file=sys.stderr)
sys.exit(1)
