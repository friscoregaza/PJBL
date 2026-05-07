// ========== GAMIFIED FINANCE - GITHUB DATABASE VERSION ==========
// Data disimpan di file database.json di repository GitHub

// ========== KONFIGURASI GITHUB ==========
// 🔥 GANTI DENGAN REPO KAMU 🔥
const GITHUB_USERNAME = "friscoregaza";
const GITHUB_REPO = "PJBL";
const GITHUB_BRANCH = "main";
const JSON_FILE_PATH = "database.json";

// Personal Access Token (dibuat di GitHub Settings)
const GITHUB_TOKEN = "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";

// ========== GLOBAL VARIABLES ==========
let currentUser = null;
let allUsers = [];

let charts = { lineChart: null, barChart: null, pieChart: null, sparkIncome: null, sparkExpense: null, sparkBalance: null };
let analyticsChart = { pie: null, bar: null };

let currentFilter = { jenis: 'semua', kategori: 'semua', search: '', timeRange: 'week' };
let laporanFilter = { startDate: '', endDate: '', kategori: 'semua', jenis: 'semua' };

let soundSuccess = null, soundLevelUp = null, soundNotification = null;

// ========== HELPER FUNCTIONS ==========
function formatRupiah(angka) { 
    return new Intl.NumberFormat('id-ID').format(angka); 
}

function escapeHtml(str) { 
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m){ 
        if(m==='&') return '&amp;'; 
        if(m==='<') return '&lt;'; 
        if(m==='>') return '&gt;'; 
        return m;
    }); 
}

// ========== GITHUB DATABASE FUNCTIONS ==========

