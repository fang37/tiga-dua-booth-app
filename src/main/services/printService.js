import { app, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import printer from 'node-printer';
import { db, getProjectBasePath, updateCustomerWorkflowStatus } from './database.js';
import { getSetting } from './settingsService.js';

let isQueueRunning = false;
let printCounter = 0;
let isResting = false;

const DPI = 300;
const MM_PER_INCH = 25.4;

// Helper to convert mm to pixels
function mmToPx(mm) {
  return Math.round((mm / MM_PER_INCH) * DPI);
}

// --- 1. The Image Merging Function ---
// This function combines two half-page images into one full 4R image
async function mergeHalf4RImages(imageAPath, imageBPath, orientation) {
  const fullWidthPx = mmToPx(101.6); // Full 4R width
  const fullHeightPx = mmToPx(152.4); // Full 4R height

  // Create a blank 4R canvas
  const canvas = sharp({
    create: {
      width: fullWidthPx,
      height: fullHeightPx,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  });

  let compositeOps = [];
  if (orientation === 'vertical') {
    // Place two vertical strips side-by-side
    compositeOps = [
      { input: imageAPath, top: 0, left: 0 },
      { input: imageBPath, top: 0, left: mmToPx(50.8) } // 50.8mm is half-width
    ];
  } else {
    // Place two horizontal strips top-and-bottom
    compositeOps = [
      { input: imageAPath, top: 0, left: 0 },
      { input: imageBPath, top: mmToPx(76.2), left: 0 } // 76.2mm is half-height
    ];
  }

  // Create a temporary path for the merged file
  const tempDir = path.join(app.getPath('userData'), 'temp_prints');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const tempFilePath = path.join(tempDir, `merged_print_${Date.now()}.jpg`);

  await canvas.composite(compositeOps).jpeg().toFile(tempFilePath);
  return tempFilePath;
}

export function getAvailablePrinters() {
  try {
    return printer.getPrinters().map(p => p.name);
  } catch (error) {
    console.error("Could not get printers:", error);
    return [];
  }
}

// --- 2. The Main Print Function ---
function sendToPrinter(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const selectedPrinterName = getSetting('selectedPrinterName');
      if (!selectedPrinterName) {
        throw new Error('No printer selected in Settings.');
      }

      console.log(`[Print Service] Sending to printer '${selectedPrinterName}': ${filePath}`);

      printer.printFile({
        filename: filePath,
        printer: selectedPrinterName,
        success: function (jobID) {
          console.log(`[Print Service] Sent job to printer with ID: ${jobID}`);
          resolve(jobID); // The job was successfully spooled
        },
        error: function (err) {
          console.error('[Print Service] Error sending to printer:', err);
          reject(err); // The job failed
        }
      });

    } catch (error) {
      console.error('[Print Service] Print function failed:', error);
      reject(error);
    }
  });
}

