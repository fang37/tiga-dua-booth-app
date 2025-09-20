import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import path from 'node:path';
import fs from 'fs';
import { initializeDatabase, createProject, getProjects, getProjectById, findVoucherByCode, assignPhotosToCustomer, getCustomersByProjectId, getPhotosByCustomerId, revertPhotosToRaw, runHealthCheckForProject, saveCroppedImage, generateVouchersForProject, redeemVoucher, getEditedPhotosByCustomerId, getAllTemplates, createTemplate, setTemplatesForProject, getTemplatesForProject, exportGridImage, setVoucherDistributed, getExportedFilesForCustomer } from './services/database.js';
import { generateThumbnail } from './services/thumbnailService.js';
import { distributeToDrive } from './services/googleDriveService.js';
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
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false,
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  initializeDatabase();

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

  ipcMain.handle('distribute-to-drive', async (event, data) => {
    return distributeToDrive(data);
  });

  ipcMain.handle('set-voucher-distributed', (event, data) => {
    return setVoucherDistributed(data);
  });

  ipcMain.handle('get-exported-files-for-customer', (event, data) => {
    return getExportedFilesForCustomer(data);
  });

  ipcMain.on('start-watching', (event, projectPath) => {
    const rawFolderPath = path.join(projectPath, 'raw');

    console.log(`[Watcher] Starting to watch: ${rawFolderPath}`);

    watcher = chokidar.watch(rawFolderPath, {
      ignored: /^\./, // ignore dotfiles
      persistent: true
    });

    watcher.on('add', async (filePath) => {
      console.log(`[Watcher] Detected new file: ${filePath}`);

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
