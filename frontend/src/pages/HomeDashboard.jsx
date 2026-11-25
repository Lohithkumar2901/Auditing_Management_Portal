import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchDocKpi, fetchDocKpiDetail, fetchDrills, fetchPendingTrackers, fetchTrackerGroups } from '../services/api';

function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }

/* ── Icons ─────────────────────────────────────────────────────────────── */
const IcoDoc      = () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const IcoClock    = () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="9"/><polyline points="11 5.5 11 11 14.5 13"/></svg>;
const IcoEye      = () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 11s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="11" r="3"/></svg>;
const IcoSend     = () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IcoCheck    = () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
const IcoDrill    = () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>;
const IcoFolder   = () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>;
const IcoShield   = () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const IcoClipboard= () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>;
const IcoLayout   = () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>;
const IcoGraduate = () => <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>;
const IcoArrow    = () => <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 7h8M8 4l3 3-3 3"/></svg>;

/* ── Config ─────────────────────────────────────────────────────────────── */
const DOC_KPIS = [
  { key: 'total',            label: 'Total Documents',  icon: <IcoDoc />,   cls: 'blue',   accentColor: '#3b82f6' },
  { key: 'pending_review',   label: 'Pending Review',   icon: <IcoClock />, cls: 'red',    accentColor: '#ef4444' },
  { key: 'reviewed',         label: 'Reviewed',         icon: <IcoEye />,   cls: 'orange', accentColor: '#f97316' },
  { key: 'pending_approval', label: 'Pending Approval', icon: <IcoSend />,  cls: 'purple', accentColor: '#a855f7' },
  { key: 'approved',         label: 'Approved',         icon: <IcoCheck />, cls: 'green',  accentColor: '#22c55e' },
];

const DRILL_KPIS = [
  { key: 'total',     label: 'Total Drills',     icon: <IcoDrill />,  cls: 'blue',   accentColor: '#3b82f6', path: '/dashboard' },
  { key: 'groups',    label: 'Active Groups',    icon: <IcoFolder />, cls: 'purple', accentColor: '#a855f7', path: '/dashboard' },
  { key: 'pending',   label: 'Pending Approval', icon: <IcoClock />,  cls: 'red',    accentColor: '#ef4444', path: '/admin'     },
  { key: 'completed', label: 'Groups Completed', icon: <IcoCheck />,  cls: 'green',  accentColor: '#22c55e', path: '/dashboard' },
];

const MODULE_TILES = [
  { path: '/policies',   label: 'Policies',         sub: 'Security & governance policies', cls: 'blue',   accentColor: '#3b82f6', icon: <IcoShield />    },
  { path: '/procedures', label: 'Procedures & SOPs', sub: 'Operational procedures & SOPs', cls: 'purple', accentColor: '#a855f7', icon: <IcoClipboard /> },
  { path: '/formats',    label: 'Formats',           sub: 'Templates & record formats',    cls: 'orange', accentColor: '#f97316', icon: <IcoLayout />    },
  { path: '/trainings',  label: 'Trainings',         sub: 'Awareness & training records',  cls: 'green',  accentColor: '#22c55e', icon: <IcoGraduate />  },
  { path: '/dashboard',  label: 'Drill Management',  sub: 'DR & compliance drills',        cls: 'cyan',   accentColor: '#06b6d4', icon: <IcoDrill />     },
];

function StatusBadge({ doc }) {
  if (doc.approval_status === 'Approved') return <span className="badge badge-green">Approved</span>;
  if (doc.approval_status === 'Rejected') return <span className="badge badge-gray">Rejected</span>;
  if (doc.review_status   === 'Reviewed') return <span className="badge badge-orange">Reviewed</span>;
  return <span className="badge badge-red">Pending Review</span>;
}

