/* ============================================
   🚀 PURELIFE FAMILY CARE - ORDER MANAGEMENT SYSTEM
   Main Application JavaScript
   ============================================ */

// 🔴 Google Sheets API URL
const API_URL = "https://script.google.com/macros/s/AKfycbxnEjTtC0lXBjf16-k1SxMPsPHjpNJTX67q3q1gLK5ENbQlGsFPPnfaC20G-1xTWBKW/exec";

// 📦 Global State
let allOrders = [];
let allProducts = [];
let allCustomers = [];

// ============================================
// 🔐 Authentication System
// ============================================
const Auth = {
    users: [
        { username: 'admin', password: 'admin123', name: 'Liaqat Ali', role: 'Admin' },
        { username: 'user', password: 'user123', name: 'Staff User', role: 'Staff' }
    ],

    isLoggedIn() {
        return sessionStorage.getItem('isLoggedIn') === 'true';
    },

    getCurrentUser() {
        const userData = sessionStorage.getItem('currentUser');
        return userData ? JSON.parse(userData) : null;
    },

    login(username, password) {
        const user = this.users.find(u => u.username === username && u.password === password);
        if (user) {
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('currentUser', JSON.stringify(user));
            return { success: true, user };
        }
        return { success: false, message: 'Invalid username or password' };
    },

    logout() {
        sessionStorage.removeItem('isLoggedIn');
        sessionStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    },

    checkAuth() {
        if (!this.isLoggedIn() && !window.location.pathname.includes('index.html')) {
            window.location.href = 'index.html';
            return false;
        }
        return true;
    }
};

