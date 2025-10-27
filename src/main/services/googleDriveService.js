import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { authenticate } from '@google-cloud/local-auth';
import { app } from 'electron';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const CREDENTIALS_PATH = path.join(app.getAppPath(), 'credentials.json');
const TOKEN_PATH = path.join(app.getPath('userData'), 'token.json');

/**
 * A more robust authorization function.
 */
async function authorize() {
  try {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have previously stored a token.
    if (fs.existsSync(TOKEN_PATH)) {
      const token = fs.readFileSync(TOKEN_PATH);
      oAuth2Client.setCredentials(JSON.parse(token));
      return oAuth2Client;
    }

    // If no token, authenticate and get a new one.
    const newClient = await authenticate({
      scopes: SCOPES,
      keyfilePath: CREDENTIALS_PATH,
    });
    
    if (newClient.credentials) {
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(newClient.credentials));
      oAuth2Client.setCredentials(newClient.credentials);
      return oAuth2Client;
    }
  } catch (err) {
    console.error('Error during authorization:', err);
    return null;
  }
}

/**
 * Uploads a file and creates a shareable link.
 */
async function uploadAndShareFile(authClient, { filePaths, projectName, voucherCode, eventDate }) {
  const drive = google.drive({ version: 'v3', auth: authClient });

  // 1. Create the folder structure (this logic is the same)
  const dateFolderId = await findOrCreateFolder(drive, { name: eventDate });
  const projectFolderId = await findOrCreateFolder(drive, { name: projectName, parentId: dateFolderId });
  const voucherFolderId = await findOrCreateFolder(drive, { name: voucherCode, parentId: projectFolderId });

  // 2. Loop through each file path and upload it
  for (const filePath of filePaths) {
    await drive.files.create({
      resource: { 
        name: path.basename(filePath),
        parents: [voucherFolderId] 
      },
      media: { mimeType: 'image/jpeg', body: fs.createReadStream(filePath) },
    });
  }
  
  // 3. Make the voucher folder public and get its link (this is the same)
  await drive.permissions.create({
    fileId: voucherFolderId,
    requestBody: { role: 'reader', type: 'anyone' },
  });
  const result = await drive.files.get({
    fileId: voucherFolderId,
    fields: 'webViewLink',
  });
  return result.data.webViewLink;
}

async function findOrCreateFolder(drive, { name, parentId }) {
  let query = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }
  
  const search = await drive.files.list({ q: query, fields: 'files(id)' });
  if (search.data.files.length > 0) {
    return search.data.files[0].id;
  }

  const folder = await drive.files.create({
    resource: { name, mimeType: 'application/vnd.google-apps.folder', parents: parentId ? [parentId] : [] },
    fields: 'id',
  });
  return folder.data.id;
}

// Export a single function that handles everything
export async function distributeToDrive({ filePaths, projectName, voucherCode, eventDate }) {
    try {
        const authClient = await authorize();
        if (!authClient) throw new Error('Authorization failed.');
        const link = await uploadAndShareFile(authClient, { filePaths, projectName, voucherCode, eventDate });
        return { success: true, link };
    } catch (error) {
        console.error('Failed to distribute to Google Drive:', error);
        return { success: false, error: error.message };
    }
}