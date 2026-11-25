import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import { fetchPendingTrackers, takeApprovalAction } from '../services/api';

export default function AdminPanel() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchPendingTrackers();
      setPending(res.data);
    } catch {
      setError('Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const showMsg = (msg, isError = false) => {
    if (isError) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 4000);
  };

  const handleApprove = async (id) => {
    if (!window.confirm('Approve this entry?')) return;
    setActionLoading(id);
    try {
      const res = await takeApprovalAction({ tracker_id: id, action: 'approve' });
      showMsg(res.data.message);
      await load();
    } catch (err) {
      showMsg(err.response?.data?.detail || 'Approval failed', true);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    setActionLoading(rejectModal);
    try {
      const res = await takeApprovalAction({ tracker_id: rejectModal, action: 'reject', remarks: rejectRemarks });
      showMsg(res.data.message);
      setRejectModal(null);
      setRejectRemarks('');
      await load();
    } catch (err) {
      showMsg(err.response?.data?.detail || 'Rejection failed', true);
    } finally {
      setActionLoading(null);
    }
  };

  const grouped = pending.reduce((acc, entry) => {
    const key = entry.tracker || 'Unknown Group';
    if (!acc[key]) acc[key] = [];
    acc[key].push(entry);
    return acc;
  }, {});

  return (
    <div className="page">
      <Navbar />
      <div className="page-content">

        {/* Header */}
        <div className="page-header">
          <h2>Admin Approval Panel</h2>
          <p>Review submitted drill tracker entries and take approval actions</p>
        </div>

        {error   && <div className="alert alert-error">{error}</div>}
        {success && <div className="alert alert-success">{success}</div>}

        {/* Stats */}
        <div className="summary-cards">
          <div className="summary-card">
            <div className="summary-icon orange">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
            </div>
            <div>
              <div className="summary-value">{pending.length}</div>
              <div className="summary-label">Pending Approvals</div>
            </div>
          </div>
          <div className="summary-card">
            <div className="summary-icon blue">
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <div>
              <div className="summary-value">{Object.keys(grouped).length}</div>
              <div className="summary-label">Tracker Groups</div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="loading-container"><div className="spinner-lg" /><p>Loading pending approvals…</p></div>
        ) : pending.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-icon">✓</div>
            <h3>All Clear!</h3>
            <p>No pending approvals at this time.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([groupName, entries], gi) => (
            <div className="card" key={groupName} style={{ animationDelay:`${gi*80}ms` }}>
              <div className="card-header">
                <div>
                  <h3>
                    <span style={{ display:'inline-block', width:'10px', height:'10px', borderRadius:'50%', background:'linear-gradient(135deg,#f59e0b,#ef4444)', marginRight:'8px', animation:'pulse 2s ease infinite' }} />
                    {groupName}
                  </h3>
                  <p>Awaiting admin review</p>
                </div>
                <span className="badge badge-orange">{entries.length} Pending</span>
              </div>

              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Host Server</th><th>Service / VM</th><th>IP Address</th>
                      <th>Backup Type</th><th>Responsible</th><th>Planned</th><th>Actual</th>
                      <th>Activity</th><th>Remarks</th><th>Evidence</th><th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry, idx) => (
                      <tr key={entry.id} className="pending-row">
                        <td style={{ fontWeight:700, color:'var(--text-muted)' }}>{idx + 1}</td>
                        <td>{entry.host_server}</td>
                        <td className="bold-cell">{entry.service_name}</td>
                        <td><code style={{ fontSize:'.78rem', background:'#f0f9ff', padding:'2px 6px', borderRadius:'4px', color:'#0284c7' }}>{entry.ip_address}</code></td>
                        <td>{entry.backup_type}</td>
                        <td><span className="badge badge-blue">{entry.responsible_person}</span></td>
                        <td>{entry.planned_date}</td>
                        <td>{entry.actual_date}</td>
                        <td className="activity-cell">{entry.activity}</td>
                        <td className="remarks-cell">{entry.remarks}</td>
                        <td>
                          {entry.evidence ? (
                            <a href={`${process.env.REACT_APP_API_URL}/${entry.evidence}`} target="_blank" rel="noreferrer" className="link-btn">View</a>
                          ) : <span className="text-muted">—</span>}
                        </td>
                        <td style={{ whiteSpace:'nowrap' }}>
                          <button className="btn btn-success btn-xs" onClick={() => handleApprove(entry.id)} disabled={actionLoading === entry.id}>
                            {actionLoading === entry.id ? '…' : '✓ Approve'}
                          </button>
                          <button className="btn btn-danger btn-xs" onClick={() => setRejectModal(entry.id)} disabled={actionLoading === entry.id}>
                            ✕ Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header" style={{ '--gradient':'var(--gradient-rose)' }}>
              <div>
                <h2>Reject Entry</h2>
                <p className="modal-subtitle">Provide a reason for rejection</p>
              </div>
              <button className="modal-close" onClick={() => setRejectModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Rejection Reason</label>
                <textarea className="form-textarea" rows="3" value={rejectRemarks}
                  onChange={(e) => setRejectRemarks(e.target.value)}
                  placeholder="Enter reason for rejection…" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => { setRejectModal(null); setRejectRemarks(''); }}>Cancel</button>
              <button className="btn btn-danger" onClick={handleRejectConfirm} disabled={actionLoading === rejectModal}>
                {actionLoading === rejectModal ? <span className="spinner" /> : 'Confirm Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
