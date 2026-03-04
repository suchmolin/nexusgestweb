const raw = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const API_BASE = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

const apiPath = (path: string) => (path.startsWith('/api') ? path : '/api' + (path.startsWith('/') ? path : '/' + path));

export async function api<T>(
  path: string,
  options: RequestInit & { params?: Record<string, string> } = {}
): Promise<T> {
  const { params, ...rest } = options;
  let url = `${API_BASE}${apiPath(path)}`;
  if (params && Object.keys(params).length > 0) {
    const search = new URLSearchParams(params).toString();
    url += (path.includes('?') ? '&' : '?') + search;
  }
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(rest.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, { ...rest, headers });
  const text = await res.text();
  if (!res.ok) {
    const err = text ? (() => { try { return JSON.parse(text); } catch { return { message: res.statusText }; } })() : { message: res.statusText };
    throw new Error(err.message || 'Error en la solicitud');
  }
  if (!text || text.trim() === '') return null as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Respuesta no válida del servidor');
  }
}

export const authApi = {
  login: (username: string, password: string) =>
    api<{ access_token: string; user: { id: string; username: string; role: string; companyId: string | null } }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ username, password }) }
    ),
  me: () =>
    api<{
      id: string;
      username: string;
      role: string;
      companyId: string | null;
      company: { id: string; name: string } | null;
    }>('/auth/me'),
};

