const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const { open } = require('sqlite');
const PDFDocument = require('pdfkit');
const { PDFDocument: PDFLibDocument, rgb, StandardFonts } = require('pdf-lib');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8001;
const SECRET_KEY = process.env.SECRET_KEY || 'your-secret-key-change-in-production-12345';

// Middleware - aumentar limite para upload de PDF base64
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: '*',
  credentials: true
}));

// Database setup
let db;

async function initDatabase() {
  db = await open({
    filename: './database.sqlite',
    driver: sqlite3.Database
  });

  // Create tables
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      type TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      client_name TEXT NOT NULL,
      cpf TEXT,
      address TEXT,
      city_uf TEXT,
      cep TEXT,
      phone TEXT,
      email TEXT,
      birthday_person_name TEXT NOT NULL,
      age_to_complete INTEGER,
      party_theme TEXT,
      balloon_color TEXT,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT NOT NULL DEFAULT '["amarelo"]',
      base_value REAL NOT NULL,
      total_value REAL,
      extra_hours TEXT,
      game_cards TEXT,
      waiters TEXT,
      helpers TEXT,
      party_kit TEXT,
      payment_method TEXT,
      payment_status TEXT NOT NULL,
      payment_details TEXT,
      observations TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedules (
      id TEXT PRIMARY KEY,
      event_id TEXT,
      employee_id TEXT NOT NULL,
      date TEXT NOT NULL,
      shift TEXT NOT NULL,
      confirmed TEXT NOT NULL DEFAULT 'pending',
      hours_worked REAL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      key TEXT UNIQUE NOT NULL,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  // Create default admin user if not exists
  const adminExists = await db.get('SELECT id FROM users WHERE username = ?', ['admin']);
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await db.run(
      'INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), 'admin', hashedPassword, 'admin', new Date().toISOString()]
    );
    console.log('Default admin user created (username: admin, password: admin123)');
  }

  console.log('Database initialized successfully');
}

// ============== HELPER FUNCTIONS ==============

function checkTimeConflict(start1, end1, start2, end2) {
  const [h1, m1] = start1.split(':').map(Number);
  const [h2, m2] = end1.split(':').map(Number);
  const [h3, m3] = start2.split(':').map(Number);
  const [h4, m4] = end2.split(':').map(Number);

  const s1_min = h1 * 60 + m1;
  const e1_min = h2 * 60 + m2;
  const s2_min = h3 * 60 + m3;
  const e2_min = h4 * 60 + m4;

  return !(e1_min <= s2_min || e2_min <= s1_min);
}

// ============== AUTH MIDDLEWARE ==============

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ detail: 'No token provided' });
  }

  try {
    const payload = jwt.verify(token, SECRET_KEY);
    const user = await db.get(
      'SELECT id, username, role, created_at FROM users WHERE username = ?',
      [payload.sub]
    );

    if (!user) {
      return res.status(401).json({ detail: 'User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ detail: 'Invalid token' });
  }
}

async function requireAdmin(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ detail: 'Not authorized' });
  }
  next();
}

// ============== AUTH ROUTES ==============

