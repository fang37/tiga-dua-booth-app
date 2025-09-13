import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

// Define the path for our database file.
const dbPath = path.resolve(__dirname, '../../../photobooth.db');
const db = new Database(dbPath);

// A function to initialize the database tables
function initializeDatabase() {
  const setupSql = `
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      folder_path TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS vouchers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'available',
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      voucher_id INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      email TEXT,
      phone_number TEXT,
      folder_path TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (voucher_id) REFERENCES vouchers (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      file_path TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
    );
  `;

  // Execute the SQL to create tables
  db.exec(setupSql);
  console.log('Database has been initialized.');
}

function createProject({ name, event_date }) {
  // 1. Sanitize the name to create a safe folder name (e.g., "Andy & Betty's Wedding" -> "andy-and-bettys-wedding")
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  const folderName = `${event_date}-${slug}`;

  // 2. Define the main projects folder in the user's home directory
  const projectsBasePath = path.join(app.getPath('home'), 'tiga_dua_booth_projects');
  const projectFolderPath = path.join(projectsBasePath, folderName);
  const rawFolderPath = path.join(projectFolderPath, 'raw');
  const editedFolderPath = path.join(projectFolderPath, 'edited');

  try {
    // 3. Create the folder structure (e.g., /photobooth_projects/2025-09-13-andy-and-bettys-wedding/raw)
    // The { recursive: true } option creates parent directories if they don't exist.
    fs.mkdirSync(rawFolderPath, { recursive: true });
    fs.mkdirSync(editedFolderPath, { recursive: true });

    // 4. Prepare and run the SQL INSERT statement
    const stmt = db.prepare(
      'INSERT INTO projects (name, event_date, folder_path) VALUES (?, ?, ?)'
    );
    const info = stmt.run(name, event_date, projectFolderPath);

    console.log(`Successfully created project: ${name} with ID: ${info.lastInsertRowid}`);

    // 5. Return the ID of the new project
    return { success: true, projectId: info.lastInsertRowid };
  } catch (error) {
    console.error('Failed to create project:', error);
    return { success: false, error: error.message };
  }
}

function getProjects() {
  try {
    const stmt = db.prepare('SELECT * FROM projects ORDER BY event_date DESC');
    const projects = stmt.all();
    return projects;
  } catch (error) {
    console.error('Failed to get projects:', error);
    return []; // Return empty array on error
  }
}

function getProjectById(id) {
  const stmt = db.prepare('SELECT * FROM projects WHERE id = ?');
  return stmt.get(id);
}

function findVoucherByCode({ projectId, voucherCode }) {
  const stmt = db.prepare(
    "SELECT * FROM vouchers WHERE project_id = ? AND code = ? AND status = 'available'"
  );
  const voucher = stmt.get(projectId, voucherCode);
  return voucher; // Will be undefined if not found or already redeemed
}

function redeemVoucher({ voucherCode, name, email, phoneNumber }) { // <-- phoneNumber is now a parameter
  const voucherQuery = `
    SELECT v.id as voucher_id, p.folder_path as project_folder
    FROM vouchers v
    JOIN projects p ON v.project_id = p.id
    WHERE v.code = ? AND v.status = 'available'
  `;
  const voucher = db.prepare(voucherQuery).get(voucherCode);

  if (!voucher) {
    const errorMsg = 'Voucher not found or has already been redeemed.';
    console.error(errorMsg);
    return { success: false, error: errorMsg };
  }

  const customerFolderPath = path.join(voucher.project_folder, voucherCode);
  fs.mkdirSync(customerFolderPath, { recursive: true });

  const redeemTransaction = db.transaction(() => {
    const updateVoucherStmt = db.prepare("UPDATE vouchers SET status = 'redeemed' WHERE id = ?");
    updateVoucherStmt.run(voucher.voucher_id);

    // 1. Update the INSERT statement to include phone_number
    const insertCustomerStmt = db.prepare(`
      INSERT INTO customers (voucher_id, name, email, phone_number, folder_path)
      VALUES (?, ?, ?, ?, ?)
    `);
    // 2. Pass the phoneNumber variable into the run command
    const info = insertCustomerStmt.run(voucher.voucher_id, name, email, phoneNumber, customerFolderPath);

    return info.lastInsertRowid;
  });

  try {
    const newCustomerId = redeemTransaction();
    console.log(`Successfully redeemed voucher ${voucherCode} for customer ${name}. New customer ID: ${newCustomerId}`);
    return { success: true, customerId: newCustomerId };
  } catch (error) {
    console.error(`Failed to redeem voucher ${voucherCode}:`, error);
    return { success: false, error: error.message };
  }
}

function generateVoucherCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function generateVouchersForProject({ projectId, quantity }) {
  try {
    const insertStmt = db.prepare(
      'INSERT INTO vouchers (project_id, code) VALUES (?, ?)'
    );

    const insertMany = db.transaction((vouchers) => {
      for (const voucher of vouchers) {
        insertStmt.run(voucher.projectId, voucher.code);
      }
    });

    const vouchersToInsert = [];
    for (let i = 0; i < quantity; i++) {
      vouchersToInsert.push({
        projectId: projectId,
        code: generateVoucherCode(),
      });
    }

    insertMany(vouchersToInsert);

    console.log(`Successfully generated ${quantity} vouchers for project ID: ${projectId}`);
    return { success: true, count: quantity };
  } catch (error) {
    console.error('Failed to generate vouchers:', error);
    return { success: false, error: error.message };
  }
}

function assignPhotosToCustomer({ customerId, photoPaths }) {
  try {
    // Query to get all the necessary info for renaming
    const query = `
      SELECT
        c.folder_path as customer_folder,
        v.code as voucher_code,
        p.name as project_name,
        p.event_date as event_date
      FROM customers c
      JOIN vouchers v ON c.voucher_id = v.id
      JOIN projects p ON v.project_id = p.id
      WHERE c.id = ?
    `;
    const info = db.prepare(query).get(customerId);
    if (!info) throw new Error('Customer not found.');

    const countStmt = db.prepare('SELECT COUNT(id) as count FROM photos WHERE customer_id = ?');
    let currentPhotoCount = countStmt.get(customerId).count;

    // Create the filename prefix (e.g., "w-a-b-2025-09-13")
    const projectSlug = info.project_name.toLowerCase().split('&').map(s => s.trim()[0]).join('-')
    const filePrefix = `${projectSlug}-${info.event_date}`;
    const insertPhotoStmt = db.prepare('INSERT INTO photos (customer_id, file_path) VALUES (?, ?)');

    const assignTransaction = db.transaction(() => {
      photoPaths.forEach((sourcePath) => {
        if (!fs.existsSync(sourcePath)) {
          console.log(`Skipping missing file: ${sourcePath}`);
          return;
        }

        currentPhotoCount++;
         const sequence = String(currentPhotoCount).padStart(2, '0');
        const fileExtension = path.extname(sourcePath);
        const baseFileName = `${filePrefix}-${info.voucher_code}-${sequence}`;

        let newFileName = `${baseFileName}${fileExtension}`;
        let destPath = path.join(info.customer_folder, newFileName);

        // If a file with this name somehow already exists, add a unique suffix
        let suffix = 1;
        while (fs.existsSync(destPath)) {
          newFileName = `${baseFileName}_${suffix}${fileExtension}`;
          destPath = path.join(info.customer_folder, newFileName);
          suffix++;
        }

        fs.renameSync(sourcePath, destPath);
        insertPhotoStmt.run(customerId, destPath);
      });
    });

    assignTransaction();
    console.log(`Assignment process completed for customer ${customerId}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to assign photos:', error);
    return { success: false, error: error.message };
  }
}

function getPhotosByCustomerId(customerId) {
  const stmt = db.prepare('SELECT id, file_path FROM photos WHERE customer_id = ?');
  return stmt.all(customerId);
}

function revertPhotosToRaw({ photoIds, projectFolderPath }) {
  try {
    const rawFolderPath = path.join(projectFolderPath, 'raw');
    const getStmt = db.prepare('SELECT file_path FROM photos WHERE id = ?');
    const deleteStmt = db.prepare('DELETE FROM photos WHERE id = ?');

    const revertTransaction = db.transaction(() => {
      for (const id of photoIds) {
        const photo = getStmt.get(id);
        if (photo) {
          const oldPath = photo.file_path;
          const newPath = path.join(rawFolderPath, path.basename(oldPath));
         
          if (fs.existsSync(oldPath)) {
            fs.renameSync(oldPath, newPath);
          }

          deleteStmt.run(id); // Delete record from database
        }
      }
    });

    revertTransaction();
    return { success: true };
  } catch (error) {
    console.error('Failed to revert photos:', error);
    return { success: false, error: error.message };
  }
}

function runHealthCheckForProject(projectId) {
  try {
    // Get all photo records for all customers in the project
    const stmt = db.prepare(`
      SELECT p.id, p.file_path 
      FROM photos p
      JOIN customers c ON p.customer_id = c.id
      JOIN vouchers v ON c.voucher_id = v.id
      WHERE v.project_id = ?
    `);
    const photos = stmt.all(projectId);

    const missingPhotoIds = [];
    for (const photo of photos) {
      if (!fs.existsSync(photo.file_path)) {
        missingPhotoIds.push(photo.id);
      }
    }

    if (missingPhotoIds.length > 0) {
      console.log(`[Health Check] Found ${missingPhotoIds.length} missing photos. Cleaning database...`);
      // Use a transaction to delete all missing records at once
      const deleteStmt = db.prepare('DELETE FROM photos WHERE id = ?');
      const deleteTransaction = db.transaction(() => {
        for (const id of missingPhotoIds) {
          deleteStmt.run(id);
        }
      });
      deleteTransaction();
    } else {
      console.log('[Health Check] All photo records are valid.');
    }

    return { success: true, cleanedCount: missingPhotoIds.length };
  } catch (error) {
    console.error('Health check failed:', error);
    return { success: false, error: error.message };
  }
}

function getCustomersByProjectId(projectId) {
  const stmt = db.prepare(`
   SELECT 
      c.id, 
      c.name, 
      v.code as voucherCode,
      COUNT(p.id) as photoCount 
    FROM customers c
    JOIN vouchers v ON c.voucher_id = v.id
    LEFT JOIN photos p ON c.id = p.customer_id
    WHERE v.project_id = ?
    GROUP BY c.id
    ORDER BY c.created_at DESC
  `);
  return stmt.all(projectId);
}

function saveCroppedImage({ projectPath, imageData }) {
  try {
    const croppedFolderPath = path.join(projectPath, 'cropped');
    if (!fs.existsSync(croppedFolderPath)) {
      fs.mkdirSync(croppedFolderPath, { recursive: true });
    }

    // Image data is a Base64 string, so we need to decode it
    const base64Data = imageData.replace(/^data:image\/jpeg;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, 'base64');

    const fileName = `cropped-${Date.now()}.jpg`;
    const filePath = path.join(croppedFolderPath, fileName);

    fs.writeFileSync(filePath, imageBuffer);

    return { success: true, filePath };
  } catch (error) {
    console.error('Failed to save cropped image:', error);
    return { success: false, error: error.message };
  }
}

function getEditedPhotosByCustomerId(customerId) {
  try {
    const customer = db.prepare('SELECT folder_path FROM customers WHERE id = ?').get(customerId);
    if (!customer) {
      throw new Error('Customer not found');
    }

    const editedFolderPath = path.join(customer.folder_path, 'edited');
    if (!fs.existsSync(editedFolderPath)) {
      return []; // No edited folder exists for this customer yet
    }

    const files = fs.readdirSync(editedFolderPath);
    return files
      .filter(file => /\.(jpg|jpeg|png|webp)$/i.test(file))
      .map(file => path.join(editedFolderPath, file));

  } catch (error) {
    console.error('Failed to get edited photos by customer ID:', error);
    return [];
  }
}

// Export the database instance and the setup function using ES Module syntax
export {
  db,
  initializeDatabase,
  createProject,
  generateVouchersForProject,
  redeemVoucher,
  getProjects,
  getProjectById,
  findVoucherByCode,
  assignPhotosToCustomer,
  getCustomersByProjectId,
  getPhotosByCustomerId,
  revertPhotosToRaw,
  runHealthCheckForProject,
  saveCroppedImage,
  getEditedPhotosByCustomerId,
};