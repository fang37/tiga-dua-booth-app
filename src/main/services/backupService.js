import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { authorize } from './googleDriveService.js'; // We'll reuse the authorization
import { getSetting, saveSetting } from './settingsService.js';
import { dbPath } from './database.js';

// Helper to find or create the main backup folder
async function findOrCreateBackupFolder(drive) {
  let folderId = getSetting('backupFolderId');
  if (folderId) {
    return folderId; // We already have it
  }

  // If not, find or create it in the root of Google Drive
  const folderName = 'TigaDuaBooth Backups';
  const query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and 'root' in parents and trashed=false`;
  
  const search = await drive.files.list({ q: query, fields: 'files(id)' });
  if (search.data.files.length > 0) {
    folderId = search.data.files[0].id;
  } else {
    const folder = await drive.files.create({
      resource: { name: folderName, mimeType: 'application/vnd.google-apps.folder' },
      fields: 'id',
    });
    folderId = folder.data.id;
  }
  
  saveSetting({ key: 'backupFolderId', value: folderId });
  return folderId;
}

// Main function to trigger the backup
export async function triggerBackup() {
  try {
    // 1. Authorize
    const authClient = await authorize();
    if (!authClient) throw new Error('Google Drive authorization failed.');
    
    const drive = google.drive({ version: 'v3', auth: authClient });

    // 2. Find or create the "TigaDuaBooth Backups" folder
    const backupFolderId = await findOrCreateBackupFolder(drive);

    // 3. Get the path to the local database file
    if (!fs.existsSync(dbPath)) {
      throw new Error('Database file not found.');
    }

    // 4. Upload the database file
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const fileName = `photobooth-backup-${timestamp}.db`;

    await drive.files.create({
      resource: {
        name: fileName,
        parents: [backupFolderId]
      },
      media: {
        mimeType: 'application/x-sqlite3',
        body: fs.createReadStream(dbPath)
      },
    });

    return { success: true, fileName };
  } catch (error) {
    console.error('Backup failed:', error);
    return { success: false, error: error.message };
  }
}