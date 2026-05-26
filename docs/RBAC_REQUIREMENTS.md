# WAgent RBAC 权限系统需求文档

## 1. 概述

### 1.1 目标
实现基于角色的访问控制（RBAC）系统，为 WAgent 平台提供细粒度的权限管理能力，支持多用户协作场景下的安全访问控制。

### 1.2 适用范围
- 用户管理
- Agent 功能访问
- 系统配置管理
- 资源（会话、技能、工具、知识库）管理

## 2. 角色定义

### 2.1 角色层级

| 角色 | 角色标识 | 描述 |
|------|---------|------|
| 超级管理员 | `super_admin` | 系统最高权限，可管理所有资源和用户 |
| 管理员 | `admin` | 可以管理普通用户和大部分系统资源 |
| 普通用户 | `user` | 可以使用 Agent 功能，管理自己的资源 |
| 访客 | `guest` | 只读访问，只能查看已授权的资源 |

### 2.2 角色继承关系
```
super_admin > admin > user > guest
```

## 3. 权限列表

### 3.1 权限分类

#### Agent 功能权限
| 权限标识 | 权限名称 | 描述 | 默认角色 |
|---------|---------|------|---------|
| `agent:chat` | 使用 Agent 对话 | 可以发送消息与 Agent 交互 | user, admin, super_admin |
| `agent:config:view` | 查看配置 | 可以查看系统配置 | user, admin, super_admin |
| `agent:config:edit` | 修改配置 | 可以修改 Agent 配置 | admin, super_admin |

#### 会话管理权限
| 权限标识 | 权限名称 | 描述 | 默认角色 |
|---------|---------|------|---------|
| `session:create` | 创建会话 | 可以创建新的聊天会话 | user, admin, super_admin |
| `session:manage:own` | 管理自己的会话 | 可以重命名、删除自己的会话 | user, admin, super_admin |
| `session:manage:all` | 管理所有会话 | 可以管理所有用户的会话 | admin, super_admin |

#### 技能管理权限
| 权限标识 | 权限名称 | 描述 | 默认角色 |
|---------|---------|------|---------|
| `skill:view` | 查看技能 | 可以查看技能列表和详情 | user, admin, super_admin |
| `skill:create` | 创建技能 | 可以创建新技能 | admin, super_admin |
| `skill:edit` | 编辑技能 | 可以编辑已有技能 | admin, super_admin |
| `skill:delete` | 删除技能 | 可以删除技能 | super_admin |

#### 工具管理权限
| 权限标识 | 权限名称 | 描述 | 默认角色 |
|---------|---------|------|---------|
| `tool:view` | 查看工具 | 可以查看工具列表 | user, admin, super_admin |
| `tool:enable` | 启用/禁用工具 | 可以启用或禁用工具 | admin, super_admin |
| `tool:config` | 配置工具 | 可以配置工具参数 | admin, super_admin |

#### 知识库权限
| 权限标识 | 权限名称 | 描述 | 默认角色 |
|---------|---------|------|---------|
| `knowledge:view` | 查看知识 | 可以查看知识库内容 | user, admin, super_admin |
| `knowledge:add` | 添加知识 | 可以向知识库添加内容 | admin, super_admin |
| `knowledge:edit` | 编辑知识 | 可以编辑知识库内容 | admin, super_admin |
| `knowledge:delete` | 删除知识 | 可以删除知识库内容 | admin, super_admin |

#### Webhook 管理权限
| 权限标识 | 权限名称 | 描述 | 默认角色 |
|---------|---------|------|---------|
| `webhook:view` | 查看 Webhook | 可以查看 Webhook 配置 | user, admin, super_admin |
| `webhook:create` | 创建 Webhook | 可以创建 Webhook 端点 | admin, super_admin |
| `webhook:delete` | 删除 Webhook | 可以删除 Webhook 端点 | admin, super_admin |

