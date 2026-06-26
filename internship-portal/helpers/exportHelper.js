/**
 * Export Helper
 * Generates professional PDF and CSV reports for student attendance, logs, reports, and timeline.
 */

'use strict';

const PDFDocument = require('pdfkit');

const exportHelper = {
  /**
   * Escapes fields for safe CSV generation
   * @param {string} val
   * @returns {string}
   */
  escapeCSV(val) {
    if (val === null || val === undefined) return '';
    const str = String(val).trim();
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  },

  /**
   * Generates a CSV string from headers and rows
   * @param {Array<string>} headers
   * @param {Array<Object>} rows
   * @param {Array<string>} keys - corresponding object keys
   * @returns {string}
   */
  generateCSV(headers, rows, keys) {
    const headerLine = headers.map(this.escapeCSV).join(',');
    const dataLines = rows.map(row => {
      return keys.map(key => this.escapeCSV(row[key])).join(',');
    });
    return [headerLine, ...dataLines].join('\n');
  },

  /**
   * Generates a professional PDF report using PDFKit
   * @param {string} title
   * @param {Object} student
   * @param {Array<string>} headers
   * @param {Array<Object>} rows
   * @param {string} type - 'attendance' | 'reports' | 'logs' | 'timeline' | 'documents'
   * @returns {Promise<Buffer>}
   */
  generatePDF(title, student, headers, rows, type) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
        const chunks = [];

        doc.on('data', chunk => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', err => reject(err));

        // --- Page Header & Brand ---
        doc.fillColor('#1e3a8a').fontSize(20).font('Helvetica-Bold').text('Smart University Internship Portal', { align: 'center' });
        doc.fillColor('#4b5563').fontSize(12).font('Helvetica-Bold').text(title.toUpperCase(), { align: 'center' });
        doc.moveDown(0.5);

        // Decorative line
        doc.strokeColor('#3b82f6').lineWidth(2).moveTo(50, 90).lineTo(545, 90).stroke();
        doc.moveDown();

        // --- Student Metadata Block ---
        doc.fillColor('#1f2937').fontSize(9).font('Helvetica-Bold').text('STUDENT INFORMATION', 50, 105);
        doc.font('Helvetica');
        doc.text(`Name: ${student.first_name} ${student.last_name}`, 50, 120);
        doc.text(`Roll Number: ${student.roll_number || 'N/A'}`, 50, 132);
        doc.text(`Enrollment No: ${student.enrollment_number}`, 50, 144);
        doc.text(`Department: ${student.department}`, 50, 156);

        doc.font('Helvetica-Bold').text('REPORT METADATA', 350, 105);
        doc.font('Helvetica');
        const todayStr = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        doc.text(`Generated Date: ${todayStr}`, 350, 120);
        doc.text(`Export Type: Student ERP Ledger`, 350, 132);
        doc.text(`Records Count: ${rows.length}`, 350, 144);
        doc.text(`Status: Active Program`, 350, 156);

        // Section divider
        doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(50, 175).lineTo(545, 175).stroke();

        // --- Table Headers Setup ---
        let y = 195;
        const colWidths = this.getColumnWidths(type);
        const colPositions = this.getColumnPositions(colWidths, 50);

        // Draw header background
        doc.fillColor('#f1f5f9').rect(50, y, 495, 20).fill();
        
        // Draw header text
        doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');
        headers.forEach((header, i) => {
          doc.text(header, colPositions[i], y + 6, { width: colWidths[i], align: 'left' });
        });

        y += 20;
        doc.font('Helvetica').fontSize(8).fillColor('#334155');

        // --- Table Rows Rendering ---
        rows.forEach((row, rowIndex) => {
          // Check for page overflow
          if (y > 750) {
            doc.addPage();
            y = 50; // reset Y for new page
            
            // Draw table header again on new page
            doc.fillColor('#f1f5f9').rect(50, y, 495, 20).fill();
            doc.fillColor('#0f172a').fontSize(8).font('Helvetica-Bold');
            headers.forEach((header, i) => {
              doc.text(header, colPositions[i], y + 6, { width: colWidths[i], align: 'left' });
            });
            y += 20;
            doc.font('Helvetica').fontSize(8).fillColor('#334155');
          }

          // Shading for alternating rows
          if (rowIndex % 2 === 1) {
            doc.fillColor('#f8fafc').rect(50, y, 495, 22).fill();
          }

          doc.fillColor('#334155');
          const rowData = this.getRowValues(row, type);

          let maxRowHeight = 22; // default row spacing
          
          // Render each column's text, calculating actual height needed
          rowData.forEach((val, i) => {
            const cleanVal = val === null || val === undefined ? '' : String(val);
            doc.text(cleanVal, colPositions[i], y + 6, { width: colWidths[i], align: 'left' });
          });

          // Horizontal grid line
          doc.strokeColor('#f1f5f9').lineWidth(1).moveTo(50, y + maxRowHeight).lineTo(545, y + maxRowHeight).stroke();

          y += maxRowHeight;
        });

        // --- Page Numbers & Footer ---
        const pages = doc.bufferedPageRange();
        for (let i = 0; i < pages.count; i++) {
          doc.switchToPage(i);
          doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(50, 800).lineTo(545, 800).stroke();
          doc.fillColor('#94a3b8').fontSize(7);
          doc.text('Smart University Placement ERP Systems — Confidential Report', 50, 808);
          doc.text(`Page ${i + 1} of ${pages.count}`, 450, 808, { align: 'right' });
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  },

  /**
   * Returns column width configuration depending on export type
   */
  getColumnWidths(type) {
    if (type === 'attendance') {
      return [75, 75, 75, 75, 55, 140]; // Date, Status, Check-In, Check-Out, Hours, Remarks (Total = 495)
    } else if (type === 'reports') {
      return [40, 95, 75, 60, 225]; // Week, Date Range, Hours, Status, Tasks (Total = 495)
    } else if (type === 'logs') {
      return [75, 60, 100, 260]; // Date, Hours, Tech, Tasks (Total = 495)
    } else if (type === 'timeline') {
      return [80, 120, 295]; // Date, Milestone, Description (Total = 495)
    } else if (type === 'documents') {
      return [180, 120, 100, 95]; // Name, Category, Size, Date (Total = 495)
    }
    return [120, 120, 120, 135];
  },

  /**
   * Calculates absolute starting X coordinates for columns based on widths
   */
  getColumnPositions(widths, startX) {
    const positions = [startX];
    let currentX = startX;
    for (let i = 0; i < widths.length - 1; i++) {
      currentX += widths[i];
      positions.push(currentX);
    }
    return positions;
  },

  /**
   * Extracts clean, formatted string cell values from raw database objects
   */
  getRowValues(row, type) {
    if (type === 'attendance') {
      const dateStr = new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      return [
        dateStr,
        row.status.toUpperCase(),
        row.check_in_time || '--',
        row.check_out_time || '--',
        row.working_hours !== null ? `${row.working_hours}h` : '--',
        row.remarks || row.leave_reason || 'None'
      ];
    }
    if (type === 'reports') {
      return [
        `W${row.week_number}`,
        row.date_range || 'N/A',
        row.hours_worked !== null ? `${row.hours_worked}h` : '0h',
        row.status.toUpperCase(),
        row.report_content ? row.report_content.replace(/\n/g, ' ').slice(0, 75) + '...' : ''
      ];
    }
    if (type === 'logs') {
      const dateStr = new Date(row.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      return [
        dateStr,
        `${row.hours_worked}h`,
        row.technology_used || '--',
        row.tasks_completed ? row.tasks_completed.replace(/\n/g, ' ').slice(0, 80) + '...' : ''
      ];
    }
    if (type === 'timeline') {
      const dateStr = new Date(row.event_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      return [
        dateStr,
        row.title,
        row.description || ''
      ];
    }
    if (type === 'documents') {
      const dateStr = new Date(row.uploaded_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      // Size formatting
      let sizeStr = '--';
      if (row.file_size) {
        sizeStr = row.file_size > 1024 * 1024 
          ? `${(row.file_size / (1024 * 1024)).toFixed(1)} MB` 
          : `${(row.file_size / 1024).toFixed(0)} KB`;
      }
      return [
        row.file_name,
        row.document_type.replace('_', ' ').toUpperCase(),
        sizeStr,
        dateStr
      ];
    }
    return [];
  }
};

module.exports = exportHelper;
