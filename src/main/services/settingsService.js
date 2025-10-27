import { app } from 'electron';
import path from 'path';
import fs from 'fs';

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json');

function readSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const rawData = fs.readFileSync(SETTINGS_PATH);
      return JSON.parse(rawData);
    }
  } catch (error) {
    console.error('Failed to read settings:', error);
  }
  return {};
}

export function getSetting(key, defaultValue = null) {
  const settings = readSettings();
  return settings[key] !== undefined ? settings[key] : defaultValue;
}

export function saveSetting({ key, value }) {
  const settings = readSettings();
  settings[key] = value;
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    return { success: true };
  } catch (error) {
    console.error('Failed to save settings:', error);
    return { success: false, error: error.message };
  }
}