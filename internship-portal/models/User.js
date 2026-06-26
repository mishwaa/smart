/**
 * User Model
 * Database operations for the users table
 */

'use strict';

const { pool } = require('../config/database');

const User = {
  /**
   * Find a user by ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await pool.execute(
      'SELECT id, email, role, is_active, created_at, updated_at FROM users WHERE id = ?',
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
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    return rows[0] || null;
  },

  /**
   * Create a new user
   * @param {Object} userData - { email, password, role }
   * @returns {Promise<Object>} - Insert result
   */
  async create({ email, password, role }) {
    const [result] = await pool.execute(
      'INSERT INTO users (email, password, role) VALUES (?, ?, ?)',
      [email, password, role]
    );
    return { id: result.insertId, email, role };
  },

  /**
   * Update user fields
   * @param {number} id
   * @param {Object} fields - Fields to update
   * @returns {Promise<Object>}
   */
  async update(id, fields) {
    const allowedFields = ['email', 'password', 'role', 'is_active'];
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(fields)) {
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
    let dataQuery = 'SELECT id, email, role, is_active, created_at, updated_at FROM users';
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
  }
};

module.exports = User;
