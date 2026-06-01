const API_BASE = "/api";
const WORKSPACE_STORAGE_KEY = "opypal_pp_current_workspace";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const workspaceId =
    typeof localStorage !== "undefined"
      ? localStorage.getItem(WORKSPACE_STORAGE_KEY)
      : null;
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(workspaceId ? { "x-workspace-id": workspaceId } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  partners: {
    list: () => request<any[]>("/partners"),
    get: (id: number) => request<any>(`/partners/${id}`),
    getBySlug: (slug: string) => request<any>(`/partners/slug/${slug}`),
    create: (data: any) => request<any>("/partners", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/partners/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/partners/${id}`, { method: "DELETE" }),
  },
  requests: {
    list: (params?: { partnerId?: number; status?: string; search?: string }) => {
      const qs = new URLSearchParams();
      if (params?.partnerId) qs.set("partnerId", String(params.partnerId));
      if (params?.status) qs.set("status", params.status);
      if (params?.search) qs.set("search", params.search);
      const q = qs.toString();
      return request<any[]>(`/partner-requests${q ? `?${q}` : ""}`);
    },
    get: (id: number) => request<any>(`/partner-requests/${id}`),
    create: (data: any) => request<any>("/partner-requests", { method: "POST", body: JSON.stringify(data) }),
    updateStatus: (id: number, status: string) =>
      request<any>(`/partner-requests/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }),
    addNote: (id: number, content: string) =>
      request<any>(`/partner-requests/${id}/notes`, { method: "POST", body: JSON.stringify({ content }) }),
    summary: () => request<any>("/partner-requests/dashboard/summary"),
  },
  pricing: {
    list: () => request<any[]>("/pricing-rules"),
    create: (data: any) => request<any>("/pricing-rules", { method: "POST", body: JSON.stringify(data) }),
    update: (id: number, data: any) => request<any>(`/pricing-rules/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: number) => request<void>(`/pricing-rules/${id}`, { method: "DELETE" }),
  },
};
