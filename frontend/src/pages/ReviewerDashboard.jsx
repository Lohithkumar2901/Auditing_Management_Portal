import React, { useEffect, useState, useCallback } from 'react';
import { fetchDocuments, reviewDocument } from '../services/api';
import { useAuth } from '../context/AuthContext';

function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }

const TYPE_CLS = { POLICY: 'blue', PROCEDURE: 'purple', SOP: 'cyan', FORMAT: 'orange', TRAINING: 'green' };

export default function ReviewerDashboard() {
  const { user }                      = useAuth();
  const [pending, setPending]         = useState([]);
  const [history, setHistory]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [reviewModal, setReviewModal] = useState(null);
  const [remarks, setRemarks]         = useState('');
  const [busy, setBusy]               = useState(false);
  const [msg, setMsg]                 = useState(null);

  const flash = (text, type = 'success') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, hRes] = await Promise.all([
        fetchDocuments({ review_status: 'Pending' }),
        fetchDocuments({ review_status: 'Reviewed' }),
      ]);
      setPending(pRes.data);
      setHistory(hRes.data);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleReview = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      if (remarks) fd.append('remarks', remarks);
      await reviewDocument(reviewModal.id, fd);
      flash('Document marked as reviewed.');
      setReviewModal(null);
      setRemarks('');
      load();
    } catch (err) {
      flash(err.response?.data?.detail || 'Action failed.', 'error');
    }
    setBusy(false);
  };

  return (
    <div className="page-content">
      {msg && <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'}`}>{msg.text}</div>}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <h2>Review Queue</h2>
        <p>Documents awaiting review &nbsp;·&nbsp; {user?.full_name}</p>
      </div>

      {/* ── Stat Cards ─────────────────────────────────────────────────── */}
      <div className="summary-cards" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px,1fr))', maxWidth: 520, marginBottom: 28 }}>
        <div className="summary-card" style={{ animationDelay: '0ms' }}>
          <div className="summary-icon red">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
          </div>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div className="summary-value">{loading ? '—' : pending.length}</div>
            <div className="summary-label">Pending Review</div>
          </div>
        </div>
        <div className="summary-card" style={{ animationDelay: '70ms' }}>
          <div className="summary-icon green">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 11 12 14 22 4"/>
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
            </svg>
          </div>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <div className="summary-value">{loading ? '—' : history.length}</div>
            <div className="summary-label">Already Reviewed</div>
          </div>
        </div>
      </div>

      {/* ── Pending Table ──────────────────────────────────────────────── */}
      <div className="kpi-section-label" style={{ marginBottom: 12 }}>
        <span className="kpi-section-title">Pending Review</span>
      </div>
      <div className="panel" style={{ marginBottom: 28 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading…</div>
        ) : pending.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No documents pending review. All caught up.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Document Name</th><th>Type</th>
                  <th>Version</th><th>Uploaded By</th>
                  <th>Submitted</th><th>Remarks</th><th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((doc, i) => (
                  <tr key={doc.id}>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{doc.document_name}</td>
                    <td><span className={`badge badge-${TYPE_CLS[doc.document_type] || 'blue'}`}>{doc.document_type}</span></td>
                    <td><span className="badge badge-gray">{doc.version_no}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{doc.uploaded_by}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{fmt(doc.submitted_date)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{doc.remarks || '—'}</td>
                    <td>
                      <button className="btn btn-info btn-sm"
                        onClick={() => { setReviewModal(doc); setRemarks(''); }}>
                        Mark Reviewed
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── History ────────────────────────────────────────────────────── */}
      <div className="kpi-section-label" style={{ marginBottom: 12 }}>
        <span className="kpi-section-title">Review History</span>
      </div>
      <div className="panel">
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No reviewed documents yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Document Name</th><th>Type</th>
                  <th>Reviewed By</th><th>Reviewed Date</th><th>Approval Status</th>
                </tr>
              </thead>
              <tbody>
                {history.map((doc, i) => (
                  <tr key={doc.id}>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{doc.document_name}</td>
                    <td><span className={`badge badge-${TYPE_CLS[doc.document_type] || 'blue'}`}>{doc.document_type}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{doc.reviewed_by || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{fmt(doc.reviewed_date)}</td>
                    <td>
                      {doc.approval_status === 'Approved'
                        ? <span className="badge badge-green">Approved</span>
                        : doc.approval_status === 'Rejected'
                        ? <span className="badge badge-gray">Rejected</span>
                        : <span className="badge badge-orange">Pending Approval</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Review Modal ───────────────────────────────────────────────── */}
      {reviewModal && (
        <div className="modal-overlay" onClick={() => setReviewModal(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Mark as Reviewed</h2>
              <button className="modal-close" onClick={() => setReviewModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                <strong>{reviewModal.document_name}</strong>
              </p>
              <div className="form-group">
                <label className="form-label">Review Remarks (optional)</label>
                <textarea className="form-input" rows={3} value={remarks}
                  onChange={e => setRemarks(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-outline" onClick={() => setReviewModal(null)}>Cancel</button>
                <button className="btn btn-info" disabled={busy} onClick={handleReview}>
                  {busy ? 'Saving…' : 'Confirm Review'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
