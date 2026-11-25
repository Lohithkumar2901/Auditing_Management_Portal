import React, { useState, useEffect, useRef } from 'react';
import { SkeletonTable } from './Skeleton';
import {
  fetchChecklistColumns, addChecklistColumn, deleteChecklistColumn,
  fetchChecklistItems, createChecklistItem, updateChecklistItem,
  deleteChecklistItem, uploadChecklistEvidence,
} from '../services/api';

const CL_FIELD_MAP = {
  'step': 'step', 'step description': 'step', 'description': 'step',
  'method': 'method', 'method / command': 'method', 'command': 'method',
  'expected result': 'expected_result', 'expected': 'expected_result',
  'start time': 'start_time', 'start': 'start_time',
  'end time': 'end_time', 'end': 'end_time',
  'remarks': 'remarks',
};

function getCLValue(item, colName) {
  if (item.row_data && typeof item.row_data === 'object') {
    return item.row_data[colName] ?? '';
  }
  const key = CL_FIELD_MAP[colName.toLowerCase()] ?? colName.toLowerCase().replace(/\s+/g, '_');
  return item[key] ?? '';
}

function StatusBadge({ status }) {
  if (status === 'Completed') return <span className="badge badge-green">Completed</span>;
  return <span className="badge badge-orange">Pending</span>;
}

