// ========== GITHUB DATABASE CONFIG ==========
const GITHUB_USERNAME = "friscoregaza";
const GITHUB_REPO = "PJBL";
const GITHUB_BRANCH = "main";
const GITHUB_TOKEN = "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"; // GANTI DENGAN TOKEN BARU!

let currentUser = null;
let allUsers = [];
let charts = {};

// ========== LOAD DATA FROM GITHUB ==========
async function loadDataFromGitHub() {
    try {
        const url = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/${GITHUB_BRANCH}/database.json`;
        const response = await fetch(url);
        if (response.ok) {
            allUsers = await response.json();
            console.log("✅ Data loaded:", allUsers.length, "users");
            if (!Array.isArray(allUsers)) allUsers = [];
            return true;
        } else {
            allUsers = [];
            return false;
        }
    } catch (e) {
        console.error("Load error:", e);
        allUsers = [];
        return false;
    }
}

// ========== SAVE DATA TO GITHUB ==========
async function saveDataToGitHub() {
    try {
        // Get current file SHA
        const getUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/database.json`;
        const getRes = await fetch(getUrl, {
            headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' }
        });
        
        let sha = null;
        if (getRes.ok) {
            const data = await getRes.json();
            sha = data.sha;
        }
        
        // Update file
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(allUsers, null, 2))));
        const putRes = await fetch(getUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify({
                message: `Update data ${new Date().toISOString()}`,
                content: content,
                sha: sha,
                branch: GITHUB_BRANCH
            })
        });
        
        if (putRes.ok) {
            console.log("✅ Data saved to GitHub");
            showNotification("Data tersimpan ke cloud!", "success");
            return true;
        } else {
            const err = await putRes.json();
            console.error("Save error:", err);
            showNotification("Gagal menyimpan: " + err.message, "error");
            return false;
        }
    } catch (e) {
        console.error("Save error:", e);
        showNotification("Gagal menyimpan data!", "error");
        return false;
    }
}

// ========== USER FUNCTIONS ==========
async function registerUser(fullname, username, email, password) {
    if (allUsers.find(u => u.username === username)) {
        showNotification("Username sudah digunakan!", "error");
        return false;
    }
    
    const newUser = {
        id: Date.now(),
        fullname, username, email, password,
        achievementPoints: 0,
        badges: [],
        transactions: [
            { id: Date.now() + 1, tanggal: new Date().toISOString().slice(0,10), deskripsi: 'Selamat datang!', kategori: 'Penghasilan', jenis: 'pemasukan', jumlah: 100000 }
        ],
        dailyLogin: { streak: 0, totalLogins: 0 }
    };
    
    allUsers.push(newUser);
    const saved = await saveDataToGitHub();
    if (saved) {
        showNotification("Pendaftaran berhasil! Silakan login.", "success");
        return true;
    } else {
        allUsers.pop();
        showNotification("Gagal menyimpan ke cloud!", "error");
        return false;
    }
}

async function loginUser(username, password) {
    const user = allUsers.find(u => u.username === username && u.password === password);
    if (user) {
        currentUser = user;
        showNotification(`Selamat datang, ${user.fullname}!`, "success");
        return true;
    }
    showNotification("Username atau password salah!", "error");
    return false;
}

function getAllTransaksi() {
    return currentUser?.transactions || [];
}

async function saveTransactions(transactions) {
    if (!currentUser) return;
    currentUser.transactions = transactions;
    const index = allUsers.findIndex(u => u.id === currentUser.id);
    if (index !== -1) {
        allUsers[index] = currentUser;
        await saveDataToGitHub();
        renderDashboard();
    }
}

async function addTransaction(transaction) {
    const transactions = getAllTransaksi();
    transaction.id = Date.now();
    transactions.push(transaction);
    await saveTransactions(transactions);
}

async function deleteTransaction(id) {
    const transactions = getAllTransaksi().filter(t => t.id !== id);
    await saveTransactions(transactions);
}

