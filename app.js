// --- Storage ---
const storage = {
    get: (key, def) => JSON.parse(localStorage.getItem(key)) || def,
    set: (key, val) => localStorage.setItem(key, JSON.stringify(val))
};

// --- State ---
let entries = storage.get('budge_v2_entries', []);
let currentType = 'income';
let currentTheme = storage.get('budge_v1_theme', 'theme-indigo');

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    initApp();
    applyTheme(currentTheme);
});

function initApp() {
    document.getElementById('entry-date').valueAsDate = new Date();

    // Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
            document.getElementById(btn.dataset.page).classList.remove('hidden');
            
            if (btn.dataset.page === 'list-page') renderList();
            if (btn.dataset.page === 'summary-page') renderSummary();
        });
    });

    // Type Selector
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentType = btn.dataset.type;
            
            // Gider ise ödeme durumunu göster
            const paymentGroup = document.getElementById('payment-status-group');
            if (currentType === 'expense') paymentGroup.classList.remove('hidden');
            else paymentGroup.classList.add('hidden');
        });
    });

    // Theme Menu
    document.getElementById('theme-btn').onclick = () => {
        document.getElementById('theme-menu').classList.toggle('hidden');
    };

    document.querySelectorAll('.theme-opt').forEach(opt => {
        opt.onclick = () => {
            const theme = opt.dataset.theme;
            applyTheme(theme);
            document.getElementById('theme-menu').classList.add('hidden');
        };
    });

    // Save Entry
    document.getElementById('save-entry-btn').onclick = saveEntry;

    // Filters
    document.getElementById('month-filter').onchange = renderList;

    // Global Reset
    document.getElementById('reset-data-btn').onclick = () => {
        if (confirm("Kral, tüm verilerin silinecek. Emin misin?")) {
            entries = [];
            storage.set('budge_v2_entries', entries);
            location.reload();
        }
    };

    renderStats();
    renderReminders();
}

function applyTheme(theme) {
    document.body.className = theme;
    currentTheme = theme;
    storage.set('budge_v1_theme', theme);
}

// --- Core Logic ---

function saveEntry() {
    const amount = parseFloat(document.getElementById('entry-amount').value);
    const desc = document.getElementById('entry-desc').value.trim();
    const date = document.getElementById('entry-date').value;
    const isPaid = document.getElementById('entry-paid').checked;

    if (!amount || !desc || !date) return alert("Hocam tüm alanları dolduralım.");

    const entry = {
        id: Date.now(),
        type: currentType,
        amount: amount,
        desc: desc,
        date: date,
        isPaid: currentType === 'income' ? true : isPaid
    };

    entries.unshift(entry);
    entries.sort((a, b) => new Date(b.date) - new Date(a.date));
    storage.set('budge_v2_entries', entries);

    // Feedback
    const btn = document.getElementById('save-entry-btn');
    btn.innerHTML = '<i class="ph ph-check"></i> Kaydedildi!';
    setTimeout(() => {
        btn.innerHTML = '<i class="ph ph-check-circle"></i> Kaydet';
        document.getElementById('entry-amount').value = '';
        document.getElementById('entry-desc').value = '';
    }, 1500);

    renderStats();
    renderReminders();
}

function renderStats() {
    let income = 0; let expense = 0;
    const now = new Date();
    const currentYM = now.toISOString().substring(0, 7);
    let mIncome = 0; let mExpense = 0;

    entries.forEach(e => {
        if (e.type === 'income') income += e.amount;
        else expense += e.amount;

        if (e.date.startsWith(currentYM)) {
            if (e.type === 'income') mIncome += e.amount;
            else mExpense += e.amount;
        }
    });

    document.getElementById('total-income').innerText = formatCurrency(income);
    document.getElementById('total-expense').innerText = formatCurrency(expense);
    document.getElementById('net-balance').innerText = formatCurrency(income - expense);

    // Progress
    const monthName = now.toLocaleString('tr-TR', { month: 'long', year: 'numeric' });
    document.getElementById('current-month-name').innerText = monthName;
    const percent = mIncome > 0 ? (mExpense / mIncome) * 100 : 0;
    document.getElementById('progress-fill').style.width = Math.min(percent, 100) + '%';
    document.getElementById('month-percent').innerText = `%${percent.toFixed(0)} Harcandı`;
}

