/**
 * Citizen Dashboard JavaScript
 * Handles data loading and interactions for citizen dashboard
 */

// ── Security helpers ──────────────────────────────────────────────────────────
function escapeHtml(value) {
  const str = String(value == null ? '' : value);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

// Only allow data: URIs for images (base64 from our own backend)
function sanitizeImageUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (s.startsWith('data:image/')) return s;
  if (s.startsWith('https://') || s.startsWith('http://')) return s;
  return null;
}
// ─────────────────────────────────────────────────────────────────────────────

const API_BASE = 'https://scrs-3rwc.onrender.com';
let currentPage = 1;
let totalPages = 1;
let allComplaints = [];

// Support both legacy and paginated backend response shapes.
function parseComplaintsResponse(data) {
    const complaints = data.complaints || data.data || [];
    const pagination = data.pagination || {};

    const current = Number(pagination.currentPage || pagination.page || 1);
    const perPage = Number(pagination.perPage || pagination.limit || complaints.length || 1);
    const total = Number(pagination.total || complaints.length || 0);
    const pages = Number(pagination.totalPages || 1);

    const from = total > 0
        ? Number(pagination.from || ((current - 1) * perPage + 1))
        : 0;
    const to = total > 0
        ? Number(pagination.to || Math.min(current * perPage, total))
        : 0;

    return {
        complaints,
        pagination: {
            currentPage: current,
            perPage,
            total,
            totalPages: pages,
            from,
            to
        }
    };
}

