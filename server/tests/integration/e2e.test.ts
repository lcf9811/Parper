/**
 * End-to-End Integration Tests (real implementation)
 * TC-E2E-01 ~ TC-E2E-04
 *
 * Tests the full flow using actual capabilityRegistry + httpApi + pythonRunner implementations.
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { runTests, assert, assertEqual, assertContains, SKILLS_DIR, SCRIPTS_DIR } from '../helpers/testUtils.js';
import { server as mockServer, PORT as MOCK_PORT } from '../helpers/mockServer.js';
import { capabilityRegistry } from '../../src/services/capabilityRegistry.js';
import { executeHttpApi } from '../../src/tools/httpApi.js';
import { executePythonScript } from '../../src/tools/pythonRunner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Compute the project root scripts directory (wagent/scripts/)
const PROJECT_SCRIPTS_DIR = path.resolve(__dirname, '..', 'fixtures', '..', '..', '..', 'scripts');

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

    // Override URLs and paths for test fixtures
    for (const cap of caps) {
      if (cap.type === 'web_api') {
        const cfg = cap.config as import('../../src/services/capabilityRegistry.js').WebApiConfig;
        try {
          const urlObj = new URL(cfg.url);
          cfg.url = `http://127.0.0.1:${MOCK_PORT}${urlObj.pathname}`;
        } catch {
          cfg.url = `http://127.0.0.1:${MOCK_PORT}/test`;
        }
      } else if (cap.type === 'python_script') {
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

// Simulated execution step tracker
const executionSteps: Array<{ type: string; name: string; input: any; output: string }> = [];

function recordStep(type: string, name: string, input: any, output: string) {
  executionSteps.push({ type, name, input, output });
}

// Simulated Agent decision logic (simplified)
async function simulateAgentDecision(
  userMessage: string,
  params: Record<string, any>,
): Promise<Array<{ capabilityName: string; params: Record<string, any>; type: string }>> {
  const calls: Array<{ capabilityName: string; params: Record<string, any>; type: string }> = [];

  // Check if message relates to water quality
  if (userMessage.includes('水质') || userMessage.includes('参数') || userMessage.includes('ph') || userMessage.includes('pH')) {
    const cap = capabilityRegistry.findByName('query_scada_data');
    if (cap && cap.enabled) {
      const apiParams: Record<string, any> = {};
      if (params.station_id) apiParams.station_id = params.station_id;
      calls.push({ capabilityName: 'query_scada_data', params: apiParams, type: 'web_api' });
    }
  }

  // Check if message relates to dosing calculation
  if (userMessage.includes('加药') || userMessage.includes('碳源') || userMessage.includes('TN')) {
    const cap = capabilityRegistry.findByName('calculate_carbon_source');
    if (cap && cap.enabled) {
      const scriptParams: Record<string, any> = {};
      if (params.inflow_tn) scriptParams.inflow_tn = params.inflow_tn;
      if (params.outflow_tn_limit) scriptParams.outflow_tn_limit = params.outflow_tn_limit;
      calls.push({ capabilityName: 'calculate_carbon_source', params: scriptParams, type: 'python_script' });
    }
  }

  return calls;
}

// Set test env
process.env.SCADA_API_TOKEN = 'test_token_123';

const results = await runTests('End-to-End Integration Tests (Real Implementation)', [
  // TC-E2E-01
  {
    name: 'TC-E2E-01: Agent 识别并调用 Web API 能力',
    fn: async () => {
      await setupCapabilities();
      executionSteps.length = 0;

      const userMessage = '当前进水池的水质参数是多少？';
      const agentParams = { station_id: 'INLET_POOL_01' };

      const decisions = await simulateAgentDecision(userMessage, agentParams);
      assert(decisions.length > 0, 'Agent should decide to call at least one capability');

      for (const { capabilityName, params, type } of decisions) {
        if (type === 'web_api') {
          const output = await executeHttpApi(capabilityName, params);
          recordStep('api_call', capabilityName, params, output);
          assertContains(output, 'pH值', 'API result should contain formatted pH');
        }
      }

      const apiSteps = executionSteps.filter(s => s.type === 'api_call');
      assertEqual(apiSteps.length, 1, 'Should have exactly 1 api_call step');
      assertEqual(apiSteps[0].name, 'query_scada_data', 'Step should be query_scada_data');
    },
  },

  // TC-E2E-02
  {
    name: 'TC-E2E-02: Agent 识别并执行 Python 脚本能力',
    fn: async () => {
      await setupCapabilities();
      executionSteps.length = 0;

      const userMessage = '当前进水 TN 25mg/L，需要加多少碳源？';
      const agentParams = { inflow_tn: 25 };

      const decisions = await simulateAgentDecision(userMessage, agentParams);
      assert(decisions.length > 0, 'Agent should decide to call at least one capability');

      for (const { capabilityName, params, type } of decisions) {
        if (type === 'python_script') {
          const output = await executePythonScript(capabilityName, params);
          recordStep('python_script', capabilityName, params, output);
          assertContains(output, 'dosage', 'Script result should contain dosage info');
        }
      }

      const scriptSteps = executionSteps.filter(s => s.type === 'python_script');
      assertEqual(scriptSteps.length, 1, 'Should have exactly 1 python_script step');
      assertEqual(scriptSteps[0].name, 'calculate_carbon_source', 'Step should be calculate_carbon_source');
    },
  },

  // TC-E2E-03
  {
    name: 'TC-E2E-03: Agent 组合调用 API + Python 脚本',
    fn: async () => {
      await setupCapabilities();
      executionSteps.length = 0;

      // Step 1: Query water quality from API
      const qualityOutput = await executeHttpApi('query_scada_data', { station_id: 'INLET_POOL_01' });
      recordStep('api_call', 'query_scada_data', { station_id: 'INLET_POOL_01' }, qualityOutput);

      // Parse API result to extract TN
      let inflowTn = 25; // default from mock
      try {
        const lines = qualityOutput.split('\n');
        for (const line of lines) {
          if (line.includes('总氮')) {
            inflowTn = parseInt(line.split(':')[1].trim());
          }
        }
      } catch { /* use default */ }

      // Step 2: Use TN from API to calculate dosage
      const dosingOutput = await executePythonScript('calculate_carbon_source', { inflow_tn: inflowTn });
      recordStep('python_script', 'calculate_carbon_source', { inflow_tn: inflowTn }, dosingOutput);

      // Verify both steps were recorded
      assertEqual(executionSteps.length, 2, 'Should have 2 execution steps (api_call + python_script)');
      assertEqual(executionSteps[0].type, 'api_call', 'First step should be api_call');
      assertEqual(executionSteps[1].type, 'python_script', 'Second step should be python_script');
    },
  },

  // TC-E2E-04
  {
    name: 'TC-E2E-04: 能力未启用时不调用',
    fn: async () => {
      await setupCapabilities();
      // Disable the API capability
      const cap = capabilityRegistry.findByName('query_scada_data');
      if (cap) capabilityRegistry.setEnabled(cap.id, false);
      executionSteps.length = 0;

      const decisions = await simulateAgentDecision('当前进水池的水质参数是多少？', { station_id: 'INLET_POOL_01' });

      // Should NOT have api_call decision since capability is disabled
      const apiDecisions = decisions.filter(d => d.type === 'web_api');
      assertEqual(apiDecisions.length, 0, 'Should not decide to call disabled API capability');
      assertEqual(executionSteps.length, 0, 'Should have no execution steps');
    },
  },
]);

if (results.failed > 0) {
  process.exit(1);
}
