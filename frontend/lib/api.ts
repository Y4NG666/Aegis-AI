export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export type GuardianState = {
  active: boolean;
  last_risk_score: number;
  last_updated: number;
  latest_summary: string;
};

export type RiskControllerParameters = {
  max_position_bps: number;
  liquidation_threshold_bps: number;
  rebalance_threshold_bps: number;
};

export type ReactiveGuardianStatus = {
  pair_address: string;
  source_chain_id: number;
  threshold_bps: number;
  baseline_initialized: boolean;
  last_observed_reserves: {
    reserve0: number;
    reserve1: number;
  };
};

export type MonitorEventRecord = {
  observed_at: string;
  block_number: number;
  transaction_hash: string;
  subject_address: string;
  event_args: Record<string, unknown>;
  transaction_data: Record<string, unknown>;
  liquidity_changes: Record<string, unknown>;
  on_chain_data: Record<string, unknown>;
  anomaly: {
    risk_score: number;
    feature_scores: Record<string, number>;
    reasons: string[];
  };
  decision: {
    action: string;
    confidence: number;
    reasons: string[];
  };
  executions: Record<string, string>;
};

export type DemoFlowLog = {
  label: string;
  value: string;
};

export type SystemState = {
  status: string;
  backend: {
    web3_connected: boolean;
    deployment_file: string | null;
    monitor_error: string | null;
  };
  deployment: {
    network: string | null;
    chain_id: number | null;
    guardian_contract_address: string;
    risk_controller_address: string;
    monitor_contract_address: string;
    demo_pair_address: string | null;
  };
  contracts: {
    guardian: {
      ready: boolean;
      subject_address: string;
      state: GuardianState | null;
      error: string | null;
    };
    risk_controller: {
      ready: boolean;
      paused: boolean;
      parameters: RiskControllerParameters | null;
    };
    reactive_guardian: {
      ready: boolean;
      status: ReactiveGuardianStatus | null;
      error?: string;
    };
  };
  monitor: {
    configured: boolean;
    running: boolean;
    web3_connected?: boolean;
    guardian_ready?: boolean;
    risk_controller_ready?: boolean;
    next_block?: number | null;
    processed_events?: number;
    error?: string | null;
    last_error?: string | null;
    recent_events: MonitorEventRecord[];
  };
  ai: {
    latest_risk_score: number | null;
    latest_result: {
      observed_at: string;
      subject_address: string;
      transaction_data: Record<string, unknown>;
      liquidity_changes: Record<string, unknown>;
      on_chain_data: Record<string, unknown>;
      anomaly: MonitorEventRecord["anomaly"];
      decision: MonitorEventRecord["decision"];
      executions: Record<string, unknown>;
    } | null;
  };
  latest_event: MonitorEventRecord | null;
};

export type DemoTriggerResponse = {
  status: string;
  pair_address: string;
  baseline_transaction_hash: string | null;
  abnormal_transaction_hash: string;
  event_detected: boolean;
  event_transaction_hash: string | null;
  risk_score: number | null;
  decision: string | null;
  execution_transaction_hash: string | null;
  executions: Record<string, string>;
  logs: DemoFlowLog[];
  latest_event: MonitorEventRecord | null;
  system_state: SystemState;
  monitor_running: boolean;
};

export type AnalyzePayload = {
  subject_address?: string;
  wallet_address?: string;
  pair_address?: string;
  transaction_data: Record<string, unknown>;
  liquidity_changes?: Record<string, unknown>;
  on_chain_data?: Record<string, unknown>;
  record_onchain?: boolean;
  execute_onchain?: boolean;
};

export type AnalyzeResponse = {
  subject_address: string;
  anomaly: {
    risk_score: number;
    feature_scores: Record<string, number>;
    reasons: string[];
  };
  decision: {
    action: string;
    confidence: number;
    reasons: string[];
  };
  on_chain_data: Record<string, unknown>;
  execution_ready: {
    guardian: boolean;
    risk_controller: boolean;
  };
  executions: Record<string, string>;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${BACKEND_URL}${path}`;
  const method = init?.method ?? "GET";

  console.info(`[api] -> ${method} ${url}`, init?.body ?? null);

  let response: Response;

  try {
    response = await fetch(url, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (error) {
    console.error(`[api] fetch failed for ${method} ${url}`, error);
    throw new Error(
      error instanceof Error
        ? `Failed to fetch ${url}: ${error.message}`
        : `Failed to fetch ${url}`,
    );
  }

  const responseText = await response.text();
  console.info(`[api] <- ${response.status} ${method} ${url}`, responseText || "<empty>");

  if (!response.ok) {
    throw new Error(responseText || `Request failed with status ${response.status}`);
  }

  if (!responseText) {
    return {} as T;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch (error) {
    console.error(`[api] invalid JSON from ${method} ${url}`, error);
    throw new Error(`Backend returned invalid JSON for ${path}`);
  }
}

async function apiFetch<T>(paths: string | string[], init?: RequestInit): Promise<T> {
  const candidates = Array.isArray(paths) ? paths : [paths];
  let lastError: Error | null = null;

  for (const path of candidates) {
    try {
      return await requestJson<T>(path, init);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const canFallback =
        candidates.length > 1 &&
        (message.includes("status 404") || message.includes("status 405"));

      if (!canFallback) {
        throw error;
      }

      lastError = error instanceof Error ? error : new Error("Request failed");
    }
  }

  throw lastError ?? new Error("No backend endpoint responded");
}

export function systemStreamUrl(subjectAddress?: string) {
  const url = new URL(`${BACKEND_URL}/api/system/stream`);
  if (subjectAddress) {
    url.searchParams.set("subject_address", subjectAddress);
  }
  return url.toString();
}

export async function fetchSystemState(subjectAddress?: string) {
  return getSystemStatus(subjectAddress);
}

export async function startMonitor() {
  return apiFetch<{ running: boolean }>("/api/monitor/start", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function triggerDemoEvent() {
  return triggerAttack();
}

export async function analyzeData(payload: AnalyzePayload) {
  return apiFetch<AnalyzeResponse>(["/analyze", "/api/anomaly/detect"], {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function getSystemStatus(subjectAddress?: string) {
  const query = subjectAddress
    ? `?subject_address=${encodeURIComponent(subjectAddress)}`
    : "";

  return apiFetch<SystemState>(
    [`/status${query}`, `/api/system/state${query}`],
    { method: "GET" },
  );
}

export async function triggerAttack() {
  console.log("[simulate-attack] sending request to http://localhost:8000/trigger-attack");
  const response = await requestJson<DemoTriggerResponse>("/trigger-attack", {
    method: "POST",
    body: JSON.stringify({}),
  });
  console.log("[simulate-attack] backend response received", response);
  return response;
}

export async function triggerSystem() {
  return triggerAttack();
}
