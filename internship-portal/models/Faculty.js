/**
 * Faculty Model
 * Database operations for the faculty table
 */

'use strict';

const { pool } = require('../config/database');

const Faculty = {
  /**
   * Find faculty by ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT f.*, u.email, u.role, u.is_active
       FROM faculty f
       JOIN users u ON f.user_id = u.id
       WHERE f.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Find faculty by user_id
   * @param {number} userId
   * @returns {Promise<Object|null>}
   */
  async findByUserId(userId) {
    const [rows] = await pool.execute(
      `SELECT f.*, u.email, u.role
       FROM faculty f
       JOIN users u ON f.user_id = u.id
       WHERE f.user_id = ?`,
      [userId]
    );
    return rows[0] || null;
  },

  /**
   * Create a new faculty profile
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const {
      user_id, first_name, last_name, employee_id,
      department, designation, phone
    } = data;

    const [result] = await pool.execute(
      `INSERT INTO faculty (user_id, first_name, last_name, employee_id,
        department, designation, phone)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user_id, first_name, last_name, employee_id,
       department || null, designation || null, phone || null]
    );
    return { id: result.insertId, ...data };
  },

  /**
   * Update faculty fields
   * @param {number} id
   * @param {Object} fields
   * @returns {Promise<Object>}
   */
  async update(id, fields) {
    const allowedFields = [
      'first_name', 'last_name', 'employee_id', 'department',
      'designation', 'phone', 'profile_image'
    ];
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
      `UPDATE faculty SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    return result;
  },

  /**
   * Get all faculty with pagination
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async findAll({ department = null, page = 1, limit = 20 } = {}) {
    let countQuery = 'SELECT COUNT(*) AS total FROM faculty f JOIN users u ON f.user_id = u.id';
    let dataQuery = `SELECT f.*, u.email, u.is_active
                     FROM faculty f
                     JOIN users u ON f.user_id = u.id`;
    const params = [];

    if (department) {
      const where = ' WHERE f.department = ?';
      countQuery += where;
      dataQuery += where;
      params.push(department);
    }

    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    const offset = (page - 1) * limit;
    dataQuery += ' ORDER BY f.created_at DESC LIMIT ? OFFSET ?';
    const dataParams = [...params, String(limit), String(offset)];

    const [rows] = await pool.execute(dataQuery, dataParams);

    return {
      faculty: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Delete faculty
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async delete(id) {
    const [result] = await pool.execute('DELETE FROM faculty WHERE id = ?', [id]);
    return result;
  }
};

module.exports = Faculty;
