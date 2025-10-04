import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import sharp from 'sharp';
import QRCode from 'qrcode';
import { getSetting } from './settingsService.js';

// Define the path for our database file.
const dbPath = path.resolve(app.getPath('userData'), 'tigaduabooth.db');
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
      distribution_status TEXT DEFAULT 'pending',
      drive_link TEXT,
      qr_code_path TEXT,
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
      export_status TEXT DEFAULT 'pending',
      exported_file_path TEXT,
      FOREIGN KEY (voucher_id) REFERENCES vouchers (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      file_path TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers (id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      layout_config TEXT NOT NULL,
      background_color TEXT DEFAULT '#FFFFFF',
      watermark_path TEXT,
      watermark_opacity REAL DEFAULT 0.5,
      overlay_image_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS project_templates (
      project_id INTEGER NOT NULL,
      template_id INTEGER NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE,
      FOREIGN KEY (template_id) REFERENCES templates (id) ON DELETE CASCADE,
      PRIMARY KEY (project_id, template_id)
    );
  `;

  // Execute the SQL to create tables
  db.exec(setupSql);
  // db.prepare("ALTER TABLE customers ADD COLUMN export_status TEXT DEFAULT 'pending'").run();
  // db.prepare("ALTER TABLE customers ADD COLUMN exported_file_path TEXT").run();
  // db.prepare("ALTER TABLE vouchers ADD COLUMN distribution_status TEXT DEFAULT 'pending'").run();
  // db.prepare("ALTER TABLE vouchers ADD COLUMN drive_link TEXT").run();
  // db.prepare("ALTER TABLE vouchers ADD COLUMN qr_code_path TEXT").run();
  // db.prepare("ALTER TABLE templates ADD COLUMN overlay_image_path TEXT").run();

  seedTemplates();

  console.log('Database has been initialized.');
}

function seedTemplates() {
  try {
    const stmt = db.prepare('INSERT INTO templates (name, layout_config, background_color) VALUES (?, ?, ?)');

    // Use a transaction for efficiency
    const seedTemplates = db.transaction(() => {
      // Check if templates already exist to prevent duplicates
      const count = db.prepare('SELECT COUNT(*) as count FROM templates').get().count;
      if (count === 0) {
        console.log('Seeding default templates...');
        // 1. Basic 4x1
        stmt.run(
          'Basic 4x1',
          `{"rows":4,"cols":1,"gap_mm":3,"padding_mm":{"top":4,"bottom":15,"left":4,"right":4},"print_width_mm":51,"print_height_mm":152,"grid_aspect_ratio":"51 / 152","crop_aspect_ratio":1.3870967741935485}`,
          '#FFFFFF'
        );
        // 2. Basic 3x1
        stmt.run(
          'Basic 3x1',
          `{"rows":3,"cols":1,"gap_mm":3,"padding_mm":{"top":4,"bottom":15,"left":4,"right":4},"print_width_mm":51,"print_height_mm":152,"grid_aspect_ratio":"51 / 152","crop_aspect_ratio":1.015748031496063}`,
          '#FFFFFF'
        );
        // 3. Basic 1x1
        stmt.run(
          'Basic 1x1',
          `{"rows":1,"cols":1,"gap_mm":0,"padding_mm":{"top":5,"bottom":20,"left":5,"right":5},"print_width_mm":102,"print_height_mm":152,"grid_aspect_ratio":"102 / 152","crop_aspect_ratio":0.7244094488188977}`,
          '#F5F5F5'
        );
        // 4. Basic 2x2
        stmt.run(
          'Basic 2x2',
          `{"rows":2,"cols":2,"gap_mm":4,"padding_mm":{"top":5,"bottom":20,"left":5,"right":5},"print_width_mm":102,"print_height_mm":152,"grid_aspect_ratio":"102 / 152","crop_aspect_ratio":0.7154471544715447}`,
          '#FFFFFF'
        );
        // 4. Basic 1x3
        stmt.run(
          'Basic 1x3',
          `{"rows":1,"cols":3,"gap_mm":4,"padding_mm":{"top":5,"bottom":20,"left":5,"right":5},"print_width_mm":152,"print_height_mm":102,"grid_aspect_ratio":"152 / 102","crop_aspect_ratio":0.5800865800865801}`,
          '#FFFFFF'
        );
      }
    });

    seedTemplates();
  } catch (error) {
    console.error("Failed to seed templates:", error);
  }
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
  const customerEditedPath = path.join(customerFolderPath, 'edited');
  fs.mkdirSync(customerFolderPath, { recursive: true });
  fs.mkdirSync(customerEditedPath, { recursive: true });

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

async function generateVouchersAndQRCodes({ projectId, quantity }) {
  try {
    const project = db.prepare('SELECT folder_path FROM projects WHERE id = ?').get(projectId);
    if (!project) throw new Error('Project not found');

    const qrCodeBaseUrl = getSetting('qrCodeBaseUrl');
    if (!qrCodeBaseUrl) throw new Error('QR Code Base URL is not set in Settings.');

    const qrCodeFolderPath = path.join(project.folder_path, 'qrcodes');
    if (!fs.existsSync(qrCodeFolderPath)) {
      fs.mkdirSync(qrCodeFolderPath, { recursive: true });
    }

    const insertStmt = db.prepare(
      'INSERT INTO vouchers (project_id, code, qr_code_path) VALUES (?, ?, ?)'
    );

    const generateTransaction = db.transaction(() => {
      for (let i = 0; i < quantity; i++) {
        const code = generateVoucherCode(); // Assumes your helper function exists
        const fullUrl = `${qrCodeBaseUrl}${code}`;
        const qrCodePath = path.join(qrCodeFolderPath, `${code}.png`);

        QRCode.toFile(qrCodePath, fullUrl); // Asynchronously generate and save the QR code

        insertStmt.run(projectId, code, qrCodePath);
      }
    });

    generateTransaction();
    console.log(`Successfully generated ${quantity} vouchers and QR codes.`);
    return { success: true, count: quantity };
  } catch (error) {
    console.error('Failed to generate vouchers and QR codes:', error);
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
      c.export_status, 
      c.exported_file_path, 
      v.code as voucherCode, 
      v.id as voucherId, 
      v.distribution_status,
      (SELECT COUNT(p.id) FROM photos p WHERE c.id = p.customer_id) as photoCount
    FROM customers c
    JOIN vouchers v ON c.voucher_id = v.id
    WHERE v.project_id = ?
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

function getAllTemplates() {
  return db.prepare('SELECT * FROM templates ORDER BY name').all();
}

function createTemplate({ name, layout_config, background_color, watermark_path, watermark_opacity }) {
  const stmt = db.prepare(`
    INSERT INTO templates (name, layout_config, background_color, watermark_path, watermark_opacity)
    VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(name, JSON.stringify(layout_config), background_color, watermark_path, watermark_opacity);
  return { success: true, id: info.lastInsertRowid };
}

function setTemplatesForProject({ projectId, templateIds }) {
  const deleteStmt = db.prepare('DELETE FROM project_templates WHERE project_id = ?');
  const insertStmt = db.prepare('INSERT INTO project_templates (project_id, template_id) VALUES (?, ?)');

  const setTransaction = db.transaction(() => {
    deleteStmt.run(projectId); // Clear existing links
    for (const templateId of templateIds) {
      insertStmt.run(projectId, templateId); // Add new links
    }
  });

  try {
    setTransaction();
    return { success: true };
  } catch (error) {
    console.error('Failed to set project templates:', error);
    return { success: false, error: error.message };
  }
}

function getTemplatesForProject(projectId) {
  const stmt = db.prepare(`
    SELECT
      t.*,
      CASE
        WHEN pt.project_id IS NOT NULL THEN 1
        ELSE 0
      END as checked
    FROM templates t
    LEFT JOIN (SELECT * FROM project_templates WHERE project_id = ?) pt ON t.id = pt.template_id
  `);
  return stmt.all(projectId);
}

async function exportGridImage({ projectPath, imagePaths, template, customerId }) {
  try {
    const finalFolderPath = path.join(projectPath, 'final');
    if (!fs.existsSync(finalFolderPath)) {
      fs.mkdirSync(finalFolderPath, { recursive: true });
    }

    // 1. Get the customer's voucher code
    const customerInfo = db.prepare(`
      SELECT v.code as voucherCode 
      FROM customers c JOIN vouchers v ON c.voucher_id = v.id 
      WHERE c.id = ?
    `).get(customerId);
    if (!customerInfo) throw new Error('Customer not found for export naming.');

    // 2. Count existing exports for this customer to get the index
    const exportCount = fs.readdirSync(finalFolderPath)
      .filter(file => file.startsWith(customerInfo.voucherCode + '-')).length;
    const newIndex = exportCount + 1;

    // 3. Create the new standardized filename
    const outputName = `${customerInfo.voucherCode}-${newIndex}.jpg`;
    const outputPath = path.join(finalFolderPath, outputName);

    const DPI = 300;
    const MM_PER_INCH = 25.4;

    const layout = JSON.parse(template.layout_config);
    const background_color = template.background_color;

    // Convert all mm dimensions to pixels
    const canvasWidthPx = Math.round((layout.print_width_mm / MM_PER_INCH) * DPI);
    const canvasHeightPx = Math.round((layout.print_height_mm / MM_PER_INCH) * DPI);
    const gapPx = Math.round((layout.gap_mm / MM_PER_INCH) * DPI);
    const paddingTopPx = Math.round((layout.padding_mm.top / MM_PER_INCH) * DPI);
    const paddingBottomPx = Math.round((layout.padding_mm.bottom / MM_PER_INCH) * DPI);
    const paddingLeftPx = Math.round((layout.padding_mm.left / MM_PER_INCH) * DPI);
    const paddingRightPx = Math.round((layout.padding_mm.right / MM_PER_INCH) * DPI);

    const gridAreaWidth = canvasWidthPx - (paddingLeftPx + paddingRightPx);
    const gridAreaHeight = canvasHeightPx - (paddingTopPx + paddingBottomPx);
    const cellWidth = (gridAreaWidth - (gapPx * (layout.cols - 1))) / layout.cols;
    const cellHeight = (gridAreaHeight - (gapPx * (layout.rows - 1))) / layout.rows;

    // Step 1: Prepare the photo grid composite operations
    const resizedImageBuffers = await Promise.all(
      imagePaths.map(imgPath => {
        if (!imgPath || !imgPath.croppedPath) return null;
        return sharp(imgPath.croppedPath)
          .resize(Math.round(cellWidth), Math.round(cellHeight), { fit: 'cover' })
          .toBuffer();
      })
    );

    const photoCompositeOps = resizedImageBuffers.map((buffer, index) => {
      if (!buffer) return null;
      const col = index % layout.cols;
      const row = Math.floor(index / layout.cols);
      const left = paddingLeftPx + col * (cellWidth + gapPx);
      const top = paddingTopPx + row * (cellHeight + gapPx);
      return { input: buffer, top: Math.round(top), left: Math.round(left) };
    }).filter(Boolean);

    // Step 3: Composite the photo grid onto the base canvas and save

    let baseImage = await sharp({
      create: {
        width: canvasWidthPx,
        height: canvasHeightPx,
        channels: 4,
        background: layout.background_color || '#FFFFFF',
      }
    })
      .composite(photoCompositeOps)
      .jpeg() // Convert to a solid image buffer first
      .toBuffer();

    // Step 3: Sequentially layer the overlay and watermark on top
    const finalCompositeLayers = [];

    // Add overlay to the list if it exists
    if (template.overlay_image_path && fs.existsSync(template.overlay_image_path)) {
      finalCompositeLayers.push({
        input: template.overlay_image_path,
        top: 0,
        left: 0,
      });
    }

    // Prepare the watermark composite operation (if it exists)
    const watermarkConfig = layout.watermark;
    if (watermarkConfig && watermarkConfig.path && fs.existsSync(watermarkConfig.path)) {
      const watermarkWidth = Math.round(canvasWidthPx * (watermarkConfig.size / 100));
      const watermarkBuffer = await sharp(watermarkConfig.path).resize({ width: watermarkWidth }).toBuffer();
      const watermarkMeta = await sharp(watermarkBuffer).metadata();
      const left = Math.round((canvasWidthPx / 100) * watermarkConfig.position.x - (watermarkMeta.width / 2));
      const top = Math.round((canvasHeightPx / 100) * watermarkConfig.position.y - (watermarkMeta.height / 2));
      // Add the watermark to our list of operations
      finalCompositeLayers.push({ input: watermarkBuffer, top, left });
    }

    await sharp(baseImage)
      .composite(finalCompositeLayers)
      .jpeg({ quality: 95 })
      .withMetadata({ density: DPI })
      .toFile(outputPath);
      
    db.prepare("UPDATE customers SET export_status = 'exported', exported_file_path = ? WHERE id = ?")
      .run(outputPath, customerId);

    console.log(`Grid exported and status updated for customer ${customerId}`);
    return { success: true, path: outputPath };
  } catch (error) {
    console.error('Failed to export grid:', error);
    return { success: false, error: error.message };
  }
}

function setVoucherDistributed({ voucherId, link }) {
  return db.prepare("UPDATE vouchers SET distribution_status = 'distributed', drive_link = ? WHERE id = ?")
    .run(link, voucherId);
}

// This function finds all files in the /final folder for a specific voucher
function getExportedFilesForCustomer({ projectPath, voucherCode }) {
  try {
    const finalFolderPath = path.join(projectPath, 'final');
    if (!fs.existsSync(finalFolderPath)) return [];

    const allFiles = fs.readdirSync(finalFolderPath);
    const customerFiles = allFiles
      .filter(file => file.startsWith(voucherCode + '-'))
      .map(file => path.join(finalFolderPath, file));

    return customerFiles;
  } catch (error) {
    console.error('Failed to find exported files:', error);
    return [];
  }
}

function updateVoucherStatus({ voucherId, status, link = null }) {
  if (link) {
    db.prepare("UPDATE vouchers SET distribution_status = ?, drive_link = ? WHERE id = ?")
      .run(status, link, voucherId);
  } else {
    db.prepare("UPDATE vouchers SET distribution_status = ? WHERE id = ?")
      .run(status, voucherId);
  }

  console.log(`Vocuher ${voucherId} status updated to ${status}`);
  return { success: true };
}

function getPendingDistribution(projectId) {
  const stmt = db.prepare(`
    SELECT 
      c.id, c.name, c.exported_file_path,
      v.id as voucherId, v.code as voucherCode,
      p.name as projectName, p.folder_path as projectPath, p.event_date as eventDate,
      v.drive_link
    FROM customers c
    JOIN vouchers v ON c.voucher_id = v.id
    JOIN projects p ON v.project_id = p.id
    WHERE
      c.export_status = 'exported' AND
      v.distribution_status in ('pending', 'exported', 'failed') AND
      v.project_id = ?
  `);
  return stmt.all(projectId);
}

function getSingleCustomerForDistribution(customerId) {
  // This is the same query as getPendingDistribution but for a single customer
  const stmt = db.prepare(` SELECT 
      c.id, c.name, c.exported_file_path,
      v.id as voucherId, v.code as voucherCode,
      p.name as projectName, p.folder_path as projectPath, p.event_date as eventDate
    FROM customers c
    JOIN vouchers v ON c.voucher_id = v.id
    JOIN projects p ON v.project_id = p.id
    WHERE c.id = ? AND c.export_status = 'exported' AND v.distribution_status in ('pending', 'exported', 'failed')`);
  return stmt.get(customerId);
}

async function exportBlankTemplate(template) {
  try {
    const layout = JSON.parse(template.layout_config);
    const DPI = 300;
    const MM_PER_INCH = 25.4;

    // Use the user's "Downloads" folder for the export
    const outputPath = path.join(app.getPath('downloads'), `${template.name}-blank.png`);

    // Convert all dimensions from mm to pixels
    const canvasWidthPx = Math.round((layout.print_width_mm / MM_PER_INCH) * DPI);
    const canvasHeightPx = Math.round((layout.print_height_mm / MM_PER_INCH) * DPI);

    const gapPx = Math.round((layout.gap_mm / MM_PER_INCH) * DPI);
    const paddingTopPx = Math.round((layout.padding_mm.top / MM_PER_INCH) * DPI);
    const paddingBottomPx = Math.round((layout.padding_mm.bottom / MM_PER_INCH) * DPI);
    const paddingLeftPx = Math.round((layout.padding_mm.left / MM_PER_INCH) * DPI);
    const paddingRightPx = Math.round((layout.padding_mm.right / MM_PER_INCH) * DPI);

    const gridAreaWidth = canvasWidthPx - (paddingLeftPx + paddingRightPx);
    const gridAreaHeight = canvasHeightPx - (paddingTopPx + paddingBottomPx);
    const cellWidth = (gridAreaWidth - (gapPx * (layout.cols - 1))) / layout.cols;
    const cellHeight = (gridAreaHeight - (gapPx * (layout.rows - 1))) / layout.rows;

    // Create a buffer for a transparent rectangle (the "cutout")
    const cutoutBuffer = await sharp({
      create: { width: Math.round(cellWidth), height: Math.round(cellHeight), channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } }
    }).png().toBuffer();

    // Create the composite operations for each cutout
    const compositeOps = [];
    for (let i = 0; i < (layout.rows * layout.cols); i++) {
      const row = Math.floor(i / layout.cols);
      const col = i % layout.cols;
      const top = Math.round(paddingTopPx + row * (cellHeight + gapPx));
      const left = Math.round(paddingLeftPx + col * (cellWidth + gapPx));
      compositeOps.push({ input: cutoutBuffer, blend: 'dest-out', top, left });
    }

    // Create the base canvas with the template's background color
    await sharp({
      create: {
        width: canvasWidthPx,
        height: canvasHeightPx,
        channels: 4,
        background: template.background_color,
      }
    })
      .composite(compositeOps) // Apply the "cutouts"
      .png() // Ensure the output is a PNG to support transparency
      .toFile(outputPath);

    return { success: true, path: outputPath };
  } catch (error) {
    console.error('Failed to export blank template:', error);
    return { success: false, error: error.message };
  }
}

