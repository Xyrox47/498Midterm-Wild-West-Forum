const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;  //you don't need to use your special IP anymore!
const hbs = require('hbs');
const path = require('path');

// import { fileURLToPath } from "url";
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

// Handlebars
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
hbs.registerPartials(path.join(__dirname, "views/partials"));


// Serve static files from the public directory
// app.use(express.static('public'));

// API Routes
// Note: We don't include '/api' in our routes because nginx strips it when forwarding
// nginx receives: http://localhost/api/users
// nginx forwards to: http://backend-nodejs:3000/users (without /api)
app.get('/', (req, res) => {
    res.json({ 
        message: 'Hello from the API!',
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy',
        service: 'nodejs-backend'
    });
});

// In your route
app.get('/home', (req, res) => {
    res.render('home', {
        title: 'Wild West Forum',
        currentPage: 'home',
    });
});




// Start server
// Note: We use '0.0.0.0' instead of 'localhost' because Docker containers
// need to bind to all network interfaces to accept connections from outside the container
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}, have a nice day!`);
});

