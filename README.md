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
  baseUrl: 'https://api.staging.veroai.dev',
  timeout: 60000,
  maxRetries: 5,
});

// From environment variables (reads VEROAI_API_KEY)
const veroai = VeroAI.fromEnv();
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
    url: 'wss://realtime.veroai.dev/ws',  // Custom WebSocket URL
    autoReconnect: true,                   // Auto-reconnect on disconnect
    reconnectInterval: 1000,               // Initial reconnect delay (ms)
    maxReconnectAttempts: 10,              // Max reconnection attempts (0 = infinite)
    heartbeatInterval: 30000,              // Heartbeat interval (ms)
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
  AuthenticationError,
  RateLimitError,
  ValidationError,
  NotFoundError,
} from '@veroai/sdk';

try {
  await veroai.messages.send({ ... });
} catch (error) {
  if (error instanceof AuthenticationError) {
    console.log('Invalid API key');
  } else if (error instanceof RateLimitError) {
    console.log(`Rate limited. Retry after ${error.retryAfter}s`);
  } else if (error instanceof ValidationError) {
    console.log('Invalid request:', error.details);
  } else if (error instanceof NotFoundError) {
    console.log('Resource not found');
  }
}
```

## TypeScript

The SDK is written in TypeScript and provides comprehensive type definitions:

```typescript
import type {
  Channel,
  ActivityEvent,
  Webhook,
  SendMessageParams,
} from '@veroai/sdk';

const params: SendMessageParams = {
  channelId: 'ch_abc123',
  to: '+15551234567',
  content: { type: 'text', text: 'Hello!' }
};
```

## Requirements

- Node.js >= 18 (or a fetch polyfill)
- TypeScript >= 5.0 (optional, for type definitions)

## License

MIT
