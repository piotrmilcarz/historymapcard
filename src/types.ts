/* ------------------------------------------------------------------
 * Shared type definitions for history-map-card
 * ------------------------------------------------------------------ */

export interface HassEntity {
  entity_id: string;
  state: string;
  attributes: {
    latitude?: number;
    longitude?: number;
    gps_accuracy?: number;
    friendly_name?: string;
    icon?: string;
    source?: string;
    [key: string]: unknown;
  };
}

export interface HomeAssistant {
  states: Record<string, HassEntity>;
  callApi: <T>(
    method: 'GET' | 'POST',
    path: string,
    parameters?: Record<string, unknown>
  ) => Promise<T>;
}

export interface EntityConfig {
  entity: string;
  name?: string;
  color?: string;
}

export interface HistoryMapCardConfig {
  type: string;
  entities: Array<EntityConfig | string>;
  hours_to_show?: number;
  default_zoom?: number;
  dark_mode?: boolean;
  theme_mode?: 'auto' | 'light' | 'dark';
  title?: string;
}

export interface HistoryState {
  entity_id?: string;
  state: string;
  attributes?: {
    latitude?: number;
    longitude?: number;
    friendly_name?: string;
    [key: string]: unknown;
  };
  last_changed: string;
  last_updated?: string;
}

export interface TimelinePoint {
  timestamp: number;
  entityId: string;
  lat: number;
  lng: number;
}
