const API_BASE = 'https://scrs-3rwc.onrender.com';
let currentComplaintId = null;
let adminsList = [];

// Pagination state
let currentPage = 1;
let totalPages = 1;
let totalItems = 0;
const perPage = 20;

// Auto-refresh state
let refreshInterval = null;
let lastRefreshTime = Date.now();
let isAutoRefreshEnabled = true;
let isModalOpen = false;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safePriorityClass(value) {
  const normalized = String(value || 'Medium').toLowerCase();
  return ['low', 'medium', 'high', 'critical'].includes(normalized) ? normalized : 'medium';
}

// Initialize page
document.addEventListener('DOMContentLoaded', () => {
  const auth = requireAuth(['authority']);
  if (auth) {
    loadDashboard();
    loadComplaints();
    loadAdmins();
    loadAdminPerformanceTable();
    loadEscalationLog();
    
    // Start auto-refresh after initial load
    setTimeout(() => {
      startAutoRefresh();
      updateLastRefreshLabel();
    }, 1000);
  }
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    stopAutoRefresh();
  } else {
    if (isAutoRefreshEnabled) {
      startAutoRefresh();
    }
  }
});

// =================== AUTO-REFRESH FUNCTIONALITY ===================
function startAutoRefresh() {
  if (refreshInterval) return; // Already running
  
  refreshInterval = setInterval(async () => {
    if (isModalOpen) return; // Don't refresh while modal is open
    
    try {
      await loadDashboard();
      await loadComplaints(currentPage); // Maintain current page
      await loadAdminPerformanceTable();
      await loadEscalationLog();
      lastRefreshTime = Date.now();
    } catch (error) {
      console.warn('Auto-refresh failed:', error);
      // Silent failure - don't show notification
    }
  }, 30000); // 30 seconds
  
  console.log('✅ Auto-refresh enabled (30s interval)');
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
    console.log('⏸️  Auto-refresh paused');
  }
}

function toggleAutoRefresh() {
  isAutoRefreshEnabled = !isAutoRefreshEnabled;
  
  const toggleBtn = document.getElementById('autoRefreshToggle');
  const toggleText = document.getElementById('autoRefreshText');
  
  if (isAutoRefreshEnabled) {
    startAutoRefresh();
    toggleBtn?.classList.add('active');
    if (toggleText) toggleText.textContent = '✅ Enabled';
  } else {
    stopAutoRefresh();
    toggleBtn?.classList.remove('active');
    if (toggleText) toggleText.textContent = '❌ Disabled';
  }
  
  // Save preference
  localStorage.setItem('autoRefreshEnabled', isAutoRefreshEnabled);
}

function updateLastRefreshLabel() {
  const updateLabel = () => {
    const secondsAgo = Math.floor((Date.now() - lastRefreshTime) / 1000);
    const label = document.getElementById('lastRefreshLabel');
    if (label) {
      if (secondsAgo < 60) {
        label.textContent = `Updated ${secondsAgo}s ago`;
      } else {
        const minutesAgo = Math.floor(secondsAgo / 60);
        label.textContent = `Updated ${minutesAgo}m ago`;
      }
    }
  };
  
  updateLabel();
  setInterval(updateLabel, 1000); // Update every second
}

// =================== DASHBOARD STATISTICS ===================
async function loadDashboard() {
  try {
    const response = await fetch(`${API_BASE}/authority/dashboard`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);

    const data = await response.json();
    const dashboard = data.dashboard;

    const metricTotal = document.getElementById('metricTotal');
    const metricCritical = document.getElementById('metricCritical');
    const metricEscalated = document.getElementById('metricEscalated');
    const metricPending = document.getElementById('metricPending');
    const metricResolutionRate = document.getElementById('metricResolutionRate');
    const metricAvgTime = document.getElementById('metricAvgTime');

    if (metricTotal) metricTotal.textContent = dashboard.total_complaints || 0;
    if (metricCritical) metricCritical.textContent = dashboard.critical_count || 0;
    if (metricEscalated) metricEscalated.textContent = dashboard.escalation_count || 0;
    if (metricPending) metricPending.textContent = dashboard.pending_count || 0;
    if (metricResolutionRate) metricResolutionRate.textContent = dashboard.resolution_rate ? dashboard.resolution_rate.toFixed(1) + '%' : '-';
    if (metricAvgTime) metricAvgTime.textContent = dashboard.average_resolution_hours
      ? dashboard.average_resolution_hours.toFixed(1) + 'h'
      : '—';
    
    // Load all charts
    loadMonthlyTrends();
    loadCategoryChart();
    loadAdminPerformanceChart();
    loadLocationChart();
  } catch (error) {
    console.error('❌ Error loading dashboard:', error);
    notifications.error('Failed to load dashboard statistics');
  }
}

