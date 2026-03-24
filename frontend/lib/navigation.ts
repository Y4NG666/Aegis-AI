export type NavigationItem = {
  label: string;
  href: string;
  icon: string;
  exact?: boolean;
};

export const navigationItems: NavigationItem[] = [
  { label: "Dashboard", href: "/", icon: "dashboard", exact: true },
  { label: "AI Threat Center", href: "/ai-threat-center", icon: "security" },
  { label: "Workflow Builder", href: "/workflow-builder", icon: "hub" },
  { label: "Network Activity", href: "/network-activity", icon: "lan" },
  { label: "Forensics", href: "/forensics", icon: "analytics" },
  { label: "Settings", href: "/settings", icon: "settings" },
];

export const chainTabs = ["Mainnet", "Arbitrum", "Optimism"] as const;

export const routeLabels: Record<string, string> = {
  "/": "Dashboard",
  "/ai-threat-center": "AI Threat Center",
  "/workflow-builder": "Workflow Builder",
  "/network-activity": "Network Activity",
  "/forensics": "Forensics",
  "/settings": "Settings",
};
