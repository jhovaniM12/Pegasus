export type RootDashboardStats = {
  fairs: number;
  registeredEntries: number;
  pendingResults: number;
  people: number;
  categories: number;
};

export type RootDashboardActivityItem = {
  id: string;
  occurredAt: string;
  title: string;
  description: string;
};

export type RootDashboardTask = {
  id: string;
  label: string;
  href: string | null;
};

export type RootDashboardSummary = {
  stats: RootDashboardStats;
  recentActivity: RootDashboardActivityItem[];
  nextTasks: RootDashboardTask[];
};
