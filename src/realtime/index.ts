export { RealtimeResource, createRealtimeResource } from './realtime';
export type {
  ConnectionState,
  EventHandler,
  StateChangeHandler,
  ErrorHandler,
  RealtimeConfig,
  RealtimeEvent,
  SubscribeOptions,
  SubscriptionType,
  SubscriptionCommand,
  SubscriptionConfirmation,
  TokenFetcher,
} from './types';

// Live state — wire types + handlers
export type {
  LiveStateExtensionStatus,
  LiveStateExtensionDirection,
  LiveStateExtension,
  LiveStateAgentState,
  LiveStateAgent,
  LiveStateAgentCounts,
  LiveStateWaiting,
  LiveStateQueue,
  LiveStateSnapshot,
  LiveStateExtDiff,
  LiveStateQueueChanges,
  LiveStateQueueDiff,
  LiveStateDiff,
  LiveStateSubscriptionAck,
  LiveStateSubscriptionCommand,
  LiveStateSnapshotHandler,
  LiveStateDiffHandler,
} from './live-state-types';

// Live state — UI mapping helpers
export {
  presenceFromStatus,
  directionToUI,
  toUIExtension,
  toUIQueue,
  applyExtDiff,
  applyQueueDiff,
  extensionsFromSnapshot,
  queuesFromSnapshot,
} from './mapping';
export type {
  LiveStateUIPresence,
  LiveStateUIDirection,
  LiveStateExtensionUI,
  LiveStateAgentUI,
  LiveStateWaitingUI,
  LiveStateQueueUI,
} from './mapping';
