// routes/auth.js
const express = require('express');
const router = express.Router();
const path = require('path');
const db = require('../modules/database');
const { validatePassword, hashPassword, comparePassword } = require('../modules/password-utils');
const validator = require('validator'); // This is only for validating emails, unless I forgot about the other uses
const emailSender = require('../config/email');


/**
 * GET /register - Show registration form
 */
router.get('/register', (req, res) => {
    res.render('register', {
        title: 'Register New User',
    });
});

/**
 * POST /register - Register a new user
 */
router.post('/register', async (req, res) => {
  try {
    const { email, username, display_name, password } = req.body;
    
    // Validate input
    if ( !email || !username || !display_name || !password) {
      return res.render('register', {
          title: 'Register New User',
          error: "All fields are required"
      });    
    }

    // Validate username!=display_name
    if ( username === display_name ) {
      return res.render('register', {
          title: 'Register New User',
          error: "Username and Display Name cannot match"
      });        
    }

    // Validate email format on registration
    if ( !validator.isEmail(email) ) {
      return res.render('register', {
          title: 'Register New User',
          error: "Not a valid email"
      });        
    }

    // Validate email is unique
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingEmail) {
      return res.render('register', {
          title: 'Register New User',
          error: "Email already in use. Please choose a different email."
      });        
    }

    // Validate password requirements
    const validation = validatePassword(password);
    if (!validation.valid) {
      return res.render('register', {
          title: 'Register New User',
          error: `Password does not meet requirements`
      });        
    }

    // Check if username already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existingUser) {
      return res.render('register', {
          title: 'Register New User',
          error: `Username must be unique.`
      });        
    }

    // Hash the password before storing
    const passwordHash = await hashPassword(password);

    // Insert new user into database
    db.prepare('INSERT INTO users (username, password_hash, email, display_name) VALUES (?, ?, ?, ?)').
      run(username, passwordHash, email, display_name);

    // Redirect to success page with username
    res.redirect(`/register-success.html`);

  } catch (error) {
    console.error('Registration error:', error);
    res.redirect('/error.html?message=' + '&back=/api/auth/register');
  }
});

/**
 * GET /login - Show login form
 */
router.get('/login', (req, res) => {
    res.render('login', {
        title: 'Login',
    });
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
      return res.render('login', {
          title: 'Login',
          error: `Username and password are required.`
      });        
    }

    // Find user by username
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      // Doesn't reveal username if it username exists 
      db.prepare('INSERT INTO loginAttempts (username, IP, success) VALUES (?, ?, ?)')
        .run(username, IP, 0);
      return res.render('login', {
          title: 'Login',
          error: `Invalid username or password.`
      });          
    }

    // If still locked, send error, if not update database and move on to login
    if (user.account_lock_expiry) {
      const lockExpiry = new Date(user.account_lock_expiry);
      const now = new Date();
      if (now < lockExpiry) {
        return res.render('login', {
          title: 'Login',
          error: `Invalid username or password.`
        });         
      }
      else {
        db.prepare('UPDATE users SET failed_login_attempts = 0, account_lock_expiry = NULL WHERE id = ?')
          .run(user.id);
      }
    }

    // Compare entered password with stored hash
    const passwordMatch = await comparePassword(password, user.password_hash);
    
    if (!passwordMatch) {
      // Log failed attempt
      db.prepare('INSERT INTO loginAttempts (username, IP, success) VALUES (?, ?, ?)')
        .run(username, IP, 0);

      // Update user's failed count
      db.prepare('UPDATE users SET failed_login_attempts = failed_login_attempts + 1 WHERE id = ?')
        .run(user.id);

      const userFails = db.prepare('SELECT failed_login_attempts FROM users WHERE id = ?').get(user.id);
      // Lockout if fails = 5
      if (userFails.failed_login_attempts >= 5){
        db.prepare("UPDATE users SET account_lock_expiry = DATETIME('now', '+15 minutes') WHERE id = ?")
          .run(user.id);
        return res.render('login', {
          title: 'Login',
          error: `Too many failed attempts. Account locked for 15 minutes.`
        });             
      }
      // If fails < 5, send error
      return res.render('login', {
        title: 'Login',
        error: `Invalid username or password.`
      }); 
    }
    
    // Successful login - update last login time
    db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?')
      .run(user.id);

    db.prepare('INSERT INTO loginAttempts (username, IP, success) VALUES (?, ?, ?)')
      .run(username, IP, 1);
      
    // Create session
    req.session.userId = user.id;
    req.session.username = user.username;
    req.session.isLoggedIn = true;
    req.session.displayName = user.display_name;
    req.session.name_color = user.user_color
    // Redirect to success page
    res.redirect(`/login-success.html`);
    
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/error.html?message=' + '&back=/api/auth/register');
  }
});

