/**
 * Typed client for the FastAPI data API's `hitl` router.
 *
 * Quote-desk tasks enqueue and settle `workflow_items` through this client —
 * NOT the Next.js inbound webhook (see api/db/models.py header and
 * api/routers/hitl.py). Field names are snake_case to match the FastAPI
 * Pydantic models on the wire (api/models/schemas.py).
 *
 * Base URL comes from `DATA_API_BASE_URL`; if the API requires an auth header,
 * set `DATA_API_TOKEN` (sent as `Authorization: Bearer …`).
 */

// ---------------------------------------------------------------------------
// Wire shapes — mirror api/models/schemas.py
// ---------------------------------------------------------------------------

/** POST /workflow-items body (mirrors WorkflowItemCreate). */
export interface WorkflowItemCreate {
  id: string;
  workflow_id: string;
  summary: string;
  fields?: Record<string, unknown>;
  source_content?: string | null;
  proposed_output?: string | null;
  context?: Array<Record<string, unknown>>;
  actions?: Array<Record<string, unknown>> | null;
  priority?: string;
  status?: string;
  /** ISO-8601 timestamp; omit to let the API default to now(). */
  created_at?: string | null;
}

/** PATCH /workflow-items/{id} body (mirrors WorkflowItemUpdate). */
export interface WorkflowItemUpdate {
  status?: string;
  proposed_output?: string;
  fields?: Record<string, unknown>;
  context?: Array<Record<string, unknown>>;
  priority?: string;
}

/** POST /rate-insights/estimate body (mirrors RateInsightsRequest). */
export interface RateInsightsRequest {
  origin_city: string;
  origin_state_code: string;
  destination_city: string;
  destination_state_code: string;
  equipment_code: string;
  origin_zip_code?: string | null;
  destination_zip_code?: string | null;
  /** Pickup date as YYYY-MM-DD, or null. */
  pickup_date?: string | null;
}

/** Rate estimate response (mirrors RateInsightsEstimateOut). */
export interface RateInsightsEstimate {
  origin_city: string;
  origin_state_code: string;
  destination_city: string;
  destination_state_code: string;
  equipment_code: string;
  pickup_date: string | null;
  mileage: number | null;
  low_rate_per_mile: number | null;
  avg_rate_per_mile: number | null;
  high_rate_per_mile: number | null;
  fuel_surcharge_per_mile: number | null;
  total_low: number | null;
  total_avg: number | null;
  total_high: number | null;
  rate_source: string;
  /** lane_snapshots | lane_aggregate | loose_snapshots | none */
  match_tier: string;
  comparable_count: number;
  /** 0–1 confidence the band is reliable. */
  confidence_score: number;
  /** high | medium | low | none */
  confidence_level: string;
  as_of: string | null;
}

/** Workflow item response (mirrors WorkflowItemOut). */
export interface WorkflowItemOut {
  id: string;
  workflow_id: string;
  status: string;
  priority: string;
  summary: string;
  fields: Record<string, unknown>;
  source_content: string | null;
  proposed_output: string | null;
  context: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>> | null;
  decided_at: string | null;
  decided_by: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export class DataApiError extends Error {
  constructor(
    readonly status: number,
    readonly method: string,
    readonly path: string,
    readonly body: string,
  ) {
    super(`Data API ${method} ${path} failed: ${status} ${body}`);
    this.name = "DataApiError";
  }
}

export interface DataApiClientOptions {
  /** Base URL of the FastAPI service. Defaults to `DATA_API_BASE_URL`. */
  baseUrl?: string;
  /** Bearer token. Defaults to `DATA_API_TOKEN` (optional). */
  token?: string;
  /** Override fetch (for tests). Defaults to global `fetch`. */
  fetch?: typeof fetch;
}

export class DataApiClient {
  private readonly baseUrl: string;
  private readonly token?: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: DataApiClientOptions = {}) {
    const baseUrl = options.baseUrl ?? process.env.DATA_API_BASE_URL;
    if (!baseUrl) {
      throw new Error(
        "DATA_API_BASE_URL is not set — required to reach the FastAPI data API.",
      );
    }
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.token = options.token ?? process.env.DATA_API_TOKEN;
    this.fetchImpl = options.fetch ?? fetch;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (this.token) headers["Authorization"] = `Bearer ${this.token}`;

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!res.ok) {
      throw new DataApiError(res.status, method, path, await res.text());
    }
    return (await res.json()) as T;
  }

  /**
   * Enqueue a draft item for HITL review. Idempotent on `id` — the API returns
   * the existing row unchanged on retry (trigger.dev at-least-once delivery).
   */
  createItem(item: WorkflowItemCreate): Promise<WorkflowItemOut> {
    return this.request<WorkflowItemOut>("POST", "/workflow-items", item);
  }

  /** Partial update — settle status, revise the draft, append context, etc. */
  updateItem(itemId: string, patch: WorkflowItemUpdate): Promise<WorkflowItemOut> {
    return this.request<WorkflowItemOut>(
      "PATCH",
      `/workflow-items/${encodeURIComponent(itemId)}`,
      patch,
    );
  }

  /** Fetch a single workflow item by id. */
  getItem(itemId: string): Promise<WorkflowItemOut> {
    return this.request<WorkflowItemOut>(
      "GET",
      `/workflow-items/${encodeURIComponent(itemId)}`,
    );
  }

  /**
   * Rate band for an origin→destination lane from the mock Truckstop
   * RateInsights endpoint (feat-016). Pass `persist` to record the lookup as a
   * `truckstop` rate_snapshot (only persisted when a matching lane is found).
   */
  estimateRate(body: RateInsightsRequest, persist = false): Promise<RateInsightsEstimate> {
    const query = persist ? "?persist=true" : "";
    return this.request<RateInsightsEstimate>("POST", `/rate-insights/estimate${query}`, body);
  }

  /** List items for a workflow, optionally filtered by status. */
  listItems(workflowId: string, status?: string): Promise<WorkflowItemOut[]> {
    const query = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.request<WorkflowItemOut[]>(
      "GET",
      `/workflows/${encodeURIComponent(workflowId)}/items${query}`,
    );
  }
}

let shared: DataApiClient | undefined;

/** Lazily-built shared client from environment variables. */
export function getDataApi(): DataApiClient {
  if (!shared) shared = new DataApiClient();
  return shared;
}
