Feature Documentation: Database Backup & Restore
1. Overview
This feature allows you to back up your application's entire database (photobooth.db) to your Google Drive and restore it on a new computer.

To make this possible, we've solved the "Missing Path Problem." The app no longer stores absolute file paths (like C:\Users\YourName\Documents\...). Instead, all paths are now stored relatively, making the database fully portable.

2. Core Design: The Relative Path System
This is the key to making the backup/restore feature work.

The Problem: A database restored on a new PC would have paths pointing to your old computer's folders (e.g., C:\Users\OldPC\...), which would break everything.

The Solution: The app now uses two "base paths" to dynamically find all files:

User Data Path (Automatic): This path is managed by Electron (app.getPath('userData')) and is unique to each computer. It's used to store internal app assets like your template overlays and watermarks (in the template_assets folder).

Project Base Path (Manual): This is a new, configurable setting in the "Settings" page. It tells the app where to find your main tiga_dua_booth_projects folder.

All paths in the database are now stored relatively to one of these two base paths.

Example:

Old Path: C:\Users\MyPC\tiga_dua_booth_projects\2025-10-31-event\ABCDEF\photo-01.jpg

New Path (in DB): 2025-10-31-event\ABCDEF\photo-01.jpg

When the app needs a file, it dynamically joins the Project Base Path from your settings with the relative path from the database.

3. How to Back Up Your Data
This is the easy part. You can do this at any time, as often as you like.

Navigate to the Settings page in the app.

Click the "Backup Database Now" button.

The app will authenticate with Google Drive (if needed) and upload a timestamped copy of your photobooth.db file to a new folder in your Drive called "TigaDuaBooth Backups".

4. How to Restore / Migrate to a New PC
This is the most critical process and must be followed carefully.

Step 1: On the NEW PC, Install the App

Run the Setup.exe installer to get a fresh copy of the app.

Step 2: On the NEW PC, Manually Sync Your Files

The database only contains the records, not the actual image files. You must move your files manually.

Sync Your Projects Folder:

Copy your entire tiga_dua_booth_projects folder from your old PC (via Google Drive, an external hard drive, etc.) to a location on your new PC (e.g., D:\My Photobooth).

Sync Your Template Assets:

On your old PC, go to %appdata%\tiga-dua-booth-app (or C:\Users\YourName\AppData\Roaming\tiga-dua-booth-app).

Copy the template_assets folder.

On your new PC, go to the same %appdata%\tiga-dua-booth-app location and paste the template_assets folder.

Step 3: On the NEW PC, Configure the App

Launch the app. It will be empty.

Go to the Settings page.

Find the "Project Base Path" setting. Click "Browse" and select the tiga_dua_booth_projects folder you just copied (e.g., D:\My Photobooth).

Save the settings and restart the app. This step is crucial.

Step 4: On the NEW PC, Restore the Database

Go back to the Settings page.

Click the "Restore Database from Backup" button.

A list of your available backups from Google Drive will appear. Select the most recent one.

Confirm that you want to overwrite your local data.

The app will download the database, close, and restart automatically.

When it re-opens, your app on the new PC will have all your projects, customers, and templates fully restored and functional, because it now knows where to find all the files.

5. Developer Reference: Key Functions
To make this work, we implemented the following:

settingsService.js:

getSetting(key, defaultValue): Now provides a default value, used to get the projectBasePath.

saveSetting({ key, value }): Saves the projectBasePath.

database.js:

closeDb() / initializeDatabase(): Functions to safely close and re-open the database connection for the restore process.

getProjectBasePath(): A new helper to get the configured base path.

getProjectFileAsBase64(relativePath): New function to get Base64 data from the projects folder.

getUserDataFileAsBase64(relativePath): New function to get Base64 data from the user data folder.

Refactored Functions: createProject, redeemVoucher, assignPhotosToCustomer, generateVouchersAndQRCodes, createTemplate, setTemplateOverlay, revertPhotosToRaw, runHealthCheckForProject, getEditedPhotosByCustomerId, saveCroppedImage, and exportGridImage were all updated to save and read relative paths.

React Components:

All components that display images (EventWorkspace, PhotoPreviewModal, GridCreator, TemplateManager) were updated to use the new get...AsBase64 functions to build absolute paths at runtime.