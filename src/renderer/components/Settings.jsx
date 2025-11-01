import React, { useState, useEffect } from 'react';

function Settings({ onBack }) {
  const [qrCodeBaseUrl, setQrCodeBaseUrl] = useState('');
  const [qrColorDark, setQrColorDark] = useState('#444341');
  const [qrColorLight, setQrColorLight] = useState('#00000000');
  const [projectBasePath, setProjectBasePath] = useState('');
  const [isBackingUp, setIsBackingUp] = useState(false);

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
    };
    fetchSettings();
  }, []);

  const handleBrowseBasePath = async () => {
    const path = await window.api.openFolderDialog();
    if (path) {
      setProjectBasePath(path);
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
      ]);

      // Check if ALL operations were successful
      const allSucceeded = results.every(result => result.success);

      if (allSucceeded) {
        alert('Settings saved successfully! 🎉');
      } else {
        // Find the first error message if any failed
        const firstError = results.find(result => !result.success)?.error || 'Unknown error';
        throw new Error(firstError); // Throw an error to be caught below
      }
    } catch (error) {
      alert(`Error saving settings: ${error.message}`);
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