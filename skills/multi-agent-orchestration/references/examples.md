# 使用示例

本文件提供 Multi-Agent 协作的实际使用示例。

## 示例1: 技术方案设计

### 场景
设计一个电商促销系统，需要包含活动管理、优惠计算、风控等功能。

### 执行过程

**Step 1: 用户提交战略任务**

```
用户: 我需要设计一个电商促销系统，要求：
1. 支持多种促销类型（满减、折扣、赠品）
2. 支持复杂的叠加规则
3. 有完善的风控机制
4. 运营可自助配置
5. 系统要高性能、可扩展
```

**Step 2: Coordinator 分解任务**

```yaml
Coordinator: "
收到战略任务：设计电商促销系统

分解为以下子任务：

子任务清单:
  - T1: 促销活动数据模型设计 (DesignWorker)
  - T2: 优惠计算引擎设计 (DesignWorker)
  - T3: 风控策略设计 (DesignWorker)
  - T4: 运营后台接口设计 (DesignWorker)
  - T5: 用户端接口设计 (DesignWorker)
  - T6: 性能优化方案设计 (DesignWorker)

并行分组:
  - G1: [T1, T3]     # 可同时进行
  - G2: [T2]         # 依赖 T1
  - G3: [T4, T5, T6] # 依赖 T2

预计总工期: 3 小时
"
```

**Step 3: Workers 并行执行**

```yaml
# T1: 数据模型设计
DesignWorker-1: |
  完成 Promotion、Rule、Condition 等实体设计
  - 支持多种促销类型
  - 支持灵活的条件配置
  
# T3: 风控设计
DesignWorker-2: |
  完成风控策略设计
  - 防刷机制
  - 预算控制
  - 熔断策略
```

**Step 4: Coordinator 综合**

```yaml
Coordinator: "
综合所有 Worker 结果...

最终交付物:
  - 完整的数据模型
  - 优惠计算流程
  - 风控策略方案
  - API 接口设计
  - 性能优化建议
"
```

**Step 5: Verification 验证**

```yaml
VerificationAgent: |
  验证结果:
  - 满减类型: ✓ PASS
  - 折扣类型: ✓ PASS
  - 赠品类型: ✗ FAIL (缺少设计)
  - 风控机制: ✓ PASS
  - 性能要求: △ PARTIAL (缺少具体指标)
  
  结论: PARTIAL，需要补充赠品类型设计和性能指标
```

**Step 6: 迭代修复**

```yaml
Coordinator: "
根据验证报告，安排修复：
- T1.1: 补充赠品类型设计 → DesignWorker-1
- T6.1: 补充性能指标 → DesignWorker-3
"

# Workers 完成修复

VerificationAgent: |
  重新验证：
  - 赠品类型: ✓ PASS
  - 性能指标: ✓ PASS
  
  结论: PASS，可以交付
```

**Step 7: 最终交付**

```yaml
Coordinator: "
最终交付物:
  《电商促销系统技术方案》
  
  包含:
  1. 数据模型设计
  2. 优惠计算引擎
  3. 风控策略
  4. API 接口文档
  5. 性能优化方案
  
  验证状态: PASS (95分)
"
```

---

## 示例2: 代码审查

### 场景
审查一个用户认证模块的 PR。

### 执行过程

**Step 1: Coordinator 分解**

```yaml
Coordinator: "
审查任务分解:

子任务:
  - R1: 业务逻辑审查 (ReviewWorker-1)
    标准:
      - 登录流程正确
      - 权限检查完整
      - 会话管理安全
  
  - R2: 安全审查 (ReviewWorker-2)
    标准:
      - 密码加密正确
      - 防暴力破解
      - 输入验证完整
  
  - R3: 性能审查 (ReviewWorker-3)
    标准:
      - 数据库查询优化
      - 缓存使用合理
      - 无 N+1 问题
```

**Step 2: Workers 并行审查**

```yaml
ReviewWorker-1: |
  业务逻辑审查结果:
  ✓ 登录流程正确
  ✓ 权限检查完整
  ⚠ 会话超时处理可以优化

ReviewWorker-2: |
  安全审查结果:
  ✓ 密码使用 bcrypt 加密
  ✓ 有登录失败限制
  ✗ JWT 密钥硬编码 (CRITICAL)
  ⚠ 缺少 CSRF 防护

ReviewWorker-3: |
  性能审查结果:
  ✓ 使用了 Redis 缓存
  ⚠ 用户查询可以添加索引
  ✓ 无 N+1 问题
```

