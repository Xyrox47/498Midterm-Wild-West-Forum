const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../modules/database');


function paginate(page, limit) {
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
        ORDER BY comments.created_at DESC
        LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = db.prepare('SELECT COUNT(*) as total FROM comments').get().total;
    const totalPages = Math.ceil(total / limit);

    return {comments, totalPages};
}

// /comments/
router.get('/', (req, res) => {
    
    const page = parseInt(req.query.page) || 1;
    const limit = 20;

    const results = paginate(page, limit);

    res.render('comments', {
        title: 'Comments',
        comments: results.comments,
        currentPage: page,
        prevPage: page - 1,
        nextPage: page + 1,
        hasNextPage: page < results.totalPages,
        hasPrevPage: page > 1,
        totalPages: results.totalPages,


        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username,
        display_name: req.session.displayName,
        name_color: req.session.name_color,
        currentUserID: req.session.userId
    });
});

router.get('/new', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.redirect('/login'); 
    }
    res.render('new', {
        title: 'New Comment',
        currentPage: 'new',

        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username
    });
});

router.post('/addComment', (req, res) => {
    try {
        const content = req.body.text;
        const userID = req.session.userId;

        // if !logged in, redirect to login page
        if (!req.session.isLoggedIn) {
            return res.redirect('/api/auth/login'); 
        }
        // else, add the new comment to the array
        db.prepare('INSERT INTO comments (user_id, content) VALUES (?, ?)')
            .run(userID, content);

        // Change page back to forum
        res.redirect('/comments'); 
    } catch (error) {
        console.error('Login error:', error);
        res.redirect('/error.html?message=' + encodeURIComponent('An internal server error occurred. Please try again later.') + '&back=/api/auth/login');
    }
});

module.exports = router;