// =================== COMPLAINTS MANAGEMENT ===================
async function loadComplaints(page = 1) {
  const tbody = document.getElementById('complaintTableBody');
  tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-8 text-center text-gray-500">Loading...</td></tr>';

  try {
    const status = document.getElementById('statusFilter').value;
    const priority = document.getElementById('priorityFilter').value;
    const category = document.getElementById('categoryFilter').value;
    const location = document.getElementById('locationFilter').value;

    let url = `${API_BASE}/authority/complaints`;
    const params = [`page=${page}`, `perPage=${perPage}`];
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (priority) params.push(`priority=${encodeURIComponent(priority)}`);
    if (category) params.push(`category=${encodeURIComponent(category)}`);
    if (location) params.push(`location=${encodeURIComponent(location)}`);
    url += '?' + params.join('&');

    const response = await fetch(url, {
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);

    const data = await response.json();
    const complaints = data.complaints || [];
    
    // Update pagination state
    if (data.pagination) {
      currentPage = data.pagination.page;
      totalPages = data.pagination.totalPages;
      totalItems = data.pagination.total;
      renderPaginationControls();
    }

    tbody.innerHTML = '';
    if (complaints.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-8 text-center text-gray-500">No complaints found</td></tr>';
      return;
    }

    complaints.forEach(complaint => {
      const row = document.createElement('tr');
      const displayId = complaint.complaint_id || `COMP-${complaint.id.toString().padStart(4, '0')}`;
      const adminName = complaint.assigned_admin_name || (complaint.assigned_admin_id ? 'Assigned' : '❌ Unassigned');
      const createdDate = new Date(complaint.created_at).toLocaleDateString();

      // Priority icons
      const priorityIcons = {
        'Low': '🟢',
        'Medium': '🟡',
        'High': '🟠',
        'Critical': '🔴'
      };
      const priorityIcon = priorityIcons[complaint.priority] || '⚪';

      // Image indicator
      const imageIndicator = complaint.image_url ? ' 📷' : '';

      const calculateSLA = (createdDate) => {
        const now = new Date();
        const daysOld = Math.floor((now - new Date(createdDate)) / (1000 * 60 * 60 * 24));
        if (daysOld > 7) return '<span class="sla-critical">>' + daysOld + 'd</span>';
        if (daysOld > 3) return '<span class="sla-warning">' + daysOld + 'd</span>';
        return '<span class="sla-safe"><' + daysOld + 'd</span>';
      };

      row.innerHTML = `
        <td class="px-6 py-4"><strong class="text-indigo-400">${escapeHtml(displayId + imageIndicator)}</strong></td>
        <td class="px-6 py-4">${escapeHtml(complaint.category || 'N/A')}</td>
        <td class="px-6 py-4">${escapeHtml(complaint.location || 'N/A')}</td>
        <td class="px-6 py-4"><span class="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold priority-${safePriorityClass(complaint.priority)} text-white">${priorityIcon} ${escapeHtml(complaint.priority || 'Medium')}</span></td>
        <td class="px-6 py-4 text-sm">${escapeHtml(complaint.status || 'Submitted')}</td>
        <td class="px-6 py-4 text-sm">${escapeHtml(adminName)}</td>
        <td class="px-6 py-4 text-sm">${calculateSLA(complaint.created_at)}</td>
        <td class="px-6 py-4 text-center">
          <div class="flex gap-2 justify-center flex-wrap">
            <button onclick="openAssignModal(${complaint.id})" class="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs rounded transition">👤</button>
            <button onclick="openPriorityModal(${complaint.id}, '${escapeHtml(complaint.ai_suggested_priority || 'Medium')}')" class="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded transition">⚡</button>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  } catch (error) {
    console.error('❌ Error loading complaints:', error);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" class="px-6 py-8 text-center">
          <div class="text-gray-500">Error loading complaints. Please try refreshing the page.</div>
        </td>
      </tr>
    `;
    notifications.error('Failed to load complaints');
  }
}

// =================== PAGINATION CONTROLS ===================
function renderPaginationControls() {
  const container = document.getElementById('paginationControls');
  if (!container) return;

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * perPage + 1;
  const endItem = Math.min(currentPage * perPage, totalItems);

  let html = `
    <div class="pagination-wrapper">
      <div class="pagination-info">
        Showing ${startItem}-${endItem} of ${totalItems} complaints
      </div>
      <div class="pagination-buttons">
        <button 
          onclick="loadComplaints(${currentPage - 1})" 
          class="pagination-btn"
          ${currentPage === 1 ? 'disabled' : ''}
        >
          ← Previous
        </button>
  `;

  // Page numbers
  const maxPagesToShow = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
  
  if (endPage - startPage < maxPagesToShow - 1) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }

  if (startPage > 1) {
    html += `<button onclick="loadComplaints(1)" class="pagination-btn">1</button>`;
    if (startPage > 2) html += `<span class="pagination-ellipsis">...</span>`;
  }

  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button 
        onclick="loadComplaints(${i})" 
        class="pagination-btn ${i === currentPage ? 'active' : ''}"
      >
        ${i}
      </button>
    `;
  }

  if (endPage < totalPages) {
    if (endPage < totalPages - 1) html += `<span class="pagination-ellipsis">...</span>`;
    html += `<button onclick="loadComplaints(${totalPages})" class="pagination-btn">${totalPages}</button>`;
  }

  html += `
        <button 
          onclick="loadComplaints(${currentPage + 1})" 
          class="pagination-btn"
          ${currentPage === totalPages ? 'disabled' : ''}
        >
          Next →
        </button>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function clearFilters() {
  document.getElementById('statusFilter').value = '';
  document.getElementById('priorityFilter').value = '';
  document.getElementById('categoryFilter').value = '';
  document.getElementById('locationFilter').value = '';
  currentPage = 1;
  loadComplaints(1);
}

// =================== ADMIN PERFORMANCE TABLE ===================
async function loadAdminPerformanceTable() {
  const tbody = document.getElementById('adminTableBody');
  
  try {
    const response = await fetch(`${API_BASE}/authority/admin-performance`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);

    const data = await response.json();
    const admins = data.admins || [];

    if (admins.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">No admin data available yet</td></tr>';
      return;
    }

    tbody.innerHTML = admins.map(admin => {
      const perfScore = admin.performance_score || 0;
      let perfClass = 'perf-poor';
      if (perfScore >= 80) perfClass = 'perf-excellent';
      else if (perfScore >= 50) perfClass = 'perf-good';

      return `
        <tr class="bg-slate-800 hover:bg-slate-700 transition">
          <td class="px-6 py-4 font-medium text-white">${escapeHtml(admin.admin_name || 'Unknown')}</td>
          <td class="px-6 py-4 text-sm">${admin.total_assigned || 0}</td>
          <td class="px-6 py-4 text-sm text-green-400">${admin.resolved_count || 0}</td>
          <td class="px-6 py-4 text-sm text-yellow-400">${admin.pending_count || 0}</td>
          <td class="px-6 py-4 text-sm text-blue-400">${admin.avg_resolution_time ? admin.avg_resolution_time.toFixed(1) + 'h' : '—'}</td>
          <td class="px-6 py-4 text-sm"><span class="${perfClass} font-semibold">${perfScore.toFixed(1)}%</span></td>
        </tr>
      `;
    }).join('');
  } catch (error) {
    console.error('❌ Error loading admin performance table:', error);
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-gray-500">Error loading data</td></tr>';
  }
}

// =================== ESCALATION LOG ===================
async function loadEscalationLog() {
  const container = document.getElementById('escalationLog');
  
  try {
    const response = await fetch(`${API_BASE}/authority/escalations`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);

    const data = await response.json();
    const escalations = data.escalations || [];

    if (escalations.length === 0) {
      container.innerHTML = '<li class="text-gray-500 text-sm py-4">No recent escalations</li>';
      return;
    }

    container.innerHTML = escalations.slice(0, 5).map(escalation => {
      const date = new Date(escalation.created_at).toLocaleDateString();
      return `
        <li class="border-b border-slate-700 pb-3 last:border-b-0">
          <div class="flex items-start justify-between gap-2">
            <div class="flex-1">
              <p class="text-sm text-gray-300"><strong>Complaint #${escapeHtml(escalation.complaint_id)}</strong> escalated to <span class="text-red-400 font-semibold">${escapeHtml(escalation.new_priority)}</span></p>
              <p class="text-xs text-gray-500 mt-1">${date}</p>
            </div>
            <span class="text-lg">⚠️</span>
          </div>
        </li>
      `;
    }).join('');
  } catch (error) {
    console.error('❌ Error loading escalation log:', error);
    container.innerHTML = '<li class="text-gray-500 text-sm py-4">Error loading escalations</li>';
  }
}

// =================== MONTHLY TRENDS ===================
let trendsChartInstance = null;
let categoryChartInstance = null;
let adminChartInstance = null;
let locationChartInstance = null;

async function loadMonthlyTrends() {
  const canvas = document.getElementById('monthlyTrendChart');
  if (!canvas) return;

  try {
    const response = await fetch(`${API_BASE}/authority/monthly-trends`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);

    const data = await response.json();
    const trends = data.trends || [];

    if (trends.length === 0) return;

    const labels = trends.map(t => t.month);
    const submittedData = trends.map(t => t.submitted || 0);
    const inProgressData = trends.map(t => t.in_progress || 0);
    const resolvedData = trends.map(t => t.resolved || 0);

    if (trendsChartInstance) trendsChartInstance.destroy();

    const ctx = canvas.getContext('2d');
    trendsChartInstance = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Submitted',
            data: submittedData,
            borderColor: 'rgba(251, 191, 36, 1)',
            backgroundColor: 'rgba(251, 191, 36, 0.1)',
            tension: 0.4
          },
          {
            label: 'In Progress',
            data: inProgressData,
            borderColor: 'rgba(59, 130, 246, 1)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            tension: 0.4
          },
          {
            label: 'Resolved',
            data: resolvedData,
            borderColor: 'rgba(34, 197, 94, 1)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            labels: { color: '#d1d5db', font: { size: 12 } }
          }
        },
        scales: {
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af' }
          },
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af' }
          }
        }
      }
    });
  } catch (error) {
    console.error('❌ Error loading monthly trends:', error);
  }
}

