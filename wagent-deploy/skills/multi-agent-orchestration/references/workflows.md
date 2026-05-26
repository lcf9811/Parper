# 工作流模式

本文件定义 Multi-Agent 协作的标准工作流模式。

## 模式1: 标准协作流程 (Standard Collaboration)

适用于大多数任务的标准流程。

```
┌─────────┐     ┌─────────────┐     ┌─────────┐     ┌───────────┐     ┌─────────┐
│  用户   │────▶│ Coordinator │────▶│ Workers │────▶│ Verification│────▶│ Coordinator│
└─────────┘     └─────────────┘     └─────────┘     └───────────┘     └────┬────┘
     ▲                                                                      │
     │                                                                      ▼
     │                                                               ┌─────────┐
     └───────────────────────────────────────────────────────────────│  交付   │
                                                                     └─────────┘
```

**流程**:
1. 用户提交战略任务
2. Coordinator 分解任务
3. Workers 并行执行
4. Verification 验证结果
5. Coordinator 综合交付

**适用场景**: 文档撰写、代码开发、方案设计

---

## 模式2: 迭代改进流程 (Iterative Improvement)

适用于需要多轮迭代的复杂任务。

```
┌─────────┐     ┌─────────────┐     ┌─────────┐     ┌───────────┐
│  用户   │────▶│ Coordinator │────▶│ Workers │────▶│ Verification│
└─────────┘     └─────────────┘     └─────────┘     └─────┬─────┘
                               ▲                          │
                               │                    PASS? │
                               │ FAIL                     │
                               └──────────────────────────┘
```

**流程**:
1. 标准协作流程执行
2. Verification 给出结果
3. 如 FAIL，Coordinator 安排修复
4. 循环直到 PASS 或达到最大迭代次数

**配置**:
```yaml
iteration_config:
  max_iterations: 3
  exit_condition: "PASS or max_iterations reached"
  feedback_loop: "Verification → Coordinator → Workers"
```

**适用场景**: 高质量要求的代码审查、复杂方案设计

---

## 模式3: 分阶段验证流程 (Phased Verification)

适用于大型项目，分阶段验证。

```
Phase 1          Phase 2          Phase 3
┌─────┐          ┌─────┐          ┌─────┐
│设计 │    ───▶  │开发 │    ───▶  │测试 │
└──┬──┘          └──┬──┘          └──┬──┘
   │                │                │
   ▼                ▼                ▼
┌─────┐          ┌─────┐          ┌─────┐
│验证 │          │验证 │          │验证 │
└─────┘          └─────┘          └─────┘
```

**流程**:
1. 每个阶段完成后立即验证
2. 阶段内 FAIL 不进入下一阶段
3. 最终综合所有阶段结果

**适用场景**: 大型功能开发、系统重构

---

## 模式4: 多路并行验证 (Parallel Verification)

适用于需要多维度验证的任务。

```
                    ┌──────────────────┐
                    │   Coordinator    │
                    └────────┬─────────┘
                             │
           ┌─────────────────┼─────────────────┐
           │                 │                 │
           ▼                 ▼                 ▼
      ┌─────────┐      ┌─────────┐      ┌─────────┐
      │ Worker1 │      │ Worker2 │      │ Worker3 │
      │ 功能实现 │      │ 功能实现 │      │ 功能实现 │
      └────┬────┘      └────┬────┘      └────┬────┘
           │                 │                 │
           ▼                 ▼                 ▼
      ┌─────────┐      ┌─────────┐      ┌─────────┐
      │ Verifier│      │ Verifier│      │ Verifier│
      │ 功能验证 │      │ 安全验证 │      │ 性能验证 │
      └────┬────┘      └────┬────┘      └────┬────┘
           │                 │                 │
           └─────────────────┼─────────────────┘
                             ▼
                    ┌──────────────────┐
                    │   综合报告        │
                    └──────────────────┘
```

**流程**:
1. Workers 并行执行
2. 多个 Verifiers 从不同维度验证
3. Coordinator 综合所有验证报告

**适用场景**: 安全关键系统、性能敏感功能

---

## 模式5: 专家咨询流程 (Expert Consultation)

适用于需要专业知识的决策。

```
┌─────────┐
│ Coordinator
└────┬────┘
     │ 分发到多个专家
     ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│ Expert1 │  │ Expert2 │  │ Expert3 │
│ 架构专家 │  │ 安全专家 │  │ 性能专家 │
└────┬────┘  └────┬────┘  └────┬────┘
     │            │            │
     └────────────┼────────────┘
                  ▼
          ┌───────────────┐
          │  Coordinator  │
          │  综合专家意见  │
          └───────────────┘
```

**流程**:
1. Coordinator 定义咨询问题
2. 分发给不同领域专家
3. 收集专家意见
4. Coordinator 综合决策

**适用场景**: 架构评审、技术选型、风险评估

---

## 工作流选择指南

| 任务特征 | 推荐模式 |
|---------|---------|
| 小规模、明确 | 标准协作 |
| 高质量要求 | 迭代改进 |
| 大型项目 | 分阶段验证 |
| 多维度要求 | 多路并行验证 |
| 需要专业判断 | 专家咨询 |

---

## 状态机定义

```yaml
task_state_machine:
  states:
    - PENDING: "待分配"
    - ASSIGNED: "已分配"
    - IN_PROGRESS: "执行中"
    - COMPLETED: "已完成"
    - IN_VERIFICATION: "验证中"
    - VERIFIED_PASS: "验证通过"
    - VERIFIED_FAIL: "验证失败"
    - REWORK: "返工中"
    - DELIVERED: "已交付"
    - BLOCKED: "阻塞"

  transitions:
    PENDING → ASSIGNED: "Coordinator 分配"
    ASSIGNED → IN_PROGRESS: "Worker 开始"
    ASSIGNED → BLOCKED: "Worker 无法开始"
    IN_PROGRESS → COMPLETED: "Worker 完成"
    IN_PROGRESS → BLOCKED: "Worker 遇到阻塞"
    COMPLETED → IN_VERIFICATION: "Coordinator 提交验证"
    IN_VERIFICATION → VERIFIED_PASS: "验证通过"
    IN_VERIFICATION → VERIFIED_FAIL: "验证失败"
    VERIFIED_FAIL → REWORK: "Coordinator 安排返工"
    REWORK → IN_PROGRESS: "Worker 开始修复"
    VERIFIED_PASS → DELIVERED: "Coordinator 交付"
    BLOCKED → IN_PROGRESS: "阻塞解除"

  final_states:
    - DELIVERED
    - VERIFIED_FAIL  # 达到最大迭代次数仍失败
```

---

## 超时和异常处理

```yaml
error_handling:
  worker_timeout:
    threshold: "2x estimated_time"
    action: "escalate_to_coordinator"
  
  verification_timeout:
    threshold: "30min"
    action: "escalate_to_coordinator"
  
  max_iterations_exceeded:
    condition: "iteration_count > max_iterations"
    action: "escalate_to_user"
  
  deadlock_detection:
    condition: "circular_dependencies"
    action: "break_and_report"
```
