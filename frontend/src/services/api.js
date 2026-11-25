import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('drill_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('drill_token');
      localStorage.removeItem('drill_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ── Auth ─────────────────────────────────────────────────────────────────────
export const loginUser = (username, password) =>
  api.post('/auth/login', { username, password });

// ── Drill Schedule ───────────────────────────────────────────────────────────
export const fetchDrills  = ()           => api.get('/drills/');
export const createDrill  = (data)       => api.post('/drills/', data);
export const updateDrill  = (id, data)   => api.put(`/drills/${id}`, data);
export const deleteDrill  = (id)         => api.delete(`/drills/${id}`);

// ── Tracker ──────────────────────────────────────────────────────────────────
export const fetchTrackerGroups  = ()          => api.get('/tracker/groups');
export const fetchTrackerEntries = (groupName) =>
  api.get('/tracker/entries', { params: { group_name: groupName } });
export const createTrackerEntry  = (data)      => api.post('/tracker/entries', data);
export const updateTrackerEntry  = (id, data)  => api.put(`/tracker/entries/${id}`, data);
export const deleteTrackerEntry  = (id)        => api.delete(`/tracker/entries/${id}`);
export const submitTrackerGroup  = (groupName) =>
  api.post('/tracker/submit', { group_name: groupName });
export const uploadTrackerEvidence = (id, formData) =>
  api.post(`/tracker/upload-evidence/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// ── Tracker Columns ──────────────────────────────────────────────────────────
export const fetchTrackerColumns = (group)       => api.get('/columns/tracker', { params: { group } });
export const addTrackerColumn    = (data)        => api.post('/columns/tracker', data);
export const deleteTrackerColumn = (id)          => api.delete(`/columns/tracker/${id}`);

// ── Checklist ────────────────────────────────────────────────────────────────
export const fetchChecklistItems   = (serviceName) =>
  api.get('/checklist/items', { params: { service_name: serviceName } });
export const checkChecklistExists  = (serviceName) =>
  api.get('/checklist/exists', { params: { service_name: serviceName } });
export const createChecklistItem   = (data)        => api.post('/checklist/items', data);
export const updateChecklistItem   = (id, data)    => api.put(`/checklist/items/${id}`, data);
export const deleteChecklistItem   = (id)          => api.delete(`/checklist/items/${id}`);
export const uploadChecklistEvidence = (id, formData) =>
  api.post(`/checklist/upload-evidence/${id}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

// ── Checklist Columns ─────────────────────────────────────────────────────────
export const fetchChecklistColumns = (group)  => api.get('/columns/checklist', { params: { group } });
export const addChecklistColumn    = (data)   => api.post('/columns/checklist', data);
export const deleteChecklistColumn = (id)     => api.delete(`/columns/checklist/${id}`);

// ── Approval ─────────────────────────────────────────────────────────────────
export const fetchPendingTrackers = () => api.get('/approval/pending');
export const takeApprovalAction   = (data) => api.post('/approval/action', data);

// ── Documents ─────────────────────────────────────────────────────────────────
export const fetchDocuments = (params = {}) => api.get('/documents/', { params });
export const fetchDocument  = (id)          => api.get(`/documents/${id}`);
export const createDocument = (formData)    =>
  api.post('/documents/', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const updateDocument = (id, formData) =>
  api.put(`/documents/${id}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const deleteDocument     = (id)           => api.delete(`/documents/${id}`);
export const submitDocForReview = (id)           => api.post(`/documents/${id}/submit`);
export const reviewDocument     = (id, formData) =>
  api.post(`/documents/${id}/review`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const approveDocument    = (id, formData) =>
  api.post(`/documents/${id}/approve`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const rejectDocument     = (id, formData) =>
  api.post(`/documents/${id}/reject`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const fetchDocKpi        = ()  => api.get('/documents/kpi');
export const fetchDocKpiDetail  = (key) => api.get(`/documents/kpi/${key}`);

export default api;