async function loadCategoryChart() {
  const canvas = document.getElementById('categoryChart');
  if (!canvas) return;

  try {
    const response = await fetch(`${API_BASE}/authority/category-distribution`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);

    const data = await response.json();
    const categories = data.categories || [];

    if (categories.length === 0) return;

    if (categoryChartInstance) categoryChartInstance.destroy();

    const ctx = canvas.getContext('2d');
    categoryChartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: categories.map(c => c.name),
        datasets: [{
          data: categories.map(c => c.count),
          backgroundColor: [
            'rgba(239, 68, 68, 0.8)',
            'rgba(249, 115, 22, 0.8)',
            'rgba(251, 191, 36, 0.8)',
            'rgba(59, 130, 246, 0.8)',
            'rgba(139, 92, 246, 0.8)',
            'rgba(34, 197, 94, 0.8)'
          ]
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            labels: { color: '#d1d5db', font: { size: 12 } }
          }
        }
      }
    });
  } catch (error) {
    console.error('❌ Error loading category chart:', error);
  }
}

async function loadAdminPerformanceChart() {
  const canvas = document.getElementById('adminPerformanceChart');
  if (!canvas) return;

  try {
    const response = await fetch(`${API_BASE}/authority/admin-performance`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);

    const data = await response.json();
    const admins = (data.admins || []).slice(0, 5);

    if (admins.length === 0) return;

    if (adminChartInstance) adminChartInstance.destroy();

    const ctx = canvas.getContext('2d');
    adminChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: admins.map(a => a.admin_name),
        datasets: [
          {
            label: 'Resolved',
            data: admins.map(a => a.resolved_count),
            backgroundColor: 'rgba(34, 197, 94, 0.8)'
          },
          {
            label: 'Pending',
            data: admins.map(a => a.pending_count),
            backgroundColor: 'rgba(251, 191, 36, 0.8)'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        indexAxis: 'y',
        plugins: {
          legend: {
            labels: { color: '#d1d5db', font: { size: 12 } }
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af' }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af' }
          }
        }
      }
    });
  } catch (error) {
    console.error('❌ Error loading admin performance chart:', error);
  }
}

