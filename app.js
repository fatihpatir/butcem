// --- Storage ---
const storage = {
    get: (key, def) => JSON.parse(localStorage.getItem(key)) || def,
    set: (key, val) => localStorage.setItem(key, JSON.stringify(val))
};

// --- State ---
let entries = storage.get('budge_v2_entries', []);
let currentType = 'income';
let currentTheme = storage.get('budge_v1_theme', 'theme-indigo');
let listTypeFilter = 'all'; 
let listStatusFilter = 'all'; // 'all', 'unpaid'
let viewDate = new Date(); 

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    applyTheme(currentTheme);
    
    // Service Worker Kaydı
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            reg.onupdatefound = () => {
                const installingWorker = reg.installing;
                installingWorker.onstatechange = () => {
                    if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // Yeni sürüm hazır, otomatik yenile
                        window.location.reload();
                    }
                };
            };
        });
        
        // Yeni sürüm devreye girdiğinde sayfayı yenile
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            window.location.reload();
        });
    }

    setupPWA();
});

function setupPWA() {
    let deferredPrompt;
    const installBtn = document.getElementById('install-btn');
    if (!installBtn) return;
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

    if (isStandalone) {
        installBtn.style.display = 'none';
    } else if (isIOS) {
        installBtn.style.display = 'flex';
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        if (!isStandalone) installBtn.style.display = 'flex';
    });

    installBtn.addEventListener('click', () => {
        if (isIOS) {
            document.getElementById('ios-modal').classList.remove('hidden');
        } else if (deferredPrompt) {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') installBtn.style.display = 'none';
                deferredPrompt = null;
            });
        }
    });
}

function initApp() {
    document.getElementById('entry-date').valueAsDate = new Date();

    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
            document.getElementById(btn.dataset.page).classList.remove('hidden');
            if (btn.dataset.page === 'list-page') {
                listTypeFilter = 'all'; 
                listStatusFilter = 'all';
                renderList();
            }
            if (btn.dataset.page === 'summary-page') renderSummary();
        });
    });

    // Type Selector
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentType = btn.dataset.type;
        });
    });

    // Theme Menu
    document.getElementById('theme-btn').onclick = () => document.getElementById('theme-menu').classList.toggle('hidden');
    document.querySelectorAll('.theme-opt').forEach(opt => {
        opt.onclick = () => {
            applyTheme(opt.dataset.theme);
            document.getElementById('theme-menu').classList.add('hidden');
        };
    });

    // Save / Update
    document.getElementById('save-entry-btn').onclick = saveOrUpdateEntry;
    document.getElementById('cancel-edit-btn').onclick = cancelEdit;

    // Global Month Nav
    document.getElementById('prev-month').onclick = () => {
        viewDate.setMonth(viewDate.getMonth() - 1);
        updateView();
    };
    document.getElementById('next-month').onclick = () => {
        viewDate.setMonth(viewDate.getMonth() + 1);
        updateView();
    };

    // Global Reset
    document.getElementById('reset-data-btn').onclick = () => {
        if (confirm("Kral, tüm verilerin silinecek. Emin misin?")) {
            entries = [];
            storage.set('budge_v2_entries', entries);
            location.reload();
        }
    };

    // Stat Card Clicks (Quick Filter)
    document.querySelector('.stat-card.income').onclick = () => {
        listTypeFilter = 'income';
        document.querySelector('[data-page="list-page"]').click();
    };
    document.querySelector('.stat-card.expense').onclick = () => {
        listTypeFilter = 'expense';
        document.querySelector('[data-page="list-page"]').click();
    };

    updateView();
}

function updateView() {
    renderStats();
    renderReminders();
    if (!document.getElementById('list-page').classList.contains('hidden')) renderList();
    if (!document.getElementById('summary-page').classList.contains('hidden')) renderSummary();
}

function applyTheme(theme) {
    document.body.className = theme;
    currentTheme = theme;
    storage.set('budge_v1_theme', theme);
}

// --- Core Logic ---

