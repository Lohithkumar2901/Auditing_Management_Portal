import React, { useEffect, useState, useCallback } from 'react';
import { fetchDocuments, approveDocument, rejectDocument } from '../services/api';

function fmt(d) { return d ? new Date(d).toLocaleDateString('en-IN') : '—'; }

const TYPE_CLS = { POLICY: 'blue', PROCEDURE: 'purple', SOP: 'cyan', FORMAT: 'orange', TRAINING: 'green' };

export default function AdminDocuments() {
  const [pending, setPending]         = useState([]);
  const [history, setHistory]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [actionModal, setActionModal] = useState(null);
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
      const [pendRes, histRes] = await Promise.all([
        fetchDocuments({ review_status: 'Reviewed', approval_status: 'Pending' }),
        fetchDocuments({ approval_status: 'Approved' }),
      ]);
      setPending(pendRes.data);
      setHistory(histRes.data);
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAction = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      if (remarks) fd.append('remarks', remarks);
      if (actionModal.type === 'approve') await approveDocument(actionModal.doc.id, fd);
      if (actionModal.type === 'reject')  await rejectDocument(actionModal.doc.id, fd);
      flash(`Document ${actionModal.type}d successfully.`);
      setActionModal(null);
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
        <h2>Document Approvals</h2>
        <p>Reviewed documents awaiting final admin approval and publication</p>
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
            <div className="summary-label">Awaiting Approval</div>
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
            <div className="summary-label">Total Approved</div>
          </div>
        </div>
      </div>

      {/* ── Awaiting Approval ──────────────────────────────────────────── */}
      <div className="kpi-section-label" style={{ marginBottom: 12 }}>
        <span className="kpi-section-title">Awaiting Approval</span>
      </div>
      <div className="panel" style={{ marginBottom: 28 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Loading…</div>
        ) : pending.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No documents awaiting approval.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Document Name</th><th>Type</th>
                  <th>Version</th><th>Uploaded By</th>
                  <th>Reviewed By</th><th>Reviewed Date</th>
                  <th>Remarks</th><th>Actions</th>
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
                    <td style={{ color: 'var(--text-secondary)' }}>{doc.reviewed_by || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{fmt(doc.reviewed_date)}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{doc.remarks || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-success btn-sm"
                          onClick={() => { setActionModal({ type: 'approve', doc }); setRemarks(''); }}>
                          Approve
                        </button>
                        <button className="btn btn-danger btn-sm"
                          onClick={() => { setActionModal({ type: 'reject', doc }); setRemarks(''); }}>
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Approval History ───────────────────────────────────────────── */}
      <div className="kpi-section-label" style={{ marginBottom: 12 }}>
        <span className="kpi-section-title">Approval History</span>
      </div>
      <div className="panel">
        {history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>No approved documents yet.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th><th>Document Name</th><th>Type</th>
                  <th>Approved By</th><th>Approval Date</th><th>Visibility</th>
                </tr>
              </thead>
              <tbody>
                {history.map((doc, i) => (
                  <tr key={doc.id}>
                    <td style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{i + 1}</td>
                    <td style={{ fontWeight: 500 }}>{doc.document_name}</td>
                    <td><span className={`badge badge-${TYPE_CLS[doc.document_type] || 'blue'}`}>{doc.document_type}</span></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{doc.approved_by || '—'}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{fmt(doc.approval_date)}</td>
                    <td>
                      {doc.visibility_status === 'Visible'
                        ? <span className="badge badge-green">Visible</span>
                        : <span className="badge badge-gray">Hidden</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Action Modal ───────────────────────────────────────────────── */}
      {actionModal && (
        <div className="modal-overlay" onClick={() => setActionModal(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ textTransform: 'capitalize' }}>{actionModal.type} Document</h2>
              <button className="modal-close" onClick={() => setActionModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
                <strong>{actionModal.doc.document_name}</strong>
              </p>
              <div className="form-group">
                <label className="form-label">Remarks {actionModal.type === 'reject' ? '(required)' : '(optional)'}</label>
                <textarea className="form-input" rows={3} value={remarks}
                  onChange={e => setRemarks(e.target.value)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                <button className="btn btn-outline" onClick={() => setActionModal(null)}>Cancel</button>
                <button
                  className={actionModal.type === 'approve' ? 'btn btn-success' : 'btn btn-danger'}
                  disabled={busy || (actionModal.type === 'reject' && !remarks)}
                  onClick={handleAction}
                >
                  {busy ? 'Processing…' : actionModal.type === 'approve' ? 'Approve & Publish' : 'Reject'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
