/**
 * dashboard.js
 * Handles Admin Dashboard logic with Async API calls.
 * Optimized for mobile performance
 */

// Import/Ensure auth check runs
if (!localStorage.getItem('admin_session')) {
    window.location.href = 'admin-login.html';
}

// Performance optimization: Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Detect mobile device
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

document.addEventListener('DOMContentLoaded', () => {
    loadStats();
    loadDonorTable();
    loadRequestTable();
    initTheme();
    
    // Optimize for mobile
    if (isMobile) {
        document.body.classList.add('mobile-optimized');
        // Disable smooth scroll on mobile for better performance
        document.documentElement.style.scrollBehavior = 'auto';
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('admin_session');
            window.location.href = 'admin-login.html';
        });
    }

    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportToCSV);
    }

    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
});

// --- Tab Logic ---
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    
    // Remove active from all menu items
    document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
    
    // Show selected tab
    const targetTab = document.getElementById(`tab-${tabName}`);
    if (targetTab) {
        targetTab.classList.add('active');
    }
    
    // Add active to clicked menu item
    const activeMenuItem = document.querySelector(`[data-tab="${tabName}"]`);
    if (activeMenuItem) {
        activeMenuItem.classList.add('active');
    }
    
    // Update page title
    const titles = {
        'dashboard': 'Dashboard Overview',
        'donors': 'Donor Management',
        'requests': 'Blood Requests',
        'analytics': 'System Analytics'
    };
    const pageTitle = document.getElementById('page-title');
    if (pageTitle && titles[tabName]) {
        pageTitle.textContent = titles[tabName];
    }
}

// --- Stats Logic ---
async function loadStats() {
    try {
        const stats = await donorManager.getStats();
        document.getElementById('total-donors').textContent = stats.total;
        document.getElementById('available-donors').textContent = stats.available;
        const oPlus = stats.bloodGroups['O+'] || 0;
        document.getElementById('o-plus-donors').textContent = oPlus;
        
        // Update total requests
        if (typeof requestManager !== 'undefined') {
            const requests = await requestManager.getAllRequests();
            const totalReqEl = document.getElementById('total-requests');
            if (totalReqEl) {
                totalReqEl.textContent = requests.length;
            }
        }
        
        // Update blood type counts
        updateBloodTypeCounts(stats.bloodGroups);
        
        // Load recent donors
        loadRecentDonors();
        
        // Update analytics
        updateAnalytics(stats);
    } catch (e) {
        console.error("Failed to load stats", e);
    }
}

// Update individual blood type counts
function updateBloodTypeCounts(bloodGroups) {
    const types = {
        'A+': 'a-plus',
        'A-': 'a-minus',
        'B+': 'b-plus',
        'B-': 'b-minus',
        'O+': 'o-plus',
        'O-': 'o-minus',
        'AB+': 'ab-plus',
        'AB-': 'ab-minus'
    };
    
    Object.keys(types).forEach(type => {
        const el = document.getElementById(`count-${types[type]}`);
        if (el) {
            el.textContent = bloodGroups[type] || 0;
        }
    });
}

// Load recent donors for activity feed (optimized)
async function loadRecentDonors() {
    try {
        const donors = await donorManager.getAllDonors();
        const recentList = document.getElementById('recent-donors-list');
        if (!recentList) return;
        
        recentList.innerHTML = '';
        
        // Show last 5 donors (3 on mobile for performance)
        const limit = isMobile ? 3 : 5;
        const recentDonors = donors.slice(0, limit);
        
        if (recentDonors.length === 0) {
            recentList.innerHTML = '<p style="text-align:center; color: var(--admin-text-muted);">No recent donors</p>';
            return;
        }
        
        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();
        
        recentDonors.forEach(donor => {
            const name = donor.fullname || donor.name;
            const bloodGroup = donor.blood_group || donor.bloodGroup;
            const initials = name.split(' ').map(n => n[0]).join('').toUpperCase();
            
            const item = document.createElement('div');
            item.className = 'activity-item';
            item.innerHTML = `
                <div class="activity-avatar">${initials}</div>
                <div class="activity-info">
                    <span class="activity-name">${name}</span>
                    <span class="activity-details">${donor.email} • ${donor.phone}</span>
                </div>
                <div class="activity-badge">${bloodGroup}</div>
            `;
            fragment.appendChild(item);
        });
        
        recentList.appendChild(fragment);
    } catch (e) {
        console.error("Failed to load recent donors", e);
    }
}