/**
 * GET /logout - Logout user (GET version for easy link access)
 */
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
        return res.render('error.html', {
          message: `An error occurred while logging out.`
        }); 
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
 * POST /changePassword - Authenticate password change
 */
router.post('/changePassword', async (req, res) => {
  try {
    const { curPassword, newPassword } = req.body;

    // Find user by username
    const user = db.prepare(`
      SELECT id, username, display_name, email, password_hash, created_at, user_color
      FROM users
      WHERE id = ?
    `).get(req.session.userId);
    username = user.username;


    // Validate input
    if (!curPassword || !newPassword) {
      return res.render('editProfile', {
        title: 'My Profile',
        errorPC: "Current and New passwords are required",
        user: user,
        isOwnProfile: true,
        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username,
        display_name: req.session.displayName
      });      
    }
    console.log("Validated PC input");

    // Compare entered password with stored hash
    const passwordMatch = await comparePassword(curPassword, user.password_hash);
    if (!passwordMatch) {
      return res.render('editProfile', {
        title: 'My Profile',
        errorPC: "Incorrect Password",
        user: user,
        isOwnProfile: true,
        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username,
        display_name: req.session.displayName
      });          
    }

    // Validate password requirements
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      const errorsText = validation.errors.join(', ');
      return res.render('editProfile', {
        title: 'My Profile',
        errorPC: "Password does not meet requirements",
        user: user,
        isOwnProfile: true,
        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username,
        display_name: req.session.displayName
      });          
    }

    // Hash the password before storing
    const passwordHash = await hashPassword(newPassword);

    // Insert new user into database
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(passwordHash, user.id);

    // Redirect to success page
    res.redirect('/changeSuccess.html?message=' + 'back=/profile/editProfile');
    
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/error.html?message=' + '&back=/api/auth/register');
  }
});

/*
 *
 * POST /changeEmail - Authenticate email change
 */
router.post('/changeEmail', async (req, res) => {
  try {
    const { password, newEmail } = req.body;

    // Find user by username
    const user = db.prepare('SELECT id, username, password_hash, email, display_name, created_at, last_login, user_color FROM users WHERE id = ?')
      .get(req.session.userId);   
    username = user.username;

    // Validate input
    if ( !password || !newEmail ) {
      return res.render('editProfile', {
        title: 'My Profile',
        errorEC: "All fields are required",
        user: user,
        isOwnProfile: true,
        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username,
        display_name: req.session.displayName
      });         
    }

    // Compare entered password with stored hash
    const passwordMatch = await comparePassword(password, user.password_hash);
    if (!passwordMatch) {
      return res.render('editProfile', {
        title: 'My Profile',
        errorEC: "Incorrect Password",
        user: user,
        isOwnProfile: true,
        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username,
        display_name: req.session.displayName
      });  
    }

    // Validate email format on update
    if ( !validator.isEmail(newEmail) ) {
      return res.render('editProfile', {
        title: 'My Profile',
        errorEC: "Not a valid email",
        user: user,
        isOwnProfile: true,
        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username,
        display_name: req.session.displayName
      });        
    }

    // Validate email is unique
    const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(newEmail);
    if (existingEmail) {
      return res.render('editProfile', {
        title: 'My Profile',
        errorEC: "Email already in use. Please choose a different email.",
        user: user,
        isOwnProfile: true,
        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username,
        display_name: req.session.displayName
      });         
    }

    // Update email in user database
    db.prepare('UPDATE users SET email = ? WHERE id = ?')
      .run(newEmail, user.id);

    // Redirect to success page
    res.redirect('/changeSuccess.html?back=/profile/editProfile');
    
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/error.html?message=' + '&back=/api/auth/register');
  }
});

/*
 *
 * POST /changeDisplayName - Authenticate email change
 */
router.post('/changeDisplayName', async (req, res) => {
  try {
    const { password, newDisplayName } = req.body;
    
    // Find user by username
    const user = db.prepare('SELECT id, username, password_hash, email, display_name, created_at, last_login, user_color FROM users WHERE id = ?')
      .get(req.session.userId);   
    username = user.username;

    // Validate input
    if ( !password || !newDisplayName ) {
      return res.render('editProfile', {
        title: 'My Profile',
        errorDNC: "Current and New passwords are required.",
        user: user,
        isOwnProfile: true,
        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username,
        display_name: req.session.displayName
      }); 
    }

    // Compare entered password with stored hash
    const passwordMatch = await comparePassword(password, user.password_hash);
    if (!passwordMatch) {
      return res.render('editProfile', {
        title: 'My Profile',
        errorDNC: "Incorrect Password",
        user: user,
        isOwnProfile: true,
        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username,
        display_name: req.session.displayName
      });       
    }

    // Validate display name limitations
    // Currently none

    // Update display name in user database
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?')
      .run(newDisplayName, user.id);

    // Redirect to success page
    res.redirect('/changeSuccess.html?back=/profile/editProfile');
    
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/error.html?message=' + '&back=/api/auth/register');
  }
});

