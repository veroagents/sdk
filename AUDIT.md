# @veroai/sdk SandcastleResource ↔ Phase 1 BFF Audit

**Date:** 2026-05-18  
**SDK version:** 0.1.17  
**Auditor:** Claude Agent

---

## Executive Summary

The SDK's `SandcastleResource` is **stale design from an earlier era** intentionally diverged from the Phase 1 BFF. The BFF (`/v1/sandcastles` plural, tenant-scoped) and SDK (`/v1/sandcastle` singular) speak different shapes and serve different audiences: the BFF is first-party production (vero-admin), while the SDK appears to be a future hosted-SaaS public API for third-party developers. This requires explicit unification decision or formal documentation of the intentional split.

---

## Positioning Hypothesis

**SDK is positioned for future hosted-SaaS public API; BFF is first-party internal.**

- **BFF positioning** (from `/home/drew/projects/veroai/apps/vero-admin/src/services/sandcastles.ts:13-15`):
  > The `@veroai/sdk` SandcastleResource is NOT used here — it speaks the future hosted Sandcastle API (`/v1/sandcastle` singular, different shape). vero-admin is first-party and talks to the BFF directly.

- **SDK positioning**: Package.json lists it as "Official TypeScript/JavaScript SDK for VeroAI — Unified communications API." SDK client initialized with `apiKey: 'sk_live_...'` (API key auth), not cookie auth. This suggests third-party / external developer shape.

- **Conclusion**: Intentional split. BFF is the working Phase 1 surface; SDK codifies a future API contract for SaaS consumers that hasn't shipped.

---

## Resource Inventory

### SDK Methods (SandcastleResource)

| Method | URL (SDK) | HTTP | Purpose |
|--------|-----------|------|---------|
| `create(params)` | `/v1/sandcastle` | POST | Create + boot VM |
| `list(params?)` | `/v1/sandcastle` | GET | List VMs (status, agent_id filters) |
| `get(vmId)` | `/v1/sandcastle/{id}` | GET | Fetch VM metadata |
| `destroy(vmId)` | `/v1/sandcastle/{id}` | DELETE | Destroy VM |
| `exec(vmId, params)` | `/v1/sandcastle/{id}/exec` | POST | Run shell command |

### BFF Endpoints (routes/sandcastles.ts)

| Route | HTTP | Purpose | SDK Coverage |
|-------|------|---------|--------------|
| `POST /` | POST | Create sandcastle (row + VM) | **partial** (`create`) — SDK param mismatch |
| `GET /` | GET | List (joined w/ image) | **partial** (`list`) — no image join |
| `GET /:id` | GET | Get (w/ image) | **partial** (`get`) — no image |
| `PATCH /:id` | PATCH | Update name/resources | **NOT COVERED** |
| `DELETE /:id` | DELETE | Destroy | **yes** (`destroy`) |
| `POST /:id/start` | POST | Start VM | **NOT COVERED** |
| `POST /:id/stop` | POST | Stop VM | **NOT COVERED** |
| `POST /:id/restart` | POST | Restart VM | **NOT COVERED** |
| `POST /:id/wake` | POST | Resume sleeping VM | **NOT COVERED** |
| `POST /:id/sleep` | POST | Suspend running VM | **NOT COVERED** |
| `GET /:id/vm` | GET | Raw daemon VM state | **NOT COVERED** |

### Related BFF Endpoints (not in base sandcastles.ts)

- `/v1/sandcastles/:id/secrets/*` (list, create, delete) — **NOT COVERED**
- `/v1/sandcastles/:id/services/*` (CRUD, status callback) — **NOT COVERED**
- `/v1/sandcastles/:id/veroai-channels/*` (CRUD) — **NOT COVERED**
- `/v1/sandcastles/:id/browser/token` (LiveKit token) — **NOT COVERED**
- `/v1/sandcastles/:id/gateway/ws` (WS upgrade for agent) — **NOT COVERED**
- `/v1/sandcastles/:id/proxy/*` (HTTP proxy passthrough) — **NOT COVERED**
- `/v1/sandcastles/:id/images` (catalog) — **NOT COVERED**

---

## URL Shape Drift

### Singular vs Plural