#### 用户管理权限
| 权限标识 | 权限名称 | 描述 | 默认角色 |
|---------|---------|------|---------|
| `user:view` | 查看用户 | 可以查看用户列表 | admin, super_admin |
| `user:create` | 创建用户 | 可以创建新用户 | admin, super_admin |
| `user:edit` | 编辑用户 | 可以编辑用户信息 | admin, super_admin |
| `user:delete` | 删除用户 | 可以删除用户 | super_admin |
| `user:assign_role` | 分配角色 | 可以为用户分配角色 | super_admin |

#### 系统管理权限
| 权限标识 | 权限名称 | 描述 | 默认角色 |
|---------|---------|------|---------|
| `system:settings` | 系统设置 | 可以修改系统级设置 | super_admin |
| `system:logs` | 查看日志 | 可以查看系统日志 | admin, super_admin |
| `system:backup` | 备份恢复 | 可以进行系统备份和恢复 | super_admin |

## 4. 数据库设计

### 4.1 角色表 (roles)
```sql
CREATE TABLE roles (
  id          VARCHAR(36)  PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL UNIQUE COMMENT '角色标识',
  display_name VARCHAR(100) NOT NULL COMMENT '角色显示名称',
  description TEXT         DEFAULT NULL COMMENT '角色描述',
  is_system   TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '是否系统预设角色',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### 4.2 权限表 (permissions)
```sql
CREATE TABLE permissions (
  id          VARCHAR(36)  PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE COMMENT '权限标识',
  display_name VARCHAR(200) NOT NULL COMMENT '权限显示名称',
  description TEXT         DEFAULT NULL COMMENT '权限描述',
  category    VARCHAR(50)  NOT NULL COMMENT '权限分类',
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### 4.3 角色权限关联表 (role_permissions)
```sql
CREATE TABLE role_permissions (
  id            VARCHAR(36) PRIMARY KEY,
  role_id       VARCHAR(36) NOT NULL,
  permission_id VARCHAR(36) NOT NULL,
  created_at    TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_role_permission (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);
```

### 4.4 用户角色关联表 (user_roles)
```sql
CREATE TABLE user_roles (
  id         VARCHAR(36) PRIMARY KEY,
  user_id    VARCHAR(36) NOT NULL,
  role_id    VARCHAR(36) NOT NULL,
  created_at TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_role (user_id, role_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
);
```

## 5. API 设计

### 5.1 权限检查中间件
```typescript
// 检查用户是否有指定权限
function requirePermission(permission: string)

// 检查用户是否有任意一个指定权限
function requireAnyPermission(permissions: string[])

// 检查用户是否是指定角色
function requireRole(role: string)
```

### 5.2 角色管理 API
```
GET    /api/roles              # 获取所有角色
POST   /api/roles              # 创建角色
PUT    /api/roles/:id          # 更新角色
DELETE /api/roles/:id          # 删除角色

GET    /api/roles/:id/permissions    # 获取角色权限
PUT    /api/roles/:id/permissions    # 更新角色权限
```

### 5.3 权限管理 API
```
GET    /api/permissions       # 获取所有权限
```

### 5.4 用户角色管理 API
```
GET    /api/users/:id/roles   # 获取用户角色
PUT    /api/users/:id/roles   # 更新用户角色
```

## 6. UI 设计

### 6.1 角色管理页面
- 角色列表展示
- 角色创建/编辑弹窗
- 权限分配树形选择器

### 6.2 用户管理页面增强
- 用户角色分配
- 权限查看（只读）

### 6.3 权限控制
- 前端路由守卫
- 按钮/菜单权限控制
- 页面元素权限控制

## 7. 实现建议

### 7.1 后端实现
1. 创建 RBAC 相关的模型和数据库表
2. 实现权限检查中间件
3. 实现角色和权限管理 API
4. 更新现有 API 添加权限检查

### 7.2 前端实现
1. 创建权限上下文和 Hook
2. 实现权限控制组件
3. 添加角色管理页面
4. 更新现有页面添加权限控制

### 7.3 迁移策略
1. 创建默认角色和权限数据
2. 为现有用户分配默认角色
3. 逐步更新 API 添加权限检查

## 8. 安全考虑

- 权限检查必须在服务端进行，前端仅做展示控制
- 敏感操作需要二次确认
- 记录权限变更日志
- 定期审计用户权限
