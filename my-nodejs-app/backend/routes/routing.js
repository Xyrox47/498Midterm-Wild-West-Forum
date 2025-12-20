const path = require('path');
const express = require('express');
const db = require('../modules/database')
const { requireAuth } = require('../modules/auth-middleware');

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

    router.get('/livechat', requireAuth, (req, res) => {
        res.render('livechat', {
            title: 'Live Chat',
            currentPage: 'livechat',
            isLoggedIn: req.session.isLoggedIn,
            username: req.session.username,
            displayName: req.session.displayName
        });
    });

    // 404 Errors
    router.use((req, res) => {
        res.status(404).render('404', {
            title: "404 - Not Found",
            url: req.originalUrl,
            isLoggedIn: req.session.isLoggedIn,
            username: req.session.username,
            displayName: req.session.displayName
        });
    });

    return router;
};