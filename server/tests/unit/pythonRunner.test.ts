/**
 * Tests for pythonRunner tool (real implementation)
 * TC-PY-01 ~ TC-PY-09
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { runTests, assert, assertEqual, assertContains, SKILLS_DIR, SCRIPTS_DIR } from '../helpers/testUtils.js';
import { capabilityRegistry } from '../../src/services/capabilityRegistry.js';
import { executePythonScript } from '../../src/tools/pythonRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Compute the project root scripts directory (wagent/scripts/)
const PROJECT_SCRIPTS_DIR = path.resolve(__dirname, '..', 'fixtures', '..', '..', '..', 'scripts');

// Setup: register test capabilities
async function setupCapabilities() {
  capabilityRegistry.clear();

  const entries = fs.readdirSync(SKILLS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(SKILLS_DIR, entry.name, 'SKILL.md');
    if (!fs.existsSync(skillFile)) continue;

    const content = fs.readFileSync(skillFile, 'utf-8');
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) continue;

    const frontmatter = yaml.load(match[1]) as Record<string, any>;
    if (!frontmatter.capabilities) continue;

    const skillName = frontmatter.name || entry.name;
    const caps = capabilityRegistry.parseFromFrontmatter(skillName, frontmatter.capabilities);

    // Override script paths to use absolute paths under project root scripts/
    for (const cap of caps) {
      if (cap.type === 'python_script') {
        const cfg = cap.config as import('../../src/services/capabilityRegistry.js').PythonScriptConfig;
        const scriptName = path.basename(cfg.script);
        const scriptDir = path.dirname(cfg.script).split(/[\/\\]/).pop() || '';
        if (scriptDir === 'dosing' || scriptName.includes('carbon')) {
          cfg.script = path.join(PROJECT_SCRIPTS_DIR, 'dosing', scriptName);
        }
      }
    }

    capabilityRegistry.registerSkillCapabilities(skillName, caps);
  }
}

const results = await runTests('pythonRunner Tool Tests (Real Implementation)', [
  // TC-PY-01
  {
    name: 'TC-PY-01: 成功执行 Python 脚本',
    fn: async () => {
      await setupCapabilities();
      const result = await executePythonScript('calculate_carbon_source', { inflow_tn: 25 });
      assertContains(result, 'dosage', 'Script result should contain dosage info');
    },
  },

  // TC-PY-02
  {
    name: 'TC-PY-02: 参数传递（stdin JSON）',
    fn: async () => {
      await setupCapabilities();
      const result = await executePythonScript('calculate_carbon_source', {
        inflow_tn: 25,
        outflow_tn_limit: 10,
        flow_rate: 5000,
      });
      assertContains(result, '5000', 'Should contain flow_rate value');
      // tn_removed = inflow_tn(25) - outflow_tn_limit(10) = 15
      assertContains(result, '15', 'Should contain derived tn_removed value');
    },
  },

  // TC-PY-03
  {
    name: 'TC-PY-03: 脚本路径不在白名单中被拒绝',
    fn: async () => {
      await setupCapabilities();
      // Register a capability with a script outside the scripts/ directory
      capabilityRegistry.registerSkillCapabilities('bad-skill', [
        {
          id: 'bad-skill:bad_script',
          skillName: 'bad-skill',
          type: 'python_script',
          name: 'bad_script',
          description: 'Bad script',
          enabled: true,
          config: {
            script: '../../../etc/passwd.py',
            parameters: [],
          },
        },
      ]);

      let errorThrown = false;
      try {
        await executePythonScript('bad_script', {});
      } catch (e: any) {
        errorThrown = true;
        assertContains(e.message, 'scripts/', 'Should mention scripts/ directory restriction');
      }
      assert(errorThrown, 'Should have thrown error for path outside scripts/');
    },
  },

  // TC-PY-04
  {
    name: 'TC-PY-04: 脚本不存在',
    fn: async () => {
      await setupCapabilities();
      capabilityRegistry.registerSkillCapabilities('missing-skill', [
        {
          id: 'missing-skill:missing_script',
          skillName: 'missing-skill',
          type: 'python_script',
          name: 'missing_script',
          description: 'Missing script',
          enabled: true,
          config: {
            script: path.join(PROJECT_SCRIPTS_DIR, 'nonexistent.py'),
            parameters: [],
          },
        },
      ]);

      let errorThrown = false;
      try {
        await executePythonScript('missing_script', {});
      } catch (e: any) {
        errorThrown = true;
        assertContains(e.message, 'not found', 'Should mention file not found');
      }
      assert(errorThrown, 'Should have thrown error for nonexistent script');
    },
  },

  // TC-PY-05
  {
    name: 'TC-PY-05: 脚本执行超时',
    fn: async () => {
      await setupCapabilities();
      // Register a timeout test capability
      capabilityRegistry.registerSkillCapabilities('timeout-skill', [
        {
          id: 'timeout-skill:timeout_script',
          skillName: 'timeout-skill',
          type: 'python_script',
          name: 'timeout_script',
          description: 'Timeout script',
          enabled: true,
          config: {
            script: path.join(PROJECT_SCRIPTS_DIR, 'test', 'timeout_test.py'),
            parameters: [],
          },
        },
      ]);

      let errorThrown = false;
      try {
        await executePythonScript('timeout_script', {});
      } catch (e: any) {
        errorThrown = true;
        assertContains(e.message, 'timed out', 'Should mention timeout');
      }
      assert(errorThrown, 'Should have thrown timeout error');
    },
  },

  // TC-PY-06
  {
    name: 'TC-PY-06: 脚本输出非 JSON 格式',
    fn: async () => {
      await setupCapabilities();
      // Register a plain text test capability
      capabilityRegistry.registerSkillCapabilities('text-skill', [
        {
          id: 'text-skill:text_script',
          skillName: 'text-skill',
          type: 'python_script',
          name: 'text_script',
          description: 'Plain text script',
          enabled: true,
          config: {
            script: path.join(PROJECT_SCRIPTS_DIR, 'test', 'plain_text.py'),
            parameters: [],
            output_format: 'text',
          },
        },
      ]);

      const result = await executePythonScript('text_script', {});
      assertContains(result, 'Hello World', 'Should contain plain text output');
    },
  },

  // TC-PY-07
  {
    name: 'TC-PY-07: 危险函数检测（静态分析）',
    fn: async () => {
      await setupCapabilities();
      capabilityRegistry.registerSkillCapabilities('danger-skill', [
        {
          id: 'danger-skill:dangerous',
          skillName: 'danger-skill',
          type: 'python_script',
          name: 'dangerous',
          description: 'Dangerous script',
          enabled: true,
          config: {
            script: path.join(PROJECT_SCRIPTS_DIR, 'test', 'dangerous.py'),
            parameters: [],
          },
        },
      ]);

      let errorThrown = false;
      try {
        await executePythonScript('dangerous', {});
      } catch (e: any) {
        errorThrown = true;
        // The real implementation uses "Dangerous pattern" message
        assert(
          e.message.includes('dangerous') || e.message.includes('Dangerous') || e.message.includes('security'),
          'Should mention security/danger issue',
        );
      }
      assert(errorThrown, 'Should have thrown error for dangerous script');
    },
  },

  // TC-PY-08
  {
    name: 'TC-PY-08: 脚本退出码非零',
    fn: async () => {
      await setupCapabilities();
      capabilityRegistry.registerSkillCapabilities('error-skill', [
        {
          id: 'error-skill:error_test',
          skillName: 'error-skill',
          type: 'python_script',
          name: 'error_test',
          description: 'Error exit script',
          enabled: true,
          config: {
            script: path.join(PROJECT_SCRIPTS_DIR, 'test', 'error_test.py'),
            parameters: [],
          },
        },
      ]);

      // The real implementation uses exec which throws on non-zero exit
      let errorThrown = false;
      try {
        await executePythonScript('error_test', {});
      } catch (e: any) {
        errorThrown = true;
        // exec throws with non-zero exit code
        assert(
          e.message.includes('failed') || e.message.includes('error') || e.message.includes('exit'),
          'Should mention execution failure',
        );
      }
      assert(errorThrown, 'Should have thrown error for non-zero exit');
    },
  },

  // TC-PY-09
  {
    name: 'TC-PY-09: 缺失必填参数时报错',
    fn: async () => {
      await setupCapabilities();
      let errorThrown = false;
      try {
        // inflow_tn is required but not provided
        await executePythonScript('calculate_carbon_source', {});
      } catch (e: any) {
        errorThrown = true;
        assertContains(e.message, 'Missing required parameter', 'Should mention missing parameter');
      }
      assert(errorThrown, 'Should have thrown error for missing required parameter');
    },
  },
]);

if (results.failed > 0) {
  process.exit(1);
}
