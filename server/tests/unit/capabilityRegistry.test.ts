/**
 * Tests for capabilityRegistry (real implementation)
 * TC-REG-01 ~ TC-REG-06
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { runTests, assert, assertEqual, SKILLS_DIR } from '../helpers/testUtils.js';
import { capabilityRegistry, type Capability } from '../../src/services/capabilityRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---- Test helper: scan skills dir and register capabilities (mimics localSkillLoader) ----
async function loadAndRegisterSkills(skillsDir: string) {
  capabilityRegistry.clear();
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillDir = path.join(skillsDir, entry.name);
    const skillFile = path.join(skillDir, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;

    const content = fs.readFileSync(skillFile, 'utf-8');
    // Use js-yaml to parse frontmatter (same as localSkillLoader does)
    const yaml = await import('js-yaml');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) continue;

    const frontmatter = yaml.load(match[1]) as Record<string, any>;
    if (!frontmatter.capabilities) continue;

    const skillName = frontmatter.name || entry.name;
    const caps = capabilityRegistry.parseFromFrontmatter(skillName, frontmatter.capabilities);
    if (caps.length > 0) {
      capabilityRegistry.registerSkillCapabilities(skillName, caps);
    }
  }
}

const results = await runTests('capabilityRegistry Tests (Real Implementation)', [
  // TC-REG-01
  {
    name: 'TC-REG-01: 启动时扫描并注册技能声明的 capabilities',
    fn: async () => {
      await loadAndRegisterSkills(SKILLS_DIR);
      const caps = capabilityRegistry.list();
      assert(caps.length > 0, 'Should have registered at least one capability');
      assert(caps.length === 2, `Expected 2 capabilities, got ${caps.length}`);
    },
  },

  // TC-REG-02
  {
    name: 'TC-REG-02: 查询所有已注册的能力',
    fn: async () => {
      const caps = capabilityRegistry.list();
      for (const cap of caps) {
        assert(!!cap.id, 'Capability should have id');
        assert(!!cap.skillName, 'Capability should have skillName');
        assert(!!cap.type, 'Capability should have type');
        assert(!!cap.name, 'Capability should have name');
        assert(!!cap.description, 'Capability should have description');
        assert(cap.enabled === true, 'Capability should be enabled by default');
      }
    },
  },

  // TC-REG-03
  {
    name: 'TC-REG-03: 按类型查询能力',
    fn: async () => {
      const webApis = capabilityRegistry.list().filter(c => c.type === 'web_api');
      const pythonScripts = capabilityRegistry.list().filter(c => c.type === 'python_script');

      assert(webApis.length === 1, `Expected 1 web_api, got ${webApis.length}`);
      assert(pythonScripts.length === 1, `Expected 1 python_script, got ${pythonScripts.length}`);
      assertEqual(webApis[0].name, 'query_scada_data', 'Web API name should match');
      assertEqual(pythonScripts[0].name, 'calculate_carbon_source', 'Python script name should match');
    },
  },

  // TC-REG-04
  {
    name: 'TC-REG-04: 按名称查询单个能力',
    fn: async () => {
      const cap = capabilityRegistry.findByName('query_scada_data');
      assert(!!cap, 'Should find capability by name');
      assertEqual(cap?.skillName, 'water-quality-analysis', 'Should belong to correct skill');
      assertEqual(cap?.type, 'web_api', 'Should be web_api type');

      const config = cap?.config as import('../../src/services/capabilityRegistry.js').WebApiConfig;
      assert(!!config.url, 'Should have url');
      assert(config.parameters.length > 0, 'Should have at least one parameter');
    },
  },

  // TC-REG-05
  {
    name: 'TC-REG-05: 能力启用/禁用',
    fn: async () => {
      const cap = capabilityRegistry.findByName('query_scada_data');
      assert(!!cap, 'Should find capability');

      // Disable
      capabilityRegistry.setEnabled(cap.id, false);
      let allCaps = capabilityRegistry.list();
      // The list() returns all including disabled, so check enabled flag
      const disabledCap = capabilityRegistry.findByName('query_scada_data');
      assert(disabledCap?.enabled === false, 'Capability should be disabled');

      // Re-enable
      capabilityRegistry.setEnabled(cap.id, true);
      const reEnabledCap = capabilityRegistry.findByName('query_scada_data');
      assert(reEnabledCap?.enabled === true, 'Capability should be re-enabled');
    },
  },

  // TC-REG-06
  {
    name: 'TC-REG-06: 重复初始化不产生重复注册',
    fn: async () => {
      capabilityRegistry.clear();
      await loadAndRegisterSkills(SKILLS_DIR);
      const countBefore = capabilityRegistry.list().length;

      // Register again (should overwrite, not duplicate)
      await loadAndRegisterSkills(SKILLS_DIR);
      const countAfter = capabilityRegistry.list().length;

      assertEqual(countBefore, countAfter, 'Re-registration should not duplicate capabilities');
    },
  },
]);

if (results.failed > 0) {
  process.exit(1);
}
