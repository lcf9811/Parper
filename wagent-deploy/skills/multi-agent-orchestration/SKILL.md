---
name: multi-agent-orchestration
description: "分层协作式多 Agent 任务编排系统。用于复杂任务的战略分解、并行执行和独立验证。包含：Coordinator Agent（协调者，负责任务分解和调度）、Worker Agents（执行者，专注执行）、Verification Agent（独立验证者）。适用于需要多人协作、分阶段验证的复杂任务，如代码审查、文档撰写、方案设计、数据分析等。当用户提到'多 Agent'、'任务分解'、'分工协作'、'验证'等关键词时使用。"
---

# Multi-Agent 分层协作编排系统

本 Skill 提供一套完整的分层多 Agent 协作框架，用于复杂任务的战略分解、并行执行和独立验证。

## 系统架构

```
战略层(用户)
    ↓ 任务 + 战略目标
Coordinator Agent (协调者)
    ↓ 分解后的子任务
Worker Agents (N个执行者) ← 并行执行
    ↓ 执行结果
Verification Agent (验证者) ← 独立验证
    ↓ 验证报告
Coordinator Agent ← 综合/迭代
    ↓ 最终结果
战略层(用户)
```

## 角色定义

### 1. Coordinator Agent (协调者)

**职责**: 任务分解、调度管理、结果综合

**核心能力**:
- 将战略任务分解为可并行执行的子任务
- 为每个子任务定义明确的交付物和验收标准
- 动态调度 Worker Agents 执行任务
- 收集 Worker 结果并综合成完整方案
- 处理验证反馈，决定迭代或交付

**工作流程**:
1. 接收战略任务和验证标准
2. 分析任务依赖关系
3. 设计子任务清单（含验收标准）
4. 并行分发给 Workers
5. 收集结果并综合
6. 提交验证
7. 根据反馈迭代或交付

详细定义: [references/coordinator-agent.md](references/coordinator-agent.md)

### 2. Worker Agents (执行者)

**职责**: 专注执行单一子任务

**核心能力**:
- 接收具体子任务和验收标准
- 专注执行，不考虑协调
- 按时交付结果
- 遇到困难时上报，不擅自变更范围

**约束**:
- 不跨任务协调
- 不参与验证
- 不修改验收标准

详细定义: [references/worker-agent.md](references/worker-agent.md)

### 3. Verification Agent (验证者)

**职责**: 独立验证，确保质量

**核心能力**:
- 根据预定义标准检查交付物
- 客观评分（PASS/FAIL/PARTIAL）
- 提供具体改进建议
- 不执行任务，只验证

**独立性原则**:
- 不参与任务设计
- 不参与任务执行
- 只依据 Coordinator 提供的标准验证

详细定义: [references/verification-agent.md](references/verification-agent.md)

## 使用流程

### 快速开始

1. **战略层定义任务**:
   ```
   目标: [具体目标]
   约束: [时间/质量/资源约束]
   成功标准: [可衡量的成功指标]
   ```

2. **启动 Coordinator**:
   - 向 Coordinator 发送任务
   - Coordinator 自动分解并调度

3. **并行执行**:
   - Workers 同时执行各自子任务
   - Coordinator 监控进度

4. **独立验证**:
   - Verification Agent 检查综合结果
   - 返回验证报告

5. **迭代或交付**:
   - 如 FAIL，Coordinator 安排修复
   - 如 PASS，交付最终成果

### 工作模式选择

| 场景 | 推荐模式 | Worker 数量 |
|------|---------|------------|
| 文档撰写 | 分章节并行 | 3-5 |
| 代码审查 | 分模块审查 | 2-4 |
| 数据分析 | 分维度分析 | 2-3 |
| 方案设计 | 分场景设计 | 3-4 |

详细工作流: [references/workflows.md](references/workflows.md)

## 交互协议

### 消息格式

**任务消息**:
```yaml
task_id: "unique-id"
type: "subtask"
content: "任务描述"
acceptance_criteria:
  - "标准1"
  - "标准2"
deadline: "2024-01-01T12:00:00Z"
```

**结果消息**:
```yaml
task_id: "unique-id"
status: "completed|failed|blocked"
deliverable: "交付物内容"
notes: "备注"
```

**验证消息**:
```yaml
task_id: "unique-id"
verdict: "PASS|FAIL|PARTIAL"
score: 85
issues:
  - "问题1"
  - "问题2"
suggestions:
  - "建议1"
```

### 状态流转

```
PENDING → ASSIGNED → IN_PROGRESS → COMPLETED → VERIFIED
                            ↓              ↓
                         BLOCKED       REJECTED → REWORK
```

## 最佳实践

### 任务分解原则

1. **MECE 原则**: 子任务相互独立，完全穷尽
2. **单一职责**: 每个 Worker 只做一件事
3. **可验证性**: 每个子任务有明确的 DONE 定义
4. **粒度适中**: 子任务建议 15-60 分钟完成

### 验证标准设计

1. **可测量**: 避免"质量好"，使用"覆盖率>80%"
2. **可检查**: 提供检查清单
3. **边界清晰**: 明确什么是"足够好"
4. **可追溯**: 每个标准对应需求

### 避免常见陷阱

- **Coordinator 过度设计**: 不要分解过细
- **Worker 越权**: Workers 不擅自修改范围
- **验证者参与执行**: 验证者必须独立
- **缺少反馈循环**: 预留迭代时间

## 示例场景

### 场景1: 代码审查

```
战略层: "审查这个PR，确保代码质量和安全性"
Coordinator: 分解为
  - Worker1: 审查业务逻辑
  - Worker2: 审查安全性
  - Worker3: 审查性能
Verification: 根据检查清单验证
```

### 场景2: 技术方案设计

```
战略层: "设计一个高可用的订单系统"
Coordinator: 分解为
  - Worker1: 设计数据模型
  - Worker2: 设计API接口
  - Worker3: 设计缓存策略
  - Worker4: 设计降级方案
Verification: 检查是否满足SLA要求
```

完整示例: [references/examples.md](references/examples.md)

## 扩展与定制

### 添加新的 Worker 类型

在 [references/worker-agent.md](references/worker-agent.md) 中添加新的专业化 Worker 定义。

### 定制验证清单

在 [references/verification-agent.md](references/verification-agent.md) 中添加领域特定的检查项。

### 调整工作流

修改 [references/workflows.md](references/workflows.md) 以适应特定团队的协作模式。
