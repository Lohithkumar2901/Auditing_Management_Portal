import React, { useState, useEffect, useRef } from 'react';
import Navbar from './Navbar';
import TrackerModal from './TrackerModal';
import { fetchDrills, fetchTrackerGroups, createDrill, updateDrill, deleteDrill } from '../services/api';

/* ── Keyword → tracker group mapping ─────────────────────────────────────── */
const KEYWORD_MAP = [
  { keys: ['backup drill', 'restore drill', 'backup/restore drill'],           group: 'Backup / Restore Drill Tracker' },
  { keys: ['dr drill', 'dc/dr', 'dc / dr'],                                    group: 'DR Drill Master Tracker (DC / DR Failover Test)' },
  { keys: ['network device configuration','security log monitoring','firewall policy','privileged access','user access review'], group: 'Security & Access Review Tracker' },
  { keys: ['server room physical', 'server room'],                              group: 'Infrastructure & Network Review Tracker' },
  { keys: ['asset handling','endpoint security','change management','risk assessment','nda','legal compliance','training & awareness','training and awareness'], group: 'Governance & Compliance Tracker' },
];

function findTrackerGroup(activity, groups) {
  const low = activity.toLowerCase();
  for (const m of KEYWORD_MAP) {
    if (m.keys.some(k => low.includes(k))) {
      const g = groups.find(g => g.group_name === m.group);
      if (g) return g;
    }
  }
  return null;
}

/* ── KPI config ───────────────────────────────────────────────────────────── */
const KPI_DEFS = [
  {
    id: 'drills', label: 'Total Drills Scheduled', cls: 'blue', accentColor: '#3b82f6',
    description: 'All planned compliance drill activities from the master schedule',
    icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  },
  {
    id: 'groups', label: 'Active Tracker Groups', cls: 'purple', accentColor: '#7c3aed',
    description: 'Live execution trackers grouped by drill category',
    icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  },
  {
    id: 'completed', label: 'Completed Entries', cls: 'green', accentColor: '#059669',
    description: 'Tracker entries approved and marked as completed',
    icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  },
  {
    id: 'pending', label: 'Pending Approval', cls: 'orange', accentColor: '#d97706',
    description: 'Submitted entries awaiting admin review and approval',
    icon: <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  },
];

const FREQ_OPTIONS = ['Daily', 'Fortnight', 'Monthly', 'Quarterly', 'Half-Yearly', 'Yearly'];

const freqBadgeClass = (freq = '') => {
  const f = freq.toLowerCase();
  if (f === 'daily')       return 'badge-rose';
  if (f === 'fortnight')   return 'badge-orange';
  if (f === 'monthly')     return 'badge-orange';
  if (f === 'quarterly')   return 'badge-purple';
  if (f === 'half-yearly') return 'badge-indigo';
  return 'badge-blue';
};

const DRILL_TEXT_FIELDS = [
  { label: 'Activity Name', key: 'activity',       placeholder: 'e.g. DR Drill (DC/DR)',               required: true },
  { label: 'Policy / Procedure', key: 'policy',    placeholder: 'e.g. Business Continuity Procedure'              },
  { label: 'Test Method',   key: 'method',          placeholder: 'e.g. Scenario Based Test'                        },
  { label: 'Responsible Team', key: 'responsibility', placeholder: 'e.g. NOC Team'                                 },
  { label: 'Evidence Required', key: 'evidence',   placeholder: 'e.g. DR Drill Report'                            },
];

