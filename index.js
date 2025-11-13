import figlet from "figlet"
import { getMem, getCPU } from "./info.js";
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Import appointment system modules
import {
  createAppointment,
  getAppointment,
  getAllAppointments,
  getAppointmentsByStatus
} from './database.js';
import { initTelegramBot, sendAppointmentRequest } from './telegram.js';
import { initCalendar, getAvailableSlots } from './calendar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load configuration
let config = {};
try {
  const configPath = join(__dirname, 'config.json');
  if (existsSync(configPath)) {
    config = JSON.parse(readFileSync(configPath, 'utf8'));
    console.log('Configuration loaded successfully');

    // Initialize Telegram bot if configured
    if (config.telegram?.token && config.telegram?.adminChatId) {
      initTelegramBot(config.telegram.token, config.telegram.adminChatId);
    }

    // Initialize Google Calendar if credentials exist
    if (existsSync(join(__dirname, 'credentials.json')) &&
        existsSync(join(__dirname, 'token.json'))) {
      initCalendar().catch(err => {
        console.error('Calendar initialization failed:', err.message);
      });
    }
  } else {
    console.warn('config.json not found. Some features may not work.');
  }
} catch (error) {
  console.error('Error loading configuration:', error.message);
}

const server = http.createServer(async (req, res) => {
  console.log(`Got a ${req.method} request on ${req.url}`);
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Helper function to send JSON response
  const sendJSON = (data, statusCode = 200) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  // Helper function to send text response
  const sendText = (text, statusCode = 200) => {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
    res.end(text);
  };

  // Helper function to send HTML response
  const sendHTML = (html, statusCode = 200) => {
    res.writeHead(statusCode, { 'Content-Type': 'text/html' });
    res.end(html);
  };

  // Helper function to parse JSON body
  const parseBody = () => {
    return new Promise((resolve, reject) => {
      let body = '';
      req.on('data', chunk => { body += chunk.toString(); });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (error) {
          reject(error);
        }
      });
      req.on('error', reject);
    });
  };

  try {
    // Existing endpoints
    if (url.pathname === "/memory") {
      const data = await getMem();
      sendJSON(data);
    }
    else if (url.pathname === "/cpu") {
      const data = await getCPU();
      sendJSON(data);
    }

    // Appointment scheduling endpoints

    // Get available time slots for a specific date
    else if (url.pathname === "/api/available-slots" && req.method === "GET") {
      try {
        const date = url.searchParams.get('date');
        const duration = parseInt(url.searchParams.get('duration')) || 60;

        if (!date) {
          sendJSON({ error: 'Date parameter is required (YYYY-MM-DD format)' }, 400);
          return;
        }

        // Validate date format
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          sendJSON({ error: 'Invalid date format. Use YYYY-MM-DD' }, 400);
          return;
        }

        // Get business hours from config
        const businessHours = config.business?.businessHours || null;

        // Fetch available slots from Google Calendar
        const slots = await getAvailableSlots(date, duration, businessHours);

        sendJSON({
          date,
          duration,
          slots,
          totalSlots: slots.length
        });
      } catch (error) {
        console.error('Error fetching available slots:', error);
        sendJSON({
          error: 'Failed to fetch available slots',
          message: error.message
        }, 500);
      }
    }

    else if (url.pathname === "/api/appointments" && req.method === "POST") {
      try {
        const body = await parseBody();

        // Validate required fields
        const requiredFields = ['client_name', 'client_email', 'service_type', 'requested_date', 'requested_time'];
        const missingFields = requiredFields.filter(field => !body[field]);

        if (missingFields.length > 0) {
          sendJSON({
            error: 'Missing required fields',
            fields: missingFields
          }, 400);
          return;
        }

        // Create appointment
        const appointmentId = uuidv4();
        const appointment = {
          id: appointmentId,
          ...body
        };

        createAppointment(appointment);

        // Send to Telegram for approval
        try {
          await sendAppointmentRequest(appointment);
        } catch (telegramError) {
          console.error('Failed to send Telegram notification:', telegramError.message);
        }

        sendJSON({
          success: true,
          appointmentId,
          message: 'Appointment request submitted successfully. You will be notified once it is reviewed.'
        }, 201);
      } catch (error) {
        console.error('Error creating appointment:', error);
        sendJSON({ error: 'Internal server error' }, 500);
      }
    }

    else if (url.pathname === "/api/appointments" && req.method === "GET") {
      try {
        const appointments = getAllAppointments();
        sendJSON(appointments);
      } catch (error) {
        console.error('Error fetching appointments:', error);
        sendJSON({ error: 'Internal server error' }, 500);
      }
    }

    else if (url.pathname.startsWith("/api/appointments/") && req.method === "GET") {
      try {
        const appointmentId = url.pathname.split('/').pop();
        const appointment = getAppointment(appointmentId);

        if (!appointment) {
          sendJSON({ error: 'Appointment not found' }, 404);
          return;
        }

        sendJSON(appointment);
      } catch (error) {
        console.error('Error fetching appointment:', error);
        sendJSON({ error: 'Internal server error' }, 500);
      }
    }

    // Serve booking form
    else if (url.pathname === "/book" || url.pathname === "/") {
      try {
        const htmlPath = join(__dirname, 'public', 'booking.html');
        if (existsSync(htmlPath)) {
          const html = readFileSync(htmlPath, 'utf8');
          sendHTML(html);
          return;
        }
      } catch (error) {
        console.error('Error serving booking form:', error);
      }
      // Fallback to figlet
      const body = figlet.textSync("Bringin' you the Bun Info!");
      sendText(body);
    }

    // Default response
    else {
      const body = figlet.textSync("Bringin' you the Bun Info!");
      sendText(body);
    }
  } catch (error) {
    console.error('Server error:', error);
    sendJSON({ error: 'Internal server error' }, 500);
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Info server listening on http://0.0.0.0:${PORT} ...`);
  console.log(`Appointment booking available at http://localhost:${PORT}/book`);
});
