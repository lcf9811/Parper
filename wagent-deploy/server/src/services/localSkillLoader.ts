/**
 * 本地 Skill 文件加载器
 * 扫描 skills/ 目录下的所有子文件夹，读取 SKILL.md 文件
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { SkillModel } from '../models/skillModel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILLS_BASE_DIR = path.resolve(__dirname, '../../../skills');

export interface LocalSkill {
  name: string;
  display_name: string;
  description: string;
  system_prompt: string;
  file_path: string;  // SKILL.md 的完整路径
  folder_path: string;  // 文件夹路径
}

/**
 * 解析 frontmatter
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, any>; body: string } {
  const result = { frontmatter: {} as Record<string, any>, body: content };
  
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/);
  if (match) {
    const frontmatterText = match[1];
    result.body = match[2].trim();
    
    // 简单解析 YAML
    for (const line of frontmatterText.split('\n')) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        result.frontmatter[key] = value;
      }
    }
  }
  
  return result;
}

/**
 * 解析 SKILL.md 文件
 */
function parseSkillFile(content: string, filePath: string, folderPath: string): LocalSkill | null {
  try {
    const { frontmatter, body } = parseFrontmatter(content);
    
    // 从 frontmatter 或文件名获取 name
    const name = frontmatter.name || path.basename(folderPath);
    const description = frontmatter.description || '';
    
    // 从 body 提取标题作为 display_name
    const titleMatch = body.match(/^#\s+(.+)$/m);
    const display_name = titleMatch ? titleMatch[1].trim() : name;
    
    return {
      name,
      display_name,
      description,
      system_prompt: body,  // 使用 markdown body 作为 system prompt
      file_path: filePath,
      folder_path: folderPath,
    };
  } catch (error) {
    console.error(`[LocalSkillLoader] Failed to parse skill file: ${filePath}`, error);
    return null;
  }
}

/**
 * 扫描 skills/ 目录下的所有子文件夹
 */
export async function scanSkillFolders(): Promise<LocalSkill[]> {
  const skills: LocalSkill[] = [];

  try {
    // 检查目录是否存在
    try {
      await fs.access(SKILLS_BASE_DIR);
    } catch {
      console.log('[LocalSkillLoader] Skills directory does not exist');
      return skills;
    }

    // 读取 skills/ 下的所有子文件夹
    const entries = await fs.readdir(SKILLS_BASE_DIR, { withFileTypes: true });
    const folders = entries.filter(e => e.isDirectory());

    console.log(`[LocalSkillLoader] Scanning ${folders.length} folders in skills/`);

    for (const folder of folders) {
      const folderPath = path.join(SKILLS_BASE_DIR, folder.name);
      const skillMdPath = path.join(folderPath, 'SKILL.md');
      
      try {
        // 检查 SKILL.md 是否存在
        await fs.access(skillMdPath);
        
        // 读取并解析
        const content = await fs.readFile(skillMdPath, 'utf-8');
        const skill = parseSkillFile(content, skillMdPath, folderPath);
        
        if (skill) {
          skills.push(skill);
          console.log(`[LocalSkillLoader] Found skill: ${skill.name} (${skill.display_name})`);
        }
      } catch {
        // SKILL.md 不存在，跳过
        console.log(`[LocalSkillLoader] Skipping ${folder.name} (no SKILL.md)`);
      }
    }
    
    // 特殊处理 local/ 子文件夹中的独立 .md 文件
    const localDir = path.join(SKILLS_BASE_DIR, 'local');
    try {
      await fs.access(localDir);
      const localFiles = await fs.readdir(localDir);
      const mdFiles = localFiles.filter(f => f.endsWith('.md') && f !== 'README.md');
      
      for (const mdFile of mdFiles) {
        const filePath = path.join(localDir, mdFile);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // 使用旧格式解析
        const nameMatch = content.match(/##\s*名称\s*\n+([^\n]+)/);
        const displayNameMatch = content.match(/##\s*显示名称\s*\n+([^\n]+)/);
        const descMatch = content.match(/##\s*描述\s*\n+([^\n#]+)/);
        const promptMatch = content.match(/##\s*系统提示词\s*\n+([\s\S]+)$/);
        
        if (nameMatch && promptMatch) {
          const name = nameMatch[1].trim();
          skills.push({
            name,
            display_name: displayNameMatch ? displayNameMatch[1].trim() : name,
            description: descMatch ? descMatch[1].trim() : '',
            system_prompt: promptMatch[1].trim(),
            file_path: filePath,
            folder_path: localDir,
          });
          console.log(`[LocalSkillLoader] Found local skill: ${name}`);
        }
      }
    } catch {
      // local 目录不存在或为空
    }
  } catch (error) {
    console.error('[LocalSkillLoader] Failed to scan skill folders:', error);
  }

  console.log(`[LocalSkillLoader] Total skills found: ${skills.length}`);
  return skills;
}

/**
 * 同步本地 skill 到数据库（只注册路径，不复制内容）
 */
export async function syncLocalSkillsToDB(): Promise<void> {
  try {
    const localSkills = await scanSkillFolders();
    
    for (const skill of localSkills) {
      // 检查是否已存在
      const existing = await SkillModel.findByName(skill.name);
      
      if (existing) {
        // 更新现有 skill（只更新路径和元数据，system_prompt 从文件读取）
        await SkillModel.update(existing.id, {
          display_name: skill.display_name,
          description: skill.description,
          system_prompt: skill.system_prompt,  // 实时读取文件内容
        });
        // 尝试存储文件路径（兼容无 file_path 字段的情况）
        try {
          await SkillModel.updateFilePath(existing.id, skill.file_path);
        } catch {
          // 忽略字段不存在错误
        }
        console.log(`[LocalSkillLoader] Updated skill: ${skill.name} -> ${skill.file_path}`);
      } else {
        // 创建新 skill
        const newSkill = await SkillModel.create({
          name: skill.name,
          display_name: skill.display_name,
          description: skill.description,
          system_prompt: skill.system_prompt,
        });
        // 尝试存储文件路径（兼容无 file_path 字段的情况）
        try {
          await SkillModel.updateFilePath(newSkill.id, skill.file_path);
        } catch {
          // 忽略字段不存在错误
        }
        console.log(`[LocalSkillLoader] Created skill: ${skill.name} -> ${skill.file_path}`);
      }
    }

    console.log(`[LocalSkillLoader] Synced ${localSkills.length} local skills`);
  } catch (error) {
    console.error('[LocalSkillLoader] Failed to sync local skills:', error);
    throw error;
  }
}

/**
 * 获取所有 skills（带文件路径）
 */
export async function getAllSkillsWithSource(): Promise<any[]> {
  const skills = await SkillModel.findAll();
  
  // 标记来源
  return skills.map(skill => ({
    ...skill,
    source: skill.built_in ? 'builtin' : (skill.file_path ? 'local' : 'database'),
  }));
}
