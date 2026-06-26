/**
 * WeeklyReport Model
 * Database operations for student weekly reports and workflows
 */

'use strict';

const { pool } = require('../config/database');

const WeeklyReport = {
  /**
   * Find a weekly report by ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT * FROM weekly_reports WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Find a weekly report by student and week number
   * @param {number} studentId
   * @param {number} weekNumber
   * @returns {Promise<Object|null>}
   */
  async findByStudentAndWeek(studentId, weekNumber) {
    const [rows] = await pool.execute(
      `SELECT * FROM weekly_reports WHERE student_id = ? AND week_number = ?`,
      [studentId, weekNumber]
    );
    return rows[0] || null;
  },

  /**
   * Create a new draft weekly report
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const {
      student_id, internship_id, week_number, date_range,
      report_content, skills_learned, problems_faced,
      hours_worked, achievements, future_plan
    } = data;

    const [result] = await pool.execute(
      `INSERT INTO weekly_reports (
        student_id, internship_id, week_number, date_range,
        report_content, skills_learned, problems_faced,
        hours_worked, achievements, future_plan, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`,
      [
        student_id, internship_id, week_number, date_range || null,
        report_content || '', skills_learned || null, problems_faced || null,
        hours_worked || 0.00, achievements || null, future_plan || null
      ]
    );

    return { id: result.insertId, ...data, status: 'draft' };
  },

  /**
   * Update a draft weekly report
   * @param {number} id
   * @param {Object} fields
   * @returns {Promise<Object>}
   */
  async update(id, fields) {
    const allowedFields = [
      'date_range', 'report_content', 'skills_learned', 'problems_faced',
      'hours_worked', 'achievements', 'future_plan', 'file_path'
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
      `UPDATE weekly_reports SET ${updates.join(', ')} WHERE id = ? AND status = 'draft'`,
      values
    );
    return result;
  },

  /**
   * Delete a draft weekly report
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async delete(id) {
    const [result] = await pool.execute(
      `DELETE FROM weekly_reports WHERE id = ? AND status = 'draft'`,
      [id]
    );
    return result;
  },

  /**
   * Submit a weekly report
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async submit(id) {
    const [result] = await pool.execute(
      `UPDATE weekly_reports
       SET status = 'submitted', submitted_at = CURRENT_TIMESTAMP
       WHERE id = ? AND status = 'draft'`,
      [id]
    );
    return result;
  },

  /**
   * Get all weekly reports for a student with optional status, search, sorting, and pagination filters
   * @param {number} studentId
   * @param {Object} [filters]
   * @returns {Promise<Array>}
   */
  async getReportsList(studentId, filters = {}) {
    let query = `SELECT * FROM weekly_reports WHERE student_id = ?`;
    const params = [studentId];

    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    if (filters.search) {
      query += ` AND (report_content LIKE ? OR skills_learned LIKE ? OR achievements LIKE ?)`;
      const searchWildcard = `%${filters.search}%`;
      params.push(searchWildcard, searchWildcard, searchWildcard);
    }

    // Sorting
    const direction = filters.sortBy === 'oldest' ? 'ASC' : 'DESC';
    query += ` ORDER BY week_number ${direction}`;

    // Pagination
    if (filters.limit) {
      const offset = (parseInt(filters.page || 1, 10) - 1) * parseInt(filters.limit, 10);
      query += ` LIMIT ? OFFSET ?`;
      params.push(String(filters.limit), String(offset));
    }

    const [rows] = await pool.execute(query, params);
    return rows;
  },

  /**
   * Get weekly report stats (e.g. submitted vs approved count)
   * @param {number} studentId
   * @param {number} totalWeeks - total weeks in internship (default 16)
   * @returns {Promise<Object>}
   */
  async getStatistics(studentId, totalWeeks = 16) {
    const [rows] = await pool.execute(
      `SELECT
        COUNT(CASE WHEN status = 'draft' THEN 1 END) AS draft_count,
        COUNT(CASE WHEN status = 'submitted' THEN 1 END) AS submitted_count,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) AS approved_count,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) AS rejected_count
       FROM weekly_reports
       WHERE student_id = ?`,
      [studentId]
    );

    const stats = rows[0] || { draft_count: 0, submitted_count: 0, approved_count: 0, rejected_count: 0 };
    const submittedCount = stats.submitted_count || 0;
    const approvedCount = stats.approved_count || 0;
    const totalSubmittedOrApproved = submittedCount + approvedCount;
    
    // Percentage calculation for reports
    const reportsPercentage = totalWeeks > 0 ? parseFloat(((totalSubmittedOrApproved / totalWeeks) * 100).toFixed(1)) : 0;

    return {
      draftCount: stats.draft_count || 0,
      submittedCount,
      approvedCount,
      rejectedCount: stats.rejected_count || 0,
      totalSubmittedOrApproved,
      reportsPercentage: Math.min(100, reportsPercentage)
    };
  }
};

module.exports = WeeklyReport;
