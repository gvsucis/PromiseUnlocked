type DashboardRefreshListener = () => void;

const listeners = new Set<DashboardRefreshListener>();

export function subscribeToDashboardRefresh(listener: DashboardRefreshListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyDashboardRefresh(): void {
  listeners.forEach((listener) => listener());
}
