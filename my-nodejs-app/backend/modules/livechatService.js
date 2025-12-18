const db = require('../database');

class LiveChatService {
    saveMessage(userId, messageText) {
        try {
            const insertStmt = db.prepare(`
                INSERT INTO messages (user_id, content)
                VALUES (?, ?)
            `);
            
            const result = insertStmt.run(userId, messageText);
            
            const selectStmt = db.prepare(`
                SELECT 
                    messages.id,
                    messages.user_id,
                    messages.content,
                    messages.created_at,
                    users.display_name,
                    users.user_color
                FROM messages
                JOIN users ON messages.user_id = users.id
                WHERE messages.id = ?
            `);
            
            const message = selectStmt.get(result.lastInsertRowid);
            return message;
        } catch (error) {
            console.error('Error saving message:', error);
            throw error;
        }
    }
    
    getChatHistory(limit = 50, offset = 0) {
        try {
            const stmt = db.prepare(`
                SELECT 
                    messages.id,
                    messages.user_id,
                    messages.content,
                    messages.created_at,
                    users.display_name,
                    users.user_color
                FROM messages
                JOIN users ON messages.user_id = users.id
                ORDER BY messages.created_at DESC
                LIMIT ? OFFSET ?
            `);
            
            const messages = stmt.all(limit, offset);
            return messages.reverse(); 
        } catch (error) {
            console.error('Error fetching chat history:', error);
            throw error;
        }
    }
    
    getMessageCount() {
        try {
            const stmt = db.prepare('SELECT COUNT(*) as count FROM messages');
            const result = stmt.get();
            return result.count;
        } catch (error) {
            console.error('Error getting message count:', error);
            throw error;
        }
    }
}

module.exports = new LiveChatService();