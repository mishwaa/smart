/**
 * Smart University Internship Portal
 * Main JavaScript Utilities
 */
(function () {
    'use strict';

    /**
     * Toggle the sidebar visibility (mobile).
     */
    function toggleSidebar() {
        var sidebar = document.querySelector('.sidebar');
        if (sidebar) {
            sidebar.classList.toggle('show');
        }
    }

    /**
     * Show a Bootstrap-style alert message.
     * @param {string} message - The alert message text.
     * @param {string} [type='success'] - The Bootstrap alert type (success, danger, warning, info).
     */
    function showAlert(message, type) {
        if (typeof type === 'undefined') {
            type = 'success';
        }

        var alertDiv = document.createElement('div');
        alertDiv.className = 'alert alert-' + type + ' alert-dismissible fade show';
        alertDiv.setAttribute('role', 'alert');
        alertDiv.innerHTML =
            message +
            '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>';

        var container = document.querySelector('.content-area') || document.querySelector('.main-content');
        if (container) {
            container.prepend(alertDiv);
        }

        setTimeout(function () {
            alertDiv.classList.remove('show');
            alertDiv.classList.add('fade');
            setTimeout(function () {
                if (alertDiv.parentNode) {
                    alertDiv.parentNode.removeChild(alertDiv);
                }
            }, 300);
        }, 5000);
    }

    /**
     * Show a native confirmation dialog wrapped in a Promise.
     * @param {string} message - The confirmation message.
     * @returns {Promise<boolean>}
     */
    function confirmAction(message) {
        return new Promise(function (resolve) {
            var result = confirm(message);
            resolve(result);
        });
    }

    /**
     * Format a date string to 'DD MMM YYYY'.
     * @param {string} dateString - A parsable date string.
     * @returns {string}
     */
    function formatDate(dateString) {
        var date = new Date(dateString);
        return date.toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }

    /**
     * Standard debounce utility.
     * @param {Function} func - The function to debounce.
     * @param {number} [wait=300] - Delay in milliseconds.
     * @returns {Function}
     */
    function debounce(func, wait) {
        if (typeof wait === 'undefined') {
            wait = 300;
        }
        var timeout;
        return function () {
            var context = this;
            var args = arguments;
            clearTimeout(timeout);
            timeout = setTimeout(function () {
                func.apply(context, args);
            }, wait);
        };
    }

    /**
     * Initialize all Bootstrap tooltips on the page.
     */
    function initTooltips() {
        var tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
        tooltipTriggerList.forEach(function (tooltipTriggerEl) {
            new bootstrap.Tooltip(tooltipTriggerEl);
        });
    }

    // --- DOM Ready ---
    document.addEventListener('DOMContentLoaded', function () {
        // Initialize tooltips
        initTooltips();

        // Sidebar toggle button
        var toggleBtn = document.querySelector('.btn-sidebar-toggle');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', function () {
                toggleSidebar();
            });
        }

        // Sidebar overlay click to close
        var overlay = document.querySelector('.sidebar-overlay');
        if (overlay) {
            overlay.addEventListener('click', function () {
                var sidebar = document.querySelector('.sidebar');
                if (sidebar) {
                    sidebar.classList.remove('show');
                }
            });
        }
    });

    // Expose utilities globally
    window.PortalUtils = {
        toggleSidebar: toggleSidebar,
        showAlert: showAlert,
        confirmAction: confirmAction,
        formatDate: formatDate,
        debounce: debounce,
        initTooltips: initTooltips
    };
})();
