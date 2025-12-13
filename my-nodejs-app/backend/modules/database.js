const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../databases/forum.db');
const db = new Database(dbPath);

db.pragma('foreign_keys = ON');

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        failed_login_attempts INTEGER DEFAULT 0,
        last_login DATETIME
    );
`);

// db.exec(`
//     CREATE TABLE IF NOT EXISTS users (
//         id INTEGER PRIMARY KEY AUTOINCREMENT,
//         username TEXT UNIQUE NOT NULL,
//         password TEXT NOT NULL,
//         email TEXT UNIQUE NOT NULL,
//         display_name TEXT UNIQUE NOT NULL,
//         profile_name_color INTEGER NOT NULL DEFAULT 0,
//         failed_attempts INTEGER NOT NULL DEFAULT 0
//     );
// `)

db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        display_name TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
        FOREIGN KEY (display_name) REFERENCES users(display_name)
    );
`)

db.exec(`
    CREATE TABLE IF NOT EXISTS loginAttempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL,
        IP TEXT NOT NULL,
        created DATETIME DEFAULT CURRENT_TIMESTAMP,
        success INTEGER NOT NULL
    );
`)

module.exports = db;
