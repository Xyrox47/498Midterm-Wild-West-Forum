// profile.js

const express = require('express');
const router = express.Router();
const db = require('../modules/database');
const { requireAuth } = require('../modules/auth-middleware');

function paginate(userId, page, limit) {
    if (page < 1) {
        page = 1;
    }
    const offset = (page - 1) * limit;
    
    const comments = db.prepare(`
        SELECT 
            comments.id,
            comments.content,
            comments.created_at,
            comments.user_id,
            users.display_name,
            users.user_color
        FROM comments
        JOIN users ON comments.user_id = users.id
        WHERE comments.user_id = ?
        ORDER BY comments.created_at DESC
        LIMIT ? OFFSET ?
    `).all(userId, limit, offset);
    const totalComments = db.prepare('SELECT COUNT(*) as total FROM comments WHERE comments.user_id = ?').get(userId).total;
    const totalPages = Math.ceil(totalComments / limit);

    // if(totalPages > 1 || totalPages === null){
    //   totalPages = 1;
    // }

    return {comments, totalPages, totalComments};
}

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
    
    const page = parseInt(req.query.page) || 1;
    const limit = 20;

    const results = paginate(user.id, page, limit);

    console.log(results.totalPages)
    console.log(page)
    console.log(limit)

    res.render('profile', {
      title: 'My Profile',
      user: user,
      isOwnProfile: true,

      comments: results.comments,
      currentPage: page,
      prevPage: page - 1,
      nextPage: page + 1,
      hasNextPage: page < results.totalPages,
      hasPrevPage: page > 1,
      totalPages: results.totalPages,
      totalComments: results.totalComments,


      isLoggedIn: req.session.isLoggedIn,
      username: req.session.username,
      display_name: req.session.displayName,
      name_color: req.session.name_color,
      currentUserID: req.session.userId
    });
  } catch (error) {
    console.error('Error loading profile:', error);
    res.status(500).send('Error loading profile');
  }
});

/**
 * GET /profile/editProfile - Display all the info/forms you you can change
 */
router.get('/editProfile', requireAuth, (req, res) => {
  console.log("In editProfile Route")
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
      display_name: req.session.displayName,
      error: req.query.error,
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

    const page = parseInt(req.query.page) || 1;
    const limit = 20;

    const results = paginate(user.id, page, limit);

    const isOwnProfile = req.session.userId === userId;

    console.log(results.totalPages)


    res.render('profile', {
      title: `${user.display_name}'s Profile`,
      user: user,
      userId: user.id,
      isOwnProfile: isOwnProfile,

      comments: results.comments,
      currentPage: page,
      prevPage: page - 1,
      nextPage: page + 1,
      hasNextPage: page < results.totalPages,
      hasPrevPage: page > 1,
      totalPages: results.totalPages,
      totalComments: results.totalComments,

      isLoggedIn: req.session.isLoggedIn,
      username: req.session.username,
      display_name: req.session.displayName,
      name_color: req.session.name_color,
      currentUserID: req.session.userId
  });
  } catch (error) {
    console.error('Error loading profile:', error);
    res.status(500).send('Error loading profile');
  }
});

module.exports = router;