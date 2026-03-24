export type DashboardMetric = {
  label: string;
  value: string;
  description: string;
  tone: "primary" | "neutral" | "danger";
  icon: string;
  footer: string;
  progress?: number;
};

export const dashboardMetrics: DashboardMetric[] = [
  {
    label: "SYSTEM_STATE",
    value: "ACTIVE",
    description: "Autonomous Guardian Mode 01",
    tone: "primary",
    icon: "verified_user",
    footer: "AUTONOMOUS_GUARDIAN_MODE_01",
  },
  {
    label: "GLOBAL_THREAT_LEVEL",
    value: "NORMAL",
    description: "Threat baseline across monitored chains",
    tone: "neutral",
    icon: "shield_locked",
    footer: "1 / 5 RISK CHANNELS HOT",
    progress: 20,
  },
  {
    label: "MONITORED_TVL",
    value: "$4.29B",
    description: "Value actively covered by Sentinel rules",
    tone: "neutral",
    icon: "monitoring",
    footer: "+2.4% (24H)",
  },
];

export const dashboardStats = [
  { label: "PEAK_THRESHOLD", value: "0.024 MS" },
  { label: "AI_CONFIDENCE", value: "99.8%" },
  { label: "LATENCY", value: "12.1 MS" },
  { label: "THROUGHPUT", value: "842 TX/S" },
];

export type LiveLog = {
  time: string;
  type: string;
  message: string;
  tone: "primary" | "muted" | "danger";
};

export const liveAiLogs: LiveLog[] = [
  { time: "[14:22:01]", type: "SCAN", message: "Analyzing Uniswap V3 swap (0x4a...f21)", tone: "primary" },
  { time: "[14:22:04]", type: "EVAL", message: "Evaluating flash loan potential on Aave...", tone: "primary" },
  { time: "[14:22:08]", type: "IDLE", message: "Monitoring block 18,442,109 (Mainnet)", tone: "muted" },
  { time: "[14:22:12]", type: "SCAN", message: "Curve pool imbalance detected (Tri-Crypto)", tone: "primary" },
  { time: "[14:22:15]", type: "WARN", message: "High gas volatility on Arbitrum One", tone: "danger" },
  { time: "[14:22:19]", type: "SCAN", message: "Tracing cross-chain bridging (Stargate)", tone: "primary" },
  { time: "[14:22:24]", type: "EVAL", message: "Sandwich attack simulation initiated...", tone: "primary" },
  { time: "[14:22:28]", type: "PASS", message: "No threat detected in pending mempool.", tone: "muted" },
];

export type ProtocolHealthItem = {
  name: string;
  detail: string;
  icon: string;
  status: string;
  tone: "primary" | "danger";
};

export const protocolHealth: ProtocolHealthItem[] = [
  {
    name: "Ethereum Mainnet",
    detail: "RPC Status: 12ms | Blocks: Synchronized",
    icon: "hub",
    status: "STABLE",
    tone: "primary",
  },
  {
    name: "Arbitrum One",
    detail: "RPC Status: 8ms | Blocks: Synchronized",
    icon: "layers",
    status: "STABLE",
    tone: "primary",
  },
  {
    name: "Optimism",
    detail: "RPC Status: 104ms | Latency detected",
    icon: "bolt",
    status: "CONGESTED",
    tone: "danger",
  },
];

export type InterventionItem = {
  age: string;
  title: string;
  detail: string;
  tone: "primary" | "muted";
};

export const interventions: InterventionItem[] = [
  {
    age: "22M AGO",
    title: "Adjusted gas buffer on Optimism",
    detail: "Automatic threshold shift to 1.5x due to sudden surge in sequencer fees.",
    tone: "primary",
  },
  {
    age: "1H AGO",
    title: "Detected and ignored minor arbitrage",
    detail: "Arbitrum MEV bot (0x99...) identified as non-hostile pattern. No action required.",
    tone: "muted",
  },
  {
    age: "3H AGO",
    title: "Paused vulnerable vault interface",
    detail: "Protocol: YieldSync. Reason: Unusual withdraw pattern detected at block 18,441,920.",
    tone: "primary",
  },
];

export type ForensicRow = {
  id: string;
  age: string;
  network: string;
  networkIcon: string;
  networkColor: string;
  source: string;
  activity: string;
  detail: string;
  confidence: number;
  confidenceLabel: string;
  confidenceWidthClass: string;
  status: string;
  tone: "primary" | "warning" | "danger";
};

