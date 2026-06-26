/**
 * DailyLog Model
 * Database operations for student daily work logs
 */

'use strict';

const { pool } = require('../config/database');

const DailyLog = {
  /**
   * Find a daily log for a student by date
   * @param {number} studentId
   * @param {string} date - YYYY-MM-DD
   * @returns {Promise<Object|null>}
   */
  async findByStudentAndDate(studentId, date) {
    const [rows] = await pool.execute(
      `SELECT * FROM daily_logs WHERE student_id = ? AND date = ?`,
      [studentId, date]
    );
    return rows[0] || null;
  },

  /**
   * Find a daily log by ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT * FROM daily_logs WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Create a new daily log entry
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const {
      student_id, internship_id, date, tasks_completed,
      hours_worked, technology_used, problems_faced,
      learning_outcome, remarks
    } = data;

    const [result] = await pool.execute(
      `INSERT INTO daily_logs (student_id, internship_id, date, tasks_completed, hours_worked, technology_used, problems_faced, learning_outcome, remarks)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [student_id, internship_id, date, tasks_completed, hours_worked, technology_used || null, problems_faced || null, learning_outcome || null, remarks || null]
    );

    return { id: result.insertId, ...data };
  },

  /**
   * Get all daily logs for a student with search and filtering
   * @param {number} studentId
   * @param {Object} [filters]
   * @returns {Promise<Array>}
   */
  async getLogsList(studentId, filters = {}) {
    let query = `SELECT * FROM daily_logs WHERE student_id = ?`;
    const params = [studentId];

    if (filters.startDate) {
      query += ` AND date >= ?`;
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      query += ` AND date <= ?`;
      params.push(filters.endDate);
    }
    if (filters.search) {
      query += ` AND (tasks_completed LIKE ? OR technology_used LIKE ? OR learning_outcome LIKE ?)`;
      const searchWildcard = `%${filters.search}%`;
      params.push(searchWildcard, searchWildcard, searchWildcard);
    }

    query += ` ORDER BY date DESC`;

    const [rows] = await pool.execute(query, params);
    return rows;
  },

  /**
   * Get cumulative work statistics
   * @param {number} studentId
   * @returns {Promise<Object>}
   */
  async getStatistics(studentId) {
    const [rows] = await pool.execute(
      `SELECT
        COUNT(*) AS total_logs,
        SUM(hours_worked) AS total_hours
       FROM daily_logs
       WHERE student_id = ?`,
      [studentId]
    );

    const stats = rows[0] || { total_logs: 0, total_hours: 0 };
    return {
      totalLogs: stats.total_logs || 0,
      totalHours: parseFloat(stats.total_hours || 0)
    };
  }
};

module.exports = DailyLog;
