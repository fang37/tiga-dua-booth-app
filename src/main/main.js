import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron';
import path from 'node:path';
import fs from 'fs';
import { getSetting, saveSetting } from './services/settingsService.js';
import { initializeDatabase, createProject, getProjects, getProjectById, findVoucherByCode, assignPhotosToCustomer, getCustomersByProjectId, getPhotosByCustomerId, revertPhotosToRaw, runHealthCheckForProject, saveCroppedImage, generateVouchersForProject, redeemVoucher, getEditedPhotosByCustomerId, getAllTemplates, createTemplate, setTemplatesForProject, getTemplatesForProject, exportGridImage, getExportedFilesForCustomer, generateVouchersAndQRCodes, getPendingDistribution, getSingleCustomerForDistribution, exportBlankTemplate, setTemplateOverlay, removeTemplateOverlay, getProjectFileAsBase64, getUserDataFileAsBase64, getProjectBasePath, scanRawPhotos, updateCustomerWorkflowStatus } from './services/database.js';
import { generateThumbnail } from './services/thumbnailService.js';
import { distributeToDrive } from './services/googleDriveService.js';
import { triggerBackup } from './services/backupService.js';
import { sendLinkToMapper } from './services/apiService.js';
import { processDistributionForCustomer } from './services/distributionService.js';
import started from 'electron-squirrel-startup';
import chokidar from 'chokidar';

