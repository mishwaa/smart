/**
 * Feedback Model
 * Database operations for student, company, and faculty feedback
 */

'use strict';

const { pool } = require('../config/database');

const Feedback = {
  /**
   * Find feedback by ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT * FROM feedback WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Create a new feedback record
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const { from_user_id, to_user_id, internship_id, rating, comments, feedback_type } = data;
    const [result] = await pool.execute(
      `INSERT INTO feedback (from_user_id, to_user_id, internship_id, rating, comments, feedback_type)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [from_user_id, to_user_id, internship_id || null, rating || null, comments || null, feedback_type]
    );
    return { id: result.insertId, ...data };
  },

  /**
   * Get feedback history between users or for a specific student
   * @param {number} toUserId
   * @param {string} [type]
   * @returns {Promise<Array>}
   */
  async getFeedbackForUser(toUserId, type = null) {
    let query = `
      SELECT f.*, 
             u.email AS from_email,
             CASE 
               WHEN u.role = 'faculty' THEN (SELECT CONCAT(first_name, ' ', last_name) FROM faculty WHERE user_id = u.id)
               WHEN u.role = 'company' THEN (SELECT company_name FROM companies WHERE user_id = u.id)
               WHEN u.role = 'student' THEN (SELECT CONCAT(first_name, ' ', last_name) FROM students WHERE user_id = u.id)
               ELSE 'System'
             END AS from_name
      FROM feedback f
      JOIN users u ON f.from_user_id = u.id
      WHERE f.to_user_id = ?
    `;
    const params = [toUserId];

    if (type) {
      query += ` AND f.feedback_type = ?`;
      params.push(type);
    }

    query += ` ORDER BY f.created_at DESC`;

    const [rows] = await pool.execute(query, params);
    return rows;
  }
};

module.exports = Feedback;
