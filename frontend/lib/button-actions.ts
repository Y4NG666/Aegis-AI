"use client";

import {
  analyzeData,
  getSystemStatus,
  startMonitor,
  type AnalyzeResponse,
  type SystemState,
} from "@/lib/api";
import { deployment } from "@/lib/deployment";
import {
  getGuardianState,
  getProtocolStatus,
  resumeProtocol,
  triggerPause,
  type GuardianState,
  type ProtocolStatus,
} from "@/lib/contract";
import type { ForensicRow } from "@/lib/mock-data";
import { connectWallet, type ConnectedWallet } from "@/hooks/useWallet";

export type RuntimeSnapshot = {
  systemState: SystemState;
  protocolStatus: ProtocolStatus | null;
  fetchedAt: string;
};

export type EmergencyPauseResult = {
  wallet: ConnectedWallet;
  transaction: {
    hash: string;
    blockNumber: number | null;
    status: number | null;
  };
  snapshot: RuntimeSnapshot;
};

export type ResumeProtocolResult = {
  wallet: ConnectedWallet;
  transaction: {
    hash: string;
    blockNumber: number | null;
    status: number | null;
  };
  snapshot: RuntimeSnapshot;
};

export type WalletInspectionResult = {
  wallet: ConnectedWallet;
  guardianState: GuardianState;
  snapshot: RuntimeSnapshot;
};

export type ForensicActionResult = {
  analysis: AnalyzeResponse;
  snapshot: RuntimeSnapshot;
  row: ForensicRow;
};

function nowIso() {
  return new Date().toISOString();
}

async function readProtocolStatusSafely() {
  try {
    return await getProtocolStatus();
  } catch (error) {
    console.warn("[button-actions] unable to read protocol status", error);
    return null;
  }
}

export async function loadRuntimeSnapshot(subjectAddress?: string): Promise<RuntimeSnapshot> {
  const [systemState, protocolStatus] = await Promise.all([
    getSystemStatus(subjectAddress),
    readProtocolStatusSafely(),
  ]);

  return {
    systemState,
    protocolStatus,
    fetchedAt: nowIso(),
  };
}

export async function executeEmergencyPause(): Promise<EmergencyPauseResult> {
  const wallet = await connectWallet();
  const transaction = await triggerPause();
  const snapshot = await loadRuntimeSnapshot(wallet.address);

  return {
    wallet,
    transaction,
    snapshot,
  };
}

export async function resumeProtocolOperations(): Promise<ResumeProtocolResult> {
  const wallet = await connectWallet();
  const transaction = await resumeProtocol();
  const snapshot = await loadRuntimeSnapshot(wallet.address);

  return {
    wallet,
    transaction,
    snapshot,
  };
}

export async function inspectConnectedWallet(): Promise<WalletInspectionResult> {
  const wallet = await connectWallet();
  const guardianState = await getGuardianState(wallet.address);
  const snapshot = await loadRuntimeSnapshot(wallet.address);

  return {
    wallet,
    guardianState,
    snapshot,
  };
}

function buildForensicPayload(row: ForensicRow, mode: "review" | "false-positive") {
  const elevated = mode === "review";

  return {
    pair_address: deployment.demoPairAddress ?? "",
    transaction_data: {
      tx_value_usd: elevated ? 485_000 : 35_000,
      slippage_bps: elevated ? 1_450 : 45,
      gas_spike_ratio: elevated ? 4.9 : 1.05,
      failed_tx_count_1h: elevated ? 12 : 0,
      unique_protocols_1h: elevated ? 9 : 2,
      flash_loan_detected: elevated ? row.activity.toLowerCase().includes("flash") : false,
      mev_flagged: elevated ? row.tone !== "primary" : false,
    },
    liquidity_changes: {
      liquidity_before_usd: 1_200_000,
      liquidity_after_usd: elevated ? 690_000 : 1_175_000,
      reserve0_change_pct: elevated ? 41 : 2,
      reserve1_change_pct: elevated ? 34 : 1,
    },
    on_chain_data: {
      liquidity_drop_pct: elevated ? 37 : 3,
      volatility_index: elevated ? 0.89 : 0.18,
      collateral_ratio: elevated ? 1.03 : 1.44,
      pool_utilization: elevated ? 0.92 : 0.24,
      active_exploit_flag: elevated,
      forensic_id: row.id,
      chain_name: row.network,
      incident_status: row.status,
    },
    execute_onchain: false,
    record_onchain: false,
  };
}

export async function reviewForensicIncident(row: ForensicRow): Promise<ForensicActionResult> {
  const analysis = await analyzeData(buildForensicPayload(row, "review"));
  const snapshot = await loadRuntimeSnapshot();

  return {
    analysis,
    snapshot,
    row,
  };
}

export async function markForensicIncidentFalsePositive(
  row: ForensicRow,
): Promise<ForensicActionResult> {
  const analysis = await analyzeData(buildForensicPayload(row, "false-positive"));
  const snapshot = await loadRuntimeSnapshot();

  return {
    analysis,
    snapshot,
    row,
  };
}

export async function activateWorkflowRule() {
  const monitor = await startMonitor();
  const snapshot = await loadRuntimeSnapshot();

  return {
    monitor,
    snapshot,
  };
}

export async function syncSettingItem(item: string) {
  const snapshot = await loadRuntimeSnapshot();

  return {
    item,
    snapshot,
  };
}
