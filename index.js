import figlet from "figlet"
import { getMem, getCPU } from "./info.js";
import Bun from "bun"
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
import { initCalendar } from './calendar.js';

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

const server = Bun.serve({
  host: "0.0.0.0",
  port: 3000,
  async fetch(req) {
    console.log(`Got a ${req.method} request on ${req.url}`);
    const url = new URL(req.url);

    // Existing endpoints
    if (url.pathname === "/memory") {
        const data = await getMem();
        return new Response(JSON.stringify(data));
    }
    else if (url.pathname === "/cpu") {
        const data = await getCPU();
        return new Response(JSON.stringify(data));
    }

    // Appointment scheduling endpoints
    else if (url.pathname === "/api/appointments" && req.method === "POST") {
      try {
        const body = await req.json();

        // Validate required fields
        const requiredFields = ['client_name', 'client_email', 'service_type', 'requested_date', 'requested_time'];
        const missingFields = requiredFields.filter(field => !body[field]);

        if (missingFields.length > 0) {
          return new Response(
            JSON.stringify({
              error: 'Missing required fields',
              fields: missingFields
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            }
          );
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

        return new Response(
          JSON.stringify({
            success: true,
            appointmentId,
            message: 'Appointment request submitted successfully. You will be notified once it is reviewed.'
          }),
          {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        console.error('Error creating appointment:', error);
        return new Response(
          JSON.stringify({ error: 'Internal server error' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    else if (url.pathname === "/api/appointments" && req.method === "GET") {
      try {
        const appointments = getAllAppointments();
        return new Response(
          JSON.stringify(appointments),
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        console.error('Error fetching appointments:', error);
        return new Response(
          JSON.stringify({ error: 'Internal server error' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    else if (url.pathname.startsWith("/api/appointments/") && req.method === "GET") {
      try {
        const appointmentId = url.pathname.split('/').pop();
        const appointment = getAppointment(appointmentId);

        if (!appointment) {
          return new Response(
            JSON.stringify({ error: 'Appointment not found' }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }

        return new Response(
          JSON.stringify(appointment),
          {
            headers: { 'Content-Type': 'application/json' }
          }
        );
      } catch (error) {
        console.error('Error fetching appointment:', error);
        return new Response(
          JSON.stringify({ error: 'Internal server error' }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // Serve booking form
    else if (url.pathname === "/book" || url.pathname === "/") {
      try {
        const htmlPath = join(__dirname, 'public', 'booking.html');
        if (existsSync(htmlPath)) {
          const html = readFileSync(htmlPath, 'utf8');
          return new Response(html, {
            headers: { 'Content-Type': 'text/html' }
          });
        }
      } catch (error) {
        console.error('Error serving booking form:', error);
      }
      // Fallback to figlet
      const body = figlet.textSync("Bringin' you the Bun Info!");
      return new Response(body);
    }

    // Default response
    const body = figlet.textSync("Bringin' you the Bun Info!");
    return new Response(body);
  },
});


console.log(`Info server listening on http://localhost:${server.port} ...`);
console.log(`Appointment booking available at http://localhost:${server.port}/book`);