export default function ChecklistModal({ serviceName, groupName, onClose }) {
  const [columns, setColumns]         = useState([]);
  const [items, setItems]             = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [success, setSuccess]         = useState('');
  const [newColName, setNewColName]   = useState('');
  const [addingRow, setAddingRow]     = useState(false);
  const [newRow, setNewRow]           = useState({});
  const [editingId, setEditingId]     = useState(null);
  const [editData, setEditData]       = useState({});
  const fileInputRef = useRef(null);
  const [uploadingId, setUploadingId] = useState(null);
  const newColRef = useRef(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [colRes, itemRes] = await Promise.all([
        fetchChecklistColumns(serviceName),
        fetchChecklistItems(serviceName),
      ]);
      setColumns(colRes.data);
      setItems(itemRes.data);
    } catch {
      setError('Failed to load checklist data');
    } finally {
      setLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [serviceName]);

  const showMsg = (msg, isError = false) => {
    if (isError) setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  /* ── Columns ────────────────────────────────────────────────────────────── */
  const handleAddCol = async () => {
    const name = newColName.trim();
    if (!name) return;
    try {
      await addChecklistColumn({ checklist_group: serviceName, col_name: name });
      setNewColName('');
      newColRef.current?.focus();
      const colRes = await fetchChecklistColumns(serviceName);
      setColumns(colRes.data);
    } catch (err) {
      showMsg(err.response?.data?.detail || 'Failed to add column', true);
    }
  };

  const handleDeleteCol = async (id) => {
    try {
      await deleteChecklistColumn(id);
      const colRes = await fetchChecklistColumns(serviceName);
      setColumns(colRes.data);
    } catch {
      showMsg('Failed to delete column', true);
    }
  };

  /* ── Rows ───────────────────────────────────────────────────────────────── */
  const handleAddRow = async () => {
    try {
      await createChecklistItem({ checklist: serviceName, row_data: newRow });
      setNewRow({});
      setAddingRow(false);
      await load();
      showMsg('Item added');
    } catch (err) {
      showMsg(err.response?.data?.detail || 'Failed to add item', true);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    if (item.row_data && typeof item.row_data === 'object') {
      setEditData({ ...item.row_data });
    } else {
      const d = {};
      columns.forEach(col => { d[col.col_name] = getCLValue(item, col.col_name); });
      setEditData(d);
    }
  };

  const saveEdit = async () => {
    try {
      const item = items.find(i => i.id === editingId);
      if (item?.row_data != null) {
        await updateChecklistItem(editingId, { row_data: editData });
      } else {
        await updateChecklistItem(editingId, editData);
      }
      setEditingId(null);
      await load();
      showMsg('Item updated');
    } catch (err) {
      showMsg(err.response?.data?.detail || 'Update failed', true);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this checklist item?')) return;
    try {
      await deleteChecklistItem(id);
      await load();
      showMsg('Item deleted');
    } catch (err) {
      showMsg(err.response?.data?.detail || 'Delete failed', true);
    }
  };

  /* ── Evidence ───────────────────────────────────────────────────────────── */
  const triggerUpload = (id) => { setUploadingId(id); fileInputRef.current.click(); };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    try {
      await uploadChecklistEvidence(uploadingId, fd);
      await load();
      showMsg('Evidence uploaded → status set to Completed');
    } catch {
      showMsg('Upload failed', true);
    }
    e.target.value = '';
    setUploadingId(null);
  };

  const completedCount = items.filter(i => i.status === 'Completed').length;
  const totalCols = columns.length + 4; // # + cols + Status + Evidence + Actions

  return (
    <div className="modal-overlay modal-overlay-front" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">

        {/* Header */}
        <div className="modal-header modal-header-teal">
          <div>
            <h2>Checklist: {serviceName}</h2>
            <p className="modal-subtitle">
              {items.length} items &nbsp;|&nbsp;
              <span className="badge badge-green">{completedCount} Completed</span>{' '}
              <span className="badge badge-orange">{items.length - completedCount} Pending</span>
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
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/>
              <line x1="9" y1="3" x2="9" y2="21"/>
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
            + Add Step
          </button>
          {columns.length === 0 && (
            <span className="hint-text">Define columns above to start adding checklist steps</span>
          )}
        </div>

        <input type="file" ref={fileInputRef} style={{ display:'none' }} onChange={handleFileChange} />

        {/* ── Section 3: Data Table ───────────────────────────────────────── */}
        {loading ? (
          <div className="modal-table" style={{ overflowX:'auto' }}>
            <SkeletonTable cols={5} rows={4} />
          </div>
        ) : columns.length === 0 ? (
          <div className="empty-state" style={{ padding:'48px 24px' }}>
            <div className="empty-icon">
              <svg width="32" height="32" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                <polyline points="9 11 12 14 22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
            </div>
            <h3>No Columns Defined</h3>
            <p>Type a column name above and press Enter or click + to build your checklist structure</p>
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
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>

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
                    <td><span className="badge badge-orange">Pending</span></td>
                    <td>—</td>
                    <td>
                      <button className="btn btn-primary btn-xs" onClick={handleAddRow}>Save</button>
                      <button className="btn btn-outline btn-xs" onClick={() => { setAddingRow(false); setNewRow({}); }}>Cancel</button>
                    </td>
                  </tr>
                )}

                {items.length === 0 && !addingRow && (
                  <tr><td colSpan={totalCols} className="empty-row">No checklist items yet. Click "+ Add Step" to begin.</td></tr>
                )}

                {items.map((item, idx) => (
                  <tr key={item.id} className={item.status === 'Completed' ? 'completed-row' : ''}>
                    <td className="col-no">{idx + 1}</td>

                    {editingId === item.id ? (
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
                          {getCLValue(item, col.col_name) || <span className="cell-muted">—</span>}
                        </td>
                      ))
                    )}

                    <td><StatusBadge status={item.status} /></td>

                    <td>
                      <div style={{ display:'flex', flexDirection:'column', gap:'4px', alignItems:'flex-start' }}>
                        {item.evidence && item.evidence.startsWith('uploads/') ? (
                          <a href={`${process.env.REACT_APP_API_URL}/${item.evidence}`} target="_blank" rel="noreferrer" className="link-btn">View</a>
                        ) : item.evidence ? (
                          <span style={{ fontSize:'.72rem', color:'var(--text-muted)', background:'#f1f5f9', padding:'2px 7px', borderRadius:'4px', maxWidth:'90px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', display:'block' }} title={item.evidence}>{item.evidence}</span>
                        ) : null}
                        <button className="btn btn-outline btn-xs" style={{ fontSize:'.7rem', padding:'3px 8px' }} onClick={() => triggerUpload(item.id)}>
                          {item.evidence ? '↑ Replace' : '↑ Upload'}
                        </button>
                      </div>
                    </td>

                    <td>
                      {editingId === item.id ? (
                        <>
                          <button className="btn btn-success btn-xs" onClick={saveEdit}>Save</button>
                          <button className="btn btn-outline btn-xs" onClick={() => setEditingId(null)}>Cancel</button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-warning btn-xs" onClick={() => startEdit(item)}>Edit</button>
                          <button className="btn btn-danger btn-xs" onClick={() => handleDelete(item.id)}>Delete</button>
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
    </div>
  );
}
