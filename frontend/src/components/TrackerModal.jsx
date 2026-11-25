import React, { useState, useEffect, useRef } from 'react';
import ChecklistModal from './ChecklistModal';
import { SkeletonTable } from './Skeleton';
import {
  fetchTrackerColumns, addTrackerColumn, deleteTrackerColumn,
  fetchTrackerEntries, createTrackerEntry, updateTrackerEntry,
  deleteTrackerEntry, submitTrackerGroup, uploadTrackerEvidence,
} from '../services/api';

/* Maps common column label words → fixed DB field names (for legacy rows) */
const FIELD_MAP = {
  'host server': 'host_server', 'host': 'host_server', 'server': 'host_server',
  'service name': 'service_name', 'service / vm': 'service_name', 'service': 'service_name', 'vm': 'service_name',
  'ip address': 'ip_address', 'ip': 'ip_address',
  'backup type': 'backup_type', 'backup': 'backup_type',
  'responsible person': 'responsible_person', 'responsible': 'responsible_person',
  'planned date': 'planned_date', 'planned': 'planned_date',
  'actual date': 'actual_date', 'actual': 'actual_date',
  'activity': 'activity',
  'remarks': 'remarks',
};

function getCellValue(entry, colName) {
  if (entry.row_data && typeof entry.row_data === 'object') {
    return entry.row_data[colName] ?? '';
  }
  const key = FIELD_MAP[colName.toLowerCase()] ?? colName.toLowerCase().replace(/\s+/g, '_');
  return entry[key] ?? '';
}

function getServiceName(entry, columns) {
  if (entry.row_data && typeof entry.row_data === 'object') {
    for (const col of columns) {
      if (/service|vm/i.test(col.col_name)) return entry.row_data[col.col_name] || '';
    }
    const vals = Object.values(entry.row_data);
    return vals[0] || '';
  }
  return entry.service_name || '';
}

function StatusBadge({ status }) {
  const cls = status === 'Completed' ? 'badge-green' : status === 'Pending' ? 'badge-orange' : 'badge-blue';
  return <span className={`badge ${cls}`}>{status || 'In Progress'}</span>;
}