| Side | Path | Note |
|------|------|------|
| **SDK** | `/v1/sandcastle` | Singular; listed as "future hosted" |
| **BFF** | `/v1/sandcastles` | Plural; current production |

- **Severity**: Critical — all endpoints diverge on path prefix.
- **Root cause**: SDK was written against an earlier spec; BFF adopts the Vero convention (plural resource names).

### Path Segments

- **SDK**: `/v1/sandcastle/{id}/exec` → BFF **not yet exposed** (not in Phase 1 surface).
- **BFF**: `/v1/sandcastles/{id}/start`, `/stop`, `/restart`, `/wake`, `/sleep`, `/vm` → SDK **missing entirely**.

---

## Type Drift

### Request/Response Shape Mismatch

#### SDK `CreateSandcastleParams` vs BFF POST body

| Field | SDK | BFF | Notes |
|-------|-----|-----|-------|
| `image` | ✓ string (image tag) | ✗ `image_id` (UUID ref) | **Breaking**. SDK expects `'base' | 'browserbase' | 'dev-machine'` (tags); BFF requires `image_id` (UUID). |
| `agentId` | ✓ optional | ✗ Not in create schema | SDK passes `agent_id`; BFF ignores it (not in POST schema). BFF accepts `name` instead. |
| `secrets` | ✓ optional object | ✗ Not in POST | SDK injects secrets at boot; BFF defers to `PUT /secrets`. **Architectural diff**. |
| `env` | ✓ optional object | ✗ Not in POST | SDK explicit env vars; BFF uses `model_config` + MMDS instead. |
| `vcpus` | ✓ optional | ✓ `cpu` | **Naming drift**: SDK `vcpus`, BFF `cpu`. |
| `memoryMb` | ✓ optional | ✓ `memory_mb` | Match (after camelCase→snake_case). |
| N/A | N/A | ✓ `disk_mb` | **SDK missing**. BFF supports disk allocation. |
| N/A | N/A | ✓ `model_config` | **SDK missing**. BFF stores agent model config (OpenAI params, etc.). |
| N/A | N/A | ✓ `s3_bucket`, `s3_endpoint` | **SDK missing**. BFF supports S3 mount for agent. |
| `idleTtl` | ✓ optional | ✗ Not in POST | SDK has per-VM idle TTL; BFF doesn't. |
| `maxLifetime` | ✓ optional | ✗ Not in POST | SDK has per-VM max lifetime; BFF doesn't. |

#### SDK `SandcastleVm` vs BFF `Sandcastle`

| Field | SDK | BFF | Notes |
|-------|-----|-----|-------|
| `id` | ✓ | ✓ | Match. |
| `status` | ✓ enum: `provisioning | booting | running | stopping | stopped | error` | ✓ enum: `created | starting | running | stopping | stopped | sleeping | waking | failed | destroyed` | **Breaking**. SDK has 6 states; BFF has 8. Daemon owns the actual state machine; SDK's enum is outdated. BFF is authoritative (from `/home/drew/projects/veroai/backend/api.veroai.dev/services/sandcastles-db.ts:198-207`). |
| `agentId` | ✓ `agent_id?` | ✓ `user_id` (stored), not exposed as `agent_id` | SDK expects agent ID; BFF tracks `user_id` (who created it), no agent link in Phase 1. |
| `mcpEndpoint` | ✓ (MCP server on :3000) | ✗ Not returned | **SDK phantom field**. BFF daemon doesn't expose this; SDK assumes it's embedded in VM state. Not in BFF schema. |
| `apiEndpoint` | ✓ (REST API on :8080) | ✗ Not returned | **SDK phantom field**. Same as above. |
| `ipAddress` | ✓ | ✓ `ip_address` | Match (case + underscore drift). |
| `vcpus` | ✓ | ✓ `cpu` | **Naming drift**. |
| `memoryMb` | ✓ | ✓ | Match. |
| `bootMs` | ✓ `boot_ms?` | ✗ Not returned | SDK caches boot time; BFF doesn't expose it (daemon owns it). |
| `createdAt` | ✓ | ✓ | Match. |
| `startedAt` | ✓ `started_at?` | ✓ `last_started_at?` | **Naming drift**: SDK `started_at`, BFF `last_started_at` (more accurate — may restart). |
| `stoppedAt` | ✓ `stopped_at?` | ✓ `last_stopped_at?` | **Naming drift**: SDK `stopped_at`, BFF `last_stopped_at`. |
| `idleTtl` | ✓ `idle_ttl?` | ✗ Not in schema | SDK supports it; BFF doesn't track. |
| `maxLifetime` | ✓ `max_lifetime?` | ✗ Not in schema | SDK supports it; BFF doesn't track. |
| N/A | N/A | ✓ `tenant_id` | **BFF key field**; SDK omitted (assumes single-tenant or embedded elsewhere). |
| N/A | N/A | ✓ `name` | **SDK missing**. BFF allows naming sandcastles. |
| N/A | N/A | ✓ `image_id` | **SDK missing**. BFF stores image UUID. |
| N/A | N/A | ✓ `disk_mb` | **SDK missing**. BFF tracks disk. |
| N/A | N/A | ✓ `vm_id` | **BFF stores daemon VM ID**; SDK assumes 1:1. |
| N/A | N/A | ✓ `gateway_token` (stripped from client) | **Sensitive field**; BFF correctly scrubs it before responding (line 44-49 in sandcastles.ts). SDK type has no mention of this field. |
| N/A | N/A | ✓ `model_config`, `s3_bucket`, `s3_endpoint` | **SDK missing**. BFF stores agent config. |
| N/A | N/A | ✓ `total_uptime_seconds` | **SDK missing**. BFF accumulates (deferred in Phase 1). |

