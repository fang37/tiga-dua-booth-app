import React, { useState, useEffect } from 'react';

function Settings({ onBack }) {
  const [qrCodeBaseUrl, setQrCodeBaseUrl] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      const url = await window.api.getSetting('qrCodeBaseUrl');
      if (url) {
        setQrCodeBaseUrl(url);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    const result = await window.api.saveSetting({ key: 'qrCodeBaseUrl', value: qrCodeBaseUrl });
    if (result.success) {
      alert('Settings saved successfully!');
    } else {
      alert(`Error saving settings: ${result.error}`);
    }
  };

  return (
    <div className="settings-container">
      <button className="btn-secondary back-btn" onClick={onBack}>&larr; Back</button>
      <h1>Settings</h1>

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

      <button className="btn-primary" onClick={handleSave}>Save Settings</button>
    </div>
  );
}

export default Settings;