export default function HomeDashboard() {
  const navigate    = useNavigate();
  const { user }    = useAuth();

  const [docKpi,    setDocKpi]    = useState(null);
  const [drillKpi,  setDrillKpi]  = useState(null);
  const [kpiModal,  setKpiModal]  = useState(null);
  const [modalLoad, setModalLoad] = useState(false);
  const [loading,   setLoading]   = useState(true);
  const [activeDoc, setActiveDoc] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    /* fetch doc KPI independently so a drill API 403 doesn't zero-out doc counts */
    try {
      const docRes = await fetchDocKpi();
      setDocKpi(docRes.data);
    } catch (_) {}
    try {
      const [drillRes, pendingRes, groupsRes] = await Promise.allSettled([
        fetchDrills(),
        fetchPendingTrackers(),
        fetchTrackerGroups(),
      ]);
      const drills  = drillRes.status  === 'fulfilled' ? (drillRes.value.data   || []) : [];
      const pending = pendingRes.status === 'fulfilled' ? (pendingRes.value.data || []) : [];
      const groups  = groupsRes.status  === 'fulfilled' ? (groupsRes.value.data  || []) : [];
      const completed = groups.filter(g => g.total_count > 0 && g.completed_count === g.total_count).length;
      setDrillKpi({ total: drills.length, groups: groups.length, pending: pending.length, completed });
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openKpi = async (cfg) => {
    setActiveDoc(cfg.key);
    setKpiModal({ key: cfg.key, label: cfg.label, docs: [] });
    setModalLoad(true);
    try {
      const { data } = await fetchDocKpiDetail(cfg.key);
      setKpiModal({ key: cfg.key, label: cfg.label, docs: data });
    } catch (_) {}
    setModalLoad(false);
  };

  const val = (obj, key) => (obj ? (obj[key] ?? 0) : (loading ? '—' : 0));

  return (
    <div className="page-content">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="page-header">
        <h2>ISMS Compliance Dashboard</h2>
        <p>Wheels India Limited &nbsp;·&nbsp; Click below KPI card to view detailed records</p>
      </div>

      {/* ── Document Lifecycle KPIs ─────────────────────────────────────── */}
      <div className="kpi-section-label" style={{ marginBottom: 14 }}>
        <span className="kpi-section-title">Document Lifecycle</span>
        <span className="kpi-section-hint">document workflow status across all modules</span>
      </div>
      <div className="summary-cards" style={{ marginBottom: 28 }}>
        {DOC_KPIS.map((cfg, i) => (
          <button
            key={cfg.key}
            className={`summary-card kpi-card ${activeDoc === cfg.key ? 'kpi-card-active' : ''}`}
            style={{ animationDelay: `${i * 60}ms`, '--kpi-color': cfg.accentColor, ...(user?.role === 'auditor' ? { cursor: 'default' } : {}) }}
            onClick={() => user?.role !== 'auditor' && openKpi(cfg)}
            title={user?.role === 'auditor' ? cfg.label : `View all: ${cfg.label}`}
          >
            <div className={`summary-icon ${cfg.cls}`}>{cfg.icon}</div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div className="summary-value">{val(docKpi, cfg.key)}</div>
              <div className="summary-label">{cfg.label}</div>
            </div>
            {activeDoc === cfg.key && <div className="kpi-active-dot" />}
          </button>
        ))}
      </div>

      {/* ── Drill Management KPIs ───────────────────────────────────────── */}
      <div className="kpi-section-label" style={{ marginBottom: 14 }}>
        <span className="kpi-section-title">Drill Management</span>
        <span className="kpi-section-hint">— DR and compliance drill execution status</span>
      </div>
      <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', marginBottom: 36 }}>
        {DRILL_KPIS.map((cfg, i) => (
          <button
            key={cfg.key}
            className="summary-card kpi-card"
            style={{ animationDelay: `${(i + 5) * 60}ms`, '--kpi-color': cfg.accentColor }}
            onClick={() => navigate(cfg.path)}
            title={`Navigate to ${cfg.label}`}
          >
            <div className={`summary-icon ${cfg.cls}`}>{cfg.icon}</div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div className="summary-value">{val(drillKpi, cfg.key)}</div>
              <div className="summary-label">{cfg.label}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ── Document Module Tiles (same KPI card style) ─────────────────── */}
      <div className="kpi-section-label" style={{ marginBottom: 14 }}>
        <span className="kpi-section-title">Document Modules</span>
        <span className="kpi-section-hint">— Navigate to module management</span>
      </div>
      <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px,1fr))', marginBottom: 8 }}>
        {MODULE_TILES.map((m, i) => (
          <button
            key={m.path}
            className="summary-card kpi-card mod-nav-card"
            style={{ animationDelay: `${(i + 9) * 60}ms`, '--kpi-color': m.accentColor }}
            onClick={() => navigate(m.path)}
          >
            <div className={`summary-icon ${m.cls}`}>{m.icon}</div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div className="mod-nav-name">{m.label}</div>
              <div className="summary-label">{m.sub}</div>
            </div>
            <div className="mod-nav-arrow"><IcoArrow /></div>
          </button>
        ))}
      </div>

      {/* ── KPI Detail Modal ────────────────────────────────────────────── */}
      {kpiModal && (
        <div className="modal-overlay" onClick={() => { setKpiModal(null); setActiveDoc(null); }}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{kpiModal.label}</h2>
                <p className="modal-subtitle">
                  {kpiModal.docs.length > 0
                    ? `${kpiModal.docs.length} document${kpiModal.docs.length !== 1 ? 's' : ''}`
                    : 'Document records'}
                </p>
              </div>
              <button className="modal-close" onClick={() => { setKpiModal(null); setActiveDoc(null); }}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              {modalLoad ? (
                <div className="panel-empty" style={{ padding: '48px 24px' }}>
                  <svg width="36" height="36" fill="none" stroke="#c7d2fe" strokeWidth="1.5" style={{ marginBottom: 10 }}><circle cx="18" cy="18" r="14"/><polyline points="18 9 18 18 22 20"/></svg>
                  Loading records…
                </div>
              ) : kpiModal.docs.length === 0 ? (
                <div className="panel-empty" style={{ padding: '48px 24px' }}>
                  <svg width="40" height="40" fill="none" stroke="#e2e8f0" strokeWidth="1.5" style={{ marginBottom: 10 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                  No documents in this category
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Document Name</th>
                        <th>Type</th>
                        <th>Version</th>
                        <th>Status</th>
                        <th>Uploaded</th>
                        <th>Reviewed</th>
                        <th>Approved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kpiModal.docs.map((d, i) => (
                        <tr key={d.id}>
                          <td className="td-muted">{i + 1}</td>
                          <td style={{ fontWeight: 600 }}>{d.document_name}</td>
                          <td><span className="badge badge-blue">{d.document_type}</span></td>
                          <td><span className="badge badge-gray">{d.version_no}</span></td>
                          <td><StatusBadge doc={d} /></td>
                          <td className="td-muted">{fmt(d.uploaded_date)}</td>
                          <td className="td-muted">{fmt(d.reviewed_date)}</td>
                          <td className="td-muted">{fmt(d.approval_date)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