export default function TrackerModal({ groupName, onClose }) {
  const [columns, setColumns]         = useState([]);
  const [entries, setEntries]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const [newColName, setNewColName]   = useState('');
  const [addingRow, setAddingRow]     = useState(false);
  const [newRow, setNewRow]           = useState({});
  const [editingId, setEditingId]     = useState(null);
  const [editData, setEditData]       = useState({});
  const [submitting, setSubmitting]   = useState(false);
  const [checklistTarget, setChecklistTarget] = useState(null);
  const fileInputRef = useRef(null);
  const [uploadingId, setUploadingId] = useState(null);
  const newColRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [colRes, entRes] = await Promise.all([
        fetchTrackerColumns(groupName),
        fetchTrackerEntries(groupName),
      ]);
      setColumns(colRes.data);
      setEntries(entRes.data);
    } catch {
      setError('Failed to load tracker data');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [groupName]);

  const showMsg = (msg, isError = false) => {
    if (isError) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  /* ── Column management ─────────────────────────────────────────────────── */
  const handleAddCol = async () => {
    const name = newColName.trim();
    if (!name) return;
    try {
      await addTrackerColumn({ tracker_group: groupName, col_name: name });
      setNewColName('');
      newColRef.current?.focus();
      const colRes = await fetchTrackerColumns(groupName);
      setColumns(colRes.data);
    } catch (err) {
      showMsg(err.response?.data?.detail || 'Failed to add column', true);
    }
  };

  const handleDeleteCol = async (id) => {
    try {
      await deleteTrackerColumn(id);
      const colRes = await fetchTrackerColumns(groupName);
      setColumns(colRes.data);
    } catch {
      showMsg('Failed to delete column', true);
    }
  };

  /* ── Row management ────────────────────────────────────────────────────── */
  const handleAddRow = async () => {
    try {
      await createTrackerEntry({ tracker: groupName, row_data: newRow });
      setNewRow({});
      setAddingRow(false);
      await load();
      showMsg('Entry added');
    } catch (err) {
      showMsg(err.response?.data?.detail || 'Failed to add entry', true);
    }
  };

  const startEdit = (entry) => {
    setEditingId(entry.id);
    if (entry.row_data && typeof entry.row_data === 'object') {
      setEditData({ ...entry.row_data });
    } else {
      const d = {};
      columns.forEach(col => { d[col.col_name] = getCellValue(entry, col.col_name); });
      setEditData(d);
    }
  };

  const saveEdit = async () => {
    try {
      const entry = entries.find(e => e.id === editingId);
      if (entry?.row_data != null) {
        await updateTrackerEntry(editingId, { row_data: editData });
      } else {
        await updateTrackerEntry(editingId, editData);
      }
      setEditingId(null);
      await load();
      showMsg('Entry updated');
    } catch (err) {
      showMsg(err.response?.data?.detail || 'Update failed', true);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this entry?')) return;
    try {
      await deleteTrackerEntry(id);
      await load();
      showMsg('Entry deleted');
    } catch (err) {
      showMsg(err.response?.data?.detail || 'Delete failed', true);
    }
  };

  /* ── Submit ────────────────────────────────────────────────────────────── */
  const handleSubmit = async () => {
    if (!window.confirm(`Submit all In-Progress entries in "${groupName}" for approval?`)) return;
    setSubmitting(true);
    try {
      const res = await submitTrackerGroup(groupName);
      await load();
      showMsg(res.data.message);
    } catch (err) {
      showMsg(err.response?.data?.detail || 'Submit failed', true);
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Evidence ──────────────────────────────────────────────────────────── */
  const triggerUpload = (id) => { setUploadingId(id); fileInputRef.current.click(); };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await uploadTrackerEvidence(uploadingId, fd);
      await load();
      showMsg('Evidence uploaded — entry submitted for approval');
    } catch {
      showMsg('Upload failed', true);
    }
    e.target.value = '';
    setUploadingId(null);
  };

  const hasInProgress = entries.some(e => !['Pending', 'Completed'].includes(e.status));
  const totalCols = columns.length + 5; // # + cols + Status + Evidence + Checklist + Actions

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">

        {/* Header */}
        <div className="modal-header">
          <div>
            <h2>{groupName}</h2>
            <p className="modal-subtitle">
              {entries.length} entries &nbsp;|&nbsp;
              <span className="badge badge-green">{entries.filter(e => e.status === 'Completed').length} Completed</span>{' '}
              <span className="badge badge-orange">{entries.filter(e => e.status === 'Pending').length} Pending</span>
            </p>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {error   && <div className="alert alert-error   mx-modal">{error}</div>}
        {success && <div className="alert alert-success mx-modal">{success}</div>}

        {/* ── Section 1: Column Setup ─────────────────────────────────────── */}
        <div className="col-setup-bar">
          <span className="col-setup-label">
            <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/>
              <line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
            Columns
          </span>
          <div className="col-chips">
            {columns.map(col => (
              <span className="col-chip" key={col.id}>
                {col.col_name}
                <button className="col-chip-del" onClick={() => handleDeleteCol(col.id)} title="Remove column">×</button>
              </span>
            ))}
            <div className="col-add-inline">
              <input
                ref={newColRef}
                className="col-add-input"
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddCol()}
                placeholder="Add column…"
              />
              <button className="col-add-btn" onClick={handleAddCol}>+</button>
            </div>
          </div>
        </div>

        {/* ── Section 2: Toolbar ──────────────────────────────────────────── */}
        <div className="modal-toolbar">
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setAddingRow(true)}
            disabled={columns.length === 0 || addingRow}
          >
            + Add Entry
          </button>
          <button
            className="btn btn-success btn-sm"
            onClick={handleSubmit}
            disabled={!hasInProgress || submitting}
          >
            {submitting ? 'Submitting…' : 'Submit for Approval'}
          </button>
          {columns.length === 0 && (
            <span className="hint-text">Define columns above to start adding entries</span>
          )}
        </div>

        <input type="file" ref={fileInputRef} style={{ display:'none' }} onChange={handleFileChange} />

        {/* ── Section 3: Data Table ───────────────────────────────────────── */}
        {loading ? (
          <div className="modal-table" style={{ overflowX:'auto' }}>
            <SkeletonTable cols={6} rows={5} />
          </div>
        ) : columns.length === 0 ? (
          <div className="empty-state" style={{ padding:'48px 24px' }}>
            <div className="empty-icon">
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
                <line x1="9" y1="3" x2="9" y2="21"/>
              </svg>
            </div>
            <h3>No Columns Defined</h3>
            <p>Type a column name above and press Enter or click + to add your first column</p>
          </div>
        ) : (
          <div className="table-wrapper modal-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="col-no">#</th>
                  {columns.map(col => <th key={col.id}>{col.col_name}</th>)}
                  <th>Status</th>
                  <th>Evidence</th>
                  <th>Checklist</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>

                {/* Add row */}
                {addingRow && (
                  <tr className="add-row">
                    <td className="col-no">*</td>
                    {columns.map(col => (
                      <td key={col.id}>
                        <input
                          className="inline-input"
                          value={newRow[col.col_name] || ''}
                          onChange={e => setNewRow(r => ({ ...r, [col.col_name]: e.target.value }))}
                          placeholder={col.col_name}
                        />
                      </td>
                    ))}
                    <td><span className="badge badge-blue">In Progress</span></td>
                    <td>—</td>
                    <td>—</td>
                    <td>
                      <button className="btn btn-primary btn-xs" onClick={handleAddRow}>Save</button>
                      <button className="btn btn-outline btn-xs" onClick={() => { setAddingRow(false); setNewRow({}); }}>Cancel</button>
                    </td>
                  </tr>
                )}

                {entries.length === 0 && !addingRow && (
                  <tr><td colSpan={totalCols} className="empty-row">No entries yet. Click "+ Add Entry" to begin.</td></tr>
                )}

                {entries.map((entry, idx) => (
                  <tr key={entry.id} className={editingId === entry.id ? 'editing-row' : ''}>
                    <td className="col-no">{idx + 1}</td>

                    {editingId === entry.id ? (
                      columns.map(col => (
                        <td key={col.id}>
                          <input
                            className="inline-input"
                            value={editData[col.col_name] || ''}
                            onChange={e => setEditData(d => ({ ...d, [col.col_name]: e.target.value }))}
                          />
                        </td>
                      ))
                    ) : (
                      columns.map(col => (
                        <td key={col.id} className="cell-secondary">
                          {getCellValue(entry, col.col_name) || <span className="cell-muted">—</span>}
                        </td>
                      ))
                    )}

                    <td><StatusBadge status={entry.status} /></td>

                    <td>
                      <div style={{ display:'flex', flexDirection:'column', gap:'4px', alignItems:'flex-start' }}>
                        {entry.evidence && entry.evidence.startsWith('uploads/') ? (
                          <a href={`${process.env.REACT_APP_API_URL}/${entry.evidence}`} target="_blank" rel="noreferrer" className="link-btn">View</a>
                        ) : entry.evidence ? (
                          <span style={{ fontSize:'.72rem', color:'var(--text-muted)', background:'#f1f5f9', padding:'2px 7px', borderRadius:'4px', maxWidth:'100px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }} title={entry.evidence}>{entry.evidence}</span>
                        ) : null}
                        <button className="btn btn-outline btn-xs" style={{ fontSize:'.7rem', padding:'3px 8px' }} onClick={() => triggerUpload(entry.id)}>
                          {entry.evidence ? '↑ Replace' : '↑ Upload'}
                        </button>
                      </div>
                    </td>

                    <td>
                      <button className="btn btn-info btn-xs" onClick={() => setChecklistTarget({ serviceName: getServiceName(entry, columns), groupName })}>
                        Checklist
                      </button>
                    </td>

                    <td>
                      {editingId === entry.id ? (
                        <>
                          <button className="btn btn-success btn-xs" onClick={saveEdit}>Save</button>
                          <button className="btn btn-outline btn-xs" onClick={() => setEditingId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-warning btn-xs" onClick={() => startEdit(entry)}>Edit</button>
                          <button className="btn btn-danger btn-xs" onClick={() => handleDelete(entry.id)}>Delete</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Close</button>
        </div>
      </div>

      {checklistTarget && (
        <ChecklistModal
          serviceName={checklistTarget.serviceName}
          groupName={checklistTarget.groupName}
          onClose={() => setChecklistTarget(null)}
        />
      )}
    </div>
  );
}