export const companiesApi = {
  list: (params?: { username?: string; name?: string; rif?: string; email?: string }) =>
    api<Array<{ id: string; name: string; address?: string; rif?: string; phone?: string; email?: string; adminUsername?: string | null }>>(
      '/companies',
      params ? { params: Object.fromEntries(Object.entries(params).filter(([, v]) => v != null && v !== '')) } : {}
    ),
  get: (id: string) => api<unknown>(`/companies/${id}`),
  update: (id: string, data: { name?: string; address?: string; rif?: string; phone?: string; email?: string }) =>
    api<unknown>(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  create: (data: { name: string; address?: string; rif?: string; phone?: string; email?: string }) =>
    api<unknown>('/companies', { method: 'POST', body: JSON.stringify(data) }),
};

export const configApi = {
  get: (companyId: string) => api<unknown>(`/config/company/${companyId}`),
  update: (companyId: string, data: Record<string, unknown>) =>
    api<unknown>(`/config/company/${companyId}`, { method: 'PUT', body: JSON.stringify(data) }),
  getRoleModules: (companyId: string) =>
    api<{ admin?: { enabled: boolean; modules: string[] }; vendedor: { enabled: boolean; modules: string[] }; supervisor: { enabled: boolean; modules: string[] } }>(`/config/company/${companyId}/role-modules`),
  updateRoleModules: (companyId: string, data: { admin?: { enabled: boolean; modules: string[] }; vendedor?: { enabled: boolean; modules: string[] }; supervisor?: { enabled: boolean; modules: string[] } }) =>
    api<unknown>(`/config/company/${companyId}/role-modules`, { method: 'PUT', body: JSON.stringify(data) }),
};

export const clientsApi = {
  search: (companyId: string, rifCedula: string) =>
    api<unknown | null>('/clients/search', { params: { companyId, rifCedula } }),
  list: (companyId: string, page?: number, limit?: number, search?: string) =>
    api<{ items: unknown[]; total: number }>('/clients', {
      params: { companyId, ...(page && { page: String(page) }), ...(limit && { limit: String(limit) }), ...(search && { search }) },
    }),
  get: (id: string, companyId: string) => api<unknown>(`/clients/${id}`, { params: { companyId } }),
  create: (companyId: string, data: Record<string, unknown>) =>
    api<unknown>('/clients', { method: 'POST', body: JSON.stringify(data), params: { companyId } }),
  update: (id: string, companyId: string, data: Record<string, unknown>) =>
    api<unknown>(`/clients/${id}`, { method: 'PUT', body: JSON.stringify(data), params: { companyId } }),
};

export const productsApi = {
  search: (companyId: string, q: string) =>
    api<unknown[]>('/products/search', { params: { companyId, q } }),
  list: (companyId: string, page?: number, limit?: number, code?: string, name?: string, from?: string) =>
    api<{ items: unknown[]; total: number }>('/products', {
      params: { companyId, ...(page && { page: String(page) }), ...(limit && { limit: String(limit) }), ...(code && { code }), ...(name && { name }), ...(from && { from }) },
    }),
  get: (id: string, companyId: string) => api<unknown>(`/products/${id}`, { params: { companyId } }),
  create: (companyId: string, data: { code: string; name: string; description?: string; exentoIva?: boolean }) =>
    api<unknown>('/products', { method: 'POST', body: JSON.stringify(data), params: { companyId } }),
  delete: (id: string, companyId: string) =>
    api<unknown>(`/products/${id}`, { method: 'DELETE', params: { companyId } }),
};

export const budgetsApi = {
  list: (companyId: string, filters?: Record<string, string | number>) =>
    api<{ items: unknown[]; total: number }>('/budgets', { params: { companyId, ...(filters as Record<string, string>) } }),
  get: (id: string, companyId: string) => api<unknown>(`/budgets/${id}`, { params: { companyId } }),
  create: (companyId: string, data: unknown) =>
    api<unknown>('/budgets', { method: 'POST', body: JSON.stringify(data), params: { companyId } }),
  update: (id: string, companyId: string, data: unknown) =>
    api<unknown>(`/budgets/${id}`, { method: 'PUT', body: JSON.stringify(data), params: { companyId } }),
  delete: (id: string, companyId: string) =>
    api<unknown>(`/budgets/${id}`, { method: 'DELETE', params: { companyId } }),
  duplicate: (id: string, companyId: string) =>
    api<unknown>(`/budgets/${id}/duplicate`, { method: 'POST', params: { companyId } }),
  getPdfBlob: async (id: string, companyId: string): Promise<Blob> => {
    const url = `${API_BASE}${apiPath(`/budgets/${id}/pdf`)}?companyId=${encodeURIComponent(companyId)}`;
    const token = getToken();
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error('Error al generar PDF');
    return res.blob();
  },
};

export const invoicesApi = {
  list: (companyId: string, filters?: Record<string, string>) =>
    api<{ items: unknown[]; total: number }>('/invoices', { params: { companyId, ...filters } }),
  get: (id: string, companyId: string) => api<unknown>(`/invoices/${id}`, { params: { companyId } }),
  createFromBudget: (companyId: string, budgetId: string) =>
    api<unknown>('/invoices/from-budget', { method: 'POST', body: JSON.stringify({ budgetId }), params: { companyId } }),
  create: (companyId: string, data: unknown) =>
    api<unknown>('/invoices', { method: 'POST', body: JSON.stringify(data), params: { companyId } }),
  getPdfBlob: async (id: string, companyId: string): Promise<Blob> => {
    const url = `${API_BASE}${apiPath(`/invoices/${id}/pdf`)}?companyId=${encodeURIComponent(companyId)}`;
    const token = getToken();
    const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error('Error al generar PDF');
    return res.blob();
  },
};

export const inventoryApi = {
  ingress: (companyId: string, data: { productId: string; quantity: number; unitCost?: number; salePrice?: number; observation?: string }) =>
    api<unknown>('/inventory/ingress', { method: 'POST', body: JSON.stringify(data), params: { companyId } }),
  egress: (companyId: string, data: { productId: string; quantity: number; reason: string; observation?: string }) =>
    api<unknown>('/inventory/egress', { method: 'POST', body: JSON.stringify(data), params: { companyId } }),
  movements: (companyId: string, productId: string, filters?: Record<string, string>) =>
    api<{ items: unknown[]; total: number }>(`/inventory/movements/${productId}`, { params: { companyId, ...filters } }),
};

export const logsApi = {
  list: (filters?: { companyId?: string; userId?: string; action?: string; from?: string; to?: string; page?: number; limit?: number }) =>
    api<{ items: unknown[]; total: number }>('/logs', {
      params: filters as Record<string, string>,
    }),
};

export const adminApi = {
  stats: (companyId: string) =>
    api<{ ingresosCount: number; ingresosTotalCost: number; facturacionCount: number; facturacionTotal: number; balance: number }>('/admin/stats', { params: { companyId } }),
};

/** Sube una imagen a Vercel Blob. Devuelve la URL para guardar en BD. Requiere estar logueado. */
export async function uploadImage(file: File): Promise<{ url: string; pathname: string }> {
  const token = getToken();
  if (!token) throw new Error('Debes iniciar sesión para subir archivos');
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}${apiPath('/upload/image')}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  const text = await res.text();
  if (!res.ok) {
    const err = text ? (() => { try { return JSON.parse(text); } catch { return { message: res.statusText }; } })() : { message: res.statusText };
    throw new Error((err as { message?: string }).message || 'Error al subir la imagen');
  }
  return JSON.parse(text) as { url: string; pathname: string };
}

export const usersApi = {
  listAdmins: () => api<Array<{ id: string; username: string; companyId: string | null; company: { id: string; name: string } | null }>>('/users/admins'),
  createUser: (data: {
    username: string;
    password: string;
    role: string;
    companyId?: string;
    companyName?: string;
    companyAddress?: string;
    companyRif?: string;
    companyPhone?: string;
    companyEmail?: string;
  }) => api<unknown>('/users', { method: 'POST', body: JSON.stringify(data) }),
};
