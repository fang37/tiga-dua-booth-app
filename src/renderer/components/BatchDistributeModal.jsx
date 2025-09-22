import React, { useState, useEffect } from 'react';

function BatchDistributeModal({ isOpen, onClose }) {
  const [progress, setProgress] = useState(null);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (isOpen) {
      // Reset state and start the process
      setProgress({ current: 0, total: '?', name: 'Starting...' });
      setSummary(null);

      console.log('[Batch Modal] Modal is open. Calling batchDistributeAll backend function...');

      window.api.batchDistributeAll().then(result => {
        setSummary(`Complete! ${result.successes} of ${result.total} jobs succeeded.`);
      });
    }

    // Listen for progress updates from the backend
    const unsubscribe = window.api.onBatchProgress((update) => {
      setProgress(update);
    });

    const cleanupListener = window.api.onBatchProgress((update) => {
      console.log('[Batch Modal] Received progress update:', update);
      setProgress(update);
    });

    // Cleanup listener when modal closes or component unmounts
    return () => {
      if (cleanupListener) {
        cleanupListener();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Batch Distribution in Progress...</h2>
        {progress && !summary && (
          <div>
            <p>Processing {progress.current} of {progress.total}</p>
            <p>Current: {progress.name}</p>
            <progress value={progress.current} max={progress.total}></progress>
          </div>
        )}
        {summary && (
          <div>
            <h3>{summary}</h3>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn-secondary" onClick={onClose} disabled={!summary}>Close</button>
        </div>
      </div>
    </div>
  );
}

export default BatchDistributeModal;