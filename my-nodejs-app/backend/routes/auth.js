// routes/auth.js
const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../modules/database');
const { validatePassword, hashPassword, comparePassword } = require('../modules/password-utils');
const validator = require('validator'); // For the email validation function

/**
 * GET /register - Show registration form
 */
router.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/register.html'));
});

/**
 * POST /register - Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, username, display_name, password } = req.body;
    
    // Validate input
    if ( !email || !username || !display_name || !password) {
      return res.redirect('/api/auth/register?error=' + encodeURIComponent('All fields are required'));
    }
    console.log("Validated register input");

    // Validate username!=display_name
    if ( username === display_name ) {
      return res.redirect('/api/auth/register?error=' + encodeURIComponent('Username and Display Name cannot match'));
    }
    console.log("Validated user and display different");

    // Validate email format on registration
    if ( !validator.isEmail(email) ) {
      return res.redirect('/api/auth/register?error=' + encodeURIComponent('Not a valid email'));
    }
    console.log("Validated email");

    // Validate email is unique
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingEmail) {
      return res.redirect('/api/auth/register?error=' + encodeURIComponent('Email already used. Please choose a different email.'));
    }
    console.log("Validated email is unique");

    // Validate password requirements
    const validation = validatePassword(password);
    if (!validation.valid) {
      const errorsText = validation.errors.join(', ');
      return res.redirect('/api/auth/register?error=' + encodeURIComponent('Password does not meet requirements: ' + errorsText));
    }
    console.log("Validated password requirements");

    // Check if username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.redirect('/api/auth/register?error=' + encodeURIComponent('Username already exists. Please choose a different username.'));
    }
    console.log("Validated username is unique");

    // Hash the password before storing
    const passwordHash = await hashPassword(password);
    console.log("Hash Password");

    // Insert new user into database
    const stmt = db.prepare('INSERT INTO users (username, password_hash, email, display_name) VALUES (?, ?, ?, ?)');
    const result = stmt.run(username, passwordHash, email, display_name);
    console.log("Insert new user");


    // WENT TO 404
    // Redirect to success page with username
    res.redirect(`/register-success.html?username=${encodeURIComponent(username)}&userId=${result.lastInsertRowid}`);
    console.log("Passed success redirect");

  } catch (error) {
    console.error('Registration error:', error);
    res.redirect('/error.html?message=' + encodeURIComponent('An internal server error occurred. Please try again later.') + '&back=/api/auth/register');
  }
});

/**
 * GET /login - Show login form
 */
router.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});

/**
 * POST /login - Authenticate user
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const IP = getClientIP(req);
    
    // Validate input
    if (!username || !password) {
      return res.redirect('/api/auth/login?error=' + encodeURIComponent('Username and password are required'));
    }
    console.log("Validated login input");

    // Find user by username
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    console.log("Tried to find user in table");

    if (!user) {
      // Don't reveal if username exists (security best practice)
      console.log("No user in database");
      const stmt = db.prepare('INSERT INTO loginAttempts (username, IP, success) VALUES (?, ?, ?)');
      const result = stmt.run(username, IP, 0);
      return res.redirect('/api/auth/login?error=' + encodeURIComponent('Invalid username or password'));
    }

    // SECURITY VULNERABLITY
    // This reveals an active username because currently only active usernames can be locked
    // REMEMBER TO CHECK AGAIN LATER
    // IF YOU ARE READING THIS TROY, I FORGOT

    if (user.account_lock_expiry) {
      const lockExpiry = new Date(user.account_lock_expiry);
      const now = new Date();
      if (now < lockExpiry) {
        return res.redirect('/api/auth/login?error=' + encodeURIComponent('Too many failed attempts. Account already locked.'));
      }
      else {
        db.prepare('UPDATE users SET failed_login_attempts = 0, account_lock_expiry = NULL WHERE id = ?')
          .run(user.id);
      }
    }

    // Compare entered password with stored hash
    const passwordMatch = await comparePassword(password, user.password_hash);
    
    if (!passwordMatch) {
      console.log("User password doesn't match");
      // Log failed attempt
      const stmt = db.prepare('INSERT INTO loginAttempts (username, IP, success) VALUES (?, ?, ?)');
      const result = stmt.run(username, IP, 0);

      // Update user's failed count
      db.prepare('UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?')
        .run(user.id);

      const userFails = db.prepare('SELECT failed_login_attempts FROM users WHERE id = ?').get(user.id);
      // Lockout if fails = 5
      if (userFails.failed_login_attempts >= 5){
        db.prepare("UPDATE users SET account_lock_expiry = DATETIME('now', '+15 minutes') WHERE id = ?")
          .run(user.id);
        return res.redirect('/api/auth/login?error=' + encodeURIComponent('Too many failed attempts. Account locked for 15 minutes.'));
      }
      return res.redirect('/api/auth/login?error=' + encodeURIComponent('Invalid username or password'));
    }
    
    // Successful login - update last login time
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
      .run(user.id);

    const stmt = db.prepare('INSERT INTO loginAttempts (username, IP, success) VALUES (?, ?, ?)');
    const result = stmt.run(username, IP, 1);
    // Create session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isLoggedIn = true;
    
    // Redirect to success page
    res.redirect(`/login-success.html?username=${encodeURIComponent(user.username)}`);
    
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/error.html?message=' + encodeURIComponent('An internal server error occurred. Please try again later.') + '&back=/api/auth/login');
  }
});

/**
 * GET /logout - Logout user (GET version for easy link access)
 */
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/error.html?message=' + encodeURIComponent('An error occurred while logging out.') + '&back=/');
    }
    res.redirect('/logged-out.html');
  });
});