### Status Enum Mismatch

**SDK** (from `src/types/index.ts:1237-1243`):
```typescript
type SandcastleStatus =
  | 'provisioning'
  | 'booting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'error';
```

**BFF** (from `services/sandcastles-db.ts:198-207`):
```typescript
type SandcastleStatus =
  | 'created'
  | 'starting'
  | 'running'
  | 'stopping'
  | 'stopped'
  | 'sleeping'
  | 'waking'
  | 'failed'
  | 'destroyed';
```

**vero-admin** (from `apps/vero-admin/src/types/sandcastle.ts:12-22`) mirrors BFF exactly (with open-ended union).

**Verdict**: SDK's enum is **outdated**. Missing `created`, `starting`, `sleeping`, `waking`, `failed`, `destroyed`. Has phantom `provisioning`, `booting`. Breaks exhaustive pattern matching.

---

## Coverage Gaps

### BFF Endpoints with NO SDK Method

| Endpoint | Purpose | Phase 1 Required |
|----------|---------|-----------------|
| `PATCH /:id` | Update name/resources while stopped | ✓ (vero-admin uses it) |
| `POST /:id/start` | Start VM | ✓ (core lifecycle) |
| `POST /:id/stop` | Stop VM | ✓ (core lifecycle) |
| `POST /:id/restart` | Restart VM | ✓ (core lifecycle) |
| `POST /:id/wake` | Resume from sleep | ✓ (efficiency feature) |
| `POST /:id/sleep` | Suspend to save resources | ✓ (efficiency feature) |
| `GET /:id/vm` | Raw daemon state | ✓ (observability) |
| `GET /:id/secrets` | List secret names | ✓ (Phase 1 secrets) |
| `PUT /:id/secrets` | Create/update secrets | ✓ (Phase 1 secrets) |
| `DELETE /:id/secrets/:name` | Delete one secret | ✓ (Phase 1 secrets) |
| `GET /images` | List image catalog | ✓ (required for create) |
| `GET /:id/services/*` | Service VM CRUD | ✓ (Phase 1 services) |
| `POST /:id/veroai-channels/*` | VeroAI channel bindings | ✓ (Phase 1 messaging) |
| `GET /:id/browser/token` | LiveKit token for stealth browser | ✓ (Phase 1 browser) |

**Total** = 15 BFF routes not in SDK.

### SDK Methods with NO BFF Endpoint

| SDK Method | URL | Status |
|------------|-----|--------|
| `exec(vmId, params)` | `POST /v1/sandcastle/{id}/exec` | Not exposed in BFF routes. Daemon capability exists; not routed to SDK consumers yet. |

