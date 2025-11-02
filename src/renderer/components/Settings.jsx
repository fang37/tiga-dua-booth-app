import React, { useState, useEffect } from 'react';
import { useNotification } from './NotificationContext';

function Settings({ onBack }) {
  const { showNotification } = useNotification();
  const [qrCodeBaseUrl, setQrCodeBaseUrl] = useState('');
  const [qrColorDark, setQrColorDark] = useState('#444341');
  const [qrColorLight, setQrColorLight] = useState('#00000000');
  const [projectBasePath, setProjectBasePath] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);

  // --- NEW: States for Print Queue Settings ---
  const [stockPhotoPath, setStockPhotoPath] = useState('');
  const [orphanWaitTime, setOrphanWaitTime] = useState(10);
  const [restAfterPrints, setRestAfterPrints] = useState(10);
  const [restDuration, setRestDuration] = useState(5);
  const [availablePrinters, setAvailablePrinters] = useState([]);
  const [selectedPrinter, setSelectedPrinter] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      const url = await window.api.getSetting('qrCodeBaseUrl');
      if (url) {
        setQrCodeBaseUrl(url);
      }

      // Fetch colors, using defaults if not found
      const dark = await window.api.getSetting('qrColorDark', '#444341');
      setQrColorDark(dark);

      const light = await window.api.getSetting('qrColorLight', '#00000000');
      setQrColorLight(light);

      const base = await window.api.getSetting('projectBasePath');
      if (base) setProjectBasePath(base);

      // --- NEW: Fetch Print Settings ---
      setStockPhotoPath(await window.api.getSetting('stockPhotoPath', ''));
      setOrphanWaitTime(await window.api.getSetting('orphanWaitTime', 10));
      setRestAfterPrints(await window.api.getSetting('restAfterPrints', 10));
      setRestDuration(await window.api.getSetting('restDuration', 5));
      // --- NEW: Fetch Printers ---
      const printers = await window.api.getAvailablePrinters();
      setAvailablePrinters(printers);

      const savedPrinter = await window.api.getSetting('selectedPrinterName', '');
      setSelectedPrinter(savedPrinter);
    };
    fetchSettings();
  }, []);

  const handleBrowseBasePath = async () => {
    const path = await window.api.openFolderDialog();
    if (path) {
      setProjectBasePath(path);
    }
  };


  const handleBrowseStockPhoto = async () => {
    const path = await window.api.openFileDialog();
    if (path) {
      setStockPhotoPath(path);
    }
  };

  const handleSave = async () => {
    try {
      // Run all save operations concurrently
      const results = await Promise.all([
        window.api.saveSetting({ key: 'qrCodeBaseUrl', value: qrCodeBaseUrl }),
        window.api.saveSetting({ key: 'qrColorDark', value: qrColorDark }),
        window.api.saveSetting({ key: 'qrColorLight', value: qrColorLight }),
        window.api.saveSetting({ key: 'projectBasePath', value: projectBasePath }),

        // --- NEW: Save Print Settings ---
        window.api.saveSetting({ key: 'stockPhotoPath', value: stockPhotoPath }),
        window.api.saveSetting({ key: 'orphanWaitTime', value: orphanWaitTime }),
        window.api.saveSetting({ key: 'restAfterPrints', value: restAfterPrints }),
        window.api.saveSetting({ key: 'restDuration', value: restDuration }),
        window.api.saveSetting({ key: 'selectedPrinterName', value: selectedPrinter }),
      ]);

      // Check if ALL operations were successful
      const allSucceeded = results.every(result => result.success);

      if (!allSucceeded) throw new Error('One or more settings failed to save.');

      showNotification('Settings saved successfully!', 'success');
    } catch (error) {
      showNotification(`Error saving settings: ${error.message}`, 'error');
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    const result = await window.api.triggerBackup();
    if (result.success) {
      alert(`Backup successful! File saved to Google Drive as ${result.fileName}`);
    } else {
      alert(`Backup failed: ${result.error}`);
    }
    setIsBackingUp(false);
  };

  return (
    <div className="settings-container">
      <button className="btn-secondary back-btn" onClick={onBack}>&larr; Back</button>
      <h1>Settings</h1>

      {/* --- NEW: Print Queue Section --- */}
      <fieldset className="setting-item-box">
        <legend>Smart Print Queue</legend>
        <label>Select Printer</label>
        <p>Choose the default printer for all print jobs.</p>
        <select value={selectedPrinter} onChange={(e) => setSelectedPrinter(e.target.value)}>
          <option value="">-- No Printer Selected --</option>
          {availablePrinters.map(printerName => (
            <option key={printerName} value={printerName}>{printerName}</option>
          ))}
        </select>
        <p>Manage the automated printing queue for your main PC.</p>
        <div className="form-grid">
          <button className="btn-primary" onClick={() => window.api.startPrintQueue()}>Start Print Queue</button>
          <button className="btn-secondary" onClick={() => window.api.stopPrintQueue()}>Stop Print Queue</button>
        </div>

        <label>Stock Photo (for Orphan Jobs)</label>
        <div className="file-input-wrapper">
          <input type="text" value={stockPhotoPath} onChange={(e) => setStockPhotoPath(e.target.value)} placeholder="Path to your logo or stock photo..." />
          <button type="button" onClick={handleBrowseStockPhoto}>Browse</button>
        </div>

        <div className="form-grid">
          <div>
            <label className="sub-label">Orphan Wait (minutes)</label>
            <input type="number" value={orphanWaitTime} onChange={(e) => setOrphanWaitTime(e.target.value)} />
          </div>
          <div>
            <label className="sub-label">Prints Before Rest</label>
            <input type="number" value={restAfterPrints} onChange={(e) => setRestAfterPrints(e.target.value)} />
          </div>
          <div>
            <label className="sub-label">Rest Duration (minutes)</label>
            <input type="number" value={restDuration} onChange={(e) => setRestDuration(e.target.value)} />
          </div>
        </div>
      </fieldset>

      <div className="setting-item">
        <label htmlFor="base-path">Project Base Path</label>
        <p>The main folder where all your `tiga_dua_booth_projects` are stored.</p>
        <div className="file-input-wrapper">
          <input
            type="text"
            id="base-path"
            value={projectBasePath}
            onChange={(e) => setProjectBasePath(e.target.value)}
            placeholder="e.g., C:\Users\YourName\Documents"
          />
          <button type="button" onClick={handleBrowseBasePath}>Browse</button>
        </div>
      </div>

      <div className="setting-item">
        <label htmlFor="qr-url">QR Code Base URL</label>
        <p>This is the link your QR codes will point to. The app will automatically append `VOUCHER_CODE` to the end.</p>
        <input
          type="text"
          id="qr-url"
          value={qrCodeBaseUrl}
          onChange={(e) => setQrCodeBaseUrl(e.target.value)}
          placeholder="https://your-function-url.net/getPhoto"
        />
      </div>

      <div className="setting-item">
        <label>QR Code Colors</label>
        <p>Set the dark (foreground) and light (background) colors using hex codes (e.g., #444341, #FFFFFF, or #00000000 for transparent).</p>
        <div className="form-grid">
          <div>
            <label className="sub-label">Dark Color</label>
            <input
              type="text" // Change type to text
              value={qrColorDark}
              onChange={(e) => setQrColorDark(e.target.value)}
              placeholder="#444341"
            />
          </div>
          <div>
            <label className="sub-label">Light Color (Background)</label>
            <input
              type="text" // Change type to text
              value={qrColorLight}
              onChange={(e) => setQrColorLight(e.target.value)}
              placeholder="#00000000" // Example for transparent
            />
          </div>
        </div>
      </div>

      <div className="setting-item">
        <label>Database Backup & Restore</label>
        <p>Save your database (projects, customers, templates) to your Google Drive.</p>
        <button
          className="btn-primary"
          onClick={handleBackup}
          disabled={isBackingUp}
        >
          {isBackingUp ? 'Backing up...' : 'Backup Database Now'}
        </button>
      </div>

      <button className="btn-primary" onClick={handleSave}>Save Settings</button>
    </div>
  );
}

export default Settings;