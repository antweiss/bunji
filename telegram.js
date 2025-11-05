import TelegramBot from 'node-telegram-bot-api';
import { getAppointment, updateAppointmentStatus } from './database.js';
import { createCalendarEvent, deleteCalendarEvent } from './calendar.js';
import { sendNotification } from './notifications.js';

let bot = null;
let adminChatId = null;

/**
 * Initialize Telegram bot
 * @param {string} token - Telegram bot token
 * @param {string} chatId - Admin chat ID for receiving notifications
 */
export const initTelegramBot = (token, chatId) => {
  adminChatId = chatId;
  bot = new TelegramBot(token, { polling: true });

  // Handle callback queries (button presses)
  bot.on('callback_query', async (callbackQuery) => {
    const action = callbackQuery.data;
    const msg = callbackQuery.message;

    try {
      // Parse action: approve_<appointmentId> or reject_<appointmentId>
      const [command, appointmentId] = action.split('_');

      if (!appointmentId) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: 'Invalid action',
        });
        return;
      }

      const appointment = getAppointment(appointmentId);

      if (!appointment) {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: 'Appointment not found',
        });
        return;
      }

      if (appointment.status !== 'pending') {
        await bot.answerCallbackQuery(callbackQuery.id, {
          text: `Appointment already ${appointment.status}`,
        });
        return;
      }

      if (command === 'approve') {
        // Create calendar event
        const eventId = await createCalendarEvent(appointment);

        // Update appointment status
        updateAppointmentStatus(appointmentId, 'approved', eventId);

        // Send notification to client
        await sendNotification(appointment, 'approved');

        // Update Telegram message
        await bot.editMessageText(
          `✅ APPROVED\n\n${formatAppointmentMessage(appointment)}\n\n` +
          `Calendar Event ID: ${eventId}`,
          {
            chat_id: msg.chat.id,
            message_id: msg.message_id,
          }
        );

        await bot.answerCallbackQuery(callbackQuery.id, {
          text: '✅ Appointment approved and added to calendar',
        });
      } else if (command === 'reject') {
        // Update appointment status
        updateAppointmentStatus(appointmentId, 'rejected');

        // Send notification to client
        await sendNotification(appointment, 'rejected');

        // Update Telegram message
        await bot.editMessageText(
          `❌ REJECTED\n\n${formatAppointmentMessage(appointment)}`,
          {
            chat_id: msg.chat.id,
            message_id: msg.message_id,
          }
        );

        await bot.answerCallbackQuery(callbackQuery.id, {
          text: '❌ Appointment rejected',
        });
      }
    } catch (error) {
      console.error('Error handling callback query:', error);
      await bot.answerCallbackQuery(callbackQuery.id, {
        text: 'Error processing request',
      });
    }
  });

  // Handle /start command
  bot.onText(/\/start/, (msg) => {
    bot.sendMessage(
      msg.chat.id,
      `Welcome to the Appointment Scheduler Bot!\n\n` +
      `Your Chat ID is: ${msg.chat.id}\n\n` +
      `Please add this ID to your configuration file.`
    );
  });

  // Handle /status command
  bot.onText(/\/status/, async (msg) => {
    if (msg.chat.id.toString() !== adminChatId) {
      bot.sendMessage(msg.chat.id, 'Unauthorized');
      return;
    }

    const { getAppointmentsByStatus } = await import('./database.js');
    const pending = getAppointmentsByStatus('pending');
    const approved = getAppointmentsByStatus('approved');
    const rejected = getAppointmentsByStatus('rejected');

    bot.sendMessage(
      msg.chat.id,
      `📊 Appointment Status:\n\n` +
      `⏳ Pending: ${pending.length}\n` +
      `✅ Approved: ${approved.length}\n` +
      `❌ Rejected: ${rejected.length}`
    );
  });

  console.log('Telegram bot initialized successfully');
  return bot;
};

/**
 * Send appointment request to admin via Telegram
 * @param {Object} appointment - Appointment details
 */
export const sendAppointmentRequest = async (appointment) => {
  if (!bot || !adminChatId) {
    throw new Error('Telegram bot not initialized');
  }

  const message = `🔔 New Appointment Request\n\n${formatAppointmentMessage(appointment)}`;

  const options = {
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: '✅ Approve',
            callback_data: `approve_${appointment.id}`,
          },
          {
            text: '❌ Reject',
            callback_data: `reject_${appointment.id}`,
          },
        ],
      ],
    },
  };

  try {
    const sentMessage = await bot.sendMessage(adminChatId, message, options);

    // Update appointment with telegram message ID
    updateAppointmentStatus(appointment.id, 'pending', null, sentMessage.message_id);

    return sentMessage;
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    throw error;
  }
};

/**
 * Format appointment details for display
 * @param {Object} appointment - Appointment details
 * @returns {string} - Formatted message
 */
const formatAppointmentMessage = (appointment) => {
  return `👤 Client: ${appointment.client_name}
📧 Email: ${appointment.client_email}
📱 Phone: ${appointment.client_phone || 'N/A'}
💼 Service: ${appointment.service_type}
📅 Date: ${appointment.requested_date}
⏰ Time: ${appointment.requested_time}
⏱️ Duration: ${appointment.duration} minutes
📝 Notes: ${appointment.notes || 'None'}`;
};

/**
 * Send a message to admin
 * @param {string} message - Message to send
 */
export const sendAdminMessage = async (message) => {
  if (!bot || !adminChatId) {
    throw new Error('Telegram bot not initialized');
  }

  return await bot.sendMessage(adminChatId, message);
};

export default bot;
