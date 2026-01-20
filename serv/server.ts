import express from 'express';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import nodemailer from 'nodemailer';
import cors from 'cors';
import crypto from 'crypto';
import { readFileSync } from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// PostgreSQL pool
const pool = new Pool({
  user: process.env.PG_USER,
  host: process.env.PG_HOST,
  database: process.env.PG_DATABASE,
  password: process.env.PG_PASSWORD,
  port: parseInt(process.env.PG_PORT || '5432'),
});


async function runSchema() {
  const schema = readFileSync("./serv/shema.sql", "utf-8");

  const client = await pool.connect();
  try {
    await client.query(schema);
    console.log("Schema executed successfully.");
  } catch (err) {
    console.error("Error executing schema:", err);
  } finally {
    client.release();
  }
}

runSchema();

// Email transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Helper: Generate unique connection ID
function generateConnectionId(): string {
  return crypto.randomBytes(16).toString('hex');
}

// Helper: Send email
async function sendEmail(to: string, subject: string, html: string) {
  try {
    await transporter.sendMail({
      from: process.env.SMTP_USER,
      to,
      subject,
      html,
    });
  } catch (error) {
    console.error('Email error:', error);
  }
}

// ============ HOSTER ROUTES ============

// Register hoster
app.post('/api/hoster/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO hosters (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    );
    
    res.json({ success: true, hoster: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Login hoster
app.post('/api/hoster/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const result = await pool.query('SELECT * FROM hosters WHERE email = $1', [email]);
    
    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    const hoster = result.rows[0];
    const valid = await bcrypt.compare(password, hoster.password_hash);
    
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    
    res.json({ success: true, hoster: { id: hoster.id, email: hoster.email } });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Create availability timeslot
app.post('/api/hoster/timeslots', async (req, res) => {
  try {
    const { hosterId, startTime, endTime } = req.body;
    
    const result = await pool.query(
      'INSERT INTO hoster_timeslots (hoster_id, start_time, end_time) VALUES ($1, $2, $3) RETURNING *',
      [hosterId, startTime, endTime]
    );
    
    res.json({ success: true, timeslot: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get hoster timeslots
app.get('/api/hoster/:hosterId/timeslots', async (req, res) => {
  try {
    const { hosterId } = req.params;
    
    const result = await pool.query(
      'SELECT * FROM hoster_timeslots WHERE hoster_id = $1 ORDER BY start_time',
      [hosterId]
    );
    
    res.json({ success: true, timeslots: result.rows });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete timeslot (cascade deletes requests and appointments)
app.delete('/api/hoster/timeslots/:timeslotId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { timeslotId } = req.params;
    
    await client.query('BEGIN');
    
    // Get affected appointments for email notification
    const appointmentsResult = await client.query(
      `SELECT a.*, c.name as client_name, h.email as hoster_email
       FROM appointments a
       JOIN clients c ON a.client_id = c.id
       JOIN hosters h ON a.hoster_id = h.id
       WHERE a.hoster_timeslot_id = $1`,
      [timeslotId]
    );
    
    // Delete the timeslot (cascade will handle requests and appointments)
    await client.query('DELETE FROM hoster_timeslots WHERE id = $1', [timeslotId]);
    
    await client.query('COMMIT');
    
    // Send notifications
    for (const appt of appointmentsResult.rows) {
      await sendEmail(
        appt.hoster_email,
        'Availability Block Deleted',
        `Your availability block from ${appt.start_time} to ${appt.end_time} has been deleted. The appointment with ${appt.client_name} has been cancelled.`
      );
    }
    
    res.json({ success: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Search clients
app.get('/api/hoster/clients/search', async (req, res) => {
  try {
    const { name } = req.query;
    
    const result = await pool.query(
      'SELECT * FROM clients WHERE name ILIKE $1 ORDER BY name LIMIT 10',
      [`%${name}%`]
    );
    
    res.json({ success: true, clients: result.rows });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Create client
app.post('/api/hoster/clients', async (req, res) => {
  try {
    const { name } = req.body;
    
    const result = await pool.query(
      'INSERT INTO clients (name) VALUES ($1) RETURNING *',
      [name]
    );
    
    res.json({ success: true, client: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Add client to hoster
app.post('/api/hoster/clients/connect', async (req, res) => {
  try {
    const { hosterId, clientId } = req.body;
    const connectionId = generateConnectionId();
    
    const result = await pool.query(
      'INSERT INTO hoster_clients (hoster_id, client_id, connection_id) VALUES ($1, $2, $3) RETURNING *',
      [hosterId, clientId, connectionId]
    );
    
    res.json({ success: true, connection: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get hoster's clients
app.get('/api/hoster/:hosterId/clients', async (req, res) => {
  try {
    const { hosterId } = req.params;
    
    const result = await pool.query(
      `SELECT hc.*, c.name as client_name, c.id as client_id
       FROM hoster_clients hc
       JOIN clients c ON hc.client_id = c.id
       WHERE hc.hoster_id = $1
       ORDER BY c.name`,
      [hosterId]
    );
    
    res.json({ success: true, clients: result.rows });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get requests for a timeslot
app.get('/api/hoster/timeslots/:timeslotId/requests', async (req, res) => {
  try {
    const { timeslotId } = req.params;
    
    const result = await pool.query(
      `SELECT cr.*, c.name as client_name, c.id as client_id
       FROM client_requests cr
       JOIN hoster_clients hc ON cr.connection_id = hc.connection_id
       JOIN clients c ON hc.client_id = c.id
       WHERE cr.hoster_timeslot_id = $1
       ORDER BY cr.preference DESC, cr.created_at`,
      [timeslotId]
    );
    
    res.json({ success: true, requests: result.rows });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Validate a client request (create appointment)
app.post('/api/hoster/requests/:requestId/validate', async (req, res) => {
  const client = await pool.connect();
  try {
    const { requestId } = req.params;
    
    await client.query('BEGIN');
    
    // Get request details
    const requestResult = await client.query(
      `SELECT cr.*, hc.hoster_id, hc.client_id, c.name as client_name, h.email as hoster_email
       FROM client_requests cr
       JOIN hoster_clients hc ON cr.connection_id = hc.connection_id
       JOIN clients c ON hc.client_id = c.id
       JOIN hosters h ON hc.hoster_id = h.id
       WHERE cr.id = $1`,
      [requestId]
    );
    
    if (requestResult.rows.length === 0) {
      throw new Error('Request not found');
    }
    
    const request = requestResult.rows[0];
    
    // Create appointment
    await client.query(
      `INSERT INTO appointments (hoster_id, client_id, hoster_timeslot_id, start_time, end_time)
       VALUES ($1, $2, $3, $4, $5)`,
      [request.hoster_id, request.client_id, request.hoster_timeslot_id, request.start_time, request.end_time]
    );
    
    // Mark request as validated
    await client.query(
      'UPDATE client_requests SET validated_by_hoster = true WHERE id = $1',
      [requestId]
    );
    
    await client.query('COMMIT');
    
    // Send email notification
    await sendEmail(
      request.hoster_email,
      'Appointment Confirmed',
      `Your appointment with ${request.client_name} from ${request.start_time} to ${request.end_time} has been confirmed.`
    );
    
    res.json({ success: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Cancel validation (delete appointment)
app.post('/api/hoster/requests/:requestId/unvalidate', async (req, res) => {
  const client = await pool.connect();
  try {
    const { requestId } = req.params;
    
    await client.query('BEGIN');
    
    // Get request and appointment details
    const requestResult = await client.query(
      `SELECT cr.*, hc.hoster_id, hc.client_id, c.name as client_name, h.email as hoster_email
       FROM client_requests cr
       JOIN hoster_clients hc ON cr.connection_id = hc.connection_id
       JOIN clients c ON hc.client_id = c.id
       JOIN hosters h ON hc.hoster_id = h.id
       WHERE cr.id = $1`,
      [requestId]
    );
    
    if (requestResult.rows.length === 0) {
      throw new Error('Request not found');
    }
    
    const request = requestResult.rows[0];
    
    // Delete appointment
    await client.query(
      `DELETE FROM appointments 
       WHERE hoster_timeslot_id = $1 
       AND start_time = $2 
       AND end_time = $3 
       AND client_id = $4`,
      [request.hoster_timeslot_id, request.start_time, request.end_time, request.client_id]
    );
    
    // Mark request as not validated
    await client.query(
      'UPDATE client_requests SET validated_by_hoster = false WHERE id = $1',
      [requestId]
    );
    
    await client.query('COMMIT');
    
    // Send email notification
    await sendEmail(
      request.hoster_email,
      'Appointment Cancelled',
      `Your appointment with ${request.client_name} from ${request.start_time} to ${request.end_time} has been cancelled.`
    );
    
    res.json({ success: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Get hoster appointments
app.get('/api/hoster/:hosterId/appointments', async (req, res) => {
  try {
    const { hosterId } = req.params;
    
    const result = await pool.query(
      `SELECT a.*, c.name as client_name
       FROM appointments a
       JOIN clients c ON a.client_id = c.id
       WHERE a.hoster_id = $1
       ORDER BY a.start_time`,
      [hosterId]
    );
    
    res.json({ success: true, appointments: result.rows });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// ============ CLIENT ROUTES ============

// Get connection info
app.get('/api/client/connection/:connectionId', async (req, res) => {
  try {
    const { connectionId } = req.params;
    
    const result = await pool.query(
      `SELECT hc.*, c.name as client_name, h.email as hoster_email
       FROM hoster_clients hc
       JOIN clients c ON hc.client_id = c.id
       JOIN hosters h ON hc.hoster_id = h.id
       WHERE hc.connection_id = $1`,
      [connectionId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Connection not found' });
    }
    
    res.json({ success: true, connection: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get hoster timeslots for client
app.get('/api/client/:connectionId/timeslots', async (req, res) => {
  try {
    const { connectionId } = req.params;
    
    const result = await pool.query(
      `SELECT ht.*
       FROM hoster_timeslots ht
       JOIN hoster_clients hc ON ht.hoster_id = hc.hoster_id
       WHERE hc.connection_id = $1
       ORDER BY ht.start_time`,
      [connectionId]
    );
    
    res.json({ success: true, timeslots: result.rows });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Create client request
app.post('/api/client/requests', async (req, res) => {
  try {
    const { connectionId, timeslotId, startTime, endTime, preference } = req.body;
    
    const result = await pool.query(
      `INSERT INTO client_requests (hoster_timeslot_id, connection_id, start_time, end_time, preference)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [timeslotId, connectionId, startTime, endTime, preference]
    );
    
    res.json({ success: true, request: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Get client's requests
app.get('/api/client/:connectionId/requests', async (req, res) => {
  try {
    const { connectionId } = req.params;
    
    const result = await pool.query(
      `SELECT cr.*, ht.start_time as timeslot_start, ht.end_time as timeslot_end
       FROM client_requests cr
       JOIN hoster_timeslots ht ON cr.hoster_timeslot_id = ht.id
       WHERE cr.connection_id = $1
       ORDER BY cr.start_time`,
      [connectionId]
    );
    
    res.json({ success: true, requests: result.rows });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Update request preference
app.put('/api/client/requests/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { preference } = req.body;
    
    const result = await pool.query(
      'UPDATE client_requests SET preference = $1 WHERE id = $2 RETURNING *',
      [preference, requestId]
    );
    
    res.json({ success: true, request: result.rows[0] });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Delete client request
app.delete('/api/client/requests/:requestId', async (req, res) => {
  const client = await pool.connect();
  try {
    const { requestId } = req.params;
    
    await client.query('BEGIN');
    
    // Get request details for notification
    const requestResult = await client.query(
      `SELECT cr.*, h.email as hoster_email, c.name as client_name
       FROM client_requests cr
       JOIN hoster_clients hc ON cr.connection_id = hc.connection_id
       JOIN hosters h ON hc.hoster_id = h.id
       JOIN clients c ON hc.client_id = c.id
       WHERE cr.id = $1`,
      [requestId]
    );
    
    const request = requestResult.rows[0];
    
    // Delete request
    await client.query('DELETE FROM client_requests WHERE id = $1', [requestId]);
    
    await client.query('COMMIT');
    
    // Send email notification
    if (request) {
      await sendEmail(
        request.hoster_email,
        'Client Request Cancelled',
        `${request.client_name} has cancelled their request for ${request.start_time} to ${request.end_time}.`
      );
    }
    
    res.json({ success: true });
  } catch (error: any) {
    await client.query('ROLLBACK');
    res.status(400).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// Get client appointments
app.get('/api/client/:connectionId/appointments', async (req, res) => {
  try {
    const { connectionId } = req.params;
    
    const result = await pool.query(
      `SELECT a.*
       FROM appointments a
       JOIN hoster_clients hc ON a.client_id = hc.client_id AND a.hoster_id = hc.hoster_id
       WHERE hc.connection_id = $1
       ORDER BY a.start_time`,
      [connectionId]
    );
    
    res.json({ success: true, appointments: result.rows });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});