let watcher = null; // Variable to hold our watcher instance

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 768,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      webSecurity: true,
    },
  });

  // Dev/prod switch for loading the app
  const isDev = process.env.NODE_ENV === 'development' || process.env.VITE_DEV_SERVER_URL;
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';

  if (isDev) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // Load the built Vite index.html from the dist directory
    mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
    // Open DevTools in production to see console.log
    mainWindow.webContents.openDevTools();
  }

  // Add keyboard shortcut to toggle DevTools (F12 or Ctrl+Shift+I)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' || (input.control && input.shift && input.key === 'I')) {
      mainWindow.webContents.toggleDevTools();
    }
  });

  return mainWindow;
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  protocol.handle('safe-file', (request, callback) => {
    const url = request.url.substr(7);
    return fetch(url)
  })

  initializeDatabase();

  const apiKey = process.env.API_SECRET_KEY;
  const apiUrl = process.env.API_ENDPOINT;
  if (!apiKey || !apiUrl) {
    console.error('FATAL ERROR: API secrets are missing.');
    console.error('Ensure .env file is next to the executable in production.');
    
    // Show a native error message to the user
    dialog.showErrorBox(
      'Configuration Error',
      'API key or endpoint is missing. Please ensure the .env file is in the correct folder and restart the application.'
    );
  }

  ipcMain.handle('show-item-in-folder', (event, fullPath) => {
    shell.showItemInFolder(fullPath);
  });

  ipcMain.handle('create-project', async (event, projectData) => {
    const result = createProject(projectData);
    return result;
  });

  ipcMain.handle('get-projects', async () => {
    const projects = getProjects();
    return projects;
  });

  ipcMain.handle('get-project-by-id', async (event, id) => {
    return getProjectById(id);
  });

  ipcMain.handle('get-photos-by-customer-id', async (event, id) => {
    return getPhotosByCustomerId(id);
  });

  ipcMain.handle('find-voucher-by-code', async (event, data) => {
    return findVoucherByCode(data);
  });

  ipcMain.handle('get-customers-by-project-id', async (event, id) => {
    return getCustomersByProjectId(id);
  });

  ipcMain.handle('generate-vouchers-for-project', async (event, data) => {
    return generateVouchersForProject(data);
  });

  ipcMain.handle('generate-vouchers-and-qr', async (event, data) => {
    return generateVouchersAndQRCodes(data);
  });

  ipcMain.handle('redeem-voucher', async (event, data) => {
    return redeemVoucher(data);
  });

  ipcMain.handle('assign-photos', async (event, data) => {
    return assignPhotosToCustomer(data);
  });

  ipcMain.handle('revert-photos-to-raw', async (event, data) => {
    // We need the project's folder path to know where to move the files back to
    const project = getProjectById(data.projectId);
    return revertPhotosToRaw({ photoIds: data.photoIds, projectFolderPath: project.folder_path });
  });

  ipcMain.handle('run-health-check', async (event, id) => {
    return runHealthCheckForProject(id);
  });

  ipcMain.handle('get-edited-photos', async (event, customerId) => {
    return getEditedPhotosByCustomerId(customerId);
  });

  ipcMain.handle('save-cropped-image', async (event, data) => {
    return saveCroppedImage(data);
  });

  ipcMain.handle('export-grid-image', async (event, data) => {
    return exportGridImage(data);
  });

  ipcMain.handle('get-all-templates', () => getAllTemplates());

  ipcMain.handle('create-template', (event, data) => createTemplate(data));

  ipcMain.handle('open-file-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg'] }]
    });
    return canceled ? null : filePaths[0];
  });

  ipcMain.handle('open-folder', (event, data) => {
    try {
      const basePath = getProjectBasePath();
      let fullPath;

      if (data.relativeProjectPath) {
        fullPath = path.join(basePath, data.relativeProjectPath, data.subfolder);
      } else if (data.customerFolder) {
        fullPath = path.join(basePath, data.basePath, data.customerFolder, data.subfolder);
      } else {
        throw new Error('Invalid data received for open-folder');
      }

      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }

      shell.openPath(fullPath);

    } catch (error) {
      console.error('Failed opening folder:', error);
    }
  });

  ipcMain.handle('open-folder-dialog', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    return canceled ? null : filePaths[0];
  });

  ipcMain.handle('get-templates-for-project', (event, data) => getTemplatesForProject(data));

  ipcMain.handle('set-templates-for-project', (event, data) => setTemplatesForProject(data));

  ipcMain.handle('distribute-to-drive', async (event, data) => { return distributeToDrive(data); });

  ipcMain.handle('send-link-to-mapper', async (event, data) => { return sendLinkToMapper(data); });

  ipcMain.handle('update-customer-workflow-status', (event, data) => updateCustomerWorkflowStatus(data));

  ipcMain.handle('get-exported-files-for-customer', (event, data) => { return getExportedFilesForCustomer(data); });

  ipcMain.handle('get-setting', (event, key) => getSetting(key));

  ipcMain.handle('save-setting', (event, data) => saveSetting(data));

  ipcMain.handle('trigger-backup', async () => { return triggerBackup(); });

  ipcMain.handle('batch-distribute-all', async (event, projectId) => {
    const pendingJobs = getPendingDistribution(projectId);
    const totalJobs = pendingJobs.length;
    let successes = 0;

    for (let i = 0; i < totalJobs; i++) {
      const job = pendingJobs[i];
      const result = await processDistributionForCustomer(job, (message) => {
        event.sender.send('batch-progress-update', { current: i + 1, total: totalJobs, name: message });
      });
      if (result.success) successes++;
    }
    return { success: true, successes, total: totalJobs };
  });

  ipcMain.handle('distribute-single-customer', async (event, customerId) => {
    const jobData = getSingleCustomerForDistribution(customerId);
    return processDistributionForCustomer(jobData);
  });

  ipcMain.handle('export-blank-template', (event, data) => exportBlankTemplate(data));

  ipcMain.handle('set-template-overlay', (event, data) => setTemplateOverlay(data));

  ipcMain.handle('get-project-file-as-base64', async (event, id) => {
    return getProjectFileAsBase64(id);
  });

  ipcMain.handle('get-user-data-file-as-base64', async (event, id) => {
    return getUserDataFileAsBase64(id);
  });

  ipcMain.handle('remove-template-overlay', (event, data) => removeTemplateOverlay(data));

  ipcMain.handle('scan-raw-photos', (e, id) => scanRawPhotos(id));

  ipcMain.on('start-watching', (event, projectPath) => {
    const projectsBasePath = getProjectBasePath();
    const absoluteRawFolderPath = path.join(projectsBasePath, projectPath, 'raw');

    console.log(`[Watcher Setup] Received request for project path: ${projectPath}`);
    console.log(`[Watcher Setup] Watching folder: ${absoluteRawFolderPath}`);

    if (watcher) {
      console.log('[Watcher Setup] Closing previous watcher.');
      watcher.close();
    }

    watcher = chokidar.watch(absoluteRawFolderPath, {
      ignored: /^\./,
      persistent: true,
      ignoreInitial: false,
      awaitWriteFinish: {
        stabilityThreshold: 2000,
        pollInterval: 100
      }
    });

    watcher.on('ready', () => {
      console.log(`[Watcher Ready] Initial scan complete. Ready for changes.`);
    });

    watcher.on('all', (eventName, filePath) => {
      console.log(`[Watcher All Events] Event: '${eventName}', File: ${filePath}`);
    });

    watcher.on('add', async (filePath) => {
      // This 'add' event will now fire for .arw, .jpg, etc.
      // So our filter inside is more important than ever.
      if (/\.(jpg|jpeg)$/i.test(filePath)) {
        console.log(`[Watcher Logic] File is a JPEG. Generating thumbnail...`);
        try {
          const thumbDataUrl = await generateThumbnail(filePath);
          if (thumbDataUrl) {
            console.log(`[Watcher Logic] Thumbnail generated. Sending 'new-photo-added' to UI.`);
            event.sender.send('new-photo-added', { rawPath: filePath, thumbPath: thumbDataUrl });
          }
        } catch (error) {
          console.error(`[Watcher Error] Thumbnail generation failed:`, error);
        }
      } else {
        console.log(`[Watcher Logic] File is NOT a JPEG, ignoring: ${filePath}`);
      }
    });

    watcher.on('unlink', (filePath) => {
      console.log(`[Watcher Event] 'unlink' event detected for: ${filePath}`);
      event.sender.send('photo-removed', filePath);
    });

  });

  ipcMain.on('stop-watching', () => {
    if (watcher) {
      watcher.close();
      watcher = null;
    }
  });

  createWindow();

  // Redirect main process console.log to renderer for easier debugging
  const originalConsoleLog = console.log;
  console.log = (...args) => {
    originalConsoleLog(...args); // Still log to terminal
    // Also send to renderer process
    const allWindows = BrowserWindow.getAllWindows();
    if (allWindows.length > 0) {
      allWindows[0].webContents.executeJavaScript(`console.log('[Main Process]', ${JSON.stringify(args.join(' '))})`);
    }
  };

  // Temp for testing
  // createProject({ name: "Andy & Betty's Wedding", event_date: '2025-09-13' });
  // generateVouchersForProject({ projectId: 2, quantity: 100 });
  // redeemVoucher({ 
  //   voucherCode: '6VG2DT', 
  //   name: 'Migh', 
  //   email: 'mirfan.ghifari@gmail.com',
  //   phoneNumber: '085722005675'
  // });

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