function saveOrUpdateEntry() {
    const amount = parseFloat(document.getElementById('entry-amount').value);
    const desc = document.getElementById('entry-desc').value.trim();
    const date = document.getElementById('entry-date').value;
    const editingId = document.getElementById('editing-id').value;

    if (!amount || !desc || !date) return alert("Hocam tüm alanları dolduralım.");

    if (editingId) {
        const idx = entries.findIndex(e => e.id == editingId);
        if (idx > -1) entries[idx] = { ...entries[idx], amount, desc, date };
        cancelEdit();
    } else {
        entries.unshift({
            id: Date.now(),
            type: currentType,
            amount: amount,
            desc: desc,
            date: date,
            isPaid: currentType === 'income' ? true : false
        });
    }

    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    storage.set('budge_v2_entries', entries);

    const btn = document.getElementById('save-entry-btn');
    btn.innerHTML = '<i class="ph ph-check"></i> Tamamlandı!';
    setTimeout(() => {
        btn.innerHTML = editingId ? '<i class="ph ph-check-circle"></i> Güncelle' : '<i class="ph ph-check-circle"></i> Kaydet';
        if (!editingId) {
            document.getElementById('entry-amount').value = '';
            document.getElementById('entry-desc').value = '';
        }
    }, 1500);

    renderStats();
    renderReminders();
    updateView();
}

function editEntry(id) {
    const entry = entries.find(e => e.id == id);
    if (!entry) return;
    document.getElementById('entry-amount').value = entry.amount;
    document.getElementById('entry-desc').value = entry.desc;
    document.getElementById('entry-date').value = entry.date;
    document.getElementById('editing-id').value = entry.id;
    document.getElementById('save-entry-btn').innerHTML = '<i class="ph ph-pencil"></i> Güncelle';
    document.getElementById('cancel-edit-btn').classList.remove('hidden');
    document.querySelector('[data-page="add-page"]').click();
}

function cancelEdit() {
    document.getElementById('editing-id').value = '';
    document.getElementById('entry-amount').value = '';
    document.getElementById('entry-desc').value = '';
    document.getElementById('save-entry-btn').innerHTML = '<i class="ph ph-check-circle"></i> Kaydet';
    document.getElementById('cancel-edit-btn').classList.add('hidden');
}

function deleteEntry(id) {
    if (confirm("Bu kaydı silmek istediğinden emin misin Kral?")) {
        entries = entries.filter(e => e.id != id);
        storage.set('budge_v2_entries', entries);
        renderStats();
        renderReminders();
        renderList();
    }
}

function renderStats() {
    const currentYM = viewDate.toISOString().substring(0, 7);
    const monthName = viewDate.toLocaleString('tr-TR', { month: 'long', year: 'numeric' });
    document.getElementById('current-view-month').innerText = monthName;
    document.getElementById('current-month-name').innerText = monthName;

    let mIncome = 0; 
    let mExpenseTotal = 0;
    let mExpensePaid = 0;

    entries.forEach(e => {
        if (e.date.startsWith(currentYM)) {
            if (e.type === 'income') {
                mIncome += e.amount;
            } else {
                mExpenseTotal += e.amount;
                if (e.isPaid) mExpensePaid += e.amount;
            }
        }
    });

    const currentCash = mIncome - mExpensePaid;
    const projectedCash = mIncome - mExpenseTotal;

    document.getElementById('total-income').innerText = formatCurrency(mIncome);
    document.getElementById('total-expense').innerText = formatCurrency(mExpenseTotal);
    document.getElementById('net-balance').innerText = formatCurrency(currentCash);
    
    const projectedEl = document.getElementById('projected-balance');
    if (mExpenseTotal > mExpensePaid) {
        projectedEl.innerText = `Ödemeler sonrası: ${formatCurrency(projectedCash)}`;
    } else {
        projectedEl.innerText = '';
    }

    const percent = mIncome > 0 ? (mExpenseTotal / mIncome) * 100 : 0;
    document.getElementById('progress-fill').style.width = Math.min(percent, 100) + '%';
    document.getElementById('month-percent').innerText = `%${percent.toFixed(0)} Harcandı`;
}

function renderReminders() {
    const container = document.getElementById('reminder-container');
    if (!container) return;
    container.innerHTML = '';
    
    const currentYM = viewDate.toISOString().substring(0, 7);
    const unpaid = entries.filter(e => e.type === 'expense' && !e.isPaid && e.date.startsWith(currentYM));
    
    if (unpaid.length === 0) return;

    const count = unpaid.length;
    let urgencyClass = '';
    if (count > 0) urgencyClass = 'warning';

    // En yakın olanı bul (tarih için)
    unpaid.sort((a,b) => new Date(a.date) - new Date(b.date));
    const next = unpaid[0];
    const diff = Math.ceil((new Date(next.date) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));

    if (diff <= 0) urgencyClass = 'overdue';
    if (diff === 0) urgencyClass = 'urgent';

    const msg = `Bu ay ödenmemiş <strong>${count}</strong> gideriniz var. Detaylar için dokun.`;

    container.innerHTML = `
        <div class="reminder-card ${urgencyClass}" id="reminder-trigger" style="cursor:pointer">
            <i class="ph-fill ph-bell-ringing"></i>
            <div style="flex:1">${msg}</div>
            <i class="ph ph-caret-right"></i>
        </div>
    `;

    document.getElementById('reminder-trigger').onclick = () => {
        listTypeFilter = 'expense';
        listStatusFilter = 'unpaid';
        document.querySelector('[data-page="list-page"]').click();
    };
}