// ============================================
// 🎨 UI Utilities
// ============================================
const UI = {
    // Show Loading Spinner
    showLoading(element) {
        if (element) {
            element.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <div class="spinner"></div>
                    <p style="margin-top: 15px; color: var(--gray-500);">Loading...</p>
                </div>
            `;
        }
    },

    // Show Toast Notification
    showToast(message, type = 'success') {
        const container = document.getElementById('toastContainer') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-times-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };
        
        const colors = {
            success: '#10b981',
            error: '#ef4444',
            warning: '#f59e0b',
            info: '#6366f1'
        };
        
        toast.innerHTML = `
            <i class="fas ${icons[type]}" style="color: ${colors[type]}; font-size: 20px;"></i>
            <span style="flex: 1;">${message}</span>
            <button onclick="this.parentElement.remove()" style="border: none; background: none; cursor: pointer; padding: 5px;">
                <i class="fas fa-times" style="color: var(--gray-400);"></i>
            </button>
        `;
        
        container.appendChild(toast);
        
        // Auto remove after 4 seconds
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    },

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    },

    // Format Currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('en-PK', {
            style: 'currency',
            currency: 'PKR',
            minimumFractionDigits: 0
        }).format(amount).replace('PKR', 'Rs.');
    },

    // Format Date - handles various formats from Google Sheets
    formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            let date;
            
            // If it's already a formatted string like "30/01/2026" or "2026-01-30"
            if (typeof dateStr === 'string') {
                // Handle DD/MM/YYYY format
                if (dateStr.includes('/')) {
                    const parts = dateStr.split('/');
                    if (parts.length === 3) {
                        // DD/MM/YYYY
                        date = new Date(parts[2], parts[1] - 1, parts[0]);
                    }
                }
                // Handle YYYY-MM-DD format
                else if (dateStr.includes('-')) {
                    date = new Date(dateStr);
                }
                // Handle Google Sheets serial number
                else if (!isNaN(dateStr)) {
                    // Google Sheets uses Jan 1, 1900 as day 1
                    date = new Date((parseFloat(dateStr) - 25569) * 86400 * 1000);
                }
                else {
                    date = new Date(dateStr);
                }
            }
            // If it's a number (Google Sheets serial date)
            else if (typeof dateStr === 'number') {
                date = new Date((dateStr - 25569) * 86400 * 1000);
            }
            else {
                date = new Date(dateStr);
            }
            
            // Check if date is valid
            if (isNaN(date.getTime())) {
                return dateStr; // Return original if can't parse
            }
            
            return date.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch {
            return dateStr;
        }
    },

    // Get Initials from Name
    getInitials(name) {
        if (!name) return '??';
        return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    },

    // Generate Random Color
    getAvatarColor(name) {
        const colors = [
            'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
            'linear-gradient(135deg, #ee0979 0%, #ff6a00 100%)',
            'linear-gradient(135deg, #2193b0 0%, #6dd5ed 100%)',
            'linear-gradient(135deg, #cc2b5e 0%, #753a88 100%)'
        ];
        const index = name ? name.charCodeAt(0) % colors.length : 0;
        return colors[index];
    }
};

// ============================================
// 📊 Data Operations
// ============================================
const DataService = {
    // Fetch all orders from API
    async fetchOrders() {
        try {
            const response = await fetch(API_URL);
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            // Normalize data
            allOrders = data.map((row, index) => ({
                id: index + 1,
                date: row['Date'] || row['date'] || '',
                reseller: row['Reseller'] || 'Easy Shopping Zone',
                customer: row['Customer'] || row['Customer Name'] || 'Unknown',
                mobile: row['Mobile'] || row['Mobile No'] || '',
                address: row['Address'] || row['Complete Address'] || '',
                product: row['Product'] || row['product'] || '',
                qty: row['Qty'] || row['qty'] || '1',
                price: parseInt(row['Price'] || row['price'] || 0),
                courier: row['Courier'] || '',
                status: row['Status'] || 'Pending'
            }));
            
            return allOrders;
        } catch (error) {
            console.error('Error fetching orders:', error);
            UI.showToast('Failed to load orders', 'error');
            return [];
        }
    },

    // Save new order
    async saveOrder(formData) {
        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                body: formData
            });
            return { success: true };
        } catch (error) {
            console.error('Error saving order:', error);
            return { success: false, error: error.message };
        }
    },

    // Calculate Statistics
    getStats() {
        const today = new Date().toDateString();
        const thisMonth = new Date().getMonth();
        
        const todayOrders = allOrders.filter(o => {
            const orderDate = new Date(o.date);
            return orderDate.toDateString() === today;
        });
        
        const monthOrders = allOrders.filter(o => {
            const orderDate = new Date(o.date);
            return orderDate.getMonth() === thisMonth;
        });
        
        return {
            totalOrders: allOrders.length,
            totalRevenue: allOrders.reduce((sum, o) => sum + o.price, 0),
            todayOrders: todayOrders.length,
            todayRevenue: todayOrders.reduce((sum, o) => sum + o.price, 0),
            monthOrders: monthOrders.length,
            monthRevenue: monthOrders.reduce((sum, o) => sum + o.price, 0),
            avgOrderValue: allOrders.length > 0 ? Math.round(allOrders.reduce((sum, o) => sum + o.price, 0) / allOrders.length) : 0
        };
    }
};

// ============================================
// 📱 Sidebar Toggle
// ============================================
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('active');
}

// Close sidebar on outside click (mobile)
document.addEventListener('click', (e) => {
    const sidebar = document.querySelector('.sidebar');
    const menuToggle = document.querySelector('.menu-toggle');
    
    if (sidebar && sidebar.classList.contains('active') && 
        !sidebar.contains(e.target) && 
        !menuToggle.contains(e.target)) {
        sidebar.classList.remove('active');
    }
});

// ============================================
// 🔐 Login Form Handler
// ============================================
function handleLogin(event) {
    event.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const btn = document.getElementById('loginBtn');
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
    btn.disabled = true;
    
    setTimeout(() => {
        const result = Auth.login(username, password);
        
        if (result.success) {
            UI.showToast('Login successful! Redirecting...', 'success');
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            UI.showToast(result.message, 'error');
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
            btn.disabled = false;
        }
    }, 800);
}

// ============================================
// 📦 Orders Table
// ============================================
function renderOrdersTable(orders = allOrders) {
    const tbody = document.getElementById('ordersTableBody');
    if (!tbody) return;
    
    if (!orders || orders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 60px 20px;">
                    <i class="fas fa-inbox" style="font-size: 48px; color: var(--gray-300); margin-bottom: 15px;"></i>
                    <p style="color: var(--gray-500); font-size: 16px;">No orders found</p>
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = orders.map((order, index) => {
        const courier = (order.courier || '').toLowerCase();
        const isPO = courier.includes('post');
        const isLeopardsRS = courier.includes('leopards') && courier.includes('rs');
        const isLeopardsBridge = courier.includes('leopards') && courier.includes('bridge');
        const isLeopards = courier.includes('leopards');
        const isTCS = courier.includes('tcs');
        
        const statusClass = order.status === 'Delivered' ? 'success' : 
                          order.status === 'Pending' ? 'warning' : 'info';
        
        // Courier badge color
        let courierBadge = '';
        if (isPO) courierBadge = '<span class="badge badge-info" style="font-size:10px;">PO</span>';
        else if (isLeopardsRS) courierBadge = '<span class="badge" style="background:#1a365d;color:white;font-size:10px;">RS</span>';
        else if (isLeopardsBridge) courierBadge = '<span class="badge" style="background:#2d3748;color:white;font-size:10px;">Bridge</span>';
        else if (isTCS) courierBadge = '<span class="badge badge-danger" style="font-size:10px;">TCS</span>';
        
        return `
            <tr class="animate-fadeIn" style="animation-delay: ${index * 0.05}s">
                <td>
                    <input type="checkbox" class="checkbox-custom order-checkbox" value="${index}" data-index="${index}">
                </td>
                <td>
                    <span class="badge badge-primary">#${order.id}</span>
                    ${courierBadge}
                </td>
                <td>${UI.formatDate(order.date)}</td>
                <td>
                    <div class="customer-cell">
                        <div class="customer-avatar" style="background: ${UI.getAvatarColor(order.customer)}">
                            ${UI.getInitials(order.customer)}
                        </div>
                        <div class="customer-info">
                            <strong>${order.customer}</strong>
                            <span>${order.mobile}</span>
                        </div>
                    </div>
                </td>
                <td>
                    <span>${order.product || '-'}</span>
                    <small style="display: block; color: var(--gray-500);">Qty: ${order.qty}</small>
                </td>
                <td class="amount">${UI.formatCurrency(order.price)}</td>
                <td>
                    <span class="badge badge-${statusClass}">
                        <i class="fas fa-circle" style="font-size: 6px;"></i>
                        ${order.status || 'Pending'}
                    </span>
                </td>
                <td>
                    <div class="btn-group">
                        <button class="btn btn-icon btn-light" onclick="printSlipByCourier(${index})" title="Print Slip">
                            <i class="fas fa-print"></i>
                        </button>
                        ${isPO ? `
                        <button class="btn btn-icon btn-light" onclick="printMO(${index})" title="Money Order" style="color: var(--accent-orange);">
                            <i class="fas fa-money-bill-wave"></i>
                        </button>
                        ` : ''}
                        <button class="btn btn-icon btn-light" onclick="viewOrder(${index})" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-icon btn-light" onclick="deleteOrder(${index})" title="Delete Order" style="color: var(--accent-red);">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Select All Checkbox
function toggleSelectAll(source) {
    const checkboxes = document.querySelectorAll('.order-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
    updateBulkActions();
}

// Update bulk action button state
function updateBulkActions() {
    const checked = document.querySelectorAll('.order-checkbox:checked').length;
    const bulkBtn = document.getElementById('bulkPrintBtn');
    if (bulkBtn) {
        bulkBtn.disabled = checked === 0;
        bulkBtn.innerHTML = checked > 0 
            ? `<i class="fas fa-print"></i> Print Selected (${checked})`
            : `<i class="fas fa-print"></i> Print Selected`;
    }
}

// Search Filter
function filterOrders() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allOrders.filter(o => 
        (o.customer || '').toLowerCase().includes(searchTerm) ||
        (o.mobile || '').includes(searchTerm) ||
        (o.product || '').toLowerCase().includes(searchTerm)
    );
    renderOrdersTable(filtered);
}

// ============================================
// 📝 Booking Form
// ============================================
async function handleBookingSubmit(event) {
    event.preventDefault();
    
    const form = event.target;
    const btn = document.getElementById('submitBtn');
    
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
    btn.disabled = true;
    
    try {
        const formData = new FormData(form);
        const result = await DataService.saveOrder(formData);
        
        if (result.success) {
            UI.showToast('Order saved successfully!', 'success');
            form.reset();
            
            // Redirect to orders page after 2 seconds
            setTimeout(() => {
                window.location.href = 'orders.html';
            }, 2000);
        } else {
            UI.showToast('Failed to save order', 'error');
        }
    } catch (error) {
        UI.showToast('Order saved (Check Sheet)', 'warning');
    } finally {
        btn.innerHTML = '<i class="fas fa-save"></i> Save Booking';
        btn.disabled = false;
    }
}

// ============================================
// 🖨️ Print Functions
// ============================================

// Slip Print Styles
const slipStyles = `
    @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');
    
    @page { size: A4 landscape; margin: 0; }
    body { margin: 0; padding: 0; background: white; font-family: 'Segoe UI', sans-serif; }
    
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

    .page-sheet {
        width: 297mm;
        height: 209mm;
        page-break-after: always;
        box-sizing: border-box;
        padding: 2mm;
    }
    .page-sheet:last-child { page-break-after: auto; }

    table.grid-table {
        width: 100%;
        height: 100%;
        border-collapse: collapse;
        table-layout: fixed;
    }
    
    table.grid-table td {
        width: 50%;
        height: 50%;
        vertical-align: top;
        padding: 3mm;
        box-sizing: border-box;
    }

    .slip-box { 
        width: 100%; 
        height: 100%; 
        border: 2px solid #000; 
        background: white; color: black; 
        box-sizing: border-box; 
        display: flex; flex-direction: column;
        overflow: hidden;
    }
    
    .row { display: flex; border-bottom: 2px solid #000; }
    .row:last-child { border-bottom: none; }
    .cell { padding: 4px 8px; display: flex; align-items: center; }
    .border-right { border-right: 1px solid #000; }
    .bg-grey { background-color: #f0f0f0 !important; }
    
    .input-look { border: 1px solid #333; background: white; padding: 1px 4px; font-size: 13px; min-width: 60px; text-align: center; font-weight: bold; margin-left: 5px; }
    
    .font-xl { font-size: 20px; font-weight: 800; text-transform: uppercase; }
    .font-lg { font-size: 14px; font-weight: bold; }
    .font-md { font-size: 13px; font-weight: bold; }
    .label-text { font-size: 12px; font-weight: bold; color: #444; }
    
    .from-section { height: 130px; } 
    .from-label { width: 40px; justify-content: center; font-weight: bold; background: #f0f0f0; font-size: 12px; writing-mode: vertical-lr; transform: rotate(180deg); text-align: center; }
    
    .sender-details { flex: 1; padding: 5px 10px; font-size: 12px; line-height: 1.4; display:flex; flex-direction:column; justify-content:center; font-weight: 700; }
    
    .sender-name-big {
        font-size: 26px; font-weight: 900; 
        text-transform: uppercase; color: #000;
        line-height: 1; margin-bottom: 5px;
    }
    
    .stamp-area { width: 90px; display:flex; align-items:center; justify-content:center; border-left: 1px solid #000; }
    .logo-area { width: 80px; display:flex; flex-direction:column; align-items:center; justify-content:center; border-left: 1px solid #000; text-align:center; padding: 5px; }

    .address-label-box { width: 90px; background: #f0f0f0; border-left: 2px solid #000; display: flex; align-items: center; justify-content: center; flex-direction: column; }
    
    .urdu-badge { 
        background-color: #10b981 !important;
        color: white !important; 
        padding: 4px 10px; 
        border-radius: 6px; 
        font-family: 'Noto Nastaliq Urdu', serif; 
        font-weight: 700; 
        font-size: 14px; 
        text-align: center; 
        line-height: 1.6; 
        border: 1px solid #059669; 
        -webkit-print-color-adjust: exact; 
        print-color-adjust: exact;
    }
    
    .address-text { font-size: 15px; font-weight: 800; line-height: 1.4; overflow: hidden; max-height: 100%; }
`;

function isUrdu(str) {
    return /[\u0600-\u06FF\u0750-\u077F]/.test(str);
}

function getSlipHTML(d) {
    if (!d) return "";
    
    const total = parseInt(d.price || 0);
    const base = total - 75;
    
    const isNameUrdu = isUrdu(d.customer);
    const nameStyle = isNameUrdu ? "font-family: 'Noto Nastaliq Urdu', serif; direction: rtl; text-align: right; padding-right: 15px;" : "padding-left: 10px; text-align: left;";
    const isAddrUrdu = isUrdu(d.address);
    const addrStyle = isAddrUrdu ? "font-family: 'Noto Nastaliq Urdu', serif; direction: rtl; text-align: right; line-height: 1.8;" : "text-align: left; line-height: 1.4;";

    return `
    <div class="slip-box">
        <div class="row bg-grey" style="height: 35px; align-items: center; justify-content: space-between; padding: 0 8px;">
            <div style="display: flex; align-items: center;"><span class="label-text">Date:</span><div class="input-look">${d.date}</div></div>
            <div style="font-size: 14px; font-weight: bold;">Rs: ${base} + 75 = <span style="font-size:18px; background-color:#000 !important; color:white !important; padding:1px 6px; border-radius:2px; -webkit-print-color-adjust: exact;">${total}</span></div>
        </div>
        <div class="row" style="height: 45px;">
            <div class="cell bg-grey border-right" style="width: 50px; justify-content: center; font-weight:bold; font-size:14px;">To:</div>
            <div class="cell font-xl" style="flex: 1; ${nameStyle}">${d.customer}</div>
        </div>
        <div class="row" style="height: 35px;">
            <div class="cell border-right" style="flex: 1.5;">
                <span style="margin-right:8px; font-size:12px; color:#555;">Phone:</span>
                <span class="font-lg">${d.mobile}</span>
            </div>
            <div class="cell" style="flex: 1;">
                <span style="margin-right:8px; font-size:12px; color:#555;">Detail:</span>
                <span class="font-md">${d.product} (${d.qty})</span>
            </div>
        </div>
        <div class="row" style="flex: 1;">
            <div class="cell address-text" style="flex: 1; align-items: flex-start; padding: 8px; ${addrStyle}">${d.address}</div>
            <div class="address-label-box"><div class="urdu-badge">مکمل<br>ایڈریس</div></div>
        </div>
        <div class="row from-section">
            <div class="cell from-label border-right">From</div>
            <div class="sender-details">
                <div class="sender-name-big">${d.reseller}</div>
                <div>Post Office Khan Garh District Muzaffargarh</div>
                <div>Postal Code: <b>34350</b></div>
                <div>Phone: <b>0311-7686862, 0335-6352625</b></div>
                <div style="margin-top:2px; font-size:11px;">CNIC: 35301-4550279-7</div>
            </div>
            <div class="stamp-area">
                <svg width="80" height="80" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="46" fill="none" stroke="#222" stroke-width="2"/><circle cx="50" cy="50" r="28" fill="none" stroke="#222" stroke-width="2"/><text x="50" y="55" text-anchor="middle" font-size="16">★</text><path id="curveTop" d="M 13,50 A 37,37 0 0,1 87,50" fill="none"/><text font-size="10" font-weight="bold" letter-spacing="1"><textPath href="#curveTop" startOffset="50%" text-anchor="middle">BULK USER</textPath></text><path id="curveBot" d="M 13,50 A 37,37 0 0,0 87,50" fill="none"/><text font-size="8" font-weight="bold" letter-spacing="1"><textPath href="#curveBot" startOffset="50%" text-anchor="middle">PO KHAN GARH</textPath></text>
                </svg>
            </div>
            <div class="logo-area">
                <svg width="60" height="60" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="white" stroke="#2e7d32" stroke-width="3" /><circle cx="50" cy="50" r="40" fill="#e8f5e9" /><circle cx="50" cy="35" r="10" fill="#2e7d32" /><path d="M 35 70 Q 50 25 65 70" stroke="#2e7d32" stroke-width="6" fill="none" stroke-linecap="round" />
                </svg>
                <div style="font-size:8px; font-weight:bold; color:#2e7d32; line-height:1.2; margin-top:2px;">Pure Life<br>Family Care</div>
            </div>
        </div>
    </div>`;
}

function printContent(htmlContent) {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 500);
}

// Print Single Slip
function printSingleSlip(index) {
    const d = allOrders[index];
    const html = `<!DOCTYPE html><html><head><style>${slipStyles}</style></head><body>
        <div class="page-sheet">
            <table class="grid-table">
                <tr><td>${getSlipHTML(d)}</td><td></td></tr>
                <tr><td></td><td></td></tr>
            </table>
        </div>
    </body></html>`;
    printContent(html);
}

// Bulk Print Selected Slips - Courier-specific (All in One PDF)
function printSelectedSlips() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    if (checkboxes.length === 0) {
        UI.showToast('Please select orders to print', 'warning');
        return;
    }
    
    const selectedIndexes = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    // Separate orders by courier type
    const poOrders = [];
    const rsOrders = [];
    const bridgeOrders = [];
    const tcsOrders = [];
    
    selectedIndexes.forEach(idx => {
        const order = allOrders[idx];
        const courier = (order.courier || '').toLowerCase();
        
        if (courier.includes('leopards') && courier.includes('rs')) {
            rsOrders.push(idx);
        } else if (courier.includes('leopards') && courier.includes('bridge')) {
            bridgeOrders.push(idx);
        } else if (courier.includes('tcs')) {
            tcsOrders.push(idx);
        } else {
            // Default: Post Office
            poOrders.push(idx);
        }
    });
    
    // Print Post Office slips (4 per page)
    if (poOrders.length > 0) {
        let poHTML = `<!DOCTYPE html><html><head><style>${slipStyles}</style></head><body>`;
        
        for (let i = 0; i < poOrders.length; i += 4) {
            const chunk = poOrders.slice(i, i + 4);
            const d1 = allOrders[chunk[0]];
            const d2 = chunk[1] !== undefined ? allOrders[chunk[1]] : null;
            const d3 = chunk[2] !== undefined ? allOrders[chunk[2]] : null;
            const d4 = chunk[3] !== undefined ? allOrders[chunk[3]] : null;

            poHTML += `
            <div class="page-sheet">
                <table class="grid-table">
                    <tr>
                        <td>${getSlipHTML(d1)}</td>
                        <td>${getSlipHTML(d2)}</td>
                    </tr>
                    <tr>
                        <td>${getSlipHTML(d3)}</td>
                        <td>${getSlipHTML(d4)}</td>
                    </tr>
                </table>
            </div>`;
        }
        
        poHTML += `</body></html>`;
        printContent(poHTML);
        UI.showToast(`Printing ${poOrders.length} Post Office slips...`, 'success');
    }
    
    // Print Leopards RS slips - ALL IN ONE PDF
    if (rsOrders.length > 0) {
        const rsHTML = generateBulkLeopardsSlips(rsOrders, 'rs');
        setTimeout(() => {
            printContent(rsHTML);
            UI.showToast(`Printing ${rsOrders.length} Leopards RS slips...`, 'success');
        }, poOrders.length > 0 ? 1000 : 0);
    }
    
    // Print Leopards Bridge slips - ALL IN ONE PDF
    if (bridgeOrders.length > 0) {
        const bridgeHTML = generateBulkLeopardsSlips(bridgeOrders, 'bridge');
        setTimeout(() => {
            printContent(bridgeHTML);
            UI.showToast(`Printing ${bridgeOrders.length} Leopards Bridge slips...`, 'success');
        }, (poOrders.length > 0 ? 1000 : 0) + (rsOrders.length > 0 ? 1000 : 0));
    }
    
    // Print TCS slips
    if (tcsOrders.length > 0) {
        UI.showToast(`TCS slips: ${tcsOrders.length} - Using default design`, 'info');
    }
    
    // Show summary
    if (poOrders.length === 0 && rsOrders.length === 0 && bridgeOrders.length === 0) {
        UI.showToast('No supported courier slips to print', 'warning');
    }
}

// Generate Bulk Leopards Slips (RS or Bridge) - All in One PDF
function generateBulkLeopardsSlips(orderIndexes, type) {
    const today = new Date().toLocaleDateString('en-GB');
    
    let html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page { size: A4; margin: 5mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 11px; background: white; }
            
            .slip-page { 
                width: 100%; 
                max-width: 750px; 
                margin: 0 auto 10mm; 
                border: 2px solid #333; 
                background: #fff;
                page-break-inside: avoid;
                page-break-after: always;
            }
            .slip-page:last-child { page-break-after: auto; }
            
            /* Header Section */
            .header { display: flex; border-bottom: 2px solid #333; }
            
            .logo-box { 
                width: 85px; padding: 8px; border-right: 1px solid #ccc; 
                display: flex; flex-direction: column; justify-content: center; align-items: center;
            }
            .rs-text { font-family: 'Times New Roman', serif; font-size: 36px; font-weight: bold; color: #1a3a5c; }
            .logistics { font-size: 12px; color: #1a3a5c; font-style: italic; }
            .bridge-text { font-family: 'Segoe UI', sans-serif; font-size: 24px; font-weight: bold; font-style: italic; }
            .bridge-line { width: 50px; height: 2px; background: #000; transform: rotate(-25deg); margin-bottom: 5px; }
            .bridge-tagline { font-size: 7px; letter-spacing: 2px; border-top: 1px solid #000; padding-top: 2px; }
            
            .barcode-box { flex: 1; padding: 8px; border-right: 1px solid #ccc; position: relative; text-align: center; }
            .color-stripes { position: absolute; left: 0; top: 0; bottom: 0; width: 30px; display: flex; }
            .color-stripes div { flex: 1; }
            .barcode-text { font-family: monospace; font-size: 35px; letter-spacing: -2px; margin-left: 30px; }
            .tracking { font-size: 12px; font-weight: bold; margin-top: 3px; }
            
            .info-grid { display: flex; flex-wrap: wrap; width: 280px; }
            .info-cell { width: 50%; padding: 4px 8px; border: 1px solid #ccc; background: #f9f9f9; }
            .info-label { font-size: 9px; color: #666; }
            .info-value { font-size: 11px; font-weight: bold; }
            
            .content { display: flex; }
            .shipper-section, .consignee-section { flex: 1; }
            .shipper-section { border-right: 1px solid #333; }
            
            .section-title { background: #e5e5e5; padding: 5px 10px; font-weight: bold; text-align: center; border-bottom: 1px solid #999; }
            
            .detail-row { display: flex; border-bottom: 1px solid #ccc; min-height: 28px; }
            .detail-label { width: 100px; padding: 5px 8px; background: #fafafa; font-weight: bold; font-size: 10px; border-right: 1px solid #ccc; }
            .detail-value { flex: 1; padding: 5px 8px; font-size: 11px; }
            
            .ref-row { display: flex; border-bottom: 1px solid #333; }
            .ref-cell { flex: 1; padding: 5px 8px; border-right: 1px solid #ccc; font-weight: bold; font-size: 10px; }
            .ref-cell:last-child { border-right: none; }
            .amount { font-size: 18px; font-weight: bold; color: #c00; }
            
            .product-row { display: flex; border-bottom: 1px solid #ccc; }
            
            .bottom-section { display: flex; border-bottom: 1px solid #333; }
            .instruction-section { flex: 1; }
            .branding-section { width: 150px; padding: 8px; text-align: center; border-left: 1px solid #ccc; }
            .leopards-text { font-family: 'Brush Script MT', cursive; font-size: 22px; color: #b8860b; font-style: italic; }
            .leopards-tagline { font-size: 9px; color: #666; }
            
            .footer { padding: 8px; text-align: center; color: #c00; font-size: 11px; font-weight: bold; }
            .urdu { direction: rtl; text-align: right; }
        </style>
    </head>
    <body>`;
    
    orderIndexes.forEach(idx => {
        const d = allOrders[idx];
        const trackingNo = 'MG' + Date.now().toString().slice(-10) + idx;
        const orderDate = d.date ? UI.formatDate(d.date) : today;
        
        if (type === 'rs') {
            html += `
            <div class="slip-page">
                <div class="header">
                    <div class="logo-box">
                        <div class="rs-text">R&S</div>
                        <div class="logistics">logistics</div>
                    </div>
                    <div class="barcode-box">
                        <div class="color-stripes">
                            <div style="background: #e53935;"></div>
                            <div style="background: #fb8c00;"></div>
                            <div style="background: #fdd835;"></div>
                            <div style="background: #43a047;"></div>
                            <div style="background: #1e88e5;"></div>
                            <div style="background: #5e35b1;"></div>
                        </div>
                        <div class="barcode-text">|||||||||||||||||||||||||</div>
                        <div class="tracking">${trackingNo}</div>
                    </div>
                    <div class="info-grid">
                        <div class="info-cell"><div class="info-label">Date</div><div class="info-value">${orderDate}</div></div>
                        <div class="info-cell"><div class="info-label">Weight:</div><div class="info-value">2 Kg</div></div>
                        <div class="info-cell"><div class="info-label">Services</div><div class="info-value">Overnight</div></div>
                        <div class="info-cell"><div class="info-label">Booking Type:</div><div class="info-value">Invoice</div></div>
                        <div class="info-cell"><div class="info-label">Origin</div><div class="info-value">Muzaffargarh</div></div>
                        <div class="info-cell"><div class="info-label">Destination</div><div class="info-value">${d.city || '---'}</div></div>
                    </div>
                </div>
                <div class="content">
                    <div class="shipper-section">
                        <div class="section-title">Shipper</div>
                        <div class="detail-row"><div class="detail-label">Company:</div><div class="detail-value">EASY SHOPPING ZONE BY PURE LIFE FAMILY CARE</div></div>
                        <div class="detail-row"><div class="detail-label">Phone No:</div><div class="detail-value">03147686866</div></div>
                        <div class="detail-row"><div class="detail-label">Pickup/Return Address:</div><div class="detail-value">SHOP NO.2, AL SAEED MARKET KHAN..MUZAFFARGARH</div></div>
                    </div>
                    <div class="consignee-section">
                        <div class="section-title">Consignee</div>
                        <div class="detail-row"><div class="detail-label">Name:</div><div class="detail-value">${d.customer}</div></div>
                        <div class="detail-row"><div class="detail-label">Phone No:</div><div class="detail-value">${d.mobile}</div></div>
                        <div class="detail-row"><div class="detail-label">Address:</div><div class="detail-value urdu">${d.address}</div></div>
                    </div>
                </div>
                <div class="ref-row">
                    <div class="ref-cell">Reference No. #</div>
                    <div class="ref-cell">Order ID:</div>
                    <div class="ref-cell">COD Amount</div>
                    <div class="ref-cell"><span class="amount">Rs: ${d.price || '0'}.00</span></div>
                </div>
                <div class="product-row">
                    <div class="detail-label">Product Description:</div>
                    <div class="detail-value">${d.product || 'RBC-500'}</div>
                </div>
                <div class="bottom-section">
                    <div class="instruction-section">
                        <div class="detail-row" style="border-bottom: none;">
                            <div class="detail-label">Special Instruction</div>
                            <div class="detail-value">${d.notes || ''}</div>
                        </div>
                    </div>
                    <div class="branding-section">
                        <div class="leopards-text">Leopards</div>
                        <div class="leopards-tagline">There for You</div>
                        <svg viewBox="0 0 80 80" width="55" height="55" style="margin-top: 5px;">
                            <rect x="0" y="0" width="80" height="80" fill="white"/>
                            <rect x="5" y="5" width="22" height="22" fill="black"/>
                            <rect x="53" y="5" width="22" height="22" fill="black"/>
                            <rect x="5" y="53" width="22" height="22" fill="black"/>
                            <rect x="9" y="9" width="14" height="14" fill="white"/>
                            <rect x="57" y="9" width="14" height="14" fill="white"/>
                            <rect x="9" y="57" width="14" height="14" fill="white"/>
                            <rect x="12" y="12" width="8" height="8" fill="black"/>
                            <rect x="60" y="12" width="8" height="8" fill="black"/>
                            <rect x="12" y="60" width="8" height="8" fill="black"/>
                            <rect x="32" y="32" width="16" height="16" fill="black"/>
                            <rect x="36" y="36" width="8" height="8" fill="white"/>
                        </svg>
                    </div>
                </div>
                <div class="footer">In case of any complaint or replacement please call at Shipper Number mentioned above.</div>
            </div>`;
        } else {
            // Bridge slip
            html += `
            <div class="slip-page">
                <div class="header">
                    <div class="logo-box">
                        <div class="bridge-line"></div>
                        <div class="bridge-text">Bridge</div>
                        <div class="bridge-tagline">TOWARDS FUTURE</div>
                    </div>
                    <div class="barcode-box">
                        <div class="barcode-text">|||||||||||||||||||||||||</div>
                        <div class="tracking">${trackingNo}</div>
                    </div>
                    <div class="info-grid">
                        <div class="info-cell"><div class="info-label">Date</div><div class="info-value">${orderDate}</div></div>
                        <div class="info-cell"><div class="info-label">Weight:</div><div class="info-value">0.5 Kg</div></div>
                        <div class="info-cell"><div class="info-label">Services</div><div class="info-value">Overnight</div></div>
                        <div class="info-cell"><div class="info-label">Booking Type:</div><div class="info-value">Invoice</div></div>
                        <div class="info-cell"><div class="info-label">Origin</div><div class="info-value">Muzaffargarh</div></div>
                        <div class="info-cell"><div class="info-label">Destination</div><div class="info-value">${d.city || '---'}</div></div>
                    </div>
                </div>
                <div class="content">
                    <div class="shipper-section">
                        <div class="section-title">Shipper</div>
                        <div class="detail-row"><div class="detail-label">Company:</div><div class="detail-value">EASY SHOPPING ZONE KHAN GARH</div></div>
                        <div class="detail-row"><div class="detail-label">Phone No:</div><div class="detail-value">0311-7686862</div></div>
                        <div class="detail-row"><div class="detail-label">Pickup Address:</div><div class="detail-value">NEAR HBL BANK KHAN GARH (MUZAFFARGARH)</div></div>
                    </div>
                    <div class="consignee-section">
                        <div class="section-title">Consignee</div>
                        <div class="detail-row"><div class="detail-label">Name:</div><div class="detail-value">${d.customer}</div></div>
                        <div class="detail-row"><div class="detail-label">Phone No:</div><div class="detail-value">${d.mobile}</div></div>
                        <div class="detail-row"><div class="detail-label">Address:</div><div class="detail-value urdu">${d.address}</div></div>
                    </div>
                </div>
                <div class="ref-row">
                    <div class="ref-cell">Reference No. #</div>
                    <div class="ref-cell">Order ID:</div>
                    <div class="ref-cell">COD Amount</div>
                    <div class="ref-cell"><span class="amount" style="color: #006600;">Rs: ${d.price || '0'}.00</span></div>
                </div>
                <div class="product-row">
                    <div class="detail-label">Product Description:</div>
                    <div class="detail-value">${d.product || 'RBC-10'}</div>
                </div>
                <div class="bottom-section">
                    <div class="instruction-section">
                        <div class="detail-row" style="border-bottom: none;">
                            <div class="detail-label">Special Instruction</div>
                            <div class="detail-value">${d.notes || ''}</div>
                        </div>
                    </div>
                    <div class="branding-section">
                        <svg viewBox="0 0 80 80" width="60" height="60">
                            <rect x="0" y="0" width="80" height="80" fill="white"/>
                            <rect x="5" y="5" width="22" height="22" fill="black"/>
                            <rect x="53" y="5" width="22" height="22" fill="black"/>
                            <rect x="5" y="53" width="22" height="22" fill="black"/>
                            <rect x="9" y="9" width="14" height="14" fill="white"/>
                            <rect x="57" y="9" width="14" height="14" fill="white"/>
                            <rect x="9" y="57" width="14" height="14" fill="white"/>
                            <rect x="12" y="12" width="8" height="8" fill="black"/>
                            <rect x="60" y="12" width="8" height="8" fill="black"/>
                            <rect x="12" y="60" width="8" height="8" fill="black"/>
                            <rect x="32" y="32" width="16" height="16" fill="black"/>
                            <rect x="36" y="36" width="8" height="8" fill="white"/>
                        </svg>
                    </div>
                </div>
                <div class="footer">In case of any complaint or replacement please call at Shipper Number mentioned above.</div>
            </div>`;
        }
    });
    
    html += `</body></html>`;
    return html;
}

// Number to Urdu Words
function numberToUrdu(n) {
    const num = parseInt(n);
    if (isNaN(num)) return "";
    const map = { 
        2000: "دو ہزار", 
        1925: "انیس سو پچیس", 
        1500: "پندرہ سو", 
        1425: "چودہ سو پچیس", 
        2500: "پچیس سو",
        1000: "ایک ہزار",
        3000: "تین ہزار"
    };
    if (map[num]) return map[num] + " روپے";
    return num + " روپے"; 
}

// Print Money Order
function printMO(index) {
    const d = allOrders[index];
    const moAmount = parseInt(d.price || 0) - 75;
    const amountInWords = numberToUrdu(moAmount);
    
    const getEmptyBoxes = () => {
        let html = '';
        for(let i = 0; i < 5; i++) {
            html += `<div style="width: 20px; height: 20px; border: 1px solid #000; display: inline-block; margin-right: 3px;"></div>`;
        }
        return html;
    };

    const html = `
    <!DOCTYPE html>
    <html lang="ur">
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');
            
            @page { size: A4; margin: 15mm; }
            body { 
                margin: 0; padding: 0;
                background: white; 
                font-family: 'Times New Roman', serif; 
                color: #000;
                -webkit-print-color-adjust: exact;
            }
            
            .mo-form { max-width: 190mm; margin: 0 auto; }

            .top-row { display: flex; gap: 20px; margin-bottom: 15px; }
            .stamp-box { width: 80px; height: 80px; border: 1px solid #000; padding: 2px; font-size:10px; }
            .oblong-box { width: 250px; height: 50px; border: 1px solid #000; padding: 2px; font-size:10px; }

            .u-line { border-bottom: 1px solid #000; flex: 1; text-align: center; font-weight: bold; font-family: Arial; font-size: 14px; padding-bottom: 2px; }
            .label-en { font-size: 14px; margin: 0 5px; }

            .price-row { display: flex; align-items: flex-end; margin-bottom: 10px; }
            
            .price-container { display: flex; align-items: center; margin-right: 15px; }
            .price-box { border: 2px solid #000; padding: 5px 10px; font-weight: bold; font-size: 20px; margin-left: 5px; min-width: 120px; display: flex; align-items: center; }
            
            .vp-details { flex: 1; display: flex; flex-direction: column; gap: 8px; }
            .vp-line-row { display: flex; align-items: flex-end; width: 100%; }

            .urdu-block { text-align: right; direction: rtl; font-family: 'Noto Nastaliq Urdu', serif; font-size: 13px; line-height: 1.6; margin: 10px 0; }
            
            .addr-table { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-top: 5px; }
            .addr-table td { border: 1px solid #000; vertical-align: top; }
            
            .col-label { width: 150px; background: #f0f0f0; text-align: right; font-family: 'Noto Nastaliq Urdu', serif; font-size: 12px; padding: 5px; line-height: 1.8; }
            .col-input { padding: 5px; position: relative; }
            
            .writing-line { border-bottom: 1px solid #000; height: 25px; width: 100%; margin-bottom: 5px; position: relative; }
            .line-data { position: absolute; bottom: 2px; left: 5px; font-family: Arial, sans-serif; font-weight: 900; font-size: 14px; width: 98%; white-space: nowrap; overflow: hidden; }

            .box-row { display: flex; gap: 3px; margin-top: 5px; }
            
            .intimation-sec { margin-top: 25px; }
            .int-row { display: flex; direction: rtl; align-items: flex-end; margin-bottom: 8px; font-family: 'Noto Nastaliq Urdu'; font-size: 13px; }
            .int-fill { border-bottom: 1px solid #000; flex: 1; text-align: center; font-family: Arial; font-weight: bold; margin: 0 5px; }

        </style>
    </head>
    <body>
    <div class="mo-form">
        
        <div class="top-row">
            <div class="stamp-box">Month Stamp</div>
            <div class="oblong-box">Oblong M. O. Stamp on Issue</div>
        </div>

        <div style="display:flex; align-items:flex-end; margin-bottom:10px;">
            <div style="width:50px; text-align:center; font-size:11px; line-height:1.2;">
                V.P.L.<br><div style="border-top:1px solid #000; width:30px; margin:2px auto;"></div>V.P.P.
            </div>
            <span class="label-en">M. O. No.</span>
            <div class="u-line"></div>
            <span class="label-en">date</span>
            <div class="u-line">${d.date}</div>
        </div>

        <div class="price-row">
            <div class="price-container">
                <span style="font-size:16px; font-weight:bold;">For</span>
                <div class="price-box">
                    <span style="font-weight:normal; margin-right:5px;">Rs.</span>
                    ${moAmount}
                </div>
            </div>
            
            <div class="vp-details">
                <div class="vp-line-row">
                    <span class="label-en" style="white-space:nowrap;">No. of V. P. Article</span>
                    <div class="u-line"></div>
                </div>
                <div class="vp-line-row">
                    <span class="label-en" style="white-space:nowrap;">(In words):</span>
                    <div class="u-line" style="font-family:'Noto Nastaliq Urdu'; text-align:right;">${amountInWords}</div>
                </div>
            </div>
        </div>

        <div style="border-bottom: 2px solid #000; margin: 15px 0;"></div>

        <div class="urdu-block">
            ذیل کے تمام اندراج بھیجنے والے کو کرنی ہیں۔<br>
            تصدیق کی جاتی ہے کہ منسلک قیمت طلب (V.P) 
            <span style="border-bottom:1px solid #000; font-weight:bold;">&nbsp; پارسل &nbsp;</span>
            کو باقاعدہ تحریر مطالبہ کے تحت، جو مجھے مل چکا ہے، بھیجا جا رہا ہے۔
        </div>

        <div class="int-row" style="justify-content: flex-start;">
            <span>رقم جو بھیجنے والے کو (ہندسوں میں)</span>
            <div class="int-fill" style="flex: 0 0 100px;">${moAmount}</div>
            <span>روپیہ</span>
            <div class="int-fill" style="flex: 0 0 60px;">00</div>
            <span>پیسہ</span>
        </div>
        
        <div class="int-row">
            <span>ارسال ہوگی (عبارت میں) مبلغ</span>
            <div class="int-fill" style="text-align:right; font-family:'Noto Nastaliq Urdu';">${amountInWords}</div>
            <span>فقط</span>
        </div>

        <table class="addr-table">
            <tr>
                <td class="col-input">
                    <div class="writing-line"><span class="line-data">${d.customer}</span></div>
                    <div class="writing-line"><span class="line-data">${d.address}</span></div>
                    <div class="writing-line"><span class="line-data">${d.mobile}</span></div>
                    <div class="box-row">${getEmptyBoxes()}</div>
                </td>
                <td class="col-label">
                    بھیجنے والے کا نام<br>
                    مکمل پتہ، ٹیلی فون نمبر<br>
                    شناختی کارڈ نمبر اور<br>
                    رشتہ داری / تعلق / ذریعہ آمدن<br>
                    رقم بھیجنے کی وجہ
                </td>
            </tr>

            <tr>
                <td class="col-input">
                    <div class="writing-line"><span class="line-data" style="font-size:16px;">EASY SHOPPING ZONE (KHAN GARH)</span></div>
                    <div class="writing-line"><span class="line-data">0311-7686862, 0335-6352625</span></div>
                    <div class="writing-line"><span class="line-data">CNIC: 35301-4550279-7</span></div>
                    <div class="box-row">${getEmptyBoxes()}</div>
                </td>
                <td class="col-label">
                    وصول کرنے والے کا نام<br>
                    مکمل پتہ، ٹیلی فون نمبر<br>
                    شناختی کارڈ نمبر اور<br>
                    رشتہ داری / تعلق
                </td>
            </tr>
        </table>

        <div style="border-bottom: 2px solid #000; margin: 20px 0;"></div>

        <div class="int-row" style="margin-top:10px;">
            <span style="flex:1; border-bottom:1px solid #000; padding-bottom:5px;">
                بھیجنے والے کے دستخط __________________________ تاریخ __________________
            </span>
        </div>

        <div class="intimation-sec">
            <h2 style="text-align:center; text-decoration:underline; margin:0 0 10px 0;">"INTIMATION" اطلاع</h2>
            
            <div style="float:left; width:70px; height:70px; border:1px solid #000; border-radius:50%; display:flex; align-items:center; justify-content:center; text-align:center; font-size:9px; margin-right:15px;">
                Date stamp of<br>the office of<br>issue
            </div>

            <div style="overflow:hidden;">
                <div class="int-row">
                    <span>مبلغ روپیہ</span>
                    <div class="int-fill">${moAmount}</div>
                    <span>پیسہ</span>
                    <div class="int-fill" style="width:60px; flex:none;">00</div>
                </div>

                <div class="int-row">
                    <span>برائے</span>
                    <div class="int-fill">Easy Shopping Zone</div>
                    <span style="font-size:11px;">(دفتر اجراء کا نام)</span>
                    <div class="int-fill">Khan Garh PO</div>
                </div>

                <div class="int-row">
                    <span>قیمت طلب *</span>
                    <div class="int-fill">${moAmount}</div>
                    <span>تاریخ</span>
                    <div class="int-fill">${d.date}</div>
                </div>

                <div class="int-row">
                    <span>نمبر قطعہ</span>
                    <div class="int-fill"></div>
                </div>

                <div class="int-row">
                    <span>بنام</span>
                    <div class="int-fill">${d.customer}</div>
                </div>

                <div class="int-row">
                    <span>پوسٹ کوڈ</span>
                    <div style="display:flex; gap:3px; margin-right:10px; flex:1; justify-content:flex-end;">
                        ${getEmptyBoxes()}
                    </div>
                </div>
            </div>
            
            <div style="clear:both;"></div>
            <div style="text-align:right; font-family:'Noto Nastaliq Urdu'; font-size:11px; margin-top:5px;">
                * یہاں لیٹر، پیکٹ یا پارسل جو بھی صورت ہو تحریر کریں۔
            </div>
        </div>

    </div>
    </body>
    </html>
    `;
    printContent(html);
}

// Bulk Print Money Orders (Multiple M.O on separate pages)
function printSelectedMO() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    if (checkboxes.length === 0) {
        UI.showToast('Please select orders to print M.O slips', 'warning');
        return;
    }
    
    const selectedIndexes = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    // Filter only Post Office orders
    const poIndexes = selectedIndexes.filter(idx => {
        const order = allOrders[idx];
        return (order.courier || '').toLowerCase().includes('post');
    });
    
    if (poIndexes.length === 0) {
        UI.showToast('No Post Office orders selected! M.O only works for PO orders.', 'warning');
        return;
    }
    
    // Generate all M.O forms
    let combinedHTML = `<!DOCTYPE html>
    <html lang="ur">
    <head>
        <meta charset="UTF-8">
        <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap');
            
            @page { size: A4; margin: 10mm; }
            body { margin: 0; padding: 0; background: white; font-family: 'Times New Roman', serif; color: #000; -webkit-print-color-adjust: exact; }
            
            .mo-page { page-break-after: always; padding: 10mm; }
            .mo-page:last-child { page-break-after: auto; }
            
            .mo-form { max-width: 190mm; margin: 0 auto; }
            .top-row { display: flex; gap: 20px; margin-bottom: 15px; }
            .stamp-box { width: 80px; height: 80px; border: 1px solid #000; padding: 2px; font-size:10px; }
            .oblong-box { width: 250px; height: 50px; border: 1px solid #000; padding: 2px; font-size:10px; }
            .u-line { border-bottom: 1px solid #000; flex: 1; text-align: center; font-weight: bold; font-family: Arial; font-size: 14px; padding-bottom: 2px; }
            .label-en { font-size: 14px; margin: 0 5px; }
            .price-row { display: flex; align-items: flex-end; margin-bottom: 10px; }
            .price-container { display: flex; align-items: center; margin-right: 15px; }
            .price-box { border: 2px solid #000; padding: 5px 10px; font-weight: bold; font-size: 20px; margin-left: 5px; min-width: 120px; display: flex; align-items: center; }
            .vp-details { flex: 1; display: flex; flex-direction: column; gap: 8px; }
            .vp-line-row { display: flex; align-items: flex-end; width: 100%; }
            .urdu-block { text-align: right; direction: rtl; font-family: 'Noto Nastaliq Urdu', serif; font-size: 13px; line-height: 1.6; margin: 10px 0; }
            .addr-table { width: 100%; border-collapse: collapse; border: 1px solid #000; margin-top: 5px; }
            .addr-table td { border: 1px solid #000; vertical-align: top; }
            .col-label { width: 150px; background: #f0f0f0; text-align: right; font-family: 'Noto Nastaliq Urdu', serif; font-size: 12px; padding: 5px; line-height: 1.8; }
            .col-input { padding: 5px; position: relative; }
            .writing-line { border-bottom: 1px solid #000; height: 25px; width: 100%; margin-bottom: 5px; position: relative; }
            .line-data { position: absolute; bottom: 2px; left: 5px; font-family: Arial, sans-serif; font-weight: 900; font-size: 14px; width: 98%; white-space: nowrap; overflow: hidden; }
            .box-row { display: flex; gap: 3px; margin-top: 5px; }
            .digit-box { width: 20px; height: 20px; border: 1px solid #000; display: inline-block; margin-right: 3px; }
            .intimation-sec { margin-top: 25px; }
            .int-row { display: flex; direction: rtl; align-items: flex-end; margin-bottom: 8px; font-family: 'Noto Nastaliq Urdu'; font-size: 13px; }
            .int-fill { border-bottom: 1px solid #000; flex: 1; text-align: center; font-family: Arial; font-weight: bold; margin: 0 5px; }
        </style>
    </head>
    <body>`;
    
    poIndexes.forEach(idx => {
        const d = allOrders[idx];
        const moAmount = parseInt(d.price || 0) - 75;
        const amountInWords = numberToUrdu(moAmount);
        const emptyBoxes = '<div class="digit-box"></div>'.repeat(5);
        
        combinedHTML += `
        <div class="mo-page">
            <div class="mo-form">
                <div class="top-row">
                    <div class="stamp-box">Month Stamp</div>
                    <div class="oblong-box">Oblong M. O. Stamp on Issue</div>
                </div>
                <div style="display:flex; align-items:flex-end; margin-bottom:10px;">
                    <div style="width:50px; text-align:center; font-size:11px; line-height:1.2;">V.P.L.<br><div style="border-top:1px solid #000; width:30px; margin:2px auto;"></div>V.P.P.</div>
                    <span class="label-en">M. O. No.</span>
                    <div class="u-line"></div>
                    <span class="label-en">date</span>
                    <div class="u-line">${d.date}</div>
                </div>
                <div class="price-row">
                    <div class="price-container">
                        <span style="font-size:16px; font-weight:bold;">For</span>
                        <div class="price-box"><span style="font-weight:normal; margin-right:5px;">Rs.</span>${moAmount}</div>
                    </div>
                    <div class="vp-details">
                        <div class="vp-line-row"><span class="label-en" style="white-space:nowrap;">No. of V. P. Article</span><div class="u-line"></div></div>
                        <div class="vp-line-row"><span class="label-en" style="white-space:nowrap;">(In words):</span><div class="u-line" style="font-family:'Noto Nastaliq Urdu'; text-align:right;">${amountInWords}</div></div>
                    </div>
                </div>
                <div style="border-bottom: 2px solid #000; margin: 15px 0;"></div>
                <div class="urdu-block">ذیل کے تمام اندراج بھیجنے والے کو کرنی ہیں۔<br>تصدیق کی جاتی ہے کہ منسلک قیمت طلب (V.P) <span style="border-bottom:1px solid #000; font-weight:bold;">&nbsp; پارسل &nbsp;</span> کو باقاعدہ تحریر مطالبہ کے تحت، جو مجھے مل چکا ہے، بھیجا جا رہا ہے۔</div>
                <div class="int-row" style="justify-content: flex-start;"><span>رقم جو بھیجنے والے کو (ہندسوں میں)</span><div class="int-fill" style="flex: 0 0 100px;">${moAmount}</div><span>روپیہ</span><div class="int-fill" style="flex: 0 0 60px;">00</div><span>پیسہ</span></div>
                <div class="int-row"><span>ارسال ہوگی (عبارت میں) مبلغ</span><div class="int-fill" style="text-align:right; font-family:'Noto Nastaliq Urdu';">${amountInWords}</div><span>فقط</span></div>
                <table class="addr-table">
                    <tr>
                        <td class="col-input">
                            <div class="writing-line"><span class="line-data">${d.customer}</span></div>
                            <div class="writing-line"><span class="line-data">${d.address}</span></div>
                            <div class="writing-line"><span class="line-data">${d.mobile}</span></div>
                            <div class="box-row">${emptyBoxes}</div>
                        </td>
                        <td class="col-label">بھیجنے والے کا نام<br>مکمل پتہ، ٹیلی فون نمبر<br>شناختی کارڈ نمبر اور<br>رشتہ داری / تعلق / ذریعہ آمدن<br>رقم بھیجنے کی وجہ</td>
                    </tr>
                    <tr>
                        <td class="col-input">
                            <div class="writing-line"><span class="line-data" style="font-size:16px;">EASY SHOPPING ZONE (KHAN GARH)</span></div>
                            <div class="writing-line"><span class="line-data">0311-7686862, 0335-6352625</span></div>
                            <div class="writing-line"><span class="line-data">CNIC: 35301-4550279-7</span></div>
                            <div class="box-row">${emptyBoxes}</div>
                        </td>
                        <td class="col-label">وصول کرنے والے کا نام<br>مکمل پتہ، ٹیلی فون نمبر<br>شناختی کارڈ نمبر اور<br>رشتہ داری / تعلق</td>
                    </tr>
                </table>
                <div style="border-bottom: 2px solid #000; margin: 20px 0;"></div>
                <div class="int-row" style="margin-top:10px;"><span style="flex:1; border-bottom:1px solid #000; padding-bottom:5px;">بھیجنے والے کے دستخط __________________________ تاریخ __________________</span></div>
                <div class="intimation-sec">
                    <h2 style="text-align:center; text-decoration:underline; margin:0 0 10px 0;">"INTIMATION" اطلاع</h2>
                    <div style="float:left; width:70px; height:70px; border:1px solid #000; border-radius:50%; display:flex; align-items:center; justify-content:center; text-align:center; font-size:9px; margin-right:15px;">Date stamp of<br>the office of<br>issue</div>
                    <div style="overflow:hidden;">
                        <div class="int-row"><span>مبلغ روپیہ</span><div class="int-fill">${moAmount}</div><span>پیسہ</span><div class="int-fill" style="width:60px; flex:none;">00</div></div>
                        <div class="int-row"><span>برائے</span><div class="int-fill">Easy Shopping Zone</div><span style="font-size:11px;">(دفتر اجراء کا نام)</span><div class="int-fill">Khan Garh PO</div></div>
                        <div class="int-row"><span>قیمت طلب *</span><div class="int-fill">${moAmount}</div><span>تاریخ</span><div class="int-fill">${d.date}</div></div>
                        <div class="int-row"><span>نمبر قطعہ</span><div class="int-fill"></div></div>
                        <div class="int-row"><span>بنام</span><div class="int-fill">${d.customer}</div></div>
                        <div class="int-row"><span>پوسٹ کوڈ</span><div style="display:flex; gap:3px; margin-right:10px; flex:1; justify-content:flex-end;">${emptyBoxes}</div></div>
                    </div>
                    <div style="clear:both;"></div>
                    <div style="text-align:right; font-family:'Noto Nastaliq Urdu'; font-size:11px; margin-top:5px;">* یہاں لیٹر، پیکٹ یا پارسل جو بھی صورت ہو تحریر کریں۔</div>
                </div>
            </div>
        </div>`;
    });
    
    combinedHTML += `</body></html>`;
    printContent(combinedHTML);
    
    UI.showToast(`Printing ${poIndexes.length} Money Order slips...`, 'success');
}

// ============================================
// 🏷️ Print Labels for Leopards (RS / Bridge)
// رائیڈر کو پارسل دینے کا ریکارڈ
// ============================================
function printSelectedLabels() {
    const checkboxes = document.querySelectorAll('.order-checkbox:checked');
    if (checkboxes.length === 0) {
        UI.showToast('Please select orders to print labels', 'warning');
        return;
    }
    
    const selectedIndexes = Array.from(checkboxes).map(cb => parseInt(cb.value));
    
    // Filter only Leopards (RS/Bridge) orders
    const leopardsIndexes = selectedIndexes.filter(idx => {
        const order = allOrders[idx];
        const courier = (order.courier || '').toLowerCase();
        return courier.includes('leopards') || courier.includes('rs') || courier.includes('bridge');
    });
    
    if (leopardsIndexes.length === 0) {
        UI.showToast('No Leopards orders selected! Labels only work for RS/Bridge orders.', 'warning');
        return;
    }
    
    const today = new Date().toLocaleDateString('en-GB');
    let totalCOD = 0;
    
    // Calculate total COD
    leopardsIndexes.forEach(idx => {
        totalCOD += parseInt(allOrders[idx].price || 0);
    });
    
    // Generate rows for each order
    let orderRows = '';
    leopardsIndexes.forEach((idx, i) => {
        const d = allOrders[idx];
        const courier = (d.courier || '').toUpperCase();
        orderRows += `
            <tr>
                <td style="text-align: center; font-weight: bold;">${i + 1}</td>
                <td>${d.customer}</td>
                <td>${d.mobile}</td>
                <td>${d.product || 'N/A'}</td>
                <td style="text-align: center;">${courier.includes('RS') ? 'RS' : 'Bridge'}</td>
                <td style="text-align: right; font-weight: bold;">Rs. ${d.price || 0}</td>
            </tr>
        `;
    });
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page { size: A4; margin: 10mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { 
                font-family: Arial, sans-serif; 
                font-size: 12px; 
                padding: 15px; 
                background: white; 
            }
            
            .label-sheet { 
                max-width: 750px; 
                margin: 0 auto; 
                border: 2px solid #333; 
                padding: 20px;
            }
            
            .header { 
                text-align: center; 
                border-bottom: 2px solid #333; 
                padding-bottom: 15px; 
                margin-bottom: 20px;
            }
            .header h1 { 
                font-size: 20px; 
                color: #1a365d; 
                margin-bottom: 5px;
            }
            .header h2 { 
                font-size: 16px; 
                color: #666; 
                font-weight: normal;
            }
            
            .info-row { 
                display: flex; 
                justify-content: space-between; 
                margin-bottom: 15px;
                padding: 10px;
                background: #f5f5f5;
                border-radius: 5px;
            }
            .info-item { 
                display: flex; 
                gap: 10px;
            }
            .info-label { 
                font-weight: bold; 
                color: #666;
            }
            .info-value { 
                font-weight: bold; 
                color: #333;
            }
            
            table { 
                width: 100%; 
                border-collapse: collapse; 
                margin: 15px 0;
            }
            th, td { 
                border: 1px solid #999; 
                padding: 8px 10px; 
                text-align: left;
            }
            th { 
                background: #1a365d; 
                color: white; 
                font-weight: bold;
            }
            tr:nth-child(even) { 
                background: #f9f9f9; 
            }
            
            .total-row { 
                display: flex; 
                justify-content: space-between;
                align-items: center;
                margin-top: 20px;
                padding: 15px;
                background: #e8f5e9;
                border: 2px solid #4caf50;
                border-radius: 5px;
            }
            .total-label { 
                font-size: 16px; 
                font-weight: bold;
            }
            .total-value { 
                font-size: 24px; 
                font-weight: bold; 
                color: #2e7d32;
            }
            
            .signature-section { 
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px dashed #999;
            }
            .signature-row { 
                display: flex; 
                justify-content: space-between;
                margin-top: 15px;
            }
            .signature-box { 
                width: 45%;
            }
            .signature-line { 
                border-bottom: 1px solid #333; 
                height: 50px; 
                margin-bottom: 5px;
            }
            .signature-label { 
                text-align: center; 
                font-size: 11px; 
                color: #666;
            }
            
            .footer { 
                margin-top: 20px; 
                text-align: center; 
                font-size: 10px; 
                color: #999;
            }
        </style>
    </head>
    <body>
        <div class="label-sheet">
            <div class="header">
                <h1>🐆 LEOPARDS COURIER - PARCEL HANDOVER RECORD</h1>
                <h2>پارسل حوالگی ریکارڈ</h2>
            </div>
            
            <div class="info-row">
                <div class="info-item">
                    <span class="info-label">Date / تاریخ:</span>
                    <span class="info-value">${today}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Total Parcels / کل پارسلز:</span>
                    <span class="info-value">${leopardsIndexes.length}</span>
                </div>
                <div class="info-item">
                    <span class="info-label">Shipper:</span>
                    <span class="info-value">Easy Shopping Zone</span>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th style="width: 40px;">#</th>
                        <th>Customer Name</th>
                        <th>Mobile</th>
                        <th>Product</th>
                        <th style="width: 60px;">Account</th>
                        <th style="width: 100px; text-align: right;">COD Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${orderRows}
                </tbody>
            </table>
            
            <div class="total-row">
                <span class="total-label">Total COD Amount / کل COD رقم:</span>
                <span class="total-value">Rs. ${totalCOD.toLocaleString()}</span>
            </div>
            
            <div class="signature-section">
                <p style="margin-bottom: 10px; font-weight: bold;">Confirmation / تصدیق:</p>
                <p style="font-size: 11px; color: #666; margin-bottom: 15px;">
                    I confirm that I have received the above mentioned parcels for delivery.
                    <br>
                    میں تصدیق کرتا ہوں کہ مندرجہ بالا پارسلز ڈیلیوری کے لیے وصول کر لیے ہیں۔
                </p>
                
                <div class="signature-row">
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <div class="signature-label">Rider Name & Signature / رائیڈر کا نام اور دستخط</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <div class="signature-label">Shipper Signature / بھیجنے والے کے دستخط</div>
                    </div>
                </div>
                
                <div class="signature-row">
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <div class="signature-label">Rider CNIC / رائیڈر شناختی کارڈ نمبر</div>
                    </div>
                    <div class="signature-box">
                        <div class="signature-line"></div>
                        <div class="signature-label">Time / وقت</div>
                    </div>
                </div>
            </div>
            
            <div class="footer">
                This document serves as proof of parcel handover to the courier rider. Keep this for your records.
                <br>
                یہ دستاویز کوریئر رائیڈر کو پارسل حوالگی کا ثبوت ہے۔ اپنے ریکارڈ کے لیے محفوظ رکھیں۔
            </div>
        </div>
    </body>
    </html>`;
    
    printContent(html);
    UI.showToast(`Printing labels for ${leopardsIndexes.length} Leopards orders...`, 'success');
}

// View Order Details (Modal)
function viewOrder(index) {
    const order = allOrders[index];
    UI.showToast(`Order #${order.id}: ${order.customer}`, 'info');
    // TODO: Implement modal for order details
}

// ============================================
// 📊 Dashboard Stats Update
// ============================================
function updateDashboardStats() {
    const stats = DataService.getStats();
    
    const elements = {
        'totalOrders': stats.totalOrders,
        'totalRevenue': UI.formatCurrency(stats.totalRevenue),
        'todayOrders': stats.todayOrders,
        'avgOrderValue': UI.formatCurrency(stats.avgOrderValue)
    };
    
    Object.entries(elements).forEach(([id, value]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    });
}

// ============================================
// 🚀 Page Initialization
// ============================================
document.addEventListener('DOMContentLoaded', async () => {
    // Check Auth (except login page)
    if (!window.location.pathname.includes('index.html')) {
        Auth.checkAuth();
        
        // Update user info in sidebar
        const user = Auth.getCurrentUser();
        if (user) {
            const userNameEl = document.querySelector('.user-info h4');
            const userRoleEl = document.querySelector('.user-info span');
            const userAvatarEl = document.querySelector('.user-avatar');
            
            if (userNameEl) userNameEl.textContent = user.name;
            if (userRoleEl) userRoleEl.textContent = user.role;
            if (userAvatarEl) userAvatarEl.textContent = UI.getInitials(user.name);
        }
    }
    
    // Page-specific initialization
    const path = window.location.pathname;
    
    if (path.includes('dashboard.html')) {
        // Dashboard Page
        const orders = await DataService.fetchOrders();
        updateDashboardStats();
    }
    
    if (path.includes('orders.html')) {
        // Orders Page
        const orders = await DataService.fetchOrders();
        renderOrdersTable(orders);
        
        // Add checkbox change listeners
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('order-checkbox')) {
                updateBulkActions();
            }
        });
    }
    
    if (path.includes('booking.html')) {
        // Booking Form
        const form = document.getElementById('bookingForm');
        if (form) {
            form.addEventListener('submit', handleBookingSubmit);
        }
    }
});

// ============================================
// 🗑️ Delete Order Function
// ============================================
function deleteOrder(index) {
    const order = allOrders[index];
    if (confirm(`کیا آپ واقعی یہ آرڈر ڈیلیٹ کرنا چاہتے ہیں?\n\nCustomer: ${order.customer}\nAmount: Rs. ${order.price}`)) {
        // Remove from local array
        allOrders.splice(index, 1);
        renderOrdersTable(allOrders);
        UI.showToast('Order deleted successfully!', 'success');
        
        // Note: To delete from Google Sheets, you'll need to implement a DELETE endpoint in your Apps Script
    }
}

// ============================================
// 🖨️ Print Slip Based on Courier Type
// ============================================
function printSlipByCourier(index) {
    const order = allOrders[index];
    const courier = (order.courier || '').toLowerCase();
    
    if (courier.includes('leopards') && courier.includes('rs')) {
        printLeopardsRS(index);
    } else if (courier.includes('leopards') && courier.includes('bridge')) {
        printLeopardsBridge(index);
    } else if (courier.includes('tcs')) {
        printTCS(index);
    } else {
        // Default: Post Office slip
        printSingleSlip(index);
    }
}

// ============================================
// 🐆 Leopards R&S Slip Design (Exact Replica)
// ============================================
function printLeopardsRS(index) {
    const d = allOrders[index];
    const today = new Date().toLocaleDateString('en-GB');
    const trackingNo = 'MG' + Date.now().toString().slice(-10);
    const orderDate = d.date ? UI.formatDate(d.date) : today;
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page { size: A4; margin: 8mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 11px; padding: 15px; background: white; }
            
            .slip { width: 100%; max-width: 750px; margin: 0 auto; border: 2px solid #333; background: #fff; }
            
            /* Header Section */
            .header { display: flex; border-bottom: 2px solid #333; }
            
            /* R&S Logo */
            .logo-box { 
                width: 85px; 
                padding: 8px; 
                border-right: 1px solid #ccc; 
                display: flex; 
                flex-direction: column; 
                justify-content: center; 
                align-items: center;
            }
            .rs-text { 
                font-family: 'Times New Roman', Georgia, serif; 
                font-size: 36px; 
                font-weight: bold; 
                color: #1a3a5c; 
                line-height: 1;
            }
            .logistics { font-size: 12px; color: #1a3a5c; font-style: italic; margin-top: -2px; }
            
            /* Barcode Section */
            .barcode-box { 
                flex: 1; 
                padding: 8px; 
                border-right: 1px solid #ccc; 
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
            }
            .color-stripes {
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 30px;
                display: flex;
            }
            .color-stripes div { flex: 1; }
            .barcode-text { 
                font-family: 'Libre Barcode 128', 'Courier New', monospace; 
                font-size: 45px; 
                letter-spacing: -2px;
                margin-left: 30px;
            }
            .tracking { font-size: 13px; font-weight: bold; margin-top: 3px; }
            
            /* Info Grid */
            .info-grid { display: flex; flex-wrap: wrap; width: 280px; }
            .info-cell { 
                width: 50%; 
                padding: 4px 8px; 
                border: 1px solid #ccc; 
                background: #f9f9f9;
            }
            .info-label { font-size: 9px; color: #666; }
            .info-value { font-size: 11px; font-weight: bold; }
            
            /* Main Content */
            .content { display: flex; }
            .shipper-section, .consignee-section { flex: 1; }
            .shipper-section { border-right: 1px solid #333; }
            
            .section-title { 
                background: #e5e5e5; 
                padding: 5px 10px; 
                font-weight: bold; 
                text-align: center; 
                border-bottom: 1px solid #999;
            }
            
            .detail-row { 
                display: flex; 
                border-bottom: 1px solid #ccc; 
                min-height: 28px;
            }
            .detail-label { 
                width: 100px; 
                padding: 5px 8px; 
                background: #fafafa; 
                font-weight: bold; 
                font-size: 10px;
                border-right: 1px solid #ccc;
            }
            .detail-value { 
                flex: 1; 
                padding: 5px 8px; 
                font-size: 11px;
            }
            
            /* Reference Row */
            .ref-row { 
                display: flex; 
                border-bottom: 1px solid #333;
            }
            .ref-cell { 
                flex: 1; 
                padding: 5px 8px; 
                border-right: 1px solid #ccc; 
                font-weight: bold;
                font-size: 10px;
            }
            .ref-cell:last-child { border-right: none; }
            .amount { font-size: 18px; font-weight: bold; color: #c00; }
            
            /* Product Row */
            .product-row { 
                display: flex; 
                border-bottom: 1px solid #ccc;
            }
            
            /* Bottom Section */
            .bottom-section { display: flex; border-bottom: 1px solid #333; }
            .instruction-section { flex: 1; }
            .branding-section { 
                width: 150px; 
                padding: 8px; 
                text-align: center;
                border-left: 1px solid #ccc;
            }
            .leopards-text { 
                font-family: 'Brush Script MT', cursive; 
                font-size: 22px; 
                color: #b8860b; 
                font-style: italic;
            }
            .leopards-tagline { font-size: 9px; color: #666; }
            
            /* Footer */
            .footer { 
                padding: 8px; 
                text-align: center; 
                color: #c00; 
                font-size: 11px; 
                font-weight: bold;
            }
            
            /* Urdu */
            .urdu { direction: rtl; text-align: right; }
        </style>
    </head>
    <body>
        <div class="slip">
            <!-- HEADER -->
            <div class="header">
                <div class="logo-box">
                    <div class="rs-text">R&S</div>
                    <div class="logistics">logistics</div>
                </div>
                <div class="barcode-box">
                    <div class="color-stripes">
                        <div style="background: #e53935;"></div>
                        <div style="background: #fb8c00;"></div>
                        <div style="background: #fdd835;"></div>
                        <div style="background: #43a047;"></div>
                        <div style="background: #1e88e5;"></div>
                        <div style="background: #5e35b1;"></div>
                    </div>
                    <div class="barcode-text">|||||||||||||||||||||||||</div>
                    <div class="tracking">${trackingNo}</div>
                </div>
                <div class="info-grid">
                    <div class="info-cell"><div class="info-label">Date</div><div class="info-value">${orderDate}</div></div>
                    <div class="info-cell"><div class="info-label">Weight :</div><div class="info-value">2 Kg</div></div>
                    <div class="info-cell"><div class="info-label">Services</div><div class="info-value">Overnight</div></div>
                    <div class="info-cell"><div class="info-label">Booking Type :</div><div class="info-value">Invoice</div></div>
                    <div class="info-cell"><div class="info-label">Origin</div><div class="info-value">Muzaffargarh</div></div>
                    <div class="info-cell"><div class="info-label">Destination</div><div class="info-value">${d.city || '---'}</div></div>
                </div>
            </div>
            
            <!-- SHIPPER & CONSIGNEE -->
            <div class="content">
                <div class="shipper-section">
                    <div class="section-title">Shipper</div>
                    <div class="detail-row">
                        <div class="detail-label">Company:</div>
                        <div class="detail-value">EASY SHOPPING ZONE BY PURE LIFE FAMILY CARE</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Phone No:</div>
                        <div class="detail-value">03147686866</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Pickup/Return Address:</div>
                        <div class="detail-value">SHOP NO.2, AL SAEED MARKET KHAN..MUZAFFARGARH</div>
                    </div>
                </div>
                <div class="consignee-section">
                    <div class="section-title">Consignee</div>
                    <div class="detail-row">
                        <div class="detail-label">Name:</div>
                        <div class="detail-value">${d.customer}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Phone No :</div>
                        <div class="detail-value">${d.mobile}</div>
                    </div>
                    <div class="detail-row">
                        <div class="detail-label">Address:</div>
                        <div class="detail-value urdu">${d.address}</div>
                    </div>
                </div>
            </div>
            
            <!-- REFERENCE ROW -->
            <div class="ref-row">
                <div class="ref-cell">Reference No. #</div>
                <div class="ref-cell">Order ID. :</div>
                <div class="ref-cell">COD Amount</div>
                <div class="ref-cell"><span class="amount">Rs: ${d.price || '0'}.00</span></div>
            </div>
            
            <!-- PRODUCT -->
            <div class="product-row">
                <div class="detail-label">Product Description :</div>
                <div class="detail-value">${d.product || 'RBC-500'}</div>
            </div>
            
            <!-- BOTTOM -->
            <div class="bottom-section">
                <div class="instruction-section">
                    <div class="detail-row" style="border-bottom: none;">
                        <div class="detail-label">Special Instruction</div>
                        <div class="detail-value">${d.notes || ''}</div>
                    </div>
                </div>
                <div class="branding-section">
                    <div class="leopards-text">Leopards</div>
                    <div class="leopards-tagline">There for You</div>
                    <svg viewBox="0 0 80 80" width="55" height="55" style="margin-top: 5px;">
                        <rect x="0" y="0" width="80" height="80" fill="white"/>
                        <rect x="5" y="5" width="22" height="22" fill="black"/>
                        <rect x="53" y="5" width="22" height="22" fill="black"/>
                        <rect x="5" y="53" width="22" height="22" fill="black"/>
                        <rect x="9" y="9" width="14" height="14" fill="white"/>
                        <rect x="57" y="9" width="14" height="14" fill="white"/>
                        <rect x="9" y="57" width="14" height="14" fill="white"/>
                        <rect x="12" y="12" width="8" height="8" fill="black"/>
                        <rect x="60" y="12" width="8" height="8" fill="black"/>
                        <rect x="12" y="60" width="8" height="8" fill="black"/>
                        <rect x="32" y="5" width="5" height="5" fill="black"/>
                        <rect x="42" y="5" width="5" height="5" fill="black"/>
                        <rect x="32" y="32" width="16" height="16" fill="black"/>
                        <rect x="36" y="36" width="8" height="8" fill="white"/>
                    </svg>
                </div>
            </div>
            
            <!-- FOOTER -->
            <div class="footer">
                In case of any complaint or replacement please call at Shipper Number mentioned above.
            </div>
        </div>
    </body>
    </html>`;
    
    printContent(html);
}

// ============================================
// 🌉 Leopards Bridge Slip Design (Exact Replica)
// ============================================
function printLeopardsBridge(index) {
    const d = allOrders[index];
    const today = new Date().toLocaleDateString('en-GB').replace(/\//g, '/');
    const trackingNo = 'MG' + Date.now().toString().slice(-10);
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page { size: A4; margin: 5mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; font-size: 11px; padding: 10px; background: white; }
            
            .slip { width: 100%; max-width: 600px; margin: 0 auto; border: 1px solid #000; }
            
            .header-row { display: flex; border-bottom: 1px solid #000; }
            
            /* Bridge Logo */
            .logo-cell { width: 140px; padding: 8px; border-right: 1px solid #000; position: relative; }
            .bridge-logo {
                font-family: 'Segoe UI', Arial, sans-serif;
                font-size: 28px;
                font-weight: bold;
                font-style: italic;
                color: #000;
                letter-spacing: 2px;
            }
            .bridge-line {
                position: absolute;
                top: 8px;
                left: 5px;
                width: 60px;
                height: 2px;
                background: #000;
                transform: rotate(-25deg);
                transform-origin: left;
            }
            .bridge-tagline {
                font-size: 7px;
                letter-spacing: 3px;
                color: #333;
                margin-top: 2px;
                border-top: 1px solid #000;
                padding-top: 2px;
            }
            
            .barcode-cell { width: 120px; padding: 5px; text-align: center; border-right: 1px solid #000; }
            .tracking { font-size: 10px; font-weight: bold; margin-top: 3px; }
            
            .info-grid { display: flex; flex-wrap: wrap; flex: 1; }
            .info-cell { width: 50%; padding: 3px 5px; border: 1px solid #ccc; font-size: 9px; }
            .info-label { color: #666; font-size: 8px; }
            .info-value { font-weight: bold; font-size: 9px; }
            
            .qr-cell { width: 70px; padding: 5px; display: flex; align-items: center; justify-content: center; border-left: 1px solid #000; }
            
            /* Sections */
            .section-header { background: #e8e8e8; padding: 3px 8px; font-weight: bold; text-align: center; border: 1px solid #000; font-size: 10px; }
            
            .details-table { width: 100%; border-collapse: collapse; }
            .details-table td { padding: 4px 6px; border: 1px solid #ccc; vertical-align: top; font-size: 10px; }
            .details-table .label { width: 80px; font-weight: bold; background: #fafafa; font-size: 9px; }
            
            .two-columns { display: flex; }
            .column { flex: 1; }
            .column:first-child { border-right: 1px solid #000; }
            
            /* Amount */
            .amount-row { display: flex; border-top: 1px solid #000; background: #f5f5f5; }
            .amount-row > div { flex: 1; padding: 4px 6px; border-right: 1px solid #ccc; font-size: 9px; }
            .amount-row > div:last-child { border-right: none; background: #e8f4e8; }
            .amount-value { font-size: 14px; font-weight: bold; color: #006600; }
            
            .footer { padding: 6px; text-align: center; font-size: 9px; color: #c00; border-top: 1px solid #000; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="slip">
            <!-- Header -->
            <div class="header-row">
                <div class="logo-cell">
                    <div class="bridge-line"></div>
                    <div class="bridge-logo">Bridge</div>
                    <div class="bridge-tagline">TOWARDS FUTURE</div>
                </div>
                <div class="barcode-cell">
                    <div style="font-family: monospace; font-size: 22px; letter-spacing: -1px;">|||||||||||||||||</div>
                    <div class="tracking">${trackingNo}</div>
                </div>
                <div class="info-grid">
                    <div class="info-cell"><div class="info-label">Date</div><div class="info-value">${d.date || today}</div></div>
                    <div class="info-cell"><div class="info-label">Weight:</div><div class="info-value">0.5 Kg</div></div>
                    <div class="info-cell"><div class="info-label">Services</div><div class="info-value">Overnight</div></div>
                    <div class="info-cell"><div class="info-label">Booking Type:</div><div class="info-value">Invoice</div></div>
                    <div class="info-cell"><div class="info-label">Origin</div><div class="info-value">Muzaffargarh</div></div>
                    <div class="info-cell"><div class="info-label">Destination</div><div class="info-value">---</div></div>
                </div>
                <div class="qr-cell">
                    <svg viewBox="0 0 100 100" width="55" height="55">
                        <!-- QR Code Pattern -->
                        <rect x="0" y="0" width="100" height="100" fill="white"/>
                        <rect x="5" y="5" width="25" height="25" fill="black"/>
                        <rect x="10" y="10" width="15" height="15" fill="white"/>
                        <rect x="13" y="13" width="9" height="9" fill="black"/>
                        <rect x="70" y="5" width="25" height="25" fill="black"/>
                        <rect x="75" y="10" width="15" height="15" fill="white"/>
                        <rect x="78" y="13" width="9" height="9" fill="black"/>
                        <rect x="5" y="70" width="25" height="25" fill="black"/>
                        <rect x="10" y="75" width="15" height="15" fill="white"/>
                        <rect x="13" y="78" width="9" height="9" fill="black"/>
                        <rect x="35" y="5" width="5" height="5" fill="black"/>
                        <rect x="45" y="5" width="5" height="5" fill="black"/>
                        <rect x="55" y="5" width="5" height="5" fill="black"/>
                        <rect x="35" y="35" width="30" height="30" fill="black"/>
                        <rect x="40" y="40" width="20" height="20" fill="white"/>
                        <rect x="45" y="45" width="10" height="10" fill="black"/>
                    </svg>
                </div>
            </div>
            
            <!-- Shipper & Consignee -->
            <div class="two-columns">
                <div class="column">
                    <div class="section-header">Shipper</div>
                    <table class="details-table">
                        <tr><td class="label">Company:</td><td>EASY SHOPPING ZONE KHAN GARH</td></tr>
                        <tr><td class="label">Phone No:</td><td>0311-7686862</td></tr>
                        <tr><td class="label">Pickup Address:</td><td>NEAR HBL BANK KHAN GARH (MUZAFFARGARH)</td></tr>
                    </table>
                </div>
                <div class="column">
                    <div class="section-header">Consignee</div>
                    <table class="details-table">
                        <tr><td class="label">Name:</td><td>${d.customer}</td></tr>
                        <tr><td class="label">Phone No:</td><td>${d.mobile}</td></tr>
                        <tr><td class="label">Address:</td><td>${d.address}</td></tr>
                    </table>
                </div>
            </div>
            
            <!-- Reference & COD -->
            <div class="amount-row">
                <div><strong>Reference No. #</strong></div>
                <div><strong>Order ID:</strong></div>
                <div><strong>COD Amount</strong></div>
                <div><span class="amount-value">Rs: ${d.price}.00</span></div>
            </div>
            
            <!-- Product -->
            <table class="details-table" style="border-top: none;">
                <tr><td class="label">Product Description:</td><td>${d.product || 'RBC-10'}</td></tr>
                <tr><td class="label">Special Instruction</td><td>URGENT DELIVERY (PLEASE CALL THE CUSTOMER BEFORE DELIVERY)</td></tr>
            </table>
            
            <!-- Footer -->
            <div class="footer">
                In case of any complaint or replacement please call at Shipper Number mentioned above.
            </div>
        </div>
    </body>
    </html>`;
    
    printContent(html);
}

// ============================================
// 🚚 TCS Slip Design (Basic)
// ============================================
function printTCS(index) {
    const d = allOrders[index];
    // For now, use the default slip - can be customized later
    printSingleSlip(index);
    UI.showToast('TCS slip printed (using default design)', 'info');
}

// Add slideOut animation for toast
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    .spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--gray-200);
        border-top-color: var(--primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto;
    }
    
    @keyframes spin {
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(styleSheet);
