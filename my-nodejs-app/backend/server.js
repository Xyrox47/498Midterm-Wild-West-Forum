const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;  
const hbs = require('hbs');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');

// import { fileURLToPath } from "url";
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

// Handlebars
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
hbs.registerPartials(path.join(__dirname, "views/partials"));

// Session middleware configuration
app.use(session({
    secret: 'your-secret-key-change-this-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'session',
    cookie: {
        secure: false, // Set to true if using HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

let users = [];
let comments = [];

// Serve static files from the public directory
// app.use(express.static('public'));

// API Routes
// Note: We don't include '/api' in our routes because nginx strips it when forwarding
// nginx receives: http://localhost/api/users
// nginx forwards to: http://backend-nodejs:3000/users (without /api)
app.get('/', (req, res) => {
    res.render('home', {
        title: 'Wild West Forum',
        currentPage: 'home',

        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username
    });
    // res.json({ 
    //     message: 'Hello from the API!',
    //     timestamp: new Date().toISOString()
    // });
});

// Get Routes

app.get('/register', (req, res) => {
    res.render('register', {
        title: 'Register',
        currentPage: 'register',

        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username
    });
});

app.get('/login', (req, res) => {
    res.render('login', {
        title: 'Login',
        currentPage: 'login',

        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username
    });});

app.get('/comments', (req, res) => {
    res.render('comments', {
        title: 'Comments',
        currentPage: 'comments',
        comments: comments,

        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username
    });});

app.get('/comment/new', (req, res) => {
    if (!req.session.isLoggedIn) {
        return res.redirect('/login'); 
    }
    res.render('new', {
        title: 'New Comment',
        currentPage: 'new',

        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username
    });});

// Post Routes

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    
    // if the entered username equals an already used username, render error
    if (users.find(u => u.username === username)) {
        return res.render('register', {
                title: 'Register',
                currentPage: 'register',                
                error: 'User already exists!',

                isLoggedIn: req.session.isLoggedIn,
                username: req.session.username
            }
        );
    }
    // Else, add username and password into the users arrary
    users.push({ username, password });

    // Send to log in page
    res.redirect('/login');

});

app.post('/login', (req, res) => {
    const { username, password } = req.body;

    if (users.find(u => u.username === username && u.password === password)) {
        req.session.isLoggedIn = true;
        req.session.username = username;
        return res.redirect('/');
    }
    return res.render('login', {
            title: 'Login',
            currentPage: 'login',
            error: 'Wrong username or password!',

            isLoggedIn: req.session.isLoggedIn,
            username: req.session.username
        }
    );
});

app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log('Error destroying session:', err);
        }
        res.clearCookie('session');
        res.redirect('/');
    });
});

app.post('/comment', (req, res) => {
    date = new Date()
    if (!req.session.isLoggedIn) {
        return res.redirect('/login'); 
    }
    comments.push( { 
        author: req.session.username, 
        text: req.body.text, 
        createdAt: date.toUTCString()
    }); 
    res.redirect('/comments'); 
});


// app.get('/health', (req, res) => {
//     res.json({ 
//         status: 'healthy',
//         service: 'nodejs-backend'
//     });
// });

// Start server
// Note: We use '0.0.0.0' instead of 'localhost' because Docker containers
// need to bind to all network interfaces to accept connections from outside the container
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}, have a nice day!`);
});

