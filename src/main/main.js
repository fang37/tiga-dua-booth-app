import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron';
import path from 'node:path';
import fs from 'fs';
import { getSetting, saveSetting } from './services/settingsService.js';
import { initializeDatabase, createProject, getProjects, getProjectById, findVoucherByCode, assignPhotosToCustomer, getCustomersByProjectId, getPhotosByCustomerId, revertPhotosToRaw, runHealthCheckForProject, saveCroppedImage, generateVouchersForProject, redeemVoucher, getEditedPhotosByCustomerId, getAllTemplates, createTemplate, setTemplatesForProject, getTemplatesForProject, exportGridImage, setVoucherDistributed, getExportedFilesForCustomer, updateVoucherStatus, generateVouchersAndQRCodes, getPendingDistribution, getSingleCustomerForDistribution, exportBlankTemplate, getPhotoAsBase64, setTemplateOverlay, removeTemplateOverlay } from './services/database.js';
import { generateThumbnail } from './services/thumbnailService.js';
import { distributeToDrive } from './services/googleDriveService.js';
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
  const devServerUrl = 'http://localhost:5173';
  const viteName = process.env.VITE_NAME || 'renderer';


  if (isDev) {
    mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools();
  } else {
    // Load the built Vite index.html from the dist directory
    mainWindow.loadFile(path.join(__dirname, '../renderer/dist/index.html'));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  protocol.handle('safe-file', (request, callback) => {
    const url = request.url.substr(7);
    return net.fetch(url)
  })

  initializeDatabase();

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
    let fullPath;
    if (data.customerFolder) {
      fullPath = path.join(data.basePath, data.customerFolder, data.subfolder);
    } else {
      fullPath = path.join(data.basePath, data.subfolder);
    }
    shell.openPath(fullPath);
  });

  ipcMain.handle('get-templates-for-project', (event, data) => getTemplatesForProject(data));

  ipcMain.handle('set-templates-for-project', (event, data) => setTemplatesForProject(data));

  ipcMain.handle('distribute-to-drive', async (event, data) => { return distributeToDrive(data); });

  ipcMain.handle('send-link-to-mapper', async (event, data) => { return sendLinkToMapper(data); });

  ipcMain.handle('set-voucher-distributed', (event, data) => { return setVoucherDistributed(data); });

  ipcMain.handle('update-voucher-status', (event, data) => { return updateVoucherStatus(data); });

  ipcMain.handle('get-exported-files-for-customer', (event, data) => { return getExportedFilesForCustomer(data); });

  ipcMain.handle('get-setting', (event, key) => getSetting(key));

  ipcMain.handle('save-setting', (event, data) => saveSetting(data));

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

  ipcMain.handle('get-photo-as-base64', async (event, id) => {
    return getPhotoAsBase64(id);
  });
  
  ipcMain.handle('remove-template-overlay', (event, data) => removeTemplateOverlay(data));

  ipcMain.on('start-watching', (event, projectPath) => {
    const rawFolderPath = path.join(projectPath, 'raw');

    // console.log(`[Watcher] Starting to watch: ${rawFolderPath}`);

    watcher = chokidar.watch(rawFolderPath, {
      ignored: /^\./, // ignore dotfiles
      persistent: true
    });

    watcher.on('add', async (filePath) => {
      // console.log(`[Watcher] Detected new file: ${filePath}`);

      // Generate a thumbnail for the new photo
      const thumbPath = await generateThumbnail(filePath);

      // Send an object with both paths to the UI
      if (thumbPath) {
        event.sender.send('new-photo-added', { rawPath: filePath, thumbPath });
      }
    });
  });

  ipcMain.on('stop-watching', () => {
    if (watcher) {
      watcher.close();
      watcher = null;
    }
  });

  createWindow();

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
