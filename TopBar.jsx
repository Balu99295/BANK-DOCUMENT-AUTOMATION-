import React from 'react';
import { Bell, Search } from 'lucide-react';

const TopBar = ({ title }) => {
    return (
        <header className="topbar">
            <div className="page-title">
                <h1>{title}</h1>
            </div>

            <div className="topbar-actions">
                <div className="search-bar">
                    <Search size={16} className="search-icon" />
                    <input type="text" placeholder="Search..." />
                </div>
                <button className="icon-btn">
                    <Bell size={20} />
                    <span className="badge">3</span>
                </button>
            </div>
        </header>
    );
};

export default TopBar;