// ========== RENDER FUNCTIONS ==========
function formatRupiah(angka) {
    return new Intl.NumberFormat('id-ID').format(angka);
}

function renderDashboard() {
    if (!currentUser) return;
    
    const transactions = getAllTransaksi();
    const pemasukan = transactions.filter(t => t.jenis === 'pemasukan').reduce((a,b) => a + b.jumlah, 0);
    const pengeluaran = transactions.filter(t => t.jenis === 'pengeluaran').reduce((a,b) => a + b.jumlah, 0);
    const saldo = pemasukan - pengeluaran;
    
    document.getElementById('totalPemasukan').innerHTML = `Rp ${formatRupiah(pemasukan)}`;
    document.getElementById('totalPengeluaran').innerHTML = `Rp ${formatRupiah(pengeluaran)}`;
    document.getElementById('saldoAkhir').innerHTML = `Rp ${formatRupiah(saldo)}`;
    
    // Player card
    const points = currentUser.achievementPoints || 0;
    document.getElementById('playerAchievementCard').innerHTML = `
        <div class="flex items-center gap-4">
            <div class="level-badge w-16 h-16 rounded-2xl flex items-center justify-center"><i class="fas fa-medal text-2xl"></i></div>
            <div><h2 class="text-xl font-bold">${currentUser.fullname}</h2><p class="text-yellow-400">${points} Points</p></div>
            <div class="flex-1"><div class="h-2 bg-gray-700 rounded-full"><div class="achievement-bar-bg h-full rounded-full" style="width: ${Math.min((points/500)*100,100)}%"></div></div></div>
        </div>
    `;
    
    // Table
    let html = '';
    transactions.forEach(t => {
        let badgeClass = t.jenis === 'pemasukan' ? 'text-emerald-400' : 'text-rose-400';
        html += `<tr class="border-b border-white/10"><td class="p-2">${t.tanggal}</td><td>${t.deskripsi}</td><td><span class="badge-kategori kebutuhan-pokok">${t.kategori}</span></td><td class="${badgeClass}">${t.jenis === 'pemasukan' ? 'Pemasukan' : 'Pengeluaran'}</td><td class="text-right ${badgeClass}">Rp ${formatRupiah(t.jumlah)}</td><td class="text-center"><i class="fas fa-trash text-red-400 cursor-pointer" onclick="hapusTransaksi(${t.id})"></i></td></tr>`;
    });
    document.getElementById('transaksiTableBody').innerHTML = html || '<tr><td colspan="6" class="text-center py-8">Belum ada transaksi</td></tr>';
}

function showNotification(msg, type = 'info') {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerHTML = msg;
    container.appendChild(notif);
    setTimeout(() => notif.remove(), 3000);
}

// ========== GLOBAL FUNCTIONS ==========
window.hapusTransaksi = async (id) => {
    if (confirm('Hapus transaksi ini?')) {
        await deleteTransaction(id);
        renderDashboard();
    }
};