// Ambil SHA file database.json (dibutuhkan untuk update)
async function getFileSHA() {
    try {
        const response = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${JSON_FILE_PATH}`, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.sha;
        }
        return null;
    } catch (error) {
        console.error("Error getting SHA:", error);
        return null;
    }
}

// Baca data dari database.json
async function loadDataFromGitHub() {
    try {
        showNotification('Sync', 'Mengambil data dari GitHub...', 'info', false, 2000);
        
        const response = await fetch(`https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/${GITHUB_BRANCH}/${JSON_FILE_PATH}`);
        
        if (response.ok) {
            const data = await response.json();
            if (Array.isArray(data)) {
                allUsers = data;
                console.log('✅ Data loaded from GitHub:', allUsers.length, 'users');
                showNotification('Sync', `Data dimuat (${allUsers.length} pengguna)`, 'success', true, 2000);
                return true;
            }
        }
        
        // Jika file kosong atau tidak ada, inisialisasi array kosong
        allUsers = [];
        return true;
    } catch (error) {
        console.error("Error loading from GitHub:", error);
        showNotification('Error', 'Gagal mengambil data dari GitHub', 'error', true, 3000);
        allUsers = [];
        return false;
    }
}

// Simpan data ke database.json
async function saveDataToGitHub() {
    try {
        showNotification('Sync', 'Menyimpan data ke GitHub...', 'info', false, 2000);
        
        // Dapatkan SHA file
        const sha = await getFileSHA();
        
        // Siapkan konten baru (encode ke base64)
        const content = btoa(unescape(encodeURIComponent(JSON.stringify(allUsers, null, 2))));
        
        // Siapkan payload untuk update
        const payload = {
            message: `Update data ${new Date().toLocaleString()}`,
            content: content,
            branch: GITHUB_BRANCH
        };
        
        if (sha) {
            payload.sha = sha;
        }
        
        const response = await fetch(`https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/${JSON_FILE_PATH}`, {
            method: 'PUT',
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'Accept': 'application/vnd.github.v3+json'
            },
            body: JSON.stringify(payload)
        });
        
        if (response.ok) {
            console.log('✅ Data saved to GitHub:', allUsers.length, 'users');
            showNotification('Sync', 'Data berhasil disimpan ke GitHub!', 'success', true, 2000);
            return true;
        } else {
            const error = await response.json();
            throw new Error(error.message);
        }
    } catch (error) {
        console.error("Error saving to GitHub:", error);
        showNotification('Error', 'Gagal menyimpan data ke GitHub: ' + error.message, 'error', true, 3000);
        return false;
    }
}

// ========== USER MANAGEMENT ==========
async function registerUser(fullname, username, email, password) {
    // Cek username sudah ada
    if (allUsers.find(u => u.username === username)) {
        return { success: false, message: "Username sudah digunakan!" };
    }
    // Cek email sudah ada
    if (allUsers.find(u => u.email === email)) {
        return { success: false, message: "Email sudah terdaftar!" };
    }
    
    const newUser = {
        id: Date.now(),
        fullname: fullname,
        username: username,
        email: email,
        password: password,
        achievementPoints: 0,
        badges: [],
        transactions: [],
        dailyLogin: {
            lastLoginDate: null,
            streak: 0,
            totalLogins: 0,
            lastClaimed: null
        },
        createdAt: new Date().toISOString()
    };
    
    const defaultTransactions = [
        { id: Date.now() + 1, tanggal: new Date().toISOString().slice(0,10), deskripsi: 'Selamat datang di Gamified Finance!', kategori: 'Penghasilan', jenis: 'pemasukan', jumlah: 100000 },
        { id: Date.now() + 2, tanggal: new Date().toISOString().slice(0,10), deskripsi: 'Contoh transaksi belanja', kategori: 'Belanja', jenis: 'pengeluaran', jumlah: 50000 }
    ];
    newUser.transactions = defaultTransactions;
    
    allUsers.push(newUser);
    await saveDataToGitHub();
    
    return { success: true, message: "Pendaftaran berhasil!" };
}

async function loginUser(username, password) {
    const user = allUsers.find(u => u.username === username && u.password === password);
    if (user) {
        // Update daily login streak
        const today = new Date().toDateString();
        const dailyData = user.dailyLogin || { lastLoginDate: null, streak: 0, totalLogins: 0, lastClaimed: null };
        
        let newStreak = dailyData.streak;
        if (dailyData.lastLoginDate) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const lastLoginDate = new Date(dailyData.lastLoginDate);
            if (lastLoginDate.toDateString() === yesterday.toDateString()) {
                newStreak = dailyData.streak + 1;
            } else if (lastLoginDate.toDateString() !== today) {
                newStreak = 1;
            }
        } else {
            newStreak = 1;
        }
        
        user.dailyLogin = {
            ...dailyData,
            lastLoginDate: new Date().toISOString(),
            streak: newStreak,
            totalLogins: (dailyData.totalLogins || 0) + 1
        };
        
        // Update data di allUsers
        const index = allUsers.findIndex(u => u.username === username);
        if (index !== -1) {
            allUsers[index] = user;
            await saveDataToGitHub();
        }
        
        return { success: true, user: user };
    }
    return { success: false, message: "Username atau password salah!" };
}

async function logoutUser() {
    currentUser = null;
    await loadDataFromGitHub(); // Refresh data
    return true;
}

function getAllTransaksi() {
    if (!currentUser) return [];
    return currentUser.transactions || [];
}

async function saveData(transactions) {
    if (!currentUser) return;
    
    // Update user di allUsers
    const index = allUsers.findIndex(u => u.username === currentUser.username);
    if (index !== -1) {
        currentUser.transactions = transactions;
        allUsers[index] = currentUser;
        await saveDataToGitHub();
    }
    
    updateAllUI();
}

async function createTransaksi(t) {
    let data = getAllTransaksi();
    t.id = Date.now();
    data.push(t);
    await saveData(data);
    addAchievementPoint(1, document.getElementById('saveBtn'));
    return true;
}

async function updateTransaksi(id, upd) {
    let data = getAllTransaksi();
    let idx = data.findIndex(t => t.id == id);
    if (idx !== -1) {
        data[idx] = { ...data[idx], ...upd };
        await saveData(data);
        return true;
    }
    return false;
}

async function deleteTransaksi(id) {
    let data = getAllTransaksi();
    let newData = data.filter(t => t.id != id);
    if (newData.length !== data.length) {
        await saveData(newData);
        return true;
    }
    return false;
}

// ========== ACHIEVEMENT SYSTEM ==========
function addAchievementPoint(amount, sourceElement = null) {
    if (!currentUser) return;
    currentUser.achievementPoints = (currentUser.achievementPoints || 0) + amount;
    if (sourceElement) showAchievementFloat(amount, sourceElement);
    updatePlayerUI();
    checkAchievements();
    
    if (amount >= 10) {
        canvasConfetti({ particleCount: 80, spread: 60, origin: { y: 0.6 }, colors: ['#00ff00', '#009900'] });
    }
}

function showAchievementFloat(amount, element) {
    let floatDiv = document.createElement('div');
    floatDiv.className = 'achievement-float';
    floatDiv.innerHTML = amount > 0 ? `✨ +${amount} Points ✨` : `💔 ${amount} Points 💔`;
    floatDiv.style.color = amount > 0 ? '#f59e0b' : '#f43f5e';
    floatDiv.style.left = (element?.getBoundingClientRect().left + 50) + 'px';
    floatDiv.style.top = (element?.getBoundingClientRect().top) + 'px';
    document.body.appendChild(floatDiv);
    setTimeout(() => floatDiv.remove(), 1000);
}

function checkAchievements() {
    if (!currentUser) return;
    let allTrans = getAllTransaksi();
    let totalSave = allTrans.filter(t => t.kategori === 'Penghasilan' && t.jenis === 'pemasukan').reduce((a, b) => a + b.jumlah, 0);
    let achievementPoints = currentUser.achievementPoints || 0;
    let newBadges = [];
    let badgeAdded = false;
    
    if (achievementPoints >= 10 && !currentUser.badges.includes('points10')) {
        currentUser.badges.push('points10'); newBadges.push('10 Achievement Points'); addAchievementPoint(5); badgeAdded = true;
    }
    if (achievementPoints >= 50 && !currentUser.badges.includes('points50')) {
        currentUser.badges.push('points50'); newBadges.push('50 Achievement Points'); addAchievementPoint(10); badgeAdded = true;
    }
    if (achievementPoints >= 100 && !currentUser.badges.includes('points100')) {
        currentUser.badges.push('points100'); newBadges.push('100 Achievement Points'); addAchievementPoint(15); badgeAdded = true;
    }
    if (achievementPoints >= 200 && !currentUser.badges.includes('points200')) {
        currentUser.badges.push('points200'); newBadges.push('200 Achievement Points'); addAchievementPoint(20); badgeAdded = true;
    }
    if (achievementPoints >= 500 && !currentUser.badges.includes('points500')) {
        currentUser.badges.push('points500'); newBadges.push('500 Achievement Points - Master!'); addAchievementPoint(30); badgeAdded = true;
    }
    if (totalSave >= 100000 && !currentUser.badges.includes('target100k')) {
        currentUser.badges.push('target100k'); newBadges.push('Capai 100K'); addAchievementPoint(10); badgeAdded = true;
    }
    if (totalSave >= 500000 && !currentUser.badges.includes('target500k')) {
        currentUser.badges.push('target500k'); newBadges.push('Gacoan 500K'); addAchievementPoint(15); badgeAdded = true;
    }
    if (totalSave >= 1000000 && !currentUser.badges.includes('target1juta')) {
        currentUser.badges.push('target1juta'); newBadges.push('1 Juta!'); addAchievementPoint(25); badgeAdded = true;
    }
    if (allTrans.length >= 10 && !currentUser.badges.includes('trans10')) {
        currentUser.badges.push('trans10'); newBadges.push('10 Transaksi'); addAchievementPoint(10); badgeAdded = true;
    }
    if (allTrans.length >= 50 && !currentUser.badges.includes('trans50')) {
        currentUser.badges.push('trans50'); newBadges.push('50 Transaksi'); addAchievementPoint(20); badgeAdded = true;
    }
    if (allTrans.length >= 100 && !currentUser.badges.includes('trans100')) {
        currentUser.badges.push('trans100'); newBadges.push('100 Transaksi - Pro!'); addAchievementPoint(30); badgeAdded = true;
    }
    
    const dailyData = currentUser.dailyLogin;
    if (dailyData && dailyData.streak >= 7 && !currentUser.badges.includes('streak7')) {
        currentUser.badges.push('streak7'); newBadges.push('7 Hari Streak!'); addAchievementPoint(15); badgeAdded = true;
    }
    if (dailyData && dailyData.streak >= 30 && !currentUser.badges.includes('streak30')) {
        currentUser.badges.push('streak30'); newBadges.push('30 Hari Streak!'); addAchievementPoint(30); badgeAdded = true;
    }
    
    if (badgeAdded) {
        showNotification('Achievement Baru!', newBadges.join(', '), 'achievement', true, 5000);
        playSound('levelup');
        canvasConfetti({ particleCount: 150, spread: 80, origin: { y: 0.7 }, colors: ['#00ff00', '#009900', '#00cc00'] });
    }
    
    // Update ke GitHub
    const index = allUsers.findIndex(u => u.username === currentUser.username);
    if (index !== -1) {
        allUsers[index] = currentUser;
        saveDataToGitHub();
    }
}

function updatePlayerUI() {
    if (!currentUser) return;
    let achievementPoints = currentUser.achievementPoints || 0;
    let badgeCount = currentUser.badges?.length || 0;
    
    let title = "";
    if (achievementPoints >= 500) title = "Legenda Sejati";
    else if (achievementPoints >= 200) title = "Raja Keuangan";
    else if (achievementPoints >= 100) title = "Sultan Muda";
    else if (achievementPoints >= 50) title = "Master Budget";
    else if (achievementPoints >= 20) title = "Pejuang Rupiah";
    else if (achievementPoints >= 5) title = "Pemula Hemat";
    else title = "Petualang Baru";
    
    let card = document.getElementById('playerAchievementCard');
    if (card) {
        card.innerHTML = `
            <div class="flex flex-wrap justify-between items-center gap-4">
                <div class="flex items-center gap-4">
                    <div class="level-badge w-20 h-20 rounded-2xl flex flex-col items-center justify-center text-white">
                        <i class="fas fa-medal text-3xl"></i>
                    </div>
                    <div>
                        <h2 class="text-xl font-bold">${escapeHtml(currentUser.fullname || currentUser.username)}</h2>
                        <p class="text-yellow-400 text-sm">${title}</p>
                        <div class="flex gap-2 mt-1">
                            <span class="text-xs bg-yellow-500/20 px-2 py-0.5 rounded-full"><i class="fas fa-medal"></i> ${badgeCount} Badge</span>
                            <span class="text-xs bg-purple-500/20 px-2 py-0.5 rounded-full"><i class="fas fa-star"></i> ${achievementPoints} Points</span>
                        </div>
                    </div>
                </div>
                <div class="flex-1 min-w-[200px]">
                    <div class="flex justify-between text-sm mb-1">
                        <span><i class="fas fa-trophy text-yellow-400"></i> Achievement Points: ${achievementPoints}</span>
                        <span>Target 500: Master</span>
                    </div>
                    <div class="h-3 bg-gray-700 rounded-full overflow-hidden">
                        <div class="achievement-bar-bg h-full rounded-full" style="width: ${Math.min((achievementPoints / 500) * 100, 100)}%"></div>
                    </div>
                    <div class="flex justify-between text-xs text-gray-400 mt-1"><span>0</span><span>100</span><span>200</span><span>500</span></div>
                </div>
            </div>
        `;
    }
    renderBadges();
}

function renderBadges() {
    if (!currentUser) return;
    let allBadges = [
        { id: 'points10', name: '10 Points', icon: 'fa-star', desc: 'Kumpulkan 10 Achievement Points' },
        { id: 'points50', name: '50 Points', icon: 'fa-crown', desc: 'Kumpulkan 50 Achievement Points' },
        { id: 'points100', name: '100 Points', icon: 'fa-gem', desc: 'Kumpulkan 100 Achievement Points' },
        { id: 'points200', name: '200 Points', icon: 'fa-crown', desc: 'Kumpulkan 200 Achievement Points' },
        { id: 'points500', name: '500 Points', icon: 'fa-trophy', desc: 'Kumpulkan 500 Achievement Points - Master!' },
        { id: 'target100k', name: 'Target 100K', icon: 'fa-bullseye', desc: 'Total tabungan 100rb' },
        { id: 'target500k', name: 'Gacoan 500K', icon: 'fa-money-bill-wave', desc: 'Total tabungan 500rb' },
        { id: 'target1juta', name: '1 Juta!', icon: 'fa-sack-dollar', desc: 'Total tabungan 1 juta' },
        { id: 'trans10', name: '10 Transaksi', icon: 'fa-chart-line', desc: 'Melakukan 10 transaksi' },
        { id: 'trans50', name: '50 Transaksi', icon: 'fa-chart-simple', desc: 'Melakukan 50 transaksi' },
        { id: 'trans100', name: '100 Transaksi', icon: 'fa-chart-line', desc: 'Melakukan 100 transaksi - Pro!' },
        { id: 'streak7', name: '7 Hari Streak', icon: 'fa-fire', desc: 'Login 7 hari berturut-turut' },
        { id: 'streak30', name: '30 Hari Streak', icon: 'fa-calendar-check', desc: 'Login 30 hari berturut-turut' }
    ];
    let container = document.getElementById('badgeContainer');
    if (!container) return;
    container.innerHTML = allBadges.map(b => `
        <div class="glass-card p-4 text-center ${currentUser.badges?.includes(b.id) ? 'border-yellow-500' : 'opacity-50'}">
            <i class="fas ${b.icon} text-3xl ${currentUser.badges?.includes(b.id) ? 'text-yellow-400' : 'text-gray-500'} mb-2"></i>
            <p class="font-bold">${b.name}</p>
            <p class="text-xs text-gray-400">${b.desc}</p>
            ${currentUser.badges?.includes(b.id) ? '<span class="text-green-400 text-xs mt-1"><i class="fas fa-check-circle mr-1"></i>Unlocked</span>' : '<span class="text-gray-500 text-xs mt-1"><i class="fas fa-lock mr-1"></i>Locked</span>'}
        </div>
    `).join('');
}

function applyPenaltyIfBoros(kategori, jumlah, element) {
    if (kategori === 'Belanja' || kategori === 'Healing') {
        showNotification('Peringatan Boros!', 'Pengeluaran untuk keinginan. Ayo lebih hemat!', 'warning', true, 4000);
        playSound('warning');
    }
}

// ========== NOTIFICATION ==========
function showNotification(title, message, type = 'info', autoClose = true, duration = 3500) {
    const container = document.getElementById('notificationContainer');
    if (!container) return;
    
    const icons = { success: '🎉', warning: '⚠️', error: '❌', info: 'ℹ️', achievement: '🏆' };
    const icon = icons[type] || icons.info;
    const notif = document.createElement('div');
    notif.className = `notification ${type}`;
    notif.innerHTML = `<div class="notification-content"><div class="notification-icon">${icon}</div><div class="notification-message"><div class="notification-title">${title}</div><div class="notification-desc">${message}</div></div></div>`;
    
    container.appendChild(notif);
    
    if (autoClose) {
        setTimeout(() => { 
            notif.classList.add('hide'); 
            setTimeout(() => notif.remove(), 300); 
        }, duration);
    }
    return notif;
}

function playSound(type) {
    try {
        if (type === 'levelup' && soundLevelUp) {
            soundLevelUp.currentTime = 0;
            soundLevelUp.play().catch(e => console.log('Audio error:', e));
        } else if ((type === 'success' || type === 'warning') && soundSuccess) {
            soundSuccess.currentTime = 0;
            soundSuccess.play().catch(e => console.log('Audio error:', e));
        } else if (soundNotification) {
            soundNotification.currentTime = 0;
            soundNotification.play().catch(e => console.log('Audio error:', e));
        }
    } catch(e) { console.log('Audio error:', e); }
}

// ========== DAILY LOGIN ==========
function getDailyLoginData() {
    if (!currentUser) return null;
    if (!currentUser.dailyLogin) {
        currentUser.dailyLogin = {
            lastLoginDate: null,
            streak: 0,
            totalLogins: 0,
            lastClaimed: null
        };
    }
    return currentUser.dailyLogin;
}

function saveDailyLoginData(data) {
    if (!currentUser) return;
    currentUser.dailyLogin = data;
    const index = allUsers.findIndex(u => u.username === currentUser.username);
    if (index !== -1) {
        allUsers[index] = currentUser;
        saveDataToGitHub();
    }
}

function checkDailyLogin() {
    if (!currentUser) return { canClaim: false, streak: 0, message: "" };
    
    const today = new Date().toDateString();
    const dailyData = getDailyLoginData();
    const lastLogin = dailyData.lastLoginDate;
    const lastClaimed = dailyData.lastClaimed;
    
    if (lastClaimed === today) {
        return { canClaim: false, streak: dailyData.streak, message: "Anda sudah mengambil daily reward hari ini!" };
    }
    
    let newStreak = dailyData.streak;
    if (lastLogin) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const lastLoginDate = new Date(lastLogin);
        
        if (lastLoginDate.toDateString() === yesterday.toDateString()) {
            newStreak = dailyData.streak + 1;
        } else if (lastLoginDate.toDateString() !== today) {
            newStreak = 1;
        }
    } else {
        newStreak = 1;
    }
    
    return { canClaim: true, streak: newStreak, message: `Streak: ${newStreak} hari!`, newStreak: newStreak };
}

function claimDailyReward() {
    if (!currentUser) return false;
    
    const today = new Date().toDateString();
    const dailyData = getDailyLoginData();
    
    if (dailyData.lastClaimed === today) {
        showNotification('Info', 'Anda sudah mengambil daily reward hari ini!', 'info', true, 3000);
        return false;
    }
    
    const check = checkDailyLogin();
    if (!check.canClaim) {
        showNotification('Info', check.message, 'info', true, 3000);
        return false;
    }
    
    let rewardPoints = 5;
    let rewardMessage = "";
    
    if (check.streak >= 30) {
        rewardPoints = 50;
        rewardMessage = "Luar biasa! 30 hari streak! +50 Points!";
    } else if (check.streak >= 14) {
        rewardPoints = 25;
        rewardMessage = "Hebat! 14 hari streak! +25 Points!";
    } else if (check.streak >= 7) {
        rewardPoints = 15;
        rewardMessage = "Mantap! 7 hari streak! +15 Points!";
    } else if (check.streak >= 3) {
        rewardPoints = 10;
        rewardMessage = "Bagus! 3 hari streak! +10 Points!";
    } else {
        rewardMessage = `Streak ${check.streak} hari! +5 Points!`;
    }
    
    dailyData.lastLoginDate = new Date().toISOString();
    dailyData.lastClaimed = today;
    dailyData.streak = check.newStreak;
    dailyData.totalLogins = (dailyData.totalLogins || 0) + 1;
    saveDailyLoginData(dailyData);
    
    addAchievementPoint(rewardPoints);
    
    showNotification('Daily Reward!', rewardMessage, 'success', true, 5000);
    playSound('success');
    updateDailyLoginUI();
    updatePlayerUI();
    
    return true;
}

function updateDailyLoginUI() {
    const container = document.getElementById('dailyLoginContainer');
    if (!container) return;
    
    const dailyData = getDailyLoginData();
    const check = checkDailyLogin();
    const streak = dailyData?.streak || 0;
    const totalLogins = dailyData?.totalLogins || 0;
    
    let nextReward = 5;
    if (streak >= 29) nextReward = 50;
    else if (streak >= 13) nextReward = 25;
    else if (streak >= 6) nextReward = 15;
    else if (streak >= 2) nextReward = 10;
    else nextReward = 5;
    
    container.innerHTML = `
        <div class="flex items-center justify-between flex-wrap gap-4">
            <div class="flex items-center gap-4">
                <div class="w-16 h-16 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center">
                    <i class="fas fa-calendar-check text-white text-2xl"></i>
                </div>
                <div>
                    <h3 class="font-bold text-lg">Daily Login Reward</h3>
                    <p class="text-sm text-gray-400">Login setiap hari untuk mendapatkan bonus!</p>
                </div>
            </div>
            <div class="flex items-center gap-6">
                <div class="text-center"><p class="text-2xl font-bold text-yellow-400">${streak}</p><p class="text-xs text-gray-400">Streak</p></div>
                <div class="text-center"><p class="text-2xl font-bold text-purple-400">${totalLogins}</p><p class="text-xs text-gray-400">Total Login</p></div>
                <div class="text-center"><p class="text-2xl font-bold text-green-400">+${nextReward}</p><p class="text-xs text-gray-400">Next Reward</p></div>
            </div>
            ${check.canClaim ? 
                `<button id="claimDailyBtn" class="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-6 py-2 rounded-xl font-semibold transition shadow-lg"><i class="fas fa-gift mr-2"></i> Claim Reward</button>` :
                `<button disabled class="bg-gray-600/50 px-6 py-2 rounded-xl font-semibold cursor-not-allowed"><i class="fas fa-check-circle mr-2"></i> Already Claimed</button>`
            }
        </div>
    `;
    
    const claimBtn = document.getElementById('claimDailyBtn');
    if (claimBtn) claimBtn.addEventListener('click', () => claimDailyReward());
}

function updateDailyLoginDetailPage() {
    const container = document.getElementById('dailyLoginDetailContainer');
    if (!container) return;
    
    const dailyData = getDailyLoginData();
    const check = checkDailyLogin();
    const streak = dailyData?.streak || 0;
    const totalLogins = dailyData?.totalLogins || 0;
    const lastLogin = dailyData?.lastLoginDate ? new Date(dailyData.lastLoginDate).toLocaleDateString('id-ID') : 'Belum pernah';
    const lastClaimed = dailyData?.lastClaimed || 'Belum pernah';
    
    let nextReward = 5, nextRewardDesc = "";
    if (streak >= 29) { nextReward = 50; nextRewardDesc = "30 Hari Streak! +50 Points"; }
    else if (streak >= 13) { nextReward = 25; nextRewardDesc = "14 Hari Streak! +25 Points"; }
    else if (streak >= 6) { nextReward = 15; nextRewardDesc = "7 Hari Streak! +15 Points"; }
    else if (streak >= 2) { nextReward = 10; nextRewardDesc = "3 Hari Streak! +10 Points"; }
    else { nextReward = 5; nextRewardDesc = "1 Hari Streak! +5 Points"; }
    
    container.innerHTML = `
        <div class="w-full">
            <div class="flex items-center justify-between flex-wrap gap-4 mb-6">
                <div class="flex items-center gap-4">
                    <div class="w-20 h-20 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center"><i class="fas fa-calendar-check text-white text-3xl"></i></div>
                    <div><h3 class="font-bold text-xl">Daily Login Reward</h3><p class="text-sm text-gray-400">Login setiap hari untuk mendapatkan bonus!</p></div>
                </div>
                ${check.canClaim ? 
                    `<button id="claimDailyDetailBtn" class="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 px-8 py-3 rounded-xl font-semibold transition shadow-lg text-lg"><i class="fas fa-gift mr-2"></i> Claim Reward Sekarang!</button>` :
                    `<button disabled class="bg-gray-600/50 px-8 py-3 rounded-xl font-semibold cursor-not-allowed text-lg"><i class="fas fa-check-circle mr-2"></i> Sudah Diambil Hari Ini</button>`
                }
            </div>
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div class="text-center p-4 bg-white/5 rounded-xl"><p class="text-3xl font-bold text-yellow-400">${streak}</p><p class="text-xs text-gray-400">Current Streak</p></div>
                <div class="text-center p-4 bg-white/5 rounded-xl"><p class="text-3xl font-bold text-purple-400">${totalLogins}</p><p class="text-xs text-gray-400">Total Login</p></div>
                <div class="text-center p-4 bg-white/5 rounded-xl"><p class="text-3xl font-bold text-green-400">+${nextReward}</p><p class="text-xs text-gray-400">Next Reward</p></div>
                <div class="text-center p-4 bg-white/5 rounded-xl"><p class="text-3xl font-bold text-sky-400">${nextRewardDesc.split('!')[0]}!</p><p class="text-xs text-gray-400">Target Streak</p></div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="p-4 bg-white/5 rounded-xl"><p class="text-sm text-gray-400"><i class="fas fa-clock mr-1"></i> Last Login</p><p class="font-semibold">${lastLogin}</p></div>
                <div class="p-4 bg-white/5 rounded-xl"><p class="text-sm text-gray-400"><i class="fas fa-gift mr-1"></i> Last Claim</p><p class="font-semibold">${lastClaimed}</p></div>
            </div>
        </div>
    `;
    
    const claimBtn = document.getElementById('claimDailyDetailBtn');
    if (claimBtn) claimBtn.addEventListener('click', () => { claimDailyReward(); setTimeout(() => { updateDailyLoginUI(); updateDailyLoginDetailPage(); }, 500); });
}

// ========== FILTER & RENDER ==========
function filterTransactions() {
    let all = getAllTransaksi();
    if (currentFilter.jenis !== 'semua') all = all.filter(t => t.jenis === currentFilter.jenis);
    if (currentFilter.kategori !== 'semua') all = all.filter(t => t.kategori === currentFilter.kategori);
    if (currentFilter.search) all = all.filter(t => t.deskripsi.toLowerCase().includes(currentFilter.search.toLowerCase()));
    const now = new Date();
    if (currentFilter.timeRange === 'week') { 
        let start = new Date(now); 
        start.setDate(now.getDate() - 7); 
        all = all.filter(t => new Date(t.tanggal) >= start); 
    } else if (currentFilter.timeRange === 'month') { 
        let start = new Date(now); 
        start.setMonth(now.getMonth() - 1); 
        all = all.filter(t => new Date(t.tanggal) >= start); 
    }
    return all;
}

function renderSummaryAndTable() {
    let filtered = filterTransactions();
    let pemasukan = filtered.reduce((sum, t) => t.jenis === 'pemasukan' ? sum + t.jumlah : sum, 0);
    let pengeluaran = filtered.reduce((sum, t) => t.jenis === 'pengeluaran' ? sum + t.jumlah : sum, 0);
    let saldo = pemasukan - pengeluaran;
    
    document.getElementById('totalPemasukan').innerHTML = `Rp ${formatRupiah(pemasukan)}`;
    document.getElementById('totalPengeluaran').innerHTML = `Rp ${formatRupiah(pengeluaran)}`;
    document.getElementById('saldoAkhir').innerHTML = `Rp ${formatRupiah(saldo)}`;
    
    let tbody = document.getElementById('transaksiTableBody');
    if (!tbody) return;
    
    if (filtered.length === 0) { 
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-8 text-gray-400">Tidak ada transaksi</td></tr>'; 
        return; 
    }
    
    let html = '';
    filtered.sort((a,b)=>new Date(b.tanggal)-new Date(a.tanggal)).forEach(t => {
        let jenisBadge = t.jenis === 'pemasukan' ? '<span class="bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full text-xs"><i class="fas fa-arrow-up mr-1"></i>Pemasukan</span>' : '<span class="bg-rose-500/20 text-rose-400 px-2 py-1 rounded-full text-xs"><i class="fas fa-arrow-down mr-1"></i>Pengeluaran</span>';
        let jumlahClass = t.jenis === 'pemasukan' ? 'text-emerald-400' : 'text-rose-400';
        let kategoriClassMap = {
            'Kebutuhan Pokok': 'kebutuhan-pokok', 'Belanja': 'belanja', 'Healing': 'healing', 'Penghasilan': 'penghasilan', 'Transport': 'transport'
        };
        let kategoriClass = kategoriClassMap[t.kategori] || '';
        let iconMap = {
            'Kebutuhan Pokok': 'fa-utensils', 'Belanja': 'fa-bag-shopping', 'Healing': 'fa-plane', 'Penghasilan': 'fa-money-bill-wave', 'Transport': 'fa-car'
        };
        let icon = iconMap[t.kategori] || 'fa-tag';
        let aksiHtml = `<div class="flex justify-center gap-3"><i class="fas fa-edit text-yellow-400 cursor-pointer hover:scale-110 transition" onclick="editTransaksi(${t.id})"></i><i class="fas fa-trash-alt text-red-400 cursor-pointer hover:scale-110 transition" onclick="hapusTransaksi(${t.id})"></i></div>`;
        html += `<tr><td class="p-3">${t.tanggal}</td><td class="p-3 font-medium">${escapeHtml(t.deskripsi)}</td><td class="p-3"><span class="badge-kategori ${kategoriClass}"><i class="fas ${icon}"></i> ${t.kategori}</span></td><td class="p-3">${jenisBadge}</td><td class="p-3 text-right ${jumlahClass} font-bold">Rp ${formatRupiah(t.jumlah)}</td><td class="p-3 text-center">${aksiHtml}</td></tr>`;
    });
    tbody.innerHTML = html;
    updateKategoriDropdown();
    updateChartsData();
    updateSparklines();
}

function updateKategoriDropdown() {
    let kategoriOptions = ['Kebutuhan Pokok', 'Belanja', 'Healing', 'Penghasilan', 'Transport'];
    let dropdown = document.getElementById('filterKategori');
    if (dropdown) {
        let currentVal = dropdown.value;
        dropdown.innerHTML = '<option value="semua">Semua Kategori</option>';
        kategoriOptions.forEach(k => { dropdown.innerHTML += `<option value="${k}">${k}</option>`; });
        dropdown.value = currentVal;
    }
}

function updateChartsData() {
    let filtered = filterTransactions();
    let grouped = {};
    filtered.forEach(t => { 
        let date = t.tanggal; 
        if(!grouped[date]) grouped[date] = { income:0, expense:0 }; 
        if(t.jenis==='pemasukan') grouped[date].income += t.jumlah; 
        else grouped[date].expense += t.jumlah; 
    });
    let sortedDates = Object.keys(grouped).sort();
    let balanceSeries = []; 
    let running = 0;
    sortedDates.forEach(d => { 
        running += grouped[d].income - grouped[d].expense; 
        balanceSeries.push(running); 
    });
    if(charts.lineChart) charts.lineChart.updateOptions({ xaxis: { categories: sortedDates }, series: [{ name: 'Saldo', data: balanceSeries }] });
    let expenseByCat = {};
    filtered.filter(t=>t.jenis==='pengeluaran').forEach(t=>{ expenseByCat[t.kategori] = (expenseByCat[t.kategori]||0) + t.jumlah; });
    let topCats = Object.entries(expenseByCat).sort((a,b)=>b[1]-a[1]).slice(0,5);
    if(charts.barChart) charts.barChart.updateOptions({ xaxis: { categories: topCats.map(c=>c[0]) }, series: [{ name: 'Pengeluaran', data: topCats.map(c=>c[1]) }] });
    if(charts.pieChart) charts.pieChart.updateOptions({ series: topCats.map(c=>c[1]), labels: topCats.map(c=>c[0]) });
}

function updateSparklines() {
    let all = getAllTransaksi();
    let incomeData = all.filter(t=>t.jenis==='pemasukan').map(t=>t.jumlah);
    let expenseData = all.filter(t=>t.jenis==='pengeluaran').map(t=>t.jumlah);
    let balanceRunning = 0, balanceSeries = [];
    all.sort((a,b)=>new Date(a.tanggal)-new Date(b.tanggal)).forEach(t=>{ balanceRunning += (t.jenis==='pemasukan'?t.jumlah:-t.jumlah); balanceSeries.push(balanceRunning); });
    if(charts.sparkIncome) charts.sparkIncome.updateSeries([{ data: incomeData }]);
    if(charts.sparkExpense) charts.sparkExpense.updateSeries([{ data: expenseData }]);
    if(charts.sparkBalance) charts.sparkBalance.updateSeries([{ data: balanceSeries }]);
}

function updateAllUI() { 
    renderSummaryAndTable(); 
    renderAnalytics(); 
    renderLaporan(); 
    updatePlayerUI(); 
    updateDailyLoginUI();
}

function getWeekNumber(d) { 
    let date = new Date(d.getTime()); 
    date.setHours(0,0,0,0); 
    date.setDate(date.getDate()+3-(date.getDay()+6)%7); 
    let week1 = new Date(date.getFullYear(),0,4); 
    return 1+Math.round(((date.getTime()-week1.getTime())/86400000-3+(week1.getDay()+6)%7)/7); 
}

function initAllCharts() {
    const theme = document.body.classList.contains('theme-light') ? 'light' : 'dark';
    const textColor = theme === 'light' ? '#0f172a' : '#94a3b8';
    
    charts.lineChart = new ApexCharts(document.querySelector("#lineChart"), { 
        chart: { type: 'area', height: 350, toolbar: { show: false }, background: 'transparent' }, 
        stroke: { curve: 'smooth', width: 2 }, fill: { type: 'gradient' }, colors: ['#a855f7'], 
        series: [{ name: 'Saldo', data: [] }], 
        xaxis: { labels: { style: { colors: textColor } } }, 
        tooltip: { theme: theme } 
    });
    charts.lineChart.render();
    
    charts.barChart = new ApexCharts(document.querySelector("#barChart"), { 
        chart: { type: 'bar', height: 300, background: 'transparent' }, 
        plotOptions: { bar: { borderRadius: 8 } }, colors: ['#f97316'], 
        series: [{ name: 'Pengeluaran', data: [] }], xaxis: { categories: [] }, 
        tooltip: { theme: theme } 
    });
    charts.barChart.render();
    
    charts.pieChart = new ApexCharts(document.querySelector("#pieChart"), { 
        chart: { type: 'pie', height: 300, background: 'transparent' }, 
        labels: [], series: [], theme: { mode: theme }, 
        tooltip: { theme: theme }, 
        fill: { colors: ['#10b981','#f43f5e','#3b82f6','#eab308','#a855f7'] } 
    });
    charts.pieChart.render();
    
    let sparkOpt = { chart: { type: 'line', sparkline: { enabled: true } }, stroke: { width: 2, curve: 'smooth' }, tooltip: { enabled: false }, series: [{ data: [] }] };
    charts.sparkIncome = new ApexCharts(document.querySelector("#sparkIncome"), { ...sparkOpt, colors: ['#22c55e'] });
    charts.sparkExpense = new ApexCharts(document.querySelector("#sparkExpense"), { ...sparkOpt, colors: ['#f43f5e'] });
    charts.sparkBalance = new ApexCharts(document.querySelector("#sparkBalance"), { ...sparkOpt, colors: ['#38bdf8'] });
    charts.sparkIncome.render(); 
    charts.sparkExpense.render(); 
    charts.sparkBalance.render();
}

function renderAnalytics() {
    let all = getAllTransaksi();
    let totalPemasukan = all.filter(t=>t.jenis==='pemasukan').reduce((a,b)=>a+b.jumlah,0);
    let expenseByCat = {};
    all.filter(t=>t.jenis==='pengeluaran').forEach(t=>{ expenseByCat[t.kategori] = (expenseByCat[t.kategori]||0)+t.jumlah; });
    let top = Object.entries(expenseByCat).sort((a,b)=>b[1]-a[1])[0];
    document.getElementById('insightTopCatText').innerHTML = top ? `${top[0]} : ${formatRupiah(top[1])}` : 'Belum ada data';
    
    let now = new Date();
    let lastWeekStart = new Date(now); lastWeekStart.setDate(now.getDate()-14);
    let lastWeekEnd = new Date(now); lastWeekEnd.setDate(now.getDate()-7);
    let thisWeekStart = new Date(now); thisWeekStart.setDate(now.getDate()-7);
    let thisWeekEnd = now;
    let lastExpense = all.filter(t=>t.jenis==='pengeluaran' && new Date(t.tanggal)>=lastWeekStart && new Date(t.tanggal)<=lastWeekEnd).reduce((a,b)=>a+b.jumlah,0);
    let thisExpense = all.filter(t=>t.jenis==='pengeluaran' && new Date(t.tanggal)>=thisWeekStart && new Date(t.tanggal)<=thisWeekEnd).reduce((a,b)=>a+b.jumlah,0);
    let trend = lastExpense ? ((thisExpense - lastExpense)/lastExpense*100).toFixed(1) : 0;
    let trendText = trend>0 ? `Naik ${trend}%` : (trend<0 ? `Turun ${Math.abs(trend)}%` : 'Stabil');
    document.getElementById('insightTrendText').innerHTML = trendText;
    
    let totalPengeluaran = all.filter(t=>t.jenis==='pengeluaran').reduce((a,b)=>a+b.jumlah,0);
    let status = totalPengeluaran > totalPemasukan ? '⚠️ Pengeluaran > Pemasukan! Evaluasi.' : '✅ Sehat, pemasukan mencukupi.';
    document.getElementById('insightBorosText').innerHTML = status;
    
    let saran = (top && top[0]==='Kebutuhan Pokok') ? 'Coba kurangi belanja kebutuhan tidak esensial.' : (totalPengeluaran > totalPemasukan*0.8 ? 'Pengeluaran tinggi, tingkatkan tabungan.' : 'Pertahankan pola keuangan baik!');
    document.getElementById('insightSaranText').innerHTML = saran;
    
    let pieLabels = Object.keys(expenseByCat);
    let pieSeries = Object.values(expenseByCat);
    const theme = document.body.classList.contains('theme-light') ? 'light' : 'dark';
    
    if(analyticsChart.pie) analyticsChart.pie.updateOptions({ labels: pieLabels, series: pieSeries, theme: { mode: theme } });
    else { analyticsChart.pie = new ApexCharts(document.querySelector("#analyticsPieChart"), { chart: { type: 'pie', height: 350, background: 'transparent' }, labels: pieLabels, series: pieSeries, theme: { mode: theme }, tooltip: { theme: theme } }); analyticsChart.pie.render(); }
    
    let range = document.getElementById('analyticsTimeRange') ? document.getElementById('analyticsTimeRange').value : 'week';
    let grouped = {};
    all.forEach(t=>{ let date = new Date(t.tanggal); let key = (range==='week') ? `Minggu ${getWeekNumber(date)}` : (range==='month' ? `${date.getFullYear()}-${date.getMonth()+1}` : date.toISOString().slice(0,7)); if(!grouped[key]) grouped[key] = { income:0, expense:0 }; if(t.jenis==='pemasukan') grouped[key].income += t.jumlah; else grouped[key].expense += t.jumlah; });
    let categories = Object.keys(grouped).sort();
    let incomeData = categories.map(c=>grouped[c].income);
    let expenseData = categories.map(c=>grouped[c].expense);
    
    if(analyticsChart.bar) analyticsChart.bar.updateOptions({ xaxis: { categories: categories }, series: [{ name: 'Pemasukan', data: incomeData }, { name: 'Pengeluaran', data: expenseData }], theme: { mode: theme } });
    else { analyticsChart.bar = new ApexCharts(document.querySelector("#analyticsBarChart"), { chart: { type: 'bar', height: 350, background: 'transparent' }, plotOptions: { bar: { columnWidth: '55%' } }, colors: ['#22c55e','#f43f5e'], series: [{ name: 'Pemasukan', data: incomeData }, { name: 'Pengeluaran', data: expenseData }], xaxis: { categories: categories }, tooltip: { theme: theme }, theme: { mode: theme } }); analyticsChart.bar.render(); }
    
    let kebutuhanCat = ['Kebutuhan Pokok'];
    let keinginanCat = ['Belanja', 'Healing', 'Transport'];
    let totalKebutuhan = all.filter(t=>t.jenis==='pengeluaran' && kebutuhanCat.includes(t.kategori)).reduce((a,b)=>a+b.jumlah,0);
    let totalKeinginan = all.filter(t=>t.jenis==='pengeluaran' && keinginanCat.includes(t.kategori)).reduce((a,b)=>a+b.jumlah,0);
    let totalTabungan = totalPemasukan - totalKebutuhan - totalKeinginan;
    let pctK = (totalKebutuhan/totalPemasukan*100)||0, pctKe = (totalKeinginan/totalPemasukan*100)||0, pctT = (totalTabungan/totalPemasukan*100)||0;
    
    document.getElementById('pctKebutuhan').innerText = Math.round(pctK)+'%';
    document.getElementById('pctKeinginan').innerText = Math.round(pctKe)+'%';
    document.getElementById('pctTabungan').innerText = Math.round(pctT)+'%';
    document.getElementById('barKebutuhan').style.width = Math.min(pctK,100)+'%';
    document.getElementById('barKeinginan').style.width = Math.min(pctKe,100)+'%';
    document.getElementById('barTabungan').style.width = Math.min(pctT,100)+'%';
}

function renderLaporan() {
    let all = getAllTransaksi();
    let filtered = [...all];
    if(laporanFilter.startDate) filtered = filtered.filter(t=>t.tanggal >= laporanFilter.startDate);
    if(laporanFilter.endDate) filtered = filtered.filter(t=>t.tanggal <= laporanFilter.endDate);
    if(laporanFilter.kategori !== 'semua') filtered = filtered.filter(t=>t.kategori === laporanFilter.kategori);
    if(laporanFilter.jenis !== 'semua') filtered = filtered.filter(t=>t.jenis === laporanFilter.jenis);
    let pemasukan = filtered.filter(t=>t.jenis==='pemasukan').reduce((a,b)=>a+b.jumlah,0);
    let pengeluaran = filtered.filter(t=>t.jenis==='pengeluaran').reduce((a,b)=>a+b.jumlah,0);
    
    document.getElementById('laporanTotalPemasukan').innerHTML = `Rp ${formatRupiah(pemasukan)}`;
    document.getElementById('laporanTotalPengeluaran').innerHTML = `Rp ${formatRupiah(pengeluaran)}`;
    document.getElementById('laporanSaldo').innerHTML = `Rp ${formatRupiah(pemasukan-pengeluaran)}`;
    
    let tbody = document.getElementById('laporanTableBody');
    if(filtered.length===0) { tbody.innerHTML = '<tr><td colspan="5" class="text-center py-8">Tidak ada data</td></tr>'; return; }
    
    let html = '';
    filtered.sort((a,b)=>new Date(b.tanggal)-new Date(a.tanggal)).forEach(t=>{
        let jenisBadge = t.jenis==='pemasukan' ? '<span class="text-emerald-400">Pemasukan</span>' : '<span class="text-rose-400">Pengeluaran</span>';
        html += `<tr><td class="p-3">${t.tanggal}</td><td class="p-3">${escapeHtml(t.deskripsi)}</td><td class="p-3">${t.kategori}</td><td class="p-3">${jenisBadge}</td><td class="p-3 text-right">Rp ${formatRupiah(t.jumlah)}</td></tr>`;
    });
    tbody.innerHTML = html;
}

function updateLaporanKategoriDropdown() {
    let kategoriOptions = ['Kebutuhan Pokok', 'Belanja', 'Healing', 'Penghasilan', 'Transport'];
    let dropdown = document.getElementById('laporanFilterKategori');
    if (dropdown) {
        dropdown.innerHTML = '<option value="semua">Semua</option>';
        kategoriOptions.forEach(k => { dropdown.innerHTML += `<option value="${k}">${k}</option>`; });
    }
}

// ========== THEME ==========
function setTheme(theme) {
    if (theme === 'light') {
        document.body.classList.remove('theme-dark');
        document.body.classList.add('theme-light');
        localStorage.setItem('theme', 'light');
        document.getElementById('themeText').innerText = 'Dark Mode';
        document.querySelector('#themeToggle i').className = 'fas fa-moon';
    } else {
        document.body.classList.remove('theme-light');
        document.body.classList.add('theme-dark');
        localStorage.setItem('theme', 'dark');
        document.getElementById('themeText').innerText = 'Light Mode';
        document.querySelector('#themeToggle i').className = 'fas fa-sun';
    }
    const newTheme = theme === 'light' ? 'light' : 'dark';
    if (charts.lineChart) {
        charts.lineChart.updateOptions({ theme: { mode: newTheme }, xaxis: { labels: { style: { colors: newTheme === 'light' ? '#0f172a' : '#94a3b8' } } } });
        charts.barChart.updateOptions({ theme: { mode: newTheme } });
        charts.pieChart.updateOptions({ theme: { mode: newTheme } });
        if (analyticsChart.pie) analyticsChart.pie.updateOptions({ theme: { mode: newTheme } });
        if (analyticsChart.bar) analyticsChart.bar.updateOptions({ theme: { mode: newTheme } });
    }
}

// ========== SWITCH PAGE ==========
function switchPage(page) {
    const pages = ['pageDashboard', 'pageDaily', 'pageAnalytics', 'pageLaporan', 'pageAchievement', 'pageSettings'];
    pages.forEach(pageId => { const el = document.getElementById(pageId); if (el) el.classList.add('hidden'); });
    
    let targetId = '';
    switch(page) {
        case 'dashboard': targetId = 'pageDashboard'; break;
        case 'daily': targetId = 'pageDaily'; break;
        case 'analytics': targetId = 'pageAnalytics'; break;
        case 'laporan': targetId = 'pageLaporan'; break;
        case 'achievement': targetId = 'pageAchievement'; break;
        case 'settings': targetId = 'pageSettings'; break;
        default: targetId = 'pageDashboard';
    }
    const target = document.getElementById(targetId);
    if (target) target.classList.remove('hidden');
    
    if (page === 'dashboard') {
        updateDailyLoginUI();
        updatePlayerUI();
        renderSummaryAndTable();
    } else if (page === 'daily') {
        updateDailyLoginDetailPage();
    } else if (page === 'analytics') {
        renderAnalytics();
    } else if (page === 'laporan') {
        renderLaporan();
    } else if (page === 'achievement') {
        renderBadges();
    }
    
    document.querySelectorAll('.menu-item').forEach(menu => menu.classList.remove('active'));
    const active = document.querySelector(`.menu-item[data-page="${page}"]`);
    if (active) active.classList.add('active');
}

// ========== IMPORT/EXPORT ==========
function parseAmount(value) {
    if (value === undefined || value === null || value === '') return 0;
    if (typeof value === 'number') return Math.abs(value);
    let str = String(value).trim().replace(/[Rp\s\$,]/gi, '');
    let amount = parseFloat(str);
    return isNaN(amount) ? 0 : Math.abs(amount);
}

function parseDateFromAnyFormat(value) {
    if (!value) return new Date().toISOString().slice(0, 10);
    let dateObj = new Date(value);
    if (!isNaN(dateObj.getTime())) return dateObj.toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
}

function importFromJSON(jsonData) {
    try {
        let imported = JSON.parse(jsonData);
        if (!Array.isArray(imported)) return { success: false, message: "Format JSON harus berupa array" };
        let transactions = [];
        for (let i = 0; i < imported.length; i++) {
            let item = imported[i];
            if (!item.tanggal || !item.jumlah) continue;
            transactions.push({
                id: Date.now() + Math.random() + i,
                tanggal: parseDateFromAnyFormat(item.tanggal),
                deskripsi: item.deskripsi || 'Transaksi import',
                kategori: item.kategori || 'Kebutuhan Pokok',
                jenis: item.jenis === 'pemasukan' ? 'pemasukan' : 'pengeluaran',
                jumlah: parseAmount(item.jumlah)
            });
        }
        if (transactions.length === 0) return { success: false, message: "Tidak ada data transaksi yang valid" };
        return { success: true, transactions: transactions, count: transactions.length };
    } catch (e) {
        return { success: false, message: "Format JSON tidak valid: " + e.message };
    }
}

// ========== GLOBAL FUNCTIONS ==========
window.editTransaksi = (id) => { 
    let t = getAllTransaksi().find(t=>t.id==id); 
    if(t){ 
        document.getElementById('modalTitle').innerHTML='<i class="fas fa-edit mr-2"></i> Edit Transaksi'; 
        document.getElementById('editId').value=t.id; 
        document.getElementById('tanggal').value=t.tanggal; 
        document.getElementById('deskripsi').value=t.deskripsi; 
        document.getElementById('kategori').value=t.kategori; 
        document.getElementById('jenis').value=t.jenis; 
        document.getElementById('jumlah').value=t.jumlah; 
        document.getElementById('transaksiModal').classList.remove('hidden'); 
    } 
};

window.hapusTransaksi = async (id) => { 
    if(confirm('Hapus transaksi ini?')) { 
        await deleteTransaksi(id); 
        showNotification('Transaksi Dihapus', 'Transaksi berhasil dihapus', 'info', true, 3000);
        updateAllUI(); 
    } 
};

function simpanTransaksiHandler() {
    let id = document.getElementById('editId').value;
    let tanggal = document.getElementById('tanggal').value;
    let deskripsi = document.getElementById('deskripsi').value.trim();
    let kategori = document.getElementById('kategori').value;
    let jenis = document.getElementById('jenis').value;
    let jumlah = parseFloat(document.getElementById('jumlah').value);
    
    if(!tanggal || !deskripsi || !kategori || isNaN(jumlah) || jumlah<=0) { 
        showNotification('Gagal!', 'Data tidak valid', 'error', true, 3000);
        return; 
    }
    
    if (jenis === 'pengeluaran' && (kategori === 'Belanja' || kategori === 'Healing')) {
        applyPenaltyIfBoros(kategori, jumlah, document.getElementById('saveBtn'));
    } else if (jenis === 'pemasukan' && kategori === 'Penghasilan') {
        addAchievementPoint(1, document.getElementById('saveBtn'));
        showNotification('Menabung!', '+1 Achievement Point', 'success', true, 3000);
    }
    
    if(id) updateTransaksi(id, { tanggal, deskripsi, kategori, jenis, jumlah });
    else createTransaksi({ tanggal, deskripsi, kategori, jenis, jumlah });
    
    document.getElementById('transaksiModal').classList.add('hidden');
    showNotification('Berhasil!', 'Transaksi telah disimpan', 'success', true, 3000);
    updateAllUI();
}

function resetAllData() {
    if (!currentUser) return;
    currentUser.transactions = [];
    currentUser.achievementPoints = 0;
    currentUser.badges = [];
    currentUser.dailyLogin = {
        lastLoginDate: null,
        streak: 0,
        totalLogins: 0,
        lastClaimed: null
    };
    const index = allUsers.findIndex(u => u.username === currentUser.username);
    if (index !== -1) {
        allUsers[index] = currentUser;
        saveDataToGitHub();
    }
    updateAllUI();
    showNotification('Data Direset', 'Semua data telah direset', 'warning', true, 4000);
}

function resetTransaksiOnly() {
    if (!currentUser) return;
    currentUser.transactions = [];
    const index = allUsers.findIndex(u => u.username === currentUser.username);
    if (index !== -1) {
        allUsers[index] = currentUser;
        saveDataToGitHub();
    }
    updateAllUI();
    showNotification('Transaksi Direset', 'Semua transaksi telah dihapus', 'warning', true, 4000);
}

function initAudio() {
    soundSuccess = document.getElementById('soundSuccess');
    soundLevelUp = document.getElementById('soundLevelUp');
    soundNotification = document.getElementById('soundNotification');
}

// ========== DOM CONTENT LOADED ==========
document.addEventListener('DOMContentLoaded', async function () {
    console.log('🚀 Aplikasi GitHub Database dimulai...');
    
    initAudio();
    
    // Load data dari GitHub
    await loadDataFromGitHub();
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) setTheme(savedTheme);
    else setTheme('dark');
    
    // Tab Login/Register
    const loginTab = document.getElementById('loginTab');
    const registerTab = document.getElementById('registerTab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('text-purple-400', 'border-purple-400');
        loginTab.classList.remove('text-gray-400', 'border-transparent');
        registerTab.classList.remove('text-purple-400', 'border-purple-400');
        registerTab.classList.add('text-gray-400', 'border-transparent');
        loginForm.classList.remove('hidden');
        registerForm.classList.add('hidden');
    });
    
    registerTab.addEventListener('click', () => {
        registerTab.classList.add('text-purple-400', 'border-purple-400');
        registerTab.classList.remove('text-gray-400', 'border-transparent');
        loginTab.classList.remove('text-purple-400', 'border-purple-400');
        loginTab.classList.add('text-gray-400', 'border-transparent');
        registerForm.classList.remove('hidden');
        loginForm.classList.add('hidden');
    });
    
    document.getElementById('themeToggle').addEventListener('click', () => { 
        const isLight = document.body.classList.contains('theme-light'); 
        setTheme(isLight ? 'dark' : 'light'); 
    });
    
    // LOGIN
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        let username = document.getElementById('loginUsername').value;
        let password = document.getElementById('loginPassword').value;
        let result = await loginUser(username, password);
        if(result.success) {
            currentUser = result.user;
            document.getElementById('loginContainer').classList.add('hidden');
            document.getElementById('dashboardContainer').classList.remove('hidden');
            document.getElementById('sidebarUsername').innerText = currentUser.fullname || currentUser.username;
            document.getElementById('sidebarEmail').innerText = currentUser.email;
            
            initAllCharts();
            updateAllUI();
            updateLaporanKategoriDropdown();
            switchPage('dashboard');
            showNotification('Selamat Datang!', `Halo ${currentUser.fullname || currentUser.username}!`, 'success', true, 4000);
        } else { 
            document.getElementById('loginError').innerText = result.message;
            showNotification('Login Gagal!', result.message, 'error', true, 3000);
        }
    });
    
    // REGISTER
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        let fullname = document.getElementById('regFullname').value;
        let username = document.getElementById('regUsername').value;
        let email = document.getElementById('regEmail').value;
        let password = document.getElementById('regPassword').value;
        let confirm = document.getElementById('regConfirmPassword').value;
        
        if (password !== confirm) {
            showNotification('Gagal!', 'Password tidak cocok', 'error', true, 3000);
            return;
        }
        if (password.length < 6) {
            showNotification('Gagal!', 'Password minimal 6 karakter', 'error', true, 3000);
            return;
        }
        
        let result = await registerUser(fullname, username, email, password);
        if(result.success) {
            showNotification('Pendaftaran Berhasil!', result.message, 'success', true, 3000);
            loginTab.click();
            document.getElementById('loginUsername').value = username;
            document.getElementById('loginPassword').value = '';
            document.getElementById('registerError').innerText = '';
        } else {
            document.getElementById('registerError').innerText = result.message;
            showNotification('Gagal!', result.message, 'error', true, 3000);
        }
    });
    
    // LOGOUT
    document.getElementById('logoutBtnSide').addEventListener('click', async () => { 
        await logoutUser();
        document.getElementById('loginContainer').classList.remove('hidden'); 
        document.getElementById('dashboardContainer').classList.add('hidden');
        document.getElementById('loginUsername').value = '';
        document.getElementById('loginPassword').value = '';
        showNotification('Sampai Jumpa!', 'Anda telah logout', 'info', true, 3000);
    });
    
    document.getElementById('saveBtn').addEventListener('click', simpanTransaksiHandler);
    document.getElementById('tambahBtn').addEventListener('click', () => { 
        document.getElementById('transaksiForm').reset(); 
        document.getElementById('editId').value=''; 
        document.getElementById('modalTitle').innerHTML='<i class="fas fa-plus mr-2"></i> Tambah Transaksi'; 
        document.getElementById('tanggal').valueAsDate=new Date(); 
        document.getElementById('transaksiModal').classList.remove('hidden'); 
    });
    document.getElementById('closeModalBtn').addEventListener('click', () => document.getElementById('transaksiModal').classList.add('hidden'));
    document.getElementById('modalBackdrop').addEventListener('click', () => document.getElementById('transaksiModal').classList.add('hidden'));
    document.getElementById('filterJenis').addEventListener('change', (e) => { currentFilter.jenis = e.target.value; updateAllUI(); });
    document.getElementById('filterKategori').addEventListener('change', (e) => { currentFilter.kategori = e.target.value; updateAllUI(); });
    document.getElementById('searchInput').addEventListener('input', (e) => { currentFilter.search = e.target.value; updateAllUI(); });
    document.getElementById('filterWaktu').addEventListener('change', (e) => { currentFilter.timeRange = e.target.value; updateAllUI(); });
    
    // EXPORT
    document.getElementById('exportDataBtn').addEventListener('click', function() { 
        let data = getAllTransaksi();
        if (!data.length) { showNotification('Error', 'Tidak ada data', 'error'); return; }
        let format = document.getElementById('formatFile').value;
        let fileName = `keuangan_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}`;
        try {
            if (format === 'json') {
                let blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                let a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName + '.json'; a.click(); URL.revokeObjectURL(a.href);
                showNotification('Success', `Export ${data.length} transaksi ke JSON`, 'success', true, 3000);
            } else if (format === 'csv') {
                let headers = Object.keys(data[0]), rows = [headers.join(',')];
                data.forEach(r => { rows.push(headers.map(h => { let v = r[h] ?? ''; return typeof v === 'string' && (v.includes(',') || v.includes('"')) ? `"${v.replace(/"/g, '""')}"` : v; }).join(',')); });
                let blob = new Blob([rows.join('\n')], { type: 'text/csv' });
                let a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName + '.csv'; a.click(); URL.revokeObjectURL(a.href);
                showNotification('Success', `Export ${data.length} transaksi ke CSV`, 'success', true, 3000);
            } else if (format === 'txt') {
                let txt = '=== LAPORAN KEUANGAN ===\nTanggal: ' + new Date().toLocaleString() + '\nTotal: ' + data.length + ' transaksi\n\n';
                data.forEach((t, i) => { txt += `[${i+1}] ${t.tanggal} - ${t.deskripsi}\nKategori: ${t.kategori} | Jenis: ${t.jenis}\nJumlah: Rp ${(t.jumlah || 0).toLocaleString('id-ID')}\n----------------------------------------\n`; });
                let blob = new Blob([txt], { type: 'text/plain' });
                let a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName + '.txt'; a.click(); URL.revokeObjectURL(a.href);
                showNotification('Success', `Export ${data.length} transaksi ke TXT`, 'success', true, 3000);
            } else if (format === 'excel') {
                if (typeof XLSX === 'undefined') { showNotification('Error', 'Library Excel tidak tersedia', 'error'); return; }
                let ws = XLSX.utils.json_to_sheet(data);
                let wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Keuangan');
                XLSX.writeFile(wb, fileName + '.xlsx');
                showNotification('Success', `Export ${data.length} transaksi ke Excel`, 'success', true, 3000);
            }
        } catch(e) { showNotification('Error', 'Gagal export', 'error'); }
    });
    
    // IMPORT
    document.getElementById('importDataBtn').addEventListener('click', () => document.getElementById('importFileInput').click());
    document.getElementById('importFileInput').addEventListener('change', (e) => { 
        if(e.target.files.length){ 
            let file = e.target.files[0], ext = file.name.split('.').pop().toLowerCase();
            let reader = new FileReader();
            reader.onload = async (ev) => { 
                try { 
                    let result;
                    if (ext === 'json') result = importFromJSON(ev.target.result);
                    else { showNotification('Gagal', 'Format tidak didukung', 'error'); return; }
                    if (result.success && result.transactions.length) {
                        for (const t of result.transactions) {
                            await createTransaksi(t);
                        }
                        updateAllUI();
                        showNotification('Import Sukses', `${result.count} transaksi diimpor`, 'success', true, 3000);
                    } else showNotification('Gagal', result.message || 'Tidak ada data valid', 'error', true, 3000);
                } catch(err){ showNotification('Gagal', err.message, 'error', true, 3000); }
            };
            reader.readAsText(file, 'UTF-8');
        }
    });
    
    // MENU
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        const newItem = item.cloneNode(true);
        if (item.parentNode) item.parentNode.replaceChild(newItem, item);
        newItem.addEventListener('click', (e) => { e.preventDefault(); if(newItem.dataset.page) switchPage(newItem.dataset.page); });
    });
    
    // Laporan Filters
    document.getElementById('laporanStartDate')?.addEventListener('change', (e) => { laporanFilter.startDate = e.target.value; renderLaporan(); });
    document.getElementById('laporanEndDate')?.addEventListener('change', (e) => { laporanFilter.endDate = e.target.value; renderLaporan(); });
    document.getElementById('laporanFilterKategori')?.addEventListener('change', (e) => { laporanFilter.kategori = e.target.value; renderLaporan(); });
    document.getElementById('laporanFilterJenis')?.addEventListener('change', (e) => { laporanFilter.jenis = e.target.value; renderLaporan(); });
    document.getElementById('resetLaporanFilter')?.addEventListener('click', () => { 
        laporanFilter = { startDate: '', endDate: '', kategori: 'semua', jenis: 'semua' }; 
        document.getElementById('laporanStartDate').value = ''; document.getElementById('laporanEndDate').value = '';
        document.getElementById('laporanFilterKategori').value = 'semua'; document.getElementById('laporanFilterJenis').value = 'semua';
        renderLaporan();
    });
    document.getElementById('printLaporanBtn')?.addEventListener('click', () => window.print());
    document.getElementById('exportLaporanCSV')?.addEventListener('click', () => {
        let all = getAllTransaksi();
        let filtered = [...all];
        if(laporanFilter.startDate) filtered = filtered.filter(t=>t.tanggal >= laporanFilter.startDate);
        if(laporanFilter.endDate) filtered = filtered.filter(t=>t.tanggal <= laporanFilter.endDate);
        if(laporanFilter.kategori !== 'semua') filtered = filtered.filter(t=>t.kategori === laporanFilter.kategori);
        if(laporanFilter.jenis !== 'semua') filtered = filtered.filter(t=>t.jenis === laporanFilter.jenis);
        let csvRows = [["Tanggal","Deskripsi","Kategori","Jenis","Jumlah"]];
        filtered.forEach(t=>{ csvRows.push([t.tanggal, t.deskripsi, t.kategori, t.jenis, t.jumlah]); });
        let blob = new Blob([csvRows.map(r=>r.join(",")).join("\n")], {type: 'text/csv'});
        let a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'laporan_keuangan.csv'; a.click();
        showNotification('Export CSV', 'Laporan berhasil diekspor', 'success', true, 3000);
    });
    document.getElementById('analyticsTimeRange')?.addEventListener('change', () => renderAnalytics());
    
    // Reset Buttons
    document.getElementById('resetAllDataBtn')?.addEventListener('click', () => {
        document.getElementById('confirmModal').classList.remove('hidden');
        document.getElementById('confirmOkBtn').onclick = () => { resetAllData(); document.getElementById('confirmModal').classList.add('hidden'); };
    });
    document.getElementById('resetTransaksiOnlyBtn')?.addEventListener('click', () => {
        document.getElementById('confirmModal').classList.remove('hidden');
        document.getElementById('confirmOkBtn').onclick = () => { resetTransaksiOnly(); document.getElementById('confirmModal').classList.add('hidden'); };
    });
    document.getElementById('confirmCancelBtn')?.addEventListener('click', () => document.getElementById('confirmModal').classList.add('hidden'));
    document.getElementById('confirmBackdrop')?.addEventListener('click', () => document.getElementById('confirmModal').classList.add('hidden'));
    
    console.log('✅ Aplikasi GitHub Database siap!');
});
