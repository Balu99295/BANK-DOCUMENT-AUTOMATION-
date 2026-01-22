import React, { useState, useEffect } from 'react';
import { Database, Search, Shield, Tag, Beaker, ArrowRight, Check, Edit, Plus, Trash2, Save, X, BarChart2, Clock, Download, Upload, Cpu } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const API_BASE = 'http://localhost:8000';

const StandardSchema = () => {
    const [activeTab, setActiveTab] = useState('browser');

    return (
        <div className="schema-page fade-in">
            <div className="schema-header" style={{ marginBottom: '20px' }}>
                <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Cpu size={28} className="text-primary" /> Schema Intelligence & Governance Center
                </h2>
                <p className="text-secondary">The central brain of the document automation platform.</p>
            </div>

            <div className="tabs-container" style={{ borderBottom: '1px solid #e2e8f0', marginBottom: '20px', display: 'flex', gap: '20px' }}>
                <TabButton id="browser" label="Field Browser" icon={<Database size={16} />} active={activeTab} set={setActiveTab} />
                <TabButton id="editor" label="Schema Editor" icon={<Edit size={16} />} active={activeTab} set={setActiveTab} />
                <TabButton id="simulator" label="AI Simulator" icon={<Beaker size={16} />} active={activeTab} set={setActiveTab} />
                <TabButton id="analytics" label="Mapping Analytics" icon={<BarChart2 size={16} />} active={activeTab} set={setActiveTab} />
                <TabButton id="history" label="Version History" icon={<Clock size={16} />} active={activeTab} set={setActiveTab} />
                <TabButton id="import-export" label="Export / Import" icon={<Download size={16} />} active={activeTab} set={setActiveTab} />
            </div>

            <div className="tab-content">
                {activeTab === 'browser' && <FieldBrowser />}
                {activeTab === 'editor' && <SchemaEditor />}
                {activeTab === 'simulator' && <MappingSimulator />}
                {activeTab === 'analytics' && <SchemaAnalytics />}
                {activeTab === 'history' && <VersionHistory />}
                {activeTab === 'import-export' && <ImportExport />}
            </div>
        </div>
    );
};

const TabButton = ({ id, label, icon, active, set }) => (
    <button
        onClick={() => set(id)}
        style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '10px 0',
            border: 'none', background: 'none',
            borderBottom: active === id ? '2px solid #6366f1' : '2px solid transparent',
            color: active === id ? '#6366f1' : '#64748b',
            fontWeight: active === id ? '600' : '400',
            cursor: 'pointer', transition: 'all 0.2s'
        }}
    >
        {icon} {label}
    </button>
);

// --- Sub-Components ---

