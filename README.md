# Appointment Scheduling System

A comprehensive appointment scheduling system for individual business owners (therapists, cosmeticians, consultants, etc.) with Google Calendar integration and Telegram-based approval workflow.

## Features

- **📅 Online Booking Form** - Beautiful, responsive web interface for clients to request appointments
- **🤖 Telegram Integration** - Receive appointment requests via Telegram with instant approval/rejection buttons
- **📆 Google Calendar Sync** - Automatically add approved appointments to your Google Calendar
- **📧 Email Notifications** - Notify clients when appointments are approved or rejected (extensible)
- **💾 SQLite Database** - Reliable local storage for appointment records
- **🔒 Secure** - OAuth 2.0 for Google Calendar, sensitive data excluded from version control
- **⚡ Fast** - Built with Bun runtime for optimal performance

## How It Works

1. **Client submits appointment request** through the web form
2. **Request is stored** in the database with "pending" status
3. **You receive a Telegram notification** with Approve/Reject buttons
4. **You click a button** to approve or reject
5. **If approved**: Event is added to Google Calendar and client is notified
6. **If rejected**: Client is notified that the time is not available

## Quick Start

### Prerequisites

- Node.js 18+ or Bun runtime
- Google account with Calendar API access
- Telegram account

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd bunji
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Follow the [SETUP.md](./SETUP.md) guide for detailed configuration instructions

4. Run the application:
   ```bash
   npm start
   ```

5. Open http://localhost:3000/book in your browser

## Project Structure

```
bunji/
├── index.js              # Main server with API endpoints
├── database.js           # SQLite database operations
├── calendar.js           # Google Calendar API integration
├── telegram.js           # Telegram bot for approvals
├── notifications.js      # Client notification system
├── authorize.js          # Google OAuth authorization helper
├── info.js               # System information utilities
├── public/
│   └── booking.html      # Booking form frontend
├── config.example.json   # Example configuration file
├── SETUP.md              # Detailed setup instructions
└── README.md             # This file
```

## API Endpoints

### Appointment System

- `GET /` or `GET /book` - Appointment booking form
- `POST /api/appointments` - Create a new appointment request
- `GET /api/appointments` - Get all appointments
- `GET /api/appointments/:id` - Get a specific appointment

### System Information (Legacy)

- `GET /memory` - System memory information
- `GET /cpu` - System CPU information

## Configuration

Create a `config.json` file based on `config.example.json`:

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

See [SETUP.md](./SETUP.md) for detailed configuration instructions.

## Technologies Used

- **Runtime**: Bun / Node.js
- **Database**: SQLite (better-sqlite3)
- **Google Calendar**: googleapis
- **Telegram Bot**: node-telegram-bot-api
- **Frontend**: Vanilla HTML/CSS/JavaScript

## Security

- All sensitive files (`config.json`, `credentials.json`, `token.json`, `*.db`) are in `.gitignore`
- OAuth 2.0 for Google Calendar authentication
- Telegram bot token kept secure in configuration
- Input validation on all API endpoints

## Contributing

This is a custom solution for individual business owners. Feel free to fork and adapt to your needs.

## License

ISC

## Support

For setup instructions, see [SETUP.md](./SETUP.md)

For issues or questions, please open an issue on the repository.
