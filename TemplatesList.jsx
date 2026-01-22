import React, { useState, useEffect } from 'react';
import { Plus, Trash2, FileText, Download } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const TemplatesList = ({ setActivePage, setTemplateContext }) => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            const res = await fetch(`${API_BASE}/templates`);
            const data = await res.json();
            setTemplates(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (template) => {
        if (!window.confirm(`Delete ${template}?`)) return;
        try {
            await fetch(`${API_BASE}/delete_template/${template}`, { method: 'DELETE' });
            fetchTemplates();
        } catch (e) {
            console.error(e);
        }
    };

    return (
        <div className="templates-page fade-in">
            <div className="page-header-actions">
                <button className="btn-primary" onClick={() => setActivePage('templates_new')}>
                    <Plus size={18} /> Onboard New Template
                </button>
            </div>

            <div className="card">
                {loading ? (
                    <div className="loading">Loading templates...</div>
                ) : templates.length === 0 ? (
                    <div className="empty-state">No templates found. Onboard one to get started.</div>
                ) : (
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Template Name</th>
                                <th>Status</th>
                                <th>Mappings</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {templates.map((t, i) => (
                                <tr key={i}>
                                    <td className="font-medium">
                                        <FileText size={16} className="inline-icon" /> {t}
                                    </td>
                                    <td><span className="tag success">Active</span></td>
                                    <td><span className="tag info">Auto-Mapped</span></td>
                                    <td className="actions-cell">
                                        <button className="btn-icon" onClick={() => window.open(`${API_BASE}/download_template/${t}`)} title="Download Original">
                                            <Download size={16} />
                                        </button>
                                        <button className="btn-icon" onClick={() => {
                                            if (setTemplateContext) setTemplateContext(t);
                                            setActivePage('mappings');
                                        }} title="Review Mappings">
                                            Edit
                                        </button>
                                        <button className="btn-icon danger" onClick={() => handleDelete(t)} title="Delete">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default TemplatesList;
