// routes/auth.js
const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../modules/database');
const { validatePassword, hashPassword, comparePassword } = require('../modules/password-utils');
const validator = require('validator'); // For the email validation function
const emailSender = require('../config/email');


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
      db.prepare('INSERT INTO loginAttempts (username, IP, success) VALUES (?, ?, ?)')
        .run(username, IP, 0);
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
    req.session.displayName = user.display_name;
    req.session.name_color = user.user_color
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
    console.log("Updated user display name NCC");

    // Redirect to success page
    res.redirect(`/login-success.html?username=${encodeURIComponent(user.username)}`);
    
  } catch (error) {
    console.error('Change error:', error);
    res.redirect('/error.html?message=' + encodeURIComponent('An internal server error occurred. Please try again later.') + '&back=/api/auth/login');
  }
});

/**
 * GET /forgot-password - Show forgot password form
 */
router.get('/forgot-password', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/forgot-password.html'));
});

/**
 * POST /forgot-password - Generate and send token
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate input
    if ( !email ) {
      return res.redirect('/api/auth/register?forgot-password=' + encodeURIComponent('All fields are required'));
    }
    console.log("Validated FP input");

    // Validate email format on registration
    if ( !validator.isEmail(email) ) {
      return res.redirect('/api/auth/register?error=' + encodeURIComponent('Not a valid email'));
    }
    console.log("Validated PF email");

    // Validate email is unique
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user.email) {
      return res.redirect('/api/auth/register?error=' + encodeURIComponent('Email Sent (Not really)'));
    }
    console.log("Validated email is in database FP");

    // Generate Token
    const token = createToken(6);
    db.prepare("UPDATE users SET reset_token = ?, reset_token_expiry = DATETIME('now', '+15 minutes') WHERE id = ?")
      .run(token, user.id);
    console.log("Validated token and expiry is in database FP");


    // Send email 
    // const subject = "Rubicunda.org Password Reset";
    // const contents = `Here is your temporary password reset token: '${token}'`;
    try {
        await emailSender.sendPasswordReset(email, user.username, token);
    } catch (error) {
        console.error('Password reset email failed to send', error);
    }

    // Redirect to password reset page / token login
    res.sendFile(path.join(__dirname, '../public/reset-password.html'));

  } catch (error) {
    console.error('Registration error:', error);
    res.redirect('/error.html?message=' + encodeURIComponent('An internal server error occurred. Please try again later.') + '&back=/api/auth/register');
  }
});

/**
 * GET /reset-password - Show reset password form
 */
router.get('/reset-password', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/reset-password.html'));
});

/**
 * POST /reset-password - Login with token and add new password
 */
router.post('/reset-password', async (req, res) => {
  try {
    const { username, token, newPassword } = req.body;
    const IP = getClientIP(req);
    
    // Validate input
    if (!username || !token || !newPassword) {
      return res.redirect('/api/auth/login?error=' + encodeURIComponent('All fields are required'));
    }
    console.log("Validated login input PR");

    // Find user by username
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    console.log("Tried to find user in table PR");

    if (!user) {
      // Don't reveal if username exists (security best practice)
      console.log("No user in database PR");
      db.prepare('INSERT INTO loginAttempts (username, IP, success) VALUES (?, ?, ?)')
        .run(username, IP, 0);
      return res.redirect('/api/auth/login?error=' + encodeURIComponent('Invalid username or token'));
    }

    if (user.reset_token_expiry) {
      const lockExpiry = new Date(user.reset_token_expiry);
      const now = new Date();
      // Is it before the expiration date?
      if (now > lockExpiry) {
        return res.redirect('/api/auth/login?error=' + encodeURIComponent('Token Expired. Please request a new Token.'));
      }
    }

    // Compare entered password with stored hash
    const tokenMatch = token===user.reset_token

    // const passwordMatch = await comparePassword(password, user.password_hash);
    
    if (!tokenMatch) {
      console.log("User token doesn't match PR");
      // Log failed attempt
      db.prepare('INSERT INTO loginAttempts (username, IP, success) VALUES (?, ?, ?)')
        .run(username, IP, 0);
    }

    // Validate password requirements
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      const errorsText = validation.errors.join(', ');
      return res.redirect('/api/auth/register?error=' + encodeURIComponent('Password does not meet requirements: ' + errorsText));
    }
    
    // Hash the password before storing
    const passwordHash = await hashPassword(newPassword);
    console.log("Hash Password PR");

    // Insert new user into database
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(passwordHash, user.id);
    console.log("Updated password PR");

    // Successful login then update last login time
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
      .run(user.id);

    // Remove token
    db.prepare('UPDATE users SET reset_token = NULL, reset_token_expiry = NULL WHERE id = ?')
      .run(user.id);

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

function createToken(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}


function getClientIP(req) {
  return req.ip || 
         req.headers['x-forwarded-for']?.split(',')[0] || 
         req.connection.remoteAddress || 
         'unknown';
}

module.exports = router;