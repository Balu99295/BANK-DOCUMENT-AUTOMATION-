import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

const AuditLogs = () => {
    // Mock data for display
    const logs = [
        { time: '10:42 AM', type: 'INFO', msg: 'Trace ID 4829: Optimization Complete' },
        { time: '10:41 AM', type: 'SUCCESS', msg: 'Trace ID 4829: PDF Generated' },
        { time: '10:41 AM', type: 'INFO', msg: 'Trace ID 4829: Filling Strategy -> AcroForm' },
    ];

    return (
        <div className="audit-page fade-in">
            <div className="card">
                <div className="card-header">
                    <h3>System Logs</h3>
                </div>
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Type</th>
                            <th>Message</th>
                        </tr>
                    </thead>
                    <tbody>
                        {logs.map((l, i) => (
                            <tr key={i}>
                                <td>{l.time}</td>
                                <td><span className={`tag ${l.type.toLowerCase()}`}>{l.type}</span></td>
                                <td>{l.msg}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default AuditLogs;
