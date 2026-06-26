/**
 * StudentDocument Model
 * Database operations for student documents
 */

'use strict';

const { pool } = require('../config/database');

const StudentDocument = {
  /**
   * Find a document by ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT * FROM student_documents WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Create a new document record
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const { student_id, document_type, file_name, file_path, file_size } = data;
    const [result] = await pool.execute(
      `INSERT INTO student_documents (student_id, document_type, file_name, file_path, file_size)
       VALUES (?, ?, ?, ?, ?)`,
      [student_id, document_type, file_name, file_path, file_size]
    );
    return { id: result.insertId, ...data };
  },

  /**
   * Delete a document record
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async delete(id) {
    const [result] = await pool.execute(
      `DELETE FROM student_documents WHERE id = ?`,
      [id]
    );
    return result;
  },

  /**
   * Get all documents for a student with optional type filter
   * @param {number} studentId
   * @param {Object} [filters]
   * @returns {Promise<Array>}
   */
  async getDocumentsList(studentId, filters = {}) {
    let query = `SELECT * FROM student_documents WHERE student_id = ?`;
    const params = [studentId];

    if (filters.documentType) {
      query += ` AND document_type = ?`;
      params.push(filters.documentType);
    }
    if (filters.search) {
      query += ` AND file_name LIKE ?`;
      params.push(`%${filters.search}%`);
    }

    query += ` ORDER BY uploaded_at DESC`;

    const [rows] = await pool.execute(query, params);
    return rows;
  },

  /**
   * Get document statistics
   * @param {number} studentId
   * @returns {Promise<Object>}
   */
  async getStatistics(studentId) {
    const [rows] = await pool.execute(
      `SELECT
        COUNT(*) AS total_documents,
        COUNT(CASE WHEN document_type = 'resume' THEN 1 END) AS resume_count,
        COUNT(CASE WHEN document_type = 'offer_letter' THEN 1 END) AS offer_letter_count,
        COUNT(CASE WHEN document_type = 'noc' THEN 1 END) AS noc_count,
        COUNT(CASE WHEN document_type = 'weekly_report_pdf' THEN 1 END) AS report_pdf_count,
        COUNT(CASE WHEN document_type = 'presentation' THEN 1 END) AS presentation_count,
        COUNT(CASE WHEN document_type = 'final_report' THEN 1 END) AS final_report_count,
        COUNT(CASE WHEN document_type = 'certificate' THEN 1 END) AS certificate_count,
        COUNT(CASE WHEN document_type = 'other' THEN 1 END) AS other_count
       FROM student_documents
       WHERE student_id = ?`,
      [studentId]
    );

    const stats = rows[0] || {
      total_documents: 0,
      resume_count: 0,
      offer_letter_count: 0,
      noc_count: 0,
      report_pdf_count: 0,
      presentation_count: 0,
      final_report_count: 0,
      certificate_count: 0,
      other_count: 0
    };

    // Calculate percentage based on upload of core required documents:
    // Core: Resume, Offer Letter, NOC, Final Report (Total 4 core documents)
    const requiredUploaded = (stats.resume_count > 0 ? 1 : 0) +
                             (stats.offer_letter_count > 0 ? 1 : 0) +
                             (stats.noc_count > 0 ? 1 : 0) +
                             (stats.final_report_count > 0 ? 1 : 0);
    const documentsPercentage = Math.round((requiredUploaded / 4) * 100);

    return {
      totalDocuments: stats.total_documents || 0,
      resumeCount: stats.resume_count || 0,
      offerLetterCount: stats.offer_letter_count || 0,
      nocCount: stats.noc_count || 0,
      reportPdfCount: stats.report_pdf_count || 0,
      presentationCount: stats.presentation_count || 0,
      finalReportCount: stats.final_report_count || 0,
      certificateCount: stats.certificate_count || 0,
      otherCount: stats.other_count || 0,
      documentsPercentage
    };
  }
};

module.exports = StudentDocument;
