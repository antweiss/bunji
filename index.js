import figlet from "figlet"
import { getMem, getCPU } from "./info.js";
import http from 'http';
import { v4 as uuidv4 } from 'uuid';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import crypto from 'crypto';

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

// Admin authentication and session management
const sessions = new Map(); // In-memory session storage
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH ||
  crypto.createHash('sha256').update('admin123').digest('hex'); // Default password: admin123

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function createSession(username) {
  const sessionId = uuidv4();
  sessions.set(sessionId, {
    username,
    createdAt: Date.now(),
    expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
  });
  return sessionId;
}

function validateSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return false;
  if (Date.now() > session.expiresAt) {
    sessions.delete(sessionId);
    return false;
  }
  return true;
}

function getSessionFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, value] = cookie.trim().split('=');
    acc[key] = value;
    return acc;
  }, {});
  return cookies.session || null;
}

// Load or create admin settings
let adminSettings = {
  branding: {
    businessName: config.business?.name || 'My Business',
    primaryColor: '#667eea',
    logo: null
  },
  services: [
    { id: '1', name: 'Therapy Session', duration: 60, emoji: '💬', active: true },
    { id: '2', name: 'Consultation', duration: 30, emoji: '🗣️', active: true },
    { id: '3', name: 'Haircut', duration: 45, emoji: '✂️', active: true },
    { id: '4', name: 'Hair Styling', duration: 60, emoji: '💇', active: true },
    { id: '5', name: 'Facial Treatment', duration: 60, emoji: '✨', active: true },
    { id: '6', name: 'Massage', duration: 90, emoji: '💆', active: true },
    { id: '7', name: 'Manicure', duration: 45, emoji: '💅', active: true },
    { id: '8', name: 'Pedicure', duration: 60, emoji: '🦶', active: true },
    { id: '9', name: 'Makeup', duration: 45, emoji: '💄', active: true }
  ],
  businessHours: config.business?.businessHours || {
    monday: { start: '09:00', end: '17:00' },
    tuesday: { start: '09:00', end: '17:00' },
    wednesday: { start: '09:00', end: '17:00' },
    thursday: { start: '09:00', end: '17:00' },
    friday: { start: '09:00', end: '17:00' },
    saturday: null,
    sunday: null
  }
};

// Try to load saved admin settings
const adminSettingsPath = join(__dirname, 'admin-settings.json');
if (existsSync(adminSettingsPath)) {
  try {
    adminSettings = JSON.parse(readFileSync(adminSettingsPath, 'utf8'));
    console.log('Admin settings loaded successfully');
  } catch (error) {
    console.error('Error loading admin settings:', error.message);
  }
}