**Interpretation**: SDK's `exec` is a forward-looking feature (direct shell access to VM). BFF defers this to Phase 2+ (comment in `/home/drew/projects/veroai/backend/api.veroai.dev/routes/sandcastles.ts:3` notes "Port of the standalone sandcastles worker's surface"; source worker likely had exec). Not a BFF regression, just not ported.

---

## Realtime / Streaming

**SDK**: Has `src/realtime/` directory (RealtimeResource, WebSocket subscriptions). Unrelated to Sandcastle; generic event streaming for VeroAI platform (channels, messages, agents).

**BFF Sandcastle streaming**:
- `GET /v1/sandcastles/:id/gateway/ws` — **WebSocket upgrade** for in-VM agent to call back to worker. Not a client-facing subscription; internal VM↔worker comms.
- `GET /v1/sandcastles/:id/browser/ws` — **WebSocket upgrade** for stealth-browser LiveKit calls. Same — not exposed to SDK consumer.

**Verdict**: No realtime streaming surface for sandcastles in Phase 1 BFF. SDK's realtime is platform-level, not sandcastle-specific.

---

## Auth Model

### SDK

- **Auth**: API key (Bearer token) — `apiKey: 'sk_live_...'` in config.
- **Pattern**: Initialized with `new VeroAI({ apiKey })`, then per-resource methods call `this.http.post(...)` which wraps the Bearer header.
- **Assumption**: Third-party / SaaS consumer; no tenant awareness baked into the SDK constructor (though `forTenant(tenantId)` method exists for account-scoped keys).

### BFF

- **Auth**: Two flows:
  1. **User sessions** (combinedAuthMiddleware): Cookie + CSRF header. Session resolves `tenant_id` + `user_id` via authsrv + session middleware.
  2. **Service-to-service** (INTERNAL_TOKEN): Bearer token + `X-Tenant-ID` / `X-User-ID` headers. See sandcastles.ts:8-9.
- **Tenant isolation**: Every query is scoped to `c.get('tenant_id')` (from tenantMiddleware). No cross-tenant leakage.
- **RFC 8693 token-exchange**: Not mentioned in routes; assumed to happen upstream in authsrv.

**Verdict**: Auth models are **incompatible by design**. BFF assumes first-party cookie session (vero-admin); SDK assumes API key. Token-exchange (if needed for the public API) hasn't shipped.

---

## Security Findings

### 1. gateway_token Exposure (FIXED in BFF)

**BFF** (routes/sandcastles.ts:41-49):
```typescript
function stripGatewayToken<T extends { gateway_token?: unknown }>(row: T): Omit<T, 'gateway_token'> {
  const { gateway_token: _omit, ...rest } = row;
  return rest;
}
```

