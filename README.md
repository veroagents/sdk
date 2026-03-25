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
- **AI agents** with workspace files, triggers, and team management
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
  // Agents
  Agent, CreateAgentParams, UpdateAgentParams, JobRole,
  // Teams
  Team, TeamMember,
  // Voice
  PhoneNumber, Call, VoiceCarrier, VoiceApplication,
  LiveKitRoomInfo, LiveKitRoom, LiveKitParticipant,
  // Attachments
  Attachment,
  // Messaging
  MessagingToken,
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
