import express from 'express';
import cors from 'cors';
import { db, getCustomersByProjectId, updateCustomerWorkflowStatus } from './database.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Define the path to your satellite app's folder
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// This path now correctly points to the 'satellite' folder inside the 'dist/main' build directory.
const satelliteAppPath = path.join(__dirname, '../satellite');

// Define the port for our server
const PORT = 4000;

function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // --- API ENDPOINTS ---

  // Endpoint 1: Get all customers for a specific project
  // The satellite app will call this to get its list
  app.get('/api/project/:id/customers', async (req, res) => {
    try {
      const projectId = req.params.id;
      const customers = await getCustomersByProjectId(projectId);
      res.json(customers);
    } catch (error) {
      console.error('API Error on GET /api/project/:id/customers:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/customer/:id/action', async (req, res) => {
    try {
      const customerId = req.params.id;
      const action = req.body.action; // e.g., "START_EDITING", "FINISH_EDITING"

      if (!action) {
        return res.status(400).json({ error: 'Missing "action" in request body' });
      }

      // 1. Get the customer's CURRENT true status from the database
      const customer = db.prepare('SELECT workflow_status FROM customers WHERE id = ?').get(customerId);
      if (!customer) {
        return res.status(404).json({ error: 'Customer not found' });
      }
      const currentStatus = customer.workflow_status;

      // 2. This is our "State Machine" - The server enforces the rules
      let newStatus = currentStatus;

      switch (action) {
        case 'START_EDITING':
          // You can ONLY start editing if photos are 'assigned'
          if (currentStatus === 'assigned') {
            newStatus = 'editing';
          } else if (currentStatus === 'pending') {
            // This is the safety check you wanted
            return res.status(409).json({ error: 'Cannot edit. Photos have not been assigned to this customer yet.' });
          } else if (currentStatus === 'editing') {
            // Already editing, no change needed
          } else {
            // For any other status (like distributed), block it.
            return res.status(409).json({ error: `Cannot start editing when status is '${currentStatus}'.` });
          }
          break;

        case 'FINISH_EDITING':
          // You can only finish editing if you were pending, editing, or re-editing
          if (currentStatus === 'pending' || currentStatus === 'editing' || currentStatus === 'exported') {
            newStatus = 'edited';
          } else if (currentStatus === 'distributed') {
            // This is the safety check you wanted
            return res.status(409).json({ error: 'Cannot re-edit a customer that has already been distributed.' });
          }
          break;

        // We can add more actions later, like "MARK_FOR_PRINTING"
      }

      // 3. Update the database only if the status has changed
      if (newStatus !== currentStatus) {
        await updateCustomerWorkflowStatus({ customerId: customerId, status: newStatus });
      }

      res.json({ success: true, newStatus: newStatus });

    } catch (error) {
      console.error('API Error on POST /api/customer/:id/action:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- NEW ENDPOINT: Add to Print Queue ---
  app.post('/api/customer/:id/queue-print', async (req, res) => {
    try {
      const customerId = req.params.id;
      const copies = req.body.copies || 1; // Default to 1 copy

      // Get the customer's exported file info
      const customer = db.prepare(
        'SELECT exported_file_path, exported_print_size FROM customers WHERE id = ?'
      ).get(customerId);

      if (!customer || !customer.exported_file_path || !customer.exported_print_size) {
        return res.status(404).json({ error: 'Customer or exported file/size not found.' });
      }

      // Add the job(s) to the new print_job_queue table
      const insertStmt = db.prepare(
        'INSERT INTO print_job_queue (customer_id, exported_file_path, template_print_size) VALUES (?, ?, ?)'
      );

      const addJobs = db.transaction(() => {
        for (let i = 0; i < copies; i++) {
          insertStmt.run(customerId, customer.exported_file_path, customer.exported_print_size);
        }
      });

      addJobs();

      // Update the customer's main status to 'queued'
      updateCustomerWorkflowStatus({ customerId, status: 'queued_for_print' });

      res.json({ success: true, message: `${copies} copies added to print queue.` });
    } catch (error) {
      console.error('API Error on POST /api/customer/:id/queue-print:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.use(express.static(satelliteAppPath));

  app.get('/', (req, res) => {
    res.sendFile(path.join(satelliteAppPath, 'index.html'));
  });

  // 3. Start the server
  // We listen on '0.0.0.0' to accept connections from other devices on the network,
  // not just from the main PC.
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[API Server] Successfully started. Listening on http://0.0.0.0:${PORT}`);
    console.log(`[Satellite App] Now available at http://[YOUR_IP_ADDRESS]:${PORT}`);
  });
}

export { startServer };