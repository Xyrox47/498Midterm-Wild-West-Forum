const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../modules/database');


router.get('/', (req, res) => {
    const comments = db.prepare('SELECT * FROM comments ORDER BY created_at DESC').all();

    res.render('comments', {
        title: 'Comments',
        currentPage: 'comments',
        comments: comments,

        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username
    });
});

// router.get('/comment/new', (req, res) => {
//     if (!req.session.isLoggedIn) {
//         return res.redirect('/login'); 
//     }
//     res.render('new', {
//         title: 'New Comment',
//         currentPage: 'new',

//         isLoggedIn: req.session.isLoggedIn,
//         username: req.session.username
//     });
// });

// router.post('/comment', (req, res) => {
//     date = new Date()

//     // if !logged in, redirect to login page
//     if (!req.session.isLoggedIn) {
//         return res.redirect('/api/auth/login'); 
//     }
//     // else, add the new comment to the array
//     comments.push( { 
//         author: req.session.username, 
//         text: req.body.text, 
//         createdAt: date.toUTCString()
//     }); 

//     // Change page back to forum
//     res.redirect('/comments'); 
// });

module.exports = router;