function renderReminders() {
    const container = document.getElementById('reminder-container');
    container.innerHTML = '';

    const unpaid = entries.filter(e => e.type === 'expense' && !e.isPaid);
    if (unpaid.length === 0) return;

    const today = new Date();
    today.setHours(0,0,0,0);

    // En yakın ödemeyi bul
    unpaid.sort((a,b) => new Date(a.date) - new Date(b.date));
    const next = unpaid[0];
    const dueDate = new Date(next.date);
    const diff = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));

    let msg = `Gelecek Ödeme: <strong>${next.desc}</strong>`;
    if (diff === 0) msg += " (Bugün Son Gün!) ⚠️";
    else if (diff < 0) msg += ` (${Math.abs(diff)} gün gecikti!) ❌`;
    else msg += ` (${diff} gün kaldı) ⏳`;

    container.innerHTML = `
        <div class="reminder-card">
            <i class="ph-fill ph-bell-ringing"></i>
            <div>${msg}</div>
        </div>
    `;
}

function renderList() {
    const listContainer = document.getElementById('entries-list');
    const filter = document.getElementById('month-filter');
    
    if (filter.options.length === 0 || entries.length > filter.options.length - 1) {
        const months = [...new Set(entries.map(e => e.date.substring(0, 7)))].sort().reverse();
        const currentVal = filter.value;
        filter.innerHTML = '<option value="all">Tüm Zamanlar</option>';
        months.forEach(m => {
            const [year, month] = m.split('-');
            const dateObj = new Date(year, month - 1);
            const name = dateObj.toLocaleString('tr-TR', { month: 'long', year: 'numeric' });
            filter.innerHTML += `<option value="${m}">${name}</option>`;
        });
        filter.value = currentVal || 'all';
    }

    const filtered = filter.value === 'all' ? entries : entries.filter(e => e.date.startsWith(filter.value));
    listContainer.innerHTML = filtered.length === 0 ? '<div style="text-align:center; padding:50px; color:var(--text-muted)">Kayıt yok.</div>' : '';

    filtered.forEach(e => {
        const div = document.createElement('div');
        div.className = 'entry-item';
        
        let subText = '';
        if (e.type === 'expense' && !e.isPaid) {
            const diff = Math.ceil((new Date(e.date) - new Date()) / (1000 * 60 * 60 * 24));
            subText = `<span class="unpaid-badge"><i class="ph ph-clock"></i> ${diff <= 0 ? 'Vadesi Geçti' : diff + ' gün kaldı'}</span>`;
        } else if (e.type === 'expense') {
            subText = `<span style="font-size:9px; color:var(--income)"><i class="ph ph-check-circle"></i> Ödendi</span>`;
        }

        div.innerHTML = `
            <div class="entry-info">
                <span class="entry-title">${e.desc}</span>
                <span class="entry-date">${new Date(e.date).toLocaleDateString('tr-TR')}</span>
                ${subText}
            </div>
            <div class="entry-amount ${e.type}">
                ${e.type === 'income' ? '+' : '-'}${formatCurrency(e.amount)}
            </div>
        `;
        
        // Ödeme durumunu değiştirmek için tıklama (Gider ise)
        if (e.type === 'expense') {
            div.onclick = () => togglePaid(e.id);
        }
        
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
    const groups = {};
    entries.forEach(e => {
        const m = e.date.substring(0, 7);
        if (!groups[m]) groups[m] = { income: 0, expense: 0 };
        groups[e.type === 'income' ? 'income' : 'expense'] += e.amount; // Bu satırda hata vardı, düzeltildi
    });
    // Doğru gruplama mantığı:
    const monthlyGroups = {};
    entries.forEach(e => {
        const m = e.date.substring(0, 7);
        if (!monthlyGroups[m]) monthlyGroups[m] = { income: 0, expense: 0 };
        if (e.type === 'income') monthlyGroups[m].income += e.amount;
        else monthlyGroups[m].expense += e.amount;
    });

    Object.keys(monthlyGroups).sort().reverse().forEach(m => {
        const [y, mon] = m.split('-');
        const name = new Date(y, mon-1).toLocaleString('tr-TR', { month: 'long', year: 'numeric' });
        const s = monthlyGroups[m];
        const card = document.createElement('div');
        card.className = 'monthly-card';
        card.innerHTML = `<h3>${name}</h3><div class="monthly-grid">
            <div class="m-stat"><label>Gelir</label><span style="color:var(--income)">+${formatCurrency(s.income)}</span></div>
            <div class="m-stat"><label>Gider</label><span style="color:var(--expense)">-${formatCurrency(s.expense)}</span></div>
            <div class="m-stat" style="grid-column:span 2; margin-top:10px; border-top:1px solid var(--border); padding-top:10px;">
                <label>Net Durum</label><span>${formatCurrency(s.income - s.expense)}</span>
            </div>
        </div>`;
        container.appendChild(card);
    });
}

function formatCurrency(val) {
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
}