**Step 3: Coordinator 综合报告**

```yaml
Coordinator: "
代码审查综合报告:

严重问题 (需修复):
  - JWT 密钥硬编码 (CRITICAL)

建议改进:
  - 添加 CSRF 防护
  - 优化会话超时处理
  - 为用户表添加索引

总体评价: 需要修复后重新审查
```

**Step 4: 修复后重新验证**

```yaml
# Developer 修复问题

ReviewWorker-2: |
  重新验证安全项:
  ✓ JWT 密钥已移至环境变量
  ✓ 添加了 CSRF 防护
  
  结论: PASS

VerificationAgent: |
  综合验证:
  - 所有严重问题已修复
  - 所有建议项已处理
  
  结论: PASS (90分)
```

---

## 示例3: 文档撰写

### 场景
撰写一个 API 使用文档。

### 执行过程

```yaml
Coordinator: "
文档撰写任务分解:

章节分配:
  - C1: 概述和快速开始 → DocWorker-1
  - C2: 认证授权 → DocWorker-2
  - C3: API 参考 → DocWorker-3
  - C4: 错误处理 → DocWorker-4
  - C5: 示例代码 → DocWorker-5

并行执行，最后统一样式
"

# Workers 并行撰写各章节

DocWorker-1: "完成概述和快速开始章节..."
DocWorker-2: "完成认证授权章节..."
DocWorker-3: "完成 API 参考章节..."
DocWorker-4: "完成错误处理章节..."
DocWorker-5: "完成示例代码章节..."

Coordinator: "
综合各章节，统一:
- 术语使用
- 代码风格
- 格式排版

生成完整文档
"

VerificationAgent: |
  文档验证:
  - 完整性: ✓ 所有章节齐全
  - 准确性: ✓ 代码示例可运行
  - 一致性: △ 部分术语不统一
  - 清晰度: ✓ 易于理解
  
  建议: 统一 "token" 和 "令牌" 的用法

Coordinator: "
安排术语统一修复...
"

# 修复后

VerificationAgent: |
  重新验证: PASS

Coordinator: "
交付最终文档
"
```

---

## 示例4: 多维度验证

### 场景
一个支付功能需要同时满足功能、安全、性能要求。

### 执行过程

```yaml
Coordinator: "
支付功能开发任务:

开发阶段:
  - Implement: CodeWorker 实现支付功能

验证阶段 (并行多维度):
  - V1: 功能验证 → VerificationAgent-1
  - V2: 安全验证 → VerificationAgent-2  
  - V3: 性能验证 → VerificationAgent-3
"

# 开发完成

CodeWorker: "支付功能实现完成"

# 并行验证

VerificationAgent-1 (功能): |
  功能验证:
  ✓ 支付流程正确
  ✓ 订单状态流转正确
  ✓ 退款功能正常
  
  结论: PASS

VerificationAgent-2 (安全): |
  安全验证:
  ✓ 敏感数据加密
  ✓ 防重放攻击
  ⚠ 日志中打印了卡号 (需脱敏)
  
  结论: PARTIAL

VerificationAgent-3 (性能): |
  性能验证:
  ✓ 支付接口 < 200ms
  ✓ 并发处理 1000 TPS
  ✓ 数据库连接池配置合理
  
  结论: PASS

Coordinator: "
综合验证报告:

功能: PASS
安全: PARTIAL (需修复日志脱敏)
性能: PASS

安排安全修复...
"

# 修复后

VerificationAgent-2: |
  重新验证安全项:
  ✓ 日志已脱敏
  
  结论: PASS

Coordinator: "
所有维度验证通过，可以上线
"
```

---

## 快速开始模板

### 启动一个任务

```markdown
我需要 [目标]，要求：
1. [要求1]
2. [要求2]
3. [要求3]

请使用 Multi-Agent 协作完成
```

### Coordinator 启动模板

```yaml
task_init:
  strategy: "战略任务描述"
  constraints:
    - "时间限制"
    - "质量要求"
    - "资源约束"
  success_criteria:
    - "可衡量的成功标准1"
    - "可衡量的成功标准2"
  
  suggested_workers: 3
  suggested_mode: "standard|iterative|phased"
```
