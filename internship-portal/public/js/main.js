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
        alertDiv.className = 'alert alert-' + type + ' alert-dismissible fade show d-flex align-items-center justify-content-between';
        alertDiv.setAttribute('role', 'alert');

        var textSpan = document.createElement('span');
        textSpan.textContent = message;
        alertDiv.appendChild(textSpan);

        var closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'btn-close';
        closeBtn.setAttribute('data-bs-dismiss', 'alert');
        closeBtn.setAttribute('aria-label', 'Close');
        alertDiv.appendChild(closeBtn);

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

    // --- Student Portal Features ---
    async function initStudentPortal() {
        if (!window.location.pathname.includes('/student')) {
            return;
        }

        // 1. Sync Navbar Profile Info
        const syncNavbarProfile = async () => {
            try {
                const response = await fetch('/api/student/profile');
                if (response.ok) {
                    const data = await response.json();
                    if (data.success && data.student) {
                        const s = data.student;
                        const navName = document.getElementById('navUserName');
                        const navPhoto = document.getElementById('navUserPhoto');
                        if (navName) navName.textContent = s.first_name + ' ' + s.last_name;
                        if (navPhoto && s.profile_photo) {
                            navPhoto.src = s.profile_photo;
                        }
                    }
                }
            } catch (err) {
                console.error('Error syncing navbar profile:', err);
            }
        };

        // 2. Notification Center Sync
        const syncNotifications = async () => {
            try {
                const response = await fetch('/api/student/notifications');
                if (!response.ok) return;
                const data = await response.json();
                if (!data.success) return;

                const notifDropdown = document.querySelector('.top-navbar .dropdown');
                if (!notifDropdown) return;

                const badge = notifDropdown.querySelector('.badge');
                if (badge) {
                    if (data.unreadCount > 0) {
                        badge.style.display = 'inline-block';
                        badge.textContent = data.unreadCount;
                    } else {
                        badge.style.display = 'none';
                    }
                }

                const menu = notifDropdown.querySelector('.dropdown-menu');
                if (menu) {
                    menu.innerHTML = '';
                    
                    const header = document.createElement('li');
                    header.innerHTML = '<h6 class="dropdown-header d-flex justify-content-between align-items-center"><span>Notifications</span> <button class="btn btn-link p-0 text-primary small text-decoration-none fw-normal" id="markAllReadBtn" style="font-size: 11px;">Mark all read</button></h6>';
                    menu.appendChild(header);

                    if (data.notifications.length === 0) {
                        const empty = document.createElement('li');
                        empty.innerHTML = '<div class="text-center text-muted py-3 small">No notifications yet</div>';
                        menu.appendChild(empty);
                    } else {
                        data.notifications.forEach(notif => {
                            const li = document.createElement('li');
                            li.className = 'p-1';
                            
                            let iconClass = 'bi-bell-fill text-primary';
                            let bgClass = 'bg-primary';
                            if (notif.event_type === 'attendance') {
                                iconClass = 'bi-calendar-check-fill text-success';
                                bgClass = 'bg-success';
                            } else if (notif.event_type === 'weekly_reports') {
                                iconClass = 'bi-journal-check text-info';
                                bgClass = 'bg-info';
                            } else if (notif.event_type === 'offer_letter') {
                                iconClass = 'bi-file-earmark-arrow-up-fill text-warning';
                                bgClass = 'bg-warning';
                            }

                            const notifDate = formatDate(notif.event_date || notif.created_at);

                            li.innerHTML = `
                                <div class="d-flex align-items-start gap-2 rounded-2 p-2 dropdown-item text-wrap ${!notif.is_read ? 'bg-light' : ''}" style="width: 280px; white-space: normal;">
                                    <div class="${bgClass} bg-opacity-10 p-2 rounded-circle d-flex align-items-center justify-content-center" style="width: 32px; height: 32px; min-width: 32px; color: var(--bs-${bgClass.split('-')[1] || 'primary'});">
                                        <i class="bi ${iconClass}" style="font-size: 14px;"></i>
                                    </div>
                                    <div class="flex-grow-1">
                                        <div class="fw-semibold small d-flex justify-content-between align-items-center">
                                            <span>${notif.title}</span>
                                            ${!notif.is_read ? '<span class="badge bg-danger rounded-circle p-1" style="width: 6px; height: 6px;"><span class="visually-hidden">New</span></span>' : ''}
                                        </div>
                                        <div class="text-muted small" style="font-size: 11px;">${notif.description || ''}</div>
                                        <div class="text-muted" style="font-size: 9px; margin-top: 2px;">${notifDate}</div>
                                    </div>
                                </div>
                            `;
                            menu.appendChild(li);
                        });
                    }

                    const markReadBtn = menu.querySelector('#markAllReadBtn');
                    if (markReadBtn) {
                        markReadBtn.addEventListener('click', async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            try {
                                const res = await fetch('/api/student/notifications/read', { method: 'POST' });
                                if (res.ok) {
                                    await syncNotifications();
                                    showAlert('All notifications marked as read.', 'success');
                                }
                            } catch (err) {
                                console.error('Error marking notifications as read:', err);
                            }
                        });
                    }
                }
            } catch (err) {
                console.error('Error syncing notifications:', err);
            }
        };

        // 3. Global Search Button & Modal Integration
        const initGlobalSearch = () => {
            const navHeader = document.querySelector('.top-navbar .d-flex.align-items-center.gap-3');
            if (!navHeader) return;

            if (document.getElementById('navbarSearchBtn')) return;

            const searchBtn = document.createElement('button');
            searchBtn.className = 'btn btn-light rounded-circle p-2 me-1';
            searchBtn.type = 'button';
            searchBtn.id = 'navbarSearchBtn';
            searchBtn.setAttribute('aria-label', 'Search');
            searchBtn.innerHTML = '<i class="bi bi-search"></i>';
            navHeader.insertBefore(searchBtn, navHeader.firstChild);

            if (!document.getElementById('globalSearchModal')) {
                const modalDiv = document.createElement('div');
                modalDiv.className = 'modal fade';
                modalDiv.id = 'globalSearchModal';
                modalDiv.tabIndex = -1;
                modalDiv.setAttribute('aria-labelledby', 'globalSearchModalLabel');
                modalDiv.setAttribute('aria-hidden', 'true');
                modalDiv.innerHTML = `
                    <div class="modal-dialog modal-lg modal-dialog-scrollable">
                        <div class="modal-content rounded-4 border-0 shadow">
                            <div class="modal-header border-0 pb-0 pt-3 px-3">
                                <div class="input-group rounded-3 border ps-2" style="background: #f8fafc;">
                                    <span class="input-group-text bg-transparent border-0"><i class="bi bi-search text-muted"></i></span>
                                    <input type="text" class="form-control bg-transparent border-0 py-2" id="modalSearchInput" placeholder="Type keyword to search across attendance, logs, reports, documents, timeline..." autofocus>
                                    <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="modal" aria-label="Close"></button>
                                </div>
                            </div>
                            <div class="modal-body px-3 py-4" id="modalSearchResults" style="max-height: 70vh;">
                                <div class="text-center text-muted py-5">
                                    <i class="bi bi-search-heart d-block mb-2 text-primary" style="font-size: 40px;"></i>
                                    <p class="mb-0">Search across your entire academic ERP records</p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                document.body.appendChild(modalDiv);

                const searchModal = new bootstrap.Modal(modalDiv);
                searchBtn.addEventListener('click', () => searchModal.show());

                modalDiv.addEventListener('shown.bs.modal', () => {
                    document.getElementById('modalSearchInput').focus();
                });

                const searchInput = modalDiv.querySelector('#modalSearchInput');
                const resultsContainer = modalDiv.querySelector('#modalSearchResults');

                const performSearch = async () => {
                    const query = searchInput.value.trim();
                    if (query.length < 2) {
                        resultsContainer.innerHTML = `
                            <div class="text-center text-muted py-5">
                                <i class="bi bi-search d-block mb-2 text-muted" style="font-size: 40px;"></i>
                                <p class="mb-0">Type at least 2 characters to search...</p>
                            </div>
                        `;
                        return;
                    }

                    resultsContainer.innerHTML = `
                        <div class="d-flex justify-content-center py-5">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Searching...</span>
                            </div>
                        </div>
                    `;

                    try {
                        const response = await fetch(`/api/student/search?q=${encodeURIComponent(query)}`);
                        if (response.ok) {
                            const data = await response.json();
                            if (data.success && data.results) {
                                renderSearchResults(data.results, query);
                            }
                        }
                    } catch (err) {
                        console.error('Error during global search:', err);
                        resultsContainer.innerHTML = '<div class="alert alert-danger">Error fetching search results.</div>';
                    }
                };

                searchInput.addEventListener('input', debounce(performSearch, 300));
            }
        };

        const renderSearchResults = (results, query) => {
            const container = document.getElementById('modalSearchResults');
            container.innerHTML = '';

            const { attendance, logs, reports, documents, timeline } = results;
            const totalCount = attendance.length + logs.length + reports.length + documents.length + timeline.length;

            if (totalCount === 0) {
                container.innerHTML = `
                    <div class="text-center text-muted py-5">
                        <i class="bi bi-exclamation-circle d-block mb-2 text-warning" style="font-size: 40px;"></i>
                        <p class="mb-0 fw-semibold text-dark">No matching records found for "${query}"</p>
                        <p class="small text-muted mt-1">Try another keyword or date</p>
                    </div>
                `;
                return;
            }

            const highlightText = (text, q) => {
                if (!text) return '';
                const str = String(text);
                const idx = str.toLowerCase().indexOf(q.toLowerCase());
                if (idx === -1) return str;
                return str.substring(0, idx) + 
                       `<mark class="p-0 bg-warning bg-opacity-30 fw-bold">${str.substring(idx, idx + q.length)}</mark>` + 
                       str.substring(idx + q.length);
            };

            const blocks = [];

            if (attendance.length > 0) {
                let items = attendance.map(item => {
                    return `
                        <a href="/student/attendance" class="list-group-item list-group-item-action border-0 py-2 px-3 rounded-3 mb-1">
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="fw-semibold small text-dark"><i class="bi bi-calendar-check me-2 text-success"></i>Attendance: ${formatDate(item.date)}</span>
                                <span class="badge bg-${item.status === 'present' ? 'success' : 'warning'} bg-opacity-10 text-${item.status === 'present' ? 'success' : 'warning'} small">${item.status.toUpperCase()}</span>
                            </div>
                            <div class="text-muted small mt-1 ps-4" style="font-size: 11px;">
                                <strong>Location:</strong> ${highlightText(item.location || 'Remote', query)} | 
                                <strong>Remarks:</strong> ${highlightText(item.remarks || item.leave_reason || 'None', query)}
                            </div>
                        </a>
                    `;
                }).join('');
                blocks.push(`<div class="mb-3"><h6 class="fw-bold text-muted small px-2 mb-2">ATTENDANCE (${attendance.length})</h6><div class="list-group">${items}</div></div>`);
            }

            if (logs.length > 0) {
                let items = logs.map(item => {
                    return `
                        <a href="/student/attendance" class="list-group-item list-group-item-action border-0 py-2 px-3 rounded-3 mb-1">
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="fw-semibold small text-dark"><i class="bi bi-clock-history me-2 text-primary"></i>Daily Log: ${formatDate(item.date)} (${item.hours_worked}h)</span>
                                <span class="badge bg-secondary bg-opacity-10 text-secondary small">${highlightText(item.technology_used || 'General', query)}</span>
                            </div>
                            <div class="text-muted small mt-1 ps-4" style="font-size: 11px;">
                                <strong>Tasks:</strong> ${highlightText(item.tasks_completed, query)}
                            </div>
                        </a>
                    `;
                }).join('');
                blocks.push(`<div class="mb-3"><h6 class="fw-bold text-muted small px-2 mb-2">DAILY WORK LOGS (${logs.length})</h6><div class="list-group">${items}</div></div>`);
            }

            if (reports.length > 0) {
                let items = reports.map(item => {
                    return `
                        <a href="/student/reports" class="list-group-item list-group-item-action border-0 py-2 px-3 rounded-3 mb-1">
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="fw-semibold small text-dark"><i class="bi bi-journal-text me-2 text-info"></i>Weekly Report: Week ${item.week_number}</span>
                                <span class="badge bg-${item.status === 'approved' ? 'success' : (item.status === 'submitted' ? 'info' : 'secondary')} bg-opacity-10 text-${item.status === 'approved' ? 'success' : (item.status === 'submitted' ? 'info' : 'secondary')} small">${item.status.toUpperCase()}</span>
                            </div>
                            <div class="text-muted small mt-1 ps-4" style="font-size: 11px;">
                                <strong>Content:</strong> ${highlightText(item.report_content, query)}
                            </div>
                        </a>
                    `;
                }).join('');
                blocks.push(`<div class="mb-3"><h6 class="fw-bold text-muted small px-2 mb-2">WEEKLY REPORTS (${reports.length})</h6><div class="list-group">${items}</div></div>`);
            }

            if (documents.length > 0) {
                let items = documents.map(item => {
                    return `
                        <a href="/student/documents" class="list-group-item list-group-item-action border-0 py-2 px-3 rounded-3 mb-1">
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="fw-semibold small text-dark"><i class="bi bi-file-earmark-check me-2 text-purple"></i>${highlightText(item.file_name, query)}</span>
                                <span class="badge bg-light text-dark border small">${item.document_type.replace('_', ' ').toUpperCase()}</span>
                            </div>
                        </a>
                    `;
                }).join('');
                blocks.push(`<div class="mb-3"><h6 class="fw-bold text-muted small px-2 mb-2">COMPLIANCE DOCUMENTS (${documents.length})</h6><div class="list-group">${items}</div></div>`);
            }

            if (timeline.length > 0) {
                let items = timeline.map(item => {
                    return `
                        <div class="list-group-item border-0 py-2 px-3 rounded-3 mb-1 bg-light">
                            <div class="d-flex justify-content-between align-items-center">
                                <span class="fw-semibold small text-dark"><i class="bi bi-hourglass-split me-2 text-warning"></i>Milestone: ${highlightText(item.title, query)}</span>
                                <span class="text-muted small" style="font-size: 11px;">${formatDate(item.event_date)}</span>
                            </div>
                            <div class="text-muted small mt-1 ps-4" style="font-size: 11px;">
                                ${highlightText(item.description || '', query)}
                            </div>
                        </div>
                    `;
                }).join('');
                blocks.push(`<div class="mb-3"><h6 class="fw-bold text-muted small px-2 mb-2">PLACEMENT MILESTONES (${timeline.length})</h6><div class="list-group">${items}</div></div>`);
            }

            container.innerHTML = blocks.join('');
        };

        await syncNavbarProfile();
        await syncNotifications();
        initGlobalSearch();

        setInterval(syncNotifications, 30000);
    }

    // --- DOM Ready ---
    document.addEventListener('DOMContentLoaded', function () {
        // Initialize tooltips
        initTooltips();

        // Initialize Student Portal Navbar Features if applicable
        initStudentPortal();

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
        initTooltips: initTooltips,
        initStudentPortal: initStudentPortal
    };
})();
