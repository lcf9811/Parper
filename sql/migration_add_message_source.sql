-- 添加消息来源字段，用于区分 webhook 消息和普通用户消息
ALTER TABLE agent_messages 
ADD COLUMN source VARCHAR(50) DEFAULT 'user' COMMENT '消息来源：user(用户输入), webhook(后台推送)';

-- 创建索引加速查询
CREATE INDEX idx_messages_source ON agent_messages(source);