// Get auth token and headers
function getAuthHeaders() {
    const token = localStorage.getItem('token');
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// Load citizen stats from their complaints
async function loadCitizenStats() {
    try {
        const response = await fetch(`${API_BASE}/complaints/my?perPage=1000`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('HTTP ' + response.status);

        const data = await response.json();
        const parsed = parseComplaintsResponse(data);
        allComplaints = parsed.complaints;

        // Calculate stats
        const total = allComplaints.length;
        const pending = allComplaints.filter(c => c.status === 'Submitted' || c.status === 'In Progress').length;
        const critical = allComplaints.filter(c => c.priority === 'Critical').length;
        const resolved = allComplaints.filter(c => c.status === 'Resolved').length;

        // Update stats cards
        document.querySelector('[data-stat="total"]').textContent = total;
        document.querySelector('[data-stat="pending"]').textContent = pending;
        document.querySelector('[data-stat="critical"]').textContent = critical;
        document.querySelector('[data-stat="resolved"]').textContent = resolved;

        // Update transparency insight
        const transparencyEl = document.querySelector('[data-stat="transparency"]');
        if (transparencyEl) {
            transparencyEl.textContent = resolved;
        }
    } catch (error) {
        console.error('❌ Error loading citizen stats:', error);
    }
}

// Load complaints table with pagination
async function loadMyComplaints(page = 1) {
    try {
        currentPage = page;
        const response = await fetch(`${API_BASE}/complaints/my?page=${page}&perPage=5`, {
            headers: getAuthHeaders()
        });

        if (!response.ok) throw new Error('HTTP ' + response.status);

        const data = await response.json();
        const parsed = parseComplaintsResponse(data);
        const complaints = parsed.complaints;
        const pagination = parsed.pagination;
        totalPages = pagination.totalPages || 1;

        // Update table body
        const tbody = document.getElementById('reportsTableBody') || document.querySelector('tbody');
        if (complaints.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">You haven\'t registered any complaints yet</td></tr>';
            updatePaginationInfo(0, 0, 0, 0);
            renderPaginationButtons();
            return;
        }

        tbody.innerHTML = complaints.map(c => {
            const priorityColors = {
                'Critical': 'bg-red-600/20 text-red-400',
                'High': 'bg-orange-600/20 text-orange-400',
                'Medium': 'bg-yellow-600/20 text-yellow-400',
                'Low': 'bg-green-600/20 text-green-400'
            };

            const statusColors = {
                'Submitted': 'bg-blue-600/20 text-blue-400',
                'In Progress': 'bg-yellow-600/20 text-yellow-400',
                'Resolved': 'bg-green-600/20 text-green-400'
            };

            const createdDate = new Date(c.created_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });

            return `
                <tr class="hover:bg-slate-700 transition">
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">#${Number(c.id) || ''}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-300">${escapeHtml(c.category)}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${statusColors[c.status] || ''}">${escapeHtml(c.status)}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${priorityColors[c.priority] || ''}">${escapeHtml(c.priority)}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-400">${escapeHtml(createdDate)}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                        <button class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded text-xs font-semibold transition view-details-btn" data-complaint-id="${Number(c.id) || ''}">
                            View Details
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach event listeners to View Details buttons
        document.querySelectorAll('.view-details-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const complaintId = btn.getAttribute('data-complaint-id');
                openComplaintDetailsModal(complaintId);
            });
        });

        updatePaginationInfo(pagination.currentPage || 1, pagination.from || 0, pagination.to || 0, pagination.total || complaints.length);
        renderPaginationButtons();
    } catch (error) {
        console.error('❌ Error loading complaints:', error);
    }
}

// Update pagination info text
function updatePaginationInfo(page, from, to, total) {
    const infoText = document.getElementById('paginationInfo') || document.querySelector('.px-6.py-4.border-t p');
    if (infoText) {
        infoText.textContent = total > 0 ? `Showing ${from} to ${to} of ${total} complaints` : 'No complaints to display';
    }
}

// Render pagination buttons
function renderPaginationButtons() {
    const paginationContainer = document.getElementById('paginationButtons') || document.querySelector('.px-6.py-4.border-t .flex.space-x-2');
    if (!paginationContainer) return;

    let html = `
        <button onclick="changePage(${currentPage - 1})" class="px-3 py-1 bg-slate-700 text-gray-400 rounded hover:bg-slate-600 transition text-sm" ${currentPage === 1 ? 'disabled' : ''}>Previous</button>
    `;

    // Show page numbers (max 5)
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, startPage + 4);

    for (let i = startPage; i <= endPage; i++) {
        const activeClass = i === currentPage ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-gray-300';
        html += `<button onclick="changePage(${i})" class="px-3 py-1 ${activeClass} rounded hover:bg-slate-600 transition text-sm">${i}</button>`;
    }

    html += `
        <button onclick="changePage(${currentPage + 1})" class="px-3 py-1 bg-slate-700 text-gray-300 rounded hover:bg-slate-600 transition text-sm" ${currentPage === totalPages ? 'disabled' : ''}>Next</button>
    `;

    paginationContainer.innerHTML = html;
}

// Change page function (global for onclick)
function changePage(page) {
    if (page < 1 || page > totalPages) return;
    loadMyComplaints(page);
}

// Open complaint details modal
function openComplaintDetailsModal(complaintId) {
    // Find complaint in the loaded data
    const complaint = allComplaints.find(c => c.id == complaintId);
    
    if (!complaint) {
        alert('Complaint not found');
        return;
    }

    // Create modal HTML
    const modalHtml = `
        <div id="complaintModal" class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div class="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                
                <!-- Modal Header -->
                <div class="sticky top-0 bg-slate-800 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
                    <div>
                        <h2 class="text-2xl font-bold text-white">Complaint #${Number(complaint.id) || ''}</h2>
                        <p class="text-sm text-gray-400 mt-1">${escapeHtml(complaint.category)}</p>
                    </div>
                    <button onclick="closeComplaintModal()" class="text-gray-400 hover:text-white transition">
                        <i class="fas fa-times text-2xl"></i>
                    </button>
                </div>

                <!-- Modal Content -->
                <div class="px-6 py-4 space-y-4">
                    
                    <!-- Status & Priority -->
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <p class="text-xs text-gray-400 mb-1">Status</p>
                            <span class="px-2 py-1 text-xs font-semibold rounded-full bg-${complaint.status === 'Resolved' ? 'green' : complaint.status === 'In Progress' ? 'yellow' : 'blue'}-600/20 text-${complaint.status === 'Resolved' ? 'green' : complaint.status === 'In Progress' ? 'yellow' : 'blue'}-400">${escapeHtml(complaint.status)}</span>
                        </div>
                        <div>
                            <p class="text-xs text-gray-400 mb-1">Priority</p>
                            <span class="px-2 py-1 text-xs font-semibold rounded-full bg-${complaint.priority === 'Critical' ? 'red' : complaint.priority === 'High' ? 'orange' : complaint.priority === 'Medium' ? 'yellow' : 'green'}-600/20 text-${complaint.priority === 'Critical' ? 'red' : complaint.priority === 'High' ? 'orange' : complaint.priority === 'Medium' ? 'yellow' : 'green'}-400">${escapeHtml(complaint.priority)}</span>
                        </div>
                    </div>

                    <!-- Location -->
                    <div>
                        <p class="text-xs text-gray-400 mb-1">Location</p>
                        <p class="text-white">${escapeHtml(complaint.location)}</p>
                    </div>

                    <!-- Description -->
                    <div>
                        <p class="text-xs text-gray-400 mb-1">Description</p>
                        <p class="text-gray-300">${escapeHtml(complaint.description)}</p>
                    </div>

                    ${complaint.summary ? `
                    <!-- AI Summary -->
                    <div class="bg-indigo-600/10 border border-indigo-600/30 rounded-lg p-4">
                        <p class="text-xs text-indigo-400 mb-1 flex items-center">
                            <i class="fas fa-robot mr-2"></i>AI Summary
                        </p>
                        <p class="text-gray-300 text-sm">${escapeHtml(complaint.summary)}</p>
                    </div>
                    ` : ''}

                    <!-- Dates -->
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p class="text-xs text-gray-400 mb-1">Submitted</p>
                            <p class="text-gray-300">${new Date(complaint.created_at).toLocaleString()}</p>
                        </div>
                        ${complaint.resolved_at ? `
                        <div>
                            <p class="text-xs text-gray-400 mb-1">Resolved</p>
                            <p class="text-gray-300">${new Date(complaint.resolved_at).toLocaleString()}</p>
                        </div>
                        ` : ''}
                    </div>

                    ${complaint.assigned_admin_name ? `
                    <!-- Assigned Admin -->
                    <div>
                        <p class="text-xs text-gray-400 mb-1">Assigned To</p>
                        <p class="text-white">${escapeHtml(complaint.assigned_admin_name)}</p>
                    </div>
                    ` : ''}

                </div>

                <!-- Modal Footer -->
                <div class="px-6 py-4 border-t border-slate-700 flex justify-end">
                    <button onclick="closeComplaintModal()" class="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition">
                        Close
                    </button>
                </div>

            </div>
        </div>
    `;

    // Remove existing modal if any
    const existingModal = document.getElementById('complaintModal');
    if (existingModal) existingModal.remove();

    // Append modal to body
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// Close complaint modal
function closeComplaintModal() {
    const modal = document.getElementById('complaintModal');
    if (modal) modal.remove();
}

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!localStorage.getItem('token')) {
        window.location.href = 'login.html';
        return;
    }

    // Load dashboard data
    await loadCitizenStats();
    await loadMyComplaints(1);

    // Attach Register New Complaint button handler
    const registerBtn = document.querySelector('a[href*="complaint.html"]');
    if (registerBtn) {
        registerBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'complaint.html';
        });
    }
});
