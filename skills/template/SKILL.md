# Skill 模板

> 复制此目录创建新技能，并修改以下字段

---

## 文件结构

```
your-skill-name/
├── SKILL.md              # 技能定义文件（必需）
├── references/           # 参考文档（可选）
│   ├── doc1.md
│   └── doc2.md
└── assets/               # 资产文件（可选）
    └── ...
```

---

## SKILL.md 格式

```markdown
---
name: your_skill_name
description: 简短描述这个技能的作用
tags:
  - tag1
  - tag2
---

# 技能标题

## 系统提示词

这里是发送给 AI 的系统提示词内容...

描述这个技能的：
- 职责和能力
- 使用场景
- 输出格式要求
- 注意事项

## 工具使用

如果这个技能需要使用特定工具，在这里说明：

### 工具 1
- 名称：tool_name
- 用途：什么时候使用
- 参数：参数说明

## 参考文档

如果需要引用知识库内容：

1. [文档 1](references/doc1.md)
2. [文档 2](references/doc2.md)

## 示例

### 输入示例
```
用户输入示例
```

### 输出示例
```
期望的输出示例
```
```

---

## 创建步骤

1. 复制此目录：`cp -r template your-skill-name`
2. 修改 `SKILL.md` 中的 frontmatter（name, description, tags）
3. 编写系统提示词
4. 添加参考文档到 `references/`（如有）
5. 在 Web 界面刷新，技能会自动加载

---

## 注意事项

- `name` 必须是唯一的，使用小写字母和下划线
- `description` 应该清晰描述技能的作用
- 系统提示词应该具体明确，避免模糊描述
- 参考文档会被自动摄取到知识库
- 技能修改后需要重启服务或调用重载 API
