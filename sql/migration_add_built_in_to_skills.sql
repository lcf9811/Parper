-- 为已有数据库添加 agent_skills.built_in 字段并更新内置技能

ALTER TABLE agent_skills ADD COLUMN IF NOT EXISTS built_in TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否内置技能';

-- 将种子数据中的内置技能标记为 built_in=1
UPDATE agent_skills SET built_in = 1 WHERE name IN ('general_assistant', 'planner', 'researcher', 'builder');