function setTemplateOverlay({ templateId, sourcePath }) {
  try {
    const templateDir = path.join(app.getPath('userData'), 'template_assets', String(templateId));
    if (!fs.existsSync(templateDir)) {
      fs.mkdirSync(templateDir, { recursive: true });
    }

    const destPath = path.join(templateDir, 'overlay.png');
    fs.copyFileSync(sourcePath, destPath); // Copy the file

    // Save the new path to the database
    db.prepare('UPDATE templates SET overlay_image_path = ? WHERE id = ?').run(destPath, templateId);
    return { success: true, path: destPath };
  } catch (error) {
    console.error('Failed to set template overlay:', error);
    return { success: false, error: error.message };
  }
}

function getPhotoAsBase64(filePath) {
  try {
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');
    return `data:image/jpeg;base64,${base64Image}`;
  } catch (error) {
    console.error('Failed to read photo for preview:', error);
    return null;
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
  getAllTemplates,
  createTemplate,
  getTemplatesForProject,
  setTemplatesForProject,
  exportGridImage,
  setVoucherDistributed,
  getExportedFilesForCustomer,
  updateVoucherStatus,
  generateVouchersAndQRCodes,
  getPendingDistribution,
  getSingleCustomerForDistribution,
  exportBlankTemplate,
  getPhotoAsBase64,
  setTemplateOverlay
};