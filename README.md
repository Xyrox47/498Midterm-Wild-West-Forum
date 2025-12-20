
# Rubicunda Web Forum - Final Project

Site: https://rubicunda.org

# Features
## Authentication
- Password Hashing using Argon2
- 15 Minute Account Lockout after 5 fails
- HTTPS Encryption
- IP logging for login attempts
- Session Management using SQLite

## Users
- Required unique Email and Username
- Unrestricted display names
- The ability to change
    - Password
    - Email
    - Display name
    - Name Color
 
## Password Recovery
- Forgot Password pipeline
- Time-limited tokens
- Sent via email
- Invalidated after use
- Only useful for the user tied to the email

## Real-Time Chat
- Real-time Chat through Socket.IO
- Messages stored in SQLite database
- Authentication Required to Access
- Messages display
    - Creation time
    - User Color
    - content

## Improved Comment System
- Comment system now include pagination
    - 20 Comments per page
    - Prev & Next buttons to move between pages
- Display
    - Display name & Color
    - Timestamp
    - and Content
 
# Security Features
## Password Security
- Argon2 for Password Hashing
- Minimum Requirements
    - Minimum 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    - At least one special character
- Only hashed passwords are stored
- Requires enforced on registration and update

## Password recovery
- Recovery via email
- Tokens are tied to users, only the user tied to the recovery email can use it
- Tokens expire after 15 minutes
- Invalidated after use 

## Account Lockout
- 5 failed attempts
- 15 minutes
- Attempts tracked via IP
- Stored in their own table

## Sessions
- Stored in SQLite database
- 24 Hour lifetime

# Setup
## Requirements
- Docker
- Properly setup Domain name and DNS
- Mailgun account setup and pointed at server

## Installation
1. Run "git clone https://github.com/Xyrox47/498Midterm-Wild-West-Forum/tree/final-project.git"
2. env file with the following:
```
   MAILGUN_API_KEY=your_api_key_here
   MAILGUN_DOMAIN=your_domain_here
   MAILGUN_FROM=mail_sender_here
```
2. Enter my-nodejs-app folder in /498Midterm-Wild-West-Forum/my-nodejs-app/
3. Run "docker compose down && docker compose build && dockercompose up -d" To start the server
4. ## Configure Nginx Proxy Manager
  Access admin panel at ``` http://YOUR_SERVER_IP:5001```
  Default credentials:

- Email: ```admin@example.com```
- Password: ```changeme```
Add a Proxy Host:

- Domain: ```your-domain.com```
- Forward Hostname: ```backend-nodejs```
- Forward Port: ```3000```
- Enable "Websockets Support" (required for Socket.IO)
- Request SSL certificate (Let's Encrypt)
- Enable "Force SSL"

# Database Schema
##  Users
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      user_color TEXT DEFAULT ('#000000'),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      failed_login_attempts INTEGER DEFAULT 0,
      account_lock_expiry DATETIME,
      reset_token TEXT,
      reset_token_expiry DATETIME,
      last_login DATETIME
      
## comments
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
## messages
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)

 ## loginAttempts
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL,
      IP TEXT NOT NULL,
      created DATETIME DEFAULT CURRENT_TIMESTAMP,
      success INTEGER NOT NULL



# Routes
## General
GET / - Home Page

## Live Chat
- GET /livechat - Livechat page
- GET /api/chat/history - Get chat history (I think prior 50?)
- POST /api/chat/message - Validate and add new messages

## Profile
- GET /profile/me - The logged in user's personal page
- GET /profile/editProfile - Page to edit information about the user
- Get /profile/:userId - Page to view other user's comment histories

## Comments
- GET /comments - Home page for comments, displays them by pages of 20
- GET /comments/new - Make a new comment form
- POST /comments/addComment - Validate and insert into database

## Authentication 
### Registration
- GET /api/auth/register - Registration form
- POST /api/auth/register - Validate new user and add to database

### Login
- GET /api/auth/login - Login page
- POST /api/auth/login Validate credentials and create session

### Logout
- GET /api/auth/logout - Destroy session and redirect
- POST /api/auth/logout - Destory session and redirect 

### Change Info
- POST /api/auth/changePassword - Validate new password and update database
- POST /api/auth/changeEmail - Validate new email and update database
- POST /api/auth/changeDisplayName - Validate new display name and update database
- POST /api/auth/changeNameColor - Validate hex code and update database

### Password Recovery
- GET /api/auth/forgot-password - Validate recovery email, make token, send email, and redirect
- GET /api/auth/reset-password - Adapted login form to use a token and update password
- POST /api/auth/reset-password - Validate username, token, and new password and update database




    
