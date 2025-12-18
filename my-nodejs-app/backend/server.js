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
const commentRoutes = require('./routes/comments');
const { Server } = require('socket.io');
const http = require('http');
const messageRoutes = require('./routes/messages');
const profileRoutes = require('./routes/profile');

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

const sessionMiddleware = session({
  store: sessionStore,
  secret: process.env.SESSION_SECRET || 'change-this-secret-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false,
    maxAge: 24 * 60 * 60 * 1000
  }
});

app.use(sessionMiddleware);


// Socket.IO
const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.engine.use(sessionMiddleware);

io.on('connection', (socket) => {
    const session = socket.request.session;
    const userId = session.userId;
    const username = session.username;
    const isLoggedIn = session.isLoggedIn;
    
    console.log('Client connected:', socket.id);
    console.log('User:', username, 'ID:', userId);
    
    // Authentication check
    if (!isLoggedIn) {
        socket.emit('error', { message: 'Authentication required' });
        socket.disconnect();
        return;
    }
    
    // Listen for new chat messages
    socket.on('chat:message', async (data) => {
        try {
            const { message } = data;
            
            // Validate message
            if (!message || message.trim().length === 0) {
                socket.emit('chat:error', { error: 'Message cannot be empty' });
                return;
            }
            
            if (message.length > 1000) {
                socket.emit('chat:error', { error: 'Message too long' });
                return;
            }
            
            // Save to database
            const db = require('./modules/database');
            const stmt = db.prepare('INSERT INTO messages (user_id, content) VALUES (?, ?)');
            const result = stmt.run(userId, message.trim());
            
            // Get the message with user info
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
            
            // Broadcast to all connected clients
            io.emit('chat:newMessage', newMessage);
            
        } catch (error) {
            console.error('Error handling chat message:', error);
            socket.emit('chat:error', { error: 'Failed to send message' });
        }
    });
    
    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});

// Get Routes
app.use('/api/auth', authRoutes);

app.get('/api/protected', requireAuth, (req, res) => {
  res.send(`Protected route that needs authentication. User: ${req.session.username} ID: ${req.session.userId}`);
});

app.use('/comments', commentRoutes);

app.use('/api/chat', messageRoutes);

app.use('/profile', profileRoutes);

app.use('/', createRouter());

// hbs helper functions

hbs.registerHelper('eq', function(a, b) {
    return a === b;
});

// Start server
// Note: We use '0.0.0.0' instead of 'localhost' because Docker containers
// need to bind to all network interfaces to accept connections from outside the container
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}, have a nice day!`);
});

process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  sessionStore.close();
  process.exit(0);
});