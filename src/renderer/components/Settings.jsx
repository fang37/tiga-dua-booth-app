import React, { useState, useEffect } from 'react';

function Settings({ onBack }) {
  const [qrCodeBaseUrl, setQrCodeBaseUrl] = useState('');
  const [qrColorDark, setQrColorDark] = useState('#444341');
  const [qrColorLight, setQrColorLight] = useState('#00000000');

  useEffect(() => {
    const fetchSettings = async () => {
      const url = await window.api.getSetting('qrCodeBaseUrl');
      if (url) {
        setQrCodeBaseUrl(url);
      }

      // Fetch colors, using defaults if not found
      const dark = await window.api.getSetting('qrColorDark', '#444341');
      const light = await window.api.getSetting('qrColorLight', '#00000000');
      setQrColorDark(dark);
      setQrColorLight(light);
    };
    fetchSettings();
  }, []);

 const handleSave = async () => {
    try {
      // Run all save operations concurrently
      const results = await Promise.all([
        window.api.saveSetting({ key: 'qrCodeBaseUrl', value: qrCodeBaseUrl }),
        window.api.saveSetting({ key: 'qrColorDark', value: qrColorDark }),
        window.api.saveSetting({ key: 'qrColorLight', value: qrColorLight })
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

      <button className="btn-primary" onClick={handleSave}>Save Settings</button>
    </div>
  );
}

export default Settings;