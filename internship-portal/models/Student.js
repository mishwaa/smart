/**
 * Student Model
 * Database operations for the students table
 */

'use strict';

const { pool } = require('../config/database');

const Student = {
  /**
   * Find a student by ID (joins with users for email/role)
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT s.*, u.email, u.role, u.is_active
       FROM students s
       JOIN users u ON s.user_id = u.id
       WHERE s.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Find a student by user_id
   * @param {number} userId
   * @returns {Promise<Object|null>}
   */
  async findByUserId(userId) {
    const [rows] = await pool.execute(
      `SELECT s.*, u.email, u.role
       FROM students s
       JOIN users u ON s.user_id = u.id
       WHERE s.user_id = ?`,
      [userId]
    );
    return rows[0] || null;
  },

  /**
   * Create a new student profile
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const {
      user_id, first_name, last_name, roll_number,
      department, semester, phone, address, cgpa
    } = data;

    const [result] = await pool.execute(
      `INSERT INTO students (user_id, first_name, last_name, roll_number,
        department, semester, phone, address, cgpa)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, first_name, last_name, roll_number,
       department || null, semester || null, phone || null,
       address || null, cgpa || null]
    );
    return { id: result.insertId, ...data };
  },

  /**
   * Update student fields
   * @param {number} id
   * @param {Object} fields
   * @returns {Promise<Object>}
   */
  async update(id, fields) {
    const allowedFields = [
      'first_name', 'last_name', 'roll_number', 'department',
      'semester', 'phone', 'address', 'cgpa', 'resume_path', 'profile_image'
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
      `UPDATE students SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    return result;
  },

  /**
   * Get all students with pagination
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async findAll({ department = null, page = 1, limit = 20 } = {}) {
    let countQuery = 'SELECT COUNT(*) AS total FROM students s JOIN users u ON s.user_id = u.id';
    let dataQuery = `SELECT s.*, u.email, u.is_active
                     FROM students s
                     JOIN users u ON s.user_id = u.id`;
    const params = [];

    if (department) {
      const where = ' WHERE s.department = ?';
      countQuery += where;
      dataQuery += where;
      params.push(department);
    }

    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    const offset = (page - 1) * limit;
    dataQuery += ' ORDER BY s.created_at DESC LIMIT ? OFFSET ?';
    const dataParams = [...params, String(limit), String(offset)];

    const [rows] = await pool.execute(dataQuery, dataParams);

    return {
      students: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Delete a student
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async delete(id) {
    const [result] = await pool.execute('DELETE FROM students WHERE id = ?', [id]);
    return result;
  }
};

module.exports = Student;