async function loadLocationChart() {
  const canvas = document.getElementById('locationChart');
  if (!canvas) return;

  try {
    const response = await fetch(`${API_BASE}/authority/location-distribution`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);

    const data = await response.json();
    const locations = (data.locations || []).slice(0, 8);

    if (locations.length === 0) return;

    if (locationChartInstance) locationChartInstance.destroy();

    const ctx = canvas.getContext('2d');
    locationChartInstance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: locations.map(l => l.name),
        datasets: [{
          label: 'Complaints',
          data: locations.map(l => l.count),
          backgroundColor: 'rgba(99, 102, 241, 0.8)'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            labels: { color: '#d1d5db', font: { size: 12 } }
          }
        },
        scales: {
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af' }
          },
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#9ca3af' }
          }
        }
      }
    });
  } catch (error) {
    console.error('❌ Error loading location chart:', error);
  }
}

// =================== ADMIN LIST (for assign modal) ===================
async function loadAdmins() {
  try {
    const response = await fetch(`${API_BASE}/authority/admins`, {
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);

    const data = await response.json();
    adminsList = data.admins || [];
  } catch (error) {
    console.error('❌ Error loading admins:', error);
    adminsList = [];
  }
}

// =================== MODAL FUNCTIONS - ASSIGN ===================
function openAssignModal(complaintId) {
  isModalOpen = true;
  currentComplaintId = complaintId;
  document.getElementById('assignComplaintId').textContent = `COMP-${complaintId.toString().padStart(4, '0')}`;

  const adminSelect = document.getElementById('adminSelect');
  if (!adminsList || adminsList.length === 0) {
    adminSelect.innerHTML = '<option value="">Loading admins...</option>';
    loadAdmins().then(() => {
      if (!adminsList || adminsList.length === 0) {
        adminSelect.innerHTML = '<option value="">No admins available</option>';
        return;
      }

      adminSelect.innerHTML = '<option value="">Select an admin</option>' +
        adminsList.map(a => `<option value="${Number(a.id) || ''}">${escapeHtml(a.name)} (${escapeHtml(a.email)})</option>`).join('');
    });
  } else {
    adminSelect.innerHTML = '<option value="">Select an admin</option>' +
      adminsList.map(a => `<option value="${Number(a.id) || ''}">${escapeHtml(a.name)} (${escapeHtml(a.email)})</option>`).join('');
  }

  document.getElementById('assignModal').classList.remove('hidden');
}

function closeAssignModal() {
  isModalOpen = false;
  document.getElementById('assignModal').classList.add('hidden');
}

async function submitAssign() {
  const adminId = document.getElementById('adminSelect').value;
  if (!adminId) {
    notifications.error('Please select an admin');
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/authority/complaints/${currentComplaintId}/assign`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ admin_id: parseInt(adminId) })
    });

    if (!response.ok) {
      let errorMessage = 'HTTP ' + response.status;
      try {
        const body = await response.json();
        if (body && body.message) errorMessage = body.message;
      } catch (_) {}
      throw new Error(errorMessage);
    }

    notifications.success('Complaint reassigned successfully');
    closeAssignModal();
    loadDashboard();
    loadComplaints();
    loadAdminPerformanceTable();
    loadEscalationLog();
  } catch (error) {
    console.error('❌ Error reassigning complaint:', error);
    notifications.error('Error reassigning complaint: ' + error.message);
  }
}

// =================== MODAL FUNCTIONS - PRIORITY ===================
function openPriorityModal(complaintId, aiSuggestedPriority) {
  isModalOpen = true;
  currentComplaintId = complaintId;
  document.getElementById('priorityComplaintId').textContent = `COMP-${complaintId.toString().padStart(4, '0')}`;
  document.getElementById('aiSuggestedPriority').textContent = aiSuggestedPriority || 'Medium';
  document.getElementById('newPrioritySelect').value = 'Medium';
  document.getElementById('priorityModal').classList.remove('hidden');
}

function closePriorityModal() {
  isModalOpen = false;
  document.getElementById('priorityModal').classList.add('hidden');
}

async function submitPriorityOverride() {
  const newPriority = document.getElementById('newPrioritySelect').value;

  try {
    const response = await fetch(`${API_BASE}/authority/complaints/${currentComplaintId}/priority`, {
      method: 'PUT',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ new_priority: newPriority })
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);

    notifications.success(`Priority overridden to "${newPriority}"`);
    closePriorityModal();
    loadDashboard();
    loadComplaints();
    loadAdminPerformanceTable();
    loadEscalationLog();
  } catch (error) {
    console.error('❌ Error overriding priority:', error);
    notifications.error('Error overriding priority: ' + error.message);
  }
}

// =================== EXPORT FUNCTIONALITY ===================
async function exportComplaints() {
  try {
    const status = document.getElementById('statusFilter').value;
    const priority = document.getElementById('priorityFilter').value;
    const category = document.getElementById('categoryFilter').value;
    const location = document.getElementById('locationFilter').value;

    let url = `${API_BASE}/authority/export`;
    const params = [];
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (priority) params.push(`priority=${encodeURIComponent(priority)}`);
    if (category) params.push(`category=${encodeURIComponent(category)}`);
    if (location) params.push(`location=${encodeURIComponent(location)}`);
    if (params.length) url += '?' + params.join('&');

    const response = await fetch(url, {
      headers: getAuthHeaders()
    });

    if (!response.ok) throw new Error('HTTP ' + response.status);

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `complaints_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);

    notifications.success('CSV exported successfully');
  } catch (error) {
    console.error('❌ Error exporting CSV:', error);
    notifications.error('Error exporting CSV: ' + error.message);
  }
}

