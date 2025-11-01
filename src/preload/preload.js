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
    generateVouchersAndQRCodes: (data) => ipcRenderer.invoke('generate-vouchers-and-qr', data),
    getCustomersByProjectId: (id) => ipcRenderer.invoke('get-customers-by-project-id', id),
    findVoucherByCode: (data) => ipcRenderer.invoke('find-voucher-by-code', data),
    redeemVoucher: (data) => ipcRenderer.invoke('redeem-voucher', data),
    updateCustomerWorkflowStatus: (data) => ipcRenderer.invoke('update-customer-workflow-status', data),
    getExportedFilesForCustomer: (data) => ipcRenderer.invoke('get-exported-files-for-customer', data),

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
    onPhotoRemoved: (callback) => {
        const channel = 'photo-removed';
        const listener = (_event, value) => callback(value);
        ipcRenderer.on(channel, listener);
        return () => {
            ipcRenderer.removeListener(channel, listener);
        };
    },

    // File System & Dialogs
    openFileDialog: () => ipcRenderer.invoke('open-file-dialog'),
    openFolder: (data) => ipcRenderer.invoke('open-folder', data),
    openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
    // getPhotoAsBase64: (data) => ipcRenderer.invoke('get-photo-as-base64', data),
    getProjectFileAsBase64: (path) => ipcRenderer.invoke('get-project-file-as-base64', path),
    getUserDataFileAsBase64: (path) => ipcRenderer.invoke('get-user-data-file-as-base64', path),
    scanRawPhotos: (id) => ipcRenderer.invoke('scan-raw-photos', id),

    // Template Management
    getAllTemplates: () => ipcRenderer.invoke('get-all-templates'),
    createTemplate: (data) => ipcRenderer.invoke('create-template', data),
    getTemplatesForProject: (data) => ipcRenderer.invoke('get-templates-for-project', data),
    setTemplatesForProject: (data) => ipcRenderer.invoke('set-templates-for-project', data),
    exportBlankTemplate: (data) => ipcRenderer.invoke('export-blank-template', data),
    setTemplateOverlay: (data) => ipcRenderer.invoke('set-template-overlay', data),
    removeTemplateOverlay: (data) => ipcRenderer.invoke('remove-template-overlay', data),

    // API
    distributeToDrive: (data) => ipcRenderer.invoke('distribute-to-drive', data),
    sendLinkToMapper: (data) => ipcRenderer.invoke('send-link-to-mapper', data),
    batchDistributeAll: (data) => ipcRenderer.invoke('batch-distribute-all', data),
    distributeSingleCustomer: (customerId) => ipcRenderer.invoke('distribute-single-customer', customerId),
    showItemInFolder: (path) => ipcRenderer.invoke('show-item-in-folder', path),
    triggerBackup: () => ipcRenderer.invoke('trigger-backup'),
    onBatchProgress: (callback) => {
        const channel = 'batch-progress-update';
        const listener = (_event, value) => callback(value);
        ipcRenderer.on(channel, listener);
        return () => {
            ipcRenderer.removeListener(channel, listener);
        };
    },

    // Apps Settings
    getSetting: (data) => ipcRenderer.invoke('get-setting', data),
    saveSetting: (data) => ipcRenderer.invoke('save-setting', data),
});