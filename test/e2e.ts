/**
 * VeroAI SDK — End-to-End Test Script
 *
 * Exercises the SDK against a real API instance.
 *
 * Required env vars:
 *   VERO_API_KEY   — API key for authentication
 *   VERO_BASE_URL  — Base URL of the VeroAI API
 *
 * Usage:
 *   VERO_API_KEY=sk_test_... VERO_BASE_URL=http://localhost:3000 npx tsx test/e2e.ts
 */

import { VeroAI } from '../src';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const apiKey = process.env.VERO_API_KEY;
const baseUrl = process.env.VERO_BASE_URL;

if (!apiKey) {
  console.error('Missing required env var: VERO_API_KEY');
  process.exit(1);
}

if (!baseUrl) {
  console.error('Missing required env var: VERO_BASE_URL');
  process.exit(1);
}

const veroai = new VeroAI({ apiKey, baseUrl });

// ---------------------------------------------------------------------------
// Test harness
// ---------------------------------------------------------------------------

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';
const DIM = '\x1b[2m';

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ${GREEN}✓${RESET} ${name}`);
  } catch (err) {
    failed++;
    const message = err instanceof Error ? err.message : String(err);
    console.log(`  ${RED}✗${RESET} ${name}`);
    console.log(`    ${DIM}${message}${RESET}`);
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

function section(title: string): void {
  console.log(`\n${BOLD}${title}${RESET}`);
}

// ---------------------------------------------------------------------------
// Section 1: Agents
// ---------------------------------------------------------------------------

async function testAgents(): Promise<void> {
  section('Agents');

  let agentId: string | undefined;

  try {
    await test('create agent', async () => {
      const agent = await veroai.agents.create({
        name: 'E2E Test Agent',
        modelConfig: {
          provider: 'anthropic',
          modelId: 'claude-sonnet-4-20250514',
          temperature: 0.7,
        },
        systemPrompt: 'You are a test agent',
      });

      assert(typeof agent.id === 'string', 'agent should have an id');
      assert(agent.name === 'E2E Test Agent', 'agent name should match');
      assert(agent.modelConfig.provider === 'anthropic', 'provider should be anthropic');
      assert(agent.modelConfig.modelId === 'claude-sonnet-4-20250514', 'modelId should match');
      assert(agent.systemPrompt === 'You are a test agent', 'systemPrompt should match');

      agentId = agent.id;
    });

    await test('list agents (includes created)', async () => {
      assert(agentId !== undefined, 'agent must have been created');

      const result = await veroai.agents.list();
      assert(Array.isArray(result.data), 'data should be an array');

      const found = result.data.find((a) => a.id === agentId);
      assert(found !== undefined, 'created agent should appear in list');
    });

    await test('get agent by id', async () => {
      assert(agentId !== undefined, 'agent must have been created');

      const agent = await veroai.agents.get(agentId!);
      assert(agent.id === agentId, 'returned agent id should match');
      assert(agent.name === 'E2E Test Agent', 'returned agent name should match');
    });

    await test('update agent name', async () => {
      assert(agentId !== undefined, 'agent must have been created');

      const agent = await veroai.agents.update(agentId!, {
        name: 'E2E Test Agent (Updated)',
      });
      assert(agent.name === 'E2E Test Agent (Updated)', 'name should be updated');
    });
  } finally {
    if (agentId) {
      await test('delete agent', async () => {
        await veroai.agents.delete(agentId!);

        // Verify deletion by expecting a 404
        try {
          await veroai.agents.get(agentId!);
          throw new Error('agent should have been deleted but get() succeeded');
        } catch (err: unknown) {
          const isNotFound =
            err instanceof Error &&
            (err.message.includes('404') || err.message.includes('not found') || err.message.includes('Not Found'));
          assert(isNotFound, 'get after delete should return 404');
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Section 2: Carriers
// ---------------------------------------------------------------------------

async function testCarriers(): Promise<void> {
  section('Carriers');

  let carrierId: string | undefined;

  try {
    await test('create carrier', async () => {
      const carrier = await veroai.voice.carriers.create({
        name: 'E2E Test Carrier',
        sipHost: 'sip.test.example.com',
        sipPort: 5060,
        trunkType: 'both',
      });

      assert(typeof carrier.id === 'string', 'carrier should have an id');
      assert(carrier.name === 'E2E Test Carrier', 'carrier name should match');
      assert(carrier.sipHost === 'sip.test.example.com', 'sipHost should match');
      assert(carrier.sipPort === 5060, 'sipPort should match');
      assert(carrier.trunkType === 'both', 'trunkType should match');

      carrierId = carrier.id;
    });

    await test('list carriers (includes created)', async () => {
      assert(carrierId !== undefined, 'carrier must have been created');

      const result = await veroai.voice.carriers.list();
      assert(Array.isArray(result.data), 'data should be an array');

      const found = result.data.find((c) => c.id === carrierId);
      assert(found !== undefined, 'created carrier should appear in list');
    });

    await test('get carrier by id', async () => {
      assert(carrierId !== undefined, 'carrier must have been created');

      const carrier = await veroai.voice.carriers.get(carrierId!);
      assert(carrier.id === carrierId, 'returned carrier id should match');
      assert(carrier.name === 'E2E Test Carrier', 'returned carrier name should match');
    });

    await test('update carrier name', async () => {
      assert(carrierId !== undefined, 'carrier must have been created');

      const carrier = await veroai.voice.carriers.update(carrierId!, {
        name: 'E2E Test Carrier (Updated)',
      });
      assert(carrier.name === 'E2E Test Carrier (Updated)', 'name should be updated');
    });
  } finally {
    if (carrierId) {
      await test('delete carrier', async () => {
        await veroai.voice.carriers.delete(carrierId!);

        try {
          await veroai.voice.carriers.get(carrierId!);
          throw new Error('carrier should have been deleted but get() succeeded');
        } catch (err: unknown) {
          const isNotFound =
            err instanceof Error &&
            (err.message.includes('404') || err.message.includes('not found') || err.message.includes('Not Found'));
          assert(isNotFound, 'get after delete should return 404');
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Section 3: Voice Numbers
// ---------------------------------------------------------------------------

async function testVoiceNumbers(): Promise<void> {
  section('Voice Numbers');

  await test('search available numbers (US)', async () => {
    const results = await veroai.voice.numbers.search({
      country: 'US',
      limit: 1,
    });

    assert(Array.isArray(results), 'search should return an array');
    console.log(
      `    ${DIM}Found ${results.length} available number(s)${results.length > 0 ? `: ${results[0].number}` : ''}${RESET}`,
    );

    if (results.length > 0) {
      const num = results[0];
      assert(typeof num.number === 'string', 'number should be a string');
      assert(num.country === 'US', 'country should be US');
      assert(typeof num.monthlyCostCents === 'number', 'monthlyCostCents should be a number');
      assert(Array.isArray(num.capabilities), 'capabilities should be an array');
    }
  });

  await test('list owned numbers', async () => {
    const result = await veroai.voice.numbers.list();
    assert(Array.isArray(result.data), 'data should be an array');
    assert(typeof result.total === 'number', 'total should be a number');
    console.log(`    ${DIM}${result.total} owned number(s)${RESET}`);
  });
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log(`${BOLD}VeroAI SDK E2E Tests${RESET}`);
  console.log(`${DIM}API: ${baseUrl}${RESET}`);

  await testAgents();
  await testCarriers();
  await testVoiceNumbers();

  console.log('');
  console.log(`${BOLD}Results:${RESET} ${GREEN}${passed} passed${RESET}, ${failed > 0 ? RED : DIM}${failed} failed${RESET}`);
  console.log('');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Unhandled error in E2E test runner:', err);
  process.exit(1);
});
