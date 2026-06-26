/**
 * User Model
 * Database operations for the users table
 */

'use strict';

const { pool } = require('../config/database');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

const User = {
  /**
   * Find a user by ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, is_active, must_change_password, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Find a user by email (includes password for authentication)
   * @param {string} email
   * @returns {Promise<Object|null>}
   */
  async findByEmail(email) {
    const [rows] = await pool.execute(
      'SELECT id, name, email, password, role, is_active, must_change_password, created_at, updated_at FROM users WHERE email = ?',
      [email]
    );
    return rows[0] || null;
  },

  /**
   * Create a new user
   * @param {Object} userData - { name, email, password, role, must_change_password }
   * @returns {Promise<Object>} - Insert result
   */
  async create({ name, email, password, role, must_change_password = false }) {
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const [result] = await pool.execute(
      'INSERT INTO users (name, email, password, role, must_change_password) VALUES (?, ?, ?, ?, ?)',
      [name || '', email, hashedPassword, role, must_change_password]
    );
    return { id: result.insertId, name, email, role, must_change_password };
  },

  /**
   * Update user fields
   * @param {number} id
   * @param {Object} fields - Fields to update
   * @returns {Promise<Object>}
   */
  async update(id, fields) {
    const allowedFields = ['name', 'email', 'password', 'role', 'is_active', 'must_change_password'];
    const updates = [];
    const values = [];

    const fieldsCopy = { ...fields };
    if (fieldsCopy.password) {
      fieldsCopy.password = await bcrypt.hash(fieldsCopy.password, SALT_ROUNDS);
    }

    for (const [key, value] of Object.entries(fieldsCopy)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length === 0) {
      throw new Error('No valid fields to update');
    }

    values.push(id);
    const [result] = await pool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    return result;
  },

  /**
   * Delete a user
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async delete(id) {
    const [result] = await pool.execute(
      'DELETE FROM users WHERE id = ?',
      [id]
    );
    return result;
  },

  /**
   * Get all users with optional role filter and pagination
   * @param {Object} options - { role, page, limit }
   * @returns {Promise<Object>} - { users, total, page, totalPages }
   */
  async findAll({ role = null, page = 1, limit = 20 } = {}) {
    let countQuery = 'SELECT COUNT(*) AS total FROM users';
    let dataQuery = 'SELECT id, name, email, role, is_active, must_change_password, created_at, updated_at FROM users';
    const params = [];

    if (role) {
      const whereClause = ' WHERE role = ?';
      countQuery += whereClause;
      dataQuery += whereClause;
      params.push(role);
    }

    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    const offset = (page - 1) * limit;
    dataQuery += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    const dataParams = [...params, String(limit), String(offset)];

    const [rows] = await pool.execute(dataQuery, dataParams);

    return {
      users: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Verify password
   * @param {string} plainText
   * @param {string} hash
   * @returns {Promise<boolean>}
   */
  async verifyPassword(plainText, hash) {
    return bcrypt.compare(plainText, hash);
  },

  /**
   * Seed default admin user
   * @returns {Promise<void>}
   */
  async seedDefaultAdmin() {
    try {
      const [rows] = await pool.execute(
        'SELECT id FROM users WHERE role = ? LIMIT 1',
        ['admin']
      );
      if (rows.length === 0) {
        console.log('🌱 No admin user found. Seeding default admin...');
        await this.create({
          name: 'System Admin',
          email: 'admin@university.com',
          password: 'Admin@123',
          role: 'admin',
          must_change_password: true
        });
        console.log('✅ Default admin seeded successfully (admin@university.com / Admin@123)');
      }
    } catch (error) {
      console.error('❌ Failed to seed default admin:', error.message);
    }
  }
};

module.exports = User;