function renderList() {
    const listContainer = document.getElementById('entries-list');
    const currentYM = viewDate.toISOString().substring(0, 7);

    let filtered = entries.filter(e => e.date.startsWith(currentYM));
    
    // Tip Filtresi Uygula
    if (listTypeFilter !== 'all') {
        filtered = filtered.filter(e => e.type === listTypeFilter);
    }
    
    // Durum Filtresi Uygula
    if (listStatusFilter === 'unpaid') {
        filtered = filtered.filter(e => e.type === 'expense' && !e.isPaid);
    }

    listContainer.innerHTML = filtered.length === 0 ? '<div style="text-align:center; padding:50px; color:var(--text-muted)">Bu ay kayıt bulunmuyor.</div>' : '';

    filtered.forEach(e => {
        const div = document.createElement('div');
        div.className = 'entry-item';
        let subText = ''; let statusIcon = '';
        if (e.type === 'expense') {
            if (!e.isPaid) {
                const diff = Math.ceil((new Date(e.date) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24));
                subText = `<span class="unpaid-badge">${diff <= 0 ? 'Vadesi Geçti' : diff + ' gün kaldı'}</span>`;
                statusIcon = `<div class="status-tick unpaid" onclick="event.stopPropagation(); togglePaid(${e.id})"><i class="ph ph-circle"></i></div>`;
            } else {
                subText = `<span style="font-size:9px; color:var(--income); font-weight:600;">Ödendi</span>`;
                statusIcon = `<div class="status-tick paid" onclick="event.stopPropagation(); togglePaid(${e.id})"><i class="ph-fill ph-check-circle"></i></div>`;
            }
        } else {
            statusIcon = `<div class="status-tick" style="color:var(--income); opacity:0.5; cursor:default;"><i class="ph ph-trend-up"></i></div>`;
        }

        div.innerHTML = `${statusIcon}<div class="entry-info"><span class="entry-title">${e.desc}</span><span class="entry-date">${new Date(e.date).toLocaleDateString('tr-TR')}</span>${subText}</div>
            <div class="entry-amount-actions"><div class="entry-amount ${e.type}">${e.type === 'income' ? '+' : '-'}${formatCurrency(e.amount)}</div>
            <div class="entry-actions"><i class="ph ph-pencil action-btn" onclick="editEntry(${e.id})"></i><i class="ph ph-trash action-btn delete" onclick="deleteEntry(${e.id})"></i></div></div>`;
        listContainer.appendChild(div);
    });
}

function togglePaid(id) {
    const idx = entries.findIndex(e => e.id === id);
    if (idx > -1) {
        entries[idx].isPaid = !entries[idx].isPaid;
        storage.set('budge_v2_entries', entries);
        renderList();
        renderReminders();
    }
}

function renderSummary() {
    const container = document.getElementById('monthly-stats-list');
    container.innerHTML = '';
    const monthlyGroups = {};
    entries.forEach(e => {
        const m = e.date.substring(0, 7);
        if (!monthlyGroups[m]) monthlyGroups[m] = { income: 0, expense: 0 };
        if (e.type === 'income') monthlyGroups[m].income += e.amount;
        else monthlyGroups[m].expense += e.amount;
    });

    Object.keys(monthlyGroups).sort().reverse().forEach(m => {
        const name = new Date(m.split('-')[0], m.split('-')[1]-1).toLocaleString('tr-TR', { month: 'long', year: 'numeric' });
        const s = monthlyGroups[m];
        const card = document.createElement('div');
        card.className = 'monthly-card';
        card.innerHTML = `<h3>${name}</h3><div class="monthly-grid">
            <div class="m-stat"><label>Gelir</label><span style="color:var(--income)">+${formatCurrency(s.income)}</span></div>
            <div class="m-stat"><label>Gider</label><span style="color:var(--expense)">-${formatCurrency(s.expense)}</span></div>
            <div class="m-stat" style="grid-column:span 2; margin-top:10px; border-top:1px solid var(--border); padding-top:10px;"><label>Net Durum</label><span>${formatCurrency(s.income - s.expense)}</span></div></div>`;
        container.appendChild(card);
    });
}

function formatCurrency(val) {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
}
