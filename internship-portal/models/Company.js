/**
 * Company Model
 * Database operations for the companies table
 */

'use strict';

const { pool } = require('../config/database');

const Company = {
  /**
   * Find a company by ID
   * @param {number} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const [rows] = await pool.execute(
      `SELECT c.*, u.email, u.role, u.is_active
       FROM companies c
       JOIN users u ON c.user_id = u.id
       WHERE c.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Find a company by user_id
   * @param {number} userId
   * @returns {Promise<Object|null>}
   */
  async findByUserId(userId) {
    const [rows] = await pool.execute(
      `SELECT c.*, u.email, u.role
       FROM companies c
       JOIN users u ON c.user_id = u.id
       WHERE c.user_id = ?`,
      [userId]
    );
    return rows[0] || null;
  },

  /**
   * Create a new company profile
   * @param {Object} data
   * @returns {Promise<Object>}
   */
  async create(data) {
    const {
      user_id, company_name, industry, website,
      contact_person, contact_email, contact_phone,
      address, description
    } = data;

    const [result] = await pool.execute(
      `INSERT INTO companies (user_id, company_name, industry, website,
        contact_person, contact_email, contact_phone, address, description)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, company_name, industry || null, website || null,
       contact_person || null, contact_email || null, contact_phone || null,
       address || null, description || null]
    );
    return { id: result.insertId, ...data };
  },

  /**
   * Update company fields
   * @param {number} id
   * @param {Object} fields
   * @returns {Promise<Object>}
   */
  async update(id, fields) {
    const allowedFields = [
      'company_name', 'industry', 'website', 'contact_person',
      'contact_email', 'contact_phone', 'address', 'description',
      'logo_path', 'is_verified'
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
      `UPDATE companies SET ${updates.join(', ')} WHERE id = ?`,
      values
    );
    return result;
  },

  /**
   * Get all companies with pagination
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async findAll({ industry = null, verified = null, page = 1, limit = 20 } = {}) {
    let countQuery = 'SELECT COUNT(*) AS total FROM companies c JOIN users u ON c.user_id = u.id';
    let dataQuery = `SELECT c.*, u.email, u.is_active
                     FROM companies c
                     JOIN users u ON c.user_id = u.id`;
    const conditions = [];
    const params = [];

    if (industry) {
      conditions.push('c.industry = ?');
      params.push(industry);
    }
    if (verified !== null) {
      conditions.push('c.is_verified = ?');
      params.push(verified);
    }

    if (conditions.length > 0) {
      const where = ' WHERE ' + conditions.join(' AND ');
      countQuery += where;
      dataQuery += where;
    }

    const [countRows] = await pool.execute(countQuery, params);
    const total = countRows[0].total;

    const offset = (page - 1) * limit;
    dataQuery += ' ORDER BY c.created_at DESC LIMIT ? OFFSET ?';
    const dataParams = [...params, String(limit), String(offset)];

    const [rows] = await pool.execute(dataQuery, dataParams);

    return {
      companies: rows,
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  },

  /**
   * Delete a company
   * @param {number} id
   * @returns {Promise<Object>}
   */
  async delete(id) {
    const [result] = await pool.execute('DELETE FROM companies WHERE id = ?', [id]);
    return result;
  }
};

module.exports = Company;
