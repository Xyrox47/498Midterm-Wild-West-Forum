// profile.js

const express = require('express');
const router = express.Router();
const db = require('../modules/database');
const { requireAuth } = require('../modules/auth-middleware');

/**
 * GET /me - Get current user info (requires authentication)
 */
router.get('/me', requireAuth, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, display_name, email, user_color, created_at
      FROM users
      WHERE id = ?
    `).get(req.session.userId);

    // Get user's comments
    const comments = db.prepare(`
      SELECT 
        comments.id,
        comments.content,
        comments.created_at
      FROM comments
      WHERE comments.user_id = ?
      ORDER BY comments.created_at DESC
    `).all(req.session.userId);

    res.render('profile', {
      title: 'My Profile',
      user: user,
      comments: comments,
      isOwnProfile: true,
      isLoggedIn: req.session.isLoggedIn,
      username: req.session.username,
      display_name: req.session.displayName
    });
  } catch (error) {
    console.error('Error loading profile:', error);
    res.status(500).send('Error loading profile');
  }
});

router.get('/editProfile', requireAuth, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, username, display_name, email, user_color, created_at
      FROM users
      WHERE id = ?
    `).get(req.session.userId);

    res.render('editProfile', {
      title: 'My Profile',
      user: user,
      isOwnProfile: true,
      isLoggedIn: req.session.isLoggedIn,
      username: req.session.username,
      display_name: req.session.displayName
    });
  } catch (error) {
    console.error('Error loading profile:', error);
    res.status(500).send('Error loading profile');
  }
});

/**
 * GET /profile/:userId - View another user's profile.
 */
router.get('/:userId', (req, res) => {
  try {
    const userId = parseInt(req.params.userId);

    const user = db.prepare(`
      SELECT id, username, display_name, user_color, created_at
      FROM users
      WHERE id = ?
    `).get(userId);

    if (!user) {
      return res.status(404).render('404', {
        title: "404 - User Not Found",
        url: req.originalUrl
    });
    }

    // Get user's comments
    const comments = db.prepare(`
      SELECT 
        comments.id,
        comments.content,
        comments.created_at
        FROM comments
      WHERE comments.user_id = ?
      ORDER BY comments.created_at DESC
    `).all(userId);

    const isOwnProfile = req.session.userId === userId;

    res.render('profile', {
      title: `${user.display_name}'s Profile`,
      user: user,
      comments: comments,
      isOwnProfile: isOwnProfile,
      isLoggedIn: req.session.isLoggedIn,
      username: req.session.username,
      display_name: req.session.displayName
  });
  } catch (error) {
    console.error('Error loading profile:', error);
    res.status(500).send('Error loading profile');
  }
});

module.exports = router;