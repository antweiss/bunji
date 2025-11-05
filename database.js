import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const db = new Database(join(__dirname, 'appointments.db'));

// Create appointments table
db.exec(`
  CREATE TABLE IF NOT EXISTS appointments (
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
`);

// Create index for faster lookups
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_status ON appointments(status);
  CREATE INDEX IF NOT EXISTS idx_email ON appointments(client_email);
  CREATE INDEX IF NOT EXISTS idx_date ON appointments(requested_date);
`);

export const createAppointment = (appointment) => {
  const stmt = db.prepare(`
    INSERT INTO appointments (
      id, client_name, client_email, client_phone, service_type,
      requested_date, requested_time, duration, notes, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  return stmt.run(
    appointment.id,
    appointment.client_name,
    appointment.client_email,
    appointment.client_phone || null,
    appointment.service_type,
    appointment.requested_date,
    appointment.requested_time,
    appointment.duration || 60,
    appointment.notes || null,
    'pending'
  );
};

export const getAppointment = (id) => {
  const stmt = db.prepare('SELECT * FROM appointments WHERE id = ?');
  return stmt.get(id);
};

export const updateAppointmentStatus = (id, status, calendarEventId = null, telegramMessageId = null) => {
  const updates = ['status = ?', 'updated_at = CURRENT_TIMESTAMP'];
  const params = [status];

  if (calendarEventId) {
    updates.push('calendar_event_id = ?');
    params.push(calendarEventId);
  }

  if (telegramMessageId) {
    updates.push('telegram_message_id = ?');
    params.push(telegramMessageId);
  }

  params.push(id);

  const stmt = db.prepare(`
    UPDATE appointments
    SET ${updates.join(', ')}
    WHERE id = ?
  `);

  return stmt.run(...params);
};

export const getAppointmentsByStatus = (status) => {
  const stmt = db.prepare('SELECT * FROM appointments WHERE status = ? ORDER BY requested_date, requested_time');
  return stmt.all(status);
};

export const getAllAppointments = () => {
  const stmt = db.prepare('SELECT * FROM appointments ORDER BY requested_date DESC, requested_time DESC');
  return stmt.all();
};

export const deleteAppointment = (id) => {
  const stmt = db.prepare('DELETE FROM appointments WHERE id = ?');
  return stmt.run(id);
};

export default db;
