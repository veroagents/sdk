/**
 * Events Resource
 */

import type { HttpClient } from '../utils/http';
import type {
  ActivityEvent,
  ListEventsParams,
  EventStats,
  TimeSeriesDataPoint,
  TimeSeriesGranularity,
  PaginatedResponse,
} from '../types';

interface ApiActivityEvent {
  event_id: string;
  tenant_id: string;
  channel_id: string;
  event_type: string;
  canonical_type: string;
  direction: string;
  adapter_type: string;
  occurred_at: string;
  ingested_at: string;
  payload: Record<string, unknown>;
}

interface ListEventsApiResponse {
  events: ApiActivityEvent[];
  total: number;
  next_offset?: number;
}

interface EventStatsApiResponse {
  total_events: number;
  events_by_type: Record<string, number>;
  events_by_channel: Record<string, number>;
}

interface TimeSeriesApiResponse {
  data: Array<{ timestamp: string; value: number }>;
  granularity: string;
  period_days: number;
}

function transformEvent(data: ApiActivityEvent): ActivityEvent {
  return {
    eventId: data.event_id,
    tenantId: data.tenant_id,
    channelId: data.channel_id,
    eventType: data.event_type,
    canonicalType: data.canonical_type as ActivityEvent['canonicalType'],
    direction: data.direction as ActivityEvent['direction'],
    adapterType: data.adapter_type,
    occurredAt: data.occurred_at,
    ingestedAt: data.ingested_at,
    payload: data.payload,
  };
}

export class EventsResource {
  constructor(private readonly http: HttpClient) {}

  /**
   * List activity events with optional filters
   */
  async list(params: ListEventsParams = {}): Promise<PaginatedResponse<ActivityEvent>> {
    const query: Record<string, string | number | undefined> = {
      limit: params.limit,
      offset: params.offset,
      channel_id: params.channelId,
      event_type: params.eventType,
      canonical_type: params.canonicalType,
      direction: params.direction,
    };

    if (params.startDate) {
      query.start_date = params.startDate instanceof Date
        ? params.startDate.toISOString()
        : params.startDate;
    }

    if (params.endDate) {
      query.end_date = params.endDate instanceof Date
        ? params.endDate.toISOString()
        : params.endDate;
    }

    const response = await this.http.get<ListEventsApiResponse>('/v1/events', query);

    return {
      data: response.events.map(transformEvent),
      total: response.total,
      hasMore: response.next_offset !== undefined,
      nextOffset: response.next_offset,
    };
  }

  /**
   * Get a single event by ID
   */
  async get(eventId: string): Promise<ActivityEvent> {
    const response = await this.http.get<ApiActivityEvent>(`/v1/events/${eventId}`);
    return transformEvent(response);
  }

  /**
   * Get event statistics summary
   */
  async stats(options: { days?: number } = {}): Promise<EventStats> {
    const response = await this.http.get<EventStatsApiResponse>('/v1/events/stats/summary', {
      days: options.days || 7,
    });

    return {
      totalEvents: response.total_events,
      eventsByType: response.events_by_type,
      eventsByChannel: response.events_by_channel,
    };
  }

  /**
   * Get time series data for charts
   */
  async timeseries(options: {
    days?: number;
    granularity?: TimeSeriesGranularity;
  } = {}): Promise<TimeSeriesDataPoint[]> {
    const response = await this.http.get<TimeSeriesApiResponse>('/v1/events/stats/timeseries', {
      days: options.days || 7,
      granularity: options.granularity || 'hour',
    });

    return response.data;
  }
}