/*
 *
 * POST /changeDisplayName - Authenticate email change
 */
router.post('/changeNameColor', async (req, res) => {
  try {
    const { newColor } = req.body;
    
    // Find user by username
    const user = db.prepare('SELECT id, username, password_hash, email, display_name, created_at, last_login, user_color FROM users WHERE id = ?')
      .get(req.session.userId);   
    username = user.username;

    // Validate input
    if ( !newColor ) {
      return res.render('editProfile', {
        title: 'My Profile',
        errorNCC: "Current and New passwords are required.",
        user: user,
        isOwnProfile: true,
        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username,
        display_name: req.session.displayName
      });       
    }
    if (!validator.isHexColor(newColor)){
      return res.render('editProfile', {
        title: 'My Profile',
        errorNCC: "Invalid Color.",
        user: user,
        isOwnProfile: true,
        isLoggedIn: req.session.isLoggedIn,
        username: req.session.username,
        display_name: req.session.displayName
      });        
    }

    // Update user_color in user database
    db.prepare('UPDATE users SET user_color = ? WHERE id = ?')
      .run(newColor, user.id);

    // Redirect to success page
    res.redirect('/changeSuccess.html?back=/profile/editProfile');
    
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/error.html?message=' + '&back=/api/auth/register');
  }
});

/**
 * GET /forgot-password - Show forgot password form
 */
router.get('/forgot-password', (req, res) => {
  res.render('forgot-password', {
    title: "Password Recovery"
  });     
});

/**
 * POST /forgot-password - Generate and send token
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    
    // Validate input
    if ( !email ) {
      return res.render('forgot-password', {
        error: "All fields are required.",
      });       
    }
    console.log("Validated FP input");

    // Validate email format on registration
    if ( !validator.isEmail(email) ) {
      return res.render('forgot-password', {
        error: "Not a valid email.",
      });         
    }

    // Validate email is in database, won't send email if it isn't
    // Error displays a generic error because it could otherwise be used to find other in use emails 
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user.email) {
      return res.render('forgot-password', {
        error: "Password reset email failed to send.",
      });         
    }

    // Generate Token
    const token = createToken(6);
    db.prepare("UPDATE users SET reset_token = ?, reset_token_expiry = DATETIME('now', '+15 minutes') WHERE id = ?")
      .run(token, user.id);

    // Send email 
    try {
        await emailSender.sendPasswordReset(email, user.username, token);
    } catch (error) {
        console.error('Password reset email failed to send.', error);
    }

    // Redirect to password reset page / token login
    res.render('reset-password', {
      title: "Login"
    }); 

  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/error.html?message=' + '&back=/api/auth/register');
  }
});

/**
 * GET /reset-password - Show reset password form
 */
router.get('/reset-password', (req, res) => {
  res.render('reset-password', {
    title: "Login"
  }); 
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
      return res.render('reset-password', {
        error: "All fields are required.",
      });        
    }

    // Find user by username
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);

    if (!user) {
      // Don't reveal if username exists (security best practice)
      db.prepare('INSERT INTO loginAttempts (username, IP, success) VALUES (?, ?, ?)')
        .run(username, IP, 0);
      return res.render('reset-password', {
        error: "Invalid username or token.",
      });           
    }

    if (user.reset_token_expiry) {
      const lockExpiry = new Date(user.reset_token_expiry);
      const now = new Date();
      // Is it before the expiration date?
      if (now > lockExpiry) {
        return res.render('reset-password', {
          error: "Token Expired. Please request a new Token.",
        });          
      }
    }

    // Compare entered password with stored hash
    const tokenMatch = token===user.reset_token

    // const passwordMatch = await comparePassword(password, user.password_hash);
    
    if (!tokenMatch) {
      // Log failed attempt
      db.prepare('INSERT INTO loginAttempts (username, IP, success) VALUES (?, ?, ?)')
        .run(username, IP, 0);
      return res.render('reset-password', {
        error: "Token does not match.",
      });            
    }

    // Validate password requirements
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      return res.render('reset-password', {
        error: "Password does not meet requirements.",
      });       
    }
    
    // Hash the password before storing
    const passwordHash = await hashPassword(newPassword);

    // Insert new user into database
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?')
      .run(passwordHash, user.id);

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
    res.redirect(`/`);
    
  } catch (error) {
    console.error('Login error:', error);
    res.redirect('/error.html?message=' + '&back=/api/auth/register');
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