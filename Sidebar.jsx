import { LayoutDashboard, FileText, Link, CheckSquare, BookOpen, Shield, Settings, Database, BrainCircuit } from 'lucide-react';

const Sidebar = ({ activePage, setActivePage }) => {
    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'templates', label: 'Templates', icon: FileText },
        { id: 'mappings', label: 'Intelligent Mapper', icon: BrainCircuit },
        { id: 'applications', label: 'Applications', icon: CheckSquare },
        { id: 'schema', label: 'Standard Schema', icon: Database },
        { id: 'policies', label: 'Policies', icon: BookOpen },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <Shield className="logo-icon" size={28} />
                <div className="logo-text">
                    <span className="brand">BankAuto</span>
                    <span className="platform">Platform</span>
                </div>
            </div>

            <nav className="sidebar-nav">
                {menuItems.map((item) => {
                    const Icon = item.icon;
                    // Improved active state checking
                    const isActive = activePage === item.id || activePage.startsWith(item.id + '_');
                    return (
                        <button
                            key={item.id}
                            className={`nav-item ${isActive ? 'active' : ''}`}
                            onClick={() => setActivePage(item.id)}
                        >
                            <Icon size={20} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <div className="user-profile">
                    <div className="avatar">A</div>
                    <div className="user-info">
                        <span className="name">Admin User</span>
                        <span className="role">Ops Manager</span>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
