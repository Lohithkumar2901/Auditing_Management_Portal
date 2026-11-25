import React, { useEffect, useState, useCallback } from 'react';
import {
  fetchDocuments, createDocument, updateDocument, deleteDocument,
  submitDocForReview, reviewDocument, approveDocument, rejectDocument,
} from '../services/api';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || '';
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-IN') : '—');

/* ── Icons ────────────────────────────────────────────────────────────────── */
const IcoTotal    = () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>;
const IcoClock    = () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
const IcoSend     = () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>;
const IcoCheck    = () => <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>;
const IcoSearch   = () => <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="6.5" cy="6.5" r="5"/><path d="M11 11l3 3"/></svg>;
const IcoUpload   = () => <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>;

/* ── Status badge ─────────────────────────────────────────────────────────── */
const StatusBadge = ({ doc }) => {
  if (doc.approval_status === 'Approved') return <span className="badge badge-green">Approved</span>;
  if (doc.approval_status === 'Rejected') return <span className="badge badge-gray">Rejected</span>;
  if (doc.review_status   === 'Reviewed') return <span className="badge badge-orange">Reviewed</span>;
  return <span className="badge badge-red">Pending Review</span>;
};

const KPI_DEFS = [
  { id: 'all',      label: 'All Documents',     icon: <IcoTotal />,  cls: 'blue',   accentColor: '#3b82f6' },
  { id: 'pending',  label: 'Pending Review',     icon: <IcoClock />,  cls: 'red',    accentColor: '#ef4444' },
  { id: 'reviewed', label: 'Pending Approval',   icon: <IcoSend />,   cls: 'purple', accentColor: '#a855f7' },
  { id: 'approved', label: 'Approved',           icon: <IcoCheck />,  cls: 'green',  accentColor: '#22c55e' },
];

const EMPTY = { document_name: '', version_no: 'v1', remarks: '', file: null };