// --- 3. The "Smart Queue" Loop ---
async function processPrintQueue() {
  if (!isQueueRunning || isResting) return; // Do nothing if paused or resting

  const projectsBasePath = getProjectBasePath(); // Get the base path ONCE

  // 1. Handle Full 4R
  const fullJob = db.prepare("SELECT * FROM print_job_queue WHERE template_print_size = 'full_4r' AND status = 'pending' ORDER BY created_at LIMIT 1").get();
  if (fullJob) {
    db.prepare("UPDATE print_job_queue SET status = 'printing' WHERE id = ?").run(fullJob.id);
    const absoluteFilePath = path.join(projectsBasePath, fullJob.exported_file_path);

    if (!fs.existsSync(absoluteFilePath)) {
      console.error(`[Print Service] File not found for job ${fullJob.id}: ${absoluteFilePath}. Setting status to 'failed'.`);
      db.prepare("UPDATE print_job_queue SET status = 'failed' WHERE id = ?").run(fullJob.id);
      updateCustomerWorkflowStatus({ customerId: fullJob.customer_id, status: 'failed' });
      return;
    }

    try {
      await sendToPrinter(absoluteFilePath); // Wait for the print job

      // Only update status if the print was successful
      db.prepare("UPDATE print_job_queue SET status = 'done' WHERE id = ?").run(fullJob.id);
      updateCustomerWorkflowStatus({ customerId: fullJob.customer_id, status: 'printed' });
      checkRestTimer();
    } catch (err) {
      // Print failed, set status to 'failed'
      db.prepare("UPDATE print_job_queue SET status = 'failed' WHERE id = ?").run(fullJob.id);
      updateCustomerWorkflowStatus({ customerId: fullJob.customer_id, status: 'failed' });
    }
    return;
  }

  // 2. Handle Vertical Halves
  const verticalJobs = db.prepare("SELECT * FROM print_job_queue WHERE template_print_size = 'half_4r_vertical' AND status = 'pending' ORDER BY created_at LIMIT 2").all();
  if (verticalJobs.length === 2) {
    const absolutePathA = path.join(projectsBasePath, verticalJobs[0].exported_file_path);
    const absolutePathB = path.join(projectsBasePath, verticalJobs[1].exported_file_path);

    if (!fs.existsSync(absolutePathA) || !fs.existsSync(absolutePathB)) {
      console.error(`[Print Service] One or more files not found for vertical pair. Setting status to 'failed'.`);
      db.prepare("UPDATE print_job_queue SET status = 'failed' WHERE id IN (?, ?)").run(verticalJobs[0].id, verticalJobs[1].id);
      updateCustomerWorkflowStatus({ customerId: verticalJobs[0].customer_id, status: 'failed' });
      updateCustomerWorkflowStatus({ customerId: verticalJobs[1].customer_id, status: 'failed' });
      return;
    }

    db.prepare("UPDATE print_job_queue SET status = 'paired' WHERE id IN (?, ?)").run(verticalJobs[0].id, verticalJobs[1].id);
    const mergedPath = await mergeHalf4RImages(absolutePathA, absolutePathB, 'vertical');

    try {
      await sendToPrinter(mergedPath);
      db.prepare("UPDATE print_job_queue SET status = 'done' WHERE id = ?").run(verticalJobs[0].id);
      db.prepare("UPDATE print_job_queue SET status = 'done' WHERE id = ?").run(verticalJobs[1].id);
      updateCustomerWorkflowStatus({ customerId: verticalJobs[0].customer_id, status: 'printed' });
      updateCustomerWorkflowStatus({ customerId: verticalJobs[1].customer_id, status: 'printed' });
    } catch (err) {
      // Print failed, set status to 'failed'
      db.prepare("UPDATE print_job_queue SET status = 'failed' WHERE id = ?").run(verticalJobs[0].id);
      db.prepare("UPDATE print_job_queue SET status = 'failed' WHERE id = ?").run(verticalJobs[1].id);
      updateCustomerWorkflowStatus({ customerId: verticalJobs[0].customer_id, status: 'failed' });
      updateCustomerWorkflowStatus({ customerId: verticalJobs[1].customer_id, status: 'failed' });
    }
    return;
  }

  // 3. Handle Horizontal Halves
  const horizontalJobs = db.prepare("SELECT * FROM print_job_queue WHERE template_print_size = 'half_4r_horizontal' AND status = 'pending' ORDER BY created_at LIMIT 2").all();
  if (horizontalJobs.length === 2) {
    const absolutePathA = path.join(projectsBasePath, horizontalJobs[0].exported_file_path);
    const absolutePathB = path.join(projectsBasePath, horizontalJobs[1].exported_file_path);

    if (!fs.existsSync(absolutePathA) || !fs.existsSync(absolutePathB)) {
      console.error(`[Print Service] One or more files not found for horizontal pair. Setting status to 'failed'.`);
      db.prepare("UPDATE print_job_queue SET status = 'failed' WHERE id IN (?, ?)").run(horizontalJobs[0].id, horizontalJobs[1].id);
      return;
    }

    db.prepare("UPDATE print_job_queue SET status = 'paired' WHERE id IN (?, ?)").run(horizontalJobs[0].id, horizontalJobs[1].id);
    const mergedPath = await mergeHalf4RImages(absolutePathA, absolutePathB, 'horizontal');

    try {
      await sendToPrinter(mergedPath);
      db.prepare("UPDATE print_job_queue SET status = 'done' WHERE id = ?").run(horizontalJobs[0].id);
      db.prepare("UPDATE print_job_queue SET status = 'done' WHERE id = ?").run(horizontalJobs[1].id);
      updateCustomerWorkflowStatus({ customerId: horizontalJobs[0].customer_id, status: 'printed' });
      updateCustomerWorkflowStatus({ customerId: horizontalJobs[1].customer_id, status: 'printed' });
      checkRestTimer();
    }
    catch (err) {
      db.prepare("UPDATE print_job_queue SET status = 'failed' WHERE id = ?").run(horizontalJobs[0].id);
      db.prepare("UPDATE print_job_queue SET status = 'failed' WHERE id = ?").run(horizontalJobs[1].id);
      updateCustomerWorkflowStatus({ customerId: horizontalJobs[0].customer_id, status: 'failed' });
      updateCustomerWorkflowStatus({ customerId: horizontalJobs[1].customer_id, status: 'failed' });
    }

    return;
  }

  // 4. Handle "Orphan" Jobs (Scenario 3)
  const orphanJob = db.prepare("SELECT * FROM print_job_queue WHERE template_print_size LIKE 'half_4r_%' AND status = 'pending' ORDER BY created_at LIMIT 1").get();
  if (orphanJob) {
    const stockPhotoPath = getSetting('stockPhotoPath');
    const orphanWaitTime = getSetting('orphanWaitTime', 10); // Wait 10 minutes by default

    const jobAge = (new Date() - new Date(orphanJob.created_at)) / (1000 * 60); // Age in minutes

    const absoluteOrphanPath = path.join(projectsBasePath, orphanJob.exported_file_path);
    if (!fs.existsSync(absoluteOrphanPath)) {
      console.error(`[Print Service] Orphan file not found: ${absoluteOrphanPath}. Setting status to 'failed'.`);
      db.prepare("UPDATE print_job_queue SET status = 'failed' WHERE id = ?").run(orphanJob.id);
      updateCustomerWorkflowStatus({ customerId: orphanJob.customer_id, status: 'failed' });
      return;
    }

    if (jobAge > orphanWaitTime && stockPhotoPath && fs.existsSync(stockPhotoPath)) {
      db.prepare("UPDATE print_job_queue SET status = 'paired' WHERE id = ?").run(orphanJob.id);
      const orientation = orphanJob.template_print_size.includes('vertical') ? 'vertical' : 'horizontal';
      const mergedPath = await mergeHalf4RImages(absoluteOrphanPath, stockPhotoPath, orientation);

      try {
        await sendToPrinter(mergedPath);
        db.prepare("UPDATE print_job_queue SET status = 'done' WHERE id = ?").run(orphanJob.id);
        updateCustomerWorkflowStatus({ customerId: orphanJob.customer_id, status: 'printed' });
        checkRestTimer();
      }
      catch (err) {
        console.error(`[Print Service] Error sending orphan job to printer: ${err.message}`);
      }

      return;
    }
  }
}

// --- 4. Queue Control Functions ---
function checkRestTimer() {
  const restAfterPrints = getSetting('restAfterPrints', 10);
  const restDuration = getSetting('restDuration', 5); // 5 minutes

  printCounter++;
  if (printCounter >= restAfterPrints) {
    console.log(`[Print Service] Printer resting for ${restDuration} minutes...`);
    isResting = true;
    printCounter = 0;
    setTimeout(() => {
      console.log('[Print Service] Printer rest complete. Resuming queue.');
      isResting = false;
    }, restDuration * 60 * 1000);
  }
}

export function startPrintQueue() {
  if (isQueueRunning) return;
  console.log('[Print Service] Starting queue...');
  isQueueRunning = true;
  setInterval(processPrintQueue, 10000); // Check the queue every 10 seconds
}

export function stopPrintQueue() {
  console.log('[Print Service] Stopping queue...');
  isQueueRunning = false;
}