async function exportPdf() {
  try {
    notifications.info('Generating PDF report... This may take a moment.');
    
    const status = document.getElementById('statusFilter').value;
    const priority = document.getElementById('priorityFilter').value;
    const category = document.getElementById('categoryFilter').value;
    const location = document.getElementById('locationFilter').value;

    let url = `${API_BASE}/authority/export-pdf`;
    const params = [];
    if (status) params.push(`status=${encodeURIComponent(status)}`);
    if (priority) params.push(`priority=${encodeURIComponent(priority)}`);
    if (category) params.push(`category=${encodeURIComponent(category)}`);
    if (location) params.push(`location=${encodeURIComponent(location)}`);
    if (params.length) url += '?' + params.join('&');

    const response = await fetch(url, {
      headers: getAuthHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to generate PDF' }));
      throw new Error(errorData.message || 'HTTP ' + response.status);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `authority-report-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);

    notifications.success('PDF report generated and downloaded successfully');
  } catch (error) {
    console.error('❌ Error exporting PDF:', error);
    notifications.error('Error generating PDF: ' + error.message);
  }
}

// =================== TAB SWITCHING ===================
function switchTab(tabName) {
  // Hide all tab contents
  document.querySelectorAll('.tab-content').forEach(el => {
    el.classList.remove('active');
  });

  // Remove active from all buttons
  document.querySelectorAll('.tab-btn').forEach(el => {
    el.classList.remove('active');
  });

  // Show selected tab
  const tab = document.getElementById(tabName);
  if (tab) {
    tab.classList.add('active');
    
    // Add active to clicked button
    event.target.classList.add('active');

    // Load data based on tab
    if (tabName === 'admin-performance') {
      loadAdminPerformance();
    } else if (tabName === 'trends') {
      loadMonthlyTrends();
    }
  }
}

// =================== CLOSE MODALS ===================
window.onclick = function(event) {
  const modals = ['assignModal', 'priorityModal', 'profileModal', 'settingsModal'];
  modals.forEach(id => {
    const modal = document.getElementById(id);
    if (event.target === modal) {
      modal.classList.add('hidden');

      // =================== PROFILE MANAGEMENT ===================
      function openProfileModal() {
        const auth = getStoredAuth();
        if (!auth.user) return;

        const modal = document.getElementById('profileModal');
  
        // Update profile display info
        const user = auth.user;
        document.getElementById('profileName').textContent = user.name || 'N/A';
        document.getElementById('profileRole').textContent = user.role ? user.role.toUpperCase() : 'N/A';
        document.getElementById('profileEmail').textContent = user.email || 'N/A';
        document.getElementById('profileUserId').textContent = '#' + (user.id || 'N/A');
        document.getElementById('profileCreatedAt').textContent = user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A';
  
        // Update avatar
        const avatarName = encodeURIComponent(user.name || 'User');
        const avatarUrl = `https://ui-avatars.com/api/?name=${avatarName}&background=4f46e5&color=fff`;
        document.getElementById('profileAvatar').src = avatarUrl;
  
        // Pre-fill form fields
        document.getElementById('updateName').value = user.name || '';
        document.getElementById('updateEmail').value = user.email || '';
  
        // Clear password fields
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
        document.getElementById('confirmPassword').value = '';
  
        // Hide status message
        document.getElementById('profileUpdateStatus').classList.add('hidden');
  
        modal.classList.remove('hidden');
        isModalOpen = true;
      }

      function closeProfileModal() {
        document.getElementById('profileModal').classList.add('hidden');
        isModalOpen = false;
      }

      async function saveProfileChanges() {
        const statusDiv = document.getElementById('profileUpdateStatus');
        const name = document.getElementById('updateName').value.trim();
        const email = document.getElementById('updateEmail').value.trim();
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
  
        // Validate inputs
        if (!name || !email) {
          showStatus(statusDiv, 'error', 'Name and email are required');
          return;
        }
  
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
          showStatus(statusDiv, 'error', 'Please enter a valid email address');
          return;
        }
  
        // Validate password change if provided
        if (currentPassword || newPassword || confirmPassword) {
          if (!currentPassword) {
            showStatus(statusDiv, 'error', 'Current password is required to change password');
            return;
          }
          if (!newPassword || newPassword.length < 6) {
            showStatus(statusDiv, 'error', 'New password must be at least 6 characters');
            return;
          }
          if (newPassword !== confirmPassword) {
            showStatus(statusDiv, 'error', 'New passwords do not match');
            return;
          }
        }
  
        try {
          const updateData = { name, email };
    
          // Add password fields if changing password
          if (currentPassword && newPassword) {
            updateData.currentPassword = currentPassword;
            updateData.newPassword = newPassword;
          }
    
          const response = await fetch(`${API_BASE}/auth/me`, {
            method: 'PUT',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(updateData)
          });
    
          const data = await response.json();
    
          if (!response.ok) {
            throw new Error(data.error || 'Failed to update profile');
          }
    
          // Update stored user data
          const auth = getStoredAuth();
          if (data.user) {
            setStoredAuth(auth.token, data.user);
          } else {
            // Update just the fields we changed
            auth.user.name = name;
            auth.user.email = email;
            setStoredAuth(auth.token, auth.user);
          }
    
          // Update header display
          const avatarName = encodeURIComponent(name);
          const avatarUrl = `https://ui-avatars.com/api/?name=${avatarName}&background=4f46e5&color=fff`;
          document.getElementById('headerAvatar').src = avatarUrl;
          document.getElementById('headerUserName').textContent = name;
    
          showStatus(statusDiv, 'success', 'Profile updated successfully!');
    
          // Close modal after 1.5 seconds
          setTimeout(() => {
            closeProfileModal();
          }, 1500);
    
        } catch (error) {
          console.error('Error updating profile:', error);
          showStatus(statusDiv, 'error', error.message);
        }
      }

      // =================== SETTINGS MANAGEMENT ===================
      function openSettingsModal() {
        const modal = document.getElementById('settingsModal');
  
        // Load current settings from localStorage
        const settings = loadSettings();
  
        document.getElementById('settingAutoRefresh').checked = settings.autoRefresh;
        document.getElementById('settingDesktopNotif').checked = settings.desktopNotifications;
        document.getElementById('settingSoundAlerts').checked = settings.soundAlerts;
        document.getElementById('settingTheme').value = settings.theme;
        document.getElementById('settingItemsPerPage').value = settings.itemsPerPage;
  
        // Hide status message
        document.getElementById('settingsUpdateStatus').classList.add('hidden');
  
        modal.classList.remove('hidden');
        isModalOpen = true;
      }

      function closeSettingsModal() {
        document.getElementById('settingsModal').classList.add('hidden');
        isModalOpen = false;
      }

      function loadSettings() {
        const defaults = {
          autoRefresh: true,
          desktopNotifications: false,
          soundAlerts: false,
          theme: 'dark',
          itemsPerPage: 20
        };
  
        try {
          const stored = localStorage.getItem('authoritySettings');
          if (stored) {
            return { ...defaults, ...JSON.parse(stored) };
          }
        } catch (error) {
          console.error('Error loading settings:', error);
        }
  
        return defaults;
      }

      function saveSettings() {
        const statusDiv = document.getElementById('settingsUpdateStatus');
  
        try {
          const settings = {
            autoRefresh: document.getElementById('settingAutoRefresh').checked,
            desktopNotifications: document.getElementById('settingDesktopNotif').checked,
            soundAlerts: document.getElementById('settingSoundAlerts').checked,
            theme: document.getElementById('settingTheme').value,
            itemsPerPage: parseInt(document.getElementById('settingItemsPerPage').value)
          };
    
          // Save to localStorage
          localStorage.setItem('authoritySettings', JSON.stringify(settings));
    
          // Apply auto-refresh setting
          if (settings.autoRefresh !== isAutoRefreshEnabled) {
            toggleAutoRefresh();
          }
    
          // Request notification permission if enabled
          if (settings.desktopNotifications && 'Notification' in window) {
            if (Notification.permission === 'default') {
              Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                  showStatus(statusDiv, 'success', 'Settings saved! Desktop notifications enabled.');
                } else {
                  showStatus(statusDiv, 'warning', 'Settings saved! Desktop notifications permission denied.');
                }
              });
            } else {
              showStatus(statusDiv, 'success', 'Settings saved successfully!');
            }
          } else {
            showStatus(statusDiv, 'success', 'Settings saved successfully!');
          }
    
          // Close modal after 1.5 seconds
          setTimeout(() => {
            closeSettingsModal();
          }, 1500);
    
        } catch (error) {
          console.error('Error saving settings:', error);
          showStatus(statusDiv, 'error', 'Failed to save settings');
        }
      }

      // =================== UTILITY FUNCTIONS ===================
      function showStatus(element, type, message) {
        const bgColors = {
          success: 'bg-green-600/20 border border-green-600 text-green-400',
          error: 'bg-red-600/20 border border-red-600 text-red-400',
          warning: 'bg-yellow-600/20 border border-yellow-600 text-yellow-400'
        };
  
        const icons = {
          success: 'fa-check-circle',
          error: 'fa-exclamation-circle',
          warning: 'fa-exclamation-triangle'
        };
  
        element.className = `p-3 rounded-lg ${bgColors[type]} flex items-center space-x-2`;
        element.innerHTML = `
          <i class="fas ${icons[type]}"></i>
          <span>${message}</span>
        `;
        element.classList.remove('hidden');
      }

      function handleLogout() {
        if (confirm('Are you sure you want to logout?')) {
          clearAuth();
          window.location.href = 'login.html';
        }
      }

      // Initialize user info on page load
      document.addEventListener('DOMContentLoaded', () => {
        const auth = getStoredAuth();
        if (auth.user) {
          const avatarName = encodeURIComponent(auth.user.name || 'User');
          const avatarUrl = `https://ui-avatars.com/api/?name=${avatarName}&background=4f46e5&color=fff`;
          document.getElementById('headerAvatar').src = avatarUrl;
          document.getElementById('headerUserName').textContent = auth.user.name || 'User';
    
          // Apply saved settings
          const settings = loadSettings();
          if (!settings.autoRefresh && isAutoRefreshEnabled) {
            toggleAutoRefresh();
          }
        }
      });
      isModalOpen = false;
    }
  });
};
