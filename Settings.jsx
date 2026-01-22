import React, { useState } from 'react';
import { Save, RefreshCw, Trash2 } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const Settings = () => {
    const [config, setConfig] = useState({
        theme: 'light',
        confidenceThreshold: 0.7,
        autoIngest: true,
        mappingModel: 'all-MiniLM-L6-v2',
        adminEmail: 'admin@bank.com'
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setConfig(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = () => {
        // In real app, save to backend
        alert('Settings Saved Successfully!');
    };

    const handleClearCache = async () => {
        if (!window.confirm("Clear all audit logs and cached mappings?")) return;
        // Mock action
        alert('System Cache Cleared.');
    };

    return (
        <div className="settings-page fade-in">
            <div className="card settings-card">
                <div className="card-header">
                    <h3>Global Configuration</h3>
                </div>

                <div className="settings-form">
                    <div className="form-group">
                        <label>Admin Email</label>
                        <input type="email" name="adminEmail" value={config.adminEmail} onChange={handleChange} />
                    </div>

                    <div className="form-group">
                        <label>Auto-Mapping Confidence Threshold (0.0 - 1.0)</label>
                        <input type="number" step="0.1" min="0" max="1" name="confidenceThreshold" value={config.confidenceThreshold} onChange={handleChange} />
                        <span className="hint">Matches below this score will be flagged for review.</span>
                    </div>

                    <div className="form-group">
                        <label>Embedding Model</label>
                        <select name="mappingModel" value={config.mappingModel} onChange={handleChange}>
                            <option value="all-MiniLM-L6-v2">all-MiniLM-L6-v2 (Fast)</option>
                            <option value="paraphrase-multilingual">paraphrase-multilingual (Accurate)</option>
                            <option value="openai-ada-002">OpenAI Ada-002 (Cloud)</option>
                        </select>
                    </div>

                    <div className="form-group checkbox-group">
                        <input type="checkbox" id="autoIngest" name="autoIngest" checked={config.autoIngest} onChange={handleChange} />
                        <label htmlFor="autoIngest">Auto-ingest new policies on startup</label>
                    </div>

                    <div className="settings-actions">
                        <button className="btn-primary" onClick={handleSave}>
                            <Save size={18} /> Save Changes
                        </button>
                        <button className="btn-outline danger" onClick={handleClearCache}>
                            <Trash2 size={18} /> Clear System Cache
                        </button>
                    </div>
                </div>
            </div>

            <div className="card version-card">
                <h3>System Info</h3>
                <p><strong>Version:</strong> v3.5.0-Pro</p>
                <p><strong>Environment:</strong> Development (Localhost)</p>
                <p><strong>Vector DB:</strong> ChromaDB (Persistent)</p>
            </div>
        </div>
    );
};

export default Settings;
