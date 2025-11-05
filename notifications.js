/**
 * Notification module for sending appointment status updates to clients
 */

/**
 * Send notification to client about appointment status
 * @param {Object} appointment - Appointment details
 * @param {string} status - 'approved' or 'rejected'
 */
export const sendNotification = async (appointment, status) => {
  console.log(`📧 Sending ${status} notification to ${appointment.client_email}`);

  // In a production environment, you would integrate with an email service
  // like SendGrid, AWS SES, or Nodemailer with SMTP
  // For now, we'll log the notification

  const message = generateNotificationMessage(appointment, status);

  console.log('Notification message:');
  console.log(message);

  // TODO: Implement actual email sending
  // Example with nodemailer:
  // await transporter.sendMail({
  //   from: 'noreply@yourbusiness.com',
  //   to: appointment.client_email,
  //   subject: status === 'approved'
  //     ? 'Appointment Confirmed'
  //     : 'Appointment Request Update',
  //   text: message,
  //   html: generateHTMLNotification(appointment, status)
  // });

  return { success: true, message: 'Notification logged' };
};

/**
 * Generate notification message text
 * @param {Object} appointment - Appointment details
 * @param {string} status - 'approved' or 'rejected'
 * @returns {string} - Notification message
 */
const generateNotificationMessage = (appointment, status) => {
  if (status === 'approved') {
    return `Dear ${appointment.client_name},

Your appointment has been CONFIRMED!

Service: ${appointment.service_type}
Date: ${appointment.requested_date}
Time: ${appointment.requested_time}
Duration: ${appointment.duration} minutes

You should receive a calendar invitation shortly at ${appointment.client_email}.

Please arrive 5 minutes early for your appointment.

If you need to cancel or reschedule, please contact us as soon as possible.

Thank you!`;
  } else {
    return `Dear ${appointment.client_name},

We regret to inform you that we cannot accommodate your appointment request at the requested time.

Requested Service: ${appointment.service_type}
Requested Date: ${appointment.requested_date}
Requested Time: ${appointment.requested_time}

Please contact us to find an alternative time that works for both of us.

We apologize for any inconvenience.

Thank you for your understanding.`;
  }
};

/**
 * Generate HTML notification
 * @param {Object} appointment - Appointment details
 * @param {string} status - 'approved' or 'rejected'
 * @returns {string} - HTML notification
 */
const generateHTMLNotification = (appointment, status) => {
  const statusColor = status === 'approved' ? '#4CAF50' : '#f44336';
  const statusText = status === 'approved' ? 'CONFIRMED' : 'NOT AVAILABLE';

  return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: ${statusColor}; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
    .content { background: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }
    .details { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid ${statusColor}; }
    .detail-row { margin: 10px 0; }
    .label { font-weight: bold; color: #555; }
    .footer { text-align: center; margin-top: 20px; color: #777; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Appointment ${statusText}</h1>
    </div>
    <div class="content">
      <p>Dear ${appointment.client_name},</p>
      ${status === 'approved' ? `
      <p>Your appointment has been <strong>confirmed</strong>! We look forward to seeing you.</p>
      <div class="details">
        <div class="detail-row"><span class="label">Service:</span> ${appointment.service_type}</div>
        <div class="detail-row"><span class="label">Date:</span> ${appointment.requested_date}</div>
        <div class="detail-row"><span class="label">Time:</span> ${appointment.requested_time}</div>
        <div class="detail-row"><span class="label">Duration:</span> ${appointment.duration} minutes</div>
      </div>
      <p>You will receive a calendar invitation shortly at <strong>${appointment.client_email}</strong>.</p>
      <p><em>Please arrive 5 minutes early for your appointment.</em></p>
      ` : `
      <p>We regret to inform you that we cannot accommodate your appointment request at the requested time.</p>
      <div class="details">
        <div class="detail-row"><span class="label">Requested Service:</span> ${appointment.service_type}</div>
        <div class="detail-row"><span class="label">Requested Date:</span> ${appointment.requested_date}</div>
        <div class="detail-row"><span class="label">Requested Time:</span> ${appointment.requested_time}</div>
      </div>
      <p>Please contact us to find an alternative time that works for both of us.</p>
      `}
      <p>Thank you!</p>
    </div>
    <div class="footer">
      <p>This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Send reminder notification (can be used for scheduled reminders)
 * @param {Object} appointment - Appointment details
 */
export const sendReminder = async (appointment) => {
  console.log(`🔔 Sending reminder to ${appointment.client_email}`);

  const message = `Reminder: You have an appointment tomorrow!

Service: ${appointment.service_type}
Date: ${appointment.requested_date}
Time: ${appointment.requested_time}

We look forward to seeing you!`;

  console.log(message);

  return { success: true, message: 'Reminder logged' };
};
