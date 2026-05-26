import { Router, Request, Response } from 'express';
import { skillRegistry } from '../services/skillRegistry.js';
import { syncLocalSkillsToDB } from '../services/localSkillLoader.js';

const router = Router();

/** GET /api/skills - 获取所有技能 */
router.get('/', async (_req: Request, res: Response) => {
  try {
    const skills = await skillRegistry.listSkills();
    res.json(skills);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/skills/reload - 重新加载本地 skills */
router.post('/reload', async (_req: Request, res: Response) => {
  try {
    await syncLocalSkillsToDB();
    const skills = await skillRegistry.listSkills();
    res.json({ ok: true, count: skills.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** POST /api/skills - 新建技能 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, display_name, description, system_prompt, tags } = req.body;
    if (!name || !system_prompt) {
      res.status(400).json({ error: '缺少必填字段: name, system_prompt' });
      return;
    }
    const skill = await skillRegistry.createSkill({
      name,
      display_name: display_name || name,
      description,
      system_prompt,
      tags,
    });
    res.status(201).json(skill);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** PUT /api/skills/:id - 更新技能 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    await skillRegistry.updateSkill(req.params.id as string, req.body);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/** DELETE /api/skills/:id - 删除技能 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await skillRegistry.deleteSkill(req.params.id as string);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
