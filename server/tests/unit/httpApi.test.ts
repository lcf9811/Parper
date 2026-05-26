/**
 * Tests for httpApi tool (real implementation)
 * TC-API-01 ~ TC-API-08
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { runTests, assert, assertEqual, assertContains, SKILLS_DIR } from '../helpers/testUtils.js';
import { server as mockServer, PORT as MOCK_PORT } from '../helpers/mockServer.js';
import { capabilityRegistry } from '../../src/services/capabilityRegistry.js';
import { executeHttpApi } from '../../src/tools/httpApi.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Setup: register test capabilities
async function setupCapabilities() {
  capabilityRegistry.clear();
  capabilityRegistry.setDomainWhitelist(['127.0.0.1', 'localhost']);

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

    // Override URL for web_api capabilities to point to mock server
    for (const cap of caps) {
      if (cap.type === 'web_api') {
        const cfg = cap.config as import('../../src/services/capabilityRegistry.js').WebApiConfig;
        // Keep original URL path but change host to mock server
        try {
          const urlObj = new URL(cfg.url);
          cfg.url = `http://127.0.0.1:${MOCK_PORT}${urlObj.pathname}`;
        } catch {
          cfg.url = `http://127.0.0.1:${MOCK_PORT}/test`;
        }
      }
    }

    capabilityRegistry.registerSkillCapabilities(skillName, caps);
  }
}

// Set test env variable
process.env.SCADA_API_TOKEN = 'test_token_123';

const results = await runTests('httpApi Tool Tests (Real Implementation)', [
  // TC-API-01
  {
    name: 'TC-API-01: 成功调用 GET API',
    fn: async () => {
      await setupCapabilities();
      const result = await executeHttpApi('query_scada_data', { station_id: 'INLET_POOL_01' });
      assertContains(result, 'pH值', 'Should contain mapped label pH值');
      assertContains(result, '7.2', 'Should contain pH value 7.2');
    },
  },

  // TC-API-02: POST is not configured in test skill, skip - test with a custom capability
  {
    name: 'TC-API-02: 环境变量注入（header 中的 ${SCADA_API_TOKEN}）',
    fn: async () => {
      await setupCapabilities();
      // The query_scada_data capability has Authorization: Bearer ${SCADA_API_TOKEN}
      // We can verify the call succeeds (meaning env var was injected)
      const result = await executeHttpApi('query_scada_data', { station_id: 'INLET_POOL_01' });
      assertContains(result, 'pH值', 'Should successfully call API with injected env vars');
    },
  },

  // TC-API-03
  {
    name: 'TC-API-03: 域名不在白名单中被拒绝',
    fn: async () => {
      await setupCapabilities();
      // Add a fake capability with disallowed domain
      capabilityRegistry.registerSkillCapabilities('test-skill', [
        {
          id: 'test-skill:bad_api',
          skillName: 'test-skill',
          type: 'web_api',
          name: 'bad_api',
          description: 'Bad API',
          enabled: true,
          config: {
            url: 'https://malicious-site.com/api',
            method: 'GET',
            headers: {},
            parameters: [],
            response_mapping: {},
          },
        },
      ]);

      let errorThrown = false;
      try {
        await executeHttpApi('bad_api', {});
      } catch (e: any) {
        errorThrown = true;
        assertContains(e.message, 'not in the allowed list', 'Should mention domain whitelist');
      }
      assert(errorThrown, 'Should have thrown error for disallowed domain');
    },
  },

  // TC-API-04
  {
    name: 'TC-API-04: 能力不存在时报错',
    fn: async () => {
      await setupCapabilities();
      let errorThrown = false;
      try {
        await executeHttpApi('nonexistent_capability', {});
      } catch (e: any) {
        errorThrown = true;
        assertContains(e.message, 'not found', 'Should mention capability not found');
      }
      assert(errorThrown, 'Should have thrown error for nonexistent capability');
    },
  },

  // TC-API-05
  {
    name: 'TC-API-05: 能力类型不是 web_api 时报错',
    fn: async () => {
      await setupCapabilities();
      let errorThrown = false;
      try {
        await executeHttpApi('calculate_carbon_source', {}); // this is python_script type
      } catch (e: any) {
        errorThrown = true;
        assertContains(e.message, 'not a web_api', 'Should mention wrong type');
      }
      assert(errorThrown, 'Should have thrown error for wrong capability type');
    },
  },

  // TC-API-06
  {
    name: 'TC-API-06: 缺失必填参数时报错',
    fn: async () => {
      await setupCapabilities();
      let errorThrown = false;
      try {
        // station_id is required but not provided
        await executeHttpApi('query_scada_data', {});
      } catch (e: any) {
        errorThrown = true;
        assertContains(e.message, 'Missing required parameter', 'Should mention missing parameter');
      }
      assert(errorThrown, 'Should have thrown error for missing required parameter');
    },
  },

  // TC-API-07
  {
    name: 'TC-API-07: HTTP 错误码处理',
    fn: async () => {
      await setupCapabilities();
      // Register a capability that points to the error endpoint
      capabilityRegistry.registerSkillCapabilities('test-skill', [
        {
          id: 'test-skill:error_api',
          skillName: 'test-skill',
          type: 'web_api',
          name: 'error_api',
          description: 'Error API',
          enabled: true,
          config: {
            url: `http://127.0.0.1:${MOCK_PORT}/api/v1/sensor/error`,
            method: 'GET',
            headers: {},
            parameters: [],
          },
        },
      ]);

      let errorThrown = false;
      try {
        await executeHttpApi('error_api', {});
      } catch (e: any) {
        errorThrown = true;
        assertContains(e.message, '500', 'Should contain HTTP 500');
      }
      assert(errorThrown, 'Should have thrown error for HTTP 500');
    },
  },

  // TC-API-08
  {
    name: 'TC-API-08: 响应格式化（response_mapping）',
    fn: async () => {
      await setupCapabilities();
      const result = await executeHttpApi('query_scada_data', { station_id: 'INLET_POOL_01' });
      assertContains(result, '进水pH值: 7.2', 'Should format pH with Chinese label');
      assertContains(result, '溶解氧', 'Should include DO label');
      assertContains(result, '化学需氧量', 'Should include COD label');
      assertContains(result, '总氮(mg/L): 25', 'Should include TN value');
    },
  },
]);

if (results.failed > 0) {
  process.exit(1);
}
