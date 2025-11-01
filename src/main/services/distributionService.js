import { getExportedFilesForCustomer, updateCustomerWorkflowStatus } from './database.js';
import { distributeToDrive } from './googleDriveService.js';
import { sendLinkToMapper } from './apiService.js';

// This is our single, reusable orchestrator function
export async function processDistributionForCustomer(job, progressCallback) {
  try {
    if (progressCallback) progressCallback(`Processing: ${job.name}`);

    const filePaths = getExportedFilesForCustomer({
      projectPath: job.projectPath,
      voucherCode: job.voucherCode
    });

    if (filePaths.length === 0) throw new Error('No exported files found.');

    let driveLink = job.drive_link;

    // Upload to Drive only if not already done
    if (job.workflow_status !== 'uploaded' && job.workflow_status !== 'distributed') {
      if (progressCallback) progressCallback(`Uploading for ${job.name}...`);
      const driveResult = await distributeToDrive({
        filePaths: filePaths,
        projectName: job.projectName,
        voucherCode: job.voucherCode,
        eventDate: job.eventDate,
      });
      if (!driveResult.success) throw new Error(driveResult.error);
      driveLink = driveResult.link;
      await updateCustomerWorkflowStatus({ customerId: job.id, status: 'uploaded', link: driveLink });
    }

    // Send to mapping service
    console.log('Sending link to mapping service...');
    if (progressCallback) progressCallback(`Mapping link for ${job.name}...`);
    const mapperResult = await sendLinkToMapper({
      voucherCode: job.voucherCode,
      driveLink: driveLink,
    });

    if (!mapperResult.success) throw new Error(mapperResult.error);

    await updateCustomerWorkflowStatus({ customerId: job.id, status: 'distributed' });
    return { success: true };

  } catch (error) {
    console.error(`Failed job for ${job.name}:`, error.message);
    await updateCustomerWorkflowStatus({ customerId: job.id, status: 'failed' });
    return { success: false, error: error.message };
  }
}