window.editTransaksi = (id) => {
    // Implement edit if needed
};

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', async () => {
    console.log("🚀 Starting app...");
    await loadDataFromGitHub();
    console.log("Users in DB:", allUsers);
    
    // Theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    setTheme(savedTheme);
    
    // Tab switching
    document.getElementById('loginTab').onclick = () => {
        document.getElementById('loginForm').classList.remove('hidden');
        document.getElementById('registerForm').classList.add('hidden');
    };
    document.getElementById('registerTab').onclick = () => {
        document.getElementById('registerForm').classList.remove('hidden');
        document.getElementById('loginForm').classList.add('hidden');
    };
    
    // Login
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('loginUsername').value;
        const password = document.getElementById('loginPassword').value;
        const success = await loginUser(username, password);
        if (success) {
            document.getElementById('loginContainer').classList.add('hidden');
            document.getElementById('dashboardContainer').classList.remove('hidden');
            document.getElementById('sidebarUsername').innerText = currentUser.fullname;
            document.getElementById('sidebarEmail').innerText = currentUser.email;
            renderDashboard();
            initCharts();
        }
    });
    
    // Register
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullname = document.getElementById('regFullname').value;
        const username = document.getElementById('regUsername').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regConfirmPassword').value;
        if (password !== confirm) { showNotification("Password tidak cocok!", "error"); return; }
        if (password.length < 6) { showNotification("Password minimal 6 karakter!", "error"); return; }
        await registerUser(fullname, username, email, password);
    });
    
    // Logout
    document.getElementById('logoutBtnSide').onclick = () => {
        currentUser = null;
        document.getElementById('loginContainer').classList.remove('hidden');
        document.getElementById('dashboardContainer').classList.add('hidden');
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
    };
    
    // Add transaction
    document.getElementById('tambahBtn').onclick = () => {
        document.getElementById('transaksiForm').reset();
        document.getElementById('editId').value = '';
        document.getElementById('modalTitle').innerText = 'Tambah Transaksi';
        document.getElementById('transaksiModal').classList.remove('hidden');
    };
    
    document.getElementById('saveBtn').onclick = async () => {
        const tanggal = document.getElementById('tanggal').value;
        const deskripsi = document.getElementById('deskripsi').value;
        const kategori = document.getElementById('kategori').value;
        const jenis = document.getElementById('jenis').value;
        const jumlah = parseFloat(document.getElementById('jumlah').value);
        if (!tanggal || !deskripsi || !kategori || !jumlah) {
            showNotification("Data tidak lengkap!", "error");
            return;
        }
        await addTransaction({ tanggal, deskripsi, kategori, jenis, jumlah });
        document.getElementById('transaksiModal').classList.add('hidden');
        renderDashboard();
    };
    
    document.getElementById('closeModalBtn').onclick = () => {
        document.getElementById('transaksiModal').classList.add('hidden');
    };
    document.getElementById('modalBackdrop').onclick = () => {
        document.getElementById('transaksiModal').classList.add('hidden');
    };
    
    // Theme toggle
    document.getElementById('themeToggle').onclick = () => {
        setTheme(document.body.classList.contains('theme-dark') ? 'light' : 'dark');
    };
    
    // Page navigation
    document.querySelectorAll('.menu-item').forEach(item => {
        item.onclick = () => {
            document.querySelectorAll('.page-content').forEach(p => p.classList.add('hidden'));
            document.getElementById(`page${item.dataset.page.charAt(0).toUpperCase() + item.dataset.page.slice(1)}`).classList.remove('hidden');
        };
    });
    
    // Export
    document.getElementById('exportDataBtn').onclick = () => {
        const data = getAllTransaksi();
        if (!data.length) { showNotification("Tidak ada data!", "error"); return; }
        const format = document.getElementById('formatFile').value;
        let content, filename;
        if (format === 'json') {
            content = JSON.stringify(data, null, 2);
            filename = `keuangan_${new Date().toISOString().slice(0,19)}.json`;
        } else if (format === 'csv') {
            const headers = ['tanggal','deskripsi','kategori','jenis','jumlah'];
            const rows = data.map(t => headers.map(h => t[h]).join(','));
            content = [headers.join(','), ...rows].join('\n');
            filename = `keuangan_${new Date().toISOString().slice(0,19)}.csv`;
        } else { return; }
        const blob = new Blob([content], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
    };
});

function setTheme(theme) {
    if (theme === 'light') {
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
        localStorage.setItem('theme', 'light');
        document.getElementById('themeText').innerText = 'Dark Mode';
    } else {
        document.body.classList.remove('theme-light');
        document.body.classList.add('theme-dark');
        localStorage.setItem('theme', 'dark');
        document.getElementById('themeText').innerText = 'Light Mode';
    }
}

function initCharts() {
    charts.lineChart = new ApexCharts(document.querySelector("#lineChart"), {
        chart: { type: 'area', height: 350, background: 'transparent' },
        series: [{ name: 'Saldo', data: [0] }],
        colors: ['#a855f7']
    });
    charts.lineChart.render();
}
