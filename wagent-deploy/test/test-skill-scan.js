#!/usr/bin/env node
/**
 * Skill 文件夹扫描测试脚本
 * 验证 skills/ 下的所有子文件夹都被扫描
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'localhost';
const BASE_PORT = 8787;
const LOG_FILE = `test-skill-scan-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;

function log(message, level = 'INFO') {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] [${level}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

// 获取本地 skills 文件夹列表
function getLocalSkillFolders() {
  const skillsDir = path.join(__dirname, 'skills');
  const folders = [];
  
  try {
    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillMdPath = path.join(skillsDir, entry.name, 'SKILL.md');
        try {
          fs.accessSync(skillMdPath);
          folders.push({
            name: entry.name,
            path: skillMdPath,
            folderPath: path.join(skillsDir, entry.name)
          });
        } catch {
          // 没有 SKILL.md，跳过
        }
      }
    }
  } catch (err) {
    log(`Error reading skills dir: ${err.message}`, 'ERROR');
  }
  
  return folders;
}

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      port: BASE_PORT,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = data ? JSON.parse(data) : null;
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  log('========================================');
  log('Skill 文件夹扫描测试开始');
  log('========================================');

  // 1. 获取本地 skills 文件夹
  log('');
  log('--- 本地 Skills 文件夹 ---');
  const localFolders = getLocalSkillFolders();
  log(`发现 ${localFolders.length} 个 Skill 文件夹:`);
  localFolders.forEach(f => log(`  - ${f.name}`));

  // 2. 健康检查
  log('');
  log('--- 健康检查 ---');
  try {
    const health = await request('GET', '/api/health');
    if (health.status === 200) {
      log('✓ 健康检查通过', 'SUCCESS');
    } else {
      log(`✗ 健康检查失败: ${health.status}`, 'ERROR');
      return 1;
    }
  } catch (err) {
    log(`✗ 健康检查错误: ${err.message}`, 'ERROR');
    return 1;
  }

  // 3. 获取 API 返回的 skills
  log('');
  log('--- 获取 API Skills ---');
  const skillsRes = await request('GET', '/api/skills');
  if (skillsRes.status !== 200) {
    log(`✗ 获取 Skills 失败: ${skillsRes.status}`, 'ERROR');
    return 1;
  }

  const apiSkills = skillsRes.data || [];
  log(`API 返回 ${apiSkills.length} 个 Skills`);

  // 4. 验证每个本地文件夹都被注册
  log('');
  log('--- 验证 Skill 注册 ---');
  let allFound = true;
  
  for (const folder of localFolders) {
    const found = apiSkills.find(s => 
      s.name === folder.name || 
      s.file_path?.includes(folder.name)
    );
    
    if (found) {
      log(`✓ ${folder.name} 已注册`, 'SUCCESS');
      if (found.file_path) {
        log(`  路径: ${found.file_path}`);
      }
    } else {
      log(`✗ ${folder.name} 未找到！`, 'ERROR');
      allFound = false;
    }
  }

  // 5. 刷新测试
  log('');
  log('--- 刷新 Skills ---');
  const reloadRes = await request('POST', '/api/skills/reload');
  if (reloadRes.status === 200) {
    log(`✓ 刷新成功: ${JSON.stringify(reloadRes.data)}`, 'SUCCESS');
  } else {
    log(`✗ 刷新失败: ${reloadRes.status}`, 'ERROR');
    allFound = false;
  }

  // 测试完成
  log('');
  log('========================================');
  if (allFound) {
    log('✓ 所有测试通过', 'SUCCESS');
  } else {
    log('✗ 部分测试失败', 'ERROR');
  }
  log(`日志: ${LOG_FILE}`);
  log('========================================');

  return allFound ? 0 : 1;
}

runTests().then(code => process.exit(code)).catch(err => {
  log(`测试错误: ${err.message}`, 'ERROR');
  process.exit(1);
});
