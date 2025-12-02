import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import './Header.css';

const Header = () => {
  const [health, setHealth] = useState(null);
  const [showHealth, setShowHealth] = useState(false);

  const loadHealth = useCallback(async () => {
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch (error) {
      console.error('Failed to load health:', error);
    }
  }, []);

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [loadHealth]);

  return (
    <header className="app-header">
      <div className="header-content">
        <h1>LLM Visibility Dashboard</h1>
        <div className="header-actions">
          <button
            className="health-button"
            onClick={() => setShowHealth(!showHealth)}
            title="System Health"
          >
            <span
              className={`status-indicator ${
                health?.status === 'ok' ? 'ok' : 'error'
              }`}
            ></span>
            Health
          </button>
        </div>
      </div>

      {showHealth && health && (
        <div className="health-panel">
          <div className="health-section">
            <h3>System Status</h3>
            <div className="health-item">
              <span>Status:</span>
              <span
                className={
                  health.status === 'ok' ? 'status-ok' : 'status-error'
                }
              >
                {health.status}
              </span>
            </div>
            <div className="health-item">
              <span>Timestamp:</span>
              <span>{new Date(health.timestamp).toLocaleString()}</span>
            </div>
          </div>

          {health.redis && (
            <div className="health-section">
              <h3>Redis</h3>
              <div className="health-item">
                <span>Connected:</span>
                <span
                  className={
                    health.redis.connected ? 'status-ok' : 'status-error'
                  }
                >
                  {health.redis.connected ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="health-item">
                <span>Memory Used:</span>
                <span>{health.redis.usedMemory}</span>
              </div>
              <div className="health-item">
                <span>Connected Clients:</span>
                <span>{health.redis.connectedClients}</span>
              </div>
            </div>
          )}

          {health.rateLimiting && (
            <div className="health-section">
              <h3>Rate Limiting</h3>
              <div className="health-item">
                <span>Distributed Mode:</span>
                <span
                  className={
                    health.rateLimiting.distributedEnabled
                      ? 'status-ok'
                      : 'status-warning'
                  }
                >
                  {health.rateLimiting.distributedEnabled
                    ? 'Enabled'
                    : 'Disabled'}
                </span>
              </div>
              {health.rateLimiting.localLimiters &&
                Object.entries(health.rateLimiting.localLimiters).map(
                  ([provider, stats]) => (
                    <div key={provider} className="health-item">
                      <span>{provider}:</span>
                      <span>
                        Running: {stats.running}, Queued: {stats.queued}, Done:{' '}
                        {stats.done}
                      </span>
                    </div>
                  ),
                )}
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
