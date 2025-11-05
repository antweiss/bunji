import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let calendar = null;

/**
 * Initialize Google Calendar API with credentials
 */
export const initCalendar = async () => {
  try {
    // Load credentials from file
    const credentialsPath = join(__dirname, 'credentials.json');
    const credentials = JSON.parse(readFileSync(credentialsPath, 'utf8'));

    // Create OAuth2 client
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Load token from file
    const tokenPath = join(__dirname, 'token.json');
    const token = JSON.parse(readFileSync(tokenPath, 'utf8'));
    oAuth2Client.setCredentials(token);

    // Create calendar instance
    calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    console.log('Google Calendar API initialized successfully');
    return calendar;
  } catch (error) {
    console.error('Error initializing Google Calendar:', error.message);
    throw error;
  }
};

/**
 * Create a calendar event
 * @param {Object} appointment - Appointment details
 * @returns {Promise<string>} - Calendar event ID
 */
export const createCalendarEvent = async (appointment) => {
  if (!calendar) {
    await initCalendar();
  }

  try {
    // Parse date and time
    const startDateTime = new Date(`${appointment.requested_date}T${appointment.requested_time}`);
    const endDateTime = new Date(startDateTime.getTime() + appointment.duration * 60000);

    const event = {
      summary: `${appointment.service_type} - ${appointment.client_name}`,
      description: `Client: ${appointment.client_name}
Email: ${appointment.client_email}
Phone: ${appointment.client_phone || 'N/A'}
Service: ${appointment.service_type}
Notes: ${appointment.notes || 'None'}`,
      start: {
        dateTime: startDateTime.toISOString(),
        timeZone: 'UTC',
      },
      end: {
        dateTime: endDateTime.toISOString(),
        timeZone: 'UTC',
      },
      attendees: [
        { email: appointment.client_email }
      ],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 30 },
        ],
      },
    };

    const response = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
      sendUpdates: 'all', // Send email notifications to attendees
    });

    console.log(`Calendar event created: ${response.data.id}`);
    return response.data.id;
  } catch (error) {
    console.error('Error creating calendar event:', error.message);
    throw error;
  }
};

/**
 * Delete a calendar event
 * @param {string} eventId - Calendar event ID
 */
export const deleteCalendarEvent = async (eventId) => {
  if (!calendar) {
    await initCalendar();
  }

  try {
    await calendar.events.delete({
      calendarId: 'primary',
      eventId: eventId,
      sendUpdates: 'all', // Notify attendees
    });

    console.log(`Calendar event deleted: ${eventId}`);
  } catch (error) {
    console.error('Error deleting calendar event:', error.message);
    throw error;
  }
};

/**
 * Get calendar event
 * @param {string} eventId - Calendar event ID
 */
export const getCalendarEvent = async (eventId) => {
  if (!calendar) {
    await initCalendar();
  }

  try {
    const response = await calendar.events.get({
      calendarId: 'primary',
      eventId: eventId,
    });

    return response.data;
  } catch (error) {
    console.error('Error getting calendar event:', error.message);
    throw error;
  }
};

/**
 * List events for a specific date range
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 */
export const listEvents = async (startDate, endDate) => {
  if (!calendar) {
    await initCalendar();
  }

  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: startDate.toISOString(),
      timeMax: endDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    return response.data.items || [];
  } catch (error) {
    console.error('Error listing calendar events:', error.message);
    throw error;
  }
};