/* ── Shared Form Body ─────────────────────────────────────────────────────── */
function DrillFormBody({ form, set, error }) {
  return (
    <>
      {error && <div className="alert alert-error" style={{ marginBottom: 0 }}>{error}</div>}

      {DRILL_TEXT_FIELDS.map(({ label, key, placeholder, required }) => (
        <div className="mf-group" key={key}>
          <label className="mf-label">
            {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
          </label>
          <input
            className="form-input"
            value={form[key] || ''}
            onChange={e => set(key, e.target.value)}
            placeholder={placeholder}
          />
        </div>
      ))}

      <div className="mf-row">
        <div className="mf-group">
          <label className="mf-label">Frequency</label>
          <select className="form-input" value={form.frequency || ''} onChange={e => set('frequency', e.target.value)}>
            <option value="">— Select —</option>
            {FREQ_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="mf-group">
          <label className="mf-label">Review Type</label>
          <select className="form-input" value={form.review_type || 'Repeat'} onChange={e => set('review_type', e.target.value)}>
            <option value="Repeat">Repeat</option>
            <option value="Once">Once</option>
          </select>
        </div>
      </div>

      <div className="mf-row">
        <div className="mf-group">
          <label className="mf-label">Review Date</label>
          <input type="date" className="form-input" value={form.review_date || ''} onChange={e => set('review_date', e.target.value)} />
        </div>
        <div className="mf-group">
          <label className="mf-label">Start Date</label>
          <input type="date" className="form-input" value={form.start_date || ''} onChange={e => set('start_date', e.target.value)} />
        </div>
        <div className="mf-group">
          <label className="mf-label">End Date</label>
          <input type="date" className="form-input" value={form.end_date || ''} onChange={e => set('end_date', e.target.value)} />
        </div>
      </div>
    </>
  );
}

/* ── Add Drill Modal ──────────────────────────────────────────────────────── */
const EMPTY_DRILL = { activity:'', policy:'', frequency:'', method:'', responsibility:'', evidence:'', review_type:'Repeat', review_date:'', start_date:'', end_date:'' };

function AddDrillModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY_DRILL });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.activity.trim()) { setError('Activity name is required'); return; }
    setSaving(true);
    try { await createDrill(form); onSaved(); onClose(); }
    catch (err) { setError(err.response?.data?.detail || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <div>
            <h2>Add Drill Schedule</h2>
            <p className="modal-subtitle">Create a new compliance drill entry</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body mf">
          <DrillFormBody form={form} set={set} error={error} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <span className="spinner" /> : 'Save Drill'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Edit Drill Modal ─────────────────────────────────────────────────────── */
function EditDrillModal({ drill, onClose, onSaved }) {
  const [form, setForm] = useState({
    activity:       drill.activity       || '',
    policy:         drill.policy         || '',
    frequency:      drill.frequency      || '',
    method:         drill.method         || '',
    responsibility: drill.responsibility || '',
    evidence:       drill.evidence       || '',
    review_type:    drill.review_type    || 'Repeat',
    review_date:    drill.review_date    || '',
    start_date:     drill.start_date     || '',
    end_date:       drill.end_date       || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.activity.trim()) { setError('Activity name is required'); return; }
    setSaving(true);
    try { await updateDrill(drill.id, form); onSaved(); onClose(); }
    catch (err) { setError(err.response?.data?.detail || 'Failed to update'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <div>
            <h2>Edit Drill Schedule</h2>
            <p className="modal-subtitle">{drill.drill_code} · {drill.activity}</p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body mf">
          <DrillFormBody form={form} set={set} error={error} />
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? <span className="spinner" /> : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Progress Ring ────────────────────────────────────────────────────────── */
function ProgressRing({ pct, color = '#059669', size = 44 }) {
  const r    = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="5" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
      <text x="50%" y="50%" dominantBaseline="middle" textAnchor="middle"
        style={{ transform:'rotate(90deg)', transformOrigin:'center', fontSize: size < 50 ? '10px' : '12px', fontWeight: 700, fill: color }}>
        {pct}%
      </text>
    </svg>
  );
}

/* ── Panel intro banner ───────────────────────────────────────────────────── */
function PanelIntro({ icon, title, body, cls }) {
  return (
    <div className={`kpi-panel-intro ${cls}`} style={{ marginBottom: 20 }}>
      <div className="kpi-panel-intro-icon">{icon}</div>
      <div>
        <h4>{title}</h4>
        <p>{body}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PANEL 1 — Drill Schedule
   ══════════════════════════════════════════════════════════════════════════ */
function DrillSchedulePanel({ drills, trackerGroups, onOpenTracker, onAddDrill, onEditDrill, onDeleteDrill, loading }) {
  const [search, setSearch] = useState('');
  const filtered = drills.filter(d =>
    !search ||
    (d.drill_code    || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.activity      || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.policy        || '').toLowerCase().includes(search.toLowerCase()) ||
    (d.responsibility|| '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="kpi-panel">
      <PanelIntro
        cls="blue"
        icon={<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="14" height="14" rx="2"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="6" y1="2" x2="6" y2="5"/><line x1="3" y1="8" x2="17" y2="8"/></svg>}
        title="Drill Schedule"
        body="Master list of all planned compliance drill activities. Click Open to access a drill's live tracker, or Add Drill to schedule a new activity."
      />
      <div className="card">
        <div className="card-header">
          <div>
            <h3>All Scheduled Drills</h3>
            <p>{drills.length} activities · {filtered.length} shown</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-box">
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ID / activity…" />
            </div>
            <button className="btn btn-primary btn-sm" onClick={onAddDrill}>
              <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Drill
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th title="Auto-generated unique drill ID">Drill ID</th>
                <th title="Name of the drill/review activity">Activity</th>
                <th title="Governing policy or procedure">Policy</th>
                <th title="How often this drill recurs">Frequency</th>
                <th title="Once = single occurrence · Repeat = recurring">Review Type</th>
                <th title="Next scheduled review date">Review Date</th>
                <th title="Drill period start date">Start</th>
                <th title="Drill period end date">End</th>
                <th title="Test method or technique">Method</th>
                <th title="Responsible team or individual">Responsible</th>
                <th title="Evidence document required">Evidence</th>
                <th title="Live execution tracker" className="col-tracker">Tracker</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="13" className="empty-row">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--text-muted)' }}>
                    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: .5 }}><circle cx="8" cy="8" r="6"/><path d="M8 4v4l2 2"/></svg>
                    Loading drills…
                  </div>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan="13" className="empty-row">No drills match your search</td></tr>
              ) : filtered.map((drill) => {
                const grp = findTrackerGroup(drill.activity || '', trackerGroups);
                const pct = grp && Number(grp.total) > 0
                  ? Math.round((Number(grp.completed) / Number(grp.total)) * 100) : 0;
                return (
                  <tr key={drill.id}>
                    <td>
                      <span className="stat-chip" style={{ fontFamily: 'monospace', letterSpacing: '.5px' }}>
                        {drill.drill_code || '—'}
                      </span>
                    </td>
                    <td><span className="cell-primary">{drill.activity}</span></td>
                    <td><span className="cell-secondary">{drill.policy || '—'}</span></td>
                    <td>
                      {drill.frequency
                        ? <span className={`badge ${freqBadgeClass(drill.frequency)}`}>{drill.frequency}</span>
                        : <span className="cell-muted">—</span>}
                    </td>
                    <td>
                      {drill.review_type === 'Once'
                        ? <span className="badge badge-purple">Once</span>
                        : <span className="badge badge-blue">Repeat</span>}
                    </td>
                    <td>
                      {drill.review_date
                        ? <span className="cell-primary" style={{ fontSize: '.78rem' }}>{drill.review_date}</span>
                        : <span className="cell-muted">—</span>}
                    </td>
                    <td><span className="cell-secondary" style={{ fontSize: '.78rem' }}>{drill.start_date || '—'}</span></td>
                    <td><span className="cell-secondary" style={{ fontSize: '.78rem' }}>{drill.end_date || '—'}</span></td>
                    <td><span className="cell-secondary">{drill.method || '—'}</span></td>
                    <td>
                      {drill.responsibility
                        ? <span className="badge badge-indigo">{drill.responsibility}</span>
                        : <span className="cell-muted">—</span>}
                    </td>
                    <td><span className="cell-evidence">{drill.evidence || '—'}</span></td>
                    <td>
                      {grp ? (
                        <div className="tracker-cell">
                          <div className="tracker-cell-top">
                            <button className="btn btn-info btn-xs" onClick={() => onOpenTracker(grp.group_name)}>Open</button>
                          </div>
                          <div className="tracker-mini-bar">
                            <div className="tracker-mini-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="tracker-mini-label">
                            <span className="badge badge-green" style={{ fontSize: '.63rem' }}>{grp.completed}/{grp.total}</span>
                            {Number(grp.pending) > 0 && <span className="badge badge-orange" style={{ fontSize: '.63rem' }}>{grp.pending} pend</span>}
                          </div>
                        </div>
                      ) : (
                        <button className="btn btn-success btn-xs" onClick={() => onOpenTracker(drill.activity)}>+ Add</button>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="btn btn-warning btn-xs" onClick={() => onEditDrill(drill)} title="Edit">Edit</button>
                      <button className="btn btn-danger btn-xs"  onClick={() => onDeleteDrill(drill)} title="Delete">Del</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PANEL 2 — Tracker Groups
   ══════════════════════════════════════════════════════════════════════════ */
function TrackerGroupsPanel({ trackerGroups, onOpenTracker, loading }) {
  const totalEntries = trackerGroups.reduce((s, g) => s + Number(g.total     || 0), 0);
  const totalDone    = trackerGroups.reduce((s, g) => s + Number(g.completed || 0), 0);
  const overallPct   = totalEntries > 0 ? Math.round((totalDone / totalEntries) * 100) : 0;

  return (
    <div className="kpi-panel">
      <PanelIntro
        cls="purple"
        icon={<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><polyline points="13 2 13 7 18 7"/></svg>}
        title="Active Tracker Groups"
        body="Live execution trackers grouped by drill category. Each group tracks the completion status of individual services and systems."
      />
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Tracker Groups Overview</h3>
            <p>{trackerGroups.length} groups · {totalEntries} total entries · {overallPct}% overall completion</p>
          </div>
          <div className="overall-ring">
            <ProgressRing pct={overallPct} color="#7c3aed" size={52} />
            <span style={{ fontSize: '.72rem', color: 'var(--text-muted)', marginLeft: 6 }}>Overall</span>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-no">#</th>
                <th title="Name of the drill tracker group">Tracker Group</th>
                <th title="Total number of entries" style={{ textAlign: 'center' }}>Total</th>
                <th title="Entries currently in progress" style={{ textAlign: 'center' }}>In Progress</th>
                <th title="Submitted entries awaiting admin approval" style={{ textAlign: 'center' }}>Pending</th>
                <th title="Admin-approved entries" style={{ textAlign: 'center' }}>Completed</th>
                <th title="Completion percentage" style={{ minWidth: 160 }}>Progress</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="empty-row">Loading…</td></tr>
              ) : trackerGroups.length === 0 ? (
                <tr><td colSpan="8" className="empty-row">No tracker groups found</td></tr>
              ) : trackerGroups.map((grp, idx) => {
                const total     = Number(grp.total       || 0);
                const completed = Number(grp.completed   || 0);
                const pending   = Number(grp.pending     || 0);
                const inProg    = Number(grp.in_progress || 0);
                const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
                const ringColor = pct === 100 ? '#059669' : pct >= 50 ? '#7c3aed' : '#d97706';

                return (
                  <tr key={grp.group_name} className="group-row">
                    <td className="col-no">{idx + 1}</td>
                    <td>
                      <div className="group-name-cell">
                        <span className="group-dot" style={{ background: ringColor }} />
                        <span className="cell-primary">{grp.group_name}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="stat-chip">{total}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      {inProg > 0 ? <span className="badge badge-blue">{inProg}</span> : <span className="cell-muted">—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {pending > 0 ? <span className="badge badge-orange">{pending}</span> : <span className="cell-muted">—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {completed > 0 ? <span className="badge badge-green">{completed}</span> : <span className="cell-muted">—</span>}
                    </td>
                    <td>
                      <div className="progress-wrap">
                        <ProgressRing pct={pct} color={ringColor} size={40} />
                        <div style={{ flex: 1 }}>
                          <div className="progress-bar-lg">
                            <div className="progress-fill-lg" style={{ width: `${pct}%`, background: ringColor }} />
                          </div>
                          <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginTop: 3 }}>
                            {completed} of {total} completed
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <button className="btn btn-primary btn-xs" onClick={() => onOpenTracker(grp.group_name)}>
                        Open Tracker
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PANEL 3 — Completed
   ══════════════════════════════════════════════════════════════════════════ */
function CompletedPanel({ trackerGroups, onOpenTracker, loading }) {
  const sorted   = [...trackerGroups].sort((a, b) => Number(b.completed || 0) - Number(a.completed || 0));
  const total    = sorted.reduce((s, g) => s + Number(g.completed || 0), 0);
  const allTotal = sorted.reduce((s, g) => s + Number(g.total     || 0), 0);

  return (
    <div className="kpi-panel">
      <PanelIntro
        cls="green"
        icon={<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="7 10 10 13 17 6"/><path d="M19 11v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/></svg>}
        title="Completed Entries"
        body={`${total} entries completed out of ${allTotal} total across all groups. Groups sorted by most completions. 100% groups are highlighted.`}
      />
      <div className="card">
        <div className="card-header">
          <div>
            <h3>Completion Breakdown by Group</h3>
            <p>{total} completed · {allTotal - total} remaining · {allTotal > 0 ? Math.round((total / allTotal) * 100) : 0}% overall</p>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th className="col-no">#</th>
                <th>Group</th>
                <th style={{ textAlign: 'center' }}>Total</th>
                <th style={{ textAlign: 'center' }}>Completed</th>
                <th style={{ textAlign: 'center' }}>Remaining</th>
                <th>Completion %</th>
                <th>Health</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="8" className="empty-row">Loading…</td></tr>
              ) : sorted.map((grp, idx) => {
                const tot  = Number(grp.total     || 0);
                const done = Number(grp.completed || 0);
                const rem  = tot - done;
                const pct  = tot > 0 ? Math.round((done / tot) * 100) : 0;
                const health = pct === 100 ? { label: 'Complete',    cls: 'badge-green'  }
                             : pct >= 50  ? { label: 'On Track',     cls: 'badge-purple' }
                             : pct > 0    ? { label: 'In Progress',  cls: 'badge-orange' }
                             :              { label: 'Not Started',  cls: 'badge-blue'   };
                return (
                  <tr key={grp.group_name} className={done === tot && tot > 0 ? 'completed-row' : ''}>
                    <td className="col-no">{idx + 1}</td>
                    <td>
                      <div className="group-name-cell">
                        <span className="group-dot" style={{ background: pct === 100 ? '#059669' : pct >= 50 ? '#7c3aed' : '#d97706' }} />
                        <span className="cell-primary">{grp.group_name}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}><span className="stat-chip">{tot}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-green" style={{ fontSize: '.8rem', padding: '4px 12px' }}>{done}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {rem > 0
                        ? <span className="badge badge-orange">{rem}</span>
                        : <span className="badge badge-green">All Done</span>}
                    </td>
                    <td>
                      <div className="progress-wrap-flat">
                        <div className="progress-bar-flat">
                          <div className="progress-fill-flat" style={{ width: `${pct}%`, background: pct === 100 ? '#059669' : pct >= 50 ? '#7c3aed' : '#d97706' }} />
                        </div>
                        <span className="progress-pct-label">{pct}%</span>
                      </div>
                    </td>
                    <td><span className={`badge ${health.cls}`}>{health.label}</span></td>
                    <td>
                      <button className="btn btn-info btn-xs" onClick={() => onOpenTracker(grp.group_name)}>View</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   PANEL 4 — Pending Approval
   ══════════════════════════════════════════════════════════════════════════ */
function PendingPanel({ trackerGroups, onOpenTracker, loading }) {
  const withPending  = trackerGroups.filter(g => Number(g.pending || 0) > 0);
  const totalPending = trackerGroups.reduce((s, g) => s + Number(g.pending || 0), 0);
  const noPending    = trackerGroups.filter(g => Number(g.pending || 0) === 0);

  return (
    <div className="kpi-panel">
      <PanelIntro
        cls="orange"
        icon={<svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="10" cy="10" r="8"/><polyline points="10 5 10 10 13 12"/></svg>}
        title="Pending Approval"
        body="Entries submitted by technicians awaiting admin review. Groups highlighted in amber require immediate attention."
      />

      {totalPending === 0 ? (
        <div className="card empty-state">
          <svg width="52" height="52" fill="none" stroke="#6ee7b7" strokeWidth="1.5" style={{ marginBottom: 12 }}>
            <circle cx="26" cy="26" r="22"/>
            <polyline points="16 26 23 33 36 19" strokeWidth="2.5"/>
          </svg>
          <h3>All Clear — No Pending Approvals</h3>
          <p>All submitted entries have been reviewed. Nothing is waiting for approval right now.</p>
        </div>
      ) : (
        <div className="card">
          <div className="card-header">
            <div>
              <h3>Pending Approval by Group</h3>
              <p>{totalPending} entries awaiting admin review across {withPending.length} groups</p>
            </div>
            <span className="badge badge-orange" style={{ fontSize: '.85rem', padding: '6px 14px' }}>
              {totalPending} Pending
            </span>
          </div>

          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-no">#</th>
                  <th>Tracker Group</th>
                  <th style={{ textAlign: 'center' }}>Total</th>
                  <th style={{ textAlign: 'center' }}>Pending</th>
                  <th style={{ textAlign: 'center' }}>In Progress</th>
                  <th style={{ textAlign: 'center' }}>Completed</th>
                  <th>Next Action</th>
                  <th>Open</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" className="empty-row">Loading…</td></tr>
                ) : (
                  <>
                    {withPending.map((grp, idx) => {
                      const tot  = Number(grp.total       || 0);
                      const pend = Number(grp.pending     || 0);
                      const done = Number(grp.completed   || 0);
                      const inp  = Number(grp.in_progress || 0);
                      return (
                        <tr key={grp.group_name} className="pending-row">
                          <td className="col-no">{idx + 1}</td>
                          <td>
                            <div className="group-name-cell">
                              <span className="group-dot blink" style={{ background: '#d97706' }} />
                              <span className="cell-primary">{grp.group_name}</span>
                            </div>
                          </td>
                          <td style={{ textAlign: 'center' }}><span className="stat-chip">{tot}</span></td>
                          <td style={{ textAlign: 'center' }}>
                            <span className="badge badge-orange" style={{ fontSize: '.8rem', padding: '4px 12px' }}>{pend}</span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {inp > 0 ? <span className="badge badge-blue">{inp}</span> : <span className="cell-muted">—</span>}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {done > 0 ? <span className="badge badge-green">{done}</span> : <span className="cell-muted">—</span>}
                          </td>
                          <td><span className="badge badge-orange">Admin Approval Required</span></td>
                          <td>
                            <button className="btn btn-warning btn-xs" onClick={() => onOpenTracker(grp.group_name)}>
                              View Entries
                            </button>
                          </td>
                        </tr>
                      );
                    })}

                    {noPending.length > 0 && (
                      <>
                        <tr className="section-divider-row">
                          <td colSpan="8">
                            <span className="section-divider-label">Groups with no pending entries</span>
                          </td>
                        </tr>
                        {noPending.map((grp, idx) => (
                          <tr key={grp.group_name} style={{ opacity: .55 }}>
                            <td className="col-no">{withPending.length + idx + 1}</td>
                            <td>
                              <div className="group-name-cell">
                                <span className="group-dot" style={{ background: '#10b981' }} />
                                <span className="cell-primary">{grp.group_name}</span>
                              </div>
                            </td>
                            <td style={{ textAlign: 'center' }}><span className="stat-chip">{Number(grp.total || 0)}</span></td>
                            <td style={{ textAlign: 'center' }}><span className="cell-muted">—</span></td>
                            <td style={{ textAlign: 'center' }}>
                              {Number(grp.in_progress || 0) > 0 ? <span className="badge badge-blue">{grp.in_progress}</span> : <span className="cell-muted">—</span>}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {Number(grp.completed || 0) > 0 ? <span className="badge badge-green">{grp.completed}</span> : <span className="cell-muted">—</span>}
                            </td>
                            <td><span className="badge badge-green">No Action Needed</span></td>
                            <td>
                              <button className="btn btn-info btn-xs" onClick={() => onOpenTracker(grp.group_name)}>View</button>
                            </td>
                          </tr>
                        ))}
                      </>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ══════════════════════════════════════════════════════════════════════════ */
export default function Dashboard() {
  const [drills,        setDrills]        = useState([]);
  const [trackerGroups, setTrackerGroups] = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');
  const [activeKPI,     setActiveKPI]     = useState('drills');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showAddDrill,  setShowAddDrill]  = useState(false);
  const [showEditDrill, setShowEditDrill] = useState(null);
  const panelRef = useRef(null);

  const loadData = async () => {
    setLoading(true); setError('');
    try {
      const [dr, gr] = await Promise.all([fetchDrills(), fetchTrackerGroups()]);
      setDrills(dr.data);
      setTrackerGroups(gr.data);
    } catch {
      setError('Failed to load data. Please refresh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const totalCompleted = trackerGroups.reduce((s, g) => s + Number(g.completed || 0), 0);
  const totalPending   = trackerGroups.reduce((s, g) => s + Number(g.pending   || 0), 0);

  const kpiValues = {
    drills:    drills.length,
    groups:    trackerGroups.length,
    completed: totalCompleted,
    pending:   totalPending,
  };

  const handleKPIClick = (id) => {
    setActiveKPI(id);
    setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  return (
    <div className="page">
      <Navbar />
      <div className="page-content">

        {/* ── Header ── */}
        <div className="page-header">
          <h2>Compliance &amp; Drill Dashboard</h2>
          <p>Click any KPI card to explore detailed information for that category</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {/* ── KPI Cards ── */}
        <div className="summary-cards">
          {KPI_DEFS.map((kpi, i) => (
            <button
              key={kpi.id}
              className={`summary-card kpi-card ${activeKPI === kpi.id ? 'kpi-card-active' : ''}`}
              style={{ animationDelay: `${i * 80}ms`, '--kpi-color': kpi.accentColor }}
              onClick={() => handleKPIClick(kpi.id)}
              title={kpi.description}
            >
              <div className={`summary-icon ${kpi.cls}`}>{kpi.icon}</div>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div className="summary-value">{loading ? '—' : kpiValues[kpi.id]}</div>
                <div className="summary-label">{kpi.label}</div>
              </div>
              {activeKPI === kpi.id && <div className="kpi-active-dot" />}
            </button>
          ))}
        </div>

        {/* ── Section label ── */}
        <div className="kpi-section-label" ref={panelRef} style={{ marginTop: 8 }}>
          <span className="kpi-section-title">
            {KPI_DEFS.find(k => k.id === activeKPI)?.label}
          </span>
          <span className="kpi-section-hint">
            — {KPI_DEFS.find(k => k.id === activeKPI)?.description}
          </span>
        </div>

        {/* ── Panels ── */}
        {activeKPI === 'drills' && (
          <DrillSchedulePanel
            drills={drills} trackerGroups={trackerGroups}
            onOpenTracker={g => setSelectedGroup(g)}
            onAddDrill={() => setShowAddDrill(true)}
            onEditDrill={d => setShowEditDrill(d)}
            onDeleteDrill={async (drill) => {
              if (!window.confirm(`Delete "${drill.activity}" (${drill.drill_code})?`)) return;
              try { await deleteDrill(drill.id); loadData(); }
              catch (err) { alert(err.response?.data?.detail || 'Failed to delete'); }
            }}
            loading={loading}
          />
        )}
        {activeKPI === 'groups' && (
          <TrackerGroupsPanel trackerGroups={trackerGroups} onOpenTracker={g => setSelectedGroup(g)} loading={loading} />
        )}
        {activeKPI === 'completed' && (
          <CompletedPanel trackerGroups={trackerGroups} onOpenTracker={g => setSelectedGroup(g)} loading={loading} />
        )}
        {activeKPI === 'pending' && (
          <PendingPanel trackerGroups={trackerGroups} onOpenTracker={g => setSelectedGroup(g)} loading={loading} />
        )}

      </div>

      {selectedGroup && (
        <TrackerModal groupName={selectedGroup} onClose={() => { setSelectedGroup(null); loadData(); }} />
      )}
      {showAddDrill && (
        <AddDrillModal onClose={() => setShowAddDrill(false)} onSaved={loadData} />
      )}
      {showEditDrill && (
        <EditDrillModal drill={showEditDrill} onClose={() => setShowEditDrill(null)} onSaved={loadData} />
      )}
    </div>
  );
}
