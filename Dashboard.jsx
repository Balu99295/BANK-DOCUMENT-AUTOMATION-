import React, { useState, useEffect } from 'react';
import { ArrowUpRight, Clock, AlertTriangle, FileText, CheckCircle } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

const Dashboard = ({ setActivePage }) => {
    const [stats, setStats] = useState({
        active_templates: '-',
        applications_filled: '-',
        auto_mapped_percent: '-'
    });
    const [activities, setActivities] = useState([]);

    const fetchStats = async () => {
        try {
            const res = await fetch(`${API_BASE}/dashboard_stats`);
            if (res.ok) {
                const data = await res.json();
                setStats({
                    active_templates: data.active_templates,
                    applications_filled: data.applications_filled,
                    auto_mapped_percent: data.auto_mapped_percent
                });
                setActivities(data.recent_activity);
            }
        } catch (e) {
            console.error("Dashboard sync failed", e);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000); // Update every 5 seconds
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="dashboard-container fade-in">
            {/* KPI Cards */}
            <div className="kpi-grid">
                <div className="kpi-card">
                    <div className="kpi-icon bg-blue">
                        <FileText size={24} color="#2563eb" />
                    </div>
                    <div className="kpi-content">
                        <span className="kpi-label">Active Templates</span>
                        <span className="kpi-value">{stats.active_templates}</span>
                        <span className="kpi-trend positive"><ArrowUpRight size={14} /> Live Count</span>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon bg-green">
                        <CheckCircle size={24} color="#16a34a" />
                    </div>
                    <div className="kpi-content">
                        <span className="kpi-label">Applications Filled</span>
                        <span className="kpi-value">{stats.applications_filled}</span>
                        <span className="kpi-trend positive"><ArrowUpRight size={14} /> Growing</span>
                    </div>
                </div>

                <div className="kpi-card">
                    <div className="kpi-icon bg-purple">
                        <Clock size={24} color="#9333ea" />
                    </div>
                    <div className="kpi-content">
                        <span className="kpi-label">Fields Auto-Mapped</span>
                        <span className="kpi-value">{stats.auto_mapped_percent}%</span>
                        <span className="kpi-trend neutral">Stable</span>
                    </div>
                </div>
            </div>

            {/* Main Content Grid */}
            <div className="dashboard-grid">
                <div className="card recent-activity">
                    <div className="card-header">
                        <h3>Recent Activity (Real-time)</h3>
                    </div>
                    <table className="simple-table">
                        <thead>
                            <tr>
                                <th>Action</th>
                                <th>Details</th>
                                <th>Time</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            {activities.length === 0 ? (
                                <tr><td colSpan="4" style={{ textAlign: 'center', padding: '20px' }}>No recent activity found.</td></tr>
                            ) : (
                                activities.map((act, i) => (
                                    <tr key={i}>
                                        <td>{act.action}</td>
                                        <td>{act.details}</td>
                                        <td>{act.time}</td>
                                        <td>
                                            <span className={`tag ${act.status === 'Success' ? 'success' : act.status === 'Ready' ? 'info' : 'warning'}`}>
                                                {act.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="card quick-actions">
                    <div className="card-header">
                        <h3>Quick Actions</h3>
                    </div>
                    <div className="action-buttons">
                        <button className="btn-primary full-width" onClick={() => setActivePage('templates_new')}>
                            Onboard New Template
                        </button>
                        <button className="btn-secondary full-width" onClick={() => setActivePage('applications_new')}>
                            Start New Application
                        </button>
                        <button className="btn-outline full-width" onClick={() => setActivePage('mappings')}>
                            Review Mappings
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