const FieldBrowser = () => {
    const [fields, setFields] = useState([]);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetch(`${API_BASE}/canonical_schema`)
            .then(res => res.json())
            .then(setFields);
    }, []);

    const filtered = fields.filter(f =>
        f.canonical_name.toLowerCase().includes(search.toLowerCase()) ||
        f.field_id.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3>Standard Data Points ({filtered.length})</h3>
                <div className="search-bar" style={{ width: '300px' }}>
                    <Search size={16} />
                    <input type="text" placeholder="Search standard fields..." value={search} onChange={e => setSearch(e.target.value)} />
                </div>
            </div>
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Canonical Name</th>
                        <th>Field ID (System Key)</th>
                        <th>Type</th>
                        <th>Sensitivity</th>
                        <th>Synonyms</th>
                    </tr>
                </thead>
                <tbody>
                    {filtered.map((f, i) => (
                        <tr key={i}>
                            <td style={{ fontWeight: 500 }}>{f.canonical_name}</td>
                            <td className="mono">{f.field_id}</td>
                            <td><span className="tag info">{f.data_type}</span></td>
                            <td>
                                <span className={`tag ${f.pii_sensitivity_level === 'High' ? 'warning' : f.pii_sensitivity_level === 'Medium' ? 'neutral' : 'success'}`}>
                                    {f.pii_sensitivity_level || 'Low'}
                                </span>
                            </td>
                            <td style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b' }}>
                                {f.synonyms?.join(', ')}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const SchemaEditor = () => {
    const [fields, setFields] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({});
    const [isNew, setIsNew] = useState(false);

    useEffect(() => {
        loadFields();
    }, []);

    const loadFields = () => {
        fetch(`${API_BASE}/canonical_schema`).then(res => res.json()).then(setFields);
    };

    const handleEdit = (field) => {
        setFormData({ ...field, synonyms: field.synonyms.join(', ') });
        setEditingId(field.field_id);
        setIsNew(false);
    };

    const handleAddNew = () => {
        setFormData({
            field_id: '', canonical_name: '', display_label: '', description: '',
            synonyms: '', data_type: 'string', section: 'General',
            pii_sensitivity_level: 'Low'
        });
        setEditingId('NEW_ENTRY');
        setIsNew(true);
    };

    const handleSave = async () => {
        const payload = {
            ...formData,
            synonyms: formData.synonyms.split(',').map(s => s.trim()).filter(s => s)
        };

        const url = isNew ? `${API_BASE}/canonical_schema` : `${API_BASE}/canonical_schema/${formData.field_id}`;
        const method = isNew ? 'POST' : 'PUT';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            setEditingId(null);
            loadFields();
        } else {
            alert("Failed to save field");
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Are you sure you want to delete this field?")) return;
        await fetch(`${API_BASE}/canonical_schema/${id}`, { method: 'DELETE' });
        loadFields();
    };

    if (editingId) {
        return (
            <div className="card">
                <div className="card-header">
                    <h3>{isNew ? 'Create New Field' : 'Edit Field'}</h3>
                </div>
                <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div className="form-group">
                        <label>Field ID (Unique System Key)</label>
                        <input className="input" disabled={!isNew} value={formData.field_id} onChange={e => setFormData({ ...formData, field_id: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Canonical Name</label>
                        <input className="input" value={formData.canonical_name} onChange={e => setFormData({ ...formData, canonical_name: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label>Description (Context for AI)</label>
                        <input className="input" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                    </div>
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label>Synonyms (Comma Separated)</label>
                        <input className="input" value={formData.synonyms} onChange={e => setFormData({ ...formData, synonyms: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label>Data Type</label>
                        <select className="input" value={formData.data_type} onChange={e => setFormData({ ...formData, data_type: e.target.value })}>
                            <option value="string">String</option>
                            <option value="number">Number</option>
                            <option value="date">Date</option>
                            <option value="boolean">Boolean</option>
                        </select>
                    </div>
                    <div className="form-group">
                        <label>Sensitivity</label>
                        <select className="input" value={formData.pii_sensitivity_level} onChange={e => setFormData({ ...formData, pii_sensitivity_level: e.target.value })}>
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                        </select>
                    </div>
                    <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px', marginTop: '10px' }}>
                        <button className="btn-primary" onClick={handleSave}><Save size={16} /> Save Field</button>
                        <button className="btn-secondary" onClick={() => setEditingId(null)}><X size={16} /> Cancel</button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                <h3>Schema Governance</h3>
                <button className="btn-primary" onClick={handleAddNew}><Plus size={16} /> Add Custom Field</button>
            </div>
            <table className="data-table">
                <thead>
                    <tr>
                        <th>Field ID</th>
                        <th>Name</th>
                        <th>Description</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {fields.map((f, i) => (
                        <tr key={i}>
                            <td className="mono">{f.field_id}</td>
                            <td>{f.canonical_name}</td>
                            <td style={{ color: '#64748b', fontSize: '13px' }}>{f.description}</td>
                            <td>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button className="icon-btn" onClick={() => handleEdit(f)}><Edit size={14} /></button>
                                    <button className="icon-btn danger" onClick={() => handleDelete(f.field_id)}><Trash2 size={14} /></button>
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

const MappingSimulator = () => {
    const [testQuery, setTestQuery] = useState('');
    const [testResults, setTestResults] = useState(null);
    const [isTesting, setIsTesting] = useState(false);

    const handleTestMatch = async () => {
        if (!testQuery.trim()) return;
        setIsTesting(true);
        try {
            const res = await fetch(`${API_BASE}/test_schema_match?query=${encodeURIComponent(testQuery)}`);
            if (res.ok) setTestResults(await res.json());
        } catch (e) {
            console.error(e);
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <div className="card test-lab-card" style={{ border: '1px solid #6366f1' }}>
            <div className="card-header" style={{ background: '#eef2ff', borderBottom: '1px solid #e0e7ff' }}>
                <h3 style={{ color: '#4338ca', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Beaker size={20} /> AI Mapping Simulator
                </h3>
            </div>
            <div style={{ padding: '20px' }}>
                <p style={{ color: '#64748b', marginBottom: '15px' }}>
                    Test how the AI Engine recognizes unknown field labels. Enter a raw label below to see the intelligent mapping.
                </p>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    <input
                        type="text"
                        className="input-lg"
                        placeholder="Enter a random form label (e.g., 'Mom's Maiden Name', 'Cell Phone', 'Postal Addr')"
                        value={testQuery}
                        onChange={(e) => setTestQuery(e.target.value)}
                        style={{ width: '100%', padding: '12px', fontSize: '16px', borderRadius: '6px', border: '1px solid #cbd5e1', flex: 1 }}
                        onKeyDown={(e) => e.key === 'Enter' && handleTestMatch()}
                    />
                    <button
                        className="btn-primary"
                        onClick={handleTestMatch}
                        disabled={isTesting || !testQuery}
                        style={{ height: '46px', padding: '0 24px' }}
                    >
                        {isTesting ? 'Analyzing...' : 'Test Match'}
                    </button>
                </div>

                {testResults && (
                    <div className="match-results" style={{ marginTop: '20px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                        <div style={{ padding: '10px 15px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: '600', color: '#475569' }}>
                            AI Top Predictions
                        </div>
                        {testResults.map((match, i) => (
                            <div key={i} style={{ padding: '12px 15px', borderBottom: i < testResults.length - 1 ? '1px solid #f1f5f9' : 'none', display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ width: '24px', height: '24px', background: i === 0 ? '#dcfce7' : '#f1f5f9', color: i === 0 ? '#16a34a' : '#64748b', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '12px' }}>
                                    {i + 1}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '600', color: '#1e293b' }}>{match.canonical_name}</div>
                                    <div className="mono" style={{ fontSize: '12px', color: '#64748b' }}>{match.field_id}</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span className={`tag ${i === 0 ? 'success' : 'neutral'}`} style={{ fontSize: '11px' }}>
                                        {match.confidence ? `Match: ${Math.round((1 - match.confidence) * 100)}%` : 'Vector Match'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

const SchemaAnalytics = () => {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        fetch(`${API_BASE}/schema_analytics`).then(res => res.json()).then(setStats);
    }, []);

    if (!stats) return <div>Loading Analytics...</div>;

    return (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="card">
                <div className="card-header"><h3>Sensitivity Breakdown</h3></div>
                <div style={{ padding: '20px' }}>
                    {Object.entries(stats.sensitivity_breakdown).map(([k, v]) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', paddingBottom: '10px', borderBottom: '1px solid #f1f5f9' }}>
                            <span>{k} Sensitivity</span>
                            <span style={{ fontWeight: 'bold' }}>{v} Fields</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="card">
                <div className="card-header"><h3>Usage Statistics</h3></div>
                <div style={{ padding: '20px' }}>
                    <div className="stat-row">
                        <span>Mapped Templates</span>
                        <strong>{stats.usage.mapped_templates}</strong>
                    </div>
                    <div className="stat-row">
                        <span>Average AI Confidence</span>
                        <strong>{stats.usage.avg_confidence * 100}%</strong>
                    </div>
                    <div className="stat-row">
                        <span>Flagged for Review</span>
                        <strong className="text-warning">{stats.usage.flagged_fields}</strong>
                    </div>
                </div>
            </div>
        </div>
    );
};

const VersionHistory = () => {
    // Mock Data
    const history = [
        { date: '2025-12-09', user: 'Admin', action: 'Added Field', details: 'Added "Crypto Wallet Address" to Schema' },
        { date: '2025-12-08', user: 'System', action: 'Policy Update', details: 'Updated PII Sensitivity for "SSN" to High' },
        { date: '2025-12-01', user: 'Admin', action: 'Schema Init', details: 'Initial import of 100 standard banking fields' },
    ];

    return (
        <div className="card">
            <div className="card-header"><h3>Change Log</h3></div>
            <div className="timeline" style={{ padding: '20px' }}>
                {history.map((h, i) => (
                    <div key={i} style={{ display: 'flex', gap: '15px', paddingBottom: '20px', borderLeft: '2px solid #e2e8f0', paddingLeft: '20px', position: 'relative' }}>
                        <div style={{ position: 'absolute', left: '-6px', top: '0', background: '#3b82f6', width: '10px', height: '10px', borderRadius: '50%' }}></div>
                        <div style={{ width: '100px', fontSize: '13px', color: '#64748b' }}>{h.date}</div>
                        <div>
                            <div style={{ fontWeight: '600' }}>{h.action}</div>
                            <div style={{ fontSize: '14px', color: '#334155' }}>{h.details}</div>
                            <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>By: {h.user}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ImportExport = () => {
    return (
        <div className="card">
            <div className="card-header"><h3>Data Portability</h3></div>
            <div style={{ padding: '40px', textAlign: 'center' }}>
                <p style={{ marginBottom: '20px', color: '#64748b' }}>
                    Manage your schema externally using Excel or CSV. This allows for bulk updates and offline reviews by the compliance team.
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '20px' }}>
                    <button className="btn-primary" style={{ padding: '12px 24px' }}>
                        <Download size={18} style={{ marginRight: '8px' }} /> Download Schema (CSV)
                    </button>
                    <button className="btn-secondary" style={{ padding: '12px 24px' }}>
                        <Upload size={18} style={{ marginRight: '8px' }} /> Upload Changes
                    </button>
                </div>
            </div>
        </div>
    );
}

export default StandardSchema;
