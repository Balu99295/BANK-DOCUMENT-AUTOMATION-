import React from 'react';
import { FileText } from 'lucide-react';

const Policies = () => {
    return (
        <div className="policies-page fade-in">
            <div className="card">
                <div className="card-header">
                    <h3>Knowledge Base</h3>
                </div>
                <div className="policy-list">
                    <div className="policy-item">
                        <FileText size={24} />
                        <div className="policy-info">
                            <h4>Global_KYC_Standard_v2.pdf</h4>
                            <span>Ingested: 2 days ago • Size: 4.2 MB</span>
                        </div>
                        <button className="btn-outline sm">Re-Ingest</button>
                    </div>
                    <div className="policy-item">
                        <FileText size={24} />
                        <div className="policy-info">
                            <h4>FATCA_Compliance_Guide.pdf</h4>
                            <span>Ingested: 5 days ago • Size: 1.8 MB</span>
                        </div>
                        <button className="btn-outline sm">Re-Ingest</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Policies;
