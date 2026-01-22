import React, { useState, useEffect, useRef } from 'react';
import {
    Play, Upload, FileText, Database, Download,
    CheckCircle, AlertCircle, Loader, Trash2
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const NewApplication = () => {
    // --- State ---
    const [templates, setTemplates] = useState([]);
    const [selectedTemplate, setSelectedTemplate] = useState('');

    // Data Source
    const [profiles, setProfiles] = useState([]);
    const [selectedProfileIndex, setSelectedProfileIndex] = useState("");

    // Form Fields (The "Truth" from the template)
    const [fields, setFields] = useState([]);

    // UI
    const [processing, setProcessing] = useState(false);
    const [analyzing, setAnalyzing] = useState(false); // New State
    const [logs, setLogs] = useState([]);
    const [downloadUrl, setDownloadUrl] = useState(null);

    const formRef = useRef(null);

    // State for Form Data (Controlled)
    const [formData, setFormData] = useState({});

    // --- Init ---
    useEffect(() => {
        loadTemplates();
        loadProfiles();
    }, []);

    // --- RE-APPLY PROFILE WHEN FIELDS OR PROFILE CHANGES ---
    // This ensures that selecting a template after a profile (or vice versa) works.
    useEffect(() => {
        if (selectedProfileIndex !== "" && fields.length > 0) {
            applyProfileToForm(selectedProfileIndex);
        }
    }, [fields, selectedProfileIndex]);

    // --- Handlers ---
    const loadTemplates = async () => {
        try {
            const res = await fetch(`${API_BASE}/templates`);
            setTemplates(await res.json());
        } catch (e) { console.error(e); }
    };

    const loadProfiles = async () => {
        try {
            const res = await fetch(`${API_BASE}/samples`);
            if (res.ok) setProfiles(await res.json());
        } catch (e) { console.error(e); }
    };

    const handleTemplateChange = async (tpl) => {
        setSelectedTemplate(tpl);
        setFields([]);
        // setFormData({}); // Removed to allow profiles to persist if switching templates
        setDownloadUrl(null);
        setLogs([]);
        if (!tpl) return;

        setAnalyzing(true);
        try {
            const res = await fetch(`${API_BASE}/template_fields?template=${encodeURIComponent(tpl)}`);
            const data = await res.json();
            setFields(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Error loading fields", e);
        } finally {
            setAnalyzing(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (checked ? "Yes" : "Off") : value
        }));
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData();
        fd.append('file', file);
        try {
            const res = await fetch(`${API_BASE}/upload_data`, { method: 'POST', body: fd });
            if (res.ok) {
                const result = await res.json();
                alert(`Dataset '${file.filename}' loaded. ${Object.keys(result.remapped_columns).length} columns auto-mapped to schema.`);
                loadProfiles(); // Refresh list
            }
        } catch (e) { alert("Upload failed"); }
    };

    const handleDeleteDataSource = async () => {
        if (!confirm("Are you sure you want to delete the active data source?")) return;
        try {
            const res = await fetch(`${API_BASE}/data_source`, { method: 'DELETE' });
            if (res.ok) {
                setProfiles([]);
                setSelectedProfileIndex("");
                setFormData({});
                alert("Data Source Deleted.");
            }
        } catch (e) { alert("Deletion failed"); }
    }

    const applyProfileToForm = (idx) => {
        const profile = profiles[idx];
        if (!profile) return;

        // Build a lookup map for the profile data
        const cleanProfileMap = {};
        Object.keys(profile).forEach(k => {
            const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            cleanProfileMap[clean] = profile[k];
            cleanProfileMap[k] = profile[k];
        });

        const newFormData = {};

        fields.forEach(field => {
            const canonicalKey = field.name; // This is the mapped ID from mapping_engine
            const originalID = field.id;
            const label = field.label;

            let val = undefined;

            // Priority 1: Canonical Metadata Match
            if (canonicalKey && profile[canonicalKey] !== undefined) {
                val = profile[canonicalKey];
            }

            // Priority 2: Fuzzy/Clean Match
            if (val === undefined) {
                const keysToTry = [canonicalKey, originalID, label].filter(Boolean);
                for (const key of keysToTry) {
                    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
                    if (cleanProfileMap[cleanKey] !== undefined) {
                        val = cleanProfileMap[cleanKey];
                        break;
                    }
                }
            }

            if (val !== undefined && val !== null) {
                const targetKey = field.name || field.id;
                newFormData[targetKey] = val;
            }
        });

        setFormData(newFormData);
    };

    const handleProfileSelect = (idx) => {
        setSelectedProfileIndex(idx);
        if (idx === "" || idx === undefined) {
            setFormData({});
            return;
        }
        applyProfileToForm(idx);
    };


    const handleGenerate = async () => {
        const form = formRef.current;
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        setProcessing(true);
        setLogs(["Validating data with RAG Pipeline...", "Checking against Bank Knowledge Base..."]);
        setDownloadUrl(null);

        // Merge formData with template info
        const data = { ...formData, template_name: selectedTemplate };

        try {
            const res = await fetch(`${API_BASE}/process_application`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await res.json();

            if (result.logs) setLogs(result.logs);

            if (result.status === 'success') {
                setDownloadUrl(`${API_BASE}/download/${result.file_path}`);
            } else {
                setLogs(prev => [...prev, `❌ Error: ${result.message}`]);
            }
        } catch (e) {
            setLogs(prev => [...prev, `❌ Network Error: ${e.message}`]);
        } finally {
            setProcessing(false);
        }
    };

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '20px' }}>
            {/* 1. Header & Setup */}
            <div style={{ marginBottom: '30px' }}>
                <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FileText className="text-blue-600" /> Application Processor
                </h1>
                <p style={{ color: '#64748b' }}>Select a template, attach data, and let AI handle the rest.</p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px', background: 'white', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                    {/* Template Select */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem' }}>1. Select Template</label>
                        <select
                            style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                            value={selectedTemplate}
                            onChange={(e) => handleTemplateChange(e.target.value)}
                        >
                            <option value="">-- Choose PDF Template --</option>
                            {templates.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    {/* Data Source */}
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', fontSize: '0.9rem' }}>2. Data Source (CSV / Dataset)</label>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <select
                                style={{ flex: 1, padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
                                value={selectedProfileIndex}
                                onChange={(e) => handleProfileSelect(e.target.value)}
                            >
                                <option value="">-- Manual Entry Only --</option>
                                {profiles.map((p, i) => (
                                    <option key={i} value={i}>{p.registered_name || `Record #${i + 1}`}</option>
                                ))}
                            </select>

                            <div style={{ display: 'flex', gap: '5px' }}>
                                <div style={{ position: 'relative' }}>
                                    <input type="file" id="csvUpload" accept=".csv" hidden onChange={handleFileUpload} />
                                    <label
                                        htmlFor="csvUpload"
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 15px', background: '#e0f2fe', border: '1px solid #bae6fd', borderRadius: '6px', cursor: 'pointer' }}
                                        title="Upload New CSV"
                                    >
                                        <Upload size={18} color="#0284c7" />
                                    </label>
                                </div>
                                <button
                                    onClick={handleDeleteDataSource}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 15px', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer' }}
                                    title="Delete Active Data"
                                >
                                    <Trash2 size={18} color="#dc2626" />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. The Form Grid */}
            {selectedTemplate && (
                <div style={{ background: 'white', padding: '25px', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ fontSize: '1.2rem', fontWeight: '600', margin: 0 }}>Review & Edit Data</h3>
                        <span style={{ fontSize: '0.85rem', color: '#64748b', background: '#f8fafc', padding: '4px 10px', borderRadius: '4px' }}>
                            {fields.length} Fields Detected
                        </span>
                    </div>

                    {analyzing ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                            <Loader className="animate-spin" size={32} style={{ margin: '0 auto 10px' }} />
                            <p>AI is analyzing template structure...</p>
                            <p style={{ fontSize: '0.8rem' }}>Identifying columns & fields</p>
                        </div>
                    ) : (
                        <form ref={formRef}>
                            {fields.length === 0 && <p style={{ textAlign: 'center', color: '#64748b' }}>No editable fields detected in this document.</p>}

                            {/* Group Fields by Section */}
                            {Object.entries(fields.reduce((acc, field) => {
                                const sec = field.section || "General Details";
                                if (!acc[sec]) acc[sec] = [];
                                acc[sec].push(field);
                                return acc;
                            }, {})).map(([sectionName, sectionFields]) => (
                                <div key={sectionName} style={{ marginBottom: '30px' }}>
                                    <h4 style={{
                                        fontSize: '1rem',
                                        fontWeight: '700',
                                        color: '#1e293b',
                                        borderBottom: '2px solid #e2e8f0',
                                        paddingBottom: '8px',
                                        marginBottom: '15px',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        {sectionName}
                                    </h4>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
                                        {sectionFields.map((field, idx) => (
                                            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <label style={{ fontSize: '0.85rem', fontWeight: '500', color: '#334155' }}>
                                                        {field.label || field.name}
                                                        {field.required && <span style={{ color: '#ef4444' }}> *</span>}
                                                    </label>
                                                    {field.mapping_status === 'auto' && (
                                                        <span style={{ fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '10px', fontWeight: '600' }}>AI Match</span>
                                                    )}
                                                </div>

                                                {field.type === 'checkbox' ? (
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                                                        <input
                                                            type="checkbox"
                                                            name={field.name || field.id}
                                                            checked={formData[field.name || field.id] === "Yes" || formData[field.name || field.id] === true}
                                                            onChange={handleInputChange}
                                                            style={{ width: '18px', height: '18px' }}
                                                        />
                                                        <span style={{ fontSize: '0.9rem', color: '#64748b' }}>Check to enable</span>
                                                    </div>
                                                ) : (
                                                    <input
                                                        type={field.type === 'date' ? 'date' : 'text'}
                                                        name={field.name || field.id}
                                                        style={{
                                                            padding: '10px',
                                                            border: '1px solid #e2e8f0',
                                                            borderRadius: '6px',
                                                            fontSize: '0.95rem',
                                                            backgroundColor: formData[field.name || field.id] ? '#dcfce7' : 'white',
                                                            transition: 'background-color 0.2s'
                                                        }}
                                                        placeholder={field.placeholder || `Enter ${field.label}...`}
                                                        required={field.required}
                                                        value={formData[field.name || field.id] || ''}
                                                        onChange={handleInputChange}
                                                    />
                                                )}

                                                {field.context && (
                                                    <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>
                                                        AI Context: {field.context}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </form>
                    )}

                    {/* 3. Action Buttons */}
                    <div style={{ marginTop: '30px', paddingTop: '20px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '15px' }}>
                        {downloadUrl && (
                            <a
                                href={downloadUrl}
                                target="_blank"
                                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#22c55e', color: 'white', borderRadius: '6px', fontWeight: '600', textDecoration: 'none' }}
                            >
                                <Download size={20} /> Download Filled PDF
                            </a>
                        )}

                        <button
                            onClick={handleGenerate}
                            disabled={processing}
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', background: '#2563eb', color: 'white', borderRadius: '6px', fontWeight: '600', border: 'none', cursor: processing ? 'not-allowed' : 'pointer', opacity: processing ? 0.8 : 1 }}
                        >
                            {processing ? <Loader className="animate-spin" size={20} /> : <Play size={20} />}
                            {processing ? 'Processing Intelligence...' : 'Generate Document'}
                        </button>
                    </div>

                    {/* Logs Area */}
                    {(processing || logs.length > 0) && (
                        <div style={{ marginTop: '20px', background: '#1e293b', padding: '15px', borderRadius: '6px', fontSize: '0.85rem', color: '#4ade80', fontFamily: 'monospace', maxHeight: '150px', overflowY: 'auto' }}>
                            {logs.map((L, i) => <div key={i}>&gt; {L}</div>)}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NewApplication;