/**
 * POST /logout - Logout user (POST version)
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/error.html?message=' + encodeURIComponent('An error occurred while logging out.') + '&back=/');
    }
    res.redirect('/logged-out.html');
  });
});

/**
 * GET /me - Get current user info (requires authentication)
 */
router.get('/me', (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.redirect('/error.html?message=' + encodeURIComponent('You must be logged in to view this page.') + '&back=/api/auth/login');
  }
  
  const user = db.prepare('SELECT id, username, display_name, user_color, created_at, last_login FROM users WHERE id = ?')
    .get(req.session.userId);
  
  if (!user) {
    return res.redirect('/error.html?message=' + encodeURIComponent('User not found in database.') + '&back=/');
  }
  
  // // Pass user data as query parameters to the profile page
  // const params = new URLSearchParams({
  //   id: user.id,
  //   username: user.username,
  //   created_at: user.created_at || 'N/A',
  //   last_login: user.last_login || 'Never'
  // });
 

  res.render('profile', {
      currentPage: 'profile',
      display_name: user.display_name,
      userColor: user.user_color,
      isLoggedIn: req.session.isLoggedIn,
      username: req.session.username
  });
  // res.redirect(`/profile.html?${params.toString()}`);
});



/*
 *
 * POST /changePassword - Authenticate password change
 */
router.post('/changePassword', async (req, res) => {
  try {
    const { curPassword, newPassword } = req.body;
    
    // Validate input
    if (!curPassword || !newPassword) {
      return res.redirect('/api/auth/profile.html?error=' + encodeURIComponent('Current and New passwords are required'));
    }
    console.log("Validated PC input");

    // Find user by username
    const user = db.prepare('SELECT id, username, password_hash, email, display_name, created_at, last_login FROM users WHERE id = ?')
      .get(req.session.userId);   
    username = user.username;
    console.log("Tried to find user in table PC");

    // Compare entered password with stored hash
    const passwordMatch = await comparePassword(curPassword, user.password_hash);
    if (!passwordMatch) {
      console.log("User password doesn't match");
      return res.redirect('/api/auth/profile.html?error=' + encodeURIComponent('Incorrect Password'));
    }
    console.log("Password is correct PC");

    // Validate password requirements
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      const errorsText = validation.errors.join(', ');
      return res.redirect('/api/auth/profile.html?error=' + encodeURIComponent('Password does not meet requirements: ' + errorsText));
    }
    console.log("Validated password requirements PC");

    // Hash the password before storing
    const passwordHash = await hashPassword(newPassword);
    console.log("Hash Password PC");

    // Insert new user into database
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(passwordHash, user.id);
    // const stmt = db.prepare('INSERT INTO users (username, password_hash, email, display_name) VALUES (?, ?, ?, ?)');
    // const result = stmt.run(username, passwordHash, email, display_name);
    console.log("Updated user password PC");

    // Redirect to success page
    res.redirect(`/login-success.html?username=${encodeURIComponent(user.username)}`);
    
  } catch (error) {
    console.error('Change error:', error);
    res.redirect('/error.html?message=' + encodeURIComponent('An internal server error occurred. Please try again later.') + '&back=/api/auth/login');
  }
});

/*
 *
 * POST /changeEmail - Authenticate email change
 */
