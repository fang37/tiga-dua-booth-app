const { contextBridge, ipcRenderer } = require('electron');

// Expose a secure API to the renderer process
contextBridge.exposeInMainWorld('api', {
    // Project Management
    createProject: (projectData) => ipcRenderer.invoke('create-project', projectData),
    getProjects: () => ipcRenderer.invoke('get-projects'),
    getProjectById: (id) => ipcRenderer.invoke('get-project-by-id', id),
    runHealthCheckForProject: (id) => ipcRenderer.invoke('run-health-check', id),

    // Customer & Voucher Management
    generateVouchersForProject: (data) => ipcRenderer.invoke('generate-vouchers-for-project', data),
    getCustomersByProjectId: (id) => ipcRenderer.invoke('get-customers-by-project-id', id),
    findVoucherByCode: (data) => ipcRenderer.invoke('find-voucher-by-code', data),
    redeemVoucher: (data) => ipcRenderer.invoke('redeem-voucher', data),
    setVoucherDistributed: (data) => ipcRenderer.invoke('set-voucher-distributed', data),
    getExportedFilesForCustomer : (data) => ipcRenderer.invoke('get-exported-files-for-customer', data),
    updateVoucherStatus : (data) => ipcRenderer.invoke('update-voucher-status', data),

    // Photo Management
    assignPhotos: (data) => ipcRenderer.invoke('assign-photos', data),
    getPhotosByCustomerId: (id) => ipcRenderer.invoke('get-photos-by-customer-id', id),
    revertPhotosToRaw: (data) => ipcRenderer.invoke('revert-photos-to-raw', data),
    getEditedPhotos: (id) => ipcRenderer.invoke('get-edited-photos', id),
    saveCroppedImage: (data) => ipcRenderer.invoke('save-cropped-image', data),
    exportGridImage: (data) => ipcRenderer.invoke('export-grid-image', data),

    // Watcher Events (Listeners)
    startWatching: (projectPath) => ipcRenderer.send('start-watching', projectPath),
    stopWatching: () => ipcRenderer.send('stop-watching'),
    onNewPhoto: (callback) => ipcRenderer.on('new-photo-added', (_event, value) => callback(value)),
    onNewEditedPhoto: (callback) => ipcRenderer.on('new-edited-photo-added', (_event, value) => callback(value)),

    // File System & Dialogs
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    openFolder: (data) => ipcRenderer.invoke('open-folder', data),

    // Template Management
    getAllTemplates: () => ipcRenderer.invoke('get-all-templates'),
    createTemplate: (data) => ipcRenderer.invoke('create-template', data),
    getTemplatesForProject: (data) => ipcRenderer.invoke('get-templates-for-project',data),
    setTemplatesForProject: (data) => ipcRenderer.invoke('set-templates-for-project', data),

    // API
    distributeToDrive: (data) => ipcRenderer.invoke('distribute-to-drive', data),
    sendLinkToMapper: (data) => ipcRenderer.invoke('send-link-to-mapper', data),
});