app.post('/api/auth/register', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { username, password, role = 'user' } = req.body;

    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ detail: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const createdAt = new Date().toISOString();

    await db.run(
      'INSERT INTO users (id, username, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
      [userId, username, hashedPassword, role, createdAt]
    );

    const user = { id: userId, username, role, created_at: createdAt };
    res.json(user);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const user = await db.get('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ detail: 'Invalid credentials' });
    }

    const token = jwt.sign({ sub: username }, SECRET_KEY);
    const userData = {
      id: user.id,
      username: user.username,
      role: user.role,
      created_at: user.created_at
    };

    res.json({
      access_token: token,
      token_type: 'bearer',
      user: userData
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json(req.user);
});

// ============== USER ROUTES ==============

app.get('/api/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await db.all('SELECT id, username, role, created_at FROM users');
    res.json(users);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.put('/api/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { username, password, role } = req.body;

    const existing = await db.get(
      'SELECT id FROM users WHERE username = ? AND id != ?',
      [username, userId]
    );
    if (existing) {
      return res.status(400).json({ detail: 'Username already exists' });
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      await db.run(
        'UPDATE users SET username = ?, password_hash = ?, role = ? WHERE id = ?',
        [username, hashedPassword, role, userId]
      );
    } else {
      await db.run(
        'UPDATE users SET username = ?, role = ? WHERE id = ?',
        [username, role, userId]
      );
    }

    const user = await db.get(
      'SELECT id, username, role, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.delete('/api/users/:userId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.id === userId) {
      const adminCount = await db.get('SELECT COUNT(*) as count FROM users WHERE role = "admin"');
      if (adminCount.count <= 1) {
        return res.status(400).json({ detail: 'Cannot delete the last admin user' });
      }
    }

    const result = await db.run('DELETE FROM users WHERE id = ?', [userId]);
    if (result.changes === 0) {
      return res.status(404).json({ detail: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// ============== EMPLOYEE ROUTES ==============

app.post('/api/employees', authenticateToken, async (req, res) => {
  try {
    const { name, role, type } = req.body;
    const employeeId = uuidv4();
    const createdAt = new Date().toISOString();

    await db.run(
      'INSERT INTO employees (id, name, role, type, created_at) VALUES (?, ?, ?, ?, ?)',
      [employeeId, name, role, type, createdAt]
    );

    const employee = { id: employeeId, name, role, type, created_at: createdAt };
    res.json(employee);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/employees', authenticateToken, async (req, res) => {
  try {
    const employees = await db.all('SELECT * FROM employees');
    res.json(employees);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/employees/:employeeId', authenticateToken, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const employee = await db.get('SELECT * FROM employees WHERE id = ?', [employeeId]);

    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }

    res.json(employee);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.put('/api/employees/:employeeId', authenticateToken, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const { name, role, type } = req.body;

    const result = await db.run(
      'UPDATE employees SET name = ?, role = ?, type = ? WHERE id = ?',
      [name, role, type, employeeId]
    );

    if (result.changes === 0) {
      return res.status(404).json({ detail: 'Employee not found' });
    }

    const employee = await db.get('SELECT * FROM employees WHERE id = ?', [employeeId]);
    res.json(employee);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.delete('/api/employees/:employeeId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { employeeId } = req.params;
    const result = await db.run('DELETE FROM employees WHERE id = ?', [employeeId]);

    if (result.changes === 0) {
      return res.status(404).json({ detail: 'Employee not found' });
    }

    res.json({ message: 'Employee deleted successfully' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// ============== EVENT ROUTES ==============

app.post('/api/events', authenticateToken, async (req, res) => {
  try {
    const eventData = req.body;

    // Check for time conflicts on same date and room
    const existingEvents = await db.all(
      'SELECT * FROM events WHERE date = ? AND room = ?',
      [eventData.date, eventData.room]
    );

    for (const existing of existingEvents) {
      if (checkTimeConflict(eventData.start_time, eventData.end_time, existing.start_time, existing.end_time)) {
        const roomName = eventData.room === 'amarelo' ? 'Amarelo' : 'Laranja';
        return res.status(400).json({
          detail: `Conflito de horário no Salão ${roomName} com o evento de ${existing.client_name} (${existing.start_time} - ${existing.end_time})`
        });
      }
    }

    const eventId = uuidv4();
    const createdAt = new Date().toISOString();
    
    // Calcular total_value se não vier do frontend
    const totalValue = eventData.total_value || eventData.base_value;

    await db.run(
      `INSERT INTO events (id, client_name, cpf, address, city_uf, cep, phone, email,
       birthday_person_name, age_to_complete, party_theme, balloon_color,
       date, start_time, end_time, room, base_value, total_value,
       extra_hours, game_cards, waiters, helpers, party_kit,
       payment_method, payment_status, payment_details, observations, created_at, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventId,
        eventData.client_name,
        eventData.cpf || null,
        eventData.address || null,
        eventData.city_uf || null,
        eventData.cep || null,
        eventData.phone || null,
        eventData.email || null,
        eventData.birthday_person_name,
        eventData.age_to_complete || null,
        eventData.party_theme || null,
        eventData.balloon_color || null,
        eventData.date,
        eventData.start_time,
        eventData.end_time,
        eventData.room || 'amarelo',
        eventData.base_value,
        totalValue,
        JSON.stringify(eventData.extra_hours || []),
        eventData.game_cards ? JSON.stringify(eventData.game_cards) : null,
        eventData.waiters ? JSON.stringify(eventData.waiters) : null,
        eventData.helpers ? JSON.stringify(eventData.helpers) : null,
        eventData.party_kit ? JSON.stringify(eventData.party_kit) : null,
        eventData.payment_method || null,
        eventData.payment_status || 'pending',
        eventData.payment_details ? JSON.stringify(eventData.payment_details) : null,
        eventData.observations || '',
        createdAt,
        createdAt
      ]
    );

    const event = await db.get('SELECT * FROM events WHERE id = ?', [eventId]);
    const parsedEvent = parseEvent(event);
    res.json(parsedEvent);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

function parseEvent(event) {
  return {
    ...event,
    extra_hours: event.extra_hours ? JSON.parse(event.extra_hours) : [],
    game_cards: event.game_cards ? JSON.parse(event.game_cards) : null,
    waiters: event.waiters ? JSON.parse(event.waiters) : null,
    helpers: event.helpers ? JSON.parse(event.helpers) : null,
    party_kit: event.party_kit ? JSON.parse(event.party_kit) : null,
    payment_details: event.payment_details ? JSON.parse(event.payment_details) : null
  };
}

app.get('/api/events', authenticateToken, async (req, res) => {
  try {
    const events = await db.all('SELECT * FROM events ORDER BY date ASC');
    const parsedEvents = events.map(parseEvent);
    res.json(parsedEvents);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/events/date/:date', authenticateToken, async (req, res) => {
  try {
    const { date } = req.params;
    const events = await db.all('SELECT * FROM events WHERE date = ?', [date]);
    const parsedEvents = events.map(parseEvent);
    res.json(parsedEvents);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/events/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const event = await db.get('SELECT * FROM events WHERE id = ?', [eventId]);

    if (!event) {
      return res.status(404).json({ detail: 'Event not found' });
    }

    const parsedEvent = parseEvent(event);
    res.json(parsedEvent);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.put('/api/events/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const eventData = req.body;

    // Check for time conflicts (excluding current event) on same room
    const existingEvents = await db.all(
      'SELECT * FROM events WHERE date = ? AND room = ? AND id != ?',
      [eventData.date, eventData.room, eventId]
    );

    for (const existing of existingEvents) {
      if (checkTimeConflict(eventData.start_time, eventData.end_time, existing.start_time, existing.end_time)) {
        const roomName = eventData.room === 'amarelo' ? 'Amarelo' : 'Laranja';
        return res.status(400).json({
          detail: `Conflito de horário no Salão ${roomName} com o evento de ${existing.client_name} (${existing.start_time} - ${existing.end_time})`
        });
      }
    }

    const updatedAt = new Date().toISOString();
    
    // Calcular total_value se não vier do frontend
    const totalValue = eventData.total_value || eventData.base_value;

    const result = await db.run(
      `UPDATE events SET client_name = ?, cpf = ?, address = ?, city_uf = ?, cep = ?, phone = ?, email = ?,
       birthday_person_name = ?, age_to_complete = ?, party_theme = ?, balloon_color = ?,
       date = ?, start_time = ?, end_time = ?, room = ?, base_value = ?, total_value = ?,
       extra_hours = ?, game_cards = ?, waiters = ?, helpers = ?, party_kit = ?,
       payment_method = ?, payment_status = ?, payment_details = ?, observations = ?, updated_at = ?
       WHERE id = ?`,
      [
        eventData.client_name,
        eventData.cpf || null,
        eventData.address || null,
        eventData.city_uf || null,
        eventData.cep || null,
        eventData.phone || null,
        eventData.email || null,
        eventData.birthday_person_name,
        eventData.age_to_complete || null,
        eventData.party_theme || null,
        eventData.balloon_color || null,
        eventData.date,
        eventData.start_time,
        eventData.end_time,
        eventData.room || 'amarelo',
        eventData.base_value,
        totalValue,
        JSON.stringify(eventData.extra_hours || []),
        eventData.game_cards ? JSON.stringify(eventData.game_cards) : null,
        eventData.waiters ? JSON.stringify(eventData.waiters) : null,
        eventData.helpers ? JSON.stringify(eventData.helpers) : null,
        eventData.party_kit ? JSON.stringify(eventData.party_kit) : null,
        eventData.payment_method || null,
        eventData.payment_status || 'pending',
        eventData.payment_details ? JSON.stringify(eventData.payment_details) : null,
        eventData.observations || '',
        updatedAt,
        eventId
      ]
    );

    if (result.changes === 0) {
      return res.status(404).json({ detail: 'Event not found' });
    }

    const event = await db.get('SELECT * FROM events WHERE id = ?', [eventId]);
    const parsedEvent = parseEvent(event);
    res.json(parsedEvent);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.delete('/api/events/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    const result = await db.run('DELETE FROM events WHERE id = ?', [eventId]);

    if (result.changes === 0) {
      return res.status(404).json({ detail: 'Event not found' });
    }

    // Delete associated schedules
    await db.run('DELETE FROM schedules WHERE event_id = ?', [eventId]);

    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// ============== SCHEDULE ROUTES ==============

app.post('/api/schedules', authenticateToken, async (req, res) => {
  try {
    const scheduleData = req.body;
    const scheduleId = uuidv4();
    const createdAt = new Date().toISOString();

    await db.run(
      `INSERT INTO schedules (id, event_id, employee_id, date, shift, confirmed, hours_worked, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        scheduleId,
        scheduleData.event_id || null,
        scheduleData.employee_id,
        scheduleData.date,
        scheduleData.shift,
        scheduleData.confirmed || 'pending',
        scheduleData.hours_worked || 0,
        createdAt
      ]
    );

    const schedule = await db.get('SELECT * FROM schedules WHERE id = ?', [scheduleId]);
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/schedules', authenticateToken, async (req, res) => {
  try {
    const { event_id, date, month } = req.query;
    let query = 'SELECT * FROM schedules WHERE 1=1';
    const params = [];

    if (event_id) {
      query += ' AND event_id = ?';
      params.push(event_id);
    }
    if (date) {
      query += ' AND date = ?';
      params.push(date);
    }
    if (month) {
      query += ' AND date LIKE ?';
      params.push(`${month}%`);
    }

    const schedules = await db.all(query, params);
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.put('/api/schedules/:scheduleId', authenticateToken, async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const scheduleData = req.body;

    const result = await db.run(
      `UPDATE schedules SET event_id = ?, employee_id = ?, date = ?, shift = ?, 
       confirmed = ?, hours_worked = ? WHERE id = ?`,
      [
        scheduleData.event_id || null,
        scheduleData.employee_id,
        scheduleData.date,
        scheduleData.shift,
        scheduleData.confirmed || 'pending',
        scheduleData.hours_worked || 0,
        scheduleId
      ]
    );

    if (result.changes === 0) {
      return res.status(404).json({ detail: 'Schedule not found' });
    }

    const schedule = await db.get('SELECT * FROM schedules WHERE id = ?', [scheduleId]);
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.delete('/api/schedules/:scheduleId', authenticateToken, async (req, res) => {
  try {
    const { scheduleId } = req.params;
    const result = await db.run('DELETE FROM schedules WHERE id = ?', [scheduleId]);

    if (result.changes === 0) {
      return res.status(404).json({ detail: 'Schedule not found' });
    }

    res.json({ message: 'Schedule deleted successfully' });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// ============== SETTINGS ROUTES ==============

app.post('/api/settings', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { key, value } = req.body;
    const existing = await db.get('SELECT id FROM settings WHERE key = ?', [key]);
    const updatedAt = new Date().toISOString();

    if (existing) {
      await db.run(
        'UPDATE settings SET value = ?, updated_at = ? WHERE key = ?',
        [JSON.stringify(value), updatedAt, key]
      );
    } else {
      const settingId = uuidv4();
      await db.run(
        'INSERT INTO settings (id, key, value, updated_at) VALUES (?, ?, ?, ?)',
        [settingId, key, JSON.stringify(value), updatedAt]
      );
    }

    const setting = await db.get('SELECT * FROM settings WHERE key = ?', [key]);
    res.json({
      id: setting.id,
      key: setting.key,
      value: JSON.parse(setting.value),
      updated_at: setting.updated_at
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/settings', authenticateToken, async (req, res) => {
  try {
    const settings = await db.all('SELECT * FROM settings');
    const parsedSettings = settings.map(s => ({
      id: s.id,
      key: s.key,
      value: JSON.parse(s.value),
      updated_at: s.updated_at
    }));
    res.json(parsedSettings);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

app.get('/api/settings/:key', authenticateToken, async (req, res) => {
  try {
    const { key } = req.params;
    const setting = await db.get('SELECT * FROM settings WHERE key = ?', [key]);

    if (!setting) {
      return res.status(404).json({ detail: 'Setting not found' });
    }

    res.json({
      id: setting.id,
      key: setting.key,
      value: JSON.parse(setting.value),
      updated_at: setting.updated_at
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// ============== DASHBOARD STATS ==============

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Count total events
    const totalEventsResult = await db.get('SELECT COUNT(*) as count FROM events');
    const totalEvents = totalEventsResult.count;

    // Events today
    const todayEvents = await db.all('SELECT * FROM events WHERE date = ?', [today]);

    // Upcoming events
    const upcomingEvents = await db.all(
      'SELECT * FROM events WHERE date >= ? ORDER BY date ASC LIMIT 10',
      [today]
    );
    const parsedUpcoming = upcomingEvents.map(parseEvent);

    // Financial stats - usando total_value ao invés de base_value
    const allEvents = await db.all('SELECT * FROM events');
    const totalRevenue = allEvents.reduce((sum, e) => sum + (e.total_value || e.base_value || 0), 0);
    
    // Calculate paid amount considering payment_details
    let paidAmount = 0;
    let pendingAmount = 0;
    
    allEvents.forEach(event => {
      const totalValue = event.total_value || event.base_value || 0;
      
      if (event.payment_status === 'paid') {
        paidAmount += totalValue;
      } else if (event.payment_status === 'partial' && event.payment_details) {
        try {
          const details = JSON.parse(event.payment_details);
          const paid = parseFloat(details.paid_amount) || 0;
          paidAmount += paid;
          pendingAmount += (totalValue - paid);
        } catch (e) {
          pendingAmount += totalValue;
        }
      } else {
        pendingAmount += totalValue;
      }
    });
    
    // Ensure pending matches total - paid
    if (pendingAmount === 0) {
      pendingAmount = totalRevenue - paidAmount;
    }

    // Employee count
    const totalEmployeesResult = await db.get('SELECT COUNT(*) as count FROM employees');
    const totalEmployees = totalEmployeesResult.count;

    res.json({
      total_events: totalEvents,
      today_events: todayEvents.length,
      upcoming_events: parsedUpcoming,
      total_revenue: totalRevenue,
      paid_amount: paidAmount,
      pending_amount: pendingAmount,
      total_employees: totalEmployees
    });
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// ============== ALERTS ==============

app.get('/api/alerts', authenticateToken, async (req, res) => {
  try {
    // Get alert_days setting
    const alertSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['alert_days']);
    const alertDays = alertSetting ? JSON.parse(alertSetting.value) : 3;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allEvents = await db.all('SELECT * FROM events');
    const alerts = [];

    for (const event of allEvents) {
      const [year, month, day] = event.date.split('-').map(Number);
      const eventDate = new Date(year, month - 1, day);
      eventDate.setHours(0, 0, 0, 0);

      const daysUntil = Math.floor((eventDate - today) / (1000 * 60 * 60 * 24));

      if (daysUntil >= 0 && daysUntil <= alertDays) {
        alerts.push({
          event: parseEvent(event),
          days_until: daysUntil
        });
      }
    }

    alerts.sort((a, b) => a.days_until - b.days_until);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ detail: err.message });
  }
});

// ============== FINANCIAL REPORT ==============

app.get('/api/reports/financial/:month', authenticateToken, async (req, res) => {
  try {
    const { month } = req.params; // formato: YYYY-MM
    const [year, monthNum] = month.split('-');
    
    // Buscar configuração de salões para formatar nomes
    const roomsSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['rooms']);
    const roomsConfig = roomsSetting ? JSON.parse(roomsSetting.value) : [
      { id: 'amarelo', name: 'Salão Amarelo' },
      { id: 'laranja', name: 'Salão Laranja' }
    ];
    
    // Função para formatar salões (suporta string antiga e array novo)
    const formatRoomsForReport = (roomData) => {
      let roomIds = [];
      if (typeof roomData === 'string') {
        try {
          roomIds = JSON.parse(roomData);
        } catch {
          roomIds = roomData ? [roomData] : [];
        }
      } else if (Array.isArray(roomData)) {
        roomIds = roomData;
      }
      
      const roomNames = roomIds.map(id => {
        const room = roomsConfig.find(r => r.id === id);
        return room ? room.name : id;
      });
      
      return roomNames.join(' e ') || 'Não definido';
    };
    
    // Buscar todos os eventos do mês
    const events = await db.all(
      'SELECT * FROM events WHERE date LIKE ? ORDER BY date ASC',
      [`${month}%`]
    );
    
    if (events.length === 0) {
      return res.status(404).json({ detail: 'Nenhum evento encontrado para este mês' });
    }
    
    // Calcular estatísticas usando total_value
    const totalEvents = events.length;
    const totalRevenue = events.reduce((sum, e) => sum + (e.total_value || e.base_value || 0), 0);
    
    let totalExtraHours = 0;
    let totalGameCards = 0;
    let totalWaiters = 0;
    let totalHelpers = 0;
    let totalPartyKit = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    
    events.forEach(event => {
      const totalValue = event.total_value || event.base_value || 0;
      
      // Extra hours (para detalhamento)
      if (event.extra_hours) {
        const extras = JSON.parse(event.extra_hours);
        totalExtraHours += extras.reduce((sum, e) => sum + (e.total || 0), 0);
      }
      
      // Game cards (para detalhamento)
      if (event.game_cards) {
        const cards = JSON.parse(event.game_cards);
        totalGameCards += cards.total || 0;
      }
      
      // Waiters (para detalhamento)
      if (event.waiters) {
        const waiters = JSON.parse(event.waiters);
        totalWaiters += waiters.total || 0;
      }
      
      // Helpers (para detalhamento)
      if (event.helpers) {
        const helpers = JSON.parse(event.helpers);
        totalHelpers += helpers.total || 0;
      }
      
      // Party Kit (para detalhamento)
      if (event.party_kit) {
        const kit = JSON.parse(event.party_kit);
        totalPartyKit += kit.total || 0;
      }
      
      // Payment calculation usando total_value
      if (event.payment_status === 'paid') {
        paidAmount += totalValue;
      } else if (event.payment_status === 'partial' && event.payment_details) {
        try {
          const details = JSON.parse(event.payment_details);
          const paid = parseFloat(details.paid_amount) || 0;
          paidAmount += paid;
          pendingAmount += (totalValue - paid);
        } catch (e) {
          pendingAmount += totalValue;
        }
      } else {
        pendingAmount += totalValue;
      }
    });
    
    // Ensure pending matches total - paid
    if (pendingAmount === 0) {
      pendingAmount = totalRevenue - paidAmount;
    }
    
    // Criar PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=relatorio-${month}.pdf`);
    
    doc.pipe(res);
    
    // Título
    doc.fontSize(20).text('Relatório Financeiro Mensal', { align: 'center' });
    doc.fontSize(14).text(`${getMonthName(monthNum)}/${year}`, { align: 'center' });
    doc.moveDown(2);
    
    // Resumo Geral
    doc.fontSize(16).text('Resumo Geral', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    doc.text(`Total de Festas: ${totalEvents}`);
    doc.text(`Valor Total: R$ ${totalRevenue.toFixed(2)}`);
    doc.text(`Valor Pago: R$ ${paidAmount.toFixed(2)}`);
    doc.text(`Valor Pendente: R$ ${pendingAmount.toFixed(2)}`);
    doc.moveDown();
    doc.text(`Total de Horas Extras: R$ ${totalExtraHours.toFixed(2)}`);
    doc.text(`Total de Cartões de Jogos: R$ ${totalGameCards.toFixed(2)}`);
    doc.text(`Total de Garçons: R$ ${totalWaiters.toFixed(2)}`);
    doc.text(`Total de Copeiras: R$ ${totalHelpers.toFixed(2)}`);
    doc.text(`Total de Kit Festa: R$ ${totalPartyKit.toFixed(2)}`);
    doc.moveDown(2);
    
    // Detalhamento por Status
    doc.fontSize(16).text('Detalhamento por Status de Pagamento', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    const paid = events.filter(e => e.payment_status === 'paid').length;
    const partial = events.filter(e => e.payment_status === 'partial').length;
    const pending = events.filter(e => e.payment_status === 'pending').length;
    doc.text(`Pagos: ${paid} festa(s)`);
    doc.text(`Parciais: ${partial} festa(s)`);
    doc.text(`Pendentes: ${pending} festa(s)`);
    doc.moveDown(2);
    
    // Lista de Eventos
    doc.addPage();
    doc.fontSize(16).text('Detalhamento de Festas', { underline: true });
    doc.moveDown(1);
    
    events.forEach((event, index) => {
      if (index > 0 && index % 6 === 0) {
        doc.addPage();
      }
      
      doc.fontSize(12).fillColor('#000000');
      doc.text(`${index + 1}. ${event.client_name}`, { continued: false });
      doc.fontSize(10).fillColor('#666666');
      doc.text(`   Data: ${formatDateBR(event.date)} | Horário: ${event.start_time} - ${event.end_time}`);
      doc.text(`   Tipo: ${event.event_type} | Salão: ${event.room}`);
      
      // Mostrar Valor Total em destaque
      const totalValue = event.total_value || event.base_value;
      doc.fontSize(10).fillColor('#000000').font('Helvetica-Bold');
      doc.text(`   Valor Total: R$ ${totalValue.toFixed(2)}`);
      doc.font('Helvetica').fillColor('#666666');
      
      // Detalhamento da composição
      doc.text(`      → Valor Base: R$ ${event.base_value.toFixed(2)}`);
      
      if (event.extra_hours) {
        const extras = JSON.parse(event.extra_hours);
        if (extras.length > 0) {
          const extraTotal = extras.reduce((sum, e) => sum + e.total, 0);
          doc.text(`      → Horas Extras: R$ ${extraTotal.toFixed(2)}`);
        }
      }
      
      if (event.game_cards) {
        const cards = JSON.parse(event.game_cards);
        doc.text(`      → Cartões: ${cards.quantity}x R$ ${cards.unit_price.toFixed(2)} = R$ ${cards.total.toFixed(2)}`);
      }
      
      if (event.waiters) {
        const waiters = JSON.parse(event.waiters);
        doc.text(`      → Garçons: ${waiters.quantity}x R$ ${waiters.unit_price.toFixed(2)} = R$ ${waiters.total.toFixed(2)}`);
      }
      
      if (event.helpers) {
        const helpers = JSON.parse(event.helpers);
        doc.text(`      → Copeiras: ${helpers.quantity}x R$ ${helpers.unit_price.toFixed(2)} = R$ ${helpers.total.toFixed(2)}`);
      }
      
      if (event.party_kit) {
        const kit = JSON.parse(event.party_kit);
        doc.text(`      → Kit Festa: ${kit.quantity} kit(s) - Total: R$ ${kit.total.toFixed(2)}`);
      }
      
      // Payment status with details
      const status = event.payment_status === 'paid' ? 'Pago' : event.payment_status === 'partial' ? 'Parcial' : 'Pendente';
      doc.text(`   Status: ${status}`);
      
      // Show payment details for partial payments
      if (event.payment_status === 'partial' && event.payment_details) {
        try {
          const details = JSON.parse(event.payment_details);
          const paid = parseFloat(details.paid_amount) || 0;
          const remaining = totalValue - paid;
          doc.text(`   Valor Pago: R$ ${paid.toFixed(2)}`);
          doc.text(`   Valor Restante: R$ ${remaining.toFixed(2)}`);
        } catch (e) {
          // Skip if parsing fails
        }
      }
      
      doc.moveDown(0.8);
    });
    
    // Finalizar PDF
    doc.end();
    
  } catch (err) {
    console.error('Error generating report:', err);
    res.status(500).json({ detail: err.message });
  }
});

function getMonthName(monthNum) {
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 
                  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return months[parseInt(monthNum) - 1];
}

function formatDateBR(dateStr) {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}

// ============== CONTRACT GENERATION ==============

app.get('/api/contracts/generate/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Buscar o evento
    const event = await db.get('SELECT * FROM events WHERE id = ?', [eventId]);
    if (!event) {
      return res.status(404).json({ detail: 'Evento não encontrado' });
    }
    
    // Buscar configuração de salões para obter os nomes
    const roomsSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['rooms']);
    const roomsConfig = roomsSetting ? JSON.parse(roomsSetting.value) : [
      { id: 'amarelo', name: 'Salão Amarelo' },
      { id: 'laranja', name: 'Salão Laranja' }
    ];
    
    // Função para formatar salões (suporta string antiga e array novo)
    const formatRooms = (roomData) => {
      let roomIds = [];
      if (typeof roomData === 'string') {
        try {
          roomIds = JSON.parse(roomData);
        } catch {
          roomIds = roomData ? [roomData] : [];
        }
      } else if (Array.isArray(roomData)) {
        roomIds = roomData;
      }
      
      const roomNames = roomIds.map(id => {
        const room = roomsConfig.find(r => r.id === id);
        return room ? room.name : id;
      });
      
      return roomNames.join(' e ');
    };
    
    // Buscar o template de contrato
    const templateSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['contract_template']);
    if (!templateSetting) {
      return res.status(404).json({ detail: 'Modelo de contrato não configurado' });
    }
    
    let template = JSON.parse(templateSetting.value);
    
    // Preparar lista de extras
    let extrasText = '';
    if (event.extra_hours) {
      const extras = JSON.parse(event.extra_hours);
      if (extras.length > 0) {
        const extraTotal = extras.reduce((sum, e) => sum + (e.total || 0), 0);
        extrasText += `Horas Extras: R$ ${extraTotal.toFixed(2)}\n`;
      }
    }
    if (event.game_cards) {
      const cards = JSON.parse(event.game_cards);
      extrasText += `Cartões de Jogos: ${cards.quantity}x R$ ${cards.unit_price.toFixed(2)} = R$ ${cards.total.toFixed(2)}\n`;
    }
    if (event.waiters) {
      const waiters = JSON.parse(event.waiters);
      extrasText += `Garçons: ${waiters.quantity}x R$ ${waiters.unit_price.toFixed(2)} = R$ ${waiters.total.toFixed(2)}\n`;
    }
    if (event.helpers) {
      const helpers = JSON.parse(event.helpers);
      extrasText += `Copeiras: ${helpers.quantity}x R$ ${helpers.unit_price.toFixed(2)} = R$ ${helpers.total.toFixed(2)}\n`;
    }
    if (event.party_kit) {
      const kit = JSON.parse(event.party_kit);
      extrasText += `Kit Festa: ${kit.quantity} kit(s) - R$ ${kit.total.toFixed(2)}\n`;
    }
    if (!extrasText) {
      extrasText = 'Nenhum extra contratado';
    }
    
    // Substituir variáveis no template
    const replacements = {
      '@client_name': event.client_name || '',
      '@cpf': event.cpf || '',
      '@address': event.address || '',
      '@city_uf': event.city_uf || '',
      '@cep': event.cep || '',
      '@phone': event.phone || '',
      '@email': event.email || '',
      '@birthday_person_name': event.birthday_person_name || '',
      '@age_to_complete': event.age_to_complete ? String(event.age_to_complete) : '',
      '@event_date': formatDateBR(event.date),
      '@start_time': event.start_time || '',
      '@end_time': event.end_time || '',
      '@room': formatRooms(event.room),
      '@party_theme': event.party_theme || '',
      '@balloon_color': event.balloon_color || '',
      '@base_value': event.base_value ? event.base_value.toFixed(2) : '0.00',
      '@total_value': event.total_value ? event.total_value.toFixed(2) : (event.base_value ? event.base_value.toFixed(2) : '0.00'),
      '@payment_method': event.payment_method || '',
      '@extras': extrasText
    };
    
    // Substituir todas as variáveis
    for (const [variable, value] of Object.entries(replacements)) {
      template = template.replace(new RegExp(variable, 'g'), value);
    }
    
    // Criar PDF A4 com margens para caber em uma página
    const doc = new PDFDocument({ 
      size: 'A4',
      margins: { top: 30, bottom: 30, left: 40, right: 40 }
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=contrato-${eventId}.pdf`);
    
    doc.pipe(res);
    
    const pageWidth = 595.28; // A4 width in points
    const contentWidth = pageWidth - 80; // minus margins
    const maxY = 800; // Maximum Y before content would overflow
    
    // Parse HTML and render with proper alignment and images
    const renderHtmlToPdf = async (html) => {
      let y = 30;
      
      // Extract and process elements
      // Split by major block elements while preserving alignment info
      const blocks = [];
      
      // Process paragraphs with alignment
      const pRegex = /<p([^>]*)>([\s\S]*?)<\/p>/gi;
      let match;
      let lastIndex = 0;
      
      // First, handle images separately
      const imgRegex = /<img[^>]+src="([^"]+)"[^>]*>/gi;
      const images = [];
      let imgMatch;
      while ((imgMatch = imgRegex.exec(html)) !== null) {
        images.push({
          src: imgMatch[1],
          index: imgMatch.index
        });
      }
      
      // Process the HTML content
      while ((match = pRegex.exec(html)) !== null) {
        const attrs = match[1];
        const content = match[2];
        
        // Detect alignment from style or class
        let align = 'left';
        if (attrs.includes('text-align: center') || attrs.includes('text-align:center') || attrs.includes('ql-align-center')) {
          align = 'center';
        } else if (attrs.includes('text-align: right') || attrs.includes('text-align:right') || attrs.includes('ql-align-right')) {
          align = 'right';
        }
        
        blocks.push({ type: 'paragraph', content, align, index: match.index });
      }
      
      // Also handle divs with alignment
      const divRegex = /<div([^>]*)>([\s\S]*?)<\/div>/gi;
      while ((match = divRegex.exec(html)) !== null) {
        const attrs = match[1];
        const content = match[2];
        
        let align = 'left';
        if (attrs.includes('text-align: center') || attrs.includes('text-align:center')) {
          align = 'center';
        } else if (attrs.includes('text-align: right') || attrs.includes('text-align:right')) {
          align = 'right';
        }
        
        // Don't add if it's likely a container with other elements already processed
        if (!content.includes('<p') && !content.includes('<div')) {
          blocks.push({ type: 'div', content, align, index: match.index });
        }
      }
      
      // Sort blocks by their position in the original HTML
      blocks.sort((a, b) => a.index - b.index);
      
      // If no blocks found, process as plain text
      if (blocks.length === 0) {
        const plainText = html
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim();
        
        const lines = plainText.split('\n').filter(l => l.trim());
        for (const line of lines) {
          doc.fontSize(9).font('Helvetica').text(line.trim(), 40, y, { 
            width: contentWidth,
            align: 'left'
          });
          y += 12;
        }
        return;
      }
      
      // Render images first (at top if present)
      for (const img of images) {
        if (img.src.startsWith('data:image')) {
          try {
            // Base64 image
            const base64Data = img.src.split(',')[1];
            const imgBuffer = Buffer.from(base64Data, 'base64');
            doc.image(imgBuffer, { 
              fit: [150, 80],
              align: 'center'
            });
            y = doc.y + 10;
          } catch (e) {
            console.error('Error rendering base64 image:', e);
          }
        } else if (img.src.startsWith('http')) {
          try {
            // External URL image - skip for now as it requires async fetch
            // Could implement with axios if needed
            console.log('External image URL detected:', img.src);
          } catch (e) {
            console.error('Error with external image:', e);
          }
        }
      }
      
      // Calculate dynamic font size to fit content on one page
      const totalBlocks = blocks.length;
      let baseFontSize = 9;
      if (totalBlocks > 40) baseFontSize = 7;
      else if (totalBlocks > 30) baseFontSize = 8;
      
      // Render each block
      for (const block of blocks) {
        // Clean HTML from content
        let text = block.content
          .replace(/<strong>/gi, '')
          .replace(/<\/strong>/gi, '')
          .replace(/<em>/gi, '')
          .replace(/<\/em>/gi, '')
          .replace(/<u>/gi, '')
          .replace(/<\/u>/gi, '')
          .replace(/<s>/gi, '')
          .replace(/<\/s>/gi, '')
          .replace(/<span[^>]*>/gi, '')
          .replace(/<\/span>/gi, '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim();
        
        if (!text) continue;
        
        // Check if it's a title (all caps or header-like)
        const isTitle = text === text.toUpperCase() && text.length > 3 && text.length < 60;
        const isBold = block.content.includes('<strong>') || block.content.includes('<b>');
        
        // Set font
        if (isTitle || isBold) {
          doc.fontSize(baseFontSize + 1).font('Helvetica-Bold');
        } else {
          doc.fontSize(baseFontSize).font('Helvetica');
        }
        
        // Calculate x position based on alignment
        let x = 40;
        let textOptions = { width: contentWidth, align: block.align };
        
        doc.text(text, x, y, textOptions);
        y = doc.y + 3;
        
        // Check if we're approaching page limit - compress if needed
        if (y > maxY) {
          // Don't add new page - reduce spacing instead
          y = maxY;
        }
      }
    };
    
    // Render the template
    await renderHtmlToPdf(template);
    
    doc.end();
    
  } catch (err) {
    console.error('Error generating contract:', err);
    res.status(500).json({ detail: err.message });
  }
});

// ============== CONTRACT GENERATION - PDF BASE MODE ==============

app.get('/api/contracts/generate-pdf-base/:eventId', authenticateToken, async (req, res) => {
  try {
    const { eventId } = req.params;
    
    // Buscar o evento
    const event = await db.get('SELECT * FROM events WHERE id = ?', [eventId]);
    if (!event) {
      return res.status(404).json({ detail: 'Evento não encontrado' });
    }
    
    // Buscar configuração de salões para obter os nomes
    const roomsSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['rooms']);
    const roomsConfig = roomsSetting ? JSON.parse(roomsSetting.value) : [
      { id: 'amarelo', name: 'Salão Amarelo' },
      { id: 'laranja', name: 'Salão Laranja' }
    ];
    
    // Função para formatar salões (suporta string antiga e array novo)
    const formatRooms = (roomData) => {
      let roomIds = [];
      if (typeof roomData === 'string') {
        try {
          roomIds = JSON.parse(roomData);
        } catch {
          roomIds = roomData ? [roomData] : [];
        }
      } else if (Array.isArray(roomData)) {
        roomIds = roomData;
      }
      
      const roomNames = roomIds.map(id => {
        const room = roomsConfig.find(r => r.id === id);
        return room ? room.name : id;
      });
      
      return roomNames.join(' e ');
    };
    
    // Buscar o PDF base
    const pdfBaseSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['contract_pdf_base']);
    if (!pdfBaseSetting) {
      return res.status(404).json({ detail: 'PDF base não configurado' });
    }
    
    // Buscar os campos overlay
    const fieldsSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['contract_pdf_fields']);
    const fields = fieldsSetting ? JSON.parse(fieldsSetting.value) : [];
    
    // Preparar variáveis de substituição
    let extrasText = '';
    if (event.extra_hours) {
      const extras = JSON.parse(event.extra_hours);
      if (extras.length > 0) {
        const extraTotal = extras.reduce((sum, e) => sum + (e.total || 0), 0);
        extrasText += `Horas Extras: R$ ${extraTotal.toFixed(2)} | `;
      }
    }
    if (event.game_cards) {
      const cards = JSON.parse(event.game_cards);
      extrasText += `Cartões: ${cards.quantity}x = R$ ${cards.total.toFixed(2)} | `;
    }
    if (event.waiters) {
      const waiters = JSON.parse(event.waiters);
      extrasText += `Garçons: ${waiters.quantity}x = R$ ${waiters.total.toFixed(2)} | `;
    }
    if (event.helpers) {
      const helpers = JSON.parse(event.helpers);
      extrasText += `Copeiras: ${helpers.quantity}x = R$ ${helpers.total.toFixed(2)} | `;
    }
    if (event.party_kit) {
      const kit = JSON.parse(event.party_kit);
      extrasText += `Kit Festa: R$ ${kit.total.toFixed(2)} | `;
    }
    if (!extrasText) {
      extrasText = 'Nenhum';
    }
    
    const replacements = {
      '@client_name': event.client_name || '',
      '@cpf': event.cpf || '',
      '@address': event.address || '',
      '@city_uf': event.city_uf || '',
      '@cep': event.cep || '',
      '@phone': event.phone || '',
      '@email': event.email || '',
      '@birthday_person_name': event.birthday_person_name || '',
      '@age_to_complete': event.age_to_complete ? String(event.age_to_complete) : '',
      '@event_date': formatDateBR(event.date),
      '@start_time': event.start_time || '',
      '@end_time': event.end_time || '',
      '@room': formatRooms(event.room),
      '@party_theme': event.party_theme || '',
      '@balloon_color': event.balloon_color || '',
      '@base_value': event.base_value ? `R$ ${event.base_value.toFixed(2)}` : 'R$ 0,00',
      '@total_value': event.total_value ? `R$ ${event.total_value.toFixed(2)}` : (event.base_value ? `R$ ${event.base_value.toFixed(2)}` : 'R$ 0,00'),
      '@payment_method': event.payment_method || '',
      '@extras': extrasText.replace(/ \| $/, '')
    };
    
    // Carregar o PDF base
    const pdfBase64 = JSON.parse(pdfBaseSetting.value);
    const pdfBytes = Buffer.from(pdfBase64, 'base64');
    
    // Carregar com pdf-lib
    const pdfDoc = await PDFLibDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { height } = firstPage.getSize();
    
    // Carregar fonte
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    
    // Função para quebrar texto em múltiplas linhas
    const wrapText = (text, maxWidth, fontSize, useFont) => {
      const words = text.split(' ');
      const lines = [];
      let currentLine = '';
      
      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = useFont.widthOfTextAtSize(testLine, fontSize);
        
        if (testWidth > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
      
      return lines;
    };
    
    // Inserir campos overlay com quebra de linha
    for (const field of fields) {
      const value = replacements[field.variable] || '';
      if (!value) continue;
      
      const fontSize = field.fontSize || 10;
      const useFont = field.bold ? fontBold : font;
      const fieldWidth = field.width || 150;
      const fieldHeight = field.height || 30;
      const lineHeight = fontSize * 1.2;
      
      // Quebrar texto em múltiplas linhas
      const lines = wrapText(value, fieldWidth, fontSize, useFont);
      
      // Converter coordenadas (origin no canto superior esquerdo para PDF que usa canto inferior esquerdo)
      let currentY = height - field.y - fontSize;
      
      // Renderizar cada linha
      for (let i = 0; i < lines.length; i++) {
        // Verificar se ainda cabe na área definida
        const usedHeight = i * lineHeight;
        if (usedHeight > fieldHeight - fontSize) {
          // Se não couber, adicionar "..." na última linha que coube
          if (i > 0) {
            // Não renderizar mais linhas
            break;
          }
        }
        
        firstPage.drawText(lines[i], {
          x: field.x,
          y: currentY,
          size: fontSize,
          font: useFont,
          color: rgb(0, 0, 0),
        });
        
        currentY -= lineHeight;
      }
    }
    
    // Gerar PDF final
    const pdfBytesFinal = await pdfDoc.save();
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=contrato-${eventId}.pdf`);
    res.send(Buffer.from(pdfBytesFinal));
    
  } catch (err) {
    console.error('Error generating PDF base contract:', err);
    res.status(500).json({ detail: err.message });
  }
});

// ============== START SERVER ==============

initDatabase().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