router.post('/changeEmail', async (req, res) => {
  try {
    const { password, newEmail } = req.body;
    
    // Validate input
    if ( !password || !newEmail ) {
      return res.redirect('/api/auth/profile.html?error=' + encodeURIComponent('Current and New passwords are required'));
    }
    console.log("Validated EC input");

    // Find user by username
    const user = db.prepare('SELECT id, username, password_hash, email, display_name, created_at, last_login FROM users WHERE id = ?')
      .get(req.session.userId);   
    username = user.username;
    console.log("Tried to find user in table EC");

    // Compare entered password with stored hash
    const passwordMatch = await comparePassword(password, user.password_hash);
    if (!passwordMatch) {
      console.log("User password doesn't match EC");
      return res.redirect('/api/auth/profile.html?error=' + encodeURIComponent('Incorrect Password'));
    }
    console.log("Password is correct PC");

    // Validate email format on update
    if ( !validator.isEmail(newEmail) ) {
      return res.redirect('/api/auth/register?error=' + encodeURIComponent('Not a valid email'));
    }
    console.log("Validated email EC");

    // Validate email is unique
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(newEmail);
    if (existingEmail) {
      return res.redirect('/api/auth/register?error=' + encodeURIComponent('Email already used. Please choose a different email.'));
    }
    console.log("Validated email is unique EC");

    // Update email in user database
    db.prepare('UPDATE users SET email = ? WHERE id = ?')
      .run(newEmail, user.id);
    // const stmt = db.prepare('INSERT INTO users (username, password_hash, email, display_name) VALUES (?, ?, ?, ?)');
    // const result = stmt.run(username, passwordHash, email, display_name);
    console.log("Updated user email EC");

    // Redirect to success page
    res.redirect(`/login-success.html?username=${encodeURIComponent(user.username)}`);
    
  } catch (error) {
    console.error('Change error:', error);
    res.redirect('/error.html?message=' + encodeURIComponent('An internal server error occurred. Please try again later.') + '&back=/api/auth/login');
  }
});

/*
 *
 * POST /changeDisplayName - Authenticate email change
 */
router.post('/changeDisplayName', async (req, res) => {
  try {
    const { password, newDisplayName } = req.body;
    
    // Validate input
    if ( !password || !newDisplayName ) {
      return res.redirect('/api/auth/profile.html?error=' + encodeURIComponent('Current and New passwords are required'));
    }
    console.log("Validated EC input");

    // Find user by username
    const user = db.prepare('SELECT id, username, password_hash, email, display_name, created_at, last_login FROM users WHERE id = ?')
      .get(req.session.userId);   
    username = user.username;
    console.log("Tried to find user in table EC");

    // Compare entered password with stored hash
    const passwordMatch = await comparePassword(password, user.password_hash);
    if (!passwordMatch) {
      console.log("User password doesn't match EC");
      return res.redirect('/api/auth/profile.html?error=' + encodeURIComponent('Incorrect Password'));
    }
    console.log("Password is correct DNC");

    // Validate display name limitations
    // Currently none

    // Update display name in user database
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?')
      .run(newDisplayName, user.id);
    console.log("Updated user display name DNC");

    // Redirect to success page
    res.redirect(`/login-success.html?username=${encodeURIComponent(user.username)}`);
    
  } catch (error) {
    console.error('Change error:', error);
    res.redirect('/error.html?message=' + encodeURIComponent('An internal server error occurred. Please try again later.') + '&back=/api/auth/login');
  }
});

/*
 *
 * POST /changeDisplayName - Authenticate email change
 */
router.post('/changeNameColor', async (req, res) => {
  try {
    const { newColor } = req.body;
    
    // Validate input
    if ( !newColor ) {
      return res.redirect('/api/auth/me?error=' + encodeURIComponent('Current and New passwords are required'));
    }
    if (!validator.isHexColor(newColor)){
      return res.redirect('/api/auth/me?error=' + encodeURIComponent('Invalid Color'));
    }
    console.log("Validated NCC input");

    // Find user by username
    const user = db.prepare('SELECT id, username, password_hash, email, display_name, created_at, last_login FROM users WHERE id = ?')
      .get(req.session.userId);   
    username = user.username;
    console.log("Tried to find user in table NCC");

    // Update user_color in user database
    db.prepare('UPDATE users SET user_color = ? WHERE id = ?')
      .run(newColor, user.id);
    console.log("Updated user display name DNC");

    // Redirect to success page
    res.redirect(`/login-success.html?username=${encodeURIComponent(user.username)}`);
    
  } catch (error) {
    console.error('Change error:', error);
    res.redirect('/error.html?message=' + encodeURIComponent('An internal server error occurred. Please try again later.') + '&back=/api/auth/login');
  }
});

function getClientIP(req) {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         req.connection.remoteAddress || 
         'unknown';
}

module.exports = router;