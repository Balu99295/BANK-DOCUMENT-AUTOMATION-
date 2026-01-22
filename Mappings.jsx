import React, { useState, useEffect } from 'react';
import {
    Database, FileText, Check, AlertTriangle, RefreshCw,
    CheckCircle, XCircle, Zap, Shield
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const Mappings = ({ initialTemplate }) => {
    // 1. Data State
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState('');
    const [fields, setFields] = useState([]);
    const [schema, setSchema] = useState([]);

    // 2. UI State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // --- Init ---
    useEffect(() => {
        let isMounted = true;
        const initData = async () => {
            setLoading(true);
            try {
                const [tplRes, schemaRes] = await Promise.all([
                    fetch(`${API_BASE}/templates`),
                    fetch(`${API_BASE}/canonical_schema`)
                ]);
                const tplData = await tplRes.json();
                const schemaData = await schemaRes.json();

                if (isMounted) {
                    setTemplates(Array.isArray(tplData) ? tplData : []);
                    setSchema(Array.isArray(schemaData) ? schemaData : []);
                    if (initialTemplate && tplData.includes(initialTemplate)) setSelectedTemplate(initialTemplate);
                    else if (tplData.length > 0) setSelectedTemplate(tplData[0]);
                }
            } catch (err) {
                if (isMounted) setError("Failed to load initial data");
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        initData();
        return () => { isMounted = false; };
    }, []);

    // --- Fetch Fields (With granular state preservation) ---
    useEffect(() => {
        if (!selectedTemplate) return;
        let isMounted = true;

        const fetchFields = async () => {
            try {
                const res = await fetch(`${API_BASE}/template_fields?template=${encodeURIComponent(selectedTemplate)}`);
                const data = await res.json();
                if (isMounted) {
                    // Ensure unique ID for React rendering
                    const normalized = (Array.isArray(data) ? data : []).map((f, i) => ({
                        ...f,
                        ui_id: f.id || f.name || `field_${i}`, // Stable ID
                        is_dirty: false,
                        review_state: f.mapping_status === 'auto' ? 'approved' : 'pending' // UI state
                    }));
                    setFields(normalized);
                }
            } catch (err) { console.error(err); }
        };
        fetchFields();
        return () => { isMounted = false; };
    }, [selectedTemplate]);

    // --- Actions ---
    // 1. Single Field Update
    const handleFieldChange = async (ui_id, newCanonicalId) => {
        // Optimistic UI Update
        const updatedFields = fields.map(f => {
            if (f.ui_id === ui_id) {
                return { ...f, name: newCanonicalId, is_dirty: true, review_state: 'approved' };
            }
            return f;
        });
        setFields(updatedFields);

        // Find the full field object to send correct ID to backend
        const fieldObj = updatedFields.find(f => f.ui_id === ui_id);
        if (!fieldObj) return;

        try {
            await fetch(`${API_BASE}/update_mapping`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    template_name: selectedTemplate,
                    field_id: fieldObj.id || fieldObj.original_name,
                    canonical_id: newCanonicalId,
                    status: 'manual_override'
                })
            });
        } catch (e) {
            console.error(e);
            alert("Failed to save mapping");
        }
    };

    // 2. Bulk Approve High Confidence
    const handleBulkApprove = async () => {
        const toApprove = fields.filter(f => f.confidence === 'High' && f.mapping_status !== 'auto');
        if (toApprove.length === 0) return;

        if (!confirm(`Auto-approve ${toApprove.length} high-confidence fields?`)) return;

        // In a real app, we'd batch this. For now, we optimism UI update and loop calls (simplified)
        const newFields = fields.map(f => {
            if (f.confidence === 'High') return { ...f, mapping_status: 'auto', review_state: 'approved' };
            return f;
        });
        setFields(newFields);

        // Fire & Forget Backend Sync
        for (const f of toApprove) {
            // Re-saving as 'auto' or 'approved'
            handleFieldChange(f.ui_id, f.mapping_proposal.canonical_field_id);
        }
    };

    // Style Helper
    const getConfidenceBadge = (conf, score) => {
        const styles = {
            High: { bg: '#dcfce7', text: '#166534', icon: CheckCircle },
            Medium: { bg: '#fef9c3', text: '#854d0e', icon: AlertTriangle },
            Low: { bg: '#fee2e2', text: '#991b1b', icon: XCircle }
        };
        const s = styles[conf] || styles.Low;
        const Icon = s.icon;

        return (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: s.bg, color: s.text, padding: '4px 8px', borderRadius: '12px', fontSize: '12px', width: 'fit-content' }}>
                <Icon size={12} />
                <span style={{ fontWeight: 600 }}>{conf}</span>
                {score !== undefined && <span style={{ opacity: 0.7 }}>({(1 - score).toFixed(2)})</span>}
            </div>
        );
    };

    if (loading) return <div className="p-10 text-center text-slate-500">Loading Intelligence Engine...</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Shield className="text-blue-600" />
                        Intelligent Mapper
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Review and confirm AI-suggested field mappings.</p>
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                    <select
                        value={selectedTemplate}
                        onChange={e => setSelectedTemplate(e.target.value)}
                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid #cbd5e1', minWidth: '300px' }}
                    >
                        {templates.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>

                    <button
                        onClick={handleBulkApprove}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', background: '#2563eb', color: 'white', borderRadius: '6px', border: 'none', fontWeight: '600', cursor: 'pointer' }}
                    >
                        <Zap size={18} /> Auto-Approve High Conf.
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div style={{ background: 'white', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <tr>
                            <th style={{ padding: '15px', textAlign: 'left', fontSize: '0.85rem', color: '#64748b' }}>PDF Field / Context</th>
                            <th style={{ padding: '15px', textAlign: 'left', fontSize: '0.85rem', color: '#64748b' }}>AI Confidence</th>
                            <th style={{ padding: '15px', textAlign: 'left', fontSize: '0.85rem', color: '#64748b' }}>Canonical Schema Mapping</th>
                            <th style={{ padding: '15px', textAlign: 'left', fontSize: '0.85rem', color: '#64748b' }}>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {fields.map((field) => {
                            const isAuto = field.mapping_status === 'auto';
                            const prop = field.mapping_proposal || {};

                            return (
                                <tr key={field.ui_id} style={{ borderBottom: '1px solid #f1f5f9', background: isAuto ? '#f0fdf4' : 'white' }}>
                                    {/* 1. PDF Context */}
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ fontWeight: '600', color: '#1e293b' }}>{field.label || field.id}</div>
                                        {field.context && (
                                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', maxWidth: '300px', lineHeight: '1.4' }}>
                                                {field.context}
                                            </div>
                                        )}
                                        <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '4px', fontFamily: 'monospace' }}>
                                            ID: {field.id}
                                        </div>
                                    </td>

                                    {/* 2. Confidence */}
                                    <td style={{ padding: '15px' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                            {getConfidenceBadge(field.confidence, prop.score)}
                                            {prop.explanation && (
                                                <span style={{ fontSize: '11px', color: '#64748b' }}>{prop.explanation}</span>
                                            )}
                                        </div>
                                    </td>

                                    {/* 3. Mapping Selector (THE CORE UI) */}
                                    <td style={{ padding: '15px' }}>
                                        <select
                                            value={field.name || ''}
                                            onChange={e => handleFieldChange(field.ui_id, e.target.value)}
                                            style={{
                                                width: '100%', padding: '10px', borderRadius: '6px',
                                                border: field.name ? '1px solid #22c55e' : '1px solid #cbd5e1',
                                                background: field.name ? '#f0fdf4' : 'white'
                                            }}
                                        >
                                            <option value="">-- Unmapped --</option>
                                            {/* Recommendation Top */}
                                            {prop.canonical_field_id && (
                                                <optgroup label="✨ AI Recommendation">
                                                    <option value={prop.canonical_field_id}>
                                                        👉 {prop.canonical_field_id} (Recommended)
                                                    </option>
                                                </optgroup>
                                            )}
                                            {/* Full List */}
                                            <optgroup label="All Schema Fields">
                                                {schema.map(s => (
                                                    <option key={s.field_id} value={s.field_id}>
                                                        {s.canonical_name} ({s.data_type})
                                                    </option>
                                                ))}
                                            </optgroup>
                                        </select>
                                    </td>

                                    {/* 4. Status */}
                                    <td style={{ padding: '15px' }}>
                                        {field.review_state === 'approved' ? (
                                            <div style={{ color: '#166534', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <CheckCircle size={16} /> Mapped
                                            </div>
                                        ) : (
                                            <div style={{ color: '#ca8a04', fontSize: '12px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <AlertTriangle size={16} /> Review
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Mappings;
