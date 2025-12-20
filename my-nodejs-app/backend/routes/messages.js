// routes/messages.js
const express = require('express');
const router = express.Router();
const db = require('../modules/database');

/**
 * POST /api/chat/message - Send a chat message
 * Requires authentication
 */
router.post('/message', requireAuth, (req, res) => {
  const { message } = req.body;

  // Validate message
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message cannot be empty' });
  }

  // Make sure message isn't too long
  if (message.length > 1000) {
    return res.status(400).json({ error: 'Message too long (max 1000 characters)' });
  }

  try {
    const stmt = db.prepare('INSERT INTO messages (user_id, content) VALUES (?, ?)');
    const result = stmt.run(req.session.userId, message.trim());

    const newMessage = db.prepare(`
      SELECT 
        messages.id,
        messages.content,
        messages.created_at,
        users.display_name,
        users.user_color
      FROM messages
      JOIN users ON messages.user_id = users.id
      WHERE messages.id = ?
    `).get(result.lastInsertRowid);

    res.json({ success: true, message: newMessage });

  } catch (error) {
    console.error('Error sending message:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

/**
 * GET /api/chat/history - Get message history
 */
router.get('/history', requireAuth, (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  const limit = parseInt(req.query.limit) || 50;

  try {
    const messages = db.prepare(`
      SELECT 
        messages.id,
        messages.content,
        messages.created_at,
        users.display_name,
        users.user_color
      FROM messages
      JOIN users ON messages.user_id = users.id
      ORDER BY messages.created_at DESC
      LIMIT ?
    `).all(limit);

    messages.reverse();

    res.json({ success: true, messages: messages });

  } catch (error) {
    console.error('Error fetching message history:', error);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

module.exports = router;