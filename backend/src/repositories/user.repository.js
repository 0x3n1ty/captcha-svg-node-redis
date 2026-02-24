// src/repositories/user.repository.js
const { getRedisClient } = require('../config/redis'); // If using Redis for users
// OR import your database connection (MongoDB, PostgreSQL, etc.)

/**
 * Repository pattern for user data access
 * All database operations go here
 */
class UserRepository {
    constructor() {
        // This could be a database connection, Redis client, etc.
        // For demonstration, using in-memory array (REPLACE WITH YOUR DB)
        this.users = [
            {
                id: 1,
                username: 'admin',
                password: '$2a$10$n0fsJrNji7H2bV3hkRcU8uJZi/agOGw9tk0npk7fOL4bJYFcOQua2', // Use bcrypt hash
                email: 'admin@example.com',
                role: 'admin',
                createdAt: new Date()
            }
        ];
    }

    /**
     * Find user by username
     * @param {string} username 
     * @returns {Promise<Object|null>}
     */
    async findByUsername(username) {
        try {
            // Example with PostgreSQL:
            // const result = await db.query(
            //     'SELECT * FROM users WHERE username = $1',
            //     [username]
            // );
            // return result.rows[0] || null;

            // Example with MongoDB:
            // return await UserModel.findOne({ username });

            // Example with Redis:
            // const redis = await getRedisClient();
            // const user = await redis.hGetAll(`user:${username}`);
            // return Object.keys(user).length ? user : null;

            // In-memory example (REPLACE THIS):
            const user = this.users.find(u => u.username === username);
            return user ? { ...user } : null; // Return copy to prevent mutations
        } catch (error) {
            console.error('[UserRepository] Error finding user:', error);
            throw new Error('Database error while finding user');
        }
    }

    /**
     * Find user by ID
     * @param {number|string} id
     * @returns {Promise<Object|null>}
     */
    async findById(id) {
        try {
            // Database query here
            const user = this.users.find(u => u.id === id);
            return user ? { ...user } : null;
        } catch (error) {
            console.error('[UserRepository] Error finding user by ID:', error);
            throw new Error('Database error');
        }
    }

    /**
     * Create new user
     * @param {Object} userData
     * @returns {Promise<Object>}
     */
    async create(userData) {
        try {
            const newUser = {
                id: this.users.length + 1,
                ...userData,
                createdAt: new Date()
            };
            this.users.push(newUser);
            return { ...newUser }; // Return copy without sensitive data
        } catch (error) {
            console.error('[UserRepository] Error creating user:', error);
            throw new Error('Database error while creating user');
        }
    }

    /**
     * Update user
     * @param {number|string} id
     * @param {Object} updates
     * @returns {Promise<Object|null>}
     */
    async update(id, updates) {
        try {
            const index = this.users.findIndex(u => u.id === id);
            if (index === -1) return null;
            
            this.users[index] = { ...this.users[index], ...updates };
            return { ...this.users[index] };
        } catch (error) {
            console.error('[UserRepository] Error updating user:', error);
            throw new Error('Database error while updating user');
        }
    }

    /**
     * Delete user
     * @param {number|string} id
     * @returns {Promise<boolean>}
     */
    async delete(id) {
        try {
            const index = this.users.findIndex(u => u.id === id);
            if (index === -1) return false;
            
            this.users.splice(index, 1);
            return true;
        } catch (error) {
            console.error('[UserRepository] Error deleting user:', error);
            throw new Error('Database error while deleting user');
        }
    }

    /**
     * Update last login timestamp
     * @param {number|string} id
     */
    async updateLastLogin(id) {
        try {
            const index = this.users.findIndex(u => u.id === id);
            if (index !== -1) {
                this.users[index].lastLogin = new Date();
            }
        } catch (error) {
            console.error('[UserRepository] Error updating last login:', error);
            // Non-critical error, don't throw
        }
    }
}

module.exports = new UserRepository();
