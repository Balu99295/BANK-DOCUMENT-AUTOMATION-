import React, { useState } from 'react';
import { Upload, CheckCircle, ArrowRight } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const TemplateOnboarding = ({ setActivePage, setTemplateContext }) => {
    const [step, setStep] = useState(1);
    const [file, setFile] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [analysis, setAnalysis] = useState(null);

    const handleUpload = async () => {
        if (!file) return;
        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
            if (res.ok) {
                // Trigger analysis
                const fieldsRes = await fetch(`${API_BASE}/template_fields?template=${encodeURIComponent(file.name)}`);
                const fieldsData = await fieldsRes.json();
                setAnalysis({ name: file.name, fieldCount: fieldsData.length });
                setStep(2);
            }
        } catch (e) {
            alert('Upload failed');
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="onboarding-container fade-in">
            <div className="stepper">
                <div className={`step ${step >= 1 ? 'active' : ''}`}>1. Upload</div>
                <div className="line"></div>
                <div className={`step ${step >= 2 ? 'active' : ''}`}>2. Analysis</div>
                <div className="line"></div>
                <div className={`step ${step >= 3 ? 'active' : ''}`}>3. Review</div>
            </div>

            <div className="card onboarding-card">
                {step === 1 && (
                    <div className="step-content">
                        <h2>Upload PDF Template</h2>
                        <div className="upload-zone large">
                            <input
                                type="file"
                                id="file-upload"
                                accept=".pdf"
                                onChange={(e) => setFile(e.target.files[0])}
                            />
                            <label htmlFor="file-upload">
                                <Upload size={48} />
                                <p>{file ? file.name : "Drag & Drop PDF or Click to Browse"}</p>
                            </label>
                        </div>
                        <button className="btn-primary" disabled={!file || isUploading} onClick={handleUpload}>
                            {isUploading ? 'Processing...' : 'Analyze Template'}
                        </button>
                    </div>
                )}

                {step === 2 && (
                    <div className="step-content">
                        <CheckCircle size={64} color="#16a34a" />
                        <h2>Analysis Complete</h2>
                        <p>We detected <strong>{analysis.fieldCount}</strong> fields in <em>{analysis.name}</em>.</p>
                        <p> The Intelligent Engine has auto-mapped them to the Canonical Schema.</p>

                        <button className="btn-primary" onClick={() => {
                            if (setTemplateContext) setTemplateContext(file.name);
                            setActivePage('mappings');
                        }}>
                            Proceed to Mapping Review <ArrowRight size={16} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TemplateOnboarding;