function saveAdminSettings() {
  try {
    writeFileSync(adminSettingsPath, JSON.stringify(adminSettings, null, 2));
  } catch (error) {
    console.error('Error saving admin settings:', error.message);
  }
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

    // Admin API endpoints

    // Admin login
    else if (url.pathname === "/api/admin/login" && req.method === "POST") {
      try {
        const body = await parseBody();
        const { password } = body;

        if (!password) {
          sendJSON({ error: 'Password required' }, 400);
          return;
        }

        const hash = hashPassword(password);
        if (hash === ADMIN_PASSWORD_HASH) {
          const sessionId = createSession('admin');
          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Set-Cookie': `session=${sessionId}; HttpOnly; Max-Age=86400; Path=/; SameSite=Strict`
          });
          res.end(JSON.stringify({ success: true }));
        } else {
          sendJSON({ error: 'Invalid password' }, 401);
        }
      } catch (error) {
        console.error('Login error:', error);
        sendJSON({ error: 'Internal server error' }, 500);
      }
    }

    // Admin logout
    else if (url.pathname === "/api/admin/logout" && req.method === "POST") {
      const sessionId = getSessionFromCookie(req.headers.cookie);
      if (sessionId) {
        sessions.delete(sessionId);
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': 'session=; HttpOnly; Max-Age=0; Path=/; SameSite=Strict'
      });
      res.end(JSON.stringify({ success: true }));
    }

    // Get admin settings
    else if (url.pathname === "/api/admin/settings" && req.method === "GET") {
      const sessionId = getSessionFromCookie(req.headers.cookie);
      if (!validateSession(sessionId)) {
        sendJSON({ error: 'Unauthorized' }, 401);
        return;
      }
      sendJSON(adminSettings);
    }

    // Update branding
    else if (url.pathname === "/api/admin/branding" && req.method === "PUT") {
      const sessionId = getSessionFromCookie(req.headers.cookie);
      if (!validateSession(sessionId)) {
        sendJSON({ error: 'Unauthorized' }, 401);
        return;
      }

      try {
        const body = await parseBody();
        adminSettings.branding = { ...adminSettings.branding, ...body };
        saveAdminSettings();
        sendJSON({ success: true, branding: adminSettings.branding });
      } catch (error) {
        console.error('Error updating branding:', error);
        sendJSON({ error: 'Internal server error' }, 500);
      }
    }

    // Get services
    else if (url.pathname === "/api/admin/services" && req.method === "GET") {
      const sessionId = getSessionFromCookie(req.headers.cookie);
      if (!validateSession(sessionId)) {
        sendJSON({ error: 'Unauthorized' }, 401);
        return;
      }
      sendJSON(adminSettings.services);
    }

    // Create service
    else if (url.pathname === "/api/admin/services" && req.method === "POST") {
      const sessionId = getSessionFromCookie(req.headers.cookie);
      if (!validateSession(sessionId)) {
        sendJSON({ error: 'Unauthorized' }, 401);
        return;
      }

      try {
        const body = await parseBody();
        const newService = {
          id: uuidv4(),
          ...body,
          active: true
        };
        adminSettings.services.push(newService);
        saveAdminSettings();
        sendJSON({ success: true, service: newService }, 201);
      } catch (error) {
        console.error('Error creating service:', error);
        sendJSON({ error: 'Internal server error' }, 500);
      }
    }

    // Update service
    else if (url.pathname.startsWith("/api/admin/services/") && req.method === "PUT") {
      const sessionId = getSessionFromCookie(req.headers.cookie);
      if (!validateSession(sessionId)) {
        sendJSON({ error: 'Unauthorized' }, 401);
        return;
      }

      try {
        const serviceId = url.pathname.split('/').pop();
        const body = await parseBody();

        const index = adminSettings.services.findIndex(s => s.id === serviceId);
        if (index === -1) {
          sendJSON({ error: 'Service not found' }, 404);
          return;
        }

        adminSettings.services[index] = { ...adminSettings.services[index], ...body };
        saveAdminSettings();
        sendJSON({ success: true, service: adminSettings.services[index] });
      } catch (error) {
        console.error('Error updating service:', error);
        sendJSON({ error: 'Internal server error' }, 500);
      }
    }

    // Delete service
    else if (url.pathname.startsWith("/api/admin/services/") && req.method === "DELETE") {
      const sessionId = getSessionFromCookie(req.headers.cookie);
      if (!validateSession(sessionId)) {
        sendJSON({ error: 'Unauthorized' }, 401);
        return;
      }

      try {
        const serviceId = url.pathname.split('/').pop();
        const index = adminSettings.services.findIndex(s => s.id === serviceId);

        if (index === -1) {
          sendJSON({ error: 'Service not found' }, 404);
          return;
        }

        adminSettings.services.splice(index, 1);
        saveAdminSettings();
        sendJSON({ success: true });
      } catch (error) {
        console.error('Error deleting service:', error);
        sendJSON({ error: 'Internal server error' }, 500);
      }
    }

    // Update business hours
    else if (url.pathname === "/api/admin/business-hours" && req.method === "PUT") {
      const sessionId = getSessionFromCookie(req.headers.cookie);
      if (!validateSession(sessionId)) {
        sendJSON({ error: 'Unauthorized' }, 401);
        return;
      }

      try {
        const body = await parseBody();
        adminSettings.businessHours = body;
        saveAdminSettings();
        sendJSON({ success: true, businessHours: adminSettings.businessHours });
      } catch (error) {
        console.error('Error updating business hours:', error);
        sendJSON({ error: 'Internal server error' }, 500);
      }
    }

    // Serve admin interface
    else if (url.pathname === "/admin" || url.pathname === "/admin/") {
      try {
        const htmlPath = join(__dirname, 'public', 'admin.html');
        if (existsSync(htmlPath)) {
          const html = readFileSync(htmlPath, 'utf8');
          sendHTML(html);
          return;
        }
      } catch (error) {
        console.error('Error serving admin page:', error);
      }
      sendText('Admin interface not found', 404);
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
