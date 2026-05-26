-- 为 agent_skills 表添加 tags 字段
ALTER TABLE agent_skills ADD COLUMN tags JSON DEFAULT NULL COMMENT '技能标签';

-- 为已有的内置技能添加默认标签
UPDATE agent_skills SET tags = '["通用"]' WHERE name = 'general_assistant';
UPDATE agent_skills SET tags = '["代码"]' WHERE name = 'builder';
UPDATE agent_skills SET tags = '["代码"]' WHERE name = 'code_reviewer';
UPDATE agent_skills SET tags = '["运维"]' WHERE name = 'devops_expert';
UPDATE agent_skills SET tags = '["规划"]' WHERE name = 'planner';
UPDATE agent_skills SET tags = '["研究"]' WHERE name = 'researcher';
UPDATE agent_skills SET tags = '["业务"]' WHERE name LIKE 'water-%';
UPDATE agent_skills SET tags = '["编排"]' WHERE name = 'multi-agent-orchestration';
UPDATE agent_skills SET tags = '["业务"]' WHERE name = 'coordinated-line-switch-eval';