export const forensicRows: ForensicRow[] = [
  {
    id: "TX-9420-BA",
    age: "2m ago",
    network: "Arbitrum",
    networkIcon: "hub",
    networkColor: "text-primary",
    source: "0x71C...3E4D",
    activity: "Large Swap",
    detail: "420.5 ETH -> USDC",
    confidence: 98,
    confidenceLabel: "98.2%",
    confidenceWidthClass: "w-[98%]",
    status: "Safe",
    tone: "primary",
  },
  {
    id: "TX-8812-QX",
    age: "14m ago",
    network: "Mainnet",
    networkIcon: "token",
    networkColor: "text-[#8247E5]",
    source: "0xAE2...F01B",
    activity: "Contract Upgrade",
    detail: "Proxy pattern shift detected",
    confidence: 42,
    confidenceLabel: "42.5%",
    confidenceWidthClass: "w-[42%]",
    status: "Intervened",
    tone: "danger",
  },
  {
    id: "TX-8821-ALPHA",
    age: "31m ago",
    network: "Optimism",
    networkIcon: "diamond",
    networkColor: "text-[#FF0420]",
    source: "0x3f5...BC22",
    activity: "Flash Loan",
    detail: "High volatility sequence",
    confidence: 65,
    confidenceLabel: "65.0%",
    confidenceWidthClass: "w-[65%]",
    status: "Anomaly",
    tone: "warning",
  },
];

export type WorkflowStep =
  | {
      label: string;
      title: string;
      description: string;
      tags: string[];
      icon: string;
      tone: "primary" | "secondary";
    }
  | {
      label: string;
      title: string;
      description: string;
      actions: string[];
      icon: string;
      tone: "tertiary";
    };

export const workflowSteps: WorkflowStep[] = [
  {
    label: "TRIGGER (Event Listener)",
    title: "Large Liquidity Change",
    description: "Monitoring pool balances on Aave V3 Mainnet deployment.",
    tags: ["ENTITY: Aave V3", "METRIC: TVL_DELTA"],
    icon: "sensors",
    tone: "primary",
  },
  {
    label: "FILTER (AI Analysis)",
    title: "Anomaly Detection Model",
    description: "LLM + ML heuristic engine checking for adversarial signatures.",
    tags: ["THRESHOLD SCORE", "> 80% RISK"],
    icon: "psychology_alt",
    tone: "secondary",
  },
  {
    label: "ACTION (Execution)",
    title: "Protocol Safeguard",
    description: "Pause contracts and notify the DAO when risk exceeds the allowed score.",
    actions: ["Pause Protocol", "Notify DAO via Telegram"],
    icon: "bolt",
    tone: "tertiary",
  },
];

export const workflowPalette = {
  triggers: [
    { icon: "water_drop", label: "Liquidity drop", tone: "text-primary" },
    { icon: "swap_horiz", label: "Large swap", tone: "text-primary" },
    { icon: "gavel", label: "New proposal", tone: "text-primary" },
  ],
  filters: [
    { icon: "smart_toy", label: "AI Analysis", tone: "text-secondary" },
    { icon: "verified_user", label: "Whitelists", tone: "text-secondary" },
  ],
  actions: [
    { icon: "pause_circle", label: "Pause Contract", tone: "text-tertiary-container" },
    { icon: "notification_important", label: "Send Alert", tone: "text-tertiary-container" },
    { icon: "account_balance", label: "Treasury Transfer", tone: "text-tertiary-container" },
  ],
};

export type ThreatCallFlowItem = {
  step: string;
  type: string;
  action: string;
  value: string;
  tone: "neutral" | "danger" | "muted";
};

export const threatCallFlow: ThreatCallFlowItem[] = [
  {
    step: "01",
    type: "CALL",
    action: "AaveLendingPool.flashLoan()",
    value: "1,000,000 USDC",
    tone: "neutral",
  },
  {
    step: "02",
    type: "CALL",
    action: "UniswapV3.swap()",
    value: "USDC -> WETH",
    tone: "neutral",
  },
  {
    step: "03",
    type: "DELEGATE",
    action: "UnknownContract.exploit()",
    value: "Price Manipulation",
    tone: "danger",
  },
  {
    step: "04",
    type: "CALL",
    action: "AaveLendingPool.repay()",
    value: "NULLIFIED BY PAUSE",
    tone: "muted",
  },
];

export const reasoningChecks = ["Loop Detected", "Price Skew +4.2%"];