- Gateway token (in-VM agent's Bearer for callback) is **always stripped** before returning to client.
- Correctly implemented for all response paths (POST, GET, PATCH, etc.).

**SDK**:
- Type definition (`SandcastleVm`) does NOT include `gateway_token` field. ✓
- Assumption: SDK expects it's never returned; if the SDK were to hit the BFF endpoints, the field would be absent (safe).

**Verdict**: ✓ No risk. BFF scrubs it; SDK type has no slot for it.

### 2. Secrets Values Never Returned

**BFF** (routes/sandcastles-secrets.ts):
- `GET /:id/secrets` returns **names only**, not values (see lines 8-9: "list names (never values)").
- Values are stored encrypted in KV namespace; decryption happens server-side at boot (buildVMSecrets).

**SDK**:
- No secrets routes implemented. If a third-party SDK consumer needs secrets, they must use a separate auth flow (not yet defined).

**Verdict**: ✓ Deferred concern. Phase 1 BFF correctly doesn't leak values.

### 3. Auth Token Injection (model_config / MMDS)

**BFF** (routes/sandcastles.ts:382-410):
- `POST /:id/start` decrypts user secrets from KV, merges with system injected env (GATEWAY_TOKEN, OpenClaw token, model_config, browser creds), passes to daemon.
- System-injected fields (gateway_token) are never persisted on the row; they're computed at boot time.

**SDK**:
- `create()` method accepts `secrets` param (top-level). Assumption: secrets are injected at create time, not fetched from persistent KV.
- No `start()` method → no way to inject secrets on an existing VM.

**Verdict**: Different architecture. SDK assumes secrets at create; BFF defers to separate `PUT /secrets` + `POST /start` sequence. Security posture is equivalent (both keep values out of DB), but sequencing differs.

---

## Recommendations

### 1. **Formally Document Dual API Path** (HIGH)
   - Create a `docs/SDK_ROADMAP.md` or `README.md` section in `packages/sdk/` clarifying:
     - Phase 1 BFF is for first-party apps (vero-admin). Do not use SDK.
     - SDK is the future public API for third-party developers. Scheduled for Phase 2+.
     - Both shapes will coexist until SDK v1.0.
   - **Action**: Add comment block to `src/resources/sandcastle.ts` linking to roadmap.

### 2. **Unify or Archive SDK Resource** (BLOCKING for public SDK v1.0)
   - **Option A**: Archive this resource for now. Sandcastles are not yet public. Remove from `src/index.ts` exports until the hosted API ships.
   - **Option B**: Align SDK to current BFF shape now (breaking change for SDK consumers). Requires:
     - Change `/v1/sandcastle` → `/v1/sandcastles` (or add BFF alias route).
     - Change `image` param → `image_id` + separate catalog fetch.
     - Add lifecycle methods: `start()`, `stop()`, `restart()`, `wake()`, `sleep()`, `getVm()`.
     - Add secrets methods: `listSecrets()`, `putSecret()`, `deleteSecret()`.
     - Update status enum to match BFF.
     - Drop `mcpEndpoint`, `apiEndpoint`, `bootMs` (not returned by BFF).
     - Handle image join in `get()` / `list()` responses.
   - **Option C**: Keep SDK as-is; define it as a **private/internal SDK** for agent←→worker comms (not consumer-facing). Change scope in package.json.

### 3. **Status Enum Reconciliation** (MEDIUM)
   - SDK status enum has 6 states; BFF has 8. Daemon owns state machine.
   - **Action**: Update SDK type to match BFF + add `(string & {})` union for forward compatibility (as vero-admin does).
   - File: `packages/sdk/src/types/index.ts:1237-1243`.

### 4. **Add Image Catalog to SDK** (MEDIUM)
   - BFF exposes `GET /v1/sandcastles/images` (implicit in routes/sandcastles.ts; handled by parent router).
   - SDK should include `listImages()` method if `create()` requires `image_id`.
   - File: Add to `SandcastleResource`.

### 5. **Document Intentional Differences** (LOW)
   - Add code comment in `src/resources/sandcastle.ts` (line 3-5) clarifying that this shapes the SaaS API, not the internal BFF.
   - Example:
     ```typescript
     /**
      * Sandcastle Resource
      *
      * ATTENTION: This resource codifies the future hosted SaaS API shape.
      * It is NOT aligned with the current Phase 1 BFF (/v1/sandcastles).
      * Vero-admin and first-party apps should call the BFF directly.
      *
      * See AUDIT.md for drift analysis.
      */
     ```

### 6. **Exec Route Status** (LOW)
   - SDK has `exec()` method; BFF doesn't expose it yet.
   - **Action**: Clarify in AUDIT.md or README: exec is planned for Phase 2. Consumers should use direct WebSocket to VM endpoint for now (see BFF docs).

---

## Summary Table

| Aspect | Verdict | Impact |
|--------|---------|--------|
| **Positioning** | Intentional split (public SaaS vs first-party) | High — requires unification decision |
| **URL shape** | Singular vs plural + missing routes | Critical — incompatible |
| **Auth** | API key vs cookie session | Critical — different auth flow |
| **Types** | Status enum, field names, missing fields | High — breaking at runtime |
| **Coverage** | 15 BFF routes not in SDK | High — SDK incomplete for Phase 1 |
| **Realtime** | No sandcastle streaming (separate concern) | Low — not required Phase 1 |
| **Security** | gateway_token correctly scrubbed, secrets safe | Low — no active risk |
| **Recommendation** | Archive or align SDK before public v1.0 | Blocking decision |

