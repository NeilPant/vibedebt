export type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type ObservationField =
  | { kind: 'text' | 'value' | 'visible'; selector: string }
  | { kind: 'url' }
  | { kind: 'storage'; key: string };
export type BrowserStep =
  | { kind: 'navigate'; path: string }
  | { kind: 'reload' }
  | { kind: 'fill'; selector: string; value: string }
  | { kind: 'click'; selector: string }
  | { kind: 'waitFor'; selector: string; state?: 'attached' | 'detached' | 'visible' | 'hidden' }
  | { kind: 'waitForRequest'; fixture: string; count?: number }
  | { kind: 'checkpoint'; id: string; fields: ObservationField[] };
export interface ApiFixture {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string | null>;
  body?: JsonValue;
  response: { status: number; json: JsonValue };
  min?: number;
  max?: number;
}
export interface BrowserJourney {
  id: string;
  storage?: Record<string, string>;
  fixtures: ApiFixture[];
  steps: BrowserStep[];
}
export interface BrowserPlan {
  version: 1;
  logicalId: string;
  revision: string;
  clock: string;
  apiOrigins: string[];
  externalAssets?: { url: string; contentType: string; body: string }[];
  journeyTimeoutMs?: number;
  suiteTimeoutMs?: number;
  journeys: BrowserJourney[];
}
export interface JourneyObservation {
  id: string;
  checkpoints: { id: string; values: JsonValue[] }[];
  requests: { fixture: string; method: string; url: string; headers: Record<string, string | null>; body: JsonValue }[];
}
export interface AnchorBundle {
  readonly version: 1;
  readonly logicalId: string;
  readonly revision: string;
  readonly configHash: string;
  readonly observations: JourneyObservation[];
  readonly hash: string;
}
export interface BrowserVerification {
  success: boolean;
  passed: number;
  failed: number;
  failures: string[];
}
/** Runtime state is deliberately excluded from the serializable plan and its hash. */
export interface BrowserRunOptions { signal?: AbortSignal }
