# Appointment Scheduling System - Setup Guide

This guide will help you set up the appointment scheduling system with Google Calendar and Telegram integration.

## Prerequisites

- Node.js or Bun runtime
- A Google account
- A Telegram account

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set up Google Calendar API

### 2.1 Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google Calendar API:
   - Go to "APIs & Services" > "Library"
   - Search for "Google Calendar API"
   - Click "Enable"

### 2.2 Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Select "Desktop app" as the application type
4. Download the credentials JSON file
5. Rename it to `credentials.json` and place it in the project root

### 2.3 Authorize the Application

Run the authorization script:

```bash
node authorize.js
```

This will:
- Open a browser window for you to authorize the application
- Save the token to `token.json` for future use

**Note:** Both `credentials.json` and `token.json` are in `.gitignore` and should never be committed to version control.

## Step 3: Set up Telegram Bot

### 3.1 Create a Telegram Bot

1. Open Telegram and search for [@BotFather](https://t.me/botfather)
2. Send `/newbot` command
3. Follow the instructions to create your bot
4. Save the bot token (looks like: `1234567890:ABCdefGhIJKlmNoPQRsTUVwxyZ`)

### 3.2 Get Your Chat ID

1. Start your bot by searching for it in Telegram
2. Send `/start` to your bot
3. The bot will reply with your Chat ID
4. Save this Chat ID (it's a number like: `123456789`)

Alternatively, you can:
1. Send a message to your bot
2. Visit: `https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates`
3. Look for the "chat" > "id" field in the response

## Step 4: Configure the Application

1. Copy the example configuration file:
   ```bash
   cp config.example.json config.json
   ```

2. Edit `config.json` with your details:
   ```json
   {
     "telegram": {
       "token": "YOUR_TELEGRAM_BOT_TOKEN",
       "adminChatId": "YOUR_ADMIN_CHAT_ID"
     },
     "business": {
       "name": "Your Business Name",
       "email": "business@example.com",
       "timezone": "UTC"
     }
   }
   ```

## Step 5: Run the Application

```bash
npm start
# or
node index.js
# or
bun run index.js
```

The server will start on `http://localhost:3000`

## Step 6: Test the System

1. Open `http://localhost:3000/book` in your browser
2. Fill out the appointment booking form
3. Submit the form
4. You should receive a notification in Telegram with approval buttons
5. Click "Approve" or "Reject" to process the appointment
6. If approved, the event will be added to your Google Calendar
7. The client will receive a notification (currently logged to console)

## API Endpoints

- `GET /` - Booking form
- `GET /book` - Booking form (alternative route)
- `POST /api/appointments` - Create a new appointment request
- `GET /api/appointments` - Get all appointments
- `GET /api/appointments/:id` - Get a specific appointment
- `GET /memory` - System memory information
- `GET /cpu` - System CPU information

## Telegram Bot Commands

- `/start` - Get your Chat ID
- `/status` - View appointment statistics (admin only)

## Workflow

1. **Client submits appointment request** via the web form
2. **Request is saved** to SQLite database with "pending" status
3. **Notification is sent** to Telegram with Approve/Reject buttons
4. **Business owner reviews** and clicks Approve or Reject
5. **If Approved:**
   - Event is created in Google Calendar
   - Calendar invitation is sent to client
   - Appointment status is updated to "approved"
   - Client receives confirmation notification
6. **If Rejected:**
   - Appointment status is updated to "rejected"
   - Client receives rejection notification

## Database

The system uses SQLite to store appointment data. The database file `appointments.db` is created automatically when the application starts.

### Database Schema

```sql
appointments (
  id TEXT PRIMARY KEY,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  service_type TEXT NOT NULL,
  requested_date TEXT NOT NULL,
  requested_time TEXT NOT NULL,
  duration INTEGER DEFAULT 60,
  notes TEXT,
  status TEXT DEFAULT 'pending',
  telegram_message_id INTEGER,
  calendar_event_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```

## Customization

### Service Types

Edit `public/booking.html` to customize the service types offered:

```html
<select id="service_type" name="service_type" required>
  <option value="">Select a service...</option>
  <option value="Your Service">Your Service</option>
  <!-- Add more options -->
</select>
```

### Email Notifications

The notification system currently logs messages to the console. To implement actual email sending:

1. Install an email service library (e.g., nodemailer)
2. Edit `notifications.js` to integrate with your email service
3. Uncomment and configure the email sending code

### Time Zone

The system currently uses UTC for calendar events. To use a different timezone:

1. Update the `timezone` field in `config.json`
2. Modify the calendar event creation in `calendar.js` to use your timezone

## Troubleshooting

### Google Calendar API Errors

- Ensure the Google Calendar API is enabled in your Google Cloud project
- Check that `credentials.json` is properly configured
- Try regenerating `token.json` by running the authorization script again

### Telegram Bot Not Responding

- Verify your bot token is correct
- Ensure your Chat ID is correct (it should be a number)
- Check that the bot is not blocked
- Make sure the bot has permission to send messages

### Database Errors

- Ensure the application has write permissions in the project directory
- Check that `appointments.db` is not corrupted
- Delete `appointments.db` to reset (all data will be lost)

## Security Notes

- Never commit `config.json`, `credentials.json`, or `token.json` to version control
- Keep your Telegram bot token secret
- Consider adding authentication for the booking form in production
- Use HTTPS in production
- Consider rate limiting for the API endpoints
- Sanitize all user inputs

## Production Deployment

For production deployment:

1. Set up a reverse proxy (e.g., Nginx) with SSL/TLS
2. Use environment variables instead of config.json
3. Implement proper logging and monitoring
4. Set up automated backups for the database
5. Implement email notifications
6. Add authentication for admin endpoints
7. Consider using a more robust database (PostgreSQL, MySQL)
8. Implement rate limiting and CAPTCHA on the booking form

## License

This is a custom appointment scheduling system for individual business owners.
