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

/**
 * Get available time slots for a specific date
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {number} duration - Appointment duration in minutes
 * @param {Object} businessHours - Business hours configuration
 * @returns {Promise<Array>} - Array of available time slots
 */
export const getAvailableSlots = async (date, duration = 60, businessHours = null) => {
  if (!calendar) {
    await initCalendar();
  }

  try {
    // Default business hours: Monday-Friday 9am-5pm
    const defaultBusinessHours = {
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' },
      saturday: null,
      sunday: null
    };

    const hours = businessHours || defaultBusinessHours;

    // Parse the date
    const targetDate = new Date(date + 'T00:00:00');
    const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][targetDate.getDay()];

    // Check if business is open on this day
    if (!hours[dayOfWeek]) {
      return [];
    }

    const { start: startTime, end: endTime } = hours[dayOfWeek];

    // Create start and end datetime for the day
    const dayStart = new Date(`${date}T${startTime}:00`);
    const dayEnd = new Date(`${date}T${endTime}:00`);

    // Get all events for this day
    const events = await listEvents(dayStart, new Date(dayEnd.getTime() + 1000));

    // Generate all possible time slots
    const slots = [];
    let currentSlot = new Date(dayStart);

    while (currentSlot < dayEnd) {
      const slotEnd = new Date(currentSlot.getTime() + duration * 60000);

      // Check if slot would end after business hours
      if (slotEnd > dayEnd) {
        break;
      }

      // Check if this slot conflicts with any existing events
      let isAvailable = true;
      for (const event of events) {
        const eventStart = new Date(event.start.dateTime || event.start.date);
        const eventEnd = new Date(event.end.dateTime || event.end.date);

        // Check for overlap
        if (
          (currentSlot >= eventStart && currentSlot < eventEnd) ||
          (slotEnd > eventStart && slotEnd <= eventEnd) ||
          (currentSlot <= eventStart && slotEnd >= eventEnd)
        ) {
          isAvailable = false;
          break;
        }
      }

      if (isAvailable) {
        slots.push({
          start: currentSlot.toISOString(),
          end: slotEnd.toISOString(),
          time: currentSlot.toTimeString().slice(0, 5), // HH:MM format
          display: formatTimeSlot(currentSlot)
        });
      }

      // Move to next slot (15-minute increments)
      currentSlot = new Date(currentSlot.getTime() + 15 * 60000);
    }

    return slots;
  } catch (error) {
    console.error('Error getting available slots:', error.message);
    throw error;
  }
};

/**
 * Check if a specific time slot is available
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} time - Time in HH:MM format
 * @param {number} duration - Duration in minutes
 * @returns {Promise<boolean>}
 */
export const isSlotAvailable = async (date, time, duration = 60) => {
  if (!calendar) {
    await initCalendar();
  }

  try {
    const slotStart = new Date(`${date}T${time}:00`);
    const slotEnd = new Date(slotStart.getTime() + duration * 60000);

    const events = await listEvents(slotStart, slotEnd);

    // If there are any events in this time range, slot is not available
    return events.length === 0;
  } catch (error) {
    console.error('Error checking slot availability:', error.message);
    throw error;
  }
};

/**
 * Format a time slot for display
 * @param {Date} date
 * @returns {string}
 */
const formatTimeSlot = (date) => {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
};
