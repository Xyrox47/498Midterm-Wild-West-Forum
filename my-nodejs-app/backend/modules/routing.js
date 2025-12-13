const path = require('path');
const express = require('express');
const db = require('./database')

module.exports = function createRouter() {
    const router = express.Router();
    // Get Routes

    router.get('/', (req, res) => {
        res.render('home', {
            title: 'Wild West Forum',
            currentPage: 'home',

            isLoggedIn: req.session.isLoggedIn,
            username: req.session.username
        });

    });

    // router.get('/register', (req, res) => {
    //     res.render('register', {
    //         title: 'Register',
    //         currentPage: 'register',

    //         isLoggedIn: req.session.isLoggedIn,
    //         username: req.session.username
    //     });
    // });

    // router.get('/login', (req, res) => {
    //     res.render('login', {
    //         title: 'Login',
    //         currentPage: 'login',

    //         isLoggedIn: req.session.isLoggedIn,
    //         username: req.session.username
    //     });});

    // router.get('/comments', (req, res) => {
    //     res.render('comments', {
    //         title: 'Comments',
    //         currentPage: 'comments',
    //         comments: comments,

    //         isLoggedIn: req.session.isLoggedIn,
    //         username: req.session.username
    //     });
    // });

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

    // 404 Errors
    router.use((req, res) => {
        res.status(404).render('404', {
            title: "404 - Not Found",
            url: req.originalUrl
        });
    });



    // POST ROUTES


    
    // router.post('/register', (req, res) => {
    //     const { username, password } = req.body;
    //     const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';


    //     // if the entered username equals an already used username, render error
    //     if (users.find(u => u.username === username)) {
    //         return res.render('register', {
    //                 title: 'Register',
    //                 currentPage: 'register',                
    //                 error: 'User already exists!',

    //                 isLoggedIn: req.session.isLoggedIn,
    //                 username: req.session.username
    //             }
    //         );
    //     }
    //     // Else, add username and password into the users arrary
    //     users.push({ username, password });

    //     // Send to log in page
    //     res.redirect('/login');
    // });

    // router.post('/register', (req, res) => {
    // try {
    //     const { username, password } = req.body;
    //     const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    //     const result = stmt.run(username, password);
    //     res.status(201).json({ 
    //     id: result.lastInsertRowid,
    //     username,
    //     password 
    //     });
    //     // res.redirect('/login');
    // } catch (error) {
    //     if (error.message.includes('UNIQUE constraint')) {
    //     res.status(400).json({ error: 'username already exists' });
    //     } else {
    //     res.status(500).json({ error: error.message });
    //     }
    // }
    // });

    // router.post('/login', (req, res) => {
    //     try {
    //         const { username, password } = req.body;
    //         const stmt = db.prepare('SELECT * FROM users WHERE username = ? AND passowrd = ?');
    //         if (user)
    //     }


    //     // If the entered data matches an existing pair, mark as logged in
    //     // and send to home page
    //     if (users.find(u => u.username === username && u.password === password)) {
    //         req.session.isLoggedIn = true;
    //         req.session.username = username;
    //         return res.redirect('/');
    //     }
    //     // Else render page with error
    //     return res.render('login', {
    //             title: 'Login',
    //             currentPage: 'login',
    //             error: 'Wrong username or password!',

    //             isLoggedIn: req.session.isLoggedIn,
    //             username: req.session.username
    //         }
    //     );
    // });

    // Destroys session cookie and data
    // router.post('/logout', (req, res) => {
    //     req.session.destroy((err) => {
    //         if (err) {
    //             console.log('Error destroying session:', err);
    //         }
    //         res.clearCookie('session');
    //         res.redirect('/');
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
    
    return router;
};