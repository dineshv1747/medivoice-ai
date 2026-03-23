import { useState } from 'react';
import './HistoryPanel.css';

const TYPE_ICON = { voice: '🎤', text: '⌨️', image: '📸' };
const TYPE_LABEL = { voice: 'Voice', text: 'Text', image: 'Image' };

function formatDate(ts) {
  return new Date(ts).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function preview(text, len = 100) {
  if (!text) return '—';
  const clean = text.replace(/\n/g, ' ').trim();
  return clean.length > len ? clean.slice(0, len) + '…' : clean;
}

function HistoryPanel({ history, onDelete, onClearAll, onClose }) {
  const [detailItem, setDetailItem] = useState(null);
  const [filterDate, setFilterDate] = useState('');

  const filtered = history
    .filter(item => {
      if (!filterDate) return true;
      const d = new Date(item.timestamp);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return iso === filterDate;
    })
    .sort((a, b) => b.timestamp - a.timestamp); // newest first

  if (detailItem) {
    return (
      <div className="history-panel">
        <div className="history-header">
          <button className="history-back-btn" onClick={() => setDetailItem(null)}>
            ← Back to History
          </button>
          <button className="history-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="history-detail">
          <div className="detail-meta">
            <span className="detail-type-icon">{TYPE_ICON[detailItem.type]}</span>
            <div>
              <p className="detail-type">{TYPE_LABEL[detailItem.type]} Search</p>
              <p className="detail-date">{formatDate(detailItem.timestamp)}</p>
            </div>
          </div>

          {detailItem.symptoms && (
            <div className="detail-section">
              <p className="detail-section-title">Symptoms</p>
              <p className="detail-section-body">"{detailItem.symptoms}"</p>
            </div>
          )}

          {detailItem.analysisText && (
            <div className="detail-section">
              <p className="detail-section-title">MediVoice AI Analysis</p>
              <div className="detail-analysis">
                {detailItem.analysisText.split('\n').filter(l => l.trim()).map((line, i) => (
                  <p key={i} className="detail-line">{line}</p>
                ))}
              </div>
            </div>
          )}

          {detailItem.imageAnalysis && (
            <div className="detail-section">
              <p className="detail-section-title">Image Analysis</p>
              <div className="detail-analysis">
                {detailItem.imageAnalysis.split('\n').filter(l => l.trim()).map((line, i) => (
                  <p key={i} className="detail-line">{line}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="history-panel">
      {/* Panel Header */}
      <div className="history-header">
        <div className="history-header-left">
          <h2 className="history-title">📋 Search History</h2>
          <span className="history-count">{history.length} {history.length === 1 ? 'search' : 'searches'}</span>
        </div>
        <button className="history-close-btn" onClick={onClose}>✕</button>
      </div>

      {/* Controls */}
      <div className="history-controls">
        <input
          type="date"
          className="history-date-filter"
          value={filterDate}
          onChange={e => setFilterDate(e.target.value)}
          title="Filter by date"
        />
        {filterDate && (
          <button className="history-clear-filter" onClick={() => setFilterDate('')}>
            Clear filter
          </button>
        )}
        {history.length > 0 && (
          <button className="history-clear-all-btn" onClick={onClearAll}>
            🗑 Clear All
          </button>
        )}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="history-empty">
          {history.length === 0 ? (
            <>
              <p className="history-empty-icon">📋</p>
              <p className="history-empty-title">No search history yet.</p>
              <p className="history-empty-sub">Start by analyzing your symptoms!</p>
            </>
          ) : (
            <>
              <p className="history-empty-icon">🔍</p>
              <p className="history-empty-title">No results for this date.</p>
            </>
          )}
        </div>
      ) : (
        <ul className="history-list">
          {filtered.map(item => (
            <li key={item.id} className="history-card" data-type={item.type}>
              <div className="hcard-top">
                <span className="hcard-icon">{TYPE_ICON[item.type]}</span>
                <div className="hcard-meta">
                  <span className="hcard-type">{TYPE_LABEL[item.type]} Search</span>
                  <span className="hcard-date">{formatDate(item.timestamp)}</span>
                </div>
                <button
                  className="hcard-delete-btn"
                  onClick={() => onDelete(item.id)}
                  title="Delete"
                >
                  🗑
                </button>
              </div>

              {item.symptoms && (
                <p className="hcard-symptoms">
                  <strong>Symptoms:</strong> {preview(item.symptoms, 80)}
                </p>
              )}

              <p className="hcard-preview">
                {preview(item.analysisText || item.imageAnalysis, 120)}
              </p>

              <button
                className="hcard-view-btn"
                onClick={() => setDetailItem(item)}
              >
                View Details →
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default HistoryPanel;