// Update analytics tab
function updateAnalytics(stats) {
    // Total
    const analyticsTotal = document.getElementById('analytics-total');
    if (analyticsTotal) analyticsTotal.textContent = stats.total;
    
    // Active/Inactive
    const analyticsActive = document.getElementById('analytics-active');
    const analyticsInactive = document.getElementById('analytics-inactive');
    if (analyticsActive) analyticsActive.textContent = stats.available;
    if (analyticsInactive) analyticsInactive.textContent = stats.total - stats.available;
    
    // Most common blood type
    let maxCount = 0;
    let mostCommon = 'O+';
    Object.keys(stats.bloodGroups).forEach(type => {
        if (stats.bloodGroups[type] > maxCount) {
            maxCount = stats.bloodGroups[type];
            mostCommon = type;
        }
    });
    
    const mostCommonType = document.getElementById('most-common-type');
    const mostCommonCount = document.getElementById('most-common-count');
    if (mostCommonType) mostCommonType.textContent = mostCommon;
    if (mostCommonCount) mostCommonCount.textContent = `${maxCount} donors`;
    
    // Rare blood types (count < 3)
    const rareTypesList = document.getElementById('rare-types-list');
    if (rareTypesList) {
        rareTypesList.innerHTML = '';
        const rareTypes = Object.keys(stats.bloodGroups)
            .filter(type => stats.bloodGroups[type] > 0 && stats.bloodGroups[type] < 3)
            .sort((a, b) => stats.bloodGroups[a] - stats.bloodGroups[b]);
        
        if (rareTypes.length === 0) {
            rareTypesList.innerHTML = '<p style="color: var(--admin-text-muted); font-size: 0.9rem;">All blood types have adequate coverage</p>';
        } else {
            rareTypes.forEach(type => {
                const item = document.createElement('div');
                item.className = 'rare-type-item';
                item.innerHTML = `
                    <span class="rare-type-label">${type}</span>
                    <span class="rare-type-count">${stats.bloodGroups[type]}</span>
                `;
                rareTypesList.appendChild(item);
            });
        }
    }
}

// --- Donor Logic (Optimized for mobile) ---
async function loadDonorTable() {
    try {
        const donors = await donorManager.getAllDonors();
        const tbody = document.getElementById('donor-table-body');
        tbody.innerHTML = '';

        if (donors.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding: 3rem; color: var(--admin-text-muted);">No donors registered yet.</td></tr>';
            return;
        }

        // Use DocumentFragment for better performance
        const fragment = document.createDocumentFragment();

        donors.forEach(donor => {
            const tr = document.createElement('tr');
            const name = donor.fullname || donor.name;
            const bloodGroup = donor.blood_group || donor.bloodGroup;
            
            // Simplified layout for mobile
            if (isMobile) {
                tr.innerHTML = `
                    <td>
                        <div style="font-weight: 600; color: var(--admin-text);">${name}</div>
                        <div style="font-size: 0.75rem; color: var(--admin-text-muted);">${donor.email}</div>
                    </td>
                    <td>
                        <span style="display: inline-block; padding: 0.4rem 0.75rem; background: #ff4757; color: white; border-radius: 6px; font-weight: 700; font-size: 0.85rem;">
                            ${bloodGroup}
                        </span>
                    </td>
                    <td style="font-size: 0.85rem;">${donor.phone}</td>
                    <td>
                        <button class="status-btn ${donor.available ? 'active' : 'inactive'}" onclick="toggleStatus('${donor.id}')">
                            ${donor.available ? '✓' : '✗'}
                        </button>
                    </td>
                    <td>
                        <button class="action-btn edit-btn" onclick="editDonor('${donor.id}')">✏️</button>
                        <button class="action-btn delete-btn" onclick="deleteDonorHandler('${donor.id}')">🗑️</button>
                    </td>
                `;
            } else {
                tr.innerHTML = `
                    <td>
                        <div style="display: flex; align-items: center; gap: 0.75rem;">
                            <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: flex; align-items: center; justify-content: center; color: white; font-weight: 700;">
                                ${name.split(' ').map(n => n[0]).join('').toUpperCase()}
                            </div>
                            <div>
                                <div style="font-weight: 600; color: var(--admin-text);">${name}</div>
                                <div style="font-size: 0.85rem; color: var(--admin-text-muted);">${donor.email}</div>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span style="display: inline-block; padding: 0.5rem 1rem; background: linear-gradient(135deg, #ff4757 0%, #ff6b81 100%); color: white; border-radius: 8px; font-weight: 700; font-size: 0.95rem;">
                            ${bloodGroup}
                        </span>
                    </td>
                    <td>
                        <div style="font-size: 0.9rem; color: var(--admin-text);">📞 ${donor.phone}</div>
                    </td>
                    <td style="color: var(--admin-text-muted); font-size: 0.9rem;">📍 ${donor.address}</td>
                    <td>
                        <button class="status-btn ${donor.available ? 'active' : 'inactive'}" onclick="toggleStatus('${donor.id}')">
                            ${donor.available ? '✓ Active' : '✗ Inactive'}
                        </button>
                    </td>
                    <td>
                        <button class="action-btn edit-btn" onclick="editDonor('${donor.id}')">✏️ Edit</button>
                        <button class="action-btn delete-btn" onclick="deleteDonorHandler('${donor.id}')">🗑️ Delete</button>
                    </td>
                `;
            }
            fragment.appendChild(tr);
        });
        
        tbody.appendChild(fragment);
    } catch (e) {
        console.error("Failed to load donors", e);
    }
}

