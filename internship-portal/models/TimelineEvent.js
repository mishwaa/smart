/**
 * TimelineEvent Model
 * Database operations for student timeline events and activity logs
 */

'use strict';

const { pool } = require('../config/database');

const TimelineEvent = {
  /**
   * Create a new timeline event / activity log
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const { student_id, event_type, title, description, event_date } = data;
    
    // Ensure event_date defaults to current date if not provided
    const dateStr = event_date || new Date().toISOString().slice(0, 10);

    const [result] = await pool.execute(
      `INSERT INTO timeline_events (student_id, event_type, title, description, event_date)
       VALUES (?, ?, ?, ?, ?)`,
      [student_id, event_type, title, description || null, dateStr]
    );

    return { id: result.insertId, ...data, event_date: dateStr };
  },

  /**
   * Get all vertical timeline events for a student (sorted chronologically)
   * @param {number} studentId
   * @returns {Promise<Array>}
   */
  async getTimeline(studentId) {
    const [rows] = await pool.execute(
      `SELECT * FROM timeline_events 
       WHERE student_id = ? AND event_type IN (
         'application', 'offer_letter', 'faculty_approval', 
         'internship_started', 'mentor_feedback', 'completion'
       )
       ORDER BY event_date ASC, created_at ASC`,
      [studentId]
    );
    return rows;
  },

  /**
   * Get recent activity history for a student (sorted reverse-chronologically)
   * @param {number} studentId
   * @param {number} [limit=15]
   * @returns {Promise<Array>}
   */
  async getActivityHistory(studentId, limit = 15) {
    const [rows] = await pool.execute(
      `SELECT * FROM timeline_events 
       WHERE student_id = ? 
       ORDER BY created_at DESC, event_date DESC 
       LIMIT ?`,
      [studentId, String(limit)]
    );
    return rows;
  }
};

module.exports = TimelineEvent;
