/**
 * Attendance Model
 * Database operations for student attendance and leaves
 */

'use strict';

const { pool } = require('../config/database');

const Attendance = {
  /**
   * Find attendance record for a student on a specific date
   * @param {number} studentId
   * @param {string} date - YYYY-MM-DD
   * @returns {Promise<Object|null>}
   */
  async findByStudentAndDate(studentId, date) {
    const [rows] = await pool.execute(
      `SELECT * FROM attendance WHERE student_id = ? AND date = ?`,
      [studentId, date]
    );
    return rows[0] || null;
  },

  /**
   * Find attendance record by ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT * FROM attendance WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Create a check-in record
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async checkIn(data) {
    const { student_id, internship_id, date, check_in_time, location, remarks } = data;
    const [result] = await pool.execute(
      `INSERT INTO attendance (student_id, internship_id, date, status, check_in_time, location, remarks)
       VALUES (?, ?, ?, 'present', ?, ?, ?)`,
      [student_id, internship_id, date, check_in_time, location || null, remarks || null]
    );
    return { id: result.insertId, ...data, status: 'present' };
  },

  /**
   * Update check-out details
   * @param {number} id
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async checkOut(id, data) {
    const { check_out_time, working_hours, remarks } = data;
    const [result] = await pool.execute(
      `UPDATE attendance
       SET check_out_time = ?, working_hours = ?, remarks = IFNULL(?, remarks)
       WHERE id = ?`,
      [check_out_time, working_hours, remarks || null, id]
    );
    return result;
  },

  /**
   * Create a leave request record
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async createLeaveRequest(data) {
    const { student_id, internship_id, date, leave_reason } = data;
    const [result] = await pool.execute(
      `INSERT INTO attendance (student_id, internship_id, date, status, leave_reason, leave_status)
       VALUES (?, ?, ?, 'leave', ?, 'pending')`,
      [student_id, internship_id, date, leave_reason]
    );
    return { id: result.insertId, ...data, status: 'leave', leave_status: 'pending' };
  },

  /**
   * Get attendance list for a student with optional filters, sorting, and pagination
   * @param {number} studentId
   * @param {Object} [filters]
   * @returns {Promise<Array>}
   */
  async getAttendanceList(studentId, filters = {}) {
    let query = `SELECT * FROM attendance WHERE student_id = ?`;
    const params = [studentId];

    if (filters.month) {
      query += ` AND MONTH(date) = ?`;
      params.push(filters.month);
    }
    if (filters.year) {
      query += ` AND YEAR(date) = ?`;
      params.push(filters.year);
    }
    if (filters.status) {
      query += ` AND status = ?`;
      params.push(filters.status);
    }

    // Sorting
    const direction = filters.sortBy === 'oldest' ? 'ASC' : 'DESC';
    query += ` ORDER BY date ${direction}`;

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
   * Get attendance statistics for a student
   * @param {number} studentId
   * @param {number} totalDays - total days required in internship (e.g. 120)
   * @returns {Promise<Object>}
   */
  async getStatistics(studentId, totalDays = 120) {
    const [rows] = await pool.execute(
      `SELECT
        COUNT(CASE WHEN status = 'present' THEN 1 END) AS present_days,
        COUNT(CASE WHEN status = 'absent' THEN 1 END) AS absent_days,
        COUNT(CASE WHEN status = 'leave' AND leave_status = 'approved' THEN 1 END) AS approved_leaves,
        COUNT(CASE WHEN status = 'leave' AND leave_status = 'pending' THEN 1 END) AS pending_leaves,
        SUM(CASE WHEN status = 'present' THEN working_hours ELSE 0 END) AS total_hours_worked
       FROM attendance
       WHERE student_id = ?`,
      [studentId]
    );

    const stats = rows[0] || { present_days: 0, absent_days: 0, approved_leaves: 0, pending_leaves: 0, total_hours_worked: 0 };
    
    // Calculate percentage based on days completed
    const presentDays = stats.present_days || 0;
    const attendancePercentage = totalDays > 0 ? parseFloat(((presentDays / totalDays) * 100).toFixed(1)) : 0;

    return {
      presentDays,
      absentDays: stats.absent_days || 0,
      approvedLeaves: stats.approved_leaves || 0,
      pendingLeaves: stats.pending_leaves || 0,
      totalHoursWorked: parseFloat(stats.total_hours_worked || 0),
      attendancePercentage: Math.min(100, attendancePercentage)
    };
  }
};

module.exports = Attendance;
