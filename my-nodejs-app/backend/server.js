const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;  
const hbs = require('hbs');
const path = require('path');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const createRouter = require('./modules/routing');
const SQLiteStore = require('./modules/sqlite-session-store');
const authRoutes = require('./routes/auth');
const { requireAuth } = require('./modules/auth-middleware');

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
const sessionStore = new SQLiteStore({
  db: path.join(__dirname, 'sessions.db'),
  table: 'sessions'
});

app.use(session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Get Routes
app.use('/api/auth', authRoutes);

app.get('/api/protected', requireAuth, (req, res) => {
  res.send(`Protected route that needs authentication. User: ${req.session.username} ID: ${req.session.userId}`);
});

app.use('/', createRouter());

// Start server
// Note: We use '0.0.0.0' instead of 'localhost' because Docker containers
// need to bind to all network interfaces to accept connections from outside the container
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}, have a nice day!`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  sessionStore.close();
  process.exit(0);
});