async function toggleStatus(id) {
    await donorManager.toggleAvailability(id);
    loadDonorTable();
    loadStats();
}

async function deleteDonorHandler(id) {
    if (confirm('Are you sure you want to delete this donor?')) {
        await donorManager.deleteDonor(id);
        loadDonorTable();
        loadStats();
    }
}

function editDonor(id) {
    window.location.href = `register.html?id=${id}`;
}

// --- Blood Request Logic ---
async function loadRequestTable() {
    // Check if requestManager exists (from request.js)
    if (typeof requestManager === 'undefined') return;

    try {
        const requests = await requestManager.getAllRequests();
        const tbody = document.getElementById('request-table-body');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (requests.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding: 3rem; color: var(--admin-text-muted);">No blood requests found.</td></tr>';
            return;
        }

        requests.forEach(req => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>
                    <div style="font-weight: 600; color: var(--admin-text);">👤 ${req.patientName}</div>
                </td>
                <td>
                    <span style="display: inline-block; padding: 0.5rem 1rem; background: linear-gradient(135deg, #ff4757 0%, #ff6b81 100%); color: white; border-radius: 8px; font-weight: 700;">
                        ${req.bloodGroup}
                    </span>
                </td>
                <td style="font-weight: 600; color: var(--admin-text);">${req.unit} ${req.unit > 1 ? 'units' : 'unit'}</td>
                <td style="color: var(--admin-text);">🏥 ${req.hospital}</td>
                <td style="color: var(--admin-text-muted);">📅 ${req.neededDate}</td>
                <td style="color: var(--admin-text);">📞 ${req.phone}</td>
                <td>
                     <button class="action-btn delete-btn" onclick="deleteRequestHandler('${req.id}')">🗑️ Delete</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {
        console.error("Failed to load requests", e);
    }
}

async function deleteRequestHandler(id) {
   if (confirm('Delete this request?')) {
       await requestManager.deleteRequest(id);
       loadRequestTable();
   }
}

// --- CSV Export (Feature 2) ---
async function exportToCSV() {
    const donors = await donorManager.getAllDonors();
    if (donors.length === 0) {
        alert("No data to export");
        return;
    }

    const headers = ["ID", "Name", "Age", "Gender", "Blood Group", "Phone", "Email", "Address", "Last Donation", "Available"];
    const csvRows = [headers.join(",")];

    donors.forEach(d => {
        const name = d.fullname || d.name;
        const bg = d.blood_group || d.bloodGroup;
        const lastDonation = d.last_donation_date || d.lastDonation || '';

        const row = [d.id, name, d.age, d.gender, bg, d.phone, d.email, d.address, lastDonation, d.available];
        // Escape commas in data if necessary, simple version here
        csvRows.push(row.join(","));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "donors_list.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- Dark Mode (Feature 3) ---
function toggleTheme() {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    if (isDark) {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }
    updateThemeIcon();
}

function initTheme() {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
    }
    updateThemeIcon();
}

function updateThemeIcon() {
    const btn = document.getElementById('theme-toggle');
    const icon = document.getElementById('theme-icon');
    if(btn && icon) {
         const isDark = document.body.getAttribute('data-theme') === 'dark';
         icon.textContent = isDark ? '☀️' : '🌙';
    }
}