export default function DocumentPage({ title, docType }) {
  const { user } = useAuth();

  const [docs,         setDocs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [activeKpi,    setActiveKpi]    = useState('all');
  const [search,       setSearch]       = useState('');
  const [showUpload,   setShowUpload]   = useState(false);
  const [editDoc,      setEditDoc]      = useState(null);
  const [viewDoc,      setViewDoc]      = useState(null);
  const [actionModal,  setActionModal]  = useState(null);
  const [actionRmk,    setActionRmk]    = useState('');
  const [form,         setForm]         = useState(EMPTY);
  const [msg,          setMsg]          = useState(null);
  const [busy,         setBusy]         = useState(false);
  const [preview,      setPreview]      = useState(null); // { name, url, type, loading }

  const flash = (text, type = 'success') => { setMsg({ text, type }); setTimeout(() => setMsg(null), 4000); };

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await fetchDocuments({ doc_type: docType }); setDocs(data); }
    catch (_) {}
    setLoading(false);
  }, [docType]);

  useEffect(() => { load(); }, [load]);

  /* ── KPI counts ─────────────────────────────────────────────────────────── */
  const kpiValues = {
    all:      docs.length,
    pending:  docs.filter(d => d.review_status === 'Pending').length,
    reviewed: docs.filter(d => d.review_status === 'Reviewed' && d.approval_status === 'Pending').length,
    approved: docs.filter(d => d.approval_status === 'Approved').length,
  };

  /* ── Filtered list ──────────────────────────────────────────────────────── */
  const filtered = docs.filter(d => {
    const matchKpi =
      activeKpi === 'all'      ? true :
      activeKpi === 'pending'  ? d.review_status === 'Pending' :
      activeKpi === 'reviewed' ? (d.review_status === 'Reviewed' && d.approval_status === 'Pending') :
      activeKpi === 'approved' ? d.approval_status === 'Approved' : true;
    return matchKpi && d.document_name.toLowerCase().includes(search.toLowerCase());
  });

  /* ── Handlers ───────────────────────────────────────────────────────────── */
  const handleUpload = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData();
      fd.append('document_name', form.document_name);
      fd.append('document_type', docType);
      fd.append('version_no',    form.version_no);
      if (form.remarks) fd.append('remarks', form.remarks);
      if (form.file)    fd.append('file',    form.file);
      await createDocument(fd);
      flash('Document uploaded successfully.');
      setShowUpload(false); setForm(EMPTY); load();
    } catch (err) { flash(err.response?.data?.detail || 'Upload failed.', 'error'); }
    setBusy(false);
  };

  const handleEdit = async (e) => {
    e.preventDefault(); setBusy(true);
    try {
      const fd = new FormData();
      fd.append('document_name', form.document_name);
      fd.append('version_no',    form.version_no);
      if (form.remarks) fd.append('remarks', form.remarks);
      await updateDocument(editDoc.id, fd);
      flash('Document updated.'); setEditDoc(null); load();
    } catch (err) { flash(err.response?.data?.detail || 'Update failed.', 'error'); }
    setBusy(false);
  };

  const handleDelete = async (doc) => {
    if (!window.confirm(`Delete "${doc.document_name}"?`)) return;
    try { await deleteDocument(doc.id); flash('Document deleted.'); load(); }
    catch (err) { flash(err.response?.data?.detail || 'Delete failed.', 'error'); }
  };

  const handleSubmit = async (doc) => {
    try { await submitDocForReview(doc.id); flash('Submitted for review.'); load(); }
    catch (err) { flash(err.response?.data?.detail || 'Submit failed.', 'error'); }
  };

  const handleAction = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      if (actionRmk) fd.append('remarks', actionRmk);
      if (actionModal.type === 'review')  await reviewDocument(actionModal.doc.id, fd);
      if (actionModal.type === 'approve') await approveDocument(actionModal.doc.id, fd);
      if (actionModal.type === 'reject')  await rejectDocument(actionModal.doc.id, fd);
      flash(`Document ${actionModal.type}d successfully.`);
      setActionModal(null); setActionRmk(''); load();
    } catch (err) { flash(err.response?.data?.detail || 'Action failed.', 'error'); }
    setBusy(false);
  };

  const fileUrl = (p) => p ? `${API_URL}/doc-files${p.replace('/data/files/documents', '')}` : null;
  const isAuditor = user?.role === 'auditor';
  const canEdit   = !isAuditor && (user?.role === 'technician' || user?.role === 'admin');
  const canReview = !isAuditor && (user?.role === 'reviewer'   || user?.role === 'admin');

  const openPreview = (doc) => {
    const token = localStorage.getItem('drill_token');
    const base  = api.defaults.baseURL || '';
    const url   = `${base}/documents/${doc.id}/view?token=${encodeURIComponent(token)}`;
    setPreview({ name: doc.document_name, url });
  };

  const closePreview = () => setPreview(null);

  return (
    <div className="page-content">
      {msg && <div className={`alert alert-${msg.type === 'error' ? 'error' : 'success'}`}>{msg.text}</div>}

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2>{title}</h2>
          <p>{docType} document lifecycle — upload · review · approve · publish</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => { setForm(EMPTY); setShowUpload(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <IcoUpload /> Upload Document
          </button>
        )}
      </div>

      {/* ── KPI Cards (same style as drill dashboard) ─────────────────── */}
      <div className="summary-cards" style={{ marginBottom: 24 }}>
        {KPI_DEFS.map((k, i) => (
          <button
            key={k.id}
            className={`summary-card kpi-card ${activeKpi === k.id ? 'kpi-card-active' : ''}`}
            style={{ animationDelay: `${i * 70}ms`, '--kpi-color': k.accentColor }}
            onClick={() => setActiveKpi(k.id)}
          >
            <div className={`summary-icon ${k.cls}`}>{k.icon}</div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div className="summary-value">{loading ? '—' : kpiValues[k.id]}</div>
              <div className="summary-label">{k.label}</div>
            </div>
            {activeKpi === k.id && <div className="kpi-active-dot" />}
          </button>
        ))}
      </div>

      {/* ── Active KPI label ─────────────────────────────────────────────── */}
      <div className="kpi-section-label" style={{ marginBottom: 14 }}>
        <span className="kpi-section-title">
          {KPI_DEFS.find(k => k.id === activeKpi)?.label}
        </span>
        <span className="kpi-section-hint">
          — {filtered.length} document{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Search ───────────────────────────────────────────────────────── */}
      <div className="table-toolbar">
        <div className="table-toolbar__search">
          <IcoSearch />
          <input placeholder={`Search ${title.toLowerCase()}…`} value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────── */}
      <div className="panel">
        {loading ? (
          <div className="panel-empty">Loading documents…</div>
        ) : filtered.length === 0 ? (
          <div className="panel-empty">
            <svg width="40" height="40" fill="none" stroke="#cbd5e1" strokeWidth="1.5" style={{ marginBottom: 10 }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            No documents found
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: 40 }}>#</th>
                  <th>Document Name</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Uploaded By</th>
                  <th>Uploaded</th>
                  <th>Submitted</th>
                  <th>Reviewed</th>
                  <th>Approved</th>
                  <th>File</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((doc, i) => (
                  <tr key={doc.id}>
                    <td className="td-muted">{i + 1}</td>
                    <td><button className="doc-name-btn" onClick={() => setViewDoc(doc)}>{doc.document_name}</button></td>
                    <td><span className="badge badge-gray">{doc.version_no}</span></td>
                    <td><StatusBadge doc={doc} /></td>
                    <td className="td-muted">{doc.uploaded_by}</td>
                    <td className="td-muted">{fmt(doc.uploaded_date)}</td>
                    <td className="td-muted">{fmt(doc.submitted_date)}</td>
                    <td className="td-muted">{fmt(doc.reviewed_date)}</td>
                    <td className="td-muted">{fmt(doc.approval_date)}</td>
                    <td>
                      {doc.file_path && (
                        <button className="btn btn-outline btn-xs" onClick={() => openPreview(doc)}>
                          View
                        </button>
                      )}
                    </td>
                    <td>
                      <div className="action-group">
                        {canEdit && <>
                          <button className="btn btn-outline btn-xs" onClick={() => { setForm({ document_name: doc.document_name, version_no: doc.version_no || 'v1', remarks: doc.remarks || '', file: null }); setEditDoc(doc); }}>Edit</button>
                          <button className="btn btn-danger btn-xs" onClick={() => handleDelete(doc)}>Delete</button>
                          {doc.review_status !== 'Reviewed' && doc.approval_status !== 'Approved' && (
                            <button className="btn btn-warning btn-xs" onClick={() => handleSubmit(doc)}>Submit</button>
                          )}
                        </>}
                        {canReview && doc.review_status === 'Pending' && (
                          <button className="btn btn-info btn-xs" onClick={() => { setActionModal({ type: 'review', doc }); setActionRmk(''); }}>Review</button>
                        )}
                        {user?.role === 'admin' && doc.review_status === 'Reviewed' && doc.approval_status === 'Pending' && <>
                          <button className="btn btn-success btn-xs" onClick={() => { setActionModal({ type: 'approve', doc }); setActionRmk(''); }}>Approve</button>
                          <button className="btn btn-danger btn-xs"  onClick={() => { setActionModal({ type: 'reject',  doc }); setActionRmk(''); }}>Reject</button>
                        </>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ════════════════════ MODALS ════════════════════════════════════ */}

      {/* Upload */}
      {showUpload && (
        <div className="modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Upload Document</h2>
                <p className="modal-subtitle">{title} · {docType}</p>
              </div>
              <button className="modal-close" onClick={() => setShowUpload(false)}>✕</button>
            </div>
            <form onSubmit={handleUpload}>
              <div className="modal-body mf">
                <div className="mf-group">
                  <label className="mf-label">Document Name *</label>
                  <input required className="form-input" value={form.document_name} onChange={e => setForm({ ...form, document_name: e.target.value })} placeholder="e.g. Information Security Policy" />
                </div>
                <div className="mf-row">
                  <div className="mf-group">
                    <label className="mf-label">Version</label>
                    <input className="form-input" value={form.version_no} onChange={e => setForm({ ...form, version_no: e.target.value })} placeholder="v1" />
                  </div>
                  <div className="mf-group" style={{ flex: 1 }}>
                    <label className="mf-label">Document Type</label>
                    <input className="form-input" value={docType} disabled style={{ opacity: .6 }} />
                  </div>
                </div>
                <div className="mf-group">
                  <label className="mf-label">Remarks</label>
                  <textarea className="form-input" rows={3} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} placeholder="Optional notes…" />
                </div>
                <div className="mf-group">
                  <label className="mf-label">Attach File &nbsp;<span className="mf-hint">PDF · DOCX · XLSX · PPTX</span></label>
                  <input type="file" className="form-input file-input" accept=".pdf,.docx,.xlsx,.pptx" onChange={e => setForm({ ...form, file: e.target.files[0] })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowUpload(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Uploading…' : 'Upload Document'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit */}
      {editDoc && (
        <div className="modal-overlay" onClick={() => setEditDoc(null)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Edit Document</h2>
                <p className="modal-subtitle">{editDoc.document_name}</p>
              </div>
              <button className="modal-close" onClick={() => setEditDoc(null)}>✕</button>
            </div>
            <form onSubmit={handleEdit}>
              <div className="modal-body mf">
                <div className="mf-group">
                  <label className="mf-label">Document Name</label>
                  <input className="form-input" value={form.document_name} onChange={e => setForm({ ...form, document_name: e.target.value })} />
                </div>
                <div className="mf-group">
                  <label className="mf-label">Version</label>
                  <input className="form-input" value={form.version_no} onChange={e => setForm({ ...form, version_no: e.target.value })} />
                </div>
                <div className="mf-group">
                  <label className="mf-label">Remarks</label>
                  <textarea className="form-input" rows={3} value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setEditDoc(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail view */}
      {viewDoc && (
        <div className="modal-overlay" onClick={() => setViewDoc(null)}>
          <div className="modal modal-md" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>{viewDoc.document_name}</h2>
                <p className="modal-subtitle">
                  <span className="badge badge-blue" style={{ fontSize: '.68rem' }}>{viewDoc.document_type}</span>
                  &nbsp;·&nbsp; Version {viewDoc.version_no}
                  &nbsp;·&nbsp; <StatusBadge doc={viewDoc} />
                </p>
              </div>
              <button className="modal-close" onClick={() => setViewDoc(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                {[
                  ['Review Status',  viewDoc.review_status],
                  ['Approval Status',viewDoc.approval_status],
                  ['Visibility',     viewDoc.visibility_status],
                  ['Uploaded By',    viewDoc.uploaded_by],
                  ['Uploaded Date',  fmt(viewDoc.uploaded_date)],
                  ['Submitted Date', fmt(viewDoc.submitted_date)],
                  ['Reviewed By',    viewDoc.reviewed_by || '—'],
                  ['Reviewed Date',  fmt(viewDoc.reviewed_date)],
                  ['Approved By',    viewDoc.approved_by || '—'],
                  ['Approval Date',  fmt(viewDoc.approval_date)],
                ].map(([l, v]) => (
                  <div key={l} className="detail-row">
                    <span className="detail-label">{l}</span>
                    <span className="detail-value">{v}</span>
                  </div>
                ))}
                {viewDoc.remarks && (
                  <div className="detail-row detail-row--full">
                    <span className="detail-label">Remarks</span>
                    <span className="detail-value">{viewDoc.remarks}</span>
                  </div>
                )}
              </div>
              {viewDoc.file_path && (
                <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                  <button className="btn btn-primary" onClick={() => { setViewDoc(null); openPreview(viewDoc); }}>
                    Open File
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── File Preview Modal ──────────────────────────────────────────── */}
      {preview && (
        <div className="modal-overlay" onClick={closePreview}>
          <div className="modal fp-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Document Preview</h2>
                <p className="modal-subtitle">{preview.name}</p>
              </div>
              <button className="modal-close" onClick={closePreview}>✕</button>
            </div>
            <div className="fp-body">
              <iframe
                src={preview.url}
                title={preview.name}
                className="fp-frame"
              />
            </div>
          </div>
        </div>
      )}

      {/* Action (review / approve / reject) */}
      {actionModal && (
        <div className="modal-overlay" onClick={() => setActionModal(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className={`modal-header ${actionModal.type === 'approve' ? 'modal-header-teal' : ''}`}>
              <div>
                <h2 style={{ textTransform: 'capitalize' }}>{actionModal.type} Document</h2>
                <p className="modal-subtitle">{actionModal.doc.document_name}</p>
              </div>
              <button className="modal-close" onClick={() => setActionModal(null)}>✕</button>
            </div>
            <div className="modal-body mf">
              <div className="mf-group">
                <label className="mf-label">
                  Remarks {actionModal.type === 'reject' ? <span style={{ color: '#ef4444' }}>*</span> : <span className="mf-hint">(optional)</span>}
                </label>
                <textarea className="form-input" rows={4} value={actionRmk} onChange={e => setActionRmk(e.target.value)}
                  placeholder={actionModal.type === 'reject' ? 'Provide rejection reason…' : 'Add notes if any…'} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setActionModal(null)}>Cancel</button>
              <button
                className={actionModal.type === 'approve' ? 'btn btn-success' : actionModal.type === 'reject' ? 'btn btn-danger' : 'btn btn-info'}
                disabled={busy || (actionModal.type === 'reject' && !actionRmk)}
                onClick={handleAction}
              >
                {busy ? 'Processing…' : actionModal.type === 'approve' ? 'Approve & Publish' : actionModal.type === 'reject' ? 'Reject Document' : 'Confirm Review'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
