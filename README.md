# @veroai/sdk

Official TypeScript/JavaScript SDK for [VeroAI](https://veroai.dev) - Unified communications API.

## Installation

```bash
npm install @veroai/sdk
# or
pnpm add @veroai/sdk
# or
yarn add @veroai/sdk
```

## Quick Start

```typescript
import { VeroAI } from '@veroai/sdk';

const veroai = new VeroAI({ apiKey: 'sk_live_...' });

// Send an SMS
const result = await veroai.messages.send({
  channelId: 'ch_abc123',
  to: '+15551234567',
  content: { type: 'text', text: 'Hello from VeroAI!' }
});

// Send an email
const result = await veroai.messages.send({
  channelId: 'ch_def456',
  to: 'user@example.com',
  subject: 'Welcome!',
  content: {
    type: 'html',
    html: '<h1>Welcome to our platform</h1>'
  }
});
```

## Features

- **Full TypeScript support** with comprehensive types
- **Automatic retries** with exponential backoff
- **Error handling** with typed error classes
- **Real-time events** via WebSocket subscriptions
- **Voice/video** with LiveKit WebRTC rooms, SIP trunking, and call management
- **AI agents** with workspace files, run streaming (SSE), and team management
- **Structured agent memory** (Brain) — semantic / episodic / graph / tasks scopes with SSE subscriptions
- **Firecracker microVM sandboxes** (Sandcastle) for isolated agent execution
- **Account & tenant management** with `forTenant()` scoping for account-scoped keys
- **End-user authentication** for customer-tenant apps (email/password + MFA)
- **Federation** — mint scoped Vero JWTs for the customer's own end-users (Mode A signed-assertion or Mode B M2M)
- **Works everywhere** - Node.js, browsers, edge runtimes

## Usage

### Initialize the Client

```typescript
import { VeroAI } from '@veroai/sdk';

// With API key
const veroai = new VeroAI({ apiKey: 'sk_live_...' });

// With custom options
const veroai = new VeroAI({
  apiKey: 'sk_test_...',
  baseUrl: 'https://api.staging.veroagents.com',
  timeout: 60000,
  maxRetries: 5,
});

// From environment variables (reads VEROAI_API_KEY)
const veroai = VeroAI.fromEnv();
```

### Configuration

```typescript
interface VeroAIConfig {
  /** API key (sk_live_*, sk_test_*, or sk_dev_*) */
  apiKey: string;
  /** Base URL for API requests (default: https://api.veroagents.com) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Maximum number of retries for failed requests (default: 3) */
  maxRetries?: number;
  /** Custom fetch implementation (for Node.js < 18 or testing) */
  fetch?: typeof fetch;
}
```

### Accounts (account-scoped API keys)

Account-scoped API keys (`sk_live_*` / `sk_test_*` / `sk_dev_*` issued at the account level) let you manage an account, its tenants, and its members. Use `forTenant()` to scope subsequent calls to a specific tenant's resources (sends `X-Tenant-ID`).

```typescript
// Current account
const account = await veroai.accounts.get();

// Tenants
const { data: tenants } = await veroai.accounts.listTenants();
const tenant = await veroai.accounts.createTenant({ name: 'Acme Prod' });

// Members
const { data: members } = await veroai.accounts.listMembers();
await veroai.accounts.addMember({ userId: 'usr_123', email: 'op@acme.com', role: 'admin' });
await veroai.accounts.updateMember('usr_123', { role: 'owner' });
await veroai.accounts.removeMember('usr_123');

// Scope a client to a single tenant
const tenantClient = veroai.forTenant('tenant-uuid');
const { agents } = await tenantClient.agents.list();
```

### Channels

```typescript
// List all channels
const { data: channels } = await veroai.channels.list();

// Create a channel
const { channel, oauthUrl } = await veroai.channels.create({
  name: 'Support Email',
  adapterType: 'gmail-oauth',
  direction: 'bidirectional',
  config: {},
});

// Get channel health
const health = await veroai.channels.health('ch_abc123');
```

### Messages

```typescript
// Send a message
const result = await veroai.messages.send({
  channelId: 'ch_abc123',
  to: '+15551234567',
  content: { type: 'text', text: 'Hello!' }
});

// Send to multiple recipients
const results = await veroai.messages.sendBatch({
  channelId: 'ch_abc123',
  messages: [
    { to: '+15551234567', content: { type: 'text', text: 'Hello!' } },
    { to: '+15559876543', content: { type: 'text', text: 'Hi there!' } },
  ]
});
```

### Events

```typescript
// List events
const { data: events } = await veroai.events.list({
  channelId: 'ch_abc123',
  startDate: new Date('2024-01-01'),
  canonicalType: 'message',
});

// Get event statistics
const stats = await veroai.events.stats({ days: 7 });

// Get time series data
const timeseries = await veroai.events.timeseries({
  days: 7,
  granularity: 'hour',
});
```

### Webhooks

```typescript
// Create a webhook
const { webhook, secret } = await veroai.webhooks.create({
  name: 'My Webhook',
  url: 'https://example.com/webhook',
  events: ['message.received', 'message.sent'],
});

// Save the secret for signature verification!
console.log('Webhook secret:', secret);

// List delivery history
const { data: deliveries } = await veroai.webhooks.deliveries('wh_abc123');
```

### API Keys

```typescript
// Create an API key
const { apiKey, key } = await veroai.apiKeys.create({
  name: 'Production Key',
  environment: 'production',
  scopes: ['channels:read', 'messages:send'],
});

// Save the key securely - it won't be shown again!
console.log('API Key:', key);
```

### Domains

```typescript
// Add a domain
const { domain, verificationRecord } = await veroai.domains.create({
  domain: 'example.com',
  verificationMethod: 'manual',
});

// Verify domain
const result = await veroai.domains.verify('dom_abc123');
```

### AI Agents

```typescript
// List agents
const { agents } = await veroai.agents.list({ status: 'active' });

// Create an agent
const agent = await veroai.agents.create({
  displayName: 'Support Bot',
  roleId: 'customer-support',
  model: 'claude-sonnet-4-5-20250514',
  language: 'en',
});

// Get an agent
const agent = await veroai.agents.get('agent-uuid');

// Update an agent
const updated = await veroai.agents.update('agent-uuid', {
  displayName: 'Updated Bot',
  systemPrompt: 'You are a helpful assistant.',
});

// Delete an agent
await veroai.agents.delete('agent-uuid');

// Trigger an agent run
const { runId } = await veroai.agents.trigger('agent-uuid', {
  conversationId: 'conv-uuid',
  senderId: 'user-uuid',
  message: 'Hello!',
});

// Onboard a personal assistant (creates agent + conversation + tools)
const { agentId, conversationId } = await veroai.agents.onboard({
  ownerId: 'user-uuid',
  displayName: "Drew's Assistant",
});

// List available job roles
const { roles } = await veroai.agents.listRoles({ category: 'Special' });
```

#### Agent Workspace Files

Agents have workspace files (SOUL.md, IDENTITY.md, etc.) that define their behavior:

```typescript
// List workspace files
const { files } = await veroai.agents.listFiles('agent-uuid');

// Read a file
const { content } = await veroai.agents.getFile('agent-uuid', 'SOUL.md');

// Write a file
await veroai.agents.updateFile('agent-uuid', 'SOUL.md', '## Role\nYou are a helpful assistant.');

// Delete a file
await veroai.agents.deleteFile('agent-uuid', 'TOOLS.md');
```

#### Agent Runs (inspect / cancel / stream)

Runs are exposed under `veroai.agents.runs`. The `stream()` method returns an async iterator over SSE events.

```typescript
// List runs
const { runs } = await veroai.agents.runs.list({ agentId: 'agent-uuid', limit: 20 });

// Get a single run
const run = await veroai.agents.runs.get('run_abc123');

// Cancel a running run
await veroai.agents.runs.cancel('run_abc123');

// Stream events (token, tool_call, tool_result, message, status, done)
const controller = new AbortController();
for await (const ev of veroai.agents.runs.stream('run_abc123', { signal: controller.signal })) {
  if (ev.type === 'token') process.stdout.write(String(ev.data.text));
  if (ev.type === 'done') break;
}
```

### Brain (structured agent memory)

Semantic / episodic / graph / tasks / working scopes. Agents coordinate through writes + SSE subscriptions — no direct agent-to-agent messaging.

```typescript
// Write a memory entry
await veroai.brain.write({
  agentId: 'agent-uuid',
  scope: 'episodic',
  key: 'call:8291:transcript',
  value: { text: '...', language: 'he' },
  tags: ['call', 'hebrew'],
  ttl: 3600,
});

// Read by exact key (returns null on 404)
const entry = await veroai.brain.read({
  agentId: 'agent-uuid',
  scope: 'semantic',
  key: 'preferences:david',
});

// Hybrid search + token-budgeted context
const { entries, context } = await veroai.brain.query({
  agentId: 'agent-uuid',
  q: 'what does david prefer',
  budget: 2000,
});

// Delete an entry
await veroai.brain.delete('agent-uuid', 'episodic', 'call:8291:transcript');

// Subscribe to writes (telepathy primitive)
const controller = new AbortController();
for await (const ev of veroai.brain.subscribe({ agentId: 'agent-uuid', scope: 'episodic' }, { signal: controller.signal })) {
  console.log(ev.type, ev.entry.key);
}
```

### Sandcastle (Firecracker microVMs)

Isolated agent execution environments. ~125 ms cold boot, MMDS secret injection, MCP server on `:3000`, REST API on `:8080`.

```typescript
// Boot a VM
const vm = await veroai.sandcastle.create({
  image: 'dev-machine',
  agentId: 'researcher-01',
  secrets: { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY! },
  idleTtl: 300,
});
console.log(vm.mcpEndpoint, vm.apiEndpoint);

// List / get
const { vms } = await veroai.sandcastle.list({ status: 'running' });
const got = await veroai.sandcastle.get(vm.id);

// One-shot exec
const r = await veroai.sandcastle.exec(vm.id, { command: 'node -v' });
console.log(r.exitCode, r.stdout, r.stderr);

// Destroy
await veroai.sandcastle.destroy(vm.id);
```

### Teams

```typescript
// List all teams
const { teams } = await veroai.teams.list();

// Get a team
const team = await veroai.teams.get('team-uuid');
console.log(team.name, team.members);
```

### Voice

The voice resource provides sub-resources for phone numbers, calls, WebRTC rooms, SIP carriers, and Jambonz applications.

#### Phone Numbers

```typescript
// Search for available numbers
const numbers = await veroai.voice.numbers.search({
  country: 'US',
  areaCode: '415',
  capabilities: ['voice', 'sms'],
});

// Purchase a number
const number = await veroai.voice.numbers.purchase({
  didGroupId: 'dg_123',
  carrierId: 'carrier-uuid',
});

// Add an existing number
const number = await veroai.voice.numbers.add({
  number: '+15551234567',
  country: 'US',
  carrierId: 'carrier-uuid',
});

// List numbers
const { data: numbers } = await veroai.voice.numbers.list({
  status: 'active',
  country: 'US',
});

// Update a number
await veroai.voice.numbers.update('num-uuid', { channelId: 'ch_abc123' });

// Release a number
await veroai.voice.numbers.release('num-uuid');
```

#### Calls

```typescript
// Initiate an outbound call
const call = await veroai.voice.calls.dial({
  channelId: 'ch_abc123',
  to: '+15551234567',
  from: '+15559876543',
});

// List calls
const { data: calls } = await veroai.voice.calls.list({
  channelId: 'ch_abc123',
  direction: 'outbound',
  status: 'answered',
});

// Get a call
const call = await veroai.voice.calls.get('call-uuid');

// Hang up
await veroai.voice.calls.hangup('call-uuid');
```

#### WebRTC Rooms (LiveKit)

```typescript
// Create a room
const roomInfo = await veroai.voice.rooms.create({
  name: 'support-call-123',
  emptyTimeout: 300,
  maxParticipants: 2,
  agentConfigId: 'agent-uuid', // optional: attach agent to room
});
// roomInfo: { sid, name, wsUrl, token, numParticipants }

// Join a room
const roomInfo = await veroai.voice.rooms.join({
  roomName: 'support-call-123',
  participantName: 'Agent Smith',
  canPublish: true,
  canSubscribe: true,
});

// List rooms
const rooms = await veroai.voice.rooms.list();

// Get room details
const room = await veroai.voice.rooms.get('support-call-123');

// List participants
const participants = await veroai.voice.rooms.listParticipants('support-call-123');

// Mute/unmute a participant
await veroai.voice.rooms.muteParticipant('support-call-123', 'user-456', true);

// Send data to participants
await veroai.voice.rooms.sendData('support-call-123', { type: 'notification', message: 'Recording started' });

// Remove a participant
await veroai.voice.rooms.removeParticipant('support-call-123', 'user-456');

// Delete a room
await veroai.voice.rooms.delete('support-call-123');
```

#### SIP Carriers

```typescript
// Create a carrier
const carrier = await veroai.voice.carriers.create({
  name: 'My SIP Trunk',
  sipHost: 'sip.provider.com',
  sipPort: 5060,
  trunkType: 'both',
});

// List carriers
const { data: carriers } = await veroai.voice.carriers.list();

// List predefined carriers
const predefined = await veroai.voice.carriers.listPredefined();

// Update a carrier
await veroai.voice.carriers.update('carrier-uuid', { status: 'active' });

// Delete a carrier
await veroai.voice.carriers.delete('carrier-uuid');
```

#### Jambonz Applications

```typescript
// Create an application
const app = await veroai.voice.applications.create({
  name: 'My Voice App',
  callHookUrl: 'https://example.com/voice/hook',
});

// List applications
const apps = await veroai.voice.applications.list();

// Update an application
await veroai.voice.applications.update('app-sid', {
  callHookUrl: 'https://example.com/voice/hook-v2',
});

// Delete an application
await veroai.voice.applications.delete('app-sid');
```

#### Agent Voice Wiring

Wire an agent to a phone number for inbound calls. Auto-creates the voice channel + Jambonz application if needed.

```typescript
// List all agents with voice wiring status
const agents = await veroai.voice.agents.list();
// agents[0]: { id, name, enabled, voiceChannels, phoneNumbers, isVoiceWired }

// Wire an agent to a phone number
const result = await veroai.voice.agents.wire({
  agentId: 'agent-uuid',
  phoneNumberId: 'num-uuid',
  channelName: 'Support Line',
});

// Unwire
await veroai.voice.agents.unwire({ agentId: 'agent-uuid', phoneNumberId: 'num-uuid' });
```

#### Jambonz Provisioning

Per-tenant Jambonz account provisioning (idempotent).

```typescript
// Check status
const status = await veroai.voice.provisioning.getJambonzStatus();
// { provisioned, jambonzAccountSid, hasApiKey }

// Provision (no-op if already provisioned)
const { jambonzAccountSid } = await veroai.voice.provisioning.provisionJambonz();
```

### Attachments

```typescript
// Get attachment metadata
const attachment = await veroai.attachments.get('att-uuid');

// List attachments for an event
const { data, total } = await veroai.attachments.listByEvent('event-uuid');

// Generate a signed download URL
const { url, token, expiresIn } = await veroai.attachments.createDownloadToken('att-uuid', {
  expiresIn: 3600,
});

// Get download URL
const downloadUrl = veroai.attachments.getDownloadUrl('att-uuid', token);

// Delete an attachment
await veroai.attachments.delete('att-uuid');
```

### Messaging (Chat WebSocket Token)

```typescript
// Get a short-lived WebSocket token for chat messaging
const { token, wsUrl, expiresAt } = await veroai.messaging.getToken();
// Use with @veroai/chat or connect directly:
const ws = new WebSocket(`${wsUrl}?token=${token}`);
```

> Full chat client (React hooks, presence, typing indicators) lives in the separate **`@veroai/chat`** package. The `chat.ts` module inside this SDK is deprecated.

### End-user Authentication

Authenticate end-users of your customer-tenant apps (separate from your own VeroAI account members). Backed by `/v1/auth/users/*`.

```typescript
import { UsersResource } from '@veroai/sdk';

const result = await veroai.users.authenticate({
  email: 'jane@customer.example',
  password: 'hunter2',
});

if (UsersResource.isMfaChallenge(result)) {
  const session = await veroai.users.completeMfa({
    mfa_token: result.mfa_token,
    code: '123456',
  });
  // session.access_token, session.refresh_token
} else {
  // result is AuthSuccess
  console.log(result.access_token, result.user, result.tenant);
}

// Refresh + revoke
const fresh = await veroai.users.refresh(result.refresh_token);
await veroai.users.revoke(fresh.access_token);
```

### Federation (scoped end-user JWTs)

Mint scoped Vero end-user JWTs for *your* customers' end-users — see `authsrv/FEDERATED.md` for the full design. Two modes:

- **Mode A** — you sign a short-lived assertion JWT with a key whose public half is registered on the tenant, then exchange it via `federate({assertion})`.
- **Mode B** — you assert the end-user identity directly via M2M trust (`endUserToken({...})`).

Configure via the constructor:

```typescript
const veroai = new VeroAI({
  apiKey: 'sk_live_...',
  federation: {
    authsrvUrl: 'https://auth.veroagents.com',          // optional, this is the default
    oauthClient: { id: 'client_abc', secret: 'shhh' },  // required for mint/revoke
    adminToken: process.env.AUTHSRV_API_TOKEN,          // required for key registration
  },
});
```

#### Key registration (ops — requires `adminToken`)

```typescript
// Register a static PEM public key for a tenant
await veroai.federation.registerKey({
  tenantId: 'tid',
  kid: 'k1',
  alg: 'ES256',
  publicKey: pemPublicKey,
});

// Or register a JWKS URI
await veroai.federation.registerJwks({
  tenantId: 'tid',
  kid: 'k1',
  alg: 'ES256',
  jwksUri: 'https://idp.customer.com/.well-known/jwks.json',
  cacheTtlS: 300,
});

const { keys } = await veroai.federation.listKeys({ tenantId: 'tid' });
await veroai.federation.revokeKey({ tenantId: 'tid', kid: 'k1' });
```

#### Mint end-user tokens (customer M2M — requires `oauthClient`)

```typescript
// Mode B — direct M2M assertion
const tokenB = await veroai.federation.endUserToken({
  externalId: 'user-123',
  email: 'user@customer.com',
  scope: ['chat'],
  ttlSeconds: 3600,
});

// Mode A — exchange a signed assertion (see signAssertion below)
const tokenA = await veroai.federation.federate({
  assertion: signedJwt,
  scope: ['chat'],
});

// Smart entry point — picks Mode A if `assertion` is set, else Mode B
const token = await veroai.federation.mintEndUserToken({
  externalId: 'user-123',
  scope: ['chat'],
  assertion: signedJwt, // optional
});

// Revoke
await veroai.federation.revokeSession({ sessionId: token.sessionId });
await veroai.federation.revokeAllForUser({ externalId: 'user-123' });
```

#### `signAssertion()` — Mode A helper

Mints the short-lived ES256 JWT to feed into `federate({assertion})`. Uses the private key whose public half you registered via `registerKey`. Lifetime capped at 5 min (matches authsrv).

```typescript
import { signAssertion } from '@veroai/sdk';

const assertion = await signAssertion({
  tenantId: 'tid',
  externalId: 'user-123',
  kid: 'k1',
  privateKey: pkcs8PemString,
  email: 'user@customer.com',
  scope: ['chat'],
  ttlSeconds: 60, // default 60, min 30, max 300
});

const minted = await veroai.federation.federate({ assertion });
```

Errors: `SignAssertionError` (bad key / TTL), `FederationConfigError` (missing `oauthClient`/`adminToken`), `FederationApiError` (non-2xx from authsrv, exposes `.status` and `.code`).

### Real-time Events

Subscribe to real-time events via WebSocket:

```typescript
// Connect to the WebSocket server
await veroai.realtime.connect();

// Listen for events
veroai.realtime.onEvent((event) => {
  console.log('Received event:', event.canonicalType, event.payload);
});

// Listen for connection state changes
veroai.realtime.onStateChange((state) => {
  console.log('Connection state:', state);
});

// Handle errors
veroai.realtime.onError((error) => {
  console.error('WebSocket error:', error);
});

// Subscribe to all events
await veroai.realtime.subscribeAll();

// Or subscribe to specific channels
await veroai.realtime.subscribeChannels(['ch_abc123', 'ch_def456']);

// Or subscribe to specific event types
await veroai.realtime.subscribeEventTypes(['message.received', 'message.sent']);

// Unsubscribe when done
await veroai.realtime.unsubscribeChannels(['ch_abc123']);

// Disconnect
veroai.realtime.disconnect();
```

The realtime client automatically reconnects on connection loss and resubscribes to all active subscriptions.

#### Realtime Configuration

```typescript
const veroai = new VeroAI({
  apiKey: 'sk_live_...',
  realtime: {
    url: 'wss://events.veroagents.com/ws',  // Custom WebSocket URL
    autoReconnect: true,                      // Auto-reconnect on disconnect
    reconnectInterval: 1000,                  // Initial reconnect delay (ms)
    maxReconnectAttempts: 10,                 // Max reconnection attempts (0 = infinite)
    heartbeatInterval: 30000,                 // Heartbeat interval (ms)
  },
});
```

#### Node.js WebSocket Support

In Node.js, install the `ws` package for WebSocket support:

```bash
npm install ws
```

### Live State (Extensions + Queues)

The `live_state` subscription scope streams the canonical view of your
tenant's PBX state: every extension's presence + active call, and every
queue's waiting list + agent roster. It's designed for live dashboards
(agent panels, supervisor wallboards, real-time canvases).

The server sends one full snapshot frame on subscribe, then incremental
diff frames as state changes — the SDK exposes the snapshot as the
resolved value of `subscribeLiveState`, and diffs flow through a
separate handler.

**Authentication.** `live_state` uses the same authsrv-minted JWT as the
rest of realtime; the server enforces that the requested `tenant_id`
matches an allowed tenant in the token's claim set. A token mismatch
returns a `subscription_error` ack with `error: "tenant_not_authorized"`.

#### Basic flow

```typescript
import {
  applyExtDiff,
  applyQueueDiff,
  extensionsFromSnapshot,
  queuesFromSnapshot,
} from '@veroai/sdk';

await veroai.realtime.connect();

const snapshot = await veroai.realtime.subscribeLiveState(tenantId);
let extensions = extensionsFromSnapshot(snapshot.extensions);
let queues = queuesFromSnapshot(snapshot.queues);

const unregisterDiff = veroai.realtime.onLiveStateDiff((diff) => {
  if (diff.scope === 'ext') {
    extensions = applyExtDiff(extensions, diff);
  } else {
    queues = applyQueueDiff(queues, diff);
  }
  render(extensions, queues);
});

// Reconciliation snapshots (rare) overwrite the whole list:
const unregisterSnap = veroai.realtime.onLiveStateSnapshot((snap) => {
  extensions = extensionsFromSnapshot(snap.extensions);
  queues = queuesFromSnapshot(snap.queues);
  render(extensions, queues);
});

// Teardown — e.g. on component unmount:
unregisterDiff();
unregisterSnap();
await veroai.realtime.unsubscribeLiveState(tenantId);
```

#### React hook example

```tsx
import { useEffect, useState } from 'react';
import {
  applyExtDiff,
  applyQueueDiff,
  extensionsFromSnapshot,
  queuesFromSnapshot,
  type LiveStateExtensionUI,
  type LiveStateQueueUI,
  type LiveStateSnapshot,
  type ConnectionState,
} from '@veroai/sdk';

export function useLiveState(veroai: VeroAI, tenantId: string) {
  const [snapshot, setSnapshot] = useState<LiveStateSnapshot | null>(null);
  const [extensions, setExtensions] = useState<LiveStateExtensionUI[]>([]);
  const [queues, setQueues] = useState<LiveStateQueueUI[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    veroai.realtime.getState()
  );

  useEffect(() => {
    const offState = veroai.realtime.onStateChange(setConnectionState);
    const offSnap = veroai.realtime.onLiveStateSnapshot((s) => {
      setSnapshot(s);
      setExtensions(extensionsFromSnapshot(s.extensions));
      setQueues(queuesFromSnapshot(s.queues));
    });
    const offDiff = veroai.realtime.onLiveStateDiff((d) => {
      if (d.scope === 'ext') {
        setExtensions((prev) => applyExtDiff(prev, d));
      } else {
        setQueues((prev) => applyQueueDiff(prev, d));
      }
    });

    (async () => {
      await veroai.realtime.connect();
      await veroai.realtime.subscribeLiveState(tenantId);
    })();

    return () => {
      offState();
      offSnap();
      offDiff();
      veroai.realtime.unsubscribeLiveState(tenantId).catch(() => {});
    };
  }, [veroai, tenantId]);

  return { snapshot, extensions, queues, connectionState };
}
```

#### Wire shape reference

| Frame                  | Trigger                                            | Carries                                                                 |
| ---------------------- | -------------------------------------------------- | ----------------------------------------------------------------------- |
| `subscription_confirmed` | Server accepted subscribe/unsubscribe              | `{action, scope:"live_state", tenant_id}`                               |
| `subscription_error`   | Tenant not authorised or transient backend error   | `{action, scope:"live_state", tenant_id, error}`                        |
| `snapshot`             | Initial subscribe + any reconciliation re-emit     | `{tenant_id, ts_ms, extensions[], queues[]}` — full replacement         |
| `diff` (`scope:"ext"`)   | Statesrv republishes an extension HASH             | `{ext, status, direction?, peer?, call_id?, started_at_ms?, ...}`       |
| `diff` (`scope:"queue"`) | Queue waiting list or agent state changed          | `{queue_id, changes:{size?, oldest_wait_s?, waiting_added/removed, agents_changed}}` |

**Wire → UI presence:** `idle` → `available`, `ringing` → `ringing`,
`on_call` → `on_call`, anything else → `undefined` (consumer falls back
to its own presence model).

**Wire → UI direction:** `inbound` → `inbound`, `outbound` → `outbound`,
`internal` (and anything else) → `inbound`.

#### Reconnect semantics

`subscribeLiveState`/`unsubscribeLiveState` are tracked alongside the
existing channel/event_type sets. On reconnect, the SDK re-sends a
subscribe frame for every tracked tenant in parallel. Per-tenant
failures are surfaced through the existing `onError` handler — one
slow or denied tenant doesn't block the others.

## Error Handling

The SDK provides typed error classes for different scenarios:

```typescript
import {
  VeroAI,
  VeroAIError,
  APIError,
  AuthenticationError,
  AuthorizationError,
  RateLimitError,
  ValidationError,
  NotFoundError,
  ServerError,
  TimeoutError,
  NetworkError,
} from '@veroai/sdk';

try {
  await veroai.messages.send({ ... });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.log('Invalid API key');
  } else if (error instanceof AuthorizationError) {
    console.log('Insufficient permissions');
  } else if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof ValidationError) {
    console.log('Invalid request:', error.details);
  } else if (error instanceof NotFoundError) {
    console.log('Resource not found');
  } else if (error instanceof ServerError) {
    console.log('Server error:', error.statusCode);
  } else if (error instanceof TimeoutError) {
    console.log('Request timed out');
  } else if (error instanceof NetworkError) {
    console.log('Network connectivity issue');
  }
}
```

## TypeScript

The SDK is written in TypeScript and provides comprehensive type definitions:

```typescript
import type {
  // Channels
  Channel, AdapterType, ChannelDirection, ChannelStatus, ChannelHealth,
  // Messages
  SendMessageParams, SendMessageResult,
  // Events
  ActivityEvent, CanonicalType, EventDirection,
  // Webhooks
  Webhook, WebhookDelivery, WebhookStats,
  // API Keys
  ApiKey, ApiKeyEnvironment,
  // Domains
  Domain, DnsRecord,
  // Accounts
  Account, AccountMember, AccountTenant,
  CreateAccountTenantParams, AddAccountMemberParams, UpdateAccountMemberParams,
  // Agents
  Agent, CreateAgentParams, UpdateAgentParams, JobRole,
  // Agent Runs
  AgentRun, AgentRunEvent, AgentRunStatus, ListAgentRunsParams,
  // Brain
  BrainScope, BrainEntry, BrainEvent,
  BrainReadParams, BrainWriteParams, BrainQueryParams, BrainQueryResult, BrainSubscribeParams,
  // Sandcastle
  SandcastleVm, SandcastleImage, SandcastleStatus,
  CreateSandcastleParams, ListSandcastlesParams,
  SandcastleExecParams, SandcastleExecResult,
  // Teams
  Team, TeamMember,
  // Voice
  PhoneNumber, Call, VoiceCarrier, VoiceApplication,
  LiveKitRoomInfo, LiveKitRoom, LiveKitParticipant,
} from '@veroai/sdk';

import type {
  // Voice agent wiring + provisioning
  VoiceAgentStatus, VoiceAgentChannel, VoiceAgentNumber,
  WireAgentParams, WireAgentResult, UnwireAgentParams,
  JambonzProvisioningStatus, ProvisionJambonzResult,
  // Attachments
  Attachment,
  // Messaging
  MessagingToken,
  // End-user auth
  AuthenticateParams, CompleteMfaParams,
  AuthUser, AuthTenant, AuthSuccess, MfaChallenge, AuthenticateResult, TokenPair,
  // Federation (signer)
  SignAssertionParams,
  // Realtime
  RealtimeEvent, RealtimeConfig, ConnectionState,
} from '@veroai/sdk';
```

## Requirements

- Node.js >= 18 (or a fetch polyfill)
- TypeScript >= 5.0 (optional, for type definitions)
- `ws` package (optional, for WebSocket in Node.js)

## License

MIT
