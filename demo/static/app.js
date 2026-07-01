let contentDiv = document.getElementById('app-content');
const titleEl = document.getElementById('module-title');

// --- TAB SYSTEM STATE ---
window.appTabs = [];
window.activeTabId = null;

// Startup Error Boundary
window.onerror = function(msg, url, line, col, error) {
    if (!window._appLoaded) {
        const overlay = document.getElementById('startup-monitor-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            document.getElementById('startup-error-msg').innerHTML = 
                `<b>Napaka v kodi:</b> <br>${msg}<br><small style='color:#999'>Vrstica ${line} (col ${col})</small>`;
        }
    }
    console.error("Global JS Error:", msg, url, line, col, error);
    return false;
};

// UI ICONS (SVG)
const ICONS = {
    edit: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`,
    delete: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`,
    download: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>`,
    send: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>`,
    liquidate: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 3h5v5"></path><path d="M8 3H3v5"></path><path d="M12 22v-8.3"></path><path d="M12 13.7l3 3"></path><path d="M12 13.7l-3 3"></path><path d="M5 21h14"></path></svg>`,
    invoice: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
    book: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>`,
    unbook: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path><line x1="3" y1="3" x2="21" y2="21"></line></svg>`
};

// Globalni dodatni slogi za UI
const uiStyles = document.createElement('style');
uiStyles.innerHTML = `
    .action-buttons { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
    .icon-btn { 
        display: flex; align-items: center; justify-content: center;
        width: 32px; height: 32px; border-radius: 6px; border: 1px solid #dee2e6;
        background: #f8f9fa; color: #495057; cursor: pointer; transition: all 0.2s;
        padding: 0; line-height: 0;
    }
    .icon-btn:hover { background: #e9ecef; color: var(--primary-blue); border-color: #adb5bd; transform: translateY(-1px); }
    .icon-btn.btn-red { color: var(--primary-red); border-color: #ffc9c9; background: #fff5f5; }
    .icon-btn.btn-red:hover { color: white; background: var(--primary-red); border-color: var(--primary-red); }
    .icon-btn.btn-green { color: #2b8a3e; border-color: #c3e6cb; background: #ebfbee; }
    .icon-btn.btn-green:hover { color: white; background: #2b8a3e; border-color: #2b8a3e; }
    .icon-btn.btn-orange { color: #f08c00; border-color: #ffeeba; background: #fff9db; }
    .icon-btn.btn-orange:hover { color: white; background: #f08c00; border-color: #f08c00; }
    .attachment-actions { display: flex; gap: 10px; margin-top: 10px; padding: 10px; background: #f8f9fa; border-top: 1px solid #eee; border-radius: 0 0 8px 8px; }
    
    .bulk-action-bar {
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: #212529; color: white; padding: 12px 24px; border-radius: 12px;
        display: none; align-items: center; gap: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        z-index: 10000; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        border: 1px solid rgba(255,255,255,0.1);
    }
    .bulk-action-bar.active { display: flex; transform: translateX(-50%) translateY(0); animation: slideUp 0.3s forwards; }
    @keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }
`;
document.head.appendChild(uiStyles);

// --- TAB SYSTEM FUNCTIONS ---
window.createTab = function(moduleName, title, data = null) {
    const tabId = moduleName + (data && data.id ? `_${data.id}` : '');
    const existingTab = window.appTabs.find(t => t.id === tabId);
    
    if (existingTab) {
        window.switchTab(tabId);
        return;
    }
    
    // Create new tab
    const newTab = { id: tabId, module: moduleName, title: title, data: data };
    window.appTabs.push(newTab);
    
    // Create container for tab content
    const container = document.createElement('div');
    container.id = `tab-content-${tabId}`;
    container.className = 'tab-content-container';
    document.getElementById('app-content').appendChild(container);
    
    window.renderTabsUI();
    window.switchTab(tabId);
    
    // Render module content into container
    window.renderModuleToContainer(moduleName, container, title, data);
    window.saveTabsState();
};

window.switchTab = function(tabId) {
    window.activeTabId = tabId;
    
    // UI update tabs
    document.querySelectorAll('.app-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.id === tabId);
    });
    
    // UI update content
    document.querySelectorAll('.tab-content-container').forEach(c => {
        c.classList.toggle('active', c.id === `tab-content-${tabId}`);
    });
    
    window.renderTabsUI(); // To update active state in UI
    window.saveTabsState();
    
    // Render if empty (restored from session)
    const tab = window.appTabs.find(t => t.id === tabId);
    const container = document.getElementById(`tab-content-${tabId}`);
    if (tab && container && container.innerHTML === '') {
        window.renderModuleToContainer(tab.module, container, tab.title, tab.data);
    }
    
    // Scroll active tab into view
    const activeTab = document.querySelector(`.app-tab[data-id="${tabId}"]`);
    if (activeTab) activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
};

window.closeTab = function(tabId, event) {
    if (event) event.stopPropagation();
    
    const index = window.appTabs.findIndex(t => t.id === tabId);
    if (index === -1) return;
    
    const closedTab = window.appTabs.splice(index, 1)[0];
    const container = document.getElementById(`tab-content-${tabId}`);
    if (container) container.remove();
    
    if (window.activeTabId === tabId) {
        if (window.appTabs.length > 0) {
            const nextTab = window.appTabs[Math.max(0, index - 1)];
            window.switchTab(nextTab.id);
        } else {
            window.activeTabId = null;
        }
    }
    
    window.renderTabsUI();
    window.saveTabsState();
};

window.saveTabsState = function() {
    sessionStorage.setItem('appTabs', JSON.stringify(window.appTabs));
    sessionStorage.setItem('activeTabId', window.activeTabId);
};

window.loadTabsState = function() {
    const savedTabs = sessionStorage.getItem('appTabs');
    const savedActiveId = sessionStorage.getItem('activeTabId');
    
    if (savedTabs && savedTabs !== '[]') {
        try {
            window.appTabs = JSON.parse(savedTabs);
            window.activeTabId = savedActiveId;
            
            console.log("Obnavljam zavihke:", window.appTabs.length);
            
            const content = document.getElementById('app-content');
            window.appTabs.forEach(tab => {
                const container = document.createElement('div');
                container.id = `tab-content-${tab.id}`;
                container.className = 'tab-content-container';
                if (tab.id === window.activeTabId) container.classList.add('active');
                content.appendChild(container);
            });
            
            window.renderTabsUI();
            
            if (window.activeTabId) {
                const activeTab = window.appTabs.find(t => t.id === window.activeTabId);
                if (activeTab) {
                    const container = document.getElementById(`tab-content-${activeTab.id}`);
                    window.renderModuleToContainer(activeTab.module, container, activeTab.title, activeTab.data);
                }
            }
            return true;
        } catch (e) {
            console.error("Napaka pri branju stanja zavihkov:", e);
            return false;
        }
    }
    return false;
};

window.renderTabsUI = function() {
    const bar = document.getElementById('app-tabs-bar');
    if (!bar) return;
    
    bar.innerHTML = window.appTabs.map(tab => `
        <div class="app-tab ${tab.id === window.activeTabId ? 'active' : ''}" 
             data-id="${tab.id}" 
             onclick="window.switchTab('${tab.id}')">
            <span class="tab-title">${tab.title}</span>
            <span class="close-tab" onclick="window.closeTab('${tab.id}', event)">×</span>
        </div>
    `).join('');

    // Preveri overflow in prikaži/skrij puščice
    setTimeout(() => {
        const leftBtn = document.getElementById('tabs-scroll-left');
        const rightBtn = document.getElementById('tabs-scroll-right');
        if (leftBtn && rightBtn) {
            const hasOverflow = bar.scrollWidth > bar.clientWidth;
            leftBtn.style.display = hasOverflow ? 'block' : 'none';
            rightBtn.style.display = hasOverflow ? 'block' : 'none';
        }
    }, 50);
};

window.scrollTabs = function(direction) {
    const bar = document.getElementById('app-tabs-bar');
    if (!bar) return;
    bar.scrollBy({ left: direction * 200, behavior: 'smooth' });
};

window.renderModuleToContainer = async function(moduleName, container, title, data) {
    const oldDiv = contentDiv;
    contentDiv = container;
    
    try {
        if (moduleName === 'dashboard') await renderDashboard();
        else if (moduleName === 'partnerji') await renderPartnerji();
        else if (moduleName === 'partner_edit' || moduleName === 'partner_new') await renderPartnerForm(data);
        else if (moduleName === 'artikli_storitve') await renderArtikliStoritve();
        else if (['izdani_racuni', 'prejeti_racuni', 'prejete_ponudbe', 'ponudbe', 'dobropisi', 'prejeti_dobropisi', 'delovni_nalogi'].includes(moduleName)) {
            await renderDokumenti(moduleName, title);
        }
        else if (moduleName === 'izpiski') await renderIzpiski();
        else if (moduleName === 'glavna_knjiga') await renderGlavnaKnjiga();
        else if (moduleName === 'osnovna_sredstva') await renderOsnovnaSredstva();
        else if (moduleName === 'potni_nalogi') await renderPotniNalogi();
        else if (moduleName === 'zaposleni') await window.renderZaposleni();
        else if (moduleName === 'prispevki') await renderPlace();
        else if (moduleName === 'konto_kartica') await renderKontoKartica();
        else if (moduleName === 'nastavitve') await renderNastavitve();
        else if (moduleName === 'help') await renderHelp();
        else if (moduleName === 'zgodovina') await renderZgodovina();
        else if (moduleName === 'financna_porocila') await renderFinancnaPorocila();
        else if (moduleName === 'crm_dashboard') await renderCRM_Dashboard();
        else if (moduleName === 'crm_kanal') await renderCRM_Kanal();
        else if (moduleName === 'crm_aktivnosti') await renderCRM_Aktivnosti();
        else if (moduleName === 'crm_interakcije') await renderCRM_Interakcije();
    } finally {
        // Obnovimo contentDiv, če smo še vedno v istem zavihku (preprečimo race condition)
        const currentTabId = moduleName + (data && data.id ? `_${data.id}` : '');
        if (window.activeTabId === currentTabId) {
            contentDiv = container;
        } else {
            contentDiv = oldDiv;
        }
    }
};

// --- NAVIGATION ---
window.toggleNavGroup = function(header) {
    const group = header.parentElement;
    const isOpen = group.classList.contains('open');
    
    // Zapremo vse ostale (accordion efekt)
    document.querySelectorAll('.nav-group').forEach(g => {
        if (g !== group) g.classList.remove('open');
    });
    
    // Toggle current group
    if (isOpen) {
        group.classList.remove('open');
    } else {
        group.classList.add('open');
    }
};

// --- GLOBALNA SELEKCIJA (MNOŽIČNE AKCIJE) ---
window.appSelection = {
    module: null,
    ids: []
};

window.toggleItemSelection = function(id, moduleName) {
    if (window.appSelection.module !== moduleName) {
        window.appSelection.module = moduleName;
        window.appSelection.ids = [];
    }
    const idx = window.appSelection.ids.indexOf(id);
    if (idx > -1) window.appSelection.ids.splice(idx, 1);
    else window.appSelection.ids.push(id);
    
    window.updateBulkActionBar();
};

window.resetSelection = function(moduleName) {
    window.appSelection.module = moduleName;
    window.appSelection.ids = [];
    window.updateBulkActionBar();
};

window.toggleAllSelection = function(checked, moduleName) {
    window.appSelection.module = moduleName;
    const checkboxes = document.querySelectorAll('.row-checkbox');
    window.appSelection.ids = [];
    checkboxes.forEach(cb => {
        cb.checked = checked;
        if (checked) {
            const id = parseInt(cb.getAttribute('data-id'));
            if (id) window.appSelection.ids.push(id);
        }
    });
    window.updateBulkActionBar();
};

window.updateBulkActionBar = function() {
    let bar = document.getElementById('bulk-action-bar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'bulk-action-bar';
        bar.className = 'bulk-action-bar';
        document.body.appendChild(bar);
    }
    
    const count = window.appSelection.ids.length;
    if (count > 0) {
        bar.innerHTML = `
            <div style="font-weight:600; font-size:0.95em;">Izbrano: ${count}</div>
            <div style="width:1px; height:20px; background:rgba(255,255,255,0.2);"></div>
            ${['izdani_racuni', 'prejeti_racuni', 'place'].includes(window.appSelection.module) ? `
                <button class="btn" onclick="window.bulkExecuteKnjizi('knjizi')" style="background:#2b8a3e; color:white; padding: 6px 16px; font-size:0.9em; border:none;">
                    ${ICONS.book} Knjiži izbrane
                </button>
                <button class="btn" onclick="window.bulkExecuteKnjizi('razknjizi')" style="background:#e67700; color:white; padding: 6px 16px; font-size:0.9em; border:none;">
                    ${ICONS.unbook} Razknjiži izbrane
                </button>
                <div style="width:1px; height:20px; background:rgba(255,255,255,0.2);"></div>
            ` : ''}
            <button class="btn btn-red" onclick="window.bulkExecuteDelete()" style="padding: 6px 16px; font-size:0.9em;">
                ${ICONS.delete} Izbriši izbrane
            </button>
            <button class="btn" onclick="window.resetSelection('${window.appSelection.module}'); window.refreshCurrentModule();" style="background:transparent; color:#adb5bd; border:none;">Prekliči</button>
        `;
        bar.classList.add('active');
    } else {
        bar.classList.remove('active');
    }
};

window.bulkExecuteDelete = async function() {
    const count = window.appSelection.ids.length;
    const module = window.appSelection.module;
    if (!count || !module) return;
    
    if (!confirm(`Ali ste prepričani, da želite izbrisati ${count} izbranih elementov?`)) return;
    
    try {
        const res = await fetch('/api/bulk-delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ module: module, ids: window.appSelection.ids })
        });
        
        if (res.ok) {
            window.appSelection.ids = [];
            window.updateBulkActionBar();
            window.refreshCurrentModule();
        } else {
            const err = await res.json();
            alert("Napaka pri skupinskem brisanju: " + (err.detail || "Neznana napaka"));
        }
    } catch (e) {
        console.error(e);
        alert("Napaka pri komunikaciji s strežnikom.");
    }
};

window.bulkExecuteKnjizi = async function(akcija) {
    const count = window.appSelection.ids.length;
    if (!count) return;
    
    if (akcija === 'razknjizi') {
        if (!confirm(`Ali ste prepričani, da želite razknjižiti ${count} izbranih dokumentov?`)) return;
        izvediBulkKnjizenje('razknjizi', null, null);
    } else {
        odpriTemeljnicaPopup(function(tid, naziv) {
            izvediBulkKnjizenje('knjizi', tid, naziv);
        });
    }
};

async function izvediBulkKnjizenje(akcija, temeljnica_id, novi_naziv) {
    try {
        const payload = { 
            ids: window.appSelection.ids, 
            akcija: akcija,
            module: window.appSelection.module
        };
        if (temeljnica_id) payload.temeljnica_id = temeljnica_id;
        if (novi_naziv) payload.novi_naziv = novi_naziv;
        
        const res = await fetch('/api/knjizenje/bulk_knjizi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (res.ok) {
            const data = await res.json();
            const napakeMsg = data.napake.length ? `\nNapake (${data.napake.length}):\n` + data.napake.join('\n') : '';
            alert(`Uspešno knjiženih: ${data.uspesno}${napakeMsg}`);
            window.appSelection.ids = [];
            window.updateBulkActionBar();
            // Refresh the correct module
            const mod = window.appSelection.module || window._currentDocTip;
            if (['izdani_racuni', 'prejeti_racuni', 'prejete_ponudbe', 'ponudbe', 'dobropisi', 'prejeti_dobropisi', 'delovni_nalogi'].includes(mod)) {
                const titles = { 'izdani_racuni': 'Izdani računi', 'prejeti_racuni': 'Prejeti računi', 'prejete_ponudbe': 'Prejete ponudbe', 'ponudbe': 'Ponudbe', 'dobropisi': 'Dobropisi', 'prejeti_dobropisi': 'Prejeti dobropisi', 'delovni_nalogi': 'Delovni nalogi' };
                renderDokumenti(mod, titles[mod]);
            } else if (mod === 'place') {
                renderPlace();
            } else {
                window.refreshCurrentModule(mod);
            }
        } else {
            alert("Napaka pri skupinskem knjiženju.");
        }
    } catch (e) {
        console.error(e);
        alert("Napaka pri komunikaciji s strežnikom.");
    }
}

window.knjiziPosamezen = async function(id, akcija, tip) {
    if (akcija === 'razknjizi') {
        if (!confirm(`Ali želite razknjižiti ta dokument?`)) return;
        izvediKnjiziPosamezen(id, 'razknjizi', null, null, tip);
    } else {
        odpriTemeljnicaPopup(function(tid, naziv) {
            izvediKnjiziPosamezen(id, 'knjizi', tid, naziv, tip);
        });
    }
};

async function izvediKnjiziPosamezen(id, akcija, temeljnica_id, novi_naziv, tip) {
    try {
        let url = `/api/dokumenti/${id}/${akcija}`;
        if (tip === 'izpiski') url = `/api/izpiski/${id}/${akcija}`;
        if (tip === 'potni_nalogi') url = `/api/potni_nalogi/${id}/${akcija}`;
        if (tip === 'place') url = `/api/place/${id}/${akcija}`;
        
        const payload = {};
        if (temeljnica_id) payload.temeljnica_id = temeljnica_id;
        if (novi_naziv) payload.novi_naziv = novi_naziv;
        
        const res = await fetch(url, { 
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: akcija === 'knjizi' ? JSON.stringify(payload) : null
        });
        if (res.ok) {
            // Use the passed tip first, then fallback to appSelection.module
            const activeModule = tip || window.appSelection.module;
            if (['izdani_racuni', 'prejeti_racuni', 'prejete_ponudbe', 'ponudbe', 'dobropisi', 'prejeti_dobropisi', 'delovni_nalogi'].includes(activeModule)) {
                const titles = { 'izdani_racuni': 'Izdani računi', 'prejeti_racuni': 'Prejeti računi', 'prejete_ponudbe': 'Prejete ponudbe', 'ponudbe': 'Ponudbe', 'dobropisi': 'Dobropisi', 'prejeti_dobropisi': 'Prejeti dobropisi', 'delovni_nalogi': 'Delovni nalogi' };
                renderDokumenti(activeModule, titles[activeModule]);
            } else if (activeModule === 'place') {
                renderPlace();
            } else {
                window.refreshCurrentModule(activeModule);
            }
        } else {
            const err = await res.json();
            alert(`Napaka pri ${akcija === 'knjizi' ? 'knjiženju' : 'razknjiženju'}: ` + (err.detail || ""));
        }
    } catch(e) { alert("Napaka komunikacije s strežnikom."); }
}

let onTemeljnicaPopupConfirm = null;

window.onTemeljnicaSelectChange = function() {
    const sel = document.getElementById('tp_izbira_temeljnice');
    const wrapper = document.getElementById('tp_novi_naziv_wrapper');
    if (wrapper) wrapper.style.display = (sel.value === '-1') ? 'block' : 'none';
};

window.odpriTemeljnicaPopup = async function(callback) {
    onTemeljnicaPopupConfirm = callback;
    document.getElementById('temeljnica-popup-overlay').style.display = 'flex';
    
    const sel = document.getElementById('tp_izbira_temeljnice');
    sel.innerHTML = '<option value="-1">-- Ustvari NOVO temeljnico --</option>';
    const nazivEl = document.getElementById('tp_novi_naziv');
    if (nazivEl) nazivEl.value = '';
    const wrapper = document.getElementById('tp_novi_naziv_wrapper');
    if (wrapper) wrapper.style.display = 'block';
    
    try {
        const leto = getLeto();
        const res = await fetch(`/api/temeljnice?leto=${leto}`);
        if (res.ok) {
            const data = await res.json();
            data.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.id;
                opt.textContent = `${t.vrsta} ${t.stevilka} (${t.datum}) - ${t.opis || ''}`;
                sel.appendChild(opt);
            });
        }
    } catch(e) { console.error(e); }
};

window.zapriTemeljnicaPopup = function() {
    document.getElementById('temeljnica-popup-overlay').style.display = 'none';
    onTemeljnicaPopupConfirm = null;
};

window.potrdiTemeljnicaPopup = function() {
    const sel = document.getElementById('tp_izbira_temeljnice');
    const tid = parseInt(sel.value);
    const nazivEl = document.getElementById('tp_novi_naziv');
    const naziv = (tid === -1 && nazivEl) ? nazivEl.value.trim() : null;
    document.getElementById('temeljnica-popup-overlay').style.display = 'none';
    if (onTemeljnicaPopupConfirm) {
        onTemeljnicaPopupConfirm(tid, naziv);
        onTemeljnicaPopupConfirm = null;
    }
};

window.refreshCurrentModule = function() {
    const tab = window.appTabs.find(t => t.id === window.activeTabId);
    if (tab) {
        const container = document.getElementById(`tab-content-${tab.id}`);
        if (container) {
            window.renderModuleToContainer(tab.module, container, tab.title, tab.data);
        }
    }
};

// --- GLOBALNO RAZVRŠČANJE (SORTIRANJE) ---
window.appSortState = {
    'izdani_racuni': { field: 'datum_izdaje', order: 'desc' },
    'prejeti_racuni': { field: 'datum_izdaje', order: 'desc' },
    'prejete_ponudbe': { field: 'datum_izdaje', order: 'desc' },
    'ponudbe': { field: 'datum_izdaje', order: 'desc' },
    'dobropisi': { field: 'datum_izdaje', order: 'desc' },
    'delovni_nalogi': { field: 'datum_izdaje', order: 'desc' },
    'partnerji': { field: 'naziv', order: 'asc' },
    'artikli_storitve': { field: 'sifra', order: 'asc' },
    'izpiski': { field: 'datum', order: 'desc' },
    'zaposleni': { field: 'priimek_ime', order: 'asc' },
    'potni_nalogi': { field: 'datum_odhoda', order: 'desc' },
    'osnovna_sredstva': { field: 'datum_nabave', order: 'desc' },
    'prispevki': { field: 'leto_mesec', order: 'desc' }
};

window.sortAppData = function(data, moduleName) {
    const state = window.appSortState[moduleName] || { field: 'id', order: 'desc' };
    const mesecVrednosti = {
        'januar': 1, 'februar': 2, 'marec': 3, 'april': 4, 'maj': 5, 'junij': 6,
        'julij': 7, 'avgust': 8, 'september': 9, 'oktober': 10, 'november': 11, 'december': 12
    };

    return [...data].sort((a, b) => {
        let valA = a[state.field];
        let valB = b[state.field];
        
        // Posebna logika za razvrščanje po mesecu/letu
        if (state.field === 'leto_mesec') {
            const letoA = parseInt(a.leto) || 0;
            const letoB = parseInt(b.leto) || 0;
            if (letoA !== letoB) {
                return state.order === 'asc' ? letoA - letoB : letoB - letoA;
            }
            const mesecA = mesecVrednosti[(a.mesec || "").toLowerCase()] || 0;
            const mesecB = mesecVrednosti[(b.mesec || "").toLowerCase()] || 0;
            return state.order === 'asc' ? mesecA - mesecB : mesecB - mesecA;
        }

        // Posebno ravnanje za številke (zneski)
        if (state.field.includes('znesek') || state.field === 'kolicina' || state.field === 'cena_enote' || state.field === 'bruto_placa') {
            valA = parseFloat(valA) || 0;
            valB = parseFloat(valB) || 0;
            if (valA < valB) return state.order === 'asc' ? -1 : 1;
            if (valA > valB) return state.order === 'asc' ? 1 : -1;
            return 0;
        } else {
            // Vse ostalo kot string
            valA = (valA || "").toString().toLowerCase();
            valB = (valB || "").toString().toLowerCase();
        }
        
        if (valA < valB) return state.order === 'asc' ? -1 : 1;
        if (valA > valB) return state.order === 'asc' ? 1 : -1;
        return 0;
    });
};

window.renderSortControls = function(moduleName, fields, onUpdate) {
    const state = window.appSortState[moduleName];
    if (!state) return '';
    
    return `
        <div style="background: #f8f9fa; padding: 10px 15px; border-radius: 8px; border: 1px solid #dee2e6; display: flex; align-items: center; gap: 15px; margin-bottom: 20px; font-size: 0.9em;">
            <div style="font-weight: 600; color: #495057;">Razvrščanje:</div>
            <select onchange="window.appSortState['${moduleName}'].field = this.value; ${onUpdate}" style="padding: 4px 8px; border-radius: 4px; border: 1px solid #ced4da;">
                ${fields.map(f => `<option value="${f.key}" ${state.field === f.key ? 'selected' : ''}>${f.label}</option>`).join('')}
            </select>
            <select onchange="window.appSortState['${moduleName}'].order = this.value; ${onUpdate}" style="padding: 4px 8px; border-radius: 4px; border: 1px solid #ced4da;">
                <option value="asc" ${state.order === 'asc' ? 'selected' : ''}>Naraščajoče (A-Z, Min)</option>
                <option value="desc" ${state.order === 'desc' ? 'selected' : ''}>Padajoče (Z-A, Max)</option>
            </select>
        </div>
    `;
};

function getLeto() {
    return parseInt(document.getElementById('poslovno-leto').value);
}

async function osveziKontiDatalist() {
    const list = document.getElementById('konti-datalist');
    if (!list) return;
    try {
        const res = await fetch('/api/konti');
        const konti = await res.json();
        list.innerHTML = konti.map(k => `<option value="${k.stevilka}">${k.naziv}</option>`).join('');
    } catch (e) { console.error("Napaka pri osveževanju kontov:", e); }
}

// Osveži na zagonu
osveziKontiDatalist();

// ==========================================
// SISTEM PRILOG - skupna pomožna logika
// ==========================================
window.PrilogeUI = {
    parentType: null,
    parentId: null,
    zadnjePoslano: null,
    _liste: [],

    // Inicializacija po tem, ko je element v DOM
    async init(parentType, parentId) {
        this.parentType = parentType;
        this.parentId = parentId;
        await this.refresh();
    },

    async refresh() {
        if (!this.parentId) return;
        try {
            const res = await fetch(`/api/priloge/${this.parentType}/${this.parentId}`);
            this._liste = await res.json();
        } catch(e) { this._liste = []; }
        this._renderPreview();
    },

    _renderPreview(activeIdx = 0) {
        const panel = document.getElementById('prilogePanelContent');
        if (!panel) return;

        if (this._liste.length === 0) {
            panel.innerHTML = `
                <div class="preview-empty">
                    <div class="preview-empty-icon">📎</div>
                    <div>Ni naloženih prilog</div>
                    <div style="font-size:0.8rem;">Naložite PDF ali sliko s spodnjim gumbom</div>
                </div>`;
            return;
        }

        const tabsHtml = this._liste.map((f, i) => `
            <button class="preview-tab ${i === activeIdx ? 'active' : ''}" onclick="window.PrilogeUI._renderPreview(${i})">
                📄 ${f.original_name.length > 20 ? f.original_name.substring(0,18)+'…' : f.original_name}
                <span class="preview-tab-delete" onclick="event.stopPropagation(); window.PrilogeUI.delete(${f.id})" title="Izbriši prilogo">✕</span>
            </button>
        `).join('');

        const active = this._liste[activeIdx] || this._liste[0];
        const ext = active.original_name.split('.').pop().toLowerCase();
        
        // Cache buster prepreči brskalniku, da bi prikazal staro verzijo PDF-ja, če se je ta na strežniku spremenila
        const cb = `?t=${new Date().getTime()}`;
        const urlWithCache = active.url + cb;

        let previewHtml;
        if (ext === 'pdf') {
            previewHtml = `<iframe src="${urlWithCache}#toolbar=0&navpanes=0&scrollbar=1&view=FitH" style="width:100%; height:100%; border:none;"></iframe>`;
        } else if (['jpg','jpeg','png','gif','webp'].includes(ext)) {
            previewHtml = `<div style="overflow:auto; height:100%; text-align:center; padding:10px;"><img src="${urlWithCache}" style="max-width:100%; box-shadow:0 2px 8px rgba(0,0,0,0.15);"></div>`;
        } else {
            previewHtml = `<div class="preview-empty"><div class="preview-empty-icon">📄</div><div>Predogled ni na voljo za ta format.</div><a href="${urlWithCache}" target="_blank" class="btn btn-blue" style="margin-top:10px;">Odpri datoteko</a></div>`;
        }

        panel.innerHTML = `
            <div class="preview-tabs">${tabsHtml}</div>
            <div class="preview-frame-container">${previewHtml}</div>
            ${(this.parentType === 'dokumenti' && this.zadnjePoslano) ? `
                <div class="attachment-actions" style="display:flex; align-items:center; flex-wrap:wrap; gap:10px; padding: 10px 15px;">
                    <span style="font-size:0.85em; color:#2b8a3e; display:flex; align-items:center; gap:5px;">
                        <span style="font-size:1.2em;">✉</span> Poslano: ${formatDateJS(this.zadnjePoslano.split(' ')[0])} ob ${this.zadnjePoslano.split(' ')[1].substring(0,5)}
                    </span>
                </div>
            ` : ''}
        `;
    },

    async upload(input) {
        if (!input.files || !input.files.length) return;
        const file = input.files[0];
        if (!this.parentId) {
            alert('Najprej shranite dokument, preden dodate prilogo.');
            input.value = '';
            return;
        }
        await this._uploadRaw(file, this.parentType, this.parentId);
        input.value = '';
    },

    async _uploadRaw(file, type, id) {
        const fd = new FormData();
        fd.append('file', file);
        try {
            const res = await fetch(`/api/upload_priloga?parent_type=${type}&parent_id=${id}`, {method:'POST', body: fd});
            if (!res.ok) { const e = await res.json(); alert('Napaka pri uvozu priloge: ' + e.detail); }
            else { 
                if (this.parentId == id && this.parentType == type) {
                    await this.refresh(); 
                }
            }
        } catch(e) { console.error('Napaka pri nalaganju priloge:', e); }
    },

    async delete(id) {
        if (!confirm('Ali ste prepričani, da želite izbrisati to prilogo?')) return;
        try {
            await fetch(`/api/priloge/${id}`, {method:'DELETE'});
            await this.refresh();
        } catch(e) { alert('Napaka pri brisanju.'); }
    }
};

// Generira HTML za levi+desni razdeljeni pogled
function buildSplitViewHTML(formHtml, parentType, parentId) {
    const hasId = !!parentId;
    return `
        <div class="split-view">
            <div class="split-view-form">
                ${formHtml}
            </div>
            <div class="split-view-preview">
                <div id="prilogePanelContent" style="flex:1; overflow:hidden; display:flex; flex-direction:column;">
                    <div class="preview-empty"><div class="preview-empty-icon">📎</div><div>${hasId ? 'Nalagam...' : 'Najprej shranite dokument'}</div></div>
                </div>
                <div class="preview-upload-bar">
                    <label>Dodaj prilogo:</label>
                    <input type="file" id="prilogaInput" accept=".pdf,.jpg,.jpeg,.png,.txt,.xml" style="flex:1; font-size:0.8rem;" onchange="window.PrilogeUI.upload(this)">
                </div>
            </div>
        </div>
    `;
}

async function showModule(moduleName) {
    const pOverlay = document.getElementById('partner-popup-overlay');
    if (pOverlay) pOverlay.classList.remove('active');
    const dOverlay = document.getElementById('dokument-popup-overlay');
    if (dOverlay) dOverlay.style.display = 'none';
    
    document.querySelectorAll('nav a').forEach(a => a.classList.remove('active'));
    let linkToActivate = null;
    if (window.event && window.event.currentTarget && window.event.currentTarget.tagName === 'A') {
        linkToActivate = window.event.currentTarget;
    } else {
        linkToActivate = document.querySelector(`nav a[onclick*="'${moduleName}'"]`);
    }
    
    if (linkToActivate) {
        linkToActivate.classList.add('active');
        const parentGroup = linkToActivate.closest('.nav-group');
        if (parentGroup) {
            document.querySelectorAll('.nav-group').forEach(g => { if (g !== parentGroup) g.classList.remove('open'); });
            parentGroup.classList.add('open');
        } else {
            document.querySelectorAll('.nav-group').forEach(g => g.classList.remove('open'));
        }
    }

    const titleMap = {
        'dashboard': 'Nadzorna plošča',
        'partnerji': 'Poslovni partnerji',
        'artikli_storitve': 'Artikli in storitve',
        'izdani_racuni': 'Izdani računi',
        'prejeti_racuni': 'Prejeti računi',
        'prejete_ponudbe': 'Prejete ponudbe',
        'ponudbe': 'Ponudbe',
        'dobropisi': 'Dobropisi',
        'prejeti_dobropisi': 'Prejeti dobropisi',
        'delovni_nalogi': 'Delovni nalogi',
        'izpiski': 'Bančni izpiski',
        'glavna_knjiga': 'Glavna knjiga',
        'osnovna_sredstva': 'Osnovna sredstva',
        'potni_nalogi': 'Potni nalogi',
        'zaposleni': 'Zaposleni',
        'prispevki': 'Plače / Prispevki',
        'konto_kartica': 'Iskanje po kontih',
        'nastavitve': 'Nastavitve',
        'help': 'Pomoč',
        'zgodovina': 'Zgodovina sprememb',
        'financna_porocila': 'Finančna poročila',
        'crm_dashboard': 'CRM Nadzorna plošča',
        'crm_kanal': 'Prodajni kanal',
        'crm_aktivnosti': 'Aktivnosti',
        'crm_interakcije': 'Interakcije'
    };
    
    const title = titleMap[moduleName] || 'Invoice83';
    window.createTab(moduleName, title);
}

// Osvežitev dashboarda ob spremembi poslovnega leta
document.getElementById('poslovno-leto').addEventListener('change', () => {
    // Preverimo, ali je dashboard trenutno aktiven
    if (titleEl.textContent === 'Nadzorna plošča') {
        renderDashboard();
    }
});

// HEARTBEAT - server se sam ustavi, ko brskalnik zapre okno
setInterval(async () => {
    try { 
        await fetch('/api/heartbeat'); 
    } catch(e) {
        // Strežnik morda še ne teče ali se ustavlja - ne prekinemo zanke
        console.warn("Heartbeat failed", e);
    }
}, 5000);

async function renderDashboard() {
    const leto = getLeto();
    contentDiv.innerHTML = '<p style="padding:20px;">Nalagam nadzorno ploščo...</p>';
    window.osveziPodjetja();
    
    // Pred-predpomnilnik za podatke, da ne nalagamo istega večkrat
    const cache = {};
    async function getCached(url) {
        if (!cache[url]) {
            const res = await fetch(url);
            cache[url] = await res.json();
        }
        return cache[url];
    }

    try {
        const nastavitve = await getCached('/api/nastavitve');
        const today = new Date(); today.setHours(0,0,0,0);

        let config = [];
        try {
            if (nastavitve.dashboard_config) config = JSON.parse(nastavitve.dashboard_config);
        } catch(e) { console.error("Napaka pri branju dashboard configa", e); }

        if (!config || config.length === 0) {
            config = [
                { id: 'kpi_cards', type: 'kpi', width: 'full', title: 'KPI Povzetek' },
                { id: 'charts', type: 'charts', width: 'full', title: 'Grafi poslovanja' },
                { id: 'terjatve', type: 'table', content: 'terjatve', width: 'half', title: 'Odprte terjatve' },
                { id: 'obveznosti', type: 'table', content: 'obveznosti', width: 'half', title: 'Neplačane obveznosti' }
            ];
        }

        function daysDiff(dateStr) {
            const d = new Date(dateStr); d.setHours(0,0,0,0);
            return Math.floor((today - d) / 86400000);
        }
        function agingLabel(days) {
            if (days <= 0) return { label: 'V roku', color: '#2b8a3e' };
            if (days <= 30) return { label: '1–30 dni', color: '#f59f00' };
            if (days <= 60) return { label: '31–60 dni', color: '#e8590c' };
            return { label: '60+ dni', color: '#c92a2a' };
        }

        let html = `
        <style>
            .dash-container { display: flex; flex-wrap: wrap; gap: 20px; padding-bottom: 40px; }
            .dash-block { min-width: 300px; display: flex; flex-direction: column; }
            .dash-block.full { width: 100%; }
            .dash-block.half { width: calc(50% - 10px); }
            @media (max-width: 1100px) { .dash-block.half { width: 100%; } }

            .dash-kpi { display:flex; gap:15px; flex-wrap:wrap; width: 100%; }
            .dash-kpi-card { flex:1; min-width:180px; background:white; border-radius:12px; padding:20px; box-shadow:0 4px 12px rgba(0,0,0,0.05); border-left:5px solid; transition: transform 0.2s; }
            .dash-kpi-card:hover { transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0,0,0,0.1); }
            .dash-kpi-card .val { font-size:1.8em; font-weight:800; margin-top:5px; }
            .dash-kpi-card .lbl { font-size:0.8em; color:#868e96; text-transform:uppercase; letter-spacing:.05em; font-weight: 600; }
            
            .dash-section { background:white; border-radius:12px; padding:25px; box-shadow:0 4px 12px rgba(0,0,0,0.05); height: 100%; box-sizing: border-box; position: relative; overflow: hidden; }
            .dash-section h4 { margin:0 0 20px 0; color:var(--primary-blue); font-size:1.1em; font-weight: 700; border-bottom:2px solid #f1f3f5; padding-bottom:12px; display: flex; align-items: center; gap: 10px; }
            .dash-charts { display:grid; grid-template-columns:1fr 1fr; gap:20px; width: 100%; }
            @media (max-width: 800px) { .dash-charts { grid-template-columns: 1fr; } }
            
            .tbl-dash { width:100%; border-collapse:collapse; font-size:0.9em; }
            .tbl-dash th { background:#f8f9fa; padding:10px 12px; text-align:left; font-weight:600; color:#495057; border-bottom: 1px solid #dee2e6; }
            .tbl-dash td { padding:10px 12px; border-bottom:1px solid #f1f3f5; vertical-align:middle; transition: background 0.2s; }
            .tbl-dash tr:hover td { background: #f8f9fa; }
            .tbl-dash tr:last-child td { border-bottom:none; }
            
            .aging-badge { display:inline-block; padding:3px 10px; border-radius:12px; font-size:0.75em; font-weight:700; color:white; text-transform: uppercase; }
            .dash-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; color: #adb5bd; text-align: center; }
            .dash-empty-icon { font-size: 3em; margin-bottom: 10px; opacity: 0.3; }
            
            .shortcut-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 15px; }
            .shortcut-btn { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 15px; background: #f8f9fa; border-radius: 10px; text-decoration: none; color: #495057; font-weight: 600; font-size: 0.85em; transition: all 0.2s; border: 1px solid transparent; }
            .shortcut-btn:hover { background: white; border-color: var(--primary-blue); color: var(--primary-blue); transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
            .shortcut-icon { font-size: 2em; }
        </style>

        <div class="dash-container">
        `;

        for (const block of config) {
            const bWidth = block.width === 'half' ? 'half' : 'full';
            html += `<div class="dash-block ${bWidth}">`;

            if (block.type === 'kpi') {
                const izdani = (await getCached('/api/dokumenti/izdani_racuni')).filter(d => d.poslovno_leto === leto);
                const prejeti = (await getCached('/api/dokumenti/prejeti_racuni')).filter(d => d.poslovno_leto === leto);
                
                const skupajIzdano = izdani.reduce((s,d) => s + d.znesek_skupaj, 0);
                const skupajPrejeto = prejeti.reduce((s,d) => s + d.znesek_skupaj, 0);
                const odprtihIzdanih = izdani.filter(d => d.status !== 'plačano').length;
                const odprtihPrejetih = prejeti.filter(d => d.status !== 'plačano').length;

                html += `
                <div class="dash-kpi">
                    <div class="dash-kpi-card" style="border-color:#1971c2; cursor:pointer;" onclick="showModule('izdani_racuni')">
                        <div class="lbl">Skupaj izdano (${leto})</div>
                        <div class="val" style="color:#1971c2;">${formatMoneyJS(skupajIzdano)}</div>
                    </div>
                    <div class="dash-kpi-card" style="border-color:#e03131; cursor:pointer;" onclick="showModule('prejeti_racuni')">
                        <div class="lbl">Skupaj prejeto (${leto})</div>
                        <div class="val" style="color:#e03131;">${formatMoneyJS(skupajPrejeto)}</div>
                    </div>
                    <div class="dash-kpi-card" style="border-color:#f59f00; cursor:pointer;" onclick="showModule('izdani_racuni')">
                        <div class="lbl">Odprte terjatve</div>
                        <div class="val" style="color:#f59f00;">${odprtihIzdanih}</div>
                    </div>
                    <div class="dash-kpi-card" style="border-color:#868e96; cursor:pointer;" onclick="showModule('prejeti_racuni')">
                        <div class="lbl">Neplačane obveznosti</div>
                        <div class="val" style="color:#868e96;">${odprtihPrejetih}</div>
                    </div>
                </div>
                `;
            } else if (block.type === 'charts') {
                html += `
                <div class="dash-charts">
                    <div class="dash-section">
                        <h4>📈 Izdani računi — mesečno</h4>
                        <canvas id="canvas-izdani" style="width:100%; height:200px; display:block;"></canvas>
                    </div>
                    <div class="dash-section">
                        <h4>📉 Prejeti računi — mesečno</h4>
                        <canvas id="canvas-prejeti" style="width:100%; height:200px; display:block;"></canvas>
                    </div>
                </div>
                `;
            } else if (block.type === 'table') {
                html += `<div class="dash-section"><h4>${block.title || 'Pregled'}</h4>`;
                
                if (block.content === 'terjatve' || block.content === 'izdani_racuni') {
                    let docs = (await getCached('/api/dokumenti/izdani_racuni')).filter(d => d.poslovno_leto === leto);
                    if (block.content === 'terjatve') docs = docs.filter(d => d.status !== 'plačano' && d.datum_zapadlosti).sort((a,b) => a.datum_zapadlosti.localeCompare(b.datum_zapadlosti));
                    else docs = docs.sort((a,b) => (b.datum_izdaje||'').localeCompare(a.datum_izdaje||'')).slice(0, 10);

                    if (docs.length === 0) {
                        html += '<div class="dash-empty"><div class="dash-empty-icon">📄</div>Ni podatkov.</div>';
                    } else {
                        html += `
                        <table class="tbl-dash">
                            <thead><tr><th>Številka</th><th>Partner</th><th>Zapadlost</th><th>Znesek</th><th>Status</th></tr></thead>
                            <tbody>
                            ${docs.map(d => {
                                const days = daysDiff(d.datum_zapadlosti);
                                const ag = agingLabel(days);
                                return `<tr style="cursor:pointer;" onclick="showUrediDokument(${d.id}, 'izdani_racuni', 'Izdani račun')">
                                    <td style="font-weight:600;color:var(--primary-blue);">${d.stevilka}</td>
                                    <td>${d.partner_naziv||'/'}</td>
                                    <td style="${days>0?'color:#c92a2a;font-weight:600;':''}">${d.datum_zapadlosti || '/'}</td>
                                    <td style="font-weight:700;">${formatMoneyJS(d.znesek_skupaj)}</td>
                                    <td><span class="aging-badge" style="background:${ag.color}">${ag.label}</span></td>
                                </tr>`;
                            }).join('')}
                            </tbody>
                        </table>`;
                    }
                } else if (block.content === 'obveznosti' || block.content === 'prejeti_racuni') {
                    let docs = (await getCached('/api/dokumenti/prejeti_racuni')).filter(d => d.poslovno_leto === leto);
                    if (block.content === 'obveznosti') docs = docs.filter(d => d.status !== 'plačano' && d.datum_zapadlosti).sort((a,b) => a.datum_zapadlosti.localeCompare(b.datum_zapadlosti));
                    else docs = docs.sort((a,b) => (b.datum_izdaje||'').localeCompare(a.datum_izdaje||'')).slice(0, 10);

                    if (docs.length === 0) {
                        html += '<div class="dash-empty"><div class="dash-empty-icon">📥</div>Ni podatkov.</div>';
                    } else {
                        html += `
                        <table class="tbl-dash">
                            <thead><tr><th>Številka</th><th>Upnik</th><th>Zapadlost</th><th>Znesek</th><th>Zamuda</th></tr></thead>
                            <tbody>
                            ${docs.map(d => {
                                const days = daysDiff(d.datum_zapadlosti);
                                const ag = agingLabel(days);
                                return `<tr style="cursor:pointer;" onclick="showUrediDokument(${d.id}, 'prejeti_racuni', 'Prejeti račun')">
                                    <td style="font-weight:600;color:var(--primary-blue);">${d.stevilka}</td>
                                    <td>${d.partner_naziv||'/'}</td>
                                    <td style="${days>0?'color:#c92a2a;font-weight:600;':''}">${d.datum_zapadlosti || '/'}</td>
                                    <td style="font-weight:700;color:#e03131;">${formatMoneyJS(d.znesek_skupaj)}</td>
                                    <td><span class="aging-badge" style="background:${ag.color}">${ag.label}${days>0?' ('+days+' dni)':''}</span></td>
                                </tr>`;
                            }).join('')}
                            </tbody>
                        </table>`;
                    }
                } else if (block.content === 'zadnji_dokumenti') {
                    const izd = (await getCached('/api/dokumenti/izdani_racuni')).filter(d => d.poslovno_leto === leto);
                    const prej = (await getCached('/api/dokumenti/prejeti_racuni')).filter(d => d.poslovno_leto === leto);
                    const vsi = [...izd, ...prej].sort((a,b) => (b.datum_izdaje||'').localeCompare(a.datum_izdaje||'')).slice(0, 10);
                    if (vsi.length === 0) {
                        html += '<div class="dash-empty"><div class="dash-empty-icon">📋</div>Ni dokumentov.</div>';
                    } else {
                        html += `
                        <table class="tbl-dash">
                            <thead><tr><th>Tip</th><th>Številka</th><th>Partner</th><th>Datum</th><th>Znesek</th></tr></thead>
                            <tbody>
                            ${vsi.map(d => `
                                <tr style="cursor:pointer;" onclick="showUrediDokument(${d.id}, '${d.tip}', '${d.tip === 'izdani_racuni' ? 'Izdani račun' : 'Prejeti račun'}')">
                                    <td style="font-size:0.8em; color:#868e96; font-weight:700;">${d.tip.replace('_', ' ').toUpperCase()}</td>
                                    <td style="font-weight:600; color:var(--primary-blue);">${d.stevilka}</td>
                                    <td>${d.partner_naziv||'/'}</td>
                                    <td>${d.datum_izdaje}</td>
                                    <td style="font-weight:700;">${formatMoneyJS(d.znesek_skupaj)}</td>
                                </tr>`).join('')}
                            </tbody>
                        </table>`;
                    }
                } else if (block.content === 'partnerji') {
                    const parts = (await getCached('/api/partnerji')).slice(0, 10);
                    html += `
                    <table class="tbl-dash">
                        <thead><tr><th>Naziv</th><th>Kraj</th><th>Davčna</th></tr></thead>
                        <tbody>
                        ${parts.map(p => `
                            <tr style="cursor:pointer;" onclick="showUrediPartnerja(${p.id})">
                                <td style="font-weight:600;">${p.naziv}</td>
                                <td>${p.kraj || '/'}</td>
                                <td>${p.davcna_stevilka || '/'}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>`;
                } else if (block.content === 'artikli') {
                    const arts = (await getCached('/api/artikli_storitve')).slice(0, 10);
                    html += `
                    <table class="tbl-dash">
                        <thead><tr><th>Šifra</th><th>Naziv</th><th>Cena</th></tr></thead>
                        <tbody>
                        ${arts.map(a => `
                            <tr style="cursor:pointer;" onclick="showUrediArtikel(${a.id})">
                                <td style="font-weight:700; color:#868e96;">${a.sifra}</td>
                                <td style="font-weight:600;">${a.naziv}</td>
                                <td style="font-weight:700;">${formatMoneyJS(a.cena_malo)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>`;
                } else if (block.content === 'izpiski') {
                    const izp = (await getCached('/api/izpiski')).slice(0, 10);
                    html += `
                    <table class="tbl-dash">
                        <thead><tr><th>Datum</th><th>Številka</th><th>Krajno stanje</th></tr></thead>
                        <tbody>
                        ${izp.map(i => `
                            <tr style="cursor:pointer;" onclick="showUrediIzpisek(${i.id})">
                                <td>${i.datum}</td>
                                <td style="font-weight:600;">${i.stevilka_izpiska}</td>
                                <td style="font-weight:700;">${formatMoneyJS(i.koncno_stanje)}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>`;
                }
                
                html += `</div>`;
            } else if (block.type === 'shortcuts') {
                html += `
                <div class="dash-section">
                    <h4>🚀 Hitre povezave</h4>
                    <div class="shortcut-grid">
                        <a href="#" class="shortcut-btn" onclick="showModule('izdani_racuni'); window.showDodajDokument('izdani_racuni', 'Izdani račun')"><span class="shortcut-icon">➕</span>Nov račun</a>
                        <a href="#" class="shortcut-btn" onclick="showModule('partnerji'); window.showDodajPartnerja()"><span class="shortcut-icon">👤</span>Nov partner</a>
                        <a href="#" class="shortcut-btn" onclick="showModule('izpiski'); window.ucloadIzpisekModal()"><span class="shortcut-icon">🏦</span>Uvozi izpisek</a>
                        <a href="#" class="shortcut-btn" onclick="showModule('ponudbe'); window.showDodajDokument('ponudbe', 'Ponudba')"><span class="shortcut-icon">📄</span>Nova ponudba</a>
                    </div>
                </div>
                `;
            }

            html += `</div>`;
        }

        html += `</div>`;
        contentDiv.innerHTML = html;

        // Nariši grafe s canvas API
        if (config.some(b => b.type === 'charts')) {
            const izdani = (await getCached('/api/dokumenti/izdani_racuni')).filter(d => d.poslovno_leto === leto);
            const prejeti = (await getCached('/api/dokumenti/prejeti_racuni')).filter(d => d.poslovno_leto === leto);
            const izdMes = new Array(12).fill(0);
            const preMes = new Array(12).fill(0);
            izdani.forEach(d => { const m = parseInt((d.datum_izdaje||'').split('-')[1])-1; if(m>=0) izdMes[m] += d.znesek_skupaj; });
            prejeti.forEach(d => { const m = parseInt((d.datum_izdaje||'').split('-')[1])-1; if(m>=0) preMes[m] += d.znesek_skupaj; });
            
            function drawBarChart(canvasId, labels, values, color) {
                const canvas = document.getElementById(canvasId);
                if (!canvas) return;
                const ctx = canvas.getContext('2d');
                const H = 200;
                const W = canvas.parentElement.clientWidth - 50;
                canvas.width = W;
                canvas.height = H;
                const pad = { t:10, r:10, b:35, l:60 };
                const maxVal = Math.max(...values, 100);
                const barW = (W - pad.l - pad.r) / labels.length;

                ctx.clearRect(0, 0, W, H);
                ctx.font = '11px Inter, sans-serif';

                for (let i = 0; i <= 4; i++) {
                    const y = pad.t + (H - pad.t - pad.b) * (1 - i/4);
                    ctx.strokeStyle = '#f1f3f5'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
                    const val = Math.round(maxVal * i / 4);
                    ctx.fillStyle = '#adb5bd';
                    const label = val >= 1000 ? (val/1000).toFixed(1)+'k' : val.toString();
                    ctx.fillText(label, pad.l - ctx.measureText(label).width - 10, y + 4);
                }

                values.forEach((val, i) => {
                    const barH = val === 0 ? 0 : Math.max(4, (val / maxVal) * (H - pad.t - pad.b));
                    const x = pad.l + i * barW + barW * 0.15;
                    const y = pad.t + (H - pad.t - pad.b) - barH;
                    const bw = barW * 0.7;

                    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
                    grad.addColorStop(0, color);
                    grad.addColorStop(1, color + '88');
                    ctx.fillStyle = grad;
                    ctx.beginPath();
                    ctx.roundRect(x, y, bw, barH, 4);
                    ctx.fill();

                    ctx.fillStyle = '#868e96';
                    ctx.font = '10px Inter, sans-serif';
                    const lw = ctx.measureText(labels[i]).width;
                    ctx.fillText(labels[i], x + bw/2 - lw/2, H - pad.b + 18);
                });
            }

            const redrawCharts = () => {
                const meseci = ['Jan','Feb','Mar','Apr','Maj','Jun','Jul','Avg','Sep','Okt','Nov','Dec'];
                drawBarChart('canvas-izdani', meseci, izdMes, '#1971c2');
                drawBarChart('canvas-prejeti', meseci, preMes, '#e03131');
            };
            
            setTimeout(redrawCharts, 100);
            if (window._dashResizeObserver) window._dashResizeObserver.disconnect();
            window._dashResizeObserver = new ResizeObserver(() => redrawCharts());
            const chartBlocks = document.querySelectorAll('.dash-charts');
            chartBlocks.forEach(cb => window._dashResizeObserver.observe(cb));
        }

    } catch (e) {
        console.error(e);
        contentDiv.innerHTML = '<div class="dash-empty" style="color:red;">Prišlo je do napake pri nalaganju nadzorne plošče. Prosimo, preverite nastavitve.</div>';
    }
}

// --- PARTNERJI ---
async function renderPartnerji() {

    contentDiv.innerHTML = '<p>Nalagam...</p>';
    try {
        const res = await fetch('/api/partnerji');
        const data = await res.json();
        
        const sortFields = [
            {key: 'naziv', label: 'Naziv'},
            {key: 'kraj', label: 'Kraj'},
            {key: 'davcna_stevilka', label: 'Davčna št.'},
            {key: 'vrsta', label: 'Vrsta'}
        ];

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
                <h2 style="margin:0; color:var(--primary-blue);">Poslovni partnerji</h2>
                <div style="display: flex; gap: 15px; align-items: center;">
                    ${window.renderSortControls('partnerji', sortFields, 'renderPartnerji()')}
                    <button class="btn btn-blue" onclick="showDodajPartnerja()">+ Dodaj partnerja</button>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th width="40"><input type="checkbox" onclick="window.toggleAllSelection(this.checked, 'partnerji')"></th>
                        <th>Naziv</th>
                        <th>Naslov</th>
                        <th>Davčna št.</th>
                        <th>Zavezanec</th>
                        <th>Vrsta</th>
                        <th width="80" style="text-align:right">Akcije</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (data.length === 0) {
            html += `<tr><td colspan="7" style="text-align:center">Ni vnesenih partnerjev</td></tr>`;
        } else {
            let sortirano = window.sortAppData(data, 'partnerji');
            sortirano.forEach(p => {
                const isChecked = window.appSelection.ids.includes(p.id) ? 'checked' : '';
                const polniNaslov = `${p.ulica || ''}, ${p.postna_stevilka || ''} ${p.kraj || ''}, ${p.drzava || ''}`.replace(/^[,\s]+|[,\s]+$/g, '').replace(/,\s*,/g, ',');
                const zavezanecTag = p.zavezanec_za_ddv 
                    ? '<span style="color:#2b8a3e; font-weight:bold;">DA</span>' 
                    : '<span style="color:#e03131;">NE</span>';
                
                html += `
                    <tr>
                        <td><input type="checkbox" class="row-checkbox" data-id="${p.id}" ${isChecked} onclick="window.toggleItemSelection(${p.id}, 'partnerji')"></td>
                        <td style="font-weight:500; cursor:pointer; color:var(--primary-blue); text-decoration:underline;" onclick="showUrediPartnerja(${p.id})">${p.naziv}</td>
                        <td style="font-size:0.9em; color:#666;">${polniNaslov}</td>
                        <td>${p.davcna_stevilka || '/'}</td>
                        <td>${zavezanecTag}</td>
                        <td><span style="background:var(--bg-sidebar); padding:3px 8px; border-radius:10px; font-size:0.8em; text-transform:uppercase;">${p.vrsta}</span></td>
                        <td class="action-buttons">
                            <button class="icon-btn btn-red" onclick="brisiPartnerja(${p.id})" title="Briši">${ICONS.delete}</button>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += `</tbody></table>`;
        contentDiv.innerHTML = html;
    } catch (e) {
        contentDiv.innerHTML = `<p style="color:red">Napaka pri nalaganju.</p>`;
    }
}

async function renderCRM_Dashboard() {
    contentDiv.innerHTML = '<p style="padding:20px;">Nalagam CRM nadzorno ploščo...</p>';
    try {
        const [tasks, interactions, partners] = await Promise.all([
            fetch('/api/crm/tasks').then(r => r.json()),
            fetch('/api/crm/interactions').then(r => r.json()),
            fetch('/api/partnerji').then(r => r.json())
        ]);

        const activeLeads = partners.filter(p => p.status === 'Lead' || p.status === 'Priložnost').length;
        const pendingTasks = tasks.length;
        const recentInteractions = interactions.length;

        contentDiv.innerHTML = `
            <div style="padding: 20px;">
                <h2 style="margin-bottom: 25px; color: var(--primary-blue);">CRM Nadzorna plošča</h2>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px;">
                    <div class="crm-stat-card">
                        <div class="crm-stat-value">${activeLeads}</div>
                        <div class="crm-stat-label">Aktivne priložnosti</div>
                    </div>
                    <div class="crm-stat-card">
                        <div class="crm-stat-value">${pendingTasks}</div>
                        <div class="crm-stat-label">Odprta opravila</div>
                    </div>
                    <div class="crm-stat-card">
                        <div class="crm-stat-value">${recentInteractions}</div>
                        <div class="crm-stat-label">Nedavne interakcije</div>
                    </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                    <div>
                        <h3 style="margin-bottom: 15px;">Aktivnosti (Opravila)</h3>
                        <div style="background: white; border-radius: 12px; border: 1px solid #eee; overflow: hidden;">
                            <table style="margin: 0;">
                                <thead>
                                    <tr><th>Partner</th><th>Naslov</th><th>Rok</th></tr>
                                </thead>
                                <tbody>
                                    ${tasks.slice(0, 5).map(t => `
                                        <tr>
                                            <td>${t.partner_naziv}</td>
                                            <td>${t.naslov}</td>
                                            <td>${formatDateJS(t.rok)}</td>
                                        </tr>
                                    `).join('') || '<tr><td colspan="3" style="text-align:center">Ni odprtih opravil</td></tr>'}
                                </tbody>
                            </table>
                            <div style="padding: 10px; text-align: center; border-top: 1px solid #eee;">
                                <a href="#" onclick="showModule('crm_aktivnosti')" style="font-size: 0.9em; font-weight: 600;">Vsa opravila →</a>
                            </div>
                        </div>
                    </div>
                    <div>
                        <h3 style="margin-bottom: 15px;">Nedavne interakcije</h3>
                        <div style="background: white; border-radius: 12px; border: 1px solid #eee; overflow: hidden;">
                            <table style="margin: 0;">
                                <thead>
                                    <tr><th>Partner</th><th>Tip</th><th>Datum</th></tr>
                                </thead>
                                <tbody>
                                    ${interactions.slice(0, 5).map(i => `
                                        <tr>
                                            <td>${i.partner_naziv}</td>
                                            <td>${i.tip}</td>
                                            <td>${formatDateJS(i.datum)}</td>
                                        </tr>
                                    `).join('') || '<tr><td colspan="3" style="text-align:center">Ni nedavnih interakcij</td></tr>'}
                                </tbody>
                            </table>
                            <div style="padding: 10px; text-align: center; border-top: 1px solid #eee;">
                                <a href="#" onclick="showModule('crm_interakcije')" style="font-size: 0.9em; font-weight: 600;">Vse interakcije →</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    } catch (e) {
        contentDiv.innerHTML = `<p style="color:red; padding: 20px;">Napaka pri nalaganju CRM nadzorne plošče: ${e.message}</p>`;
    }
}

async function renderCRM_Kanal() {
    contentDiv.innerHTML = '<p style="padding:20px;">Nalagam prodajni kanal...</p>';
    try {
        const res = await fetch('/api/partnerji');
        const data = await res.json();
        
        const stages = [
            { id: 'Lead', label: 'Potencialna stranka' },
            { id: 'Priložnost', label: 'Priložnost' },
            { id: 'Pogajanja', label: 'Pogajanja' },
            { id: 'Stranka', label: 'Stranka' }
        ];

        let html = `
            <div style="padding: 20px; height: 100%; display: flex; flex-direction: column;">
                <h2 style="margin-bottom: 20px; color: var(--primary-blue);">Prodajni kanal (Pipeline)</h2>
                <div class="crm-pipeline-container" style="flex: 1;">
                    ${stages.map(stage => {
                        const partnersInStage = data.filter(p => p.status === stage.id);
                        return `
                            <div class="crm-pipeline-column">
                                <div class="crm-pipeline-header">
                                    <span>${stage.label}</span>
                                    <span style="background: #e9ecef; padding: 2px 8px; border-radius: 10px; font-size: 0.8em;">${partnersInStage.length}</span>
                                </div>
                                ${partnersInStage.map(p => `
                                    <div class="crm-card" onclick="showUrediPartnerja(${p.id})">
                                        <div class="crm-card-title">${p.naziv}</div>
                                        <div class="crm-card-info">${p.kraj || 'Neznan kraj'}</div>
                                        ${p.email ? `<div class="crm-card-info" style="margin-top:5px; font-size: 0.8em;">📧 ${p.email}</div>` : ''}
                                    </div>
                                `).join('')}
                                ${partnersInStage.length === 0 ? '<div style="color: #adb5bd; font-size: 0.85em; text-align: center; margin-top: 10px; border: 1px dashed #ced4da; padding: 10px; border-radius: 8px;">Prazno</div>' : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        contentDiv.innerHTML = html;
    } catch (e) {
        contentDiv.innerHTML = `<p style="color:red; padding: 20px;">Napaka: ${e.message}</p>`;
    }
}

async function renderCRM_Aktivnosti() {
    contentDiv.innerHTML = '<p style="padding:20px;">Nalagam aktivnosti...</p>';
    try {
        const tasks = await fetch('/api/crm/tasks').then(r => r.json());
        
        let html = `
            <div style="padding: 20px;">
                <h2 style="margin-bottom: 20px; color: var(--primary-blue);">Aktivnosti (Opravila)</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Partner</th>
                            <th>Naslov</th>
                            <th>Opis</th>
                            <th>Rok</th>
                            <th>Status</th>
                            <th>Prioriteta</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tasks.map(t => `
                            <tr>
                                <td style="font-weight: 500; color: var(--primary-blue); cursor: pointer; text-decoration: underline;" onclick="showUrediPartnerja(${t.partner_id})">${t.partner_naziv}</td>
                                <td>${t.naslov}</td>
                                <td style="font-size: 0.9em; color: #666;">${t.opis || '/'}</td>
                                <td>${formatDateJS(t.rok)}</td>
                                <td><span style="background: #e9ecef; padding: 3px 8px; border-radius: 10px; font-size: 0.8em;">${t.status}</span></td>
                                <td><span style="color: ${t.prioriteta === 'Visoka' ? 'red' : (t.prioriteta === 'Srednja' ? 'orange' : 'green')}; font-weight: 600;">${t.prioriteta}</span></td>
                            </tr>
                        `).join('') || '<tr><td colspan="6" style="text-align:center">Ni odprtih opravil</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
        contentDiv.innerHTML = html;
    } catch (e) {
        contentDiv.innerHTML = `<p style="color:red; padding: 20px;">Napaka: ${e.message}</p>`;
    }
}

async function renderCRM_Interakcije() {
    contentDiv.innerHTML = '<p style="padding:20px;">Nalagam interakcije...</p>';
    try {
        const interactions = await fetch('/api/crm/interactions').then(r => r.json());
        
        let html = `
            <div style="padding: 20px;">
                <h2 style="margin-bottom: 20px; color: var(--primary-blue);">Zgodovina interakcij</h2>
                <table>
                    <thead>
                        <tr>
                            <th>Partner</th>
                            <th>Datum</th>
                            <th>Tip</th>
                            <th>Vsebina</th>
                            <th>Naslednji korak</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${interactions.map(i => `
                            <tr>
                                <td style="font-weight: 500; color: var(--primary-blue); cursor: pointer; text-decoration: underline;" onclick="showUrediPartnerja(${i.partner_id})">${i.partner_naziv}</td>
                                <td>${formatDateJS(i.datum)}</td>
                                <td><span style="background: #e7f5ff; color: #1971c2; padding: 3px 8px; border-radius: 10px; font-size: 0.8em; font-weight: 600;">${i.tip}</span></td>
                                <td style="font-size: 0.9em;">${i.vsebina || '/'}</td>
                                <td style="font-size: 0.9em; color: #2b8a3e; font-weight: 500;">${i.naslednji_korak || '/'}</td>
                            </tr>
                        `).join('') || '<tr><td colspan="5" style="text-align:center">Ni zabeleženih interakcij</td></tr>'}
                    </tbody>
                </table>
            </div>
        `;
        contentDiv.innerHTML = html;
    } catch (e) {
        contentDiv.innerHTML = `<p style="color:red; padding: 20px;">Napaka: ${e.message}</p>`;
    }
}


function showDodajPartnerja() {
    renderPartnerForm();
}

async function showUrediPartnerja(id) {
    try {
        const res = await fetch(`/api/partnerji/detajl/${id}`);
        const data = await res.json();
        renderPartnerForm(data);
    } catch (e) {
        alert("Napaka pri pridobivanju podatkov.");
    }
}

function renderPartnerForm(editData = null) {
    const isEdit = !!editData;
    const title = isEdit ? 'Uredi partnerja' : 'Nov partner';
    
    const innerHtml = `
            ${isEdit ? '' : `
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px; border: 1px solid #dee2e6;">
                <label style="font-weight: bold; display: block; margin-bottom: 8px; color: var(--primary-red);">Iskanje po Bizi.si</label>
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <input type="text" id="bizi_search_q" placeholder="Vpišite ime podjetja ali davčno številko..." style="flex: 1;">
                    <button class="btn btn-blue" onclick="window.iskanjeBizi()">Išči na Bizi.si</button>
                </div>
                <div id="bizi_results" style="max-height: 250px; overflow-y: auto;"></div>
            </div>
            `}

            <form onsubmit="shraniPartnerja(event, ${isEdit ? editData.id : 'null'})">
                <div class="form-group">
                    <label>Polni naziv podjetja</label>
                    <input type="text" id="p_naziv" value="${editData?.naziv || ''}" required>
                </div>
                <div style="display: flex; gap: 15px;">
                    <div class="form-group" style="flex:2">
                        <label>Ulica in hišna št.</label>
                        <input type="text" id="p_ulica" value="${editData?.ulica || ''}">
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Poštna številka</label>
                        <input type="text" id="p_posta" value="${editData?.postna_stevilka || ''}">
                    </div>
                </div>
                <div style="display: flex; gap: 15px;">
                    <div class="form-group" style="flex:1">
                        <label>Kraj</label>
                        <input type="text" id="p_kraj" value="${editData?.kraj || ''}">
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Država</label>
                        <input type="text" id="p_drzava" value="${editData?.drzava || 'Slovenija'}">
                    </div>
                </div>
                
                <div style="display: flex; gap: 15px;">
                    <div class="form-group" style="flex:1">
                        <label>E-naslov</label>
                        <input type="email" id="p_email" value="${editData?.email || ''}">
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Telefon</label>
                        <input type="text" id="p_telefon" value="${editData?.telefon || ''}">
                    </div>
                </div>

                <div style="display: flex; gap: 15px;">
                    <div class="form-group" style="flex:1">
                        <label>Davčna številka</label>
                        <input type="text" id="p_davcna" value="${editData?.davcna_stevilka || ''}">
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>TRR (IBAN)</label>
                        <input type="text" id="p_trr" value="${editData?.trr || ''}">
                    </div>
                </div>
                
                <div class="form-group" style="flex-direction: row; align-items: center; gap: 10px; display: flex;">
                    <input type="checkbox" id="p_zavezanec" ${editData?.zavezanec_za_ddv ? 'checked' : ''} style="width: auto; margin:0;">
                    <label for="p_zavezanec" style="margin:0;">Ali je partner davčni zavezanec?</label>
                </div>

                <div class="form-group">
                    <label>Vrsta (Kupec / Dobavitelj)</label>
                    <select id="p_vrsta">
                        <option value="oba" ${editData?.vrsta === 'oba' ? 'selected' : ''}>Oba</option>
                        <option value="kupec" ${editData?.vrsta === 'kupec' ? 'selected' : ''}>Kupec</option>
                        <option value="dobavitelj" ${editData?.vrsta === 'dobavitelj' ? 'selected' : ''}>Dobavitelj</option>
                    </select>
                </div>
                <div style="margin-top: 25px; padding-top:15px; border-top: 1px solid var(--border-color);">
                    <button type="submit" class="btn btn-blue">${isEdit ? 'Shrani spremembe' : 'Shrani partnerja'}</button>
                    <button type="button" class="btn" onclick="window.zapriGlavniPopup()" style="color: var(--text-main); background: #eee; margin-left: 10px;">Prekliči</button>
                </div>
            </form>
    `;

    window.odpriGlavniPopup(title, innerHtml);
    window.initDatePickers();
    // Iskanje na Enter
    const bq = document.getElementById('bizi_search_q');
    if(bq) bq.onkeydown = e => { if(e.key==='Enter'){ e.preventDefault(); window.iskanjeBizi(); } };
}

window.iskanjeBizi = async function() {
    const q = document.getElementById('bizi_search_q').value;
    if (!q) return;
    
    const resultsDiv = document.getElementById('bizi_results');
    resultsDiv.innerHTML = '<p style="padding:10px; font-size:0.9em;">Iščem...</p>';
    
    try {
        const res = await fetch(`/api/partnerji/search_bizi?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        
        if (data.length === 0) {
            resultsDiv.innerHTML = '<p style="padding:10px; color:red; font-size:0.9em;">Ni rezultatov.</p>';
            return;
        }
        
        let html = '<table style="font-size:0.85em; margin-top:0;">';
        data.forEach((p, idx) => {
            html += `
                <tr>
                    <td><strong>${p.naziv}</strong><br><small>${p.naslov}, ${p.posta_kraj}</small></td>
                    <td>${p.davcna_stevilka}</td>
                    <td style="text-align:right">
                        <button class="btn btn-blue" style="padding:3px 8px; font-size:0.9em;" onclick='window.uvoziBiziPartnerja(${JSON.stringify(p).replace(/'/g, "&apos;")})'>Uvozi</button>
                    </td>
                </tr>
            `;
        });
        html += '</table>';
        resultsDiv.innerHTML = html;
        
    } catch (e) {
        resultsDiv.innerHTML = '<p style="padding:10px; color:red; font-size:0.9em;">Napaka pri iskanju.</p>';
    }
};

window.uvoziBiziPartnerja = async function(p) {
    document.getElementById('p_naziv').value = p.naziv;
    document.getElementById('p_ulica').value = p.naslov;
    
    // Split post/city: "1000 Ljubljana"
    if (p.posta_kraj) {
        const parts = p.posta_kraj.split(' ');
        if (parts.length >= 2) {
            document.getElementById('p_posta').value = parts[0];
            document.getElementById('p_kraj').value = parts.slice(1).join(' ');
        } else {
            document.getElementById('p_kraj').value = p.posta_kraj;
        }
    }
    
    document.getElementById('p_davcna').value = p.davcna_stevilka;
    document.getElementById('p_zavezanec').checked = !!p.zavezanec_za_ddv;
    
    // Fetch detail for Phone, Email, Tax status
    if (p.link) {
        document.getElementById('bizi_results').innerHTML = '<p style="padding:10px; font-size:0.9em; color:var(--primary-blue);">Pridobivam dodatne podatke (telefon, email, davčni status)...</p>';
        try {
            const res = await fetch(`/api/partnerji/bizi_detail?url=${encodeURIComponent(p.link)}`);
            const detail = await res.json();
            if (detail.telefon) document.getElementById('p_telefon').value = detail.telefon;
            if (detail.email) document.getElementById('p_email').value = detail.email;
            if (detail.zavezanec_za_ddv !== undefined) {
                document.getElementById('p_zavezanec').checked = detail.zavezanec_za_ddv;
            }
            if (detail.trr) {
                document.getElementById('p_trr').value = detail.trr;
            }
        } catch (e) {
            console.error("Napaka pri bizi_detail", e);
        }
    }
    
    document.getElementById('bizi_results').innerHTML = '<p style="padding:10px; color:green; font-weight:bold; font-size:0.9em;">Podatki uvoženi!</p>';
};

async function shraniPartnerja(e, id = null) {
    e.preventDefault();
    const payload = {
        naziv: document.getElementById('p_naziv').value,
        ulica: document.getElementById('p_ulica').value,
        postna_stevilka: document.getElementById('p_posta').value,
        kraj: document.getElementById('p_kraj').value,
        drzava: document.getElementById('p_drzava').value,
        davcna_stevilka: document.getElementById('p_davcna').value,
        zavezanec_za_ddv: document.getElementById('p_zavezanec').checked,
        trr: document.getElementById('p_trr').value,
        telefon: document.getElementById('p_telefon').value,
        email: document.getElementById('p_email').value,
        vrsta: document.getElementById('p_vrsta').value
    };
    
    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/partnerji/${id}` : '/api/partnerji';
        
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            window.zapriGlavniPopup();
        } else {
            alert("Napaka pri shranjevanju partnerja: " + res.statusText);
        }
    } catch (e) {
        alert("Napaka pri shranjevanju.");
    }
}

async function brisiPartnerja(id) {
    if (!confirm("Ali ste prepričani, da želite izbrisati tega partnerja?")) return;
    try {
        const res = await fetch(`/api/partnerji/${id}`, { method: 'DELETE' });
        if (res.ok) {
            renderPartnerji();
        } else {
            const err = await res.json();
            alert("Napaka pri brisanju: " + (err.detail || res.statusText));
        }
    } catch (e) {
        alert("Napaka pri komunikaciji s strežnikom.");
    }
}

// --- ARTIKLI IN STORITVE ---
window.updateKontiDatalist = async function() {
    const dl = document.getElementById('konti-datalist');
    if (!dl) return;
    try {
        const res = await fetch('/api/konti');
        const konti = await res.json();
        dl.innerHTML = konti.map(k => `<option value="${k.stevilka}">${k.stevilka} - ${k.naziv}</option>`).join('');
    } catch (e) { console.error("Napaka pri posodabljanju kontov", e); }
};

async function renderArtikliStoritve() {
    window.updateKontiDatalist();
    console.log("Kličem renderArtikliStoritve...");
    contentDiv.innerHTML = '<p style="padding:20px;">Nalagam artikle in storitve...</p>';
    try {
        const res = await fetch('/api/artikli_storitve');
        if (!res.ok) throw new Error("Napaka pri pridobivanju podatkov s strežnika.");
        const data = await res.json();
        
        const sortFields = [
            {key: 'naziv', label: 'Naziv'},
            {key: 'sifra', label: 'Šifra'},
            {key: 'vrsta', label: 'Vrsta'},
            {key: 'cena_malo', label: 'Cena MP'}
        ];

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
                <h2 style="margin:0; color:var(--primary-blue);">Artikli in storitve</h2>
                <div style="display: flex; gap: 15px; align-items: center;">
                    ${window.renderSortControls('artikli_storitve', sortFields, 'renderArtikliStoritve()')}
                    <button class="btn btn-blue" onclick="showDodajArtikelStoritev()">+ Dodaj artikel/storitev</button>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th width="40"><input type="checkbox" onclick="window.toggleAllSelection(this.checked, 'artikli_storitve')"></th>
                        <th>Šifra</th>
                        <th>Vrsta</th>
                        <th>Naziv</th>
                        <th style="text-align:right">Cena (MP)</th>
                        <th style="text-align:right">Cena (VP)</th>
                        <th>DDV</th>
                        <th style="text-align:right">Zaloga</th>
                        <th width="80" style="text-align:right">Akcije</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (data.length === 0) {
            html += `<tr><td colspan="9" style="text-align:center; padding:20px;">Ni vnesenih artiklov ali storitev. Kliknite gumb zgoraj za dodajanje.</td></tr>`;
        } else {
            let sortirano = window.sortAppData(data, 'artikli_storitve');
            sortirano.forEach(a => {
                const isChecked = window.appSelection.ids.includes(a.id) ? 'checked' : '';
                const zalogaText = a.vodi_zalogo ? `<span style="font-weight:bold; color:${a.zaloga_kolicina > 0 ? '#2b8a3e' : '#e03131'}">${formatNumberJS(a.zaloga_kolicina || 0)} ${a.enota_mere}</span>` : '<span style="color:#adb5bd;">/</span>';
                html += `
                    <tr>
                        <td><input type="checkbox" class="row-checkbox" data-id="${a.id}" ${isChecked} onclick="window.toggleItemSelection(${a.id}, 'artikli_storitve')"></td>
                        <td><code style="background:#eee; padding:2px 5px; border-radius:3px; font-weight:bold;">${a.sifra}</code></td>
                        <td><span style="font-size:0.85em; text-transform:uppercase; color:#666;">${a.vrsta === 'artikel' ? '📦 Artikel' : '🛠 Storitev'}</span></td>
                        <td style="font-weight:600; cursor:pointer; color:var(--primary-blue); text-decoration:underline;" onclick="showUrediArtikelStoritev(${a.id})">${a.naziv}</td>
                        <td style="text-align:right; font-weight:600;">${formatNumberJS(a.cena_malo)} €</td>
                        <td style="text-align:right">${formatNumberJS(a.cena_velo)} €</td>
                        <td>${a.stopnja_ddv}%</td>
                        <td style="text-align:right">${zalogaText}</td>
                        <td class="action-buttons">
                            <button class="icon-btn btn-red" onclick="brisiArtikelStoritev(${a.id})" title="Briši">${ICONS.delete}</button>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += `</tbody></table>`;
        contentDiv.innerHTML = html;
    } catch (e) {
        console.error(e);
        contentDiv.innerHTML = `<div style="padding:20px; background:#fff5f5; border:1px solid #ffc9c9; border-radius:8px; color:#c92a2a;">
            <strong>Napaka pri nalaganju modula:</strong><br>${e.message}
        </div>`;
    }
}

function showDodajArtikelStoritev() {
    renderArtikliForm();
}

async function showUrediArtikelStoritev(id) {
    try {
        const res = await fetch(`/api/artikli_storitve/${id}`);
        const data = await res.json();
        renderArtikliForm(data);
    } catch (e) {
        alert("Napaka pri pridobivanju podatkov.");
    }
}

async function renderArtikliForm(editData = null) {
    const isEdit = !!editData && !!editData.id;
    const title = isEdit ? 'Uredi artikel/storitev' : 'Nov artikel/storitev';
    
    // Pridobimo nastavitve podjetja, da vemo če je zavezanec
    let settings = window.appSettings;
    if (!settings) {
        try {
            const res = await fetch('/api/nastavitve');
            settings = await res.json();
            window.appSettings = settings;
        } catch(e) { settings = { zavezanec_za_ddv: true }; }
    }
    const isZavezanec = settings.zavezanec_za_ddv;

    const innerHtml = `
            <form onsubmit="shraniArtikelStoritev(event, ${isEdit ? editData.id : 'null'})">
                <div style="display: flex; gap: 15px;">
                    <div class="form-group" style="flex:1">
                        <label>Vrsta</label>
                        <select id="a_vrsta" required onchange="document.getElementById('a_zaloga_box').style.display = (this.value==='artikel'?'block':'none')">
                            <option value="storitev" ${editData?.vrsta === 'storitev' ? 'selected' : ''}>Storitev</option>
                            <option value="artikel" ${editData?.vrsta === 'artikel' ? 'selected' : ''}>Artikel</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Šifra <small>(pusti prazno za avtomatsko)</small></label>
                        <input type="text" id="a_sifra" value="${editData?.sifra || ''}" placeholder="A001 / S001">
                    </div>
                </div>

                <div class="form-group">
                    <label>Naziv</label>
                    <input type="text" id="a_naziv" value="${editData?.naziv || ''}" required>
                </div>

                <div class="form-group">
                    <label>Opis / Podrobnosti</label>
                    <textarea id="a_opis" rows="3" style="width:100%; padding:10px; border:1px solid #ced4da; border-radius:4px; font-family:inherit;">${editData?.opis || ''}</textarea>
                </div>

                <div style="display: flex; gap: 15px;">
                    <div class="form-group" style="flex:1">
                        <label>Enota mere</label>
                        <select id="a_em">
                            ${['kos','kg','l','m','m2','m3','ura','dan','kpl','paušal'].map(em => `<option value="${em}" ${editData?.enota_mere === em || (!editData && em === 'kos') ? 'selected' : ''}>${em}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Stopnja DDV (%)</label>
                        <select id="a_ddv" ${!isZavezanec ? 'disabled style="background:#f1f3f5"' : ''}>
                            ${isZavezanec ? `
                                <option value="22" ${editData?.stopnja_ddv === 22 || (!editData) ? 'selected' : ''}>22% (Splošna)</option>
                                <option value="9.5" ${editData?.stopnja_ddv === 9.5 ? 'selected' : ''}>9.5% (Znižana)</option>
                                <option value="5" ${editData?.stopnja_ddv === 5 ? 'selected' : ''}>5% (Posebna)</option>
                                <option value="0" ${editData?.stopnja_ddv === 0 ? 'selected' : ''}>0% (Brez / Izvoz)</option>
                            ` : `
                                <option value="0" selected>0% (Niste zavezanec)</option>
                            `}
                        </select>
                    </div>
                </div>

                <div style="display: flex; gap: 15px;">
                    <div class="form-group" style="flex:1">
                        <label>Maloprodajna cena (MP)</label>
                        <input type="text" id="a_cena_malo" value="${editData ? formatNumberJS(editData.cena_malo) : '0,00'}">
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Veleprodajna cena (VP)</label>
                        <input type="text" id="a_cena_velo" value="${editData ? formatNumberJS(editData.cena_velo) : '0,00'}">
                    </div>
                </div>

                <div class="form-group">
                    <label>Konto za knjiženje <small>(neobvezno)</small></label>
                    <input type="text" id="a_konto" list="konti-datalist" value="${editData?.konto || ''}" placeholder="npr. 7600">
                </div>

                <div id="a_zaloga_box" style="display: ${editData?.vrsta === 'artikel' ? 'block' : 'none'}; margin-top: 15px; background: #fff9db; padding: 15px; border-radius: 6px; border: 1px solid #fab005;">
                    <h4 style="margin: 0 0 10px 0; color: #495057;">Sledenje zalogi</h4>
                    <div class="form-group" style="flex-direction: row; align-items: center; gap: 10px; display: flex; margin-bottom: 0;">
                        <input type="checkbox" id="a_vodi_zalogo" ${editData?.vodi_zalogo ? 'checked' : ''} style="width: auto; margin:0;">
                        <label for="a_vodi_zalogo" style="margin:0;">Vklopi sledenje zalogi za ta artikel</label>
                    </div>
                    ${!isEdit ? `
                    <div style="margin-top:10px; margin-left:26px; display:flex; align-items:center; gap:10px;">
                        <label style="font-size:0.9rem;">Začetna zaloga:</label>
                        <input type="text" id="a_zacetna_zaloga" value="${editData?.zacetna_zaloga ? formatNumberJS(editData.zacetna_zaloga) : '0,00'}" style="width:100px; padding:4px; border:1px solid #ced4da; border-radius:4px; text-align:right;">
                    </div>
                    ` : ''}
                    <p style="font-size:0.8rem; color:#666; margin-top:5px; margin-left:26px;">Če je vklopljeno, bo program spremljal količino na zalogi in jo zmanjševal ob prodaji oz. povečeval ob nakupu.</p>
                </div>

                <div style="margin-top: 25px; display: flex; gap: 10px; justify-content: flex-end;">
                    <button type="button" class="btn" style="background:#eee; color:#333;" onclick="${isPopup ? 'window.zapriArtikelFormPopup()' : 'renderArtikliStoritve()'}">Prekliči</button>
                    <button type="submit" class="btn btn-blue">${isEdit ? 'Shrani spremembe' : 'Dodaj artikel/storitev'}</button>
                </div>
            </form>
        </div>
    `;
}

async function shraniArtikelStoritev(event, id = null) {
    event.preventDefault();
    const payload = {
        vrsta: document.getElementById('a_vrsta').value,
        sifra: document.getElementById('a_sifra').value.trim() || null,
        naziv: document.getElementById('a_naziv').value,
        opis: document.getElementById('a_opis').value,
        enota_mere: document.getElementById('a_em').value,
        cena_malo: parseNumberJS(document.getElementById('a_cena_malo').value),
        cena_velo: parseNumberJS(document.getElementById('a_cena_velo').value),
        stopnja_ddv: parseFloat(document.getElementById('a_ddv').value),
        konto: document.getElementById('a_konto').value,
        vodi_zalogo: document.getElementById('a_vodi_zalogo')?.checked || false,
        zacetna_zaloga: parseNumberJS(document.getElementById('a_zacetna_zaloga')?.value || '0'),
        aktiven: true
    };

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/artikli_storitve/${id}` : '/api/artikli_storitve';
        const res = await fetch(url, {
            method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            const inPopup = document.getElementById('artikel-form-popup-overlay').style.display === 'flex';
            if (inPopup) {
                window.zapriArtikelFormPopup();
                const resData = await res.json();
                if (resData.id && window._zadnjiPostavkaDiv) {
                    const idInp = window._zadnjiPostavkaDiv.querySelector('.p-artikel-id');
                    if (idInp) idInp.value = resData.id;
                }
                // Ponovno odpremo izbirnik artiklov in osvežimo seznam
                document.getElementById('artikel-popup-overlay').style.display = 'flex';
                window.filterArtikelPopup(); 
            } else {
                window.zapriGlavniPopup();
            }
        } else {
            const err = await res.json();
            alert("Napaka pri shranjevanju: " + (err.detail || "Neznano"));
        }
    } catch (e) {
        alert("Sistemska napaka pri komunikaciji.");
    }
}

async function brisiArtikelStoritev(id) {
    if (!confirm("Ali ste prepričani, da želite izbrisati ta artikel/storitev?")) return;
    try {
        const res = await fetch(`/api/artikli_storitve/${id}`, { method: 'DELETE' });
        if (res.ok) renderArtikliStoritve();
    } catch (e) {
        alert("Napaka pri brisanju.");
    }
}

// --- DOKUMENTI ---
async function renderDokumenti(tip, naslov) {
    titleEl.textContent = naslov;
    contentDiv.innerHTML = '<p>Nalagam...</p>';
    try {
        const res = await fetch(`/api/dokumenti/${tip}`);
        const data = await res.json();
        
        const sortFields = [
            {key: 'datum_izdaje', label: 'Datum izdaje'},
            {key: 'stevilka', label: 'Številka'},
            {key: 'interna_stevilka', label: 'Zaporedna št.'},
            {key: 'partner_naziv', label: 'Partner'},
            {key: 'znesek_skupaj', label: 'Znesek'},
            {key: 'status', label: 'Status'}
        ];

        let html = `
            <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                <div style="display: flex; gap: 10px; align-items: center;">
                    <button class="btn btn-blue" onclick="showDodajDokument('${tip}', '${naslov}')">+ Nov dokument</button>
                    ${tip === 'prejeti_racuni' || tip === 'prejete_ponudbe' || tip === 'prejeti_dobropisi' ? `
                        <button class="btn" style="background:#495057; color:white; border:none;" onclick="document.getElementById('eslog-upload').click()">Uvozi</button>
                        <input type="file" id="eslog-upload" accept=".xml,.zip,.png,.pdf" style="display:none" multiple onchange="window.uvoziEslog(this, '${tip}', '${naslov}')">
                    ` : ''}
                </div>
                ${window.renderSortControls(tip, sortFields, `renderDokumenti('${tip}', '${naslov}')`)}
            </div>
            <table>
                <thead>
                    <tr>
                        <th width="40"><input type="checkbox" onclick="window.toggleAllSelection(this.checked, '${tip}')"></th>
                        <th width="100">#</th>
                        <th>Številka</th>
                        <th>Partner</th>
                        <th>Datum izdaje</th>
                        <th>Znesek</th>
                        <th>Plačano</th>
                        <th>Status</th>
                        <th width="80" style="text-align:right">Akcije</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        let leto = getLeto();
        let filtrirano = data.filter(d => d.poslovno_leto === leto);
        let sortirano = window.sortAppData(filtrirano, tip);
        
        if (sortirano.length === 0) {
            html += `<tr><td colspan="7" style="text-align:center">Ni dokumentov v letu ${leto}</td></tr>`;
        } else {
            const todayStr = new Date().toLocaleDateString('sv').substring(0, 10);
            sortirano.forEach(d => {
                const isChecked = window.appSelection.ids.includes(d.id) ? 'checked' : '';
                const isOverdue = (tip === 'izdani_racuni' || tip === 'prejeti_racuni') && 
                                  d.datum_zapadlosti && 
                                  d.datum_zapadlosti <= todayStr && 
                                  d.status !== 'plačano';
                const rowClass = isOverdue ? 'class="row-overdue"' : '';
                html += `
                    <tr ${rowClass}>
                        <td><input type="checkbox" class="row-checkbox" data-id="${d.id}" ${isChecked} onclick="window.toggleItemSelection(${d.id}, '${tip}')"></td>
                        <td style="white-space: nowrap;">
                            <span style="color:var(--primary-blue); font-weight:bold; cursor:pointer; text-decoration:underline;" onclick="showUrediDokument(${d.id}, '${tip}', '${naslov}')">${d.interna_stevilka || d.stevilka}</span>
                        </td>
                        <td style="white-space: nowrap;">
                            ${d.stevilka}
                            ${d.ima_prilogo ? '<span title="Dokument ima priponko" style="margin-left:5px; font-size:1.1em; cursor:help;">📎</span>' : ''}
                            ${d.zadnje_poslano ? '<span title="Dokument je bil poslan po e-pošti" style="margin-left:5px; font-size:1.1em; cursor:help;">✉</span>' : ''}
                        </td>
                        <td style="font-weight: 500;">${d.partner_naziv || 'Neznan'}</td>
                        <td>${formatDateJS(d.datum_izdaje)}</td>
                        <td style="font-weight: bold;">
                            ${d.valuta && d.valuta !== 'EUR' ? `<div style="font-size:0.75em; color:#666; font-weight:normal;">${formatNumberJS(d.znesek_v_valuti)} ${d.valuta}</div>` : ''}
                            ${formatNumberJS(d.znesek_skupaj)} &euro;
                        </td>
                        <td style="color:#2b8a3e;">${formatNumberJS(d.placano_znesek || 0)} &euro;</td>
                        <td>
                            <span style="background:${d.status === 'plačano' ? '#d3f9d8' : (d.status === 'delno plačano' ? '#fff3bf' : '#f1f3f5')}; 
                                         color:${d.status === 'plačano' ? '#2b8a3e' : (d.status === 'delno plačano' ? '#f08c00' : '#495057')}; 
                                         padding:3px 8px; border-radius:10px; font-size:0.8em; text-transform:uppercase; font-weight:bold;">
                                ${d.status || 'neplačano'}
                            </span>
                            ${d.knjizeno ? '<span style="background:#e3fafc; color:#1098ad; padding:3px 8px; border-radius:10px; font-size:0.8em; text-transform:uppercase; font-weight:bold; margin-left:5px;" title="Dokument je bil knjižen v glavno knjigo">Knjiženo</span>' : ''}
                        </td>
                        <td class="action-buttons">
                            ${(tip === 'izdani_racuni' || tip === 'prejeti_racuni') ? 
                                (!d.knjizeno ? 
                                    `<button class="icon-btn btn-green" onclick="window.knjiziPosamezen(${d.id}, 'knjizi', '${tip}')" title="Knjiži">${ICONS.book}</button>` : 
                                    `<button class="icon-btn btn-orange" onclick="window.knjiziPosamezen(${d.id}, 'razknjizi', '${tip}')" title="Razknjiži">${ICONS.unbook}</button>`
                                ) : ''}
                            ${tip === 'ponudbe' ? `<button class="icon-btn btn-green" onclick="window.ustvariRacunIzPonudbe(${d.id})" title="Ustvari račun">${ICONS.invoice}</button>` : ''}
                            ${tip === 'prejete_ponudbe' ? `<button class="icon-btn btn-green" onclick="window.ustvariPrejetRacunIzPonudbe(${d.id})" title="Ustvari prejet račun">${ICONS.invoice}</button>` : ''}
                            ${(tip === 'ponudbe' || tip === 'izdani_racuni') ? `<button class="icon-btn btn-orange" onclick="window.ustvariDelovniNalog(${d.id})" title="Ustvari delovni nalog">🛠️</button>` : ''}
                            <button class="icon-btn" onclick="window.kopirajDokument(${d.id}, '${tip}', '${naslov}')" title="Kopiraj">${ICONS.copy}</button>
                            <button class="icon-btn btn-red" onclick="brisiDokument(${d.id}, '${tip}', '${naslov}')" title="Briši">${ICONS.delete}</button>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += `</tbody></table>`;
        contentDiv.innerHTML = html;
        
    } catch (e) {
        contentDiv.innerHTML = `<p style="color:red">Napaka pri nalaganju podatkov.</p>`;
    }
}

async function showUrediDokument(id, tip, naslov) {
    try {
        const res = await fetch(`/api/dokumenti/detajl/${id}`);
        if (!res.ok) throw new Error("Ni mogoče pridobiti podatkov.");
        const doc = await res.json();
        await showDodajDokument(tip, naslov, doc);
    } catch (e) {
        alert(e.message);
        renderDokumenti(tip, naslov);
    }
}

window.osveziTecaj = async function() {
    const vEl = document.getElementById('d_valuta');
    const tEl = document.getElementById('d_tecaj');
    const eurContainer = document.getElementById('d_znesek_eur_container');
    if (!vEl || !tEl) return;

    const valuta = vEl.value;
    if (eurContainer) {
        eurContainer.style.display = (valuta === 'EUR') ? 'none' : 'block';
    }
    
    if (valuta === 'EUR') {
        tEl.value = '1,0000';
        window.kalkulirajZneske();
        return;
    }
    
    let datumStr = document.getElementById('d_datum_placila')?.value || document.getElementById('d_datum_izdaje')?.value;
    let datum = parseDateISO(datumStr);
    if (!datum) return;

    const todayStr = new Date().toISOString().split('T')[0];
    let queryDate = (datum >= todayStr) ? 'latest' : datum;
    
    try {
        // Kličemo naš lokalni backend, da se izognemo težavam s CORS
        const url = `/api/tecaj?valuta=${valuta}&datum=${queryDate}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Status: ${res.status}`);
        
        const data = await res.json();
        if (data.rates && data.rates.EUR) {
            tEl.value = formatNumberJS(data.rates.EUR, 4);
            const eurEl = document.getElementById('d_znesek_eur');
            if (eurEl) eurEl.value = '';
            window.kalkulirajZneske();
        }
    } catch(e) { 
        console.error("Napaka pri pridobivanju tečaja", e);
    }
};

window.kalkulirajTecajIzEur = function() {
    const vEl = document.getElementById('d_valuta');
    const tEl = document.getElementById('d_tecaj');
    const eurEl = document.getElementById('d_znesek_eur');
    if (!vEl || !tEl || !eurEl) return;

    const valuta = vEl.value;
    if (valuta === 'EUR') return;

    const zeleniEur = parseNumberJS(eurEl.value);
    if (!zeleniEur || zeleniEur <= 0) return;

    // Izračunamo skupno vrednost v tuji valuti
    let skupajValuta = 0;
    document.querySelectorAll('#postavke-container .postavka-item').forEach(tr => {
        const kol = parseNumberJS(tr.querySelector('.p-kol').value) || 1;
        const cena = parseNumberJS(tr.querySelector('.p-cena').value) || 0;
        const popEl = tr.querySelector('.p-popust');
        const popust = popEl ? (parseNumberJS(popEl.value)) : 0;
        const ddvEl = tr.querySelector('.p-ddv');
        const ddv = ddvEl ? (parseNumberJS(ddvEl.value)) : 0;
        
        const netoZnesek = (kol * cena) * (1 - popust / 100);
        const brutoZnesek = netoZnesek * (1 + ddv / 100);
        skupajValuta += brutoZnesek;
    });

    if (skupajValuta > 0) {
        const izracunanTecaj = zeleniEur / skupajValuta;
        tEl.value = formatNumberJS(izracunanTecaj, 6); // Uporabimo 6 decimalk za tečaj iz EUR
        window.kalkulirajZneske();
    }
};

window.zapriGlavniPopup = function() {
    document.getElementById('dokument-popup-overlay').style.display = 'none';
    if (window.refreshCurrentModule) window.refreshCurrentModule();
};

window.zapriDokumentPopup = function() {
    window.zapriGlavniPopup();
};

window.odpriGlavniPopup = function(title, innerHtml, footerHtml = "", wide = false) {
    const box = document.getElementById('dokument-popup-box');
    document.getElementById('dokument-popup-overlay').style.display = 'flex';
    
    box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:15px 25px; border-bottom:1px solid #eee; background:#f8f9fa;">
            <h3 style="margin:0; color:var(--primary-blue);">${title}</h3>
            <button onclick="window.zapriGlavniPopup()" style="background:none; border:none; font-size:1.8em; cursor:pointer; color:#868e96; line-height:1;">&times;</button>
        </div>
        <div style="flex:1; overflow-y:auto; padding: 15px 25px;">
            <div style="max-width: ${wide ? '1600px' : '900px'}; margin: 0 auto; background: white;">
                ${innerHtml}
                ${footerHtml ? `<div style="margin-top: 25px; padding-top:15px; border-top: 1px solid var(--border-color);">${footerHtml}</div>` : ''}
            </div>
        </div>
    `;
};

async function showDodajDokument(tip, naslov, editData = null) {
    if (!window._navigatingHistory) {
        window._dokumentHistoryStack = [];
    }
    window._navigatingHistory = false;

    const pRes = await fetch('/api/partnerji');
    const partnerji = await pRes.json();
    window._currentPartnerji = partnerji;
    let partnerOpts = partnerji.map(p => `<option value="${p.id}" ${editData && editData.partner_id === p.id ? 'selected' : ''}>${p.naziv}</option>`).join('');

    const nRes = await fetch('/api/nastavitve');
    const nastavitve = await nRes.json();
    window._isZavezanec = !!nastavitve.zavezanec_za_ddv;
    const defaultNoga = (!nastavitve.zavezanec_za_ddv) ? "DDV ni obračunan na podlagi 1. odstavka 94. člena ZDDV-1" : "";

    const isActuallyEdit = !!editData && !!editData.id;
    
    // Nastavimo kontekst trenutnega obrazca
    window._currentFormContext = {
        tip: tip,
        naslov: naslov,
        id: isActuallyEdit ? editData.id : null
    };
    window._currentEditId = isActuallyEdit ? editData.id : null;

    const title = isActuallyEdit ? `Uredi - ${naslov} (${editData.stevilka})` : `Nov - ${naslov}`;
    const btnText = isActuallyEdit ? "Shrani" : "Ustvari dokument";

    const showPopust = (tip === 'izdani_racuni' || tip === 'ponudbe' || tip === 'prejete_ponudbe' || tip === 'prejeti_racuni');
    window._currentTip = tip;

    let prevId = null;
    let nextId = null;
    if (isActuallyEdit) {
        try {
            const resAll = await fetch(`/api/dokumenti/${tip}`);
            const allDocs = await resAll.json();
            const leto = getLeto();
            const filtrirano = allDocs.filter(d => d.poslovno_leto === leto);
            const sortirano = window.sortAppData(filtrirano, tip);
            const idx = sortirano.findIndex(d => d.id === editData.id);
            if (idx > 0) nextId = sortirano[idx - 1].id; // Novejši dokument, višje na seznamu -> Naslednji
            if (idx !== -1 && idx < sortirano.length - 1) prevId = sortirano[idx + 1].id; // Starejši dokument, nižje na seznamu -> Prejšnji
        } catch(e) {}
    }

    const box = document.getElementById('dokument-popup-box');
    document.getElementById('dokument-popup-overlay').style.display = 'flex';
    
    let formInnerHtml = `
        <div style="max-width: 1600px; margin: 0 auto; background: white; padding: 0; border-radius: 0;">
                <div style="display: flex; justify-content: flex-end; gap: 15px; margin-bottom: 20px;">
                    <div style="display: flex; gap: 8px; flex-shrink: 0;">
                        ${isActuallyEdit ? `
                            ${tip === 'ponudbe' ? `<button type="button" class="btn" style="padding: 4px 10px; font-size: 0.9em; background:#2b8a3e; color:white; border:1px solid #2b8a3e;" onclick="window.ustvariRacunIzPonudbe(${editData.id})" title="Ustvari račun iz te ponudbe">🧾 Ustvari račun</button>` : ''}
                            ${tip === 'prejete_ponudbe' ? `<button type="button" class="btn" style="padding: 4px 10px; font-size: 0.9em; background:#2b8a3e; color:white; border:1px solid #2b8a3e;" onclick="window.ustvariPrejetRacunIzPonudbe(${editData.id})" title="Ustvari prejet račun iz te ponudbe">🧾 Ustvari prejet račun</button>` : ''}
                            <button type="button" class="btn" style="padding: 4px 10px; font-size: 0.9em; background:#f1f3f5; color:#495057; border:1px solid #ced4da;" onclick="showDodajDokument('${tip}', '${naslov}')" title="Nov dokument">➕ Nov</button>
                            <button type="button" class="btn" style="padding: 4px 10px; font-size: 0.9em; background:#e7f5ff; color:#1971c2; border:1px solid #a5d8ff;" onclick="window.kopirajDokument(${editData.id}, '${tip}', '${naslov}')" title="Kopiraj dokument">📋 Kopiraj</button>
                            <button type="button" class="btn" style="padding: 4px 10px; font-size: 0.9em; background:#f1f3f5; color:#495057; border:1px solid #ced4da; ${!prevId ? 'opacity:0.5;cursor:not-allowed;' : ''}" ${prevId ? `onclick="showUrediDokument(${prevId}, '${tip}', '${naslov}')"` : 'disabled'} title="Prejšnji">◀ Prejšnji</button>
                            <button type="button" class="btn" style="padding: 4px 10px; font-size: 0.9em; background:#f1f3f5; color:#495057; border:1px solid #ced4da; ${!nextId ? 'opacity:0.5;cursor:not-allowed;' : ''}" ${nextId ? `onclick="showUrediDokument(${nextId}, '${tip}', '${naslov}')"` : 'disabled'} title="Naslednji">Naslednji ▶</button>
                        ` : ''}
                    </div>
                </div>
            <p style="margin-bottom: 20px; color: var(--text-muted); font-size: 0.9em;">
                ${isActuallyEdit ? 'Spremenite podatke in potrdite s klikom na spodnji gumb.' : `Dokument bo samodejno oštevilčen glede na izbrano poslovno leto (<strong>${getLeto()}</strong>).`}
            </p>
            <form id="dokForm" onsubmit="shraniDokument(event, '${tip}', '${naslov}', ${isActuallyEdit ? editData.id : 'null'})">
                <div style="display: flex; gap: 15px;">
                    <div class="form-group" style="flex: 2;">
                        <label>Poslovni partner</label>
                        <div style="display: flex; gap: 5px;">
                            <div style="flex: 1;">
                                <input type="text" id="d_partner_search" placeholder="Vpišite naziv, davčno ali naslov..." value="${editData ? (partnerji.find(p => p.id === editData.partner_id)?.naziv || '') : ''}" required autocomplete="off">
                                <input type="hidden" id="d_partner" value="${editData ? (editData.partner_id || '') : ''}">
                            </div>
                            <button type="button" title="Dodaj novega partnerja" onclick="window.odpriPartnerPopup(document.getElementById('d_partner'))" style="padding:2px 10px; font-size:1.2em; background:#e7f5ff; color:#1971c2; border:1px solid #a5d8ff; border-radius:4px; cursor:pointer;">+</button>
                        </div>
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>Številka dokumenta</label>
                        <input type="text" id="d_stevilka" value="${editData ? (editData.stevilka || '') : ''}" placeholder="${(tip === 'izdani_racuni' || tip === 'ponudbe') ? 'Samodejno' : 'Vnesi številko'}">
                    </div>
                    ${(tip === 'prejeti_racuni' || tip === 'prejete_ponudbe') ? `
                    <div class="form-group" style="flex: 1;">
                        <label>Zaporedna št. (#)</label>
                        <input type="text" id="d_interna_stevilka" value="${editData ? (editData.interna_stevilka || '') : ''}" placeholder="Samodejno">
                    </div>
                    ` : `<input type="hidden" id="d_interna_stevilka" value="${editData ? (editData.interna_stevilka || '') : ''}">`}
                </div>
                <div style="display: flex; gap: 15px;">
                    <div class="form-group" style="flex: 1;">
                        <label>Datum izdaje</label>
                        <input type="text" id="d_datum_izdaje" value="${editData ? formatDateJS(editData.datum_izdaje) : ''}" placeholder="DD.MM.YYYY" required onchange="window.osveziTecaj()">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>Datum zapadlosti</label>
                        <input type="text" id="d_datum_zapadlosti" value="${editData ? formatDateJS(editData.datum_zapadlosti) : ''}" placeholder="DD.MM.YYYY" required>
                    </div>
                </div>
                ${(tip === 'prejeti_racuni' || tip === 'prejete_ponudbe' || tip === 'izdani_racuni' || tip === 'ponudbe' || tip === 'delovni_nalogi') ? `
                <div style="display: flex; gap: 15px; margin-top: 10px;">
                    <div class="form-group" style="flex: 1;">
                        <label>Datum opravljene storitve OD <small>(neobvezno)</small></label>
                        <input type="text" id="d_datum_storitve_od" value="${editData ? formatDateJS(editData.datum_storitve_od) : ''}" placeholder="DD.MM.YYYY">
                    </div>
                    <div class="form-group" style="flex: 1;">
                        <label>Datum opravljene storitve DO <small>(neobvezno)</small></label>
                        <input type="text" id="d_datum_storitve_do" value="${editData ? formatDateJS(editData.datum_storitve_do) : ''}" placeholder="DD.MM.YYYY">
                    </div>
                </div>
                ` : ''}

                ${(tip === 'prejeti_racuni' || tip === 'prejete_ponudbe') ? `
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0; border: 1px solid #dee2e6; display: flex; gap: 15px; align-items: flex-end; flex-wrap: wrap;">
                    <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom:0;">
                        <label>Valuta računa</label>
                        <select id="d_valuta" onchange="window.osveziTecaj()" style="width:100%">
                            <option value="EUR" ${editData?.valuta === 'EUR' ? 'selected' : ''}>EUR (€)</option>
                            <option value="USD" ${editData?.valuta === 'USD' ? 'selected' : ''}>USD ($)</option>
                            <option value="GBP" ${editData?.valuta === 'GBP' ? 'selected' : ''}>GBP (£)</option>
                        </select>
                    </div>
                    <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom:0;">
                        <label>Tečaj <a href="#" onclick="event.preventDefault(); window.osveziTecaj()" style="font-size:1.1em; margin-left:5px; text-decoration:none;" title="Osveži tečaj">🔄</a></label>
                        <input type="text" id="d_tecaj" value="${editData ? formatNumberJS(editData.tecaj, 4) : '1,0000'}" oninput="window.kalkulirajZneske()" style="width:100%">
                    </div>
                    <div class="form-group" style="flex: 1; min-width: 150px; margin-bottom:0;">
                        <label>Datum plačila (za tečaj)</label>
                        <input type="text" id="d_datum_placila" value="${editData ? formatDateJS(editData.datum_placila) : ''}" placeholder="DD.MM.YYYY" onchange="window.osveziTecaj()" style="width:100%">
                    </div>
                    <div class="form-group" id="d_znesek_eur_container" style="flex: 1; min-width: 120px; margin-bottom:0; display: ${editData?.valuta && editData.valuta !== 'EUR' ? 'block' : 'none'};">
                        <label>Znesek v EUR</label>
                        <input type="text" id="d_znesek_eur" value="" placeholder="Znesek v EUR" oninput="window.kalkulirajTecajIzEur()" style="width:100%">
                    </div>
                </div>
                ` : ''}
                
                <h4 style="margin-top: 15px; padding-bottom: 10px; border-bottom: 1px solid var(--border-color); color: var(--text-muted);">Postavke dokumenta</h4>
                <div id="postavke-container" style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
                </div>
                <div style="margin-top: 10px; display:flex; justify-content:space-between; align-items:center;">
                    <div style="display:flex; gap:15px; align-items:center;">
                        <button type="button" class="btn" style="background:var(--bg-sidebar); color:var(--text-main); font-size: 0.8em;" onclick="dodajPostavkoR()">+ Dodaj vrstico</button>
                        ${['prejeti_racuni', 'prejete_ponudbe', 'dobropisi', 'prejeti_dobropisi'].includes(tip) ? `
                            <div style="display:flex; align-items:center; gap:8px;">
                                <label for="d_stotinska_izravnava" style="font-size:0.85em; font-weight:bold; color:var(--text-muted); margin:0;">Stotinska izravnava:</label>
                                <input type="text" id="d_stotinska_izravnava" value="${editData ? formatNumberJS(editData.stotinska_izravnava || 0) : '0,00'}" oninput="window.kalkulirajZneske()" style="width:75px; padding:4px 8px; font-size:0.85em; border: 1px solid var(--border-color); border-radius:4px; text-align:right;">
                            </div>
                        ` : ''}
                    </div>
                    <div style="font-size: 1.25em; font-weight: bold; color:var(--primary-blue);">SKUPAJ: <span id="skupaj-znesek">0.00</span> &euro;</div>
                </div>

                ${(tip === 'izdani_racuni' || tip === 'ponudbe' || tip === 'delovni_nalogi') ? `
                <div style="margin-top: 20px; background: #f8f9fa; padding: 15px; border-radius: 4px; border: 1px solid var(--border-color);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <h4 style="margin:0; color:var(--primary-blue);">Zaključna besedila</h4>
                        <div style="display:flex; gap:5px; align-items:center;">
                            <select id="d_template_select" style="width: auto; padding: 4px;" onchange="applyTemplateToTextarea()">
                                <option value="">+ Dodaj predlogo...</option>
                            </select>
                            <button type="button" class="btn" style="padding: 4px 8px; font-size: 0.75em; background:#6c757d; color:white;" onclick="window.pocistiZakljucna()">Počisti predloge</button>
                        </div>
                    </div>
                    
                    <div id="d_zakljucno_container" style="display:flex; flex-direction:column; gap:10px;">
                        <!-- Dinamično dodana polja -->
                    </div>
                    
                    <div style="margin-top:15px; border-top: 1px solid #ddd; padding-top:15px;">
                        <div class="form-group">
                            <label>Noga dokumenta (prikazano na dnu)</label>
                            <textarea id="d_noga" rows="2" style="width:100%; border:1px solid var(--border-color); border-radius:4px; padding:8px;">${editData ? (editData.noga_dokumenta || '') : defaultNoga}</textarea>
                        </div>
                    </div>
                </div>
                ` : '<div id="d_zakljucno_container"></div><input type="hidden" id="d_noga" value="">'}


                
                ${(tip === 'izdani_racuni' || tip === 'ponudbe') ? `
                <div style="margin-top: 20px; padding: 15px; background: #fff9db; border-radius: 4px; border: 1px solid #fab005;">
                    <h4 style="margin:0 0 10px 0; color:var(--primary-blue);">Plačilni podatki na PDF</h4>
                    <div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">
                        <label style="display: flex; gap: 8px; align-items: center; cursor: pointer; font-weight: bold;">
                            <input type="checkbox" id="d_vkljuci_placilo" ${(!editData || editData.vkljuci_placilo !== 0) ? 'checked' : ''} onchange="window.toggleOdstotek(this.checked)">
                            Vključi podatke za plačilo in QR kodo
                        </label>
                        <div id="d_odstotek_box" style="display: ${(!editData || editData.vkljuci_placilo !== 0) ? 'flex' : 'none'}; gap: 8px; align-items: center; background: white; padding: 5px 10px; border-radius: 4px; border: 1px solid #eee;">
                            <label>Znesek za plačilo:</label>
                            <input type="number" id="d_odstotek_placila" value="${editData ? (editData.odstotek_placila || 100) : 100}" min="1" max="100" style="width: 70px; padding: 4px;"> <span style="font-weight:bold">%</span>
                        </div>
                    </div>
                </div>
                ` : ''}
                
                <div style="margin-top: 20px; padding: 15px; background: #eef7ff; border-radius: 4px; border: 1px solid #cce5ff;">
                    <h4 style="margin:0 0 10px 0; color:var(--primary-blue);">Status plačila</h4>
                    <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                        <div class="form-group" style="flex: 1; min-width: 120px;">
                            <label>Status</label>
                            <select id="d_status">
                                <option value="neplačano" ${editData && editData.status === 'neplačano' ? 'selected' : ''}>Neplačano</option>
                                <option value="plačano" ${editData && editData.status === 'plačano' ? 'selected' : ''}>Plačano</option>
                                <option value="delno plačano" ${editData && editData.status === 'delno plačano' ? 'selected' : ''}>Delno plačano</option>
                            </select>
                        </div>
                        <div class="form-group" style="flex: 1; min-width: 120px;">
                            <label>Datum plačila</label>
                            <input type="text" id="d_datum_placila" value="${editData ? formatDateJS(editData.datum_placila) : ''}" placeholder="DD.MM.YYYY">
                        </div>
                        <div class="form-group" style="flex: 1; min-width: 120px;">
                            <label>Način plačila</label>
                            <select id="d_nacin_placila">
                                <option value="" ${!editData || !editData.nacin_placila ? 'selected' : ''}>--- Izberi ---</option>
                                <option value="TRR" ${editData && editData.nacin_placila === 'TRR' ? 'selected' : ''}>TRR</option>
                                <option value="Poslovna kartica" ${editData && editData.nacin_placila === 'Poslovna kartica' ? 'selected' : ''}>Poslovna kartica</option>
                                <option value="Paypal" ${editData && editData.nacin_placila === 'Paypal' ? 'selected' : ''}>Paypal</option>
                                <option value="Gotovina" ${editData && editData.nacin_placila === 'Gotovina' ? 'selected' : ''}>Gotovina</option>
                                <option value="Kompenzacija" ${editData && editData.nacin_placila === 'Kompenzacija' ? 'selected' : ''}>Kompenzacija</option>
                            </select>
                        </div>
                        <div class="form-group" id="d_delno_placano_box" style="flex: 1; min-width: 120px; display: ${(() => {
                            if (!editData) return 'none';
                            if (editData.status === 'delno plačano') return 'block';
                            if (editData.delno_placano_znesek > 0) return 'block';
                            let dp = [];
                            try {
                                dp = typeof editData.delna_placila === 'string' ? JSON.parse(editData.delna_placila || '[]') : (editData.delna_placila || []);
                            } catch(e) {}
                            return dp.length > 0 ? 'block' : 'none';
                        })()};">
                            <label>Znesek (€)</label>
                            <input type="text" id="d_delno_placano_znesek" value="${editData ? formatNumberJS(editData.delno_placano_znesek || 0) : '0,00'}" placeholder="0,00" oninput="window.osveziStatusPlacilaAuto()">
                        </div>
                        ${(tip === 'prejeti_racuni' || tip === 'prejete_ponudbe') ? `
                        <div class="form-group" style="flex: 1; min-width: 120px;">
                            <label>Sklic za plačilo</label>
                            <input type="text" id="d_sklic" value="${editData ? (editData.sklic || '') : ''}" placeholder="npr. SI12 123-456" oninput="if(window.updateDQR) window.updateDQR();">
                        </div>
                        ` : `<input type="hidden" id="d_sklic" value="">`}
                    </div>
                    <div id="kompenzacija_container" style="display: ${editData && editData.nacin_placila === 'Kompenzacija' ? 'block' : 'none'}; margin-top: 15px; border-top: 1px dashed #ced4da; padding-top: 15px;"></div>
                    <div id="delna_placila_container" style="display: ${(() => {
                        if (!editData) return 'none';
                        if (editData.status === 'delno plačano') return 'block';
                        let dp = [];
                        try {
                            dp = typeof editData.delna_placila === 'string' ? JSON.parse(editData.delna_placila || '[]') : (editData.delna_placila || []);
                        } catch(e) {}
                        return dp.length > 0 ? 'block' : 'none';
                    })()}; margin-top: 15px; border-top: 1px dashed #ced4da; padding-top: 15px;"></div>
                </div>

                ${(tip === 'prejeti_racuni' || tip === 'prejete_ponudbe') ? `
                <div style="margin-top: 20px; padding: 20px; background: #f8f9fa; border-radius: 8px; border: 1px solid #dee2e6; display: flex; gap: 20px; align-items: center; justify-content: center;">
                    <div id="d_qr_code_box" style="background: white; padding: 10px; border: 1px solid #ccc; border-radius: 4px; display: flex; align-items: center; justify-content: center; width: 140px; height: 140px; flex-shrink: 0;">
                        <div id="d_qr_code"></div>
                    </div>
                    <div style="flex: 1; font-size: 0.9em; color: #495057;">
                        <h4 style="margin: 0 0 8px 0; color: var(--primary-blue); font-weight: 600;">Hitro plačilo (UPN-QR)</h4>
                        <p style="margin: 2px 0;"><strong>Znesek:</strong> <span id="d_qr_val-znesek">0.00</span> €</p>
                        <p style="margin: 2px 0;"><strong>Prejemnik:</strong> <span id="d_qr_val-prejemnik">---</span></p>
                        <p style="margin: 2px 0;"><strong>TRR:</strong> <span id="d_qr_val-trr">---</span></p>
                        <p style="margin: 2px 0;"><strong>Sklic:</strong> <span id="d_qr_val-sklic">---</span></p>
                        <p style="margin: 5px 0; display: flex; align-items: center; gap: 8px;">
                            <strong>Spremeni Sklic:</strong>
                            <input type="text" id="d_qr_val-sklic-input" value="${editData ? (editData.sklic || '') : ''}" placeholder="npr. SI12 90-90-26900195" style="border: 1px solid #ced4da; border-radius: 4px; padding: 3px 8px; font-weight: bold; font-family: monospace; font-size: 0.95em; width: 220px;" oninput="const val = this.value; const dSklic = document.getElementById('d_sklic'); if (dSklic) { dSklic.value = val; } if (window.updateDQR) window.updateDQR();">
                        </p>
                    </div>
                </div>
                ` : ''}

                <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid var(--border-color); display: flex; align-items: center; flex-wrap: wrap; gap: 10px;">
                    <button type="submit" class="btn btn-blue">${btnText}</button>
                    ${isActuallyEdit ? `
                        <button type="button" class="btn" style="background:white; color:#495057; border:1px solid #dee2e6; display:flex; align-items:center; gap:5px; transition: background 0.2s;" onmouseover="this.style.background='#f1f3f5'" onmouseout="this.style.background='#fff'" onclick="posljiEmail(${editData.id})">${ICONS.send} E-pošta</button>
                    ` : ''}
                    ${isActuallyEdit && tip === 'izdani_racuni' ? `
                        <button type="button" class="btn" style="background:#e7f5ff; color:#1864ab; border:1px solid #a5d8ff; display:flex; align-items:center; gap:5px; transition: background 0.2s;" onmouseover="this.style.background='#d0ebff'" onmouseout="this.style.background='#e7f5ff'" onclick="window.posljiNaUjp(${editData.id}, '${editData.stevilka}')">🏛️ UJP</button>
                    ` : ''}
                    ${isActuallyEdit && tip === 'izdani_racuni' ? `
                        <button type="button" class="btn" style="background:#fff3cd; color:#856404; border:1px solid #ffeeba; display:flex; align-items:center; gap:5px; transition: background 0.2s;" onmouseover="this.style.background='#ffeeba'" onmouseout="this.style.background='#fff3cd'" onclick="posljiOpomin(${editData.id})">🔔 Opomin</button>
                    ` : ''}
                    ${isActuallyEdit && tip === 'izdani_racuni' ? `
                        <button type="button" class="btn" style="background:white; color:#495057; border:1px solid #dee2e6; display:flex; align-items:center; gap:5px; transition: background 0.2s;" onmouseover="this.style.background='#f1f3f5'" onmouseout="this.style.background='#fff'" onclick="window.izvoziEslogXml(${editData.id})">${ICONS.download} XML</button>
                    ` : ''}
                    ${isActuallyEdit && (tip === 'izdani_racuni' || tip === 'ponudbe') ? `
                        <button type="button" class="btn" style="background:white; color:#495057; border:1px solid #dee2e6; display:flex; align-items:center; gap:5px; transition: background 0.2s;" onmouseover="this.style.background='#f1f3f5'" onmouseout="this.style.background='#fff'" onclick="prenesiPDF(${editData.id})">${ICONS.download} PDF</button>
                    ` : ''}
                    ${isActuallyEdit && (tip === 'prejeti_racuni' || tip === 'prejete_ponudbe' || tip === 'prejeti_dobropisi') ? `
                        <button type="button" class="btn" style="background:white; color:#495057; border:1px solid #dee2e6; display:flex; align-items:center; gap:5px; transition: background 0.2s;" onmouseover="this.style.background='#f1f3f5'" onmouseout="this.style.background='#fff'" onclick="if(window.PrilogeUI && window.PrilogeUI._liste && window.PrilogeUI._liste.length > 0) { window.open(window.PrilogeUI._liste[0].url) } else { alert('Ni naloženih prilog za ta dokument.') }">${ICONS.download} PDF</button>
                    ` : ''}
                    <button type="button" class="btn" onclick="window.zapriDokumentPopup()" style="color: var(--text-main); background: #eee;">Prekliči</button>
                </div>
            </form>
        </div>
    `;
    const hasHistory = window._dokumentHistoryStack && window._dokumentHistoryStack.length > 0;
    const backBtn = hasHistory ? `
        <button onclick="window.vrniNaPrejsnjiDokument()" 
            style="background:#fff; border:1px solid #ced4da; font-size:0.85em; cursor:pointer; color:var(--primary-blue); display:inline-flex; align-items:center; gap:5px; font-weight:600; padding: 4px 10px; border-radius: 4px; margin-right: 12px; transition: all 0.2s;"
            onmouseover="this.style.background='#f1f3f5'" onmouseout="this.style.background='#fff'">
            ← Nazaj
        </button>
    ` : '';

    // Ovijemo v split view
    box.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:15px 25px; border-bottom:1px solid #eee; background:#f8f9fa;">
            <div style="display:flex; align-items:center;">
                ${backBtn}
                <h3 style="margin:0; color:var(--primary-blue);">${title}</h3>
            </div>
            <button onclick="window.zapriDokumentPopup()" style="background:none; border:none; font-size:1.8em; cursor:pointer; color:#868e96; line-height:1;">&times;</button>
        </div>
        <div style="flex:1; overflow-y:auto; padding: 10px 20px;">
            ${buildSplitViewHTML(formInnerHtml, 'dokumenti', isActuallyEdit ? editData.id : null)}
        </div>
    `;
    window.PrilogeUI.zadnjePoslano = editData ? editData.zadnje_poslano : null;
    if (isActuallyEdit) window.PrilogeUI.init('dokumenti', editData.id);
    
    if (editData && editData.postavke && editData.postavke.length > 0) {
        editData.postavke.forEach(p => dodajPostavkoR(p));
    } else {
        dodajPostavkoR(); // add first empty row
    }

    window.toggleOdstotek = (checked) => {
        const box = document.getElementById('d_odstotek_box');
        if (box) box.style.display = checked ? 'flex' : 'none';
    };

    // Definicija ustvariZakljucnoPolje mora biti tukaj - PRED klicem spodaj
    window.ustvariZakljucnoPolje = (besedilo = "") => {
        const container = document.getElementById('d_zakljucno_container');
        if (!container) return null;
        const div = document.createElement('div');
        div.className = 'zakljucno-box';
        div.style = "margin-bottom: 5px; border: 1px solid #ddd; padding: 10px; border-radius: 4px; background: white;";
        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                <label style="font-size:0.8em; color:#666;">Predloga / Besedilo</label>
                <div style="display:flex; gap:10px;">
                    <a href="#" onclick="window.shraniToleKotPredlogo(this); return false;" style="font-size:0.75em; color:var(--primary-blue);">Shrani kot predlogo</a>
                    <a href="#" onclick="this.closest('.zakljucno-box').remove(); return false;" style="font-size:0.75em; color:var(--primary-red); font-weight:bold;">[X] Odstrani</a>
                </div>
            </div>
            <textarea rows="2" style="width:100%; border:1px solid #eee; border-radius:4px; padding:5px; font-size:0.9em;">${besedilo}</textarea>
        `;
        container.appendChild(div);
        return div.querySelector('textarea');
    };

    // Naloži zaključna besedila (razdeli po ločilniku \n\n)
    if (editData && editData.zakljucno_besedilo) {
        const parts = editData.zakljucno_besedilo.split('\n\n');
        parts.forEach(p => window.ustvariZakljucnoPolje(p.trim()));
    } else if (!isActuallyEdit && (tip === 'izdani_racuni' || tip === 'ponudbe' || tip === 'delovni_nalogi')) {
        window.ustvariZakljucnoPolje(""); // Vsaj eno prazno polje
    }

    kalkulirajZneske();

    if (tip === 'izdani_racuni' || tip === 'ponudbe' || tip === 'delovni_nalogi') {
        const tSel = document.getElementById('d_template_select');

        async function osveziPredlogeSelect() {
            tSel.innerHTML = '<option value="">+ Dodaj predlogo...</option>';
            try {
                const tRes = await fetch('/api/zakljucna_besedila');
                if (!tRes.ok) throw new Error("API error");
                const templates = await tRes.json();
                templates.forEach(t => {
                    const opt = document.createElement('option');
                    opt.value = t.besedilo;
                    opt.textContent = t.naziv;
                    tSel.appendChild(opt);
                });
            } catch (e) {
                console.error("Napaka pri nalaganju predlog:", e);
            }
        }
        await osveziPredlogeSelect();

        // Spremljanje zadnjega fokusiranega polja (ker ob kliku na select fokusi pobegnejo)
        window.lastFocusedTextarea = null;
        document.getElementById('d_noga').addEventListener('focus', function() {
            window.lastFocusedTextarea = 'noga';
        });
        document.getElementById('d_zakljucno_container').addEventListener('focusin', function() {
            window.lastFocusedTextarea = 'zakljucno';
        });

        window.applyTemplateToTextarea = () => {
            const val = tSel.value;
            if(!val) return;
            
            // Če je zadnje fokusirano polje bila noga dokumenta
            if (window.lastFocusedTextarea === 'noga') {
                const el = document.getElementById('d_noga');
                el.value += (el.value.trim() ? '\n' : '') + val;
            } else {
                // Drugače ustvari novo polje med zaključnimi besedili
                window.ustvariZakljucnoPolje(val);
            }
            tSel.value = ""; // Reset select
            window.lastFocusedTextarea = null; // Ponastavi
        };

        window.pocistiZakljucna = () => {
            if(confirm("Ali želite odstraniti vsa polja zaključnega besedila?")) {
                document.getElementById('d_zakljucno_container').innerHTML = "";
                window.ustvariZakljucnoPolje(""); // Dodamo eno prazno
            }
        };

        window.shraniToleKotPredlogo = async (anchor) => {
            const besedilo = anchor.closest('.zakljucno-box').querySelector('textarea').value;
            if(!besedilo.trim()) { alert("Besedilo je prazno."); return; }
            const naziv = prompt("Vnesite naziv nove predloge:");
            if(!naziv) return;
            
            const res = await fetch('/api/zakljucna_besedila', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({naziv: naziv, besedilo: besedilo})
            });
            if(res.ok) {
                alert("Predloga shranjena.");
                await osveziPredlogeSelect();
            }
        };
    }
    window.initDatePickers();
    // Posebej za tečajna polja, da sprožimo osvežitev ob izbiri datuma
    ['d_datum_placila', 'd_datum_izdaje'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el._flatpickr) {
            el._flatpickr.set('onChange', (selectedDates, dateStr) => {
                setTimeout(() => window.osveziTecaj(), 10);
            });
        }
    });
    if (window.initPartnerSearch) {
        window.initPartnerSearch(document.getElementById('d_partner_search'), document.getElementById('d_partner'), () => {
            if (window.updateDQR) window.updateDQR();
        });
    }

    // Kompenzacija UI logika
    window._selectedKompenzacijaDocId = (editData && editData.kompenzacija_doc_id) ? editData.kompenzacija_doc_id : null;
    
    const nacinPlacilaSel = document.getElementById('d_nacin_placila');
    if (nacinPlacilaSel) {
        nacinPlacilaSel.addEventListener('change', () => {
            const kompBox = document.getElementById('kompenzacija_container');
            if (kompBox) {
                if (nacinPlacilaSel.value === 'Kompenzacija') {
                    kompBox.style.display = 'block';
                    window.osveziKompenzacijaUI();
                } else {
                    kompBox.style.display = 'none';
                }
            }
        });
    }
    
    if (editData && editData.nacin_placila === 'Kompenzacija') {
        window.osveziKompenzacijaUI();
    }

    // Pomožne funkcije za iskanje in povezovanje dokumentov znotraj delnih plačil
    window.osveziDpLinkUI = async function(row, povezanDocId = null, nacin = '') {
        const linkSection = row.querySelector('.dp-link-section');
        const hiddenInp = row.querySelector('.dp-povezan-doc-id');
        if (!linkSection || !hiddenInp) return;

        hiddenInp.value = povezanDocId || '';

        if (povezanDocId) {
            linkSection.innerHTML = `<p style="font-size:0.85em; color:#666; margin:0 0-5px 0;">Nalagam podatke o povezanem dokumentu...</p>`;
            try {
                const res = await fetch(`/api/dokumenti/detajl/${povezanDocId}`);
                if (!res.ok) throw new Error("Dokument ni najden");
                const doc = await res.json();
                
                linkSection.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:space-between; background:#f1f3f5; border:1px solid #ced4da; padding:6px 12px; border-radius:4px; font-size:0.85em; width:100%; box-sizing: border-box;">
                        <div>
                            <span style="font-weight:600; color:var(--primary-blue); cursor:pointer; text-decoration:underline;" onclick="window.odpriKompenzacijskiDokument(${doc.id}, '${doc.tip}')" title="Kliknite za ogled dokumenta">${doc.stevilka}</span>
                            <span style="color:#666; margin-left:10px;">${doc.partner_naziv} | ${formatMoneyJS(doc.znesek_skupaj)} €</span>
                        </div>
                        <button type="button" class="btn" style="padding:2px 8px; font-size:0.8em; background:#f8d7da; color:#721c24; border:1px solid #f5c6cb; height:24px; cursor:pointer;" onclick="window.odstraniDpLink(this)">Odstrani ✕</button>
                    </div>
                `;
            } catch(e) {
                linkSection.innerHTML = `
                    <div style="display:flex; align-items:center; justify-content:space-between; width:100%; box-sizing: border-box;">
                        <p style="color:red; font-size:0.85em; margin:0;">Napaka: povezanega dokumenta ni bilo mogoče najti.</p>
                        <button type="button" class="btn btn-blue" style="padding:2px 8px; font-size:0.8em; height:24px; cursor:pointer;" onclick="window.odstraniDpLink(this)">Išči znova</button>
                    </div>
                `;
            }
        } else {
            const labelText = nacin === 'Dobropis' ? 'Išči dobropis (št. ali partner)' : 'Išči dokument za kompenzacijo (št. ali partner)';
            linkSection.innerHTML = `
                <div style="position:relative; width:100%; box-sizing: border-box;">
                    <label style="font-size: 0.8em; margin-bottom: 2px; display: block; font-weight: bold; color: #495057;">${labelText}</label>
                    <input type="text" class="dp-search-input" placeholder="Vpišite vsaj 3 znake..." style="width: 100%; padding: 4px 8px; font-size: 0.9em; height: 30px; border: 1px solid #ced4da; border-radius: 4px; box-sizing: border-box;" oninput="window.iskiDpLinkDok(this)">
                    <div class="dp-search-results" style="position:absolute; left:0; right:0; z-index:99; margin-top:2px; border:1px solid #ced4da; border-radius:4px; max-height:180px; overflow-y:auto; background:#fff; display:none; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"></div>
                </div>
            `;
        }
    };

    window.iskiDpLinkDok = async function(inputEl) {
        const row = inputEl.closest('.delno-placilo-row');
        const resultsDiv = row.querySelector('.dp-search-results');
        if (!resultsDiv) return;
        
        const query = inputEl.value;
        if (query.length < 3) {
            resultsDiv.style.display = 'none';
            return;
        }

        const nacin = row.querySelector('.dp-nacin').value;

        try {
            const tipi = ['izdani_racuni', 'prejeti_racuni', 'dobropisi', 'prejeti_dobropisi'];
            let vsi = [];
            for (const t of tipi) {
                const res = await fetch(`/api/dokumenti/${t}`);
                const data = await res.json();
                vsi = vsi.concat(data);
            }

            const filtrirano = vsi.filter(d => {
                const matchesQuery = d.stevilka.toLowerCase().includes(query.toLowerCase()) || 
                                     (d.partner_naziv && d.partner_naziv.toLowerCase().includes(query.toLowerCase()));
                const notSelf = d.id !== window._currentEditId;
                
                if (nacin === 'Dobropis') {
                    // Za dobropis iščemo dobropise in prejete dobropise
                    return matchesQuery && notSelf && (d.tip === 'dobropisi' || d.tip === 'prejeti_dobropisi');
                }
                
                return matchesQuery && notSelf;
            });

            if (filtrirano.length === 0) {
                resultsDiv.innerHTML = `<div style="padding:8px 12px; color:#999; font-size:0.85em;">Ni rezultatov</div>`;
            } else {
                resultsDiv.innerHTML = filtrirano.map(d => {
                    const tipNaziv = d.tip === 'dobropisi' ? 'Dobropis' : d.tip === 'prejeti_dobropisi' ? 'Prejeti dobropis' : d.tip === 'izdani_racuni' ? 'Izdani račun' : 'Prejeti račun';
                    return `
                        <div style="padding:8px 12px; cursor:pointer; border-bottom:1px solid #f0f0f0; font-size:0.85em; text-align: left;" 
                             onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'"
                             onclick="window.izberiDpLinkDok(this, ${d.id}, '${d.stevilka}', ${d.znesek_skupaj}, '${formatDateJS(d.datum_izdaje)}')">
                            <div style="font-weight:600; display:flex; justify-content:space-between;">
                                <span>${d.stevilka}</span>
                                <span style="font-size:0.85em; color:var(--primary-blue); font-weight:normal;">${tipNaziv}</span>
                            </div>
                            <div style="color:#666; font-size:0.9em; margin-top:2px;">${d.partner_naziv} | ${formatMoneyJS(d.znesek_skupaj)} €</div>
                        </div>
                    `;
                }).join('');
            }
            resultsDiv.style.display = 'block';

        } catch(e) {
            resultsDiv.innerHTML = `<div style="padding:8px 12px; color:red; font-size:0.85em;">Napaka pri iskanju</div>`;
            resultsDiv.style.display = 'block';
        }
    };

    window.izberiDpLinkDok = function(element, docId, stevilka, znesekSkupaj, datumIzdaje = '') {
        const row = element.closest('.delno-placilo-row');
        const nacin = row.querySelector('.dp-nacin').value;
        
        window.osveziDpLinkUI(row, docId, nacin);

        const znesekInp = row.querySelector('.dp-znesek');
        const sklicInp = row.querySelector('.dp-sklic');
        const datumInp = row.querySelector('.dp-datum');
        
        if (znesekInp && (!znesekInp.value || parseNumberJS(znesekInp.value) === 0)) {
            znesekInp.value = formatNumberJS(znesekSkupaj);
        }
        if (sklicInp) {
            sklicInp.value = `${nacin}: ${stevilka}`;
        }
        if (datumInp && datumIzdaje) {
            datumInp.value = datumIzdaje;
        }
        window.osveziStatusPlacilaAuto();
    };

    window.odstraniDpLink = function(buttonEl) {
        const row = buttonEl.closest('.delno-placilo-row');
        const nacin = row.querySelector('.dp-nacin').value;
        window.osveziDpLinkUI(row, null, nacin);
        window.osveziStatusPlacilaAuto();
    };

    // Delna plačila UI logika
    window.dodajDelnoPlaciloRow = function(data = null) {
        const list = document.getElementById('delna_placila_list');
        if (!list) return;

        const row = document.createElement('div');
        row.className = 'delno-placilo-row';
        row.style = 'display: flex; gap: 10px; align-items: center; background: white; padding: 8px; border-radius: 4px; border: 1px solid #ddd; flex-wrap: wrap; margin-bottom: 8px; box-sizing: border-box;';

        const datumVal = data ? formatDateJS(data.datum) : '';
        const nacinVal = data ? data.nacin : 'TRR';
        const znesekVal = data ? formatNumberJS(data.znesek) : '';
        const sklicVal = data ? (data.sklic || '') : '';
        const povezanDocId = data ? (data.povezan_doc_id || null) : null;

        row.innerHTML = `
            <input type="hidden" class="dp-povezan-doc-id" value="${povezanDocId || ''}">
            <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom: 0;">
                <label style="font-size: 0.8em; margin-bottom: 2px; display: block; font-weight: bold; color: #495057;">Datum</label>
                <input type="text" class="dp-datum" value="${datumVal}" placeholder="DD.MM.YYYY" style="width: 100%; padding: 4px 8px; font-size: 0.9em; height: 30px; border: 1px solid #ced4da; border-radius: 4px;">
            </div>
            <div class="form-group" style="flex: 1; min-width: 120px; margin-bottom: 0;">
                <label style="font-size: 0.8em; margin-bottom: 2px; display: block; font-weight: bold; color: #495057;">Način</label>
                <select class="dp-nacin" style="width: 100%; padding: 4px 8px; font-size: 0.9em; height: 30px; border: 1px solid #ced4da; border-radius: 4px; background: white;">
                    <option value="TRR" ${nacinVal === 'TRR' ? 'selected' : ''}>TRR</option>
                    <option value="Poslovna kartica" ${nacinVal === 'Poslovna kartica' ? 'selected' : ''}>Poslovna kartica</option>
                    <option value="Paypal" ${nacinVal === 'Paypal' ? 'selected' : ''}>Paypal</option>
                    <option value="Gotovina" ${nacinVal === 'Gotovina' ? 'selected' : ''}>Gotovina</option>
                    <option value="Kompenzacija" ${nacinVal === 'Kompenzacija' ? 'selected' : ''}>Kompenzacija</option>
                    <option value="Dobropis" ${nacinVal === 'Dobropis' ? 'selected' : ''}>Dobropis</option>
                </select>
            </div>
            <div class="form-group" style="flex: 1; min-width: 100px; margin-bottom: 0;">
                <label style="font-size: 0.8em; margin-bottom: 2px; display: block; font-weight: bold; color: #495057;">Znesek (€)</label>
                <input type="text" class="dp-znesek" value="${znesekVal}" placeholder="0,00" style="width: 100%; padding: 4px 8px; font-size: 0.9em; height: 30px; border: 1px solid #ced4da; border-radius: 4px; text-align: right;" oninput="window.osveziStatusPlacilaAuto()">
            </div>
            <div class="form-group" style="flex: 2; min-width: 150px; margin-bottom: 0;">
                <label style="font-size: 0.8em; margin-bottom: 2px; display: block; font-weight: bold; color: #495057;">Sklic / Opomba</label>
                <input type="text" class="dp-sklic" value="${sklicVal}" placeholder="npr. SI12..." style="width: 100%; padding: 4px 8px; font-size: 0.9em; height: 30px; border: 1px solid #ced4da; border-radius: 4px;">
            </div>
            <button type="button" class="btn btn-red" style="padding: 4px 8px; margin-top: 15px; height: 30px; display: flex; align-items: center; justify-content: center; background: #e03131; color: white; border: none; border-radius: 4px; cursor: pointer;" onclick="this.closest('.delno-placilo-row').remove(); window.osveziStatusPlacilaAuto();">Odstrani</button>
            <div class="dp-link-section" style="width: 100%; margin-top: 8px; display: ${nacinVal === 'Kompenzacija' || nacinVal === 'Dobropis' ? 'block' : 'none'}; box-sizing: border-box;"></div>
        `;

        list.appendChild(row);

        const nacinSel = row.querySelector('.dp-nacin');
        nacinSel.addEventListener('change', () => {
            const val = nacinSel.value;
            const linkSec = row.querySelector('.dp-link-section');
            if (val === 'Kompenzacija' || val === 'Dobropis') {
                linkSec.style.display = 'block';
                window.osveziDpLinkUI(row, null, val);
            } else {
                linkSec.style.display = 'none';
                row.querySelector('.dp-povezan-doc-id').value = '';
            }
        });

        if (povezanDocId || nacinVal === 'Kompenzacija' || nacinVal === 'Dobropis') {
            window.osveziDpLinkUI(row, povezanDocId, nacinVal);
        }

        window.initDatePickers();
    };

    const dStatusSel = document.getElementById('d_status');
    if (dStatusSel) {
        dStatusSel.addEventListener('change', () => {
            const dpBox = document.getElementById('delna_placila_container');
            const delnoPlacanoBox = document.getElementById('d_delno_placano_box');
            
            // Preverimo, če imamo kakšna obstoječa delna plačila
            let imaPlacila = false;
            const delnoPlacanoInp = document.getElementById('d_delno_placano_znesek');
            const delnoPlacanoVal = delnoPlacanoInp ? (parseNumberJS(delnoPlacanoInp.value) || 0) : 0;
            let delnaSum = 0;
            const listEl = document.getElementById('delna_placila_list');
            if (listEl) {
                listEl.querySelectorAll('.dp-znesek').forEach(inp => {
                    delnaSum += parseNumberJS(inp.value) || 0;
                });
            }
            if (delnoPlacanoVal > 0 || delnaSum > 0 || (listEl && listEl.children.length > 0)) {
                imaPlacila = true;
            }

            if (delnoPlacanoBox) {
                delnoPlacanoBox.style.display = (dStatusSel.value === 'delno plačano' || imaPlacila) ? 'block' : 'none';
            }
            if (dpBox) {
                if (dStatusSel.value === 'delno plačano' || imaPlacila) {
                    dpBox.style.display = 'block';
                    const list = document.getElementById('delna_placila_list');
                    if (list && list.children.length === 0 && dStatusSel.value === 'delno plačano') {
                        window.dodajDelnoPlaciloRow();
                    }
                } else {
                    dpBox.style.display = 'none';
                }
            }
            window.osveziStatusPlacilaAuto();
        });
    }

    const dpContainer = document.getElementById('delna_placila_container');
    if (dpContainer) {
        dpContainer.innerHTML = `
            <h5 style="margin: 0 0 10px 0; color: var(--primary-blue); display: flex; justify-content: space-between; align-items: center; font-weight: bold; font-size: 0.95em;">
                <span>Seznam delnih plačil</span>
                <button type="button" class="btn" style="padding: 4px 10px; font-size: 0.85em; background: var(--primary-blue); color: white; border-radius: 4px; border: none; cursor: pointer; display: flex; align-items: center; gap: 5px;" onclick="window.dodajDelnoPlaciloRow()">+ Dodaj vrstico za plačilo</button>
            </h5>
            <div id="delna_placila_list" style="display: flex; flex-direction: column;"></div>
        `;

        let existingDP = [];
        if (editData && editData.delna_placila) {
            try {
                if (typeof editData.delna_placila === 'string') {
                    existingDP = JSON.parse(editData.delna_placila || '[]');
                } else {
                    existingDP = editData.delna_placila || [];
                }
            } catch(e) {
                existingDP = [];
            }
        }

        if (existingDP.length > 0) {
            existingDP.forEach(dp => window.dodajDelnoPlaciloRow(dp));
        }
    }

    // UPN-QR Code generator za urejanje dokumentov
    window.updateDQR = function() {
        try {
            const partner_id = parseInt(document.getElementById('d_partner')?.value) || 0;
            const partner = (window._currentPartnerji || []).find(p => p.id === partner_id);
            const sklic_input = document.getElementById('d_sklic')?.value.trim() || "";
            
            // Izračun zneska neposredno iz postavk
            let znesek = 0;
            document.querySelectorAll('#postavke-container .postavka-item').forEach(tr => {
                const kol = parseNumberJS(tr.querySelector('.p-kol').value) || 1;
                const cena = parseNumberJS(tr.querySelector('.p-cena').value) || 0;
                const popEl = tr.querySelector('.p-popust');
                const popust = popEl ? (parseNumberJS(popEl.value)) : 0;
                const ddvEl = tr.querySelector('.p-ddv');
                const ddv = ddvEl ? (parseNumberJS(ddvEl.value)) : 0;
                
                const netoZnesek = (kol * cena) * (1 - popust / 100);
                const brutoZnesek = netoZnesek * (1 + ddv / 100);
                znesek += brutoZnesek;
            });
            const stotinska = parseNumberJS(document.getElementById('d_stotinska_izravnava')?.value || '0');
            znesek += stotinska;

            const tecaj = parseNumberJS(document.getElementById('d_tecaj')?.value || '1');
            znesek = znesek * tecaj;

            const znesekEl = document.getElementById('d_qr_val-znesek');
            const prejemnikEl = document.getElementById('d_qr_val-prejemnik');
            const trrEl = document.getElementById('d_qr_val-trr');
            const sklicEl = document.getElementById('d_qr_val-sklic');
            const qrDiv = document.getElementById('d_qr_code');

            if (znesekEl) znesekEl.textContent = formatNumberJS(znesek);

            if (!qrDiv) return;

            if (!partner) {
                if (prejemnikEl) prejemnikEl.textContent = "Brez partnerja";
                if (trrEl) trrEl.textContent = "";
                if (sklicEl) sklicEl.textContent = "";
                qrDiv.innerHTML = '<span style="font-size:0.75rem; color:#868e96; padding:10px;">Izberite partnerja za QR</span>';
                return;
            }

            const trr = (partner.trr || "").replace(/\s+/g, "");

            if (prejemnikEl) prejemnikEl.textContent = partner.naziv;
            if (sklicEl) sklicEl.textContent = sklic_input || "SI99";
            const sklicInp = document.getElementById('d_qr_val-sklic-input');
            if (sklicInp && document.activeElement !== sklicInp) {
                sklicInp.value = sklic_input || "";
            }

            if (!trr) {
                if (trrEl) trrEl.textContent = "Brez TRR";
                qrDiv.innerHTML = '<span style="font-size:0.75rem; color:#868e96; padding:10px;">Vnesite TRR partnerja za QR</span>';
                return;
            }

            if (trrEl) trrEl.textContent = partner.trr;

            const cents = Math.round(znesek * 100);
            const amountStr = cents.toString().padStart(11, '0');

            const fields = [
                "UPNQR",                  // 1. Identifikator
                "",                       // 2. IBAN plačnika
                "",                       // 3. Polog gotovine
                "",                       // 4. Koda valute
                "",                       // 5. Znesek
                "Plačnik",                // 6. Ime plačnika
                "Naslov plačnika",        // 7. Naslov plačnika
                "Kraj plačnika",          // 8. Kraj plačnika
                amountStr,                // 9. Znesek
                "",                       // 10. Datum plačila
                "",                       // 11. Nujno
                "OTHR",                   // 12. Koda namena
                `PLAČILO RAČUNA ${document.getElementById('d_stevilka')?.value || ''}`.substring(0, 42).trim(), // 13. Namen
                "",                       // 14. Rok plačila
                trr,                      // 15. IBAN prejemnika
                sklic_input || "SI99",    // 16. Sklic prejemnika
                (partner.naziv || "Prejemnik").substring(0, 40), // 17. Ime prejemnika
                (partner.naslov || "").substring(0, 40), // 18. Naslov prejemnika
                ((partner.postna_stevilka || "") + " " + (partner.kraj || "Slovenija")).substring(0, 40).trim() // 19. Kraj prejemnika
            ];

            const rawBody = fields.join('\n') + '\n';
            const totalLen = rawBody.length + 3;
            const qrData = rawBody + totalLen.toString().padStart(3, '0');

            qrDiv.innerHTML = '';
            if (window.QRCode) {
                try {
                    new QRCode(qrDiv, {
                        text: qrData,
                        width: 140,
                        height: 140,
                        correctLevel: QRCode.CorrectLevel.M
                    });
                } catch(e) {
                    const encodedData = encodeURIComponent(qrData);
                    qrDiv.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodedData}&size=140x140" alt="QR Code" style="width:140px; height:140px;">`;
                }
            } else {
                const encodedData = encodeURIComponent(qrData);
                qrDiv.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodedData}&size=140x140" alt="QR Code" style="width:140px; height:140px;">`;
            }
        } catch(err) {
            console.error(err);
        }
    };

    window.kalkulirajZneske();

    // Preverjanje podvojene stevilke ob izhodu iz polja
    const stevilkaInput = document.getElementById('d_stevilka');
    if (stevilkaInput) {
        stevilkaInput.addEventListener('blur', async function() {
            const st = this.value.trim();
            if (!st) return;
            const tip = window._currentTip || 'prejeti_racuni';
            const excludeId = window._currentEditId || null;
            let url = `/api/dokumenti/check_stevilka?stevilka=${encodeURIComponent(st)}&tip=${tip}`;
            if (excludeId) url += `&exclude_id=${excludeId}`;
            try {
                const res = await fetch(url);
                const data = await res.json();
                let warn = document.getElementById('stevilka-dup-warn');
                if (data.obstaja) {
                    if (!warn) {
                        warn = document.createElement('div');
                        warn.id = 'stevilka-dup-warn';
                        warn.style = 'background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:6px 12px;margin-top:4px;font-size:0.85rem;color:#856404;';
                        stevilkaInput.parentNode.appendChild(warn);
                    }
                    warn.innerHTML = `⚠️ Dokument s številko <strong>${st}</strong> že obstaja (ID #${data.id}). Ali ste prepričani, da vnašate nov dokument?`;
                } else {
                    if (warn) warn.remove();
                }
            } catch(e) {}
        });
    }
}

window.dodajPostavkoR = function(data = null) {
    const container = document.getElementById('postavke-container');
    const showPopust = (window._currentTip === 'izdani_racuni' || window._currentTip === 'ponudbe' || window._currentTip === 'delovni_nalogi' || window._currentTip === 'prejeti_racuni' || window._currentTip === 'prejete_ponudbe');
    
    const div = document.createElement('div');
    div.className = 'postavka-item';
    div.style = "border: 1px solid var(--border-color); padding: 15px; border-radius: 6px; background: #f8f9fa;";
    
    div.innerHTML = `
        <div style="display:flex; gap:10px; margin-bottom:10px;">
            <div style="flex:1;">
                <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">Opis storitve/izdelka</label>
                <div style="display:flex; gap:5px;">
                    <input type="hidden" class="p-artikel-id" value="${data ? (data.artikel_id || '') : ''}">
                    <input type="text" class="p-opis" style="flex:1;" value="${data ? data.opis : ''}" required>
                    <button type="button" title="Shrani v šifrant" onclick="window.shraniPostavkoKotArtikel(this.closest('.postavka-item'))" style="padding:2px 10px; font-size:1.1em; background:#ebfbee; color:#2b8a3e; border:1px solid #b2f2bb; border-radius:4px; cursor:pointer; white-space:nowrap; height:32px;">💾</button>
                    <button type="button" title="Izberi iz šifranta" onclick="window.odpriArtikelPopupZaPostavko(this.closest('.postavka-item'))" style="padding:2px 10px; font-size:1.1em; background:#fff3bf; color:#e67700; border:1px solid #ffd43b; border-radius:4px; cursor:pointer; white-space:nowrap; height:32px;">📦</button>
                </div>
            </div>
            <div style="width: 40px; display:flex; align-items:flex-end;">
                <button type="button" class="btn btn-red" style="padding: 5px 10px; width:100%; height: 32px;" onclick="this.closest('.postavka-item').remove(); kalkulirajZneske()">X</button>
            </div>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
            <div style="flex: 1; min-width: 80px;">
                <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">Količina</label>
                <input type="text" class="p-kol" value="${data ? formatNumberJS(data.kolicina) : '1,00'}" style="width:100%; height:32px;" oninput="kalkulirajZneske()" required>
            </div>
            <div style="flex: 1; min-width: 80px;">
                <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">EM</label>
                <select class="p-em" style="width:100%; height:32px;">
                    <option value="kos" ${(!data || data.enota_mere === 'kos') ? 'selected' : ''}>kos</option>
                    <option value="h" ${data && data.enota_mere === 'h' ? 'selected' : ''}>h</option>
                    <option value="kg" ${data && data.enota_mere === 'kg' ? 'selected' : ''}>kg</option>
                    <option value="g" ${data && data.enota_mere === 'g' ? 'selected' : ''}>g</option>
                    <option value="t" ${data && data.enota_mere === 't' ? 'selected' : ''}>t</option>
                    <option value="l" ${data && data.enota_mere === 'l' ? 'selected' : ''}>l</option>
                    <option value="m" ${data && data.enota_mere === 'm' ? 'selected' : ''}>m</option>
                    <option value="m2" ${data && data.enota_mere === 'm2' ? 'selected' : ''}>m2</option>
                    <option value="m3" ${data && data.enota_mere === 'm3' ? 'selected' : ''}>m3</option>
                    <option value="km" ${data && data.enota_mere === 'km' ? 'selected' : ''}>km</option>
                    <option value="kpl" ${data && data.enota_mere === 'kpl' ? 'selected' : ''}>kpl</option>
                    <option value="dan" ${data && data.enota_mere === 'dan' ? 'selected' : ''}>dan</option>
                    <option value="mesec" ${data && data.enota_mere === 'mesec' ? 'selected' : ''}>mesec</option>
                    <option value="paušal" ${data && data.enota_mere === 'paušal' ? 'selected' : ''}>paušal</option>
                </select>
            </div>
            <div style="flex: 1.5; min-width: 100px;">
                <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">Cena / en.</label>
                <input type="text" class="p-cena" value="${data ? formatNumberJS(data.cena_enote, 4) : '0,00'}" style="width:100%; height:32px;" oninput="kalkulirajZneske()" required>
            </div>
            ${showPopust ? `
            <div style="flex: 1; min-width: 80px;">
                <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">Pop. %</label>
                <input type="number" step="0.01" class="p-popust" value="${data ? data.popust : 0}" style="width:100%; height:32px;" oninput="kalkulirajZneske()">
            </div>
            ` : ''}
            ${(window._isZavezanec || window._currentTip === 'prejeti_racuni' || window._currentTip === 'prejete_ponudbe') ? `
            <div style="flex: 1; min-width: 80px;">
                <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">DDV %</label>
                <select class="p-ddv" style="width:100%; height:32px;" onchange="kalkulirajZneske()">
                    <option value="22" ${(!data || data.stopnja_ddv === 22) ? 'selected' : ''}>22 %</option>
                    <option value="9.5" ${(data && data.stopnja_ddv === 9.5) ? 'selected' : ''}>9.5 %</option>
                    <option value="5" ${(data && data.stopnja_ddv === 5) ? 'selected' : ''}>5 %</option>
                    <option value="0" ${(data && data.stopnja_ddv === 0) ? 'selected' : ''}>0 %</option>
                </select>
            </div>
            ` : ''}
            <div style="flex: 1.5; min-width: 100px;">
                <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">Skupaj</label>
                <input type="text" class="p-znesek" value="${data ? formatNumberJS(data.znesek_skupaj) : '0,00'}" style="width:100%; height:32px; font-weight:bold; background:#e9ecef;" readonly>
            </div>
            <div style="flex: 1; min-width: 80px;">
                <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">Konto</label>
                <input type="text" class="p-konto" list="konti-datalist" style="width:100%; height:32px;" placeholder="npr. 760" value="${data ? (data.konto || '') : ''}">
            </div>
        </div>
    `;
    container.appendChild(div);
};

window.kalkulirajZneske = function() {
    let skupajValuta = 0;
    let sumBrezDDVValuta = 0;
    const tecaj = parseNumberJS(document.getElementById('d_tecaj')?.value || '1');
    const valuta = document.getElementById('d_valuta')?.value || 'EUR';

    document.querySelectorAll('#postavke-container .postavka-item').forEach(tr => {
        const kol = parseNumberJS(tr.querySelector('.p-kol').value);
        const cena = parseNumberJS(tr.querySelector('.p-cena').value);
        const popEl = tr.querySelector('.p-popust');
        const popust = popEl ? (parseNumberJS(popEl.value)) : 0;
        
        const ddvEl = tr.querySelector('.p-ddv');
        const ddv = ddvEl ? (parseNumberJS(ddvEl.value)) : 0;
        
        // Znesek v vrstici naj bo BRUTO (z DDV), da se ujema s predogledom in računom
        const netoZnesek = (kol * cena) * (1 - popust / 100);
        const brutoZnesek = netoZnesek * (1 + ddv / 100);
        
        tr.querySelector('.p-znesek').value = formatNumberJS(brutoZnesek);
        skupajValuta += brutoZnesek;
        sumBrezDDVValuta += netoZnesek;
    });

    const stotinska = parseNumberJS(document.getElementById('d_stotinska_izravnava')?.value || '0');
    skupajValuta += stotinska;

    const skupajEUR = skupajValuta * tecaj;
    let text = formatNumberJS(skupajEUR);
    if (valuta !== 'EUR') {
        text = `${formatNumberJS(skupajValuta)} ${valuta} (${formatNumberJS(skupajEUR)} EUR)`;
    }
    
    if (window._isZavezanec) {
        const brezDDVEUR = sumBrezDDVValuta * tecaj;
        const ddvEUR = skupajEUR - brezDDVEUR;
        text = `Brez DDV: ${formatNumberJS(brezDDVEUR)} | DDV: ${formatNumberJS(ddvEUR)} | Skupaj: ` + text;
    } else {
        text = `Skupaj: ` + text;
    }
    
    document.getElementById('skupaj-znesek').innerText = text;

    // Posodobimo tudi input polje "Znesek v EUR", če je vidno in ga uporabnik trenutno ne ureja
    const eurEl = document.getElementById('d_znesek_eur');
    if (eurEl && valuta !== 'EUR' && document.activeElement !== eurEl) {
        eurEl.value = formatNumberJS(skupajEUR);
    }

    if (window.updateDQR) window.updateDQR();
    if (window.osveziStatusPlacilaAuto) window.osveziStatusPlacilaAuto();
};

async function shraniDokument(e, tip, naslov, id = null) {
    e.preventDefault();
    window.kalkulirajZneske();
    
    const postavke = [];
    document.querySelectorAll('#postavke-container .postavka-item').forEach(tr => {
        const popEl = tr.querySelector('.p-popust');
        const ddvEl = tr.querySelector('.p-ddv');
        postavke.push({
            artikel_id: parseInt(tr.querySelector('.p-artikel-id').value) || null,
            opis: tr.querySelector('.p-opis').value,
            kolicina: parseNumberJS(tr.querySelector('.p-kol').value) || 1,
            enota_mere: tr.querySelector('.p-em').value,
            cena_enote: parseNumberJS(tr.querySelector('.p-cena').value) || 0,
            popust: popEl ? (parseNumberJS(popEl.value)) : 0,
            stopnja_ddv: ddvEl ? parseNumberJS(ddvEl.value) : 0,
            znesek_skupaj: parseNumberJS(tr.querySelector('.p-znesek').value) || 0,
            konto: tr.querySelector('.p-konto').value
        });
    });
    
    const tecaj = parseNumberJS(document.getElementById('d_tecaj')?.value || '1');
    const valuta = document.getElementById('d_valuta')?.value || 'EUR';
    let sumValuta = 0;
    let sumBrezDDV = 0;
    postavke.forEach(p => {
        sumValuta += p.znesek_skupaj;
        sumBrezDDV += p.znesek_skupaj / (1 + p.stopnja_ddv / 100);
    });
    const stotinskaValuta = parseNumberJS(document.getElementById('d_stotinska_izravnava')?.value || '0');
    sumValuta += stotinskaValuta;
    const sumEUR = sumValuta * tecaj;
    const sumBrezDDVEUR = sumBrezDDV * tecaj;
    const sumDDVEUR = sumEUR - sumBrezDDVEUR;

    const delnaPlacilaArray = [];
    const listEl = document.getElementById('delna_placila_list');
    if (listEl) {
        listEl.querySelectorAll('.delno-placilo-row').forEach(row => {
            const datum = parseDateISO(row.querySelector('.dp-datum').value);
            const nacin = row.querySelector('.dp-nacin').value;
            const znesek = parseNumberJS(row.querySelector('.dp-znesek').value) || 0;
            const sklic = row.querySelector('.dp-sklic').value.trim();
            const povezan_doc_id = parseInt(row.querySelector('.dp-povezan-doc-id')?.value) || null;
            delnaPlacilaArray.push({ datum, nacin, znesek, sklic, povezan_doc_id });
        });
    }

    const zakljucna_besedila = [];
    document.querySelectorAll('#d_zakljucno_container textarea').forEach(tx => {
        if(tx.value.trim()) zakljucna_besedila.push(tx.value.trim());
    });

    const payload = {
        poslovno_leto: getLeto(),
        tip: tip,
        stevilka: document.getElementById('d_stevilka').value,
        interna_stevilka: document.getElementById('d_interna_stevilka').value,
        partner_id: parseInt(document.getElementById('d_partner').value),
        datum_izdaje: parseDateISO(document.getElementById('d_datum_izdaje').value),
        datum_zapadlosti: parseDateISO(document.getElementById('d_datum_zapadlosti').value),
        znesek_brez_ddv: sumBrezDDVEUR,
        znesek_ddv: sumDDVEUR,
        znesek_skupaj: sumEUR,
        znesek_v_valuti: sumValuta,
        valuta: valuta,
        tecaj: tecaj,
        datum_storitve_od: parseDateISO(document.getElementById('d_datum_storitve_od')?.value || ""),
        datum_storitve_do: parseDateISO(document.getElementById('d_datum_storitve_do')?.value || ""),
        status: document.getElementById('d_status').value,
        datum_placila: parseDateISO(document.getElementById('d_datum_placila')?.value || ""),
        nacin_placila: document.getElementById('d_nacin_placila').value,
        sklic: document.getElementById('d_sklic')?.value.trim() || "",
        zakljucno_besedilo: zakljucna_besedila.join('\n\n'),
        noga_dokumenta: document.getElementById('d_noga') ? document.getElementById('d_noga').value : "",
        vkljuci_placilo: document.getElementById('d_vkljuci_placilo') ? document.getElementById('d_vkljuci_placilo').checked : true,
        odstotek_placila: document.getElementById('d_odstotek_placila') ? parseFloat(document.getElementById('d_odstotek_placila').value) : 100,
        kompenzacija_doc_id: window._selectedKompenzacijaDocId || null,
        delno_placano_znesek: parseNumberJS(document.getElementById('d_delno_placano_znesek')?.value || "0"),
        delna_placila: JSON.stringify(delnaPlacilaArray),
        stotinska_izravnava: stotinskaValuta,
        postavke: postavke
    };

    
    // Če urejamo, moramo poslati trenutno številko, da se ne spremeni
    if (id) {
        const titleText = titleEl.textContent;
        // Poskušamo izluščiti številko iz naslova (npr. "Uredi - Izdani računi (2026-001)")
        const match = titleText.match(/\(([^)]+)\)/);
        if (match) payload.stevilka = match[1];
    }
    
    const url = id ? `/api/dokumenti/${id}` : '/api/dokumenti';
    const method = id ? 'PUT' : 'POST';
    
    const res = await fetch(url, { method: method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    if (res.ok) {
        const saved = await res.json();
        const savedId = saved.id;
        // Osveži seznam v ozadju, nato pa znova odpri dokument v načinu urejanja
        if (window.refreshCurrentModule) window.refreshCurrentModule();
        try {
            const detajlRes = await fetch(`/api/dokumenti/detajl/${savedId}`);
            if (detajlRes.ok) {
                const detajl = await detajlRes.json();
                await showDodajDokument(tip, naslov, detajl);
            } else {
                window.zapriGlavniPopup();
            }
        } catch(e) {
            window.zapriGlavniPopup();
        }
    } else {
        const err = await res.json();
        alert("Napaka pri shranjevanju: " + (err.detail || res.statusText));
    }
}

async function brisiDokument(id, tip, naslov) {
    if (!confirm("Ali ste prepričani, da želite izbrisati ta dokument?")) return;
    try {
        const res = await fetch(`/api/dokumenti/${id}`, { method: 'DELETE' });
        if (res.ok) {
            renderDokumenti(tip, naslov);
        } else {
            const err = await res.json();
            alert("Napaka pri brisanju: " + (err.detail || res.statusText));
        }
    } catch (e) {
        alert("Napaka pri komunikaciji s strežnikom.");
    }
}

window.ustvariRacunIzPonudbe = async function(offerId) {
    if (!confirm("Ali želite iz te ponudbe ustvariti nov račun?")) return;
    try {
        const res = await fetch(`/api/dokumenti/detajl/${offerId}`);
        if (!res.ok) throw new Error("Ni mogoče pridobiti podatkov ponudbe.");
        const data = await res.json();
        
        // Pripravimo podatke za nov račun
        const newData = JSON.parse(JSON.stringify(data));
        delete newData.id; // Brišemo ID, da bo nov dokument
        newData.stevilka = ""; // Resetiramo številko, da se bo samodejno generirala za račun
        newData.tip = 'izdani_racuni';
        newData.status = 'neplačano';
        
        // Datumi
        const today = new Date().toISOString().split('T')[0];
        newData.datum_izdaje = today;
        
        const zap = new Date();
        zap.setDate(zap.getDate() + 8);
        newData.datum_zapadlosti = zap.toISOString().split('T')[0];

        // Prikažemo obrazec za nov račun
        showDodajDokument('izdani_racuni', 'Izdani računi', newData);
    } catch (e) {
        alert(e.message);
    }
};

window.ustvariPrejetRacunIzPonudbe = async function(offerId) {
    if (!confirm("Ali želite iz te prejete ponudbe ustvariti nov prejeti račun?")) return;
    try {
        const res = await fetch(`/api/dokumenti/detajl/${offerId}`);
        if (!res.ok) throw new Error("Ni mogoče pridobiti podatkov ponudbe.");
        const data = await res.json();
        
        // Pripravimo podatke za nov prejet račun
        const newData = JSON.parse(JSON.stringify(data));
        delete newData.id; // Brišemo ID, da bo nov dokument
        newData.stevilka = ""; // Resetiramo številko, da se bo vnesla ročno ali po želji
        newData.interna_stevilka = ""; // Resetiramo zaporedno številko, da se samodejno generira
        newData.tip = 'prejeti_racuni';
        newData.status = 'neplačano';
        
        // Datumi
        const today = new Date().toISOString().split('T')[0];
        newData.datum_izdaje = today;
        
        const zap = new Date();
        zap.setDate(zap.getDate() + 8);
        newData.datum_zapadlosti = zap.toISOString().split('T')[0];

        // Prikažemo obrazec za nov prejeti račun
        showDodajDokument('prejeti_racuni', 'Prejeti računi', newData);
    } catch (e) {
        alert(e.message);
    }
};

window.ustvariDelovniNalog = async function(docId) {
    if (!confirm("Ali želite iz tega dokumenta ustvariti nov delovni nalog?")) return;
    try {
        const res = await fetch(`/api/dokumenti/detajl/${docId}`);
        if (!res.ok) throw new Error("Ni mogoče pridobiti podatkov dokumenta.");
        const data = await res.json();
        
        const newData = JSON.parse(JSON.stringify(data));
        delete newData.id;
        newData.stevilka = "";
        newData.tip = 'delovni_nalogi';
        newData.status = 'neplačano';
        
        const today = new Date().toISOString().split('T')[0];
        newData.datum_izdaje = today;
        newData.datum_zapadlosti = today;

        showDodajDokument('delovni_nalogi', 'Delovni nalogi', newData);
    } catch (e) {
        alert(e.message);
    }
};

window.kopirajDokument = async function(id, tip, naslov) {
    if (!confirm("Ali želite kopirati ta dokument?")) return;
    try {
        const res = await fetch(`/api/dokumenti/detajl/${id}`);
        if (!res.ok) throw new Error("Ni mogoče pridobiti podatkov dokumenta.");
        const data = await res.json();
        
        // Pripravimo podatke za kopijo
        const newData = JSON.parse(JSON.stringify(data));
        delete newData.id; // Brišemo ID, da bo nov dokument
        newData.stevilka = ""; // Resetiramo številko, da se bo samodejno generirala
        newData.status = 'neplačano';
        newData.datum_placila = "";
        newData.nacin_placila = "";
        
        // Posodobimo datume na današnji dan oz. +8 dni
        const today = new Date().toISOString().split('T')[0];
        newData.datum_izdaje = today;
        
        const zap = new Date();
        zap.setDate(zap.getDate() + 8);
        newData.datum_zapadlosti = zap.toISOString().split('T')[0];

        // Prikažemo obrazec za nov dokument s temi podatki
        showDodajDokument(tip, naslov, newData);
    } catch (e) {
        alert(e.message);
    }
};
window.kalkulirajImportZneske = function() {
    let skupaj = 0;
    document.querySelectorAll('.import-p-row').forEach(tr => {
        const kol = parseNumberJS(tr.querySelector('.i-p-kol').value) || 0;
        const cena = parseNumberJS(tr.querySelector('.i-p-cena').value) || 0;
        const popEl = tr.querySelector('.i-p-popust');
        const popust = popEl ? (parseNumberJS(popEl.value) || 0) : 0;
        const ddvEl = tr.querySelector('.i-p-ddv');
        const ddv = ddvEl ? (parseNumberJS(ddvEl.value) || 0) : 0;
        
        const znesek = (kol * cena) * (1 - popust / 100) * (1 + ddv / 100);
        tr.querySelector('.i-p-znesek').value = formatNumberJS(znesek);
        skupaj += znesek;
    });
    const skupajEl = document.getElementById('import-skupaj-display');
    if (skupajEl) {
        skupajEl.value = formatNumberJS(skupaj);
        if (window.updateImportQR) window.updateImportQR();
    }
};

window.kalkulirajImportSkupajSamo = function() {
    let skupaj = 0;
    document.querySelectorAll('.import-p-row').forEach(tr => {
        const val = tr.querySelector('.i-p-znesek').value;
        const znesek = parseNumberJS(val) || 0;
        skupaj += znesek;
    });
    const skupajEl = document.getElementById('import-skupaj-display');
    if (skupajEl) {
        skupajEl.value = formatNumberJS(skupaj);
        if (window.updateImportQR) window.updateImportQR();
    }
};

window.dodajImportPostavko = function() {
    const container = document.getElementById('import-postavke-body');
    const div = document.createElement('div');
    div.className = 'import-p-row';
    div.style = "border: 1px solid var(--border-color); padding: 15px; border-radius: 6px; background: #f8f9fa;";
    div.innerHTML = `
        <div style="display:flex; gap:10px; margin-bottom:10px;">
            <div style="flex:1;">
                <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">Opis</label>
                <input type="text" class="i-p-opis" value="" style="width:100%" required>
            </div>
            <div style="width: 40px; display:flex; align-items:flex-end;">
                <button type="button" class="btn btn-red" style="padding: 5px 10px; width:100%; height: 32px;" onclick="this.closest('.import-p-row').remove(); window.kalkulirajImportZneske()">X</button>
            </div>
        </div>
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
            <div style="flex: 1; min-width: 80px;">
                <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">Količina</label>
                <input type="text" class="i-p-kol" value="1,00" style="width:100%; height:32px; text-align:right" oninput="window.kalkulirajImportZneske()" required>
            </div>
            <div style="flex: 1; min-width: 60px;">
                <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">EM</label>
                <select class="i-p-em" style="width:100%; height:32px;">
                    <option value="kos">kos</option>
                    <option value="h">h</option>
                    <option value="kg">kg</option>
                    <option value="l">l</option>
                    <option value="m">m</option>
                    <option value="kpl">kpl</option>
                </select>
            </div>
            <div style="flex: 1; min-width: 80px;">
                <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">Cena</label>
                <input type="text" class="i-p-cena" value="0,00" style="width:100%; height:32px; text-align:right" oninput="window.kalkulirajImportZneske()" required>
            </div>
            <div style="flex: 0.8; min-width: 60px;">
                <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">Rab. %</label>
                <input type="text" class="i-p-popust" value="0" style="width:100%; height:32px; text-align:right" oninput="window.kalkulirajImportZneske()">
            </div>
            <div style="flex: 0.8; min-width: 70px;">
                <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">DDV %</label>
                <select class="i-p-ddv" style="width:100%; height:32px;" onchange="window.kalkulirajImportZneske()">
                    <option value="22" selected>22 %</option>
                    <option value="9.5">9.5 %</option>
                    <option value="5">5 %</option>
                    <option value="0">0 %</option>
                </select>
            </div>
            <div style="flex: 1; min-width: 90px;">
                <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">Skupaj</label>
                <input type="text" class="i-p-znesek" value="0,00" style="width:100%; height:32px; text-align:right; font-weight:bold; border:1px solid #ced4da; border-radius:4px;" oninput="window.kalkulirajImportSkupajSamo()">
            </div>
        </div>
    `;
    container.appendChild(div);
};


async function showImportPreview(data) {
    const original_data = JSON.parse(JSON.stringify(data));
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    let partnerStatusHtml = '';
    const isSlovenian = (data.partner.drzava || 'Slovenija') === 'Slovenija';
    
    if (!data.partner_obstaja) {
        const p = data.partner;
        if (isSlovenian) {
            if (data.bizi_enriched) {
                partnerStatusHtml = `
                    <div class="warning-box" id="slov-bizi-warn-box" style="background:#fff8e1; border:1px solid #ffc107; border-radius:6px; padding:12px; margin-bottom:16px; color:#856404;">
                        <strong style="display:block; margin-bottom:6px;">⚠️ Partner ni v bazi — pred uvozom ga morate dodati!</strong>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; margin-top:8px; font-size:0.9rem; color:#5a3e00;">
                            <div><span style="color:#888;">Naziv (Bizi):</span> <strong>${p.naziv || '—'}</strong></div>
                            <div><span style="color:#888;">Davčna:</span> ${p.davcna_stevilka || '—'}</div>
                            <div><span style="color:#888;">Ulica:</span> ${p.ulica || '—'}</div>
                            <div><span style="color:#888;">Pošta/Kraj:</span> ${p.postna_stevilka || ''} ${p.kraj || '—'}</div>
                            <div><span style="color:#888;">IBAN:</span> ${p.trr || '—'}</div>
                            <div><span style="color:#888;">Zavezanec:</span> ${p.zavezanec_za_ddv ? 'Da' : 'Ne'}</div>
                        </div>
                        <p style="margin-top:8px; font-size:0.85rem;">
                            Kliknite <strong>+ Nov partner</strong> (zgoraj desno) in ga dodajte prek Bizi.si, ali pa poiščite obstoječega v iskalnem polju pod "Dobavitelj".
                        </p>
                    </div>
                `;
            } else {
                partnerStatusHtml = `
                    <div class="warning-box" id="slov-bizi-error-box" style="background:#fff5f5; border:1px solid #ffc9c9; border-radius:6px; padding:12px; margin-bottom:16px; color:#c92a2a;">
                        <strong>⚠️ Partner ne obstaja v bazi in ni bil najden na Bizi.si!</strong>
                        <p style="margin-top:6px; font-size:0.9rem; line-height:1.4;">
                            Prosimo, poiščite in izberite obstoječega partnerja ali kliknite <strong>+ Nov partner</strong> (zgoraj desno), da ga dodate prek Bizi.si ali ročno.
                        </p>
                    </div>
                `;
            }
        } else {
            // Tuji partner
            if (p.tuji_partner_neprebran || !p.naziv) {
                partnerStatusHtml = `
                    <div class="warning-box" id="foreign-manual-box" style="background:#f8f9fa; border:1px solid #4c6ef5; border-radius:6px; padding:15px; margin-bottom:16px;">
                        <strong style="color:#364fc7; display:block; margin-bottom:8px;">🌍 Tuj partner — vnesite podatke ročno</strong>
                        <p style="font-size:0.85rem; color:#495057; margin-bottom:12px;">Podatkov o tujem partnerju ni bilo mogoče prebrati iz računa. Prosimo, vnesite jih ročno:</p>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                            <div>
                                <label style="font-size:0.75rem; color:#495057; font-weight:bold; display:block; margin-bottom:3px;">Naziv partnerja *</label>
                                <input type="text" id="manual_p_naziv" placeholder="npr. Artlist UK Ltd" style="width:100%; padding:5px 8px; border:1px solid #ced4da; border-radius:4px;" oninput="window.validateManualForeignPartner()">
                            </div>
                            <div>
                                <label style="font-size:0.75rem; color:#495057; font-weight:bold; display:block; margin-bottom:3px;">Država *</label>
                                <input type="text" id="manual_p_drzava" placeholder="npr. Velika Britanija" style="width:100%; padding:5px 8px; border:1px solid #ced4da; border-radius:4px;" oninput="window.validateManualForeignPartner()">
                            </div>
                            <div>
                                <label style="font-size:0.75rem; color:#495057; display:block; margin-bottom:3px;">Ulica in hišna št.</label>
                                <input type="text" id="manual_p_ulica" placeholder="Gordon House, Barrow Street" style="width:100%; padding:5px 8px; border:1px solid #ced4da; border-radius:4px;">
                            </div>
                            <div>
                                <label style="font-size:0.75rem; color:#495057; display:block; margin-bottom:3px;">Kraj / Mesto</label>
                                <input type="text" id="manual_p_kraj" placeholder="Dublin" style="width:100%; padding:5px 8px; border:1px solid #ced4da; border-radius:4px;">
                            </div>
                            <div>
                                <label style="font-size:0.75rem; color:#495057; display:block; margin-bottom:3px;">Davčna / VAT ID</label>
                                <input type="text" id="manual_p_davcna" placeholder="GB38819..." style="width:100%; padding:5px 8px; border:1px solid #ced4da; border-radius:4px;">
                            </div>
                            <div>
                                <label style="font-size:0.75rem; color:#495057; display:block; margin-bottom:3px;">IBAN / TRR</label>
                                <input type="text" id="manual_p_trr" placeholder="IBAN..." style="width:100%; padding:5px 8px; border:1px solid #ced4da; border-radius:4px;">
                            </div>
                        </div>
                    </div>
                `;
            } else {
                // Tuj partner, prebran iz računa — a ni v bazi, zahtevamo akcijo
                partnerStatusHtml = `
                    <div class="warning-box" style="background:#fff8e1; border:1px solid #ffc107; border-radius:6px; padding:12px; margin-bottom:16px; color:#856404;">
                        <strong style="display:block; margin-bottom:4px;">🌍 Tuj partner ni v bazi — pred uvozom ga morate dodati!</strong>
                        <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; margin-top:8px; font-size:0.9rem;">
                            <div><span style="color:#888;">Naziv:</span> <strong>${p.naziv || '—'}</strong></div>
                            <div><span style="color:#888;">Država:</span> <strong>${p.drzava || '—'}</strong></div>
                            <div><span style="color:#888;">Ulica:</span> ${p.ulica || '—'}</div>
                            <div><span style="color:#888;">Pošta/Kraj:</span> ${p.postna_stevilka || ''} ${p.kraj || '—'}</div>
                            <div><span style="color:#888;">Davčna:</span> ${p.davcna_stevilka || '—'}</div>
                        </div>
                        <p style="margin-top:8px; font-size:0.85rem;">
                            Kliknite <strong>+ Nov partner</strong> (zgoraj desno) in ga dodajte ročno, ali pa poiščite obstoječega v iskalnem polju pod "Dobavitelj".
                        </p>
                    </div>
                `;
            }
        }
    }

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Pregled uvoza e-SLOG</h3>
                <button class="btn btn-close-import" style="background:none; color:var(--text-main); font-size:1.5rem;">&times;</button>
            </div>
            
            ${window.llamaLearningMode ? `
                <div class="llama-learning-banner" style="background: linear-gradient(135deg, #e7f5ff, #d0ebff); border: 1px solid #74c0fc; border-radius: 8px; padding: 15px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 15px; box-shadow: 0 4px 12px rgba(28, 126, 214, 0.08);">
                    <div style="display: flex; gap: 12px; align-items: center; text-align: left;">
                        <span style="font-size: 1.8rem; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">🤖</span>
                        <div>
                            <h4 style="margin: 0; color: #1971c2; font-size: 0.95rem; font-weight: bold;">Način učenja Llama je AKTIVEN</h4>
                            <p style="margin: 3px 0 0 0; color: #343a40; font-size: 0.82rem; line-height: 1.4;">Preverite polja. Če so pravilna, kliknite gumb desno. Če niso, jih popravite in kliknite <strong>Potrdi uvoz</strong> spodaj.</p>
                        </div>
                    </div>
                    <button class="btn btn-blue" id="btn-llama-accurate" style="background: #228be6; color: white; border: none; padding: 8px 16px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: all 0.2s; white-space: nowrap;" onclick="window._llamaMarkAccurateAndConfirm(this)">Da, podatki so natančni! ✓</button>
                </div>
            ` : ''}

            ${partnerStatusHtml}
            
            <div style="display:grid; grid-template-columns: 2.2fr 1fr; gap: 20px; margin-bottom: 20px;">
                <!-- Left: Form Fields -->
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                    <div>
                        <label style="color:var(--text-muted); font-size:0.8rem;">ŠTEVILKA RAČUNA</label>
                        <input type="text" id="import-stevilka" value="${data.stevilka || ''}" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px; font-weight:bold;" oninput="if(window.__checkImportDup) window.__checkImportDup(this.value); if(window.updateImportQR) window.updateImportQR();">
                        <div id="import-dup-warn" style="display:none; background:#fff3cd;border:1px solid #ffc107;border-radius:4px;padding:6px 10px;font-size:0.82rem;color:#856404;margin-top:4px;"></div>
                    </div>
                    <div>
                        <label style="color:var(--text-muted); font-size:0.8rem;">DOBAVITELJ</label>
                        <div style="display:flex; align-items:center; gap:12px;">
                            <span id="import-partner-display" style="font-weight:bold; flex:1;">${data.partner.naziv || 'Neznan partner'}</span>
                            <div style="display:flex; flex-direction:column; gap:4px; align-items:stretch;">
                                <button class="btn" style="padding:2px 8px; font-size:0.75rem; background:#e9ecef; color:#495057; border:1px solid #ced4da; width:100%; white-space:nowrap;" onclick="document.getElementById('import-partner-search-box').style.display='block'; this.style.display='none';">Spremeni</button>
                                <button class="btn btn-blue" style="padding:2px 8px; font-size:0.75rem; width:100%; white-space:nowrap;" onclick="window._partnerPopupTargetSelect = 'IMPORT_MODAL'; window.odpriPartnerPopup(null);">+ Nov partner</button>
                            </div>
                        </div>
                        <div id="import-partner-search-box" style="display:none; margin-top:5px;">
                            <input type="text" id="import-partner-search-input" placeholder="Išči obstoječega partnerja..." style="width:100%; padding:5px; font-size:0.85rem; border:1px solid var(--primary-blue); border-radius:4px;">
                            <p style="font-size:0.7rem; color:#888; margin-top:2px;">Izberite obstoječega partnerja ali dodajte novega prek gumba + Nov partner.</p>
                        </div>
                        <p id="import-partner-tax" style="font-size:0.9rem;">Davčna: ${data.partner.davcna_stevilka || '—'}</p>
                    </div>
                    <div>
                        <label style="color:var(--text-muted); font-size:0.8rem;">DATUM IZDAJE</label>
                        <input type="date" id="import-datum-izdaje" value="${data.datum_izdaje || ''}" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px;" onchange="if(window.updateImportQR) window.updateImportQR();">
                    </div>
                    <div>
                        <label style="color:var(--text-muted); font-size:0.8rem;">DATUM ZAPADLOSTI</label>
                        <input type="date" id="import-datum-zapadlosti" value="${data.datum_zapadlosti || ''}" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px;">
                    </div>
                    <div>
                        <label style="color:var(--text-muted); font-size:0.8rem;">DATUM STORITVE (OD)</label>
                        <input type="date" id="import-datum-storitve-od" value="${data.datum_storitve_od || data.datum_storitve || ''}" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px;">
                    </div>
                    <div>
                        <label style="color:var(--text-muted); font-size:0.8rem;">DATUM STORITVE (DO)</label>
                        <input type="date" id="import-datum-storitve-do" value="${data.datum_storitve_do || data.datum_storitve_od || data.datum_storitve || ''}" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px;">
                    </div>
                    <div>
                        <label style="color:var(--text-muted); font-size:0.8rem;">SKLIC ZA PLAČILO</label>
                        <input type="text" id="import-sklic" value="${data.sklic || ''}" placeholder="npr. SI12 12345-12345" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px; font-weight:bold;" oninput="if(window.updateImportQR) window.updateImportQR();">
                    </div>
                    <div>
                        <label style="color:var(--text-muted); font-size:0.8rem;">SKUPAJ ZA PLAČILO</label>
                        <input type="text" id="import-skupaj-display" value="${formatNumberJS(data.znesek_skupaj)}" style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px; font-weight:bold; color:var(--primary-red); font-size:1.1rem; text-align:right;" oninput="if(window.updateImportQR) window.updateImportQR();">
                    </div>
                </div>
                <!-- Right: QR Code Visualizer -->
                <div style="border:1px solid #dee2e6; border-radius:8px; padding:15px; background:#fff; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
                    <span style="font-size:0.8rem; font-weight:bold; color:var(--primary-blue); margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">UPN-QR plačilo</span>
                    <div id="import-qr-code" style="width:160px; height:160px; background:#f8f9fa; border:1px dashed #ced4da; border-radius:4px; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                        <span style="font-size:0.75rem; color:#868e96; padding:10px;">Pripravljam QR...</span>
                    </div>
                    <div id="import-qr-info" style="font-size:0.7rem; color:#495057; margin-top:8px; width:100%;">
                        <p id="import-qr-iban" style="margin:2px 0; font-weight:bold; word-break:break-all; font-family:monospace; color:#333;"></p>
                        <p id="import-qr-sklic" style="margin:2px 0; font-family:monospace; font-size:0.8rem; font-weight:bold; color:var(--primary-red);"></p>
                    </div>
                </div>
            </div>

            <div style="background:#f1f3f5; padding:15px; border-radius:6px; margin-bottom:20px; border:1px solid #dee2e6;">
                <label style="display:block; margin-bottom:5px; font-weight:bold; color:var(--primary-blue); font-size:0.9rem;">Dodatne možnosti</label>
                <div style="margin-bottom:10px;">
                    <label style="color:var(--text-muted); font-size:0.8rem;">Konto za vse postavke (neobvezno)</label>
                    <input type="text" id="import-global-konto" list="konti-datalist" placeholder="Vpišite konto za vse vrstice..." style="width:100%; padding:8px; border:1px solid #ced4da; border-radius:4px;">
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <input type="checkbox" id="import-is-paid" style="width:18px; height:18px;" ${data.placano ? 'checked' : ''}>
                    <label for="import-is-paid" style="font-weight:bold; cursor:pointer;">Račun je že plačan (Poslovna kartica)</label>
                </div>
                <p style="margin-top:5px; font-size:0.75rem; color:#666;">Če označite "Plačano", bo sistem nastavil status na plačano in način plačila na "Poslovna kartica".</p>
            </div>

            <h4>Postavke</h4>
            <div id="import-postavke-body" style="display:flex; flex-direction:column; gap:10px; margin-top:10px;">
                    ${data.postavke.map(p => `
                        <div class="import-p-row" style="border: 1px solid var(--border-color); padding: 15px; border-radius: 6px; background: #f8f9fa;">
                            <div style="display:flex; gap:10px; margin-bottom:10px;">
                                <div style="flex:1;">
                                    <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">Opis</label>
                                    <input type="text" class="i-p-opis" value="${p.opis}" style="width:100%" required>
                                </div>
                                <div style="width: 40px; display:flex; align-items:flex-end;">
                                    <button type="button" class="btn btn-red" style="padding: 5px 10px; width:100%; height: 32px;" onclick="this.closest('.import-p-row').remove(); window.kalkulirajImportZneske()">X</button>
                                </div>
                            </div>
                            <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end;">
                                <div style="flex: 1; min-width: 80px;">
                                    <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">Količina</label>
                                    <input type="text" class="i-p-kol" value="${formatNumberJS(p.kolicina)}" style="width:100%; height:32px; text-align:right" oninput="window.kalkulirajImportZneske()" required>
                                </div>
                                <div style="flex: 1; min-width: 60px;">
                                    <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">EM</label>
                                    <select class="i-p-em" style="width:100%; height:32px;">
                                        <option value="kos" ${(!p.enota_mere || p.enota_mere === 'kos') ? 'selected' : ''}>kos</option>
                                        <option value="h" ${p.enota_mere === 'h' ? 'selected' : ''}>h</option>
                                        <option value="kg" ${p.enota_mere === 'kg' ? 'selected' : ''}>kg</option>
                                        <option value="l" ${p.enota_mere === 'l' ? 'selected' : ''}>l</option>
                                        <option value="m" ${p.enota_mere === 'm' ? 'selected' : ''}>m</option>
                                        <option value="kpl" ${p.enota_mere === 'kpl' ? 'selected' : ''}>kpl</option>
                                    </select>
                                </div>
                                <div style="flex: 1; min-width: 80px;">
                                    <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">Cena</label>
                                    <input type="text" class="i-p-cena" value="${formatNumberJS(p.cena_enote, 4)}" style="width:100%; height:32px; text-align:right" oninput="window.kalkulirajImportZneske()" required>
                                </div>
                                <div style="flex: 0.8; min-width: 60px;">
                                    <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">Rab. %</label>
                                    <input type="text" class="i-p-popust" value="${p.popust || 0}" style="width:100%; height:32px; text-align:right" oninput="window.kalkulirajImportZneske()">
                                </div>
                                <div style="flex: 0.8; min-width: 70px;">
                                    <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">DDV %</label>
                                    <select class="i-p-ddv" style="width:100%; height:32px;" onchange="window.kalkulirajImportZneske()">
                                        <option value="22" ${(!p.stopnja_ddv || p.stopnja_ddv === 22) ? 'selected' : ''}>22 %</option>
                                        <option value="9.5" ${p.stopnja_ddv === 9.5 ? 'selected' : ''}>9.5 %</option>
                                        <option value="5" ${p.stopnja_ddv === 5 ? 'selected' : ''}>5 %</option>
                                        <option value="0" ${p.stopnja_ddv === 0 ? 'selected' : ''}>0 %</option>
                                    </select>
                                </div>
                                <div style="flex: 1; min-width: 90px;">
                                    <label style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:3px;">Skupaj</label>
                                    <input type="text" class="i-p-znesek" value="${formatNumberJS(p.znesek_skupaj)}" style="width:100%; height:32px; text-align:right; font-weight:bold; border:1px solid #ced4da; border-radius:4px;" oninput="window.kalkulirajImportSkupajSamo()">
                                </div>
                            </div>
                        </div>
                    `).join('')}
            </div>
            <button class="btn btn-blue" style="margin-top:5px; font-size:0.8rem; padding:4px 8px;" onclick="window.dodajImportPostavko()">+ Dodaj vrstico</button>

            <div class="modal-footer">
                <button class="btn btn-close-import" style="background:#6c757d; margin-right:10px;">Prekliči</button>
                <button class="btn btn-blue" id="btn-confirm-import">Potrdi uvoz</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Funkcija za preverjanje podvojenih številk
    window.__checkImportDup = async (stevilka) => {
        if (!stevilka || stevilka === 'Neznano') return;
        try {
            const res = await fetch(`/api/dokumenti/check_stevilka?stevilka=${encodeURIComponent(stevilka)}&tip=prejeti_racuni`);
            const check = await res.json();
            const warnEl = document.getElementById('import-dup-warn');
            if (warnEl) {
                if (check.obstaja) {
                    warnEl.style.display = 'block';
                    warnEl.innerHTML = `⚠️ Dokument s to številko (<strong>${stevilka}</strong>) je bil že uvožen (ID #${check.id}). Preverite, da ne uvažate duplikata!`;
                } else {
                    warnEl.style.display = 'none';
                }
            }
        } catch(e) {}
    };

    // Avtomatsko preveri podvojeno stevilko ob odprtju
    (async () => {
        if (data.stevilka) await window.__checkImportDup(data.stevilka);
    })();

    // Nastavi potrditveni gumb glede na uvoz Bizi
    window.validateManualForeignPartner = () => {
        const name = document.getElementById('manual_p_naziv')?.value.trim();
        const country = document.getElementById('manual_p_drzava')?.value.trim();
        const btn = document.getElementById('btn-confirm-import');
        if (btn) {
            if (name && country) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            } else {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        }
    };

    // Gumba ne bomo onemogočali ob odprtju (uporabnika bomo ob kliku vprašali za kreacijo partnerja, če ne obstaja)
    setTimeout(() => {
        const btn = document.getElementById('btn-confirm-import');
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.cursor = 'pointer';
        }
        if (window.updateImportQR) window.updateImportQR();
    }, 100);

    return new Promise((resolve) => {
        const closeImportModal = () => {
            modal.remove();
            resolve(false);
        };

        // Gumb Prekliči in X v glavi
        modal.querySelectorAll('.btn-close-import').forEach(btn => {
            btn.addEventListener('click', closeImportModal);
        });

        // UPN-QR Code generator za import modal
        window.updateImportQR = function() {
            try {
                const trr = (data.partner && data.partner.trr || "").replace(/\s+/g, "");
                const sklic_input = document.getElementById('import-sklic')?.value.trim() || "";
                const znesek_input = document.getElementById('import-skupaj-display')?.value || "0";
                const znesek = parseNumberJS(znesek_input) || 0;
                
                const ibanEl = document.getElementById('import-qr-iban');
                const sklicEl = document.getElementById('import-qr-sklic');
                const qrDiv = document.getElementById('import-qr-code');
                
                if (!qrDiv) return;
                
                if (!trr) {
                    if (ibanEl) ibanEl.textContent = "Brez TRR prejemnika";
                    if (sklicEl) sklicEl.textContent = "";
                    qrDiv.innerHTML = '<span style="font-size:0.75rem; color:#868e96; padding:10px;">Vnesite TRR partnerja za QR</span>';
                    return;
                }
                
                if (ibanEl) ibanEl.textContent = "TRR: " + data.partner.trr;
                if (sklicEl) sklicEl.textContent = "Sklic: " + (sklic_input || "SI99");
                
                const cents = Math.round(znesek * 100);
                const amountStr = cents.toString().padStart(11, '0');
                
                const fields = [
                    "UPNQR",                  // 1. Identifikator
                    "",                       // 2. IBAN plačnika
                    "",                       // 3. Polog gotovine
                    "",                       // 4. Koda valute
                    "",                       // 5. Znesek
                    "Plačnik",                // 6. Ime plačnika
                    "Naslov plačnika",        // 7. Naslov plačnika
                    "Kraj plačnika",          // 8. Kraj plačnika
                    amountStr,                // 9. Znesek
                    "",                       // 10. Datum plačila
                    "",                       // 11. Nujno
                    "OTHR",                   // 12. Koda namena
                    `PLAČILO RAČUNA ${document.getElementById('import-stevilka')?.value || ''}`.substring(0, 42).trim(), // 13. Namen
                    "",                       // 14. Rok plačila
                    trr,                      // 15. IBAN prejemnika
                    sklic_input || "SI99",    // 16. Sklic prejemnika
                    (data.partner.naziv || "Prejemnik").substring(0, 40), // 17. Ime prejemnika
                    (data.partner.ulica || "").substring(0, 40), // 18. Naslov prejemnika
                    ((data.partner.postna_stevilka || "") + " " + (data.partner.kraj || "Slovenija")).substring(0, 40).trim() // 19. Kraj prejemnika
                ];
                
                const rawBody = fields.join('\n') + '\n';
                const totalLen = rawBody.length + 3;
                const qrData = rawBody + totalLen.toString().padStart(3, '0');
                
                qrDiv.innerHTML = '';
                if (window.QRCode) {
                    try {
                        new QRCode(qrDiv, {
                            text: qrData,
                            width: 160,
                            height: 160,
                            correctLevel: QRCode.CorrectLevel.M
                        });
                    } catch(e) {
                        const encodedData = encodeURIComponent(qrData);
                        qrDiv.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodedData}&size=160x160" alt="QR Code" style="width:160px; height:160px;">`;
                    }
                } else {
                    const encodedData = encodeURIComponent(qrData);
                    qrDiv.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodedData}&size=160x160" alt="QR Code" style="width:160px; height:160px;">`;
                }
            } catch(err) {
                console.error("QR preview error:", err);
            }
        };

        // Funkcija za posodobitev UI po izbiri ali kreaciji partnerja
        window.__importUpdatePartner = (p) => {
            data.partner = {
                id: p.id,
                naziv: p.naziv,
                davcna_stevilka: p.davcna_stevilka,
                ulica: p.ulica,
                postna_stevilka: p.postna_stevilka,
                kraj: p.kraj,
                drzava: p.drzava,
                trr: p.trr,
                email: p.email,
                telefon: p.telefon,
                zavezanec_za_ddv: p.zavezanec_za_ddv
            };
            data.partner_obstaja = true;
            
            document.getElementById('import-partner-display').innerText = p.naziv;
            document.getElementById('import-partner-tax').innerText = `Davčna: ${p.davcna_stevilka || '—'}`;
            const searchBox = document.getElementById('import-partner-search-box');
            if (searchBox) searchBox.style.display = 'none';
            const spreBtn = document.querySelector('button[onclick*="import-partner-search-box"]');
            if (spreBtn) spreBtn.style.display = 'inline-block';
            
            const warnBox = modal.querySelector('.warning-box');
            if (warnBox) warnBox.style.display = 'none';
            
            // Omogoči gumb za potrditev, ker partner zdaj obstaja
            const btn = document.getElementById('btn-confirm-import');
            if (btn) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            }
            if (window.updateImportQR) window.updateImportQR();
        };

        // Inicializacija iskanja partnerja
        const searchInput = document.getElementById('import-partner-search-input');
        if (searchInput) {
            window.initPartnerSearch(searchInput, null, window.__importUpdatePartner);
        }

        document.getElementById('btn-confirm-import').onclick = async () => {
            const btn = document.getElementById('btn-confirm-import');
            
            // Preverimo, da partner obstaja (razen ročni vnos tujega partnerja). Če ne obstaja, ponudimo samodejno kreacijo.
            const isForeignManual = !isSlovenian && (data.partner.tuji_partner_neprebran || !data.partner.naziv);
            if (!data.partner_obstaja && !isForeignManual) {
                if (data.partner && data.partner.naziv) {
                    if (confirm(`Partner "${data.partner.naziv}" ne obstaja v bazi. Ali ga želite samodejno dodati v šifrant in nadaljevati z uvozom?`)) {
                        try {
                            const res = await fetch('/api/partnerji', {
                                method: 'POST',
                                headers: {'Content-Type': 'application/json'},
                                body: JSON.stringify({
                                    naziv: data.partner.naziv,
                                    ulica: data.partner.ulica || '',
                                    postna_stevilka: data.partner.postna_stevilka || '',
                                    kraj: data.partner.kraj || '',
                                    drzava: data.partner.drzava || 'Slovenija',
                                    davcna_stevilka: data.partner.davcna_stevilka || '',
                                    trr: data.partner.trr || '',
                                    email: data.partner.email || '',
                                    telefon: data.partner.telefon || '',
                                    zavezanec_za_ddv: !!data.partner.zavezanec_za_ddv,
                                    vrsta: 'oba'
                                })
                            });
                            if (res.ok) {
                                const savedPartner = await res.json();
                                window.__importUpdatePartner(savedPartner);
                            } else {
                                alert('Napaka pri samodejnem ustvarjanju partnerja.');
                                return;
                            }
                        } catch (e) {
                            alert('Napaka pri povezavi s strežnikom za ustvarjanje partnerja.');
                            return;
                        }
                    } else {
                        return; // Uporabnik je preklical uvoz/kreacijo
                    }
                } else {
                    alert('Najprej izberite partnerja ali dodajte novega.');
                    return;
                }
            }

            // Ročni vnos tujega partnerja
            if (!data.partner_obstaja && isForeignManual) {
                data.partner = {
                    naziv: document.getElementById('manual_p_naziv').value.trim(),
                    drzava: document.getElementById('manual_p_drzava').value.trim(),
                    ulica: document.getElementById('manual_p_ulica').value.trim(),
                    kraj: document.getElementById('manual_p_kraj').value.trim(),
                    postna_stevilka: "",
                    davcna_stevilka: document.getElementById('manual_p_davcna').value.trim(),
                    trr: document.getElementById('manual_p_trr').value.trim(),
                    telefon: "",
                    email: "",
                    zavezanec_za_ddv: false
                };
            }

            // Preberemo spremenjene datume, številko računa in sklic
            data.stevilka = document.getElementById('import-stevilka').value.trim();
            data.datum_izdaje = document.getElementById('import-datum-izdaje').value;
            data.datum_zapadlosti = document.getElementById('import-datum-zapadlosti').value;
            data.datum_storitve_od = document.getElementById('import-datum-storitve-od').value;
            data.datum_storitve_do = document.getElementById('import-datum-storitve-do').value;
            data.datum_storitve = data.datum_storitve_od;
            data.sklic = document.getElementById('import-sklic').value.trim();

            const globalKonto = document.getElementById('import-global-konto').value.trim();
            const isPaid = document.getElementById('import-is-paid').checked;
            
            // Ponovno preberi postavke iz tabele
            const novePostavke = [];
            let novSkupaj = 0;
            let novBrezDDV = 0;
            document.querySelectorAll('.import-p-row').forEach((tr, idx) => {
                const opis = tr.querySelector('.i-p-opis').value;
                const kol = parseNumberJS(tr.querySelector('.i-p-kol').value) || 1;
                const em = tr.querySelector('.i-p-em').value || 'kos';
                const cena = parseNumberJS(tr.querySelector('.i-p-cena').value) || 0;
                const popust = parseNumberJS(tr.querySelector('.i-p-popust').value) || 0;
                const stopnja = parseNumberJS(tr.querySelector('.i-p-ddv').value);
                
                const znesekSkupajVrstica = parseNumberJS(tr.querySelector('.i-p-znesek').value) || 0;
                const netoVrstica = znesekSkupajVrstica / (1 + stopnja / 100);
                
                novePostavke.push({
                    opis: opis,
                    kolicina: kol,
                    enota_mere: em,
                    cena_enote: cena,
                    popust: popust,
                    stopnja_ddv: stopnja,
                    znesek_skupaj: Math.round(znesekSkupajVrstica * 100) / 100,
                    konto: globalKonto || ""
                });
                novSkupaj += znesekSkupajVrstica;
                novBrezDDV += netoVrstica;
            });
            data.postavke = novePostavke;
            
            const skupajOverridden = parseNumberJS(document.getElementById('import-skupaj-display').value) || 0;
            data.znesek_skupaj = Math.round(skupajOverridden * 100) / 100;
            
            if (Math.abs(skupajOverridden - novSkupaj) > 0.01 && novSkupaj > 0) {
                const ratio = skupajOverridden / novSkupaj;
                data.znesek_brez_ddv = Math.round((novBrezDDV * ratio) * 100) / 100;
                data.znesek_ddv = Math.round((data.znesek_skupaj - data.znesek_brez_ddv) * 100) / 100;
            } else {
                data.znesek_brez_ddv = Math.round(novBrezDDV * 100) / 100;
                data.znesek_ddv = Math.round((novSkupaj - novBrezDDV) * 100) / 100;
            }
            
            data.placan = isPaid;

            const originalText = btn.innerText;
            btn.disabled = true;
            btn.innerText = "Uvažam...";

            // Če je način učenja aktiven, dodamo ocr_text in original_data
            if (window.llamaLearningMode) {
                data.ocr_text = original_data.ocr_text || "";
                data.original_data = original_data;
            }

            try {
                const res = await fetch('/api/dokumenti/import_eslog_potrdi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (res.ok) {
                    const result = await res.json();
                    modal.remove();
                    resolve(result.id);
                } else {
                    const err = await res.json();
                    alert("Napaka pri potrditvi uvoza: " + (err.detail || "Neznana napaka"));
                    btn.disabled = false;
                    btn.innerText = originalText;
                }
            } catch (e) {
                alert("Napaka pri komunikaciji s strežnikom.");
                btn.disabled = false;
                btn.innerText = originalText;
            }
        };
    });
}

window.uvoziEslog = async function(input, currentTip = 'prejeti_racuni', currentNaslov = 'Prejeti računi') {
    if (!input.files || input.files.length === 0) return;
    
    const btn = document.querySelector('button[onclick*="eslog-upload"]');
    const originalBtnText = btn.innerText;
    btn.innerText = "Berem datoteke in pripravljam predogled...";
    btn.disabled = true;
    
    try {
        let combinedItems = [];
        
        for (let i = 0; i < input.files.length; i++) {
            const file = input.files[i];
            const formData = new FormData();
            formData.append('file', file);
            
            try {
                const res = await fetch('/api/dokumenti/import_eslog_pregled', {
                    method: 'POST',
                    body: formData
                });
                
                if (!res.ok) {
                    const err = await res.json();
                    console.error(`Napaka pri branju datoteke ${file.name}:`, err.detail || "Neznana napaka");
                    continue;
                }
                
                const result = await res.json();
                if (result.items && result.items.length > 0) {
                    result.items.forEach(item => {
                        item.tip = currentTip;
                    });
                    combinedItems = combinedItems.concat(result.items);
                }
            } catch (fileErr) {
                console.error(`Napaka pri pošiljanju datoteke ${file.name}:`, fileErr);
            }
        }
        
        if (combinedItems.length === 0) {
            alert("Nobenega računa ni bilo mogoče uspešno prebrati.");
            return;
        }
        
        if (combinedItems.length > 1) {
            if (window.llamaLearningMode) {
                alert(`Način učenja Llama je vklopljen. Zdaj boste ročno pregledali in potrdili vsakega od ${combinedItems.length} dokumentov posebej.`);
                for (let j = 0; j < combinedItems.length; j++) {
                    const data = combinedItems[j];
                    const docId = await showImportPreview(data);
                }
                renderDokumenti(currentTip, currentNaslov);
            } else {
                await showBulkImportPreview(combinedItems, currentTip);
            }
        } else {
            const data = combinedItems[0];
            const docId = await showImportPreview(data);
            if (docId) {
                const editRes = await fetch(`/api/dokumenti/detajl/${docId}`);
                if (editRes.ok) {
                    const editData = await editRes.json();
                    if (editData.poslovno_leto && editData.poslovno_leto !== getLeto()) {
                        document.getElementById('poslovno-leto').value = editData.poslovno_leto;
                    }
                    titleEl.textContent = currentNaslov;
                    await showDodajDokument(currentTip, currentNaslov, editData);
                } else {
                    renderDokumenti(currentTip, currentNaslov);
                }
            }
        }
    } catch (e) {
        console.error(e);
        alert("Napaka pri komunikaciji s strežnikom.");
    } finally {
        btn.innerText = originalBtnText;
        btn.disabled = false;
        input.value = ""; // Reset input
    }
};


// --- IZPISKI ---
async function renderIzpiski() {
    titleEl.textContent = "Bančni izpiski";
    contentDiv.innerHTML = '<p>Nalagam...</p>';
    try {
        const res = await fetch('/api/izpiski');
        const data = await res.json();
        
        const sortFields = [
            {key: 'datum', label: 'Datum izpiska'},
            {key: 'stevilka', label: 'Številka izpiska'},
            {key: 'znesek_skupaj', label: 'Znesek'},
            {key: 'status', label: 'Status'}
        ];

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
                <h2 style="margin:0; color:var(--primary-blue);">Bančni izpiski</h2>
                <div style="display: flex; gap: 15px; align-items: center;">
                    ${window.renderSortControls('izpiski', sortFields, 'renderIzpiski()')}
                    <button class="btn btn-blue" onclick="window._pendingIzpisekFile = null; showDodajIzpisek()">+ Vnesti bančni izpisek</button>
                    <button class="btn" style="background:#555; color: white;" onclick="document.getElementById('izpisek-upload').click()">Uvozi</button>
                    <input type="file" id="izpisek-upload" accept=".pdf,.xml,.zip" style="display:none" onchange="window.uvoziIzpisek(this)">
                </div>
            </div>
            <table><thead><tr>
                <th width="40"><input type="checkbox" onclick="window.toggleAllSelection(this.checked, 'izpiski')"></th>
                <th>Datum</th><th>Št. Izpiska</th><th>Začetno st.</th><th>Prilivi</th><th>Odlivi</th><th>Končno st.</th><th>Kontrola</th><th width="80" style="text-align:right">Akcije</th>
            </tr></thead><tbody>
        `;
        if (data.length === 0) {
            html += `<tr><td colspan="9" style="text-align:center">Ni izpiskov</td></tr>`;
        } else {
            let sortirano = window.sortAppData(data, 'izpiski');
            sortirano.forEach(d => {
                const isChecked = window.appSelection.ids.includes(d.id) ? 'checked' : '';
                let diff = Math.abs(d.koncno_stanje - (d.zacetno_stanje + d.kontrolna_vsota));
                let statusK = diff < 0.01 ? "OK" : "NAPAKA ("+formatNumberJS(diff)+"€)";
                let col = diff < 0.01 ? "green" : "red";
                html += `
                    <tr>
                        <td><input type="checkbox" class="row-checkbox" data-id="${d.id}" ${isChecked} onclick="window.toggleItemSelection(${d.id}, 'izpiski')"></td>
                        <td>${formatDateJS(d.datum)}</td>
                        <td>
                            <span style="font-weight:500; cursor:pointer; color:var(--primary-blue); text-decoration:underline;" onclick="showUrediIzpisek(${d.id})">${d.stevilka_izpiska}</span>
                            ${d.ima_prilogo ? '<span title="Izpisek ima priponko" style="margin-left:5px; font-size:1.1em; cursor:help;">📎</span>' : ''}
                        </td>
                        <td>${formatNumberJS(d.zacetno_stanje)} &euro;</td>
                        <td style="color:green; font-weight:500;">+ ${formatNumberJS(d.vsota_prilivov || 0)} &euro;</td>
                        <td style="color:var(--primary-red); font-weight:500;">- ${formatNumberJS(d.vsota_odlivov || 0)} &euro;</td>
                        <td>${formatNumberJS(d.koncno_stanje)} &euro;</td>
                        <td style="font-weight:bold; color:${col}">${statusK}</td>
                        <td class="action-buttons">
                            ${d.knjizeno ? 
                                `<button class="icon-btn btn-orange" onclick="knjiziPosamezen(${d.id}, 'razknjizi', 'izpiski')" title="Razknjiži">${ICONS.unbook || '🔓'}</button>` :
                                `<button class="icon-btn btn-green" onclick="knjiziPosamezen(${d.id}, 'knjizi', 'izpiski')" title="Knjiži">${ICONS.book || '📖'}</button>`
                            }
                            <button class="icon-btn btn-red" onclick="brisiIzpisek(${d.id})" title="Briši">${ICONS.delete}</button>
                        </td>
                    </tr>
                `;
            });
        }
        html += `</tbody></table>`;
        contentDiv.innerHTML = html;
    } catch (e) {
        contentDiv.innerHTML = `<p style="color:red">Napaka pri nalaganju.</p>`;
    }
}

let loadedPartners = "";
window._pendingIzpisekFile = null;

async function preLoadPartners() {
    const pRes = await fetch('/api/partnerji');
    const partnerji = await pRes.json();
    window._vsiPartnerji = partnerji;
    loadedPartners = partnerji.map(p => `<option value="${p.id}">${p.naziv}</option>`).join('');
}

window.dodajPromet = function(tip, data = null) {
    const container = document.getElementById('izpisek-items-container');
    const div = document.createElement('div');
    div.className = 'bank-item-box';
    div.style = 'border: 1px solid #dee2e6; padding: 12px; border-radius: 8px; margin-bottom: 12px; background: #fff; transition: box-shadow 0.2s;';
    
    let color = tip === 'dobro' ? '#2b8a3e' : '#e03131';
    let bgColor = tip === 'dobro' ? '#ebfbee' : '#fff5f5';
    let znesekText = tip === 'dobro' ? 'Prejeto €' : 'Odvedeno €';
    
    // Nastavitve za dvostavno (iz prednaloženih)
    const ds = window.appSettings && window.appSettings.dvostavno_knjigovodstvo;

    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <div style="display:flex; gap:8px; align-items:center; flex:1;">
                <span style="background:${bgColor}; color:${color}; padding:2px 8px; border-radius:4px; font-weight:bold; font-size:0.75em; text-transform:uppercase; border:1px solid ${color}44;">${tip === 'dobro' ? 'Priliv' : 'Odliv'}</span>
                <div style="display:flex; gap:2px; align-items:center; flex:1; max-width:400px;">
                    <div style="flex: 1;">
                        <input type="text" class="i-partner-search" placeholder="Išči partnerja..." value="${data && data.partner_naziv ? data.partner_naziv : ''}" autocomplete="off">
                        <input type="hidden" class="i-partner" value="${data ? (data.partner_id || '') : ''}">
                    </div>
                    <button type="button" title="Dodaj partnerja" onclick="window.odpriPartnerPopup(this.previousElementSibling.querySelector('.i-partner'))" style="padding:2px 8px; font-size:1em; background:#f1f3f5; border:1px solid #ced4da; border-radius:4px; cursor:pointer;">+</button>
                </div>
            </div>
            <div style="display:flex; gap:5px;">
                <button type="button" class="btn btn-likvidiraj" style="display:${ds ? 'flex' : 'none'}; opacity:0.3; align-items:center; gap:5px; height:28px; padding:0 10px; font-size:0.8em; border:1px solid #ced4da;" title="Najprej shranite in izberite partnerja">
                    ${ICONS.liquidate} <span>Likvidiraj</span>
                </button>
                <button type="button" class="btn btn-red" style="padding: 2px 8px; height:28px;" onclick="if(confirm('Izbrišem to postavko?')) { this.parentElement.parentElement.parentElement.remove(); window.kalkIzpisek(); }" title="Odstrani">X</button>
            </div>
        </div>
        <div style="display:flex; gap:10px;">
            <div style="flex:2.5;"><input type="text" class="i-namen" required style="width:100%" placeholder="Namen / Opis transakcije"></div>
            <div style="flex:0.6;"><input type="text" class="i-koda" style="width:100%" placeholder="Koda (PMNT)"></div>
            <div style="flex:0.6;"><input type="text" class="i-konto" list="konti-datalist" style="width:100%" placeholder="Konto"></div>
            <div style="flex:1;"><input type="text" class="i-znesek" placeholder="${znesekText}" required style="width:100%; font-weight:bold; border-color:${color};" oninput="window.kalkIzpisek()"></div>
        </div>
        <input type="hidden" class="i-tip" value="${tip}">
        <input type="hidden" class="i-id" value="${data ? (data.id || '') : ''}">
        <input type="hidden" class="i-st-povezav" value="${data ? (data.st_povezav || 0) : 0}">
        <input type="hidden" class="i-manualna" value="${data && (data.manualna_likvidacija === 1 || data.manualna_likvidacija === true) ? 1 : 0}">
    `;
    
    // Hover effect
    div.onmouseenter = () => div.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
    div.onmouseleave = () => div.style.boxShadow = 'none';
    
    container.appendChild(div);

    initPartnerSearch(div.querySelector('.i-partner-search'), div.querySelector('.i-partner'), () => {
        window.osveziLikvidacijskiGumb(div);
    });

    // Listen for changes to the partner ID (especially for the + Add Partner popup)
    div.querySelector('.i-partner').addEventListener('change', () => {
        window.osveziLikvidacijskiGumb(div);
    });

    // Initial state
    window.osveziLikvidacijskiGumb(div);
};

window.osveziLikvidacijskiGumb = function(box) {
    const ds = window.appSettings && window.appSettings.dvostavno_knjigovodstvo;
    if (!ds) return;

    const partnerId = box.querySelector('.i-partner').value;
    const itemId = box.querySelector('.i-id').value;
    const likBtn = box.querySelector('.btn-likvidiraj');
    
    if (partnerId && itemId) {
        const stPovezav = parseInt(box.querySelector('.i-st-povezav')?.value || "0");
        const isManual = parseInt(box.querySelector('.i-manualna')?.value || "0") === 1;
        likBtn.style.opacity = '1';
        
        if (stPovezav > 0 || isManual) {
            likBtn.style.background = '#ebfbee';
            likBtn.style.color = '#2b8a3e';
            likBtn.style.borderColor = '#b2f2bb';
            likBtn.innerHTML = `${ICONS.edit} <span>${isManual ? 'Ročna likvidacija' : 'Uredi likvidacijo'}</span>`;
            likBtn.title = isManual ? "Postavka je ročno likvidirana" : `Ta postavka je že likvidirana (št. povezav: ${stPovezav})`;
        } else {
            likBtn.style.background = '#e7f5ff';
            likBtn.style.color = '#1971c2';
            likBtn.style.borderColor = '#a5d8ff';
            likBtn.innerHTML = `${ICONS.liquidate} <span>Likvidiraj</span>`;
            likBtn.title = "Poveži s prejetim/izdanim računom";
        }

        likBtn.onclick = () => {
            const znesekStr = box.querySelector('.i-znesek').value.replace(',', '.');
            const namen = box.querySelector('.i-namen').value;
            window.odpriLikvidacijo(parseInt(itemId), parseInt(partnerId), parseFloat(znesekStr), namen, isManual, box);
        };
    } else {
        likBtn.style.opacity = '0.3';
        likBtn.style.background = '#f8f9fa';
        likBtn.style.color = '#495057';
        likBtn.style.borderColor = '#ced4da';
        likBtn.title = !itemId ? "Najprej shranite spremembe izpiska!" : "Izberite partnerja!";
        likBtn.onclick = null;
    }
};

window.kalkIzpisek = function() {
    let promet = 0;
    document.querySelectorAll('.bank-item-box').forEach(box => {
        let v = parseNumberJS(box.querySelector('.i-znesek').value);
        let tip = box.querySelector('.i-tip').value;
        if (tip === 'breme') v = -v; 
        promet += v;
    });
    document.getElementById('ik-vsota').innerText = formatNumberJS(promet);
    let z = parseNumberJS(document.getElementById('i_zacetno').value);
    let k = parseNumberJS(document.getElementById('i_koncno').value);
    document.getElementById('ik-skupaj').innerText = formatNumberJS(z + promet);
    document.getElementById('ik-tar').innerText = formatNumberJS(k);
    
    // Auto-UI validation
    let elem = document.getElementById('ik-skupaj');
    if(Math.abs((z+promet) - k) < 0.01) {
        elem.style.color = 'green';
    } else {
        elem.style.color = 'var(--primary-red)';
    }
};

async function showUrediIzpisek(id) {
    try {
        const res = await fetch(`/api/izpiski/detajl/${id}`);
        const data = await res.json();
        await showDodajIzpisek(data);
    } catch (e) {
        alert("Napaka pri branju izpiska.");
        renderIzpiski();
    }
}

async function showDodajIzpisek(editData = null, noDefaultRow = false) {
    await preLoadPartners();
    const isEdit = !!editData;
    const title = isEdit ? `Urejanje izpiska št. ${editData.stevilka_izpiska}` : "Vnos novega bančnega izpiska";
    const btnText = isEdit ? "Shrani spremembe" : "Shrani in potrdi izpisek";

    let prevId = null;
    let nextId = null;
    if (isEdit) {
        try {
            const resAll = await fetch('/api/izpiski');
            const allDocs = await resAll.json();
            const sortirano = window.sortAppData(allDocs, 'izpiski');
            const idx = sortirano.findIndex(d => d.id === editData.id);
            if (idx > 0) nextId = sortirano[idx - 1].id;
            if (idx !== -1 && idx < sortirano.length - 1) prevId = sortirano[idx + 1].id;
        } catch(e) {}
    }

    const formHtml = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 15px; margin-bottom: 20px;">
                <div style="display: flex; gap: 8px; flex-shrink: 0; margin-left: auto;">
                    ${isEdit ? `
                        <button type="button" class="btn" style="padding: 4px 10px; font-size: 0.9em; background:#f1f3f5; color:#495057; border:1px solid #ced4da;" onclick="showDodajIzpisek()" title="Nov izpisek">➕ Nov</button>
                        <button type="button" class="btn" style="padding: 4px 10px; font-size: 0.9em; background:#f1f3f5; color:#495057; border:1px solid #ced4da; ${!prevId ? 'opacity:0.5;cursor:not-allowed;' : ''}" ${prevId ? `onclick="showUrediIzpisek(${prevId})"` : 'disabled'} title="Prejšnji">◀ Prejšnji</button>
                        <button type="button" class="btn" style="padding: 4px 10px; font-size: 0.9em; background:#f1f3f5; color:#495057; border:1px solid #ced4da; ${!nextId ? 'opacity:0.5;cursor:not-allowed;' : ''}" ${nextId ? `onclick="showUrediIzpisek(${nextId})"` : 'disabled'} title="Naslednji">Naslednji ▶</button>
                    ` : ''}
                </div>
            </div>
            <form id="izpisekForm" onsubmit="shraniIzpisek(event, ${isEdit ? editData.id : 'null'})">
                <input type="hidden" id="izpisek_id_skrito" value="${isEdit ? editData.id : ''}">
                <div style="display:flex; gap: 15px;">
                    <div class="form-group" style="flex:1"><label>Datum izpiska</label><input type="text" id="i_datum" value="${isEdit ? formatDateJS(editData.datum) : ''}" placeholder="DD.MM.YYYY" required></div>
                    <div class="form-group" style="flex:1"><label>Št. Izpiska</label><input type="text" id="i_stevilka" value="${isEdit ? editData.stevilka_izpiska : ''}" required></div>
                    <div class="form-group" style="flex:1"><label>Začetno stanje (&euro;)</label><input type="text" id="i_zacetno" value="${isEdit ? formatNumberJS(editData.zacetno_stanje) : ''}" required oninput="window.kalkIzpisek()"></div>
                    <div class="form-group" style="flex:1"><label>Končno stanje (&euro;)</label><input type="text" id="i_koncno" value="${isEdit ? formatNumberJS(editData.koncno_stanje) : ''}" required oninput="window.kalkIzpisek()"></div>
                </div>
                
                <h4 style="margin-top:20px; padding-bottom:10px; border-bottom:1px solid #border-color; color: var(--text-muted)">Promet izpiska (Postavke)</h4>
                
                <div id="izpisek-items-container" style="margin-top: 15px;"></div>

                <div style="margin-top: 15px; display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <button type="button" class="btn" style="background:#388e3c; color:white; font-size: 0.85em;" onclick="window.dodajPromet('dobro')">+ Promet v DOBRO (Priliv)</button>
                        <button type="button" class="btn" style="background:var(--primary-red); color:white; font-size: 0.85em;" onclick="window.dodajPromet('breme')">- Promet v BREME (Odliv)</button>
                    </div>
                    <div style="font-size:1.1em; background:#f8f9fa; padding:10px; border-radius:4px; border:1px solid var(--border-color);">
                        Skupni promet: <strong><span id="ik-vsota">0.00</span> &euro;</strong> <br>
                        (Začetno + Promet = <span id="ik-skupaj" style="font-weight:bold;">0.00</span> &euro; | Ciljno končno = <span id="ik-tar" style="font-weight:bold;">0.00</span> &euro;)
                    </div>
                </div>
                
                <div style="margin-top: 25px; border-top: 1px solid var(--border-color); padding-top:15px;">
                    <button type="submit" class="btn btn-blue">${btnText}</button>
                    <button type="button" class="btn" onclick="window.zapriGlavniPopup()" style="color: var(--text-main); background: #eee; margin-left:10px;">Prekliči</button>
                </div>
            </form>
    `;

    const splitHtml = buildSplitViewHTML(formHtml, 'izpiski', isEdit ? editData.id : null);
    window.odpriGlavniPopup(title, splitHtml, "", true);

    if (isEdit) window.PrilogeUI.init('izpiski', editData.id);

    if (!window.appSettings) {
        const setRes = await fetch('/api/nastavitve');
        window.appSettings = await setRes.json();
    }

    if (isEdit && editData.postavke) {
        editData.postavke.forEach(p => {
            window.dodajPromet(p.tip_prometa, {
                partner_id: p.partner_id,
                partner_naziv: p.partner_naziv,
                id: p.id
            });
            const boxes = document.querySelectorAll('.bank-item-box');
            const lastBox = boxes[boxes.length - 1];
            
            lastBox.querySelector('.i-namen').value = p.namen;
            lastBox.querySelector('.i-koda').value = p.koda_namena;
            lastBox.querySelector('.i-znesek').value = formatNumberJS(p.znesek);
            lastBox.querySelector('.i-konto').value = p.konto || '';
            lastBox.querySelector('.i-st-povezav').value = p.st_povezav || 0;
            lastBox.querySelector('.i-manualna').value = (p.manualna_likvidacija === true || p.manualna_likvidacija === 1) ? 1 : 0;
            
            // Osvežimo stanje gumba
            window.osveziLikvidacijskiGumb(lastBox);
        });
    } else if (!noDefaultRow) {
        window.dodajPromet('dobro'); 
    }
    window.kalkIzpisek();
    window.initDatePickers();
}

async function shraniIzpisek(e, id = null) {
    e.preventDefault();
    const postavke = [];
    let netto_pro = 0;
    const boxes = document.querySelectorAll('.bank-item-box');
    boxes.forEach(box => {
        let pid = box.querySelector('.i-partner').value;
        let p_val = parseNumberJS(box.querySelector('.i-znesek').value);
        let p_tip = box.querySelector('.i-tip').value;
        let p_id = box.querySelector('.i-id').value;
        let m_val = box.querySelector('.i-manualna')?.value;
        let is_manual = (m_val === "1" || m_val === "true");
        
        postavke.push({
            id: p_id ? parseInt(p_id) : null,
            tip_prometa: p_tip,
            partner_id: pid ? parseInt(pid) : null,
            namen: box.querySelector('.i-namen').value,
            koda_namena: box.querySelector('.i-koda').value,
            znesek: p_val,
            konto: box.querySelector('.i-konto').value,
            manualna_likvidacija: is_manual
        });
        
        if (p_tip === 'breme') netto_pro -= p_val;
        else netto_pro += p_val;
    });

    let ks = parseNumberJS(document.getElementById('i_zacetno').value) + netto_pro;
    let kt = parseNumberJS(document.getElementById('i_koncno').value);
    
    if(Math.abs(ks - kt) > 0.01) {
        alert("NAPAKA: Kontrolna vsota se ne ujema! (Začetno stanje + Promet mora biti enako Končnemu stanju)\nRazlika: " + (ks - kt).toFixed(2) + " €");
        return;
    }
    
    const payload = {
        datum: parseDateISO(document.getElementById('i_datum').value),
        stevilka_izpiska: document.getElementById('i_stevilka').value,
        zacetno_stanje: parseNumberJS(document.getElementById('i_zacetno').value),
        koncno_stanje: parseNumberJS(document.getElementById('i_koncno').value),
        kontrolna_vsota: netto_pro, // Use the precisely calculated sum
        postavke: postavke
    };
    
    const url = id ? `/api/izpiski/${id}` : '/api/izpiski';
    const method = id ? 'PUT' : 'POST';
    
    const res = await fetch(url, { method: method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    if (res.ok) {
        const result = await res.json();
        const newId = id || result.id;
        if (window._pendingIzpisekFile && newId) {
            await window.PrilogeUI._uploadRaw(window._pendingIzpisekFile, 'izpiski', newId);
            window._pendingIzpisekFile = null;
        }
        if (window.refreshCurrentModule) window.refreshCurrentModule();
        try {
            const detajlRes = await fetch(`/api/izpiski/detajl/${newId}`);
            if (detajlRes.ok) {
                const detajl = await detajlRes.json();
                await showDodajIzpisek(detajl);
            } else {
                window.zapriGlavniPopup();
            }
        } catch (e) {
            window.zapriGlavniPopup();
        }
    } else {
        const err = await res.json();
        alert("Napaka pri shranjevanju izpiska: " + (err.detail || res.statusText));
    }
}

async function brisiIzpisek(id) {
    if (!confirm("Ali ste prepričani, da želite izbrisati ta bančni izpisek?")) return;
    try {
        const res = await fetch(`/api/izpiski/${id}`, { method: 'DELETE' });
        if (res.ok) {
            renderIzpiski();
        } else {
            const err = await res.json();
            alert("Napaka pri brisanju: " + (err.detail || res.statusText));
        }
    } catch (e) {
        alert("Napaka pri komunikaciji s strežnikom.");
    }
}

window.uvoziIzpisek = async function(input) {
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    
    // Pri XML ali ZIP ne moremo pripeti datoteke kot PDF prilogo k enemu zapisu enostavno (lahko pa shranimo)
    // Zaenkrat shranimo za PDF
    if (file.name.toLowerCase().endsWith('.pdf')) {
        window._pendingIzpisekFile = file;
    } else {
        window._pendingIzpisekFile = null;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    contentDiv.innerHTML = `<p>Obdelujem datoteko: ${file.name}...</p>`;
    try {
        const res = await fetch('/api/izpiski/parse', {
            method: 'POST',
            body: formData
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Napaka pri uvozu");
        }
        const result = await res.json();
        
        if (result.count > 1 || file.name.toLowerCase().endsWith('.zip')) {
            window._pendingIzpisekFile = null; // Ne moremo pripeti enega PDF vsem
            await showBulkImportPreview(result.items, 'izpiski');
        } else if (result.items && result.items.length === 1) {
            const data = result.items[0];
            await showDodajIzpisek(null, true);
            
            try {
                const previewUrl = URL.createObjectURL(file);
                const panel = document.getElementById('prilogePanelContent');
                if (panel) {
                    panel.innerHTML = `
                        <div class="preview-tabs">
                            <button class="preview-tab active" style="background:#fff;border-bottom:none;">📄 Predogled uvoženega PDF</button>
                        </div>
                        <div class="preview-frame-container">
                            <iframe src="${previewUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH" style="width:100%; height:100%; border:none;"></iframe>
                        </div>
                    `;
                }
            } catch(e) { console.error('Napaka pri prikazu predogleda:', e); }
            
            document.getElementById('i_datum').value = formatDateJS(data.datum);
            document.getElementById('i_stevilka').value = data.stevilka_izpiska;
            document.getElementById('i_zacetno').value = formatNumberJS(data.zacetno_stanje);
            document.getElementById('i_koncno').value = formatNumberJS(data.koncno_stanje);
            
            data.postavke.forEach((p, idx) => {
                window.dodajPromet(p.tip_prometa, p);
                const boxes = document.querySelectorAll('.bank-item-box');
                const lastBox = boxes[boxes.length - 1];
                lastBox.querySelector('.i-namen').value = p.namen || '';
                lastBox.querySelector('.i-koda').value = p.koda_namena || 'PMNT';
                lastBox.querySelector('.i-znesek').value = formatNumberJS(p.znesek);
                
                let partnerName = (data.partner_names[idx] || "").toUpperCase();
                let namenUpper = (p.namen || "").toUpperCase();
                let isNLB = partnerName.includes("NOVA LJUBLJANSKA BANKA") || partnerName.includes("NLB") || namenUpper.includes("PROVIZIJA") || namenUpper.includes("NADOMESTILO");
                let isTujina = partnerName.match(/\b(GMBH|INC|LTD|LIMITED|LLC|AG|SA|SPA|BV|NV|SRL|PLC|AB|OY|AS|APS)\b/);

                let kontoVal = p.konto || "";
                if (!kontoVal) {
                    if (isNLB) {
                        kontoVal = "419";
                    } else if (p.tip_prometa === "dobro") {
                        kontoVal = isTujina ? "121" : "120";
                    } else if (p.tip_prometa === "breme") {
                        kontoVal = isTujina ? "221" : "220";
                    }
                }
                lastBox.querySelector('.i-konto').value = kontoVal;
            });
            window.kalkIzpisek();
            
            const pNames = data.partner_names || [];
            const missing = pNames.filter((n, i) => n && n !== "Neznan" && n !== "NOVA LJUBLJANSKA BANKA D.D." && data.postavke && data.postavke[i] && !data.postavke[i].partner_id);
            if (missing.length > 0) {
                const uniqueMissing = [...new Set(missing)];
                alert("Nisem uspel povezati naslednjih partnerjev:\n" + uniqueMissing.join("\n") + "\n\nProsimo, preverite partnerje ali jih ročno izberite v vrsticah.");
            }
        }
    } catch (e) {
        alert(e.message);
        renderIzpiski();
    }
};

// --- NASTAVITVE ---
async function renderNastavitve(tab = 'podjetje', isNew = false) {
    titleEl.textContent = isNew ? "Dodaj novo podjetje" : "Nastavitve";
    contentDiv.innerHTML = '<p>Nalagam nastavitve...</p>';
    
    // Priprava navigacije za zavihke
    const navHtml = `
        <div style="display: flex; gap: 20px; border-bottom: 2px solid var(--border-color); margin-bottom: 25px; padding-bottom: 5px;">
            <a href="#" onclick="renderNastavitve('podjetje')" style="text-decoration: none; padding: 10px 15px; color: ${tab === 'podjetje' ? 'var(--primary-blue)' : '#888'}; font-weight: ${tab === 'podjetje' ? 'bold' : 'normal'}; border-bottom: 3px solid ${tab === 'podjetje' ? 'var(--primary-blue)' : 'transparent'}; transition: 0.2s;">Podjetje</a>
            ${!isNew ? `
            <a href="#" onclick="renderNastavitve('besedila')" style="text-decoration: none; padding: 10px 15px; color: ${tab === 'besedila' ? 'var(--primary-blue)' : '#888'}; font-weight: ${tab === 'besedila' ? 'bold' : 'normal'}; border-bottom: 3px solid ${tab === 'besedila' ? 'var(--primary-blue)' : 'transparent'}; transition: 0.2s;">Opombe</a>
            <a href="#" onclick="renderNastavitve('konti')" style="text-decoration: none; padding: 10px 15px; color: ${tab === 'konti' ? 'var(--primary-blue)' : '#888'}; font-weight: ${tab === 'konti' ? 'bold' : 'normal'}; border-bottom: 3px solid ${tab === 'konti' ? 'var(--primary-blue)' : 'transparent'}; transition: 0.2s;">Kontni načrt</a>
            <a href="#" onclick="renderNastavitve('eposta')" style="text-decoration: none; padding: 10px 15px; color: ${tab === 'eposta' ? 'var(--primary-blue)' : '#888'}; font-weight: ${tab === 'eposta' ? 'bold' : 'normal'}; border-bottom: 3px solid ${tab === 'eposta' ? 'var(--primary-blue)' : 'transparent'}; transition: 0.2s;">E-pošta</a>
            <a href="#" onclick="renderNastavitve('odhodna_posta')" style="text-decoration: none; padding: 10px 15px; color: ${tab === 'odhodna_posta' ? 'var(--primary-blue)' : '#888'}; font-weight: ${tab === 'odhodna_posta' ? 'bold' : 'normal'}; border-bottom: 3px solid ${tab === 'odhodna_posta' ? 'var(--primary-blue)' : 'transparent'}; transition: 0.2s;">Odhodna pošta</a>
            <a href="#" onclick="renderNastavitve('ujp')" style="text-decoration: none; padding: 10px 15px; color: ${tab === 'ujp' ? 'var(--primary-blue)' : '#888'}; font-weight: ${tab === 'ujp' ? 'bold' : 'normal'}; border-bottom: 3px solid ${tab === 'ujp' ? 'var(--primary-blue)' : 'transparent'}; transition: 0.2s;">UJP e-Račun</a>
            <a href="#" onclick="renderNastavitve('ai')" style="text-decoration: none; padding: 10px 15px; color: ${tab === 'ai' ? 'var(--primary-blue)' : '#888'}; font-weight: ${tab === 'ai' ? 'bold' : 'normal'}; border-bottom: 3px solid ${tab === 'ai' ? 'var(--primary-blue)' : 'transparent'}; transition: 0.2s;">Umetna inteligenca</a>
            <a href="#" onclick="renderNastavitve('nadzorna_plosca')" style="text-decoration: none; padding: 10px 15px; color: ${tab === 'nadzorna_plosca' ? 'var(--primary-blue)' : '#888'}; font-weight: ${tab === 'nadzorna_plosca' ? 'bold' : 'normal'}; border-bottom: 3px solid ${tab === 'nadzorna_plosca' ? 'var(--primary-blue)' : 'transparent'}; transition: 0.2s;">Nadzorna plošča</a>
            ` : ''}
        </div>
        <div id="settings-tab-content"></div>
    `;
    contentDiv.innerHTML = navHtml;
    const tabContent = document.getElementById('settings-tab-content');

    try {
        if (tab === 'podjetje') {
            let data = { naziv: '', kratko_ime: '', ulica: '', posta_kraj: '', davcna_stevilka: '', trr: '', banka: '', email_posiljatelja: '', telefon: '', spletna_stran: '', dvostavno_knjigovodstvo: false };
            if (!isNew) {
                const res = await fetch('/api/nastavitve');
                data = await res.json();
            }
            
            tabContent.innerHTML = `
                <div style="max-width: 800px; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-top: 4px solid var(--primary-red);">
                    <h3 style="margin-bottom: 20px; color: var(--primary-blue);">${isNew ? 'Podatki o novem podjetju' : 'Podatki o vašem podjetju'}</h3>
                    <p style="margin-bottom: 20px; color: var(--text-muted); font-size: 0.9em;">Navedeni podatki se bodo uporabljali kot podatki izdajatelja na vaših računih in drugih dokumentih.</p>
                    
                    <form onsubmit="event.preventDefault(); window.shraniNastavitvePodjetja(${isNew})">
                        <div class="form-group">
                            <label>Naziv podjetja (Polno ime za dokumente)</label>
                            <input type="text" id="n_naziv" value="${data.naziv || ''}" required>
                        </div>
                        <div class="form-group">
                            <label>Kratko ime (Prikaz v izbirniku podjetij)</label>
                            <input type="text" id="n_kratko_ime" value="${data.kratko_ime || ''}" placeholder="npr. Moje Podjetje">
                        </div>
                        <div style="display: flex; gap: 15px;">
                            <div class="form-group" style="flex:2">
                                <label>Ulica in hišna št.</label>
                                <input type="text" id="n_ulica" value="${data.ulica || ''}">
                            </div>
                            <div class="form-group" style="flex:1">
                                <label>Pošta in kraj</label>
                                <input type="text" id="n_posta_kraj" value="${data.posta_kraj || ''}">
                            </div>
                        </div>
                        
                        <div style="display: flex; gap: 15px;">
                            <div class="form-group" style="flex:1">
                                <label>Davčna številka</label>
                                <input type="text" id="n_davcna_stevilka" value="${data.davcna_stevilka || ''}">
                            </div>
                            <div class="form-group" style="flex:1; flex-direction: row; align-items: center; gap: 10px; display: flex;">
                                <input type="checkbox" id="n_zavezanec_za_ddv" ${data.zavezanec_za_ddv ? 'checked' : ''} style="width: auto; margin:0; margin-top:20px;">
                                <label for="n_zavezanec_za_ddv" style="margin:0; margin-top:20px;">Zavezanec za DDV</label>
                            </div>
                        </div>

                        <div style="display: flex; gap: 15px;">
                            <div class="form-group" style="flex:1">
                                <label>TRR (IBAN)</label>
                                <input type="text" id="n_trr" value="${data.trr || ''}">
                            </div>
                            <div class="form-group" style="flex:1">
                                <label>Banka</label>
                                <input type="text" id="n_banka" value="${data.banka || ''}">
                            </div>
                        </div>

                        <div style="display: flex; gap: 15px;">
                            <div class="form-group" style="flex:1">
                                <label>E-naslov pošiljatelja</label>
                                <input type="email" id="n_email_posiljatelja" value="${data.email_posiljatelja || ''}">
                            </div>
                            <div class="form-group" style="flex:1">
                                <label>Telefon</label>
                                <input type="text" id="n_telefon" value="${data.telefon || ''}">
                            </div>
                        </div>
                        
                        <div class="form-group">
                            <label>Spletna stran</label>
                            <input type="text" id="n_spletna_stran" value="${data.spletna_stran || ''}">
                        </div>

                        <div class="form-group" style="margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 20px;">
                            <label style="font-weight: bold; margin-bottom: 10px;">Logotip podjetja</label>
                            <div style="display: flex; align-items: center; gap: 20px;">
                                <div id="settings-logo-preview" style="width: 120px; height: 60px; border: 1px dashed var(--border-color); border-radius: 6px; display: flex; align-items: center; justify-content: center; background: #f8f9fa; overflow: hidden;">
                                    ${data.logo_url ? `<img src="${data.logo_url}?t=${new Date().getTime()}" style="max-width:100%; max-height:100%; object-fit:contain;">` : '<span style="font-size: 0.8rem; color: var(--text-muted);">Ni logotipa</span>'}
                                </div>
                                <div style="display: flex; flex-direction: column; gap: 8px;">
                                    <button type="button" class="btn btn-blue" onclick="document.getElementById('logo-input').click()" style="padding: 6px 12px; font-size: 0.85em;">Naloži logotip</button>
                                    <button type="button" id="btn-remove-logo" class="btn" onclick="window.odstraniLogotip()" style="padding: 6px 12px; font-size: 0.85em; background: #e9ecef; color: #495057; display: ${data.logo_url ? 'block' : 'none'};">Odstrani</button>
                                </div>
                            </div>
                        </div>

                        <div style="background: #fff5f5; padding: 15px; border-radius: 6px; border: 1px solid #ffc9c9; margin-top: 20px;">
                            <div class="form-group" style="flex-direction: row; align-items: center; gap: 10px; display: flex; margin-bottom:0;">
                                <input type="checkbox" id="n_dvostavno_knjigovodstvo" ${data.dvostavno_knjigovodstvo ? 'checked' : ''} style="width: auto; margin:0;">
                                <label for="n_dvostavno_knjigovodstvo" style="margin:0; font-weight:bold; color:#c92a2a;">Omogoči dvostavno knjigovodstvo (napredne funkcije)</label>
                            </div>
                            <p style="font-size:0.8rem; color:#868e96; margin-top:5px; margin-left:26px;">Vklopi dodatne funkcije kot so likvidacija plačil, bruto bilanca in knjiženje.</p>
                        </div>

                        <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                            <button type="submit" class="btn btn-red">${isNew ? 'Ustvari podjetje' : 'Shrani nastavitve'}</button>
                        </div>
                    </form>
                </div>
            `;
        } else if (tab === 'besedila') {
            tabContent.innerHTML = `
                <div style="max-width: 800px; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-top: 4px solid #4caf50;">
                    <h3 style="margin-bottom: 20px; color: #388e3c;">Predloge zaključnih besedil</h3>
                    <p style="margin-bottom: 20px; color: var(--text-muted); font-size: 0.9em;">Tu lahko določite predloge besedil (napisi o zapadlosti, pozdravi, določila...), ki jih boste lahko hitro dodali pri ustvarjanju izdanega računa.</p>
                    
                    <div id="predloge-list" style="margin-bottom: 20px;"></div>
                    
                    <form onsubmit="shraniPredlogo(event)" style="background:#f8f9fa; padding:15px; border-radius:4px; border:1px solid var(--border-color);">
                        <input type="hidden" id="pr_id" value="">
                        <div class="form-group">
                            <label>Naziv predloge (npr. 'Standardni napis')</label>
                            <input type="text" id="pr_naziv" required>
                        </div>
                        <div class="form-group">
                            <label>Vsebina predloge</label>
                            <textarea id="pr_besedilo" rows="3" required style="width:100%; border:1px solid var(--border-color); border-radius:4px; padding:8px;"></textarea>
                        </div>
                        <div style="display:flex; gap:10px;">
                            <button type="submit" class="btn" id="btn-save-predloga" style="background:#4caf50; color:white;">Dodaj predlogo</button>
                            <button type="button" class="btn" id="btn-cancel-predloga" style="display:none; background:#ccc;" onclick="window.ponastaviFormuPredlog()">Prekliči</button>
                        </div>
                    </form>
                </div>
            `;
            await naloziPredlogeUI();
        } else if (tab === 'konti') {
            // Kontni načrt
            tabContent.innerHTML = '<div id="kontni-nacrt-section-inner"></div>';
            await renderKontniNacrtUI('kontni-nacrt-section-inner');
        } else if (tab === 'eposta') {
            let data = {};
            try {
                const res = await fetch('/api/nastavitve');
                data = await res.json();
            } catch(e) {}
            
            tabContent.innerHTML = `
                <div style="max-width: 800px; display: flex; flex-direction: column; gap: 20px;">
                    <!-- SMTP NASTAVITVE -->
                    <div style="background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-top: 4px solid var(--primary-blue);">
                        <h3 style="margin-bottom: 20px; color: var(--primary-blue);">Nastavitve odhodne pošte (SMTP)</h3>
                        <p style="margin-bottom: 20px; color: var(--text-muted); font-size: 0.9em;">Vnesite podatke vašega SMTP strežnika, da omogočite pošiljanje računov neposredno iz aplikacije.</p>
                        
                        <form onsubmit="event.preventDefault(); window.shraniVseEpostaNastavitve()">
                            <div style="display: flex; gap: 15px;">
                                <div class="form-group" style="flex:2">
                                    <label>SMTP Strežnik (npr. smtp.gmail.com)</label>
                                    <input type="text" id="smtp_server" value="${data.smtp_server || ''}" required>
                                </div>
                                <div class="form-group" style="flex:1">
                                    <label>Vrata (Port, npr. 587)</label>
                                    <input type="number" id="smtp_port" value="${data.smtp_port || 587}" required>
                                </div>
                            </div>
                            <div style="display: flex; gap: 15px;">
                                <div class="form-group" style="flex:1">
                                    <label>Uporabniško ime (Email)</label>
                                    <input type="text" id="smtp_username" value="${data.smtp_username || ''}" required>
                                </div>
                                <div class="form-group" style="flex:1">
                                    <label>Geslo (ali App Password)</label>
                                    <input type="password" id="smtp_password" value="${data.smtp_password || ''}" required>
                                </div>
                            </div>
                            <div class="form-group" style="flex-direction: row; align-items: center; gap: 10px; display: flex;">
                                <input type="checkbox" id="smtp_use_tls" ${data.smtp_use_tls !== false ? 'checked' : ''} style="width: auto; margin:0;">
                                <label for="smtp_use_tls" style="margin:0;">Uporabi varno povezavo (STARTTLS / TLS)</label>
                            </div>
                            
                            <div style="margin-top: 10px; display:flex; gap:10px;">
                                <button type="button" class="btn" style="background:#eee; color:#333; font-size:0.85em;" onclick="window.testirajSMTP()">Preveri povezavo</button>
                            </div>

                            <div style="margin-top: 30px; border-top: 2px solid #eee; padding-top: 20px;">
                                <h3 style="margin-bottom: 20px; color: var(--primary-blue);">Predloge besedil za e-pošto</h3>
                                <p style="margin-bottom: 20px; color: var(--text-muted); font-size: 0.9em;">Besedila, ki se bodo samodejno vstavila v e-pošto. Značke: {stevilka}, {tip}, {podjetje}, {zapadlost}, {znesek}.</p>
                                
                                <div class="form-group">
                                    <label>Predloga za Račune</label>
                                    <textarea id="email_template_racun" rows="4" style="width:100%; border:1px solid var(--border-color); border-radius:4px; padding:8px;">${data.email_template_racun || ''}</textarea>
                                </div>
                                <div class="form-group">
                                    <label>Predloga za Ponudbe</label>
                                    <textarea id="email_template_ponudba" rows="4" style="width:100%; border:1px solid var(--border-color); border-radius:4px; padding:8px;">${data.email_template_ponudba || ''}</textarea>
                                </div>
                                <div class="form-group">
                                    <label>Predloga za Dobropise</label>
                                    <textarea id="email_template_dobropis" rows="4" style="width:100%; border:1px solid var(--border-color); border-radius:4px; padding:8px;">${data.email_template_dobropis || ''}</textarea>
                                </div>
                                <div class="form-group">
                                    <label>Predloga za Opomine</label>
                                    <textarea id="email_template_opomin" rows="4" style="width:100%; border:1px solid var(--border-color); border-radius:4px; padding:8px;">${data.email_template_opomin || ''}</textarea>
                                </div>
                            </div>

                            <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid var(--border-color);">
                                <button type="submit" class="btn btn-blue">Shrani vse nastavitve e-pošte</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;
        } else if (tab === 'odhodna_posta') {
            try {
                const res = await fetch('/api/email_log');
                const logs = await res.json();
                
                let rowsHtml = logs.map(l => `
                    <tr style="border-bottom: 1px solid #eee;">
                        <td style="padding:10px;">${formatDateJS(l.poslano_at.split(' ')[0])} ob ${l.poslano_at.split(' ')[1].substring(0,5)}</td>
                        <td style="padding:10px;">${l.prejemnik}</td>
                        <td style="padding:10px;"><strong>${l.stevilka_dokumenta}</strong> (${l.tip_dokumenta})</td>
                        <td style="padding:10px;">${l.zadeva}</td>
                        <td style="padding:10px;">
                            ${l.status === 'success' ? '<span style="color:#2b8a3e; font-weight:bold;">✔ Poslano</span>' : `<span style="color:#e03131; font-weight:bold;" title="${l.napaka}">✘ Napaka</span>`}
                        </td>
                    </tr>
                `).join('');

                tabContent.innerHTML = `
                    <div style="max-width: 1000px; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-top: 4px solid var(--primary-blue);">
                        <h3 style="margin-bottom: 20px; color: var(--primary-blue);">Dnevnik odhodne pošte</h3>
                        <p style="margin-bottom: 20px; color: var(--text-muted); font-size: 0.9em;">Pregled zadnjih 100 poslanih e-poštnih sporočil iz sistema.</p>
                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse;">
                                <thead>
                                    <tr style="background:#f8f9fa;">
                                        <th style="text-align:left; padding:10px; border-bottom:2px solid #eee;">Datum</th>
                                        <th style="text-align:left; padding:10px; border-bottom:2px solid #eee;">Prejemnik</th>
                                        <th style="text-align:left; padding:10px; border-bottom:2px solid #eee;">Dokument</th>
                                        <th style="text-align:left; padding:10px; border-bottom:2px solid #eee;">Zadeva</th>
                                        <th style="text-align:left; padding:10px; border-bottom:2px solid #eee;">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${rowsHtml || '<tr><td colspan="5" style="text-align:center; padding:20px;">Dnevnik je prazen.</td></tr>'}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            } catch(e) {
                tabContent.innerHTML = '<p style="color:red">Napaka pri pridobivanju dnevnika.</p>';
            }
        } else if (tab === 'ujp') {
            const ujpStatus = await (await fetch('/api/nastavitve/ujp_status')).json();
            const ujpLogs = await (await fetch('/api/ujp_log')).json();

            const logRows = ujpLogs.length ? ujpLogs.map(l => `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:8px;">${l.poslano_at ? l.poslano_at.substring(0,16) : '-'}</td>
                    <td style="padding:8px; font-weight:600;">${l.stevilka || '-'}</td>
                    <td style="padding:8px;">${l.status === 'success' ? '<span style="color:#2b8a3e; font-weight:bold;">✔ Uspešno</span>' : '<span style="color:#e03131; font-weight:bold;">✘ Napaka</span>'}</td>
                    <td style="padding:8px; font-size:0.8em; color:#666; max-width:300px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${(l.odgovor||'').replace(/"/g, '&quot;')}">${(l.odgovor||'').substring(0,80)}</td>
                </tr>`).join('') : '<tr><td colspan="4" style="text-align:center;padding:20px;color:#888;">Ni zgodovine pošiljanj.</td></tr>';

            tabContent.innerHTML = `
                <div style="max-width:800px;">
                    <div style="background:white; padding:25px; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.05); border-top:4px solid #1864ab; margin-bottom:20px;">
                        <h3 style="margin-bottom:5px; color:#1864ab;">🏛️ UJP e-Račun – Neposredno pošiljanje B2B</h3>
                        <p style="color:#666; font-size:0.9em; margin-bottom:20px;">Pošiljajte e-račune neposredno na UJP brez ročnega vnosa. Potrebujete sistemsko digitalno potrdilo (.p12 / .pfx) od overitelja SIGEN-CA, Halcom ali Pošta®CA.</p>

                        <div style="background:${ujpStatus.cert_loaded ? '#ebfbee' : '#fff9db'}; border:1px solid ${ujpStatus.cert_loaded ? '#69db7c' : '#ffd43b'}; border-radius:8px; padding:15px; margin-bottom:20px; display:flex; align-items:center; gap:12px;">
                            <span style="font-size:2em;">${ujpStatus.cert_loaded ? '✅' : '⚠️'}</span>
                            <div>
                                <strong>${ujpStatus.cert_loaded ? 'Potrdilo naloženo: ' + ujpStatus.cert_filename : 'Potrdilo ni naloženo'}</strong><br>
                                <span style="font-size:0.85em; color:#555;">${ujpStatus.cert_loaded ? 'Sistem je pripravljen za pošiljanje na UJP.' : 'Naložite sistemsko digitalno potrdilo (.p12 ali .pfx).'}</span>
                            </div>
                            ${ujpStatus.cert_loaded ? '<button class="btn" style="margin-left:auto; background:#e03131; color:white; font-size:0.8em;" onclick="window.izbrisiUjpCert()">Izbriši potrdilo</button>' : ''}
                        </div>

                        <div style="display:flex; flex-direction:column; gap:15px;">
                            <div class="form-group">
                                <label><strong>Naloži sistemsko digitalno potrdilo (.p12 / .pfx)</strong></label>
                                <div style="display:flex; gap:10px; align-items:center; margin-top:5px;">
                                    <input type="file" id="ujp-cert-file" accept=".p12,.pfx" style="flex:1;">
                                    <button class="btn btn-blue" onclick="window.naloziUjpCert()" style="white-space:nowrap;">Naloži potrdilo</button>
                                </div>
                                <p style="font-size:0.8em; color:#888; margin-top:5px;">Potrdilo se varno shrani na vaš strežnik in se nikoli ne pošlje tretjim osebam.</p>
                            </div>

                            <div class="form-group">
                                <label><strong>Geslo potrdila</strong></label>
                                <div style="display:flex; gap:10px; align-items:center; margin-top:5px;">
                                    <input type="password" id="ujp-cert-password" placeholder="Vnesite geslo za .p12 datoteko" style="flex:1;">
                                    <button class="btn" style="background:#555; color:white; white-space:nowrap;" onclick="window.shraniUjpGeslo()">Shrani geslo</button>
                                </div>
                            </div>

                            <div style="display:flex; align-items:center; gap:10px; padding:12px; background:#f8f9fa; border-radius:6px; border:1px solid #dee2e6;">
                                <input type="checkbox" id="ujp-test-mode" ${ujpStatus.test_mode !== false ? 'checked' : ''} style="width:auto; margin:0;">
                                <div>
                                    <label for="ujp-test-mode" style="margin:0; font-weight:600; cursor:pointer;">Testno okolje (BETA UJPnet)</label>
                                    <p style="margin:2px 0 0 0; font-size:0.8em; color:#666;">Ko je označeno, se računi pošljejo na testni strežnik betaujpnet.ujp.gov.si. Odkljukajte šele ko je testiranje uspešno zaključeno.</p>
                                </div>
                            </div>
                        </div>

                        <div style="margin-top:20px; padding-top:15px; border-top:1px solid #eee;">
                            <a href="https://www.sigen-ca.si" target="_blank" class="btn" style="background:#e9ecef; color:#333; font-size:0.85em; margin-right:8px;">🔒 SIGEN-CA (brezplačno)</a>
                            <a href="https://ujpnet.ujp.gov.si" target="_blank" class="btn" style="background:#e9ecef; color:#333; font-size:0.85em;">🏛️ UJPnet Portal</a>
                        </div>
                    </div>

                    <div style="background:white; padding:25px; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.05);">
                        <h4 style="margin-bottom:15px; color:#1864ab;">Dnevnik pošiljanj na UJP</h4>
                        <div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; font-size:0.9em;">
                                <thead>
                                    <tr style="background:#f8f9fa;">
                                        <th style="text-align:left; padding:8px; border-bottom:2px solid #eee;">Datum</th>
                                        <th style="text-align:left; padding:8px; border-bottom:2px solid #eee;">Številka</th>
                                        <th style="text-align:left; padding:8px; border-bottom:2px solid #eee;">Status</th>
                                        <th style="text-align:left; padding:8px; border-bottom:2px solid #eee;">Odgovor UJP</th>
                                    </tr>
                                </thead>
                                <tbody>${logRows}</tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        } else if (tab === 'ai') {
            const res = await fetch('/api/settings/llama');
            const data = await res.json();
            const checked = !!data.learning_mode;
            tabContent.innerHTML = `
                <div style="max-width: 800px; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-top: 4px solid var(--primary-blue);">
                    <h3 style="margin-bottom: 20px; color: var(--primary-blue);">Umetna inteligenca (Llama)</h3>
                    <p style="margin-bottom: 25px; color: var(--text-muted); font-size: 0.9em;">Upravljanje nastavitev učenja Llama modela za samodejno ekstrakcijo podatkov iz PDF računov in drugih dokumentov.</p>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid var(--border-color); display: flex; align-items: center; justify-content: space-between;">
                        <div>
                            <strong style="display: block; font-size: 1.05em; color: #212529; margin-bottom: 5px;">Način učenja Llama modela</strong>
                            <span style="color: #6c757d; font-size: 0.85em;">Ko je vklopljeno, si sistem zapomni vaše popravke pri uvozu dokumentov za izboljšanje prihodnjih prepoznavanj.</span>
                        </div>
                        <label class="switch" style="position: relative; display: inline-block; width: 60px; height: 34px;">
                            <input type="checkbox" id="ai-learning-toggle-settings" ${checked ? 'checked' : ''} onchange="window.toggleLlamaLearningMode(this.checked)" style="opacity: 0; width: 0; height: 0;">
                            <span class="slider round" style="position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: ${checked ? '#1c7ed6' : '#ccc'}; transition: .4s; border-radius: 34px;"></span>
                        </label>
                    </div>
                </div>
                <style>
                    .switch input:checked + .slider { background-color: #2196F3; }
                    .slider:before {
                        position: absolute; content: ""; height: 26px; width: 26px; left: 4px; bottom: 4px;
                        background-color: white; transition: .4s; border-radius: 50%;
                        transform: ${checked ? 'translateX(26px)' : 'translateX(0)'};
                    }
                    .switch input:checked + .slider:before { transform: translateX(26px); }
                </style>
            `;
        } else if (tab === 'nadzorna_plosca') {
            const res = await fetch('/api/nastavitve');
            const data = await res.json();
            window.renderDashboardBuilder(tabContent, data.dashboard_config);
        }
    } catch (e) {
        tabContent.innerHTML = '<p style="color:red">Napaka pri nalaganju vsebine.</p>';
    }
}

window.shraniNastavitvePodjetja = async (isNew = false) => {
    let current = {};
    if (!isNew) {
        try {
            const cRes = await fetch('/api/nastavitve');
            current = await cRes.json();
        } catch(e) {}
    }
    const payload = {
        ...current,
        naziv: document.getElementById('n_naziv').value,
        kratko_ime: document.getElementById('n_kratko_ime').value,
        ulica: document.getElementById('n_ulica').value,
        posta_kraj: document.getElementById('n_posta_kraj').value,
        davcna_stevilka: document.getElementById('n_davcna_stevilka').value,
        zavezanec_za_ddv: document.getElementById('n_zavezanec_za_ddv').checked,
        trr: document.getElementById('n_trr').value,
        banka: document.getElementById('n_banka').value,
        email_posiljatelja: document.getElementById('n_email_posiljatelja').value,
        telefon: document.getElementById('n_telefon').value,
        spletna_stran: document.getElementById('n_spletna_stran').value,
        dvostavno_knjigovodstvo: document.getElementById('n_dvostavno_knjigovodstvo').checked
    };
    
    if (isNew) {
        const res = await fetch('/api/companies/create', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({name: payload.naziv})
        });
        if (res.ok) {
            // Po kreaciji baze na backendu, shranimo še ostale nastavitve v to novo bazo
            await fetch('/api/nastavitve', {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            alert("Podjetje uspešno ustvarjeno!");
            window.location.reload(); // Ponovno naložimo aplikacijo z novo bazo
        } else {
            alert("Napaka pri ustvarjanju podjetja.");
        }
    } else {
        try {
            const res = await fetch('/api/nastavitve', {
                method: 'PUT',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                alert("Nastavitve shranjene.");
                renderNastavitve();
            } else {
                alert("Napaka pri shranjevanju.");
            }
        } catch (e) {
            alert("Napaka pri shranjevanju.");
        }
    }
};

window.renderDashboardBuilder = function(container, configStr) {
    let config = [];
    try {
        if (configStr) config = JSON.parse(configStr);
    } catch(e) { console.error("Napaka pri branju dashboard configa", e); }

    const DEFAULT_CONFIG = [
        { id: 'kpi_cards', type: 'kpi', width: 'full', title: 'KPI Povzetek' },
        { id: 'charts', type: 'charts', width: 'full', title: 'Grafi poslovanja' },
        { id: 'terjatve', type: 'table', content: 'terjatve', width: 'half', title: 'Odprte terjatve' },
        { id: 'obveznosti', type: 'table', content: 'obveznosti', width: 'half', title: 'Neplačane obveznosti' }
    ];

    if (!config || config.length === 0) {
        config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
    }

    const blockTypes = [
        { val: 'kpi', lbl: 'KPI Kartice (Povzetek)' },
        { val: 'charts', lbl: 'Grafi (Izdani/Prejeti)' },
        { val: 'table', lbl: 'Tabela s podatki' },
        { val: 'shortcuts', lbl: 'Hitre povezave' }
    ];

    const tableContents = [
        { val: 'terjatve', lbl: 'Odprte terjatve' },
        { val: 'obveznosti', lbl: 'Neplačane obveznosti' },
        { val: 'zadnji_dokumenti', lbl: 'Zadnjih 10 dokumentov' },
        { val: 'izdani_racuni', lbl: 'Zadnjih 10 izdanih računov' },
        { val: 'prejeti_racuni', lbl: 'Zadnjih 10 prejetih računov' },
        { val: 'partnerji', lbl: 'Seznam partnerjev (zadnjih 10)' },
        { val: 'artikli', lbl: 'Seznam artiklov (zadnjih 10)' },
        { val: 'izpiski', lbl: 'Bančni izpiski (zadnjih 10)' }
    ];

    const widths = [
        { val: 'full', lbl: 'Polna širina (100%)' },
        { val: 'half', lbl: 'Polovična širina (50%)' }
    ];

    function renderBlocks() {
        let html = `
            <div style="max-width: 900px; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); border-top: 6px solid var(--primary-blue);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                    <h3 style="margin: 0; color: var(--primary-blue); font-weight: 800;">Urejevalnik nadzorne plošče</h3>
                    <button class="btn" style="background: #f1f3f5; color: #495057;" onclick="window.resetDbConfig()">Ponastavi na privzeto</button>
                </div>
                <p style="margin-bottom: 30px; color: #868e96; font-size: 0.95em;">Prilagodite gradnike, ki jih želite videti na vstopni strani aplikacije. Gradnike lahko dodajate, brišete in premikate.</p>
                
                <div id="db-blocks-list" style="display: flex; flex-direction: column; gap: 20px; margin-bottom: 30px;">
                    ${config.map((b, i) => `
                        <div class="db-builder-block" style="display: flex; gap: 20px; align-items: flex-start; background: #f8f9fa; padding: 20px; border-radius: 12px; border: 1px solid #e9ecef; transition: all 0.2s;">
                            <div style="cursor: move; color: #dee2e6; font-size: 1.5em; margin-top: 10px;">⋮⋮</div>
                            <div style="flex: 1;">
                                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 15px; margin-bottom: 15px;">
                                    <div>
                                        <label style="font-size: 0.8rem; font-weight: 700; color: #495057; display: block; margin-bottom: 5px;">Naslov gradnika</label>
                                        <input type="text" value="${b.title || ''}" onchange="window.updateDbBlock(${i}, 'title', this.value)" style="width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 6px; font-size: 0.9em;">
                                    </div>
                                    <div>
                                        <label style="font-size: 0.8rem; font-weight: 700; color: #495057; display: block; margin-bottom: 5px;">Vrsta</label>
                                        <select onchange="window.updateDbBlock(${i}, 'type', this.value)" style="width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 6px; font-size: 0.9em; background: white;">
                                            ${blockTypes.map(t => `<option value="${t.val}" ${b.type === t.val ? 'selected' : ''}>${t.lbl}</option>`).join('')}
                                        </select>
                                    </div>
                                </div>
                                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                                    <div>
                                        <label style="font-size: 0.8rem; font-weight: 700; color: #495057; display: block; margin-bottom: 5px;">Širina</label>
                                        <select onchange="window.updateDbBlock(${i}, 'width', this.value)" style="width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 6px; font-size: 0.9em; background: white;">
                                            ${widths.map(w => `<option value="${w.val}" ${b.width === w.val ? 'selected' : ''}>${w.lbl}</option>`).join('')}
                                        </select>
                                    </div>
                                    ${b.type === 'table' ? `
                                    <div>
                                        <label style="font-size: 0.8rem; font-weight: 700; color: #495057; display: block; margin-bottom: 5px;">Vsebina</label>
                                        <select onchange="window.updateDbBlock(${i}, 'content', this.value)" style="width: 100%; padding: 8px 12px; border: 1px solid #ced4da; border-radius: 6px; font-size: 0.9em; background: white;">
                                            ${tableContents.map(tc => `<option value="${tc.val}" ${b.content === tc.val ? 'selected' : ''}>${tc.lbl}</option>`).join('')}
                                        </select>
                                    </div>
                                    ` : '<div></div>'}
                                </div>
                            </div>
                            <div style="display: flex; flex-direction: column; gap: 8px;">
                                <button class="icon-btn" onclick="window.moveDbBlock(${i}, -1)" title="Premakni gor" ${i === 0 ? 'disabled' : ''} style="background: white;">↑</button>
                                <button class="icon-btn" onclick="window.moveDbBlock(${i}, 1)" title="Premakni dol" ${i === config.length - 1 ? 'disabled' : ''} style="background: white;">↓</button>
                                <button class="icon-btn btn-red" onclick="window.removeDbBlock(${i})" title="Odstrani gradnik" style="margin-top: 5px;">${ICONS.delete}</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                
                <div style="display: flex; gap: 15px; border-top: 1px solid #eee; padding-top: 25px;">
                    <button class="btn btn-blue" onclick="window.addDbBlock()" style="padding: 10px 20px;">+ Dodaj nov gradnik</button>
                    <button class="btn btn-red" onclick="window.saveDashboardConfig()" style="margin-left: auto; padding: 10px 25px; font-weight: 800; box-shadow: 0 4px 10px rgba(224, 49, 49, 0.2);">SHRANI KONFIGURACIJO</button>
                </div>
            </div>
        `;
        container.innerHTML = html;
    }

    window.updateDbBlock = (index, field, value) => {
        config[index][field] = value;
        if (field === 'type' && value === 'table' && !config[index].content) config[index].content = 'zadnji_dokumenti';
        renderBlocks();
    };

    window.removeDbBlock = (index) => {
        config.splice(index, 1);
        renderBlocks();
    };

    window.moveDbBlock = (index, dir) => {
        const target = index + dir;
        if (target < 0 || target >= config.length) return;
        const temp = config[index];
        config[index] = config[target];
        config[target] = temp;
        renderBlocks();
    };

    window.addDbBlock = () => {
        config.push({ id: 'new_' + Date.now(), type: 'table', content: 'zadnji_dokumenti', width: 'full', title: 'Nov gradnik' });
        renderBlocks();
    };

    window.resetDbConfig = () => {
        if (confirm("Ali želite ponastaviti nadzorno ploščo na privzete nastavitve?")) {
            config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
            renderBlocks();
        }
    };

    window.saveDashboardConfig = async () => {
        try {
            // Pridobimo trenutne nastavitve, da ne prepišemo drugih polj
            const res = await fetch('/api/nastavitve');
            const current = await res.json();
            
            // Odstranimo 'id' če obstaja v payloadu, da ne zmedemo Pydantica (čeprav bi moral ignorirati)
            const { id, ...cleanCurrent } = current;
            
            const payload = {
                ...cleanCurrent,
                dashboard_config: JSON.stringify(config)
            };
            
            const saveRes = await fetch('/api/nastavitve', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (saveRes.ok) {
                alert("Konfiguracija nadzorne plošče je bila uspešno shranjena.");
                // Osvežimo podatek v nastavitvah, če bi jih kdo drug bral
                renderNastavitve('nadzorna_plosca');
            } else {
                const errData = await saveRes.json();
                console.error("Napaka pri shranjevanju:", errData);
                alert("Napaka pri shranjevanju. Preverite konzolo za podrobnosti.");
            }
        } catch(e) {
            console.error(e);
            alert("Napaka pri komunikaciji s strežnikom.");
        }
    };

    renderBlocks();
};



window.shraniVseEpostaNastavitve = async () => {
    const cRes = await fetch('/api/nastavitve');
    const current = await cRes.json();
    const payload = {
        ...current,
        smtp_server: document.getElementById('smtp_server').value,
        smtp_port: parseInt(document.getElementById('smtp_port').value) || 587,
        smtp_username: document.getElementById('smtp_username').value,
        smtp_password: document.getElementById('smtp_password').value,
        smtp_use_tls: document.getElementById('smtp_use_tls').checked,
        email_template_racun: document.getElementById('email_template_racun').value,
        email_template_ponudba: document.getElementById('email_template_ponudba').value,
        email_template_dobropis: document.getElementById('email_template_dobropis').value,
        email_template_opomin: document.getElementById('email_template_opomin').value
    };
    try {
        const res = await fetch('/api/nastavitve', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert("Nastavitve e-pošte in predloge so shranjene.");
        } else {
            alert("Napaka pri shranjevanju.");
        }
    } catch (e) { alert("Napaka pri shranjevanju."); }
};

window.shraniNastavitveEposte = async () => {
    const cRes = await fetch('/api/nastavitve');
    const current = await cRes.json();
    const payload = {
        ...current,
        smtp_server: document.getElementById('smtp_server').value,
        smtp_port: parseInt(document.getElementById('smtp_port').value) || 587,
        smtp_username: document.getElementById('smtp_username').value,
        smtp_password: document.getElementById('smtp_password').value,
        smtp_use_tls: document.getElementById('smtp_use_tls').checked
    };
    try {
        const res = await fetch('/api/nastavitve', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert("SMTP nastavitve shranjene.");
        } else {
            alert("Napaka pri shranjevanju.");
        }
    } catch (e) { alert("Napaka pri shranjevanju."); }
};

window.shraniNastavitveEmailPredloge = async () => {
    const cRes = await fetch('/api/nastavitve');
    const current = await cRes.json();
    const payload = {
        ...current,
        email_template_racun: document.getElementById('email_template_racun').value,
        email_template_ponudba: document.getElementById('email_template_ponudba').value,
        email_template_dobropis: document.getElementById('email_template_dobropis').value,
        email_template_opomin: document.getElementById('email_template_opomin').value
    };
    try {
        const res = await fetch('/api/nastavitve', {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            alert("Predloge e-pošte shranjene.");
        } else {
            alert("Napaka pri shranjevanju.");
        }
    } catch (e) { alert("Napaka pri shranjevanju."); }
};

window.testirajSMTP = async () => {
    const payload = {
        smtp_server: document.getElementById('smtp_server').value,
        smtp_port: parseInt(document.getElementById('smtp_port').value) || 587,
        smtp_username: document.getElementById('smtp_username').value,
        smtp_password: document.getElementById('smtp_password').value,
        smtp_use_tls: document.getElementById('smtp_use_tls').checked
    };
    try {
        // Obvestilo uporabniku, da testiranje poteka
        document.body.style.cursor = 'wait';
        const res = await fetch('/api/nastavitve/test_smtp', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        document.body.style.cursor = 'default';
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
        } else {
            alert(data.detail || "Napaka pri testiranju povezave.");
        }
    } catch (e) { 
        document.body.style.cursor = 'default';
        alert("Napaka pri komunikaciji."); 
    }
};

function prenesiPDF(id) {
    window.open(`/api/dokumenti/pdf/${id}`, '_blank');
}

window.izvoziEslogXml = function(id) {
    window.open(`/api/dokumenti/eslog/${id}`, '_blank');
};

async function posljiEmail(id) {
    let allPriloge = [];
    try {
        const res = await fetch(`/api/priloge/dokumenti/${id}`);
        allPriloge = await res.json();
    } catch (e) { console.error("Napaka pri pridobivanju prilog:", e); }

    // Filtriramo avtomatsko generirane PDF-je (da jih ne pošiljamo dvojno)
    const extraPriloge = allPriloge.filter(p => {
        const name = (p.original_name || "").toLowerCase();
        const isAuto = name.includes('racun') || name.includes('račun') || 
                       name.includes('ponudba') || name.includes('dobropis');
        // Če je PDF in ime vsebuje ključno besedo, ga verjetno že pošiljamo kot glavni dokument
        return !(isAuto && name.endsWith('.pdf'));
    });

    if (extraPriloge.length === 0) {
        if (!confirm("Ali želite poslati ta dokument po e-pošti partnerju?")) return;
        return window.izvrsiPosiljanjeEmaila(id, []);
    }

    const priloge = extraPriloge;
    // Prikaži modal za izbiro prilog
    const modal = document.createElement('div');
    modal.id = 'email-attachment-modal';
    modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:20000;";
    
    let prilogeHtml = priloge.map(p => `
        <div style="margin-bottom:10px; display:flex; align-items:center; gap:10px;">
            <input type="checkbox" id="att-${p.id}" value="${p.id}" checked style="width:auto;">
            <label for="att-${p.id}" style="margin:0; cursor:pointer;">${p.original_name}</label>
        </div>
    `).join('');

    modal.innerHTML = `
        <div style="background:white; padding:25px; border-radius:8px; max-width:500px; width:90%; box-shadow:0 10px 25px rgba(0,0,0,0.2);">
            <h3 style="margin-top:0; color:var(--primary-blue);">Izbira prilog za pošiljanje</h3>
            <p style="font-size:0.9em; color:#666; margin-bottom:20px;">Izberite dodatne priloge, ki jih želite vključiti poleg generiranega PDF računa:</p>
            <div style="max-height:300px; overflow-y:auto; margin-bottom:20px; border:1px solid #eee; padding:10px; border-radius:4px;">
                ${prilogeHtml}
            </div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn" onclick="document.getElementById('email-attachment-modal').remove()">Prekliči</button>
                <button class="btn btn-blue" id="confirm-email-send">Pošlji e-pošto</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('confirm-email-send').onclick = async () => {
        const selectedIds = priloge
            .filter(p => document.getElementById(`att-${p.id}`).checked)
            .map(p => p.id);
        
        modal.remove();
        await window.izvrsiPosiljanjeEmaila(id, selectedIds);
    };
}

window.izvrsiPosiljanjeEmaila = async (id, prilogeIds) => {
    try {
        const res = await fetch(`/api/dokumenti/send_email/${id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ priloge_ids: prilogeIds })
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
        } else {
            const errorMsg = typeof data.detail === 'object' ? JSON.stringify(data.detail) : (data.detail || "Napaka pri pošiljanju.");
            alert(errorMsg);
        }
    } catch (e) {
        alert("Napaka pri pošiljanju.");
    }
};

window.posljiOpomin = async (id) => {
    if (!confirm("Ali želite poslati opomin za ta račun partnerju?")) return;
    try {
        const res = await fetch(`/api/dokumenti/send_reminder/${id}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'}
        });
        const data = await res.json();
        if (res.ok) {
            alert(data.message);
        } else {
            const errorMsg = typeof data.detail === 'object' ? JSON.stringify(data.detail) : (data.detail || "Napaka pri pošiljanju opomina.");
            alert(errorMsg);
        }
    } catch (e) {
        alert("Napaka pri pošiljanju opomina.");
    }
};

// --- KONTNI NAČRT UI ---
async function renderKontniNacrtUI(targetId = null) {
    const listContainer = targetId ? document.getElementById(targetId) : contentDiv;
    if (!listContainer) return;

    listContainer.innerHTML = `
        <div style="max-width: 800px; background: white; padding: 25px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border-top: 4px solid var(--primary-blue);">
            <h3 style="margin-bottom: 20px; color: var(--primary-blue);">Kontni načrt</h3>
            <p style="margin-bottom: 20px; color: var(--text-muted); font-size: 0.9em;">Upravljajte s konti, ki se bodo pojavljali kot predlogi pri vnosu dokumentov.</p>
            
            <div id="konti-list-ui" style="margin-bottom: 20px;">Nalagam...</div>
            
            <form onsubmit="window.shraniKonto(event)" style="background:#f8f9fa; padding:15px; border-radius:4px; border:1px solid var(--border-color);">
                <input type="hidden" id="ko_id" value="">
                <div style="display:flex; gap:10px;">
                    <div class="form-group" style="flex:1">
                        <label>Številka (npr. 760)</label>
                        <input type="text" id="ko_stevilka" required>
                    </div>
                    <div class="form-group" style="flex:2">
                        <label>Naziv (npr. Prihodki od prodaje)</label>
                        <input type="text" id="ko_naziv" required>
                    </div>
                </div>
                <div class="form-group">
                    <label>Opis (neobvezno)</label>
                    <input type="text" id="ko_opis">
                </div>
                <div style="display:flex; gap:10px;">
                    <button type="submit" class="btn btn-blue" id="btn-save-konto">Dodaj konto</button>
                    <button type="button" class="btn" id="btn-cancel-konto" style="display:none; background:#ccc;" onclick="window.ponastaviFormuKonto()">Prekliči</button>
                </div>
            </form>
        </div>
    `;

    await osveziKontiUI();
}

async function osveziKontiUI() {
    const listDiv = document.getElementById('konti-list-ui');
    if (!listDiv) return;
    try {
        const res = await fetch('/api/konti');
        const konti = await res.json();
        
        if (konti.length === 0) {
            listDiv.innerHTML = '<p style="color:#888;">Ni definiranih kontov.</p>';
            return;
        }

        let html = '<table style="font-size:0.9em;"><thead><tr><th width="40"><input type="checkbox" onclick="window.toggleAllSelection(this.checked, \'konti\')"></th><th>Št.</th><th>Naziv</th><th width="50"></th></tr></thead><tbody>';
        konti.forEach(k => {
            const isChecked = window.appSelection.ids.includes(k.id) ? 'checked' : '';
            const escapedNaziv = k.naziv.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const escapedOpis = (k.opis || "").replace(/'/g, "\\'").replace(/"/g, '&quot;');
            const escapedStevilka = k.stevilka.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            html += `
                <tr>
                    <td><input type="checkbox" class="row-checkbox" data-id="${k.id}" ${isChecked} onclick="window.toggleItemSelection(${k.id}, 'konti')"></td>
                    <td style="font-weight:bold;">${k.stevilka}</td>
                    <td>${k.naziv} ${k.opis ? `<br><small style="color:#888">${k.opis}</small>` : ''}</td>
                    <td style="text-align:right; white-space:nowrap;">
                        <button class="btn" onclick="window.napolniKontoForm(${k.id}, '${escapedStevilka}', '${escapedNaziv}', '${escapedOpis}')" style="background:#f1f3f5; color:var(--primary-blue); border:1px solid #dee2e6; padding:2px 6px; font-size:0.8em;">Uredi</button>
                        <button class="btn btn-red" onclick="window.izbrisiKonto(${k.id})" style="padding:2px 6px; font-size:0.8em; margin-left:5px;">X</button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        listDiv.innerHTML = html;
        
        // Osveži še datalist za autocomplete
        await osveziKontiDatalist();
    } catch (e) { listDiv.innerHTML = 'Napaka pri nalaganju.'; }
}

window.napolniKontoForm = function(id, stevilka, naziv, opis) {
    document.getElementById('ko_id').value = id;
    document.getElementById('ko_stevilka').value = stevilka;
    document.getElementById('ko_naziv').value = naziv;
    document.getElementById('ko_opis').value = opis;
    document.getElementById('btn-save-konto').innerText = "Shrani spremembe";
    document.getElementById('btn-cancel-konto').style.display = "block";
}

window.ponastaviFormuKonto = function() {
    document.getElementById('ko_id').value = '';
    document.getElementById('ko_stevilka').value = '';
    document.getElementById('ko_naziv').value = '';
    document.getElementById('ko_opis').value = '';
    document.getElementById('btn-save-konto').innerText = "Dodaj konto";
    document.getElementById('btn-cancel-konto').style.display = "none";
}

window.shraniKonto = async function(e) {
    e.preventDefault();
    const id = document.getElementById('ko_id').value;
    const payload = {
        stevilka: document.getElementById('ko_stevilka').value,
        naziv: document.getElementById('ko_naziv').value,
        opis: document.getElementById('ko_opis').value
    };
    try {
        const url = id ? `/api/konti/${id}` : '/api/konti';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            window.ponastaviFormuKonto();
            await osveziKontiUI();
        } else {
            const err = await res.json();
            alert("Napaka: " + (err.detail || "Neznana napaka"));
        }
    } catch (e) { alert("Napaka pri komunikaciji s strežnikom."); }
};

window.izbrisiKonto = async function(id) {
    if (!confirm("Izbrišem ta konto iz seznama predlogov?")) return;
    try {
        const res = await fetch(`/api/konti/${id}`, { method: 'DELETE' });
        if (res.ok) await osveziKontiUI();
    } catch (e) { alert("Napaka pri brisanju."); }
};

// Other modules
async function renderOsnovnaSredstva() {
    contentDiv.innerHTML = '<p>Nalagam...</p>';
    try {
        const res = await fetch('/api/osnovna_sredstva');
        const data = await res.json();
        
        const sortFields = [
            {key: 'datum_nabave', label: 'Datum nabave'},
            {key: 'naziv', label: 'Naziv'},
            {key: 'nabavna_vrednost', label: 'Nabavna vrednost'}
        ];

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
                <h2 style="margin:0; color:var(--primary-blue);">Osnovna sredstva</h2>
                <div style="display: flex; gap: 15px; align-items: center;">
                    ${window.renderSortControls('osnovna_sredstva', sortFields, 'window.renderOsnovnaSredstva()')}
                    <button class="btn btn-blue" onclick="showDodajOsnovnoSredstvo()">+ Novo osnovno sredstvo</button>
                </div>
            </div>
            <div style="display: flex; gap: 10px; margin-bottom: 20px; background:#f8f9fa; padding:15px; border-radius:8px; border:1px solid #dee2e6;">
                <button class="btn" style="background:#5c7cfa; color:white;" onclick="knjiziAmortizacijoIzbrana()">Knjizi amortizacijo</button>
                <button class="btn" style="background:#f08c00; color:white;" onclick="razknjiziAmortizacijo()">Razknjizi amortizacijo</button>
                <div style="margin-left:auto; align-self:center; font-size:0.9em; color:#666;">Amortizacija se knjizi za izbrana (obkljukana) osnovna sredstva ali za vsa, ce ni izbrano nobeno. Drobni inventar se izpusti.</div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th width="40"><input type="checkbox" onclick="window.toggleAllSelection(this.checked, 'osnovna_sredstva')"></th>
                        <th>Inv. št.</th>
                        <th>Tip</th>
                        <th>Naziv</th>
                        <th>Datum nabave</th>
                        <th>Aktiven</th>
                        <th>Amort. skupina</th>
                        <th style="text-align:right">Nabavna vr.</th>
                        <th style="text-align:right">Odpisana vr.</th>
                        <th style="text-align:right">Sedanja vr.</th>
                        <th width="80" style="text-align:right">Akcije</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (data.length === 0) {
            html += `<tr><td colspan="10" style="text-align:center">Ni vnesenih osnovnih sredstev</td></tr>`;
        } else {
            let sortirano = window.sortAppData(data, 'osnovna_sredstva');
            const today = new Date();
            sortirano.forEach(x => {
                const isChecked = window.appSelection.ids.includes(x.id) ? 'checked' : '';
                let odpisana = 0;
                if(x.datum_nabave) {
                    const nabava = new Date(x.datum_nabave);
                    const diffTime = Math.abs(today - nabava);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const years = diffDays / 365.25;
                    odpisana = x.nabavna_vrednost * (x.stopnja_amortizacije / 100) * years;
                    if(odpisana > x.nabavna_vrednost) odpisana = x.nabavna_vrednost;
                }
                const sedanja = x.nabavna_vrednost - odpisana;
                
                const aktivenTag = x.aktiven !== false ? 
                    '<span style="display:inline-block; padding:2px 8px; border-radius:10px; font-size:0.8em; font-weight:600; background:#eebf; color:#2b8a3e;">DA</span>' : 
                    '<span style="display:inline-block; padding:2px 8px; border-radius:10px; font-size:0.8em; font-weight:600; background:#ffe3e3; color:#e03131;">NE</span>';

                html += `<tr>
                    <td style="padding:10px;"><input type="checkbox" class="row-checkbox" data-id="${x.id}" ${isChecked} onclick="window.toggleItemSelection(${x.id}, 'osnovna_sredstva')"></td>
                    <td style="padding:10px; font-weight:bold; color:var(--primary-blue); cursor:pointer; text-decoration:underline;" onclick='showDodajOsnovnoSredstvo(${JSON.stringify(x).replace(/'/g, "&apos;")})'>${x.inventarna_stevilka || ''}</td>
                    <td style="padding:10px;"><span style="background:${x.tip === 'DI' ? '#fff3cd' : '#e2e3e5'}; padding:3px 6px; border-radius:4px; font-size:0.85em; font-weight:bold;">${x.tip === 'DI' ? 'DI' : 'OS'}</span></td>
                    <td style="padding:10px;">${x.naziv}</td>
                    <td style="padding:10px; white-space:nowrap;">${formatDateJS(x.datum_nabave)}</td>
                    <td style="padding:10px;">${aktivenTag}</td>
                    <td style="padding:10px; color:#666;">${x.amortizacijska_skupina || ''} <span style="font-size:0.9em;">(${x.stopnja_amortizacije} %)</span></td>
                    <td style="padding:10px; text-align:right;">${formatMoneyJS(x.nabavna_vrednost)}</td>
                    <td style="padding:10px; text-align:right; color:#e03131;">${formatMoneyJS(odpisana)}</td>
                    <td style="padding:10px; text-align:right; font-weight:bold; color:var(--primary-blue);">${formatMoneyJS(sedanja)}</td>
                    <td class="action-buttons">
                        <button class="icon-btn btn-red" onclick="window.brisiOsnovnoSredstvo(${x.id})" title="Briši">${ICONS.delete}</button>
                    </td>
                </tr>`;
            });
        }
        html += `</tbody></table>`;
        contentDiv.innerHTML = html;
    } catch(e) { contentDiv.innerHTML = '<p>Napaka pri nalaganju osnovnih sredstev.</p>'; }
}

window.showDodajOsnovnoSredstvo = async function(editData = null) {
    const isEdit = !!editData;
    const title = isEdit ? 'Uredi osnovno sredstvo' : 'Novo osnovno sredstvo';
    let autoInv = '001';
    
    if(!isEdit) {
        try {
            const res = await fetch('/api/osnovna_sredstva/next_inv');
            if(res.ok) {
                const data = await res.json();
                autoInv = data.stevilka;
            }
        } catch(e) {}
    }

    const innerHtml = `
            <form onsubmit="shraniOsnovnoSredstvo(event, ${isEdit ? editData.id : 'null'})">
                
                <div style="display:flex; gap:15px;">
                    <div class="form-group" style="flex:1">
                        <label>Inventarna številka</label>
                        <input type="text" id="os_inv" value="${editData?.inventarna_stevilka || autoInv}" required>
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Tip sredstva</label>
                        <select id="os_tip">
                            <option value="OS" ${(!editData || editData.tip !== 'DI') ? 'selected' : ''}>Osnovno sredstvo (OS)</option>
                            <option value="DI" ${(editData?.tip === 'DI') ? 'selected' : ''}>Drobni inventar (DI)</option>
                        </select>
                    </div>
                </div>

                <div class="form-group">
                    <label>Naziv sredstva *</label>
                    <input type="text" id="os_naziv" value="${editData?.naziv || ''}" required>
                </div>
                
                <div class="form-group" style="flex-direction:row; align-items:center; gap:8px; display:flex;">
                    <input type="checkbox" id="os_aktiven" ${!isEdit || editData?.aktiven !== false ? 'checked' : ''} style="width:auto; margin:0;">
                    <label for="os_aktiven" style="margin:0; cursor:pointer; color:#333; font-weight:bold;">Aktivno osnovno sredstvo</label>
                </div>

                <div style="display:flex; gap:15px; margin-top:15px;">
                    <div class="form-group" style="flex:2">
                        <label>Amortizacijska skupina</label>
                        <input type="text" id="os_skupina" value="${editData?.amortizacijska_skupina || ''}" placeholder="Npr. Računalniška oprema">
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Stopnja amortizacije (%)</label>
                        <input type="text" id="os_stopnja" value="${editData ? formatNumberJS(editData.stopnja_amortizacije) : '20,00'}" required>
                    </div>
                </div>

                <div style="display:flex; gap:15px;">
                    <div class="form-group" style="flex:1">
                        <label>Datum nabave</label>
                        <input type="text" id="os_datum" value="${editData ? formatDateJS(editData.datum_nabave) : formatDateJS(new Date().toISOString().split('T')[0])}" placeholder="DD.MM.YYYY" required>
                    </div>
                    <div class="form-group" style="flex:1">
                        <label>Nabavna vrednost (€)</label>
                        <input type="text" id="os_vrednost" value="${editData ? formatNumberJS(editData.nabavna_vrednost) : ''}" required placeholder="0,00">
                    </div>
                </div>
                
                <div style="margin-top:25px; padding-top:15px; border-top:1px solid #eee; display:flex; gap:10px;">
                    <button type="submit" class="btn btn-blue">${isEdit ? 'Shrani spremembe' : 'Shrani osnovno sredstvo'}</button>
                    <button type="button" class="btn" style="background:#eee; color:#333;" onclick="window.zapriGlavniPopup()">Prekliči</button>
                    ${isEdit ? `<button type="button" class="btn btn-red" style="margin-left:auto;" onclick="brisiOsnovnoSredstvo(${editData.id})">Briši</button>` : ''}
                </div>
            </form>
    `;
    window.odpriGlavniPopup(title, innerHtml);
    window.initDatePickers();
};

window.shraniOsnovnoSredstvo = async function(e, id) {
    e.preventDefault();
    const payload = {
        inventarna_stevilka: document.getElementById('os_inv').value.trim(),
        tip: document.getElementById('os_tip').value,
        naziv: document.getElementById('os_naziv').value.trim(),
        aktiven: document.getElementById('os_aktiven').checked,
        amortizacijska_skupina: document.getElementById('os_skupina').value.trim(),
        stopnja_amortizacije: parseNumberJS(document.getElementById('os_stopnja').value),
        datum_nabave: parseDateISO(document.getElementById('os_datum').value),
        nabavna_vrednost: parseNumberJS(document.getElementById('os_vrednost').value),
        trenutna_vrednost: 0
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/osnovna_sredstva/${id}` : '/api/osnovna_sredstva';

    try {
        const res = await fetch(url, {
            method: method,
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if(res.ok) {
            window.zapriGlavniPopup();
        } else {
            alert('Napaka pri shranjevanju.');
        }
    } catch(err) {
        alert('Napaka: ' + err.message);
    }
};

window.brisiOsnovnoSredstvo = async function(id) {
    if(!confirm("Ste prepričani, da želite izbrisati to osnovno sredstvo?")) return;
    try {
        const res = await fetch(`/api/osnovna_sredstva/${id}`, { method:'DELETE' });
        if(res.ok) renderOsnovnaSredstva();
    } catch(e) {}
};

// --- ZAPOSLENI ---
window.renderZaposleni = async function() {
    titleEl.textContent = "Zaposleni";
    contentDiv.innerHTML = '<p>Nalagam...</p>';
    try {
        const res = await fetch('/api/zaposleni');
        const data = await res.json();
        
        const sortFields = [
            {key: 'priimek_ime', label: 'Priimek in ime'},
            {key: 'oddelek', label: 'Oddelek'},
            {key: 'trr', label: 'TRR'}
        ];

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
                <h2 style="margin:0; color:var(--primary-blue);">Seznam zaposlenih</h2>
                <div style="display: flex; gap: 15px; align-items: center;">
                    ${window.renderSortControls('zaposleni', sortFields, 'window.renderZaposleni()')}
                    <button class="btn btn-blue" onclick="window.showDodajZaposleni()">+ Dodaj zaposlenega</button>
                </div>
            </div>
            <table>
                <thead><tr>
                    <th width="40"><input type="checkbox" onclick="window.toggleAllSelection(this.checked, 'zaposleni')"></th>
                    <th>Ime in priimek</th>
                    <th>Davčna št. / DM</th>
                    <th>IBAN</th>
                    <th style="text-align:center;">Dopust</th>
                    <th width="80" style="text-align:right">Akcije</th>
                </tr></thead><tbody>
        `;
        if(data.length===0) html += '<tr><td colspan="6" style="text-align:center; padding:15px; color:#868e96;">Ni zaposlenih</td></tr>';
        else {
            let sortirano = window.sortAppData(data, 'zaposleni');
            sortirano.forEach(z => {
                const isChecked = window.appSelection.ids.includes(z.id) ? 'checked' : '';
                html += `<tr>
                    <td style="padding:10px;"><input type="checkbox" class="row-checkbox" data-id="${z.id}" ${isChecked} onclick="window.toggleItemSelection(${z.id}, 'zaposleni')"></td>
                    <td style="padding:10px; font-weight:600; cursor:pointer; color:var(--primary-blue); text-decoration:underline;" onclick='window.showDodajZaposleni(${JSON.stringify(z).replace(/'/g,"&apos;")})'>${z.ime_priimek}</td>
                    <td style="padding:10px; font-size:0.9em;">${z.davcna_stevilka||''}<br><span style="color:#666">${z.delovno_mesto||''}</span></td>
                    <td style="padding:10px; font-size:0.9em;">${z.iban||''}</td>
                    <td style="padding:10px; text-align:center; font-weight:bold; color:var(--primary-blue);">${z.dopust_odmerjen || 20} dni</td>
                    <td class="action-buttons">
                        <button class="icon-btn btn-red" onclick="window.brisiZaposleni(${z.id})" title="Briši">${ICONS.delete}</button>
                    </td></tr>`;
            });
        }
        html += '</tbody></table>';
        contentDiv.innerHTML = html;
    } catch(e) { contentDiv.innerHTML = '<p>Napaka</p>'; }
}

window.showDodajZaposleni = function(editData = null) {
    const isEdit = !!editData;
    const title = isEdit ? 'Uredi zaposlenega' : 'Nov zaposleni';
    
    const innerHtml = `
            <form onsubmit="window.shraniZaposleni(event, ${isEdit ? editData.id : 'null'})">
                <div class="form-group"><label>Ime in priimek *</label><input type="text" id="z_ime" value="${editData?.ime_priimek || ''}" required></div>
                <div style="display:flex; gap:10px;">
                    <div class="form-group" style="flex:2"><label>Naslov (Ulica in hišna št.)</label><input type="text" id="z_naslov" value="${editData?.naslov || ''}"></div>
                    <div class="form-group" style="flex:1"><label>Pošta in kraj</label><input type="text" id="z_posta_kraj" value="${editData?.posta_kraj || ''}" placeholder="npr. 2392 Mežica"></div>
                </div>
                <div style="display:flex; gap:10px; align-items:flex-end;">
                    <div class="form-group" style="flex:1"><label>Davčna številka</label><input type="text" id="z_davcna" value="${editData?.davcna_stevilka || ''}"></div>
                    <div class="form-group" style="flex:1"><label>Delovno mesto</label><input type="text" id="z_delovno" value="${editData?.delovno_mesto || ''}"></div>
                    <div class="form-group" style="flex:1; position:relative;">
                        <label>Razdalja do podjetja (km)</label>
                        <div style="display:flex; gap:5px;">
                            <input type="number" step="0.1" id="z_razdalja" value="${editData?.razdalja_do_podjetja !== undefined ? editData.razdalja_do_podjetja : 0.0}" style="flex:1;">
                            <button type="button" class="btn" style="background:#e7f5ff; color:#1971c2; border:1px solid #a5d8ff; padding:8px 12px; font-weight:600; font-size:0.9em; white-space:nowrap; transition:0.2s;" onclick="window.zaposleniIzracunajRazdaljoOSM(this)">
                                🌍 Izračunaj
                            </button>
                        </div>
                    </div>
                </div>
                <p id="z_osm_info" style="font-size:0.85em; margin:5px 0 10px 0; color:#1971c2; font-style:italic; display:none;">Računam razdaljo s pomočjo OpenStreetMap...</p>
                <div class="form-group"><label>TRR / IBAN</label><input type="text" id="z_iban" value="${editData?.iban || ''}"></div>
                
                <div style="background:#f8f9fa; padding:15px; border-radius:6px; margin-top:20px; border:1px solid #e9ecef;">
                    <h4 style="margin:0 0 15px 0; color:#495057;">Odmera letnega dopusta</h4>
                    <div style="display:flex; gap:15px; flex-wrap:wrap;">
                        <div class="form-group" style="flex:1; min-width:140px;">
                            <label>Datum rojstva</label>
                            <input type="text" id="z_rojstvo" value="${editData?.datum_rojstva ? formatDateJS(editData.datum_rojstva) : ''}" placeholder="DD.MM.YYYY" onchange="window.osveziIzracunDopusta()">
                        </div>
                        <div class="form-group" style="flex:1; min-width:140px;">
                            <label>Št. otrok (< 15 let)</label>
                            <input type="number" id="z_otroc" value="${editData?.stevilo_otrok || 0}" min="0" oninput="window.osveziIzracunDopusta()">
                        </div>
                        <div class="form-group" style="flex:1; min-width:140px;">
                            <label>Delovna doba (leta)</label>
                            <input type="number" id="z_seniority" value="${editData?.delovna_doba_leta || 0}" min="0" oninput="window.osveziIzracunDopusta()">
                        </div>
                    </div>
                    <div style="display:flex; align-items:center; gap:10px; margin:10px 0;">
                        <input type="checkbox" id="z_invalid" ${editData?.invalid_ali_nega ? 'checked' : ''} onchange="window.osveziIzracunDopusta()" style="width:auto; margin:0;">
                        <label for="z_invalid" style="margin:0; font-weight:normal; cursor:pointer;">Status invalida ali nega nega družinskega člana (+3 dni)</label>
                    </div>
                    
                    <hr style="border:none; border-top:1px solid #dee2e6; margin:15px 0;">
                    
                    <div style="display:flex; gap:20px; align-items:flex-end;">
                        <div class="form-group" style="flex:1">
                            <label>Ročni popravek (+/- dni)</label>
                            <input type="number" id="z_dopust_popravek" value="${editData?.dopust_rocni_popravek || 0}" oninput="window.osveziIzracunDopusta()">
                        </div>
                        <div class="form-group" style="flex:1">
                            <label style="font-weight:bold; color:var(--primary-blue);">Skupaj odmerjen dopust</label>
                            <input type="text" id="z_dopust_odmerjen" value="${editData?.dopust_odmerjen || 20}" readonly style="background:#e7f5ff; border:1px solid #a5d8ff; font-weight:bold; color:#1971c2; text-align:center; font-size:1.2em;">
                        </div>
                    </div>
                    <p id="z_dopust_info" style="margin:5px 0 0 0; font-size:0.85em; color:#868e96; font-style:italic;"></p>
                </div>

                <div style="margin-top:25px; display:flex; gap:10px;">
                    <button type="submit" class="btn btn-blue">Shrani zaposlenega</button>
                    <button type="button" class="btn" style="background:#eee; color:#333;" onclick="window.zapriGlavniPopup()">Prekliči</button>
                </div>
            </form>
    `;
    window.odpriGlavniPopup(title, innerHtml);
    window.initDatePickers();
    window.osveziIzracunDopusta();
}

window.osveziIzracunDopusta = function() {
    let base = 20; // Zakonski minimum za 5-dnevni delovnik
    let extra = 0;
    let razlaga = ["Osnova: 20 dni"];

    const rojstvo = document.getElementById('z_rojstvo').value;
    if (rojstvo) {
        const parts = rojstvo.split('.');
        if (parts.length === 3) {
            const birthYear = parseInt(parts[2]);
            const curYear = new Date().getFullYear();
            if (curYear - birthYear >= 50) {
                extra += 1;
                razlaga.push("Starost 50+: +1 dan");
            }
        }
    }

    const otroc = parseInt(document.getElementById('z_otroc').value) || 0;
    if (otroc > 0) {
        extra += otroc;
        razlaga.push(`Otroci: +${otroc} dni`);
    }

    const invalid = document.getElementById('z_invalid').checked;
    if (invalid) {
        extra += 3;
        razlaga.push("Invalidnost/Nega: +3 dni");
    }

    const popravek = parseInt(document.getElementById('z_dopust_popravek').value) || 0;
    if (popravek !== 0) {
        razlaga.push(`Popravek: ${popravek > 0 ? '+' : ''}${popravek} dni`);
    }

    const skupaj = base + extra + popravek;
    document.getElementById('z_dopust_odmerjen').value = skupaj;
    document.getElementById('z_dopust_info').textContent = razlaga.join(" | ");
}

window.shraniZaposleni = async function(e, id) {
    e.preventDefault();
    const pay = {
        ime_priimek: document.getElementById('z_ime').value,
        naslov: document.getElementById('z_naslov').value,
        posta_kraj: document.getElementById('z_posta_kraj').value,
        davcna_stevilka: document.getElementById('z_davcna').value,
        delovno_mesto: document.getElementById('z_delovno').value,
        razdalja_do_podjetja: parseFloat(document.getElementById('z_razdalja').value) || 0.0,
        iban: document.getElementById('z_iban').value,
        datum_rojstva: parseDateISO(document.getElementById('z_rojstvo').value),
        stevilo_otrok: parseInt(document.getElementById('z_otroc').value) || 0,
        invalid_ali_nega: document.getElementById('z_invalid').checked,
        delovna_doba_leta: parseInt(document.getElementById('z_seniority').value) || 0,
        dopust_odmerjen: parseInt(document.getElementById('z_dopust_odmerjen').value) || 20,
        dopust_rocni_popravek: parseInt(document.getElementById('z_dopust_popravek').value) || 0
    };
    try {
        const url = id ? `/api/zaposleni/${id}` : '/api/zaposleni';
        const res = await fetch(url, { method: id ? 'PUT' : 'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(pay) });
        if(res.ok) window.zapriGlavniPopup();
    } catch(e) {}
}

window.brisiZaposleni = async function(id) {
    if(!confirm("Izbrišem zaposlenega?")) return;
    try { await fetch(`/api/zaposleni/${id}`, {method:'DELETE'}); window.renderZaposleni(); } catch(e) {}
}

// --- POTNI NALOGI ---
let loadedZaposleni = [];
let loadedVozila = [];
let potTarife = { kilometrina: 0.43, dnevnica_polna: 27.81, dnevnica_polovicna: 13.88, dnevnica_znizana: 9.69 };

async function loadPNMeta() {
    try {
        const [zRes, vRes, tRes] = await Promise.all([ fetch('/api/zaposleni'), fetch('/api/vozila'), fetch('/api/tarife') ]);
        loadedZaposleni = await zRes.json();
        loadedVozila = await vRes.json();
        potTarife = await tRes.json();
    } catch(e) {}
}

async function renderPotniNalogi() {
    titleEl.textContent = "Potni nalogi";
    contentDiv.innerHTML = '<p>Nalagam...</p>';
    await loadPNMeta();
    try {
        const res = await fetch('/api/potni_nalogi');
        const data = await res.json();
        
        const sortFields = [
            {key: 'datum_odhoda', label: 'Datum odhoda'},
            {key: 'stevilka', label: 'Številka'},
            {key: 'zaposleni_ime', label: 'Zaposleni'},
            {key: 'relacija', label: 'Relacija'},
            {key: 'znesek_skupaj', label: 'Znesek'}
        ];

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
                <h2 style="margin:0; color:var(--primary-blue);">Potni nalogi</h2>
                <div>
                    <button class="btn" style="background:#eee; color:#333; margin-right:10px;" onclick="window.renderZaposleni()">Uredi zaposlene</button>
                    <button class="btn btn-blue" onclick="window.showDodajPN()">+ Nov potni nalog</button>
                </div>
            </div>
            <table>
                <thead><tr>
                    <th width="40"><input type="checkbox" onclick="window.toggleAllSelection(this.checked, 'potni_nalogi')"></th>
                    <th>Št. naloga</th>
                    <th>Datum</th>
                    <th>Zaposleni</th>
                    <th>Namen</th>
                    <th>Relacija</th>
                    <th style="text-align:right;">Za izplačilo</th>
                    <th width="80" style="text-align:right">Akcije</th>
                </tr></thead><tbody>
        `;
        if(data.length===0) html += '<tr><td colspan="8" style="text-align:center; padding:15px; color:#868e96;">Ni potnih nalogov</td></tr>';
        else {
            let sortirano = window.sortAppData(data, 'potni_nalogi');
            sortirano.forEach(p => {
                const isChecked = window.appSelection.ids.includes(p.id) ? 'checked' : '';
                html += `<tr>
                    <td style="padding:10px;"><input type="checkbox" class="row-checkbox" data-id="${p.id}" ${isChecked} onclick="window.toggleItemSelection(${p.id}, 'potni_nalogi')"></td>
                    <td style="font-weight:bold; color:var(--primary-blue); padding:10px; cursor:pointer; text-decoration:underline;" onclick='window.showDodajPN(${JSON.stringify(p).replace(/'/g,"&apos;")})'>${p.stevilka_naloga}</td>
                    <td style="padding:10px; white-space:nowrap;">${formatDateJS(p.datum_izdaje)}</td>
                    <td style="padding:10px;">${p.zaposleni_ime || '/'}</td>
                    <td style="padding:10px;">${p.namen||'/'}</td>
                    <td style="font-size:0.85em; padding:10px;">Od: ${p.relacija_zacetek||''}<br>Do: ${p.relacija_cilj||''}</td>
                    <td style="font-weight:bold; text-align:right; color:#2b8a3e; padding:10px;">${formatMoneyJS(p.skupni_znesek)}</td>
                    <td class="action-buttons">
                        ${p.knjizeno ? 
                            `<button class="icon-btn btn-orange" onclick="knjiziPosamezen(${p.id}, 'razknjizi', 'potni_nalogi')" title="Razknjiži">${ICONS.unbook || '🔓'}</button>` :
                            `<button class="icon-btn btn-green" onclick="knjiziPosamezen(${p.id}, 'knjizi', 'potni_nalogi')" title="Knjiži">${ICONS.book || '📖'}</button>`
                        }
                        <button class="icon-btn btn-red" onclick="window.brisiPotniNalog(${p.id})" title="Briši">${ICONS.delete}</button>
                    </td>
                </tr>`;
            });
        }
        html += '</tbody></table>';
        contentDiv.innerHTML = html;
    } catch(e) { contentDiv.innerHTML = '<p>Napaka</p>'; }
}

window.showDodajPN = async function(editData = null) {
    const isEdit = !!editData;
    const title = isEdit ? 'Uredi potni nalog' : 'Nov potni nalog';
    const trenutnoLeto = getLeto();
    let autoSt = '001-' + trenutnoLeto;
    if(!isEdit) {
        try {
            const r = await fetch(`/api/potni_nalogi/next_stevilka?leto=${trenutnoLeto}`);
            if(r.ok) { const d = await r.json(); autoSt = d.stevilka; }
        } catch(e) {}
    }

    const zapOpts = (window.loadedZaposleni || []).map(z => `<option value="${z.id}" ${editData && editData.zaposleni_id===z.id ? 'selected':''}>${z.ime_priimek}</option>`).join('');
    const vozDataLst = (window.loadedVozila || []).map(v => `<option value="${v}">`).join('');

    const df = (dt) => {
        if(!dt) return '';
        const p = dt.split(' ');
        const d = p[0].split('-');
        if(d.length !== 3) return dt;
        const time = p[1] ? p[1].substring(0, 5) : '00:00';
        return `${d[2]}.${d[1]}.${d[0]} ${time}`;
    };

    const innerHtml = `
        <style>
            .pn-box { background:#f8f9fa; border:1px solid #e9ecef; padding:15px; border-radius:6px; margin-bottom:15px; }
            .pn-row { display:flex; gap:15px; margin-bottom:10px; }
            .pn-row .form-group { margin-bottom:0; flex:1; }
        </style>
            <form onsubmit="window.shraniPN(event, ${isEdit ? editData.id : 'null'})">
                
                <div class="pn-row">
                    <div class="form-group" style="flex:0.5"><label>Številka naloga</label><input type="text" id="pn_st" value="${editData?.stevilka_naloga || autoSt}" required readonly style="background:#f1f3f5;"></div>
                    <div class="form-group"><label>Zaposleni *</label>
                        <select id="pn_zap" required>
                            <option value="">-- Izberi zaposlenega --</option>
                            ${zapOpts}
                        </select>
                    </div>
                </div>

                <div class="pn-row">
                    <div class="form-group"><label>Datum izdaje *</label><input type="text" id="pn_izdaje" value="${editData ? formatDateJS(editData.datum_izdaje) : formatDateJS(new Date().toISOString().substring(0,10))}" placeholder="DD.MM.YYYY" required></div>
                    <div class="form-group" style="flex:2"><label>Namen potovanja</label><input type="text" id="pn_namen" value="${editData?.namen||''}"></div>
                    <div class="form-group"><label>Vozilo</label>
                        <input type="text" id="pn_vozilo" list="pn_voz_list" value="${editData?.vozilo||''}" autocomplete="off">
                        <datalist id="pn_voz_list">${vozDataLst}</datalist>
                    </div>
                </div>

                <div class="pn-box">
                    <h4 style="margin:0 0 10px 0; color:#495057;">Čas potovanja & Dnevnice</h4>
                    <div class="pn-row">
                        <div class="form-group"><label>Odhod (Datum in ura)</label><input type="text" id="pn_odhod" value="${df(editData?.datum_cas_odhoda)}" placeholder="DD.MM.YYYY HH:MM" onchange="window.pnProracunDnevnice()"></div>
                        <div class="form-group"><label>Povratek (Datum in ura)</label><input type="text" id="pn_povratek" value="${df(editData?.datum_cas_povratka)}" placeholder="DD.MM.YYYY HH:MM" onchange="window.pnProracunDnevnice()"></div>
                        <div class="form-group" style="flex:0.5; max-width:120px;">
                            <label>Dnevnica (€)</label>
                            <input type="text" id="pn_znesek_dnevnice" value="${editData?.znesek_dnevnice!==undefined?formatNumberJS(editData.znesek_dnevnice):'0,00'}" style="font-weight:bold; color:var(--primary-blue);" oninput="window.pnSeštevek()">
                        </div>
                    </div>
                    <div id="pn_dnev_info" style="font-size:0.85em; color:#868e96; margin-top:-5px; min-height:15px;"></div>
                </div>

                <div class="pn-box">
                    <h4 style="margin:0 0 10px 0; color:#495057;">Relacija in Kilometrina</h4>
                    <div class="pn-row">
                        <div class="form-group"><label>Začetna točka (naslov)</label><input type="text" id="pn_rel_zac" value="${editData?.relacija_zacetek||''}"></div>
                        <div class="form-group"><label>Ciljna točka (naslov)</label><input type="text" id="pn_rel_cilj" value="${editData?.relacija_cilj||''}"></div>
                    </div>
                    
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                        <input type="checkbox" id="pn_konec_enak" checked style="width:auto; margin:0;" onchange="window.pnToggleKonec(this)">
                        <label for="pn_konec_enak" style="margin:0; font-size:0.9em; cursor:pointer;">Končna točka je enaka začetni (povratna pot)</label>
                    </div>
                    <div class="pn-row" id="pn_konec_box" style="display:none;">
                        <div class="form-group"><label>Končna točka (naslov)</label><input type="text" id="pn_rel_konec" value="${editData?.relacija_konec||''}"></div>
                    </div>

                    <p id="pn_osm_info" style="font-size:0.85em; margin:5px 0; color:#1971c2; font-style:italic; display:none;">Računam razdaljo s pomočjo OpenStreetMap...</p>
                    
                    <button type="button" class="btn" style="background:#e7f5ff; color:#1971c2; border:1px solid #a5d8ff; padding:5px 12px; margin-bottom:10px; width:100%; transition:0.2s;" onclick="window.pnIzracunajRazdaljoOSM(this)">
                        <span style="font-size:1.1em; margin-right:5px;">🌍</span> Samodejno izračunaj razdaljo
                    </button>

                    <div class="pn-row" style="background:#fff; padding:10px; border-radius:4px; border:1px solid #dee2e6;">
                        <div class="form-group" style="flex:0.6">
                            <label>Razdalja (km)</label>
                            <input type="text" id="pn_km" value="${editData ? formatNumberJS(editData.razdalja_km, 1) : '0,0'}" oninput="window.pnProracunKm()">
                        </div>
                        <div class="form-group" style="flex:0.6">
                            <label>Trf. (€/km)</label>
                            <input type="text" id="pn_tarifa_km" value="${formatNumberJS(potTarife.kilometrina)}" oninput="window.pnProracunKm()">
                        </div>
                        <div class="form-group">
                            <label>Znesek kilometrine (€)</label>
                            <input type="text" id="pn_znesek_km" value="${editData ? formatNumberJS(editData.znesek_kilometrine) : '0,00'}" readonly style="background:#f8f9fa;">
                        </div>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; border-top:2px solid var(--primary-blue); padding-top:15px; margin-top:20px;">
                    <div>
                        <div style="font-size:0.9em; color:#868e96; text-transform:uppercase;">Skupni znesek za izplačilo</div>
                        <div style="font-size:1.5em; font-weight:bold; color:#2b8a3e;"><span id="pn_skupaj_text">${formatMoneyJS(editData?.skupni_znesek||0)}</span></div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button type="button" class="btn" style="background:#eee; color:#333;" onclick="window.zapriGlavniPopup()">Prekliči</button>
                        <button type="submit" class="btn btn-blue">${isEdit ? 'Shrani spremembe' : 'Shrani nalog'}</button>
                    </div>
                </div>
            </form>
    `;
    window.odpriGlavniPopup(title, innerHtml);
    window.initDatePickers();
    
    if(isEdit && editData.relacija_konec && editData.relacija_zacetek !== editData.relacija_konec && editData.relacija_konec !== "Enako_kot_zacetek") {
        const chk = document.getElementById('pn_konec_enak');
        if(chk) {
            chk.checked = false;
            window.pnToggleKonec(chk);
        }
    }
};

window.pnToggleKonec = function(checkbox) {
    const box = document.getElementById('pn_konec_box');
    box.style.display = checkbox.checked ? 'none' : 'flex';
};

window.pnProracunDnevnice = function() {
    const odhodStr = document.getElementById('pn_odhod').value;
    const povratekStr = document.getElementById('pn_povratek').value;
    const info = document.getElementById('pn_dnev_info');
    let znesek = 0;
    
    if(odhodStr && povratekStr) {
        // Pretvori DD.MM.YYYY HH:MM v nekaj, kar bo Date razumel (YYYY-MM-DDTHH:MM)
        const parseToDate = (s) => {
            const p = s.split(' ');
            if(p.length < 2) return null;
            const d = p[0].split('.');
            if(d.length !== 3) return null;
            return new Date(`${d[2]}-${d[1]}-${d[0]}T${p[1]}`);
        };
        
        const d1 = parseToDate(odhodStr);
        const d2 = parseToDate(povratekStr);
        
        if(d1 && d2) {
            const diffMs = d2 - d1;
            if(diffMs > 0) {
                const skupajUr = diffMs / (1000 * 60 * 60);
                const celiDnevi = Math.floor(skupajUr / 24);
                const ostaleUre = skupajUr % 24;
                
                // Osnovni znesek za cele dni
                znesek = celiDnevi * potTarife.dnevnica_polna;
                let opisOstanka = "";
                
                // Dodatek za ostanek ur po pravilih (6-8h, 8-12h, >12h)
                if (ostaleUre > 12) {
                    znesek += potTarife.dnevnica_polna;
                    opisOstanka = "Polna dnevnica";
                } else if (ostaleUre > 8) {
                    znesek += potTarife.dnevnica_polovicna;
                    opisOstanka = "Polovična dnevnica";
                } else if (ostaleUre > 6) {
                    znesek += potTarife.dnevnica_znizana;
                    opisOstanka = "Znižana dnevnica";
                } else {
                    opisOstanka = celiDnevi > 0 ? "Brez dodatka" : "Dnevnica ne pripada";
                }
                
                if (celiDnevi > 0) {
                    info.textContent = `${celiDnevi} dan/dni + ${ostaleUre.toFixed(1)}h ostanek (${opisOstanka}): Skupaj ${formatNumberJS(znesek)} €`;
                } else {
                    info.textContent = `${skupajUr.toFixed(1)}h: ${opisOstanka}`;
                }
            } else {
                info.textContent = 'Povratek ne more biti pred odhodom!';
            }
        }
    }
    document.getElementById('pn_znesek_dnevnice').value = formatNumberJS(znesek);
    window.pnSeštevek();
};

window.pnProracunKm = function() {
    const km = parseNumberJS(document.getElementById('pn_km').value);
    const tarifa = parseNumberJS(document.getElementById('pn_tarifa_km').value);
    document.getElementById('pn_znesek_km').value = formatNumberJS(km * tarifa);
    window.pnSeštevek();
};

window.pnSeštevek = function() {
    const d = parseNumberJS(document.getElementById('pn_znesek_dnevnice').value);
    const k = parseNumberJS(document.getElementById('pn_znesek_km').value);
    const sum = d + k;
    document.getElementById('pn_skupaj_text').textContent = formatMoneyJS(sum);
};

// --- OSRM in Nominatim logika ---
async function obdelajOSMKoordinate(naslov) {
    if(!naslov) return null;
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(naslov.trim())}&limit=1`);
    const data = await res.json();
    if(data && data.length > 0) {
        return { lon: parseFloat(data[0].lon), lat: parseFloat(data[0].lat) };
    }
    return null;
}

async function dobiOSMRazdaljo(lon1, lat1, lon2, lat2) {
    // API OpenRouteService ali OSRM
    const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${lon1},${lat1};${lon2},${lat2}?overview=false`);
    if(res.ok) {
        const data = await res.json();
        if(data.routes && data.routes.length > 0) {
            return data.routes[0].distance / 1000; // OSRM vraca metre
        }
    }
    return 0;
}

window.pnIzracunajRazdaljoOSM = async function(btn) {
    const zac = document.getElementById('pn_rel_zac').value.trim();
    const cilj = document.getElementById('pn_rel_cilj').value.trim();
    const isPovratna = document.getElementById('pn_konec_enak').checked;
    let konec = '';
    if(!isPovratna) konec = document.getElementById('pn_rel_konec').value.trim();

    if(!zac || !cilj) { alert("Vnesite minimalno začetno točko in cilj!"); return; }

    btn.disabled = true;
    const info = document.getElementById('pn_osm_info');
    info.style.display = 'block';

    try {
        const zacKoor = await obdelajOSMKoordinate(zac);
        const ciljKoor = await obdelajOSMKoordinate(cilj);
        
        if(!zacKoor || !ciljKoor) {
            alert("Sistem ni prepoznal naslova (poskusite dodati kraj in državo, npr. 'Slovenska 1, Ljubljana').");
            btn.disabled = false; info.style.display = 'none'; return;
        }

        let totalKm = await dobiOSMRazdaljo(zacKoor.lon, zacKoor.lat, ciljKoor.lon, ciljKoor.lat);

        if(isPovratna) {
            totalKm *= 2; 
        } else if(konec) {
            const konecKoor = await obdelajOSMKoordinate(konec);
            if(konecKoor) {
                totalKm += await dobiOSMRazdaljo(ciljKoor.lon, ciljKoor.lat, konecKoor.lon, konecKoor.lat);
            } else {
                alert("Sistem ni prepoznal končne točke. Razdalja bo lecitirana do cilja.");
            }
        }

        document.getElementById('pn_km').value = totalKm.toFixed(1);
        window.pnProracunKm();

    } catch(e) {
        alert("Napaka pri povezavi z OpenStreetMap!");
    }
    btn.disabled = false;
    info.style.display = 'none';
};

window.zaposleniIzracunajRazdaljoOSM = async function(btn) {
    const naslov = document.getElementById('z_naslov').value.trim();
    const postaKraj = document.getElementById('z_posta_kraj').value.trim();
    
    if(!naslov || !postaKraj) {
        alert("Za izračun razdalje najprej vnesite naslov ter pošto in kraj zaposlenega!");
        return;
    }
    
    btn.disabled = true;
    const info = document.getElementById('z_osm_info');
    if(info) info.style.display = 'block';
    
    try {
        const res = await fetch('/api/nastavitve');
        if(!res.ok) throw new Error("Ni mogoče pridobiti nastavitev podjetja");
        const nData = await res.json();
        
        const pNaslov = nData.ulica ? nData.ulica.trim() : '';
        const pPostaKraj = nData.posta_kraj ? nData.posta_kraj.trim() : '';
        
        if(!pNaslov || !pPostaKraj) {
            alert("Najprej v Nastavitvah podjetja izpolnite naslov podjetja!");
            btn.disabled = false;
            if(info) info.style.display = 'none';
            return;
        }
        
        const zapNaslovPoln = `${naslov}, ${postaKraj}, Slovenia`;
        const podNaslovPoln = `${pNaslov}, ${pPostaKraj}, Slovenia`;
        
        const zapKoor = await obdelajOSMKoordinate(zapNaslovPoln);
        const podKoor = await obdelajOSMKoordinate(podNaslovPoln);
        
        if(!zapKoor) {
            alert("Sistem ni prepoznal naslova zaposlenega. Poskusite natančneje zapisati ulico, kraj in pošto.");
            btn.disabled = false;
            if(info) info.style.display = 'none';
            return;
        }
        if(!podKoor) {
            alert("Sistem ni prepoznal naslova podjetja v nastavitvah. Preverite nastavitve podjetja.");
            btn.disabled = false;
            if(info) info.style.display = 'none';
            return;
        }
        
        const totalKm = await dobiOSMRazdaljo(zapKoor.lon, zapKoor.lat, podKoor.lon, podKoor.lat);
        
        const inputRazdalja = document.getElementById('z_razdalja');
        if(inputRazdalja) {
            inputRazdalja.value = totalKm.toFixed(1);
        }
    } catch(e) {
        console.error(e);
        alert("Napaka pri povezavi z OpenStreetMap!");
    }
    btn.disabled = false;
    if(info) info.style.display = 'none';
};

window.shraniPN = async function(e, id) {
    e.preventDefault();
    const znesekKm = parseNumberJS(document.getElementById('pn_znesek_km').value);
    const znesekD = parseNumberJS(document.getElementById('pn_znesek_dnevnice').value);
    
    // Obdelaj relacija_konec preden shranimo
    let relKonec = "";
    if (document.getElementById('pn_konec_enak').checked) {
        relKonec = "Enako_kot_zacetek";
    } else {
        relKonec = document.getElementById('pn_rel_konec').value.trim();
    }

    const payload = {
        stevilka_naloga: document.getElementById('pn_st').value.trim(),
        zaposleni_id: parseInt(document.getElementById('pn_zap').value),
        vozilo: document.getElementById('pn_vozilo').value.trim(),
        namen: document.getElementById('pn_namen').value.trim(),
        datum_izdaje: parseDateISO(document.getElementById('pn_izdaje').value),
        datum_cas_odhoda: parseDateTimeISO(document.getElementById('pn_odhod').value),
        datum_cas_povratka: parseDateTimeISO(document.getElementById('pn_povratek').value),
        relacija_zacetek: document.getElementById('pn_rel_zac').value.trim(),
        relacija_cilj: document.getElementById('pn_rel_cilj').value.trim(),
        relacija_konec: relKonec,
        razdalja_km: parseNumberJS(document.getElementById('pn_km').value),
        znesek_kilometrine: znesekKm,
        znesek_dnevnice: znesekD,
        skupni_znesek: znesekKm + znesekD
    };

    try {
        const method = id ? 'PUT' : 'POST';
        const url = id ? `/api/potni_nalogi/${id}` : '/api/potni_nalogi';
        const res = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload) });
        if(res.ok) {
            window.zapriGlavniPopup();
        }
        else alert("Napaka pri shranjevanju.");
    } catch(e) { alert("Napaka: " + e.message); }
};

window.brisiPotniNalog = async function(id) {
    if(!confirm("Izbrišem potni nalog?")) return;
    try { await fetch(`/api/potni_nalogi/${id}`, {method:'DELETE'}); window.renderPotniNalogi(); } catch(e) {}
}



window.editGeneric = function(modul, id, data) {
    let fields = "";
    Object.keys(data).forEach(k => {
        if(k === 'id') return;
        fields += `<div class="form-group"><label>${k.replace(/_/g, ' ')}</label><input type="text" id="g_${k}" value="${data[k]}" style="width:100%"></div>`;
    });
    contentDiv.innerHTML = `
        <div style="max-width:500px; background:white; padding:20px; border-radius:8px;">
            <h3>Urejanje - ${modul}</h3>
            ${fields}
            <div style="margin-top:20px;">
                <button class="btn btn-blue" onclick="saveGeneric('${modul}', ${id})">Shrani</button>
            </div>
        </div>
    `;
    window.initDatePickers();
}

window.saveGeneric = async function(modul, id) {
    const payload = {};
    document.querySelectorAll('[id^="g_"]').forEach(inp => {
        let key = inp.id.substring(2);
        let val = inp.value;
        if(!isNaN(val) && val.trim() !== "") val = parseFloat(val);
        payload[key] = val;
    });
    await fetch(`/api/${modul}/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload) });
    if(modul === 'osnovna_sredstva') renderOsnovnaSredstva();
    else if(modul === 'potni_nalogi') renderPotniNalogi();
    else if(modul === 'prispevki') renderPlace();
}

window.brisiGeneric = async function(modul, id, callback) {
    if(!confirm("Ali ste prepričani, da želite izbrisati ta zapis?")) return;
    try {
        const res = await fetch(`/api/${modul}/${id}`, { method: 'DELETE' });
        if(res.ok) {
            if(callback) callback();
        } else {
            const err = await res.json();
            alert("Napaka pri brisanju: " + (err.detail || "Neznana napaka"));
        }
    } catch(e) {
        alert("Napaka pri komunikaciji s strežnikom.");
    }
}

function formatMoneyJS(val) {
    if (val === undefined || val === null) return "0,00 €";
    return Number(val).toLocaleString('sl-SI', { style: 'currency', currency: 'EUR' });
}

function formatDateJS(isoDate) {
    if (!isoDate) return "";
    const parts = isoDate.split('-');
    if (parts.length !== 3) return isoDate; // če je že v drugem formatu ali nepopoln
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function parseDateISO(localDateStr) {
    if (!localDateStr) return "";
    const parts = localDateStr.split('.');
    if (parts.length !== 3) return localDateStr;
    const d = parts[0].padStart(2, '0');
    const m = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
}


function formatNumberJS(val, decimals = 2) {
    if (val === undefined || val === null || isNaN(val)) return "0,00";
    return Number(val).toLocaleString('sl-SI', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function parseNumberJS(str) {
    if (typeof str === 'number') return str;
    if (!str) return 0;
    
    let s = str.toString().trim();
    // Če vsebuje vejico, predvidevamo slovenski format (pika je tisočice, vejica je decimalna)
    if (s.includes(',')) {
        return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
    }
    // Če ne vsebuje vejice, a vsebuje piko, preverimo če gre za JS format (npr. 1234.56)
    // ali za slovenski format brez decimalk (npr. 1.234)
    if (s.includes('.')) {
        // Če je pika samo ena in je na koncu (npr. 123.45), verjetno gre za JS format
        const parts = s.split('.');
        if (parts.length === 2 && parts[1].length <= 2) {
             return parseFloat(s) || 0;
        }
        // Sicer odstranimo pike (tisočice)
        return parseFloat(s.replace(/\./g, '')) || 0;
    }
    return parseFloat(s) || 0;
}

window.initDatePickers = function() {
    if (typeof flatpickr !== 'undefined') {
        flatpickr("input[placeholder='DD.MM.YYYY']", {
            dateFormat: "d.m.Y",
            locale: "sl",
            allowInput: true
        });
        flatpickr("input[placeholder='DD.MM.YYYY HH:MM']", {
            enableTime: true,
            time_24hr: true,
            dateFormat: "d.m.Y H:i",
            locale: "sl",
            allowInput: true
        });
    }
};

function parseDateTimeISO(localDTStr) {
    if (!localDTStr) return "";
    // Vhod: "DD.MM.YYYY HH:MM"
    const p = localDTStr.split(' ');
    const datePart = p[0];
    const timePart = p[1] || "00:00";
    
    const dParts = datePart.split('.');
    if (dParts.length !== 3) return localDTStr;
    
    const d = dParts[0].padStart(2, '0');
    const m = dParts[1].padStart(2, '0');
    const y = dParts[2];
    return `${y}-${m}-${d} ${timePart}:00`;
}

window.initPartnerSearch = function(inputEl, idInputEl, onSelectCallback) {
    if (!inputEl) return;
    
    const wrapper = inputEl.parentElement;
    if (!wrapper.classList.contains('partner-search-wrapper')) {
        wrapper.classList.add('partner-search-wrapper');
        const resultsDiv = document.createElement('div');
        resultsDiv.className = 'partner-search-results';
        wrapper.appendChild(resultsDiv);
        inputEl._resultsDiv = resultsDiv;
    }
    
    const resultsDiv = inputEl._resultsDiv;
    let debounceTimer;

    if (inputEl._partnerSearchInitialized) return;
    inputEl._partnerSearchInitialized = true;

    function performSearch() {
        const q = inputEl.value.trim();
        clearTimeout(debounceTimer);
        
        if (q.length === 0 && idInputEl) {
            idInputEl.value = '';
            idInputEl.dispatchEvent(new Event('change', { bubbles: true }));
        }

        debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/partnerji/search?q=${encodeURIComponent(q)}`);
                const partners = await res.json();
                renderResults(partners);
            } catch (err) { console.error(err); }
        }, 250);
    }

    inputEl.addEventListener('focus', () => {
        performSearch();
    });

    inputEl.addEventListener('click', () => {
        if (!resultsDiv.classList.contains('active')) {
            performSearch();
        }
    });

    inputEl.addEventListener('input', () => {
        performSearch();
    });

    function renderResults(partners) {
        if (partners.length === 0) {
            resultsDiv.innerHTML = '<div class="partner-result-item">Ni zadetkov</div>';
        } else {
            resultsDiv.innerHTML = partners.map(p => `
                <div class="partner-result-item" data-id="${p.id}">
                    <span class="partner-result-name">${p.naziv}</span>
                    <span class="partner-result-details">${p.ulica || ''}, ${p.postna_stevilka || ''} ${p.kraj || ''}</span>
                    <span class="partner-result-tax">Davčna: ${p.davcna_stevilka || '—'}</span>
                </div>
            `).join('');

            resultsDiv.querySelectorAll('.partner-result-item').forEach(item => {
                item.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const id = item.dataset.id;
                    const partner = partners.find(x => x.id == id);
                    inputEl.value = partner.naziv;
                    if (idInputEl) {
                        idInputEl.value = id;
                        // Trigger onchange for bank items to update liquidation button
                        idInputEl.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    resultsDiv.classList.remove('active');
                    if (onSelectCallback) onSelectCallback(partner);
                };
            });
        }
        resultsDiv.classList.add('active');
    }

    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
            resultsDiv.classList.remove('active');
        }
    });
};

window.naloziPredlogeUI = async function() {
    const list = document.getElementById('predloge-list');
    if(!list) return;
    try {
        const res = await fetch('/api/zakljucna_besedila');
        const data = await res.json();
        if(data.length === 0) {
            list.innerHTML = '<p style="font-size:0.9em; color:#999; font-style:italic;">Ni shranjenih predlog.</p>';
            return;
        }
        let html = '<table style="width:100%; font-size:0.9em; border-collapse:collapse;">';
        data.forEach(p => {
            const escapedBesedilo = p.besedilo.replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
            const escapedNaziv = p.naziv.replace(/'/g, "\\'").replace(/"/g, '&quot;');
            html += `
                <tr>
                    <td style="padding:10px 5px;"><strong>${p.naziv}</strong><br><small style="color:#666;">${p.besedilo.substring(0, 80)}${p.besedilo.length > 80 ? '...' : ''}</small></td>
                    <td style="padding:10px 5px; text-align:right; white-space:nowrap;">
                        <button onclick="window.napolniPredlogoForm(${p.id}, '${escapedNaziv}', '${escapedBesedilo}')" type="button" class="btn" style="background:#f1f3f5; color:var(--primary-blue); border:1px solid #dee2e6; padding:4px 8px; font-size:0.8em;">Uredi</button>
                        <button onclick="window.izbrisiPredlogo(${p.id})" type="button" class="btn" style="background:var(--primary-red); color:white; padding:4px 8px; font-size:0.8em; margin-left:5px;">Izbriši</button>
                    </td>
                </tr>
            `;
        });
        html += '</table>';
        list.innerHTML = html;
    } catch(e) {}
}

window.napolniPredlogoForm = function(id, naziv, besedilo) {
    document.getElementById('pr_id').value = id;
    document.getElementById('pr_naziv').value = naziv;
    document.getElementById('pr_besedilo').value = besedilo;
    document.getElementById('btn-save-predloga').innerText = "Shrani spremembe";
    document.getElementById('btn-cancel-predloga').style.display = "block";
}

window.ponastaviFormuPredlog = function() {
    document.getElementById('pr_id').value = '';
    document.getElementById('pr_naziv').value = '';
    document.getElementById('pr_besedilo').value = '';
    document.getElementById('btn-save-predloga').innerText = "Dodaj predlogo";
    document.getElementById('btn-cancel-predloga').style.display = "none";
}

window.shraniPredlogo = async function(e) {
    e.preventDefault();
    const id = document.getElementById('pr_id').value;
    const payload = {
        naziv: document.getElementById('pr_naziv').value,
        besedilo: document.getElementById('pr_besedilo').value
    };
    try {
        const url = id ? `/api/zakljucna_besedila/${id}` : '/api/zakljucna_besedila';
        const method = id ? 'PUT' : 'POST';
        const res = await fetch(url, {
            method: method, headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if(res.ok) {
            window.ponastaviFormuPredlog();
            await window.naloziPredlogeUI();
        }
    } catch(e) { alert("Napaka pri shranjevanju predloge."); }
}

window.izbrisiPredlogo = async function(id) {
    if(!confirm("Izbrišem to predlogo?")) return;
    try {
        await fetch(`/api/zakljucna_besedila/${id}`, {method:'DELETE'});
        await window.naloziPredlogeUI();
    } catch(e) {}
}

// --- PARTNER POPUP (za bancne izpiske) ---
window._partnerPopupTargetSelect = null;
window._vsiPartnerji = null;

window.checkPartnerSimilarity = function() {
    const warnEl = document.getElementById('pp_similarity_warn');
    if (!warnEl) return;
    
    const v_naziv = document.getElementById('pp_naziv').value.trim().toLowerCase();
    const v_davcna = document.getElementById('pp_davcna').value.trim().replace(/\s+/g, '');
    
    if (!v_naziv && !v_davcna) {
        warnEl.style.display = 'none';
        warnEl.innerHTML = '';
        return;
    }
    
    const partnerji = window._vsiPartnerji || [];
    const matches = [];
    
    for (const p of partnerji) {
        const p_naziv = (p.naziv || '').toLowerCase();
        const p_davcna = (p.davcna_stevilka || '').replace(/\s+/g, '');
        
        // 1. Check exact or very close tax ID
        if (v_davcna && p_davcna && (v_davcna === p_davcna || p_davcna.includes(v_davcna) || v_davcna.includes(p_davcna))) {
            matches.push(`Partner z isto/podobno davčno št. že obstaja: <strong>${p.naziv}</strong> (${p.davcna_stevilka || 'nima davčne'})`);
            continue;
        }
        
        // 2. Check name similarity
        if (v_naziv.length > 3) {
            const clean = s => s.replace(/\b(d\.?\s*o\.?\s*o\.?|s\.?\s*p\.?|d\.?\s*d\.?)\b/gi, '').trim();
            const clean_v = clean(v_naziv);
            const clean_p = clean(p_naziv);
            
            if (clean_v.length > 3 && clean_p.length > 3) {
                if (clean_p.includes(clean_v) || clean_v.includes(clean_p)) {
                    matches.push(`Obstaja partner s podobnim imenom: <strong>${p.naziv}</strong>`);
                    continue;
                }
                
                // Trigram similarity (Jaccard)
                const getTrigrams = str => {
                    const s = '  ' + str + '  ';
                    const arr = [];
                    for(let i=0; i < s.length - 2; i++) {
                        arr.push(s.substring(i, i+3));
                    }
                    return new Set(arr);
                };
                const setV = getTrigrams(clean_v);
                const setP = getTrigrams(clean_p);
                const intersection = new Set([...setV].filter(x => setP.has(x)));
                const union = new Set([...setV, ...setP]);
                const score = intersection.size / union.size;
                if (score > 0.4) {
                    matches.push(`Obstaja partner z zelo podobnim imenom (ujemanje ${(score*100).toFixed(0)}%): <strong>${p.naziv}</strong>`);
                }
            }
        }
    }
    
    if (matches.length > 0) {
        warnEl.style.display = 'block';
        const uniqueMatches = [...new Set(matches)];
        warnEl.innerHTML = `⚠️ <strong>Pozor:</strong><br>` + uniqueMatches.join('<br>');
    } else {
        warnEl.style.display = 'none';
        warnEl.innerHTML = '';
    }
};

window.odpriPartnerPopup = function(selectEl) {
    if (selectEl) {
        window._partnerPopupTargetSelect = selectEl;
    }
    
    // Clear similarity warn
    const warnEl = document.getElementById('pp_similarity_warn');
    if (warnEl) {
        warnEl.style.display = 'none';
        warnEl.innerHTML = '';
    }
    
    // Prednaloži partnerje za preverjanje podobnosti, če še niso nalagani
    if (!window._vsiPartnerji) {
        fetch('/api/partnerji').then(r => r.json()).then(data => { window._vsiPartnerji = data; });
    }

    // Pocisti polja
    ['pp_naziv','pp_ulica','pp_posta','pp_kraj','pp_davcna','pp_trr','pp_email','pp_telefon','pp_drzava','pp_bizi_q'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.value = id === 'pp_drzava' ? 'Slovenija' : '';
    });
    const zavEl = document.getElementById('pp_zavezanec');
    if(zavEl) zavEl.checked = false;
    const vrstaEl = document.getElementById('pp_vrsta');
    if(vrstaEl) vrstaEl.value = 'oba';
    const biziRes = document.getElementById('pp_bizi_results');
    if(biziRes) biziRes.innerHTML = '';
    document.getElementById('partner-popup-overlay').classList.add('active');
    window.initDatePickers();
    // Iskanje na Enter v popupu
    const ppq = document.getElementById('pp_bizi_q');
    if(ppq) ppq.onkeydown = e => { if(e.key==='Enter'){ e.preventDefault(); window.iskanjeBiziPopup(); } };
};

window.zapriPartnerPopup = function() {
    document.getElementById('partner-popup-overlay').classList.remove('active');
    window._partnerPopupTargetSelect = null;
};

window.shraniPartnerPopup = async function() {
    const naziv = document.getElementById('pp_naziv').value.trim();
    if(!naziv) { alert('Naziv je obvezen.'); return; }
    const payload = {
        naziv: naziv,
        ulica: document.getElementById('pp_ulica').value.trim(),
        postna_stevilka: document.getElementById('pp_posta').value.trim(),
        kraj: document.getElementById('pp_kraj').value.trim(),
        drzava: document.getElementById('pp_drzava').value.trim() || 'Slovenija',
        davcna_stevilka: document.getElementById('pp_davcna').value.trim(),
        trr: document.getElementById('pp_trr').value.trim(),
        email: document.getElementById('pp_email').value.trim(),
        telefon: document.getElementById('pp_telefon').value.trim(),
        zavezanec_za_ddv: document.getElementById('pp_zavezanec').checked,
        vrsta: document.getElementById('pp_vrsta').value
    };
    try {
        const res = await fetch('/api/partnerji', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload)
        });
        if(!res.ok) { alert('Napaka pri shranjevanju.'); return; }
        const saved = await res.json();
        const newId = saved.id;

        // Osvezi seznam partnerjev
        await preLoadPartners();
        
        if (window._partnerPopupTargetSelect === 'IMPORT_MODAL') {
            if (window.__importUpdatePartner) {
                window.__importUpdatePartner(saved);
            }
        } else if(window._partnerPopupTargetSelect) {
            window._partnerPopupTargetSelect.value = newId;
            // Najdemo iskalno polje (ponavadi je v istem wrapperju kot hidden input)
            const wrapper = window._partnerPopupTargetSelect.parentElement;
            const searchInput = wrapper ? wrapper.querySelector('input[type="text"]') : null;
            if (searchInput) {
                searchInput.value = naziv;
            }
            // Trigger change za likvidacijske gumbe
            window._partnerPopupTargetSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        window.zapriPartnerPopup();
    } catch(e) {
        alert('Napaka: ' + e.message);
    }
};

// Bizi.si iskanje v popupu (isti API kot v obrazcu za partnerje)
window.iskanjeBiziPopup = async function() {
    const q = document.getElementById('pp_bizi_q').value.trim();
    if(!q) return;
    const resultsDiv = document.getElementById('pp_bizi_results');
    resultsDiv.innerHTML = '<p style="font-size:0.85em; color:#666; padding:5px 0;">Iščem...</p>';
    try {
        const res = await fetch(`/api/partnerji/search_bizi?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        if(!data || data.length === 0) {
            resultsDiv.innerHTML = '<p style="font-size:0.85em; color:#999;">Ni zadetkov.</p>';
            return;
        }
        let html = '<table style="width:100%; font-size:0.85em; border-collapse:collapse; margin-top:5px;">';
        data.forEach(p => {
            html += `
                <tr>
                    <td style="padding:6px 5px;">
                        <strong>${p.naziv}</strong><br>
                        <small style="color:#666;">${p.naslov || ''}, ${p.posta_kraj || ''}</small>
                    </td>
                    <td style="padding:6px 5px; color:#666; font-size:0.9em;">${p.davcna_stevilka || ''}</td>
                    <td style="padding:6px 5px; text-align:right;">
                        <button class="btn btn-blue" style="padding:3px 8px; font-size:0.85em;"
                            onclick='window.napolniPopupIzBizi(${JSON.stringify(p).replace(/'/g,"&apos;")})'>Uvozi</button>
                    </td>
                </tr>`;
        });
        html += '</table>';
        resultsDiv.innerHTML = html;
    } catch(e) {
        resultsDiv.innerHTML = '<p style="font-size:0.85em; color:red;">Napaka pri iskanju.</p>';
    }
};

window.napolniPopupIzBizi = async function(p) {
    document.getElementById('pp_naziv').value = p.naziv || '';
    document.getElementById('pp_ulica').value = p.naslov || '';
    if(p.posta_kraj) {
        const parts = p.posta_kraj.split(' ');
        document.getElementById('pp_posta').value = parts[0] || '';
        document.getElementById('pp_kraj').value = parts.slice(1).join(' ') || '';
    }
    document.getElementById('pp_davcna').value = p.davcna_stevilka || '';
    document.getElementById('pp_drzava').value = 'Slovenija';

    const resultsDiv = document.getElementById('pp_bizi_results');
    if(p.link) {
        resultsDiv.innerHTML = '<p style="font-size:0.85em; color:var(--primary-blue);">Pridobivam dodatne podatke...</p>';
        try {
            const res = await fetch(`/api/partnerji/bizi_detail?url=${encodeURIComponent(p.link)}`);
            const detail = await res.json();
            if(detail.telefon) document.getElementById('pp_telefon').value = detail.telefon;
            if(detail.email) document.getElementById('pp_email').value = detail.email;
            if(detail.trr) document.getElementById('pp_trr').value = detail.trr;
            if(detail.zavezanec_za_ddv !== undefined) document.getElementById('pp_zavezanec').checked = detail.zavezanec_za_ddv;
        } catch(e) { console.error('bizi_detail napaka', e); }
    }
    resultsDiv.innerHTML = '<p style="font-size:0.85em; color:#2b8a3e; font-weight:bold;">✓ Podatki uvoženi!</p>';
};

// --- PLAČE IN PRISPEVKI ---
async function renderPlace() {
    titleEl.textContent = "Plače in prispevki";
    contentDiv.innerHTML = '<p>Nalagam...</p>';
    try {
        const [pRes, zRes] = await Promise.all([fetch('/api/place'), fetch('/api/zaposleni')]);
        const data = await pRes.json();
        const zaposleni = await zRes.json();
        window.loadedZaposleni = zaposleni;

        const sortFields = [
            {key: 'leto_mesec', label: 'Mesec / Leto'},
            {key: 'zaposleni_ime', label: 'Zaposleni'},
            {key: 'bruto_placa', label: 'Bruto'},
            {key: 'znesek_skupaj', label: 'Skupaj'}
        ];

        let html = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 15px;">
                <h2 style="margin:0; color:var(--primary-blue);">Obračun plač in prispevkov</h2>
                <div style="display: flex; gap: 15px; align-items: center;">
                    ${window.renderSortControls('prispevki', sortFields, 'renderPlace()')}
                    <button class="btn btn-blue" onclick="window.showDodajPlaco()">+ Nov obračun</button>
                </div>
            </div>
            <table>
                <thead>
                    <tr>
                        <th width="40"><input type="checkbox" onclick="window.toggleAllSelection(this.checked, 'place')"></th>
                        <th width="50">Št.</th>
                        <th>Mesec / Leto</th>
                        <th>Zaposleni</th>
                        <th>Vrsta</th>
                        <th style="text-align:right">Bruto / Osnova</th>
                        <th style="text-align:right">Skupaj prispevki</th>
                        <th style="text-align:right">Status</th>
                        <th width="120" style="text-align:right">Akcije</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (data.length === 0) {
            html += `<tr><td colspan="7" style="text-align:center">Ni zapisov</td></tr>`;
        } else {
            let sortirano = window.sortAppData(data, 'prispevki');
            let zaporedna = 1;
            sortirano.forEach(p => {
                const statusColor = p.placan ? '#2b8a3e' : '#e03131';
                const isChecked = window.appSelection.ids.includes(p.id) ? 'checked' : '';
                html += `
                    <tr>
                        <td><input type="checkbox" class="row-checkbox" data-id="${p.id}" ${isChecked} onclick="window.toggleItemSelection(${p.id}, 'place')"></td>
                        <td>${zaporedna}.</td>
                        <td style="${!p.knjizeno ? 'cursor:pointer; color:var(--primary-blue); text-decoration:underline; font-weight:600;' : ''}" 
                            onclick='${!p.knjizeno ? `window.showDodajPlaco(${JSON.stringify(p).replace(/'/g,"&apos;")})` : ""}'>
                            ${p.mesec} / ${p.leto}
                        </td>
                        <td style="font-weight:bold;">${p.zaposleni_ime || '/'}</td>
                        <td style="font-size:0.9em;">${p.vrsta_zaposlitve.toUpperCase()}</td>
                        <td style="text-align:right;">${formatMoneyJS(p.bruto_placa)}</td>
                        <td style="text-align:right; font-weight:bold;">${formatMoneyJS(p.znesek_skupaj)}</td>
                        <td style="text-align:right;">
                            ${p.knjizeno 
                                ? '<span style="background:#e3fafc; color:#1098ad; padding:3px 8px; border-radius:10px; font-size:0.8em; text-transform:uppercase; font-weight:bold;" title="Knjiženo v glavno knjigo">Zaprto</span>'
                                : `<span style="background:${p.placan ? '#d3f9d8' : '#f1f3f5'}; color:${p.placan ? '#2b8a3e' : '#e03131'}; padding:3px 8px; border-radius:10px; font-size:0.8em; text-transform:uppercase; font-weight:bold;">${p.placan ? 'Plačano' : 'Odprto'}</span>`
                            }
                        </td>
                        <td class="action-buttons">
                            ${!p.knjizeno ? `
                                <button class="icon-btn btn-green" onclick="window.knjiziPosamezen(${p.id}, 'knjizi', 'place')" title="Knjiži">${ICONS.book}</button>
                                <button class="icon-btn btn-red" onclick="window.brisiPlaco(${p.id})" title="Briši">${ICONS.delete}</button>
                            ` : `
                                <button class="icon-btn btn-orange" onclick="window.knjiziPosamezen(${p.id}, 'razknjizi', 'place')" title="Razknjiži">${ICONS.unbook}</button>
                            `}
                        </td>
                    </tr>
                `;
                zaporedna++;
            });
        }
        html += '</tbody></table>';
        contentDiv.innerHTML = html;
    } catch(e) { contentDiv.innerHTML = '<p>Napaka pri nalaganju podatkov.</p>'; }
}

window.showDodajPlaco = function(editData = null) {
    const isEdit = !!editData;
    const title = isEdit ? 'Uredi obračun' : 'Nov obračun plač/prispevkov';
    const zapOpts = (window.loadedZaposleni || []).map(z => `<option value="${z.id}" ${editData && editData.zaposleni_id===z.id ? 'selected':''}>${z.ime_priimek}</option>`).join('');
    
    const innerHtml = `
        <div style="display:grid; grid-template-columns: 1.5fr 1fr; gap:20px;">
            <div style="background: white; padding: 5px;">
                <form id="placa-form" onsubmit="window.shraniPlaco(event, ${isEdit ? editData.id : 'null'})">
                    <div style="display:flex; gap:10px;">
                        <div class="form-group" style="flex:2"><label>Zaposleni / Nosilec *</label>
                            <select id="p_zap" required onchange="window.posodobiPredlaganeVrednostiPlac()">${zapOpts}</select>
                        </div>
                        <div class="form-group" style="flex:1"><label>Leto</label><input type="number" id="p_leto" value="${editData?.leto || getLeto()}" required onchange="window.posodobiPredlaganeVrednostiPlac()"></div>
                        <div class="form-group" style="flex:1"><label>Mesec</label>
                            <select id="p_mesec" onchange="window.posodobiPredlaganeVrednostiPlac()">
                                ${['Januar','Februar','Marec','April','Maj','Junij','Julij','Avgust','September','Oktober','November','December'].map(m => `<option value="${m}" ${editData?.mesec===m ? 'selected':''}>${m}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <div style="background:#f8f9fa; padding:15px; border-radius:6px; margin-bottom:15px; border:1px solid #e9ecef;">
                        <label style="font-weight:bold; display:block; margin-bottom:10px; color:#495057;">Vrsta zaposlitve in obseg</label>
                        <div style="display:flex; gap:20px; margin-bottom:10px;">
                            <label style="cursor:pointer;"><input type="radio" name="p_vrsta" value="sp_100" ${(!editData || editData.vrsta_zaposlitve==='sp_100') ? 'checked':''} onchange="window.preracunajPlaco()"> Polni s.p. (100%)</label>
                            <label style="cursor:pointer;"><input type="radio" name="p_vrsta" value="sp_50" ${editData?.vrsta_zaposlitve==='sp_50' ? 'checked':''} onchange="window.preracunajPlaco()"> Polovični s.p. (50%)</label>
                            <label style="cursor:pointer;"><input type="radio" name="p_vrsta" value="zaposlen" ${editData?.vrsta_zaposlitve==='zaposlen' ? 'checked':''} onchange="window.preracunajPlaco()"> Klasična zaposlitev</label>
                        </div>
                        <div style="display:flex; gap:10px; align-items:flex-end;">
                            <div class="form-group" style="flex:1; margin-bottom:0;">
                                <label id="label_bruto">Zavarovalna osnova (€)</label>
                                <input type="text" id="p_bruto" value="${editData ? formatNumberJS(editData.bruto_placa) : '1445,12'}" oninput="window.preracunajPlaco()">
                            </div>
                            <div class="form-group" id="p_konto_pris_box" style="flex:1; margin-bottom:0; display:none;">
                                <label>Konto za prispevke</label>
                                <input type="text" id="p_konto_pris" value="${editData?.konto_prispevkov || '265000'}" placeholder="265000">
                            </div>
                            <button type="button" class="btn btn-blue" style="padding:10px 15px; font-weight:bold;" onclick="window.uvodFURS()">Osveži iz FURS</button>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px 20px; font-size:0.9em; color:#495057;">
                        <div class="form-group"><label>PIZ (24,35%)</label><input type="text" id="p_piz" value="${editData ? formatNumberJS(editData.znesek_piz) : '0,00'}"></div>
                        <div class="form-group"><label>Zdravstvo ZZ (13,45%)</label><input type="text" id="p_zz" value="${editData ? formatNumberJS(editData.znesek_zz) : '0,00'}"></div>
                        <div class="form-group"><label>Zaposlovanje (0,20%)</label><input type="text" id="p_zap_v" value="${editData ? formatNumberJS(editData.znesek_zap) : '0,00'}"></div>
                        <div class="form-group"><label>Starševsko (0,20%)</label><input type="text" id="p_star" value="${editData ? formatNumberJS(editData.znesek_starsevsko) : '0,00'}"></div>
                        <div class="form-group"><label>OZP (Fiksno €)</label><input type="text" id="p_ozp" value="${editData ? formatNumberJS(editData.znesek_ozp) : '39,36'}"></div>
                        <div class="form-group" id="do_box" style="display:none;"><label>Dolg. oskrba (2,0%)</label><input type="text" id="p_do" value="${editData ? formatNumberJS(editData.znesek_do) : '0,00'}"></div>
                        <div class="form-group" id="akontacija_box" style="display:none;"><label>Akontacija doh.</label><input type="text" id="p_doh" value="${editData ? formatNumberJS(editData.znesek_akontacija_doh) : '0,00'}"></div>
                    </div>

                    <div style="background:#e8f4fd; padding:15px; border-radius:6px; margin-top:15px; border:1px solid #b3d7ff;">
                        <h4 style="margin:0 0 10px 0; color:#0056b3;">Povračila stroškov (prevoz in prehrana)</h4>
                        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px;">
                            <div class="form-group"><label>Št. dni prehrane</label><input type="number" id="p_st_malic" value="${editData?.st_malic !== null && editData?.st_malic !== undefined ? editData.st_malic : ''}" placeholder="Dnevi" oninput="window.preracunajPovracila()"></div>
                            <div class="form-group"><label>Cena malice (€)</label><input type="text" id="p_cena_malice" value="${editData?.cena_malice !== null && editData?.cena_malice !== undefined ? formatNumberJS(editData.cena_malice) : '7,96'}" oninput="window.preracunajPovracila()"></div>
                            <div class="form-group"><label>Skupaj prehrana (€)</label><input type="text" id="p_znesek_malica" value="${editData?.malica !== undefined ? formatNumberJS(editData.malica) : '0,00'}" readonly style="background:#f1f3f5;"></div>
                        </div>
                        <div style="display:grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap:10px; margin-top:10px;">
                            <div class="form-group"><label>Št. dni prevoza</label><input type="number" id="p_st_dni_pot" value="${editData?.st_dni_pot !== null && editData?.st_dni_pot !== undefined ? editData.st_dni_pot : ''}" placeholder="Dnevi" oninput="window.preracunajPovracila()"></div>
                            <div class="form-group"><label>Km v eno smer</label><input type="text" id="p_km_enosmerno" value="${editData?.km_enosmerno !== null && editData?.km_enosmerno !== undefined ? formatNumberJS(editData.km_enosmerno) : '0,0'}" placeholder="km" oninput="window.preracunajPovracila()"></div>
                            <div class="form-group"><label>Tarifa (€/km)</label><input type="text" id="p_cena_km" value="${editData?.cena_km !== null && editData?.cena_km !== undefined ? formatNumberJS(editData.cena_km) : '0,21'}" oninput="window.preracunajPovracila()"></div>
                            <div class="form-group"><label>Skupaj prevoz (€)</label><input type="text" id="p_znesek_prevoz" value="${editData?.potni_stroski !== undefined ? formatNumberJS(editData.potni_stroski) : '0,00'}" readonly style="background:#f1f3f5;"></div>
                        </div>
                    </div>

                    <div style="margin-top:20px; padding-top:15px; border-top:2px solid var(--primary-blue); display:flex; justify-content:space-between; align-items:center;">
                        <div style="font-weight:bold; color:var(--primary-blue); font-size:1.2em;">SKUPAJ: <span id="p_skupaj_text">${formatMoneyJS(editData?.znesek_skupaj || 0)}</span></div>
                        <div style="display:flex; gap:10px;">
                            <button type="button" class="btn" style="background:#eee; color:#333;" onclick="window.zapriGlavniPopup()">Prekliči</button>
                            <button type="submit" class="btn btn-blue">${isEdit ? 'Shrani spremembe' : 'Shrani obračun'}</button>
                        </div>
                    </div>
                </form>
            </div>

            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 1px solid #dee2e6;">
                <h4 style="margin:0 0 15px 0;">UPN / Plačilo</h4>
                <div id="p_qr_canvas_box" style="display:flex; justify-content:center; margin-bottom:15px; background:#fff; padding:10px; border:1px solid #eee;">
                    <div id="p_qr_code"></div>
                </div>
                <div style="font-size:0.85em; color:#495057;">
                    <p><strong>Sklic:</strong> <span id="p_qr_sklic">---</span></p>
                    <p><strong>Namen:</strong> <span id="p_qr_namen">Prispevki za socialno varnost</span></p>
                    <p style="color:#868e96; font-style:italic; margin-top:10px;">QR koda se osveži ob vsaki spremembi zneska.</p>
                </div>
                
                <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #dee2e6; font-size: 0.85em; color: #495057;">
                    <h4 style="margin: 0 0 12px 0; font-size: 1.1em; color: #212529;">Razmejitev zneskov</h4>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span>Skupaj prispevki in davki:</span>
                        <strong id="p_skupaj_prispevki">0,00 €</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span>Skupaj povračila:</span>
                        <strong id="p_skupaj_povracila">0,00 €</strong>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #dee2e6; font-weight: bold; font-size: 1.05em; color: var(--primary-blue);">
                        <span>SKUPAJ:</span>
                        <span id="p_skupaj_desno">0,00 €</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    window.odpriGlavniPopup(title, innerHtml, "", true);
    if (!isEdit) {
        window.posodobiPredlaganeVrednostiPlac();
    } else {
        window.preracunajPlaco();
    }
};

window.uvodFURS = function() {
    const leto = parseInt(document.getElementById('p_leto').value);
    const mesec = document.getElementById('p_mesec').value;
    const mesecIdx = ['Januar','Februar','Marec','April','Maj','Junij','Julij','Avgust','September','Oktober','November','December'].indexOf(mesec);
    
    // Meja za prehod na novo osnovo je Marec (indeks 2)
    let osnova = 1445.12; 
    if (leto > 2026 || (leto === 2026 && mesecIdx >= 2)) {
        osnova = 1521.62;
    } else if (leto === 2026 && mesecIdx < 2) {
        osnova = 1445.12;
    } else if (leto === 2025) {
        osnova = 1445.12; // V 2025 je bila osnova enaka kot 2024 (poenostavljeno)
    }

    document.getElementById('p_bruto').value = formatNumberJS(osnova);
    window.preracunajPlaco(true); // true pomeni, da ne želimo ponovnega avtomatskega proženja če bi bili v zanki
};

window.preracunajPlaco = function() {
    const vrsta = document.querySelector('input[name="p_vrsta"]:checked').value;
    const bruto = parseNumberJS(document.getElementById('p_bruto').value);
    const leto = parseInt(document.getElementById('p_leto').value);
    const label = document.getElementById('label_bruto');
    const akBox = document.getElementById('akontacija_box');
    const doBox = document.getElementById('do_box');
    
    let piz = 0, zz = 0, zap = 0, star = 0, ozp = 35.00, doh = 0, do_z = 0;

    // Zakonodaja 2026: OZP = 39.36, DO = 2%
    if(leto >= 2026) {
        ozp = 39.36;
        doBox.style.display = 'block';
    } else {
        doBox.style.display = 'none';
    }

    if(vrsta === 'sp_100' || vrsta === 'sp_50') {
        label.textContent = "Zavarovalna osnova (€)";
        akBox.style.display = 'none';
        document.getElementById('p_konto_pris_box').style.display = 'block';
        const koef = vrsta === 'sp_50' ? 0.5 : 1.0;
        piz = (bruto * 0.2435) * koef;
        zz = (bruto * 0.1345) * koef;
        zap = (bruto * 0.0020) * koef;
        star = (bruto * 0.0020) * koef;
        
        if(leto >= 2026) {
            do_z = (bruto * 0.02) * koef;
        }
        
        // OZP se ponavadi ne polovi, če oseba nima drugega zavarovanja (podatki eDavki 345,22 potrjujejo cel OZP)
        // ozp = ozp * koef; // Onemogočimo polovljenje OZP na podlagi povratnih informacij
    } else {
        label.textContent = "Bruto plača (Bruto 1) (€)";
        akBox.style.display = 'block';
        document.getElementById('p_konto_pris_box').style.display = 'none';
        piz = bruto * 0.155; 
        zz = bruto * 0.0636;
        zap = bruto * 0.0014;
        star = bruto * 0.001;
        doh = bruto * 0.16;
        if(leto >= 2026) {
            do_z = bruto * 0.02; // 1% delojemalec + 1% delodajalec (v aplikaciji štejemo skupni strošek)
        }
    }

    document.getElementById('p_piz').value = formatNumberJS(piz);
    document.getElementById('p_zz').value = formatNumberJS(zz);
    document.getElementById('p_zap_v').value = formatNumberJS(zap);
    document.getElementById('p_star').value = formatNumberJS(star);
    document.getElementById('p_doh').value = formatNumberJS(doh);
    document.getElementById('p_ozp').value = formatNumberJS(ozp);
    document.getElementById('p_do').value = formatNumberJS(do_z);

    const malicaVal = parseNumberJS(document.getElementById('p_znesek_malica').value) || 0;
    const prevozVal = parseNumberJS(document.getElementById('p_znesek_prevoz').value) || 0;

    const skupaj = piz + zz + zap + star + ozp + doh + do_z + malicaVal + prevozVal;
    document.getElementById('p_skupaj_text').textContent = formatMoneyJS(skupaj);
    
    // Posodobi razmejitev zneskov na desni strani pod QR kodo
    const skupajPrispevki = piz + zz + zap + star + ozp + doh + do_z;
    const skupajPovracila = malicaVal + prevozVal;
    const elPrispevki = document.getElementById('p_skupaj_prispevki');
    const elPovracila = document.getElementById('p_skupaj_povracila');
    const elSkupajDesno = document.getElementById('p_skupaj_desno');
    if (elPrispevki) elPrispevki.textContent = formatMoneyJS(skupajPrispevki);
    if (elPovracila) elPovracila.textContent = formatMoneyJS(skupajPovracila);
    if (elSkupajDesno) elSkupajDesno.textContent = formatMoneyJS(skupaj);

    // UPN-QR je namenjen plačilu prispevkov in davkov FURS-u, zato ne sme vsebovati potnih stroškov in malice!
    const fursZnesek = piz + zz + zap + star + ozp + doh + do_z;
    window.osveziUPNQR(fursZnesek);
};

window.preracunajPovracila = function(prepreciZanko = false) {
    const stMalic = parseInt(document.getElementById('p_st_malic').value) || 0;
    const cenaMalice = parseNumberJS(document.getElementById('p_cena_malice').value) || 0;
    const malicaSkupaj = stMalic * cenaMalice;
    document.getElementById('p_znesek_malica').value = formatNumberJS(malicaSkupaj);

    const stDniPot = parseInt(document.getElementById('p_st_dni_pot').value) || 0;
    const kmEnosmerno = parseNumberJS(document.getElementById('p_km_enosmerno').value) || 0;
    const cenaKm = parseNumberJS(document.getElementById('p_cena_km').value) || 0;
    const prevozSkupaj = stDniPot * kmEnosmerno * 2 * cenaKm;
    document.getElementById('p_znesek_prevoz').value = formatNumberJS(prevozSkupaj);

    if (!prepreciZanko) {
        // Ponovno poženi preračun celotne plače da se posodobi skupni znesek
        const bruto = parseNumberJS(document.getElementById('p_bruto').value);
        const piz = parseNumberJS(document.getElementById('p_piz').value) || 0;
        const zz = parseNumberJS(document.getElementById('p_zz').value) || 0;
        const zap = parseNumberJS(document.getElementById('p_zap_v').value) || 0;
        const star = parseNumberJS(document.getElementById('p_star').value) || 0;
        const ozp = parseNumberJS(document.getElementById('p_ozp').value) || 0;
        const doh = parseNumberJS(document.getElementById('p_doh').value) || 0;
        const do_z = parseNumberJS(document.getElementById('p_do').value) || 0;

        const skupaj = piz + zz + zap + star + ozp + doh + do_z + malicaSkupaj + prevozSkupaj;
        document.getElementById('p_skupaj_text').textContent = formatMoneyJS(skupaj);
        
        // Posodobi razmejitev zneskov na desni strani pod QR kodo
        const skupajPrispevki = piz + zz + zap + star + ozp + doh + do_z;
        const skupajPovracila = malicaSkupaj + prevozSkupaj;
        const elPrispevki = document.getElementById('p_skupaj_prispevki');
        const elPovracila = document.getElementById('p_skupaj_povracila');
        const elSkupajDesno = document.getElementById('p_skupaj_desno');
        if (elPrispevki) elPrispevki.textContent = formatMoneyJS(skupajPrispevki);
        if (elPovracila) elPovracila.textContent = formatMoneyJS(skupajPovracila);
        if (elSkupajDesno) elSkupajDesno.textContent = formatMoneyJS(skupaj);

        // UPN-QR je namenjen plačilu prispevkov in davkov FURS-u, zato ne sme vsebovati potnih stroškov in malice!
        const fursZnesek = piz + zz + zap + star + ozp + doh + do_z;
        window.osveziUPNQR(fursZnesek);
    }
};

window.posodobiPredlaganeVrednostiPlac = async function() {
    const zapId = document.getElementById('p_zap').value;
    const leto = document.getElementById('p_leto').value;
    const mesec = document.getElementById('p_mesec').value;
    if (!zapId) return;

    try {
        const res = await fetch(`/api/place/predlagaj_vrednosti?zaposleni_id=${zapId}&leto=${leto}&mesec=${encodeURIComponent(mesec)}`);
        if (res.ok) {
            const data = await res.json();
            document.getElementById('p_st_malic').value = data.delovni_dni;
            document.getElementById('p_st_dni_pot').value = data.delovni_dni;
            document.getElementById('p_km_enosmerno').value = formatNumberJS(data.razdalja);
            // Izračunaj in posodobi povračila (prehrana in prevoz)
            window.preracunajPovracila(true);
        }
    } catch (e) {
        console.error("Napaka pri pridobivanju predlaganih vrednosti:", e);
    }
    window.preracunajPlaco();
};

window.osveziUPNQR = function(znesek) {
    try {
        const zaposleni_id = document.getElementById('p_zap').value;
        const zap = (window.loadedZaposleni || []).find(z => z.id == zaposleni_id);
        const mesec = document.getElementById('p_mesec').value;
        const leto = document.getElementById('p_leto').value;
        
        // Podatki za FURS - Račun za prispevke (ZZZS/KPD)
        const iban_furs = "SI56011000001234567"; 
        const sklic = "SI1200000000"; 
        
        document.getElementById('p_qr_sklic').textContent = sklic;
        
        const cents = Math.round(znesek * 100);
        const amountStr = cents.toString().padStart(11, '0');
        
        // ZBS UPN-QR Standard - TOČNO 19 polj ločenih z \n
        // Polje 20 je dolžina prvih 19 polj + 19 ločil
        const fields = [
            "UPNQR",                  // 1. Identifikator
            "",                       // 2. IBAN plačnika
            "",                       // 3. Polog gotovine
            "",                       // 4. Koda valute
            "",                       // 5. Znesek (prazno, ker je v 9)
            (zap ? zap.ime_priimek.substring(0, 40) : "Zavezanc"), // 6. Ime plačnika
            (zap ? (zap.naslov || "").substring(0, 40) : "Naslov"), // 7. Naslov plačnika
            (zap ? (zap.postna_stevilka + " " + (zap.posta_kraj || zap.kraj || "")).substring(0, 40) : "Kraj"), // 8. Kraj plačnika
            amountStr,                // 9. Znesek
            "",                       // 10. Datum plačila
            "",                       // 11. Nujno
            "OTHR",                   // 12. Koda namena
            `PRISPEVKI ${mesec.toUpperCase()} ${leto}`.substring(0, 42), // 13. Namen
            "",                       // 14. Rok plačila
            iban_furs,                // 15. IBAN prejemnika
            sklic,                    // 16. Sklic prejemnika
            "FINANCNA UPRAVA RS",     // 17. Ime prejemnika
            "SMARTINSKA 55",          // 18. Naslov prejemnika
            "1000 LJUBLJANA"          // 19. Kraj prejemnika
        ];
        
        // Izračun dolžine po ZBS standardu
        const rawBody = fields.join('\n') + '\n';
        const totalLen = rawBody.length + 3; // +3 za polje 20
        const qrData = rawBody + totalLen.toString().padStart(3, '0');

        setTimeout(() => {
            const qrDiv = document.getElementById('p_qr_code');
            if(!qrDiv) return;
            qrDiv.innerHTML = '';
            
            // Če lokalni generator QRCode zataji, uporabimo zanesljiv API kot fallback
            if(window.QRCode) {
                try {
                    new QRCode(qrDiv, {
                        text: qrData,
                        width: 160,
                        height: 160,
                        correctLevel : QRCode.CorrectLevel.M
                    });
                } catch(e) { 
                    useApiFallback(qrDiv, qrData);
                }
            } else {
                useApiFallback(qrDiv, qrData);
            }

            function useApiFallback(div, data) {
                const encodedData = encodeURIComponent(data);
                div.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?data=${encodedData}&size=160x160" alt="QR Code" style="width:160px; height:160px;">`;
            }
        }, 100);
    } catch(err) {
        console.error("QR Error:", err);
        const qrDiv = document.getElementById('p_qr_code');
        if(qrDiv) qrDiv.innerHTML = `<p style="color:red;font-size:0.7em;">Napaka pri izrisu: ${err.message}</p>`;
    }
};

window.shraniPlaco = async function(e, id) {
    e.preventDefault();
    const pay = {
        zaposleni_id: parseInt(document.getElementById('p_zap').value),
        mesec: document.getElementById('p_mesec').value,
        leto: parseInt(document.getElementById('p_leto').value),
        vrsta_zaposlitve: document.querySelector('input[name="p_vrsta"]:checked').value,
        bruto_placa: parseNumberJS(document.getElementById('p_bruto').value),
        znesek_piz: parseNumberJS(document.getElementById('p_piz').value),
        znesek_zz: parseNumberJS(document.getElementById('p_zz').value),
        znesek_zap: parseNumberJS(document.getElementById('p_zap_v').value),
        znesek_starsevsko: parseNumberJS(document.getElementById('p_star').value),
        znesek_ozp: parseNumberJS(document.getElementById('p_ozp').value),
        znesek_do: parseNumberJS(document.getElementById('p_do').value),
        znesek_akontacija_doh: parseNumberJS(document.getElementById('p_doh').value),
        
        st_malic: parseInt(document.getElementById('p_st_malic').value) || 0,
        cena_malice: parseNumberJS(document.getElementById('p_cena_malice').value) || 0,
        malica: parseNumberJS(document.getElementById('p_znesek_malica').value) || 0,
        
        st_dni_pot: parseInt(document.getElementById('p_st_dni_pot').value) || 0,
        km_enosmerno: parseNumberJS(document.getElementById('p_km_enosmerno').value) || 0,
        cena_km: parseNumberJS(document.getElementById('p_cena_km').value) || 0,
        potni_stroski: parseNumberJS(document.getElementById('p_znesek_prevoz').value) || 0,

        znesek_skupaj: parseNumberJS(document.getElementById('p_skupaj_text').textContent),
        sklic: document.getElementById('p_qr_sklic').textContent,
        konto_prispevkov: document.getElementById('p_konto_pris').value.trim(),
        placan: false
    };

    try {
        const url = id ? `/api/place/${id}` : '/api/place';
        const res = await fetch(url, {
            method: id ? 'PUT' : 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(pay)
        });
        if(res.ok) {
            window.zapriGlavniPopup();
        }
    } catch(e) { alert("Napaka pri shranjevanju."); }
};

window.brisiPlaco = async function(id) {
    if(!confirm("Izbrišem ta obračun?")) return;
    try {
        await fetch(`/api/place/${id}`, {method: 'DELETE'});
        renderPlace();
    } catch(e) {}
};

// --- LIKVIDACIJA (Povezovanje plačil) ---
window.odpriLikvidacijo = async function(postavkaId, partnerId, skupniZnesek, namen, isManualInitial = false, sourceBox = null) {
    // Ustvari modalno okno
    const modalId = 'likvidacija-modal-overlay';
    let modal = document.getElementById(modalId);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = modalId;
        modal.className = 'modal-overlay';
        document.body.appendChild(modal);
    }
    
    modal.style.display = 'flex';
    modal.innerHTML = `
        <div class="modal-content" style="width:750px; max-width:95vw; background:white; padding:25px; border-radius:8px; box-shadow:0 10px 40px rgba(0,0,0,0.3);">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h3 style="margin:0; color:var(--primary-blue);">Likvidacija plačila</h3>
                <button onclick="document.getElementById('likvidacija-modal-overlay').style.display='none'" style="background:none; border:none; font-size:1.5rem; cursor:pointer;">&times;</button>
            </div>
            
            <div style="background:#f8f9fa; padding:15px; border-radius:6px; margin-bottom:20px; border:1px solid #dee2e6;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <span style="color:#666; font-size:0.9em;">Namen:</span><br>
                        <strong>${namen}</strong>
                    </div>
                    <div style="text-align:right;">
                        <span style="color:#666; font-size:0.9em;">Znesek plačila:</span><br>
                        <strong style="font-size:1.2em; color:var(--primary-blue);">${formatMoneyJS(skupniZnesek)}</strong>
                    </div>
                </div>
            </div>

            <!-- SEARCH BAR -->
            <div style="margin-bottom: 20px; display: flex; gap: 10px; align-items: center; background: #e7f5ff; padding: 12px; border-radius: 6px; border: 1px solid #a5d8ff;">
                <input type="text" id="likv-search-input" placeholder="Ročno iskanje računa (št. računa ali partner)..." style="flex:1; padding:8px 12px; border:1px solid #ced4da; border-radius:4px; height: 38px;">
                <button type="button" class="btn btn-blue" id="likv-search-btn" style="padding:0 15px; height: 38px; display: flex; align-items: center; justify-content: center;">Išči</button>
            </div>

            <div id="likv-vsebina">Nalagam odprte postavke...</div>

            <div style="margin-top:20px; padding-top:15px; border-top:1px solid #eee; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    Preostanek za razporeditev: <strong id="likv-preostanek">${formatMoneyJS(skupniZnesek)}</strong>
                </div>
                <div style="display:flex; gap:10px;">
                    ${!isManualInitial ? `
                        <button class="btn" style="background:#fff3bf; color:#855d00; border:1px solid #fab005;" id="btn-manualna-likvidacija">Ročna likvidacija</button>
                    ` : `
                        <button class="btn" style="background:#f1f3f5; color:#495057; border:1px solid #dee2e6;" id="btn-preklic-manualne">Prekliči ročno likvidacijo</button>
                    `}
                    <button class="btn" style="background:#eee; color:#333;" onclick="document.getElementById('likvidacija-modal-overlay').style.display='none'">Prekliči</button>
                    <button class="btn btn-blue" id="btn-potrdi-likvidacijo">Potrdi likvidacijo</button>
                </div>
            </div>
        </div>
    `;

    try {
        // 1. Pridobimo že obstojeće povezave
        const povRes = await fetch(`/api/likvidacija/povezave/${postavkaId}`);
        const obstojecePov = await povRes.json();
        
        // 2. Pridobimo vse odprte postavke za partnerja
        const res = await fetch(`/api/likvidacija/odprte_postavke/${partnerId}`);
        const odprte = await res.json();
        
        // Združimo sezname
        let vsiPrikazani = odprte.map(x => ({...x, shranjeno_v_bazi: 0}));
        obstojecePov.forEach(op => {
            const f = vsiPrikazani.find(x => x.id === op.dokument_id);
            if (!f) {
                vsiPrikazani.push({
                    id: op.dokument_id,
                    stevilka: op.stevilka,
                    datum_izdaje: op.datum_izdaje,
                    znesek_skupaj: op.znesek, // znesek same fakture
                    preostanek: 0,
                    tip: op.tip,
                    ze_povezano_to: op.znesek,
                    shranjeno_v_bazi: op.znesek,
                    partner_naziv: op.partner_naziv
                });
            } else {
                f.ze_povezano_to = op.znesek;
                f.shranjeno_v_bazi = op.znesek;
            }
        });

        vsiPrikazani.sort((a,b) => a.datum_izdaje.localeCompare(b.datum_izdaje));

        // 3. FIFO avtomatika (če še nimamo shranjenih povezav)
        if (obstojecePov.length === 0) {
            const statementDateStr = document.getElementById('i_datum')?.value;
            if (statementDateStr) {
                const statementDate = parseDateISO(statementDateStr);
                let remaining = skupniZnesek;
                vsiPrikazani.forEach(d => {
                    if (remaining > 0) {
                        const amount = Math.min(d.preostanek, remaining);
                        d.ze_povezano_to = amount;
                        remaining -= amount;
                    }
                });
            }
        }

        // Shranjevanje trenutnih ročnih vnosov
        const enteredAmounts = {};
        const saveEnteredAmounts = () => {
            document.querySelectorAll('.likv-input').forEach(inp => {
                const docId = parseInt(inp.dataset.docId);
                enteredAmounts[docId] = parseNumberJS(inp.value) || 0;
            });
        };

        // Izris tabele
        const renderTableHTML = () => {
            const vsebina = document.getElementById('likv-vsebina');
            if (vsiPrikazani.length === 0) {
                vsebina.innerHTML = '<p style="text-align:center; padding:20px; color:#888;">Ni najdenih računov.</p>';
                return;
            }

            let html = `
                <table style="width:100%; font-size:0.9em; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid #dee2e6; background: #f8f9fa;">
                            <th style="text-align:left; padding:10px;">Dokument</th>
                            <th style="text-align:left; padding:10px;">Partner</th>
                            <th style="text-align:left; padding:10px;">Datum</th>
                            <th style="text-align:right; padding:10px;">Znesek</th>
                            <th style="text-align:right; padding:10px;">Odprto</th>
                            <th style="text-align:right; padding:10px; width:120px;">Plačilo</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            vsiPrikazani.forEach(d => {
                const zePovezano = d.ze_povezano_to || 0;
                const zeShranjeno = d.shranjeno_v_bazi || 0;
                const maxMozno = d.preostanek + zeShranjeno;
                html += `
                    <tr style="border-bottom: 1px solid #dee2e6;">
                        <td style="padding:10px; font-weight: 500;">${d.tip === 'izdani_racuni' ? 'IR' : d.tip === 'prejeti_racuni' ? 'PR' : d.tip === 'dobropisi' ? 'DP' : 'PD'} ${d.stevilka}</td>
                        <td style="padding:10px; color:#555;">${d.partner_naziv || '/'}</td>
                        <td style="padding:10px; color:#666;">${formatDateJS(d.datum_izdaje)}</td>
                        <td style="padding:10px; text-align:right;">${formatMoneyJS(d.znesek_skupaj)}</td>
                        <td style="padding:10px; text-align:right; color:var(--primary-red); font-weight:bold;">${formatMoneyJS(maxMozno)}</td>
                        <td style="padding:10px; text-align:right;">
                            <input type="text" class="likv-input" data-doc-id="${d.id}" data-max="${maxMozno}" 
                                   value="${formatNumberJS(zePovezano)}" 
                                   style="width:100%; text-align:right; padding:6px; border:1px solid #ccc; border-radius:4px;"
                                   oninput="window.preracunajLikvidacijo(${skupniZnesek})">
                        </td>
                    </tr>
                `;
            });
            html += '</tbody></table>';
            vsebina.innerHTML = html;
            window.preracunajLikvidacijo(skupniZnesek);
        };

        // Prvotni izris
        renderTableHTML();

        // Funkcionalnost iskanja
        const performSearch = async () => {
            saveEnteredAmounts();
            const query = document.getElementById('likv-search-input').value.trim();
            document.getElementById('likv-vsebina').innerHTML = 'Iščem odprte račune...';
            
            let searchResults = [];
            if (query) {
                const searchRes = await fetch(`/api/likvidacija/iskanje_racunov?q=${encodeURIComponent(query)}`);
                searchResults = await searchRes.json();
            } else {
                const res = await fetch(`/api/likvidacija/odprte_postavke/${partnerId}`);
                searchResults = await res.json();
            }
            
            const noviPrikazani = [];
            
            // 1. Dodamo rezultate iskanja
            searchResults.forEach(sr => {
                const obstojeci = vsiPrikazani.find(x => x.id === sr.id);
                if (obstojeci) {
                    noviPrikazani.push(obstojeci);
                } else {
                    noviPrikazani.push({
                        ...sr,
                        shranjeno_v_bazi: 0,
                        ze_povezano_to: enteredAmounts[sr.id] || 0
                    });
                }
            });
            
            // 2. Ohranimo vse dokumente, ki imajo trenutno vnesen znesek > 0, da se ne izgubijo ob iskanju
            vsiPrikazani.forEach(d => {
                const vnos = enteredAmounts[d.id] || 0;
                if (vnos > 0 && !noviPrikazani.some(x => x.id === d.id)) {
                    noviPrikazani.push(d);
                }
            });
            
            vsiPrikazani = noviPrikazani;
            // Prenesemo posodobljene vnose
            vsiPrikazani.forEach(d => {
                if (enteredAmounts[d.id] !== undefined) {
                    d.ze_povezano_to = enteredAmounts[d.id];
                }
            });
            
            vsiPrikazani.sort((a,b) => a.datum_izdaje.localeCompare(b.datum_izdaje));
            renderTableHTML();
        };

        document.getElementById('likv-search-btn').onclick = performSearch;
        document.getElementById('likv-search-input').onkeydown = (ev) => {
            if (ev.key === 'Enter') {
                ev.preventDefault();
                performSearch();
            }
        };

        // Gumb Potrdi
        document.getElementById('btn-potrdi-likvidacijo').onclick = async () => {
            const povezi = [];
            document.querySelectorAll('.likv-input').forEach(inp => {
                const val = parseNumberJS(inp.value);
                if (val > 0) {
                    povezi.push({
                        dokument_id: parseInt(inp.dataset.docId),
                        znesek: val
                    });
                }
            });

            const res = await fetch('/api/likvidacija/povezi', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    izpisek_postavka_id: postavkaId,
                    povezave: povezi
                })
            });

            if (res.ok) {
                document.getElementById('likvidacija-modal-overlay').style.display = 'none';
                const izpId = document.getElementById('izpisek_id_skrito')?.value;
                if (izpId) window.showUrediIzpisek(izpId);
                else renderIzpiski();
            } else {
                const errData = await res.json().catch(() => ({}));
                alert("Napaka pri shranjevanju likvidacije:\n" + (errData.detail || errData.message || res.statusText || "Neznana napaka"));
            }
        };

        // Gumbi za ročno likvidacijo
        const btnManual = document.getElementById('btn-manualna-likvidacija');
        if (btnManual) {
            btnManual.onclick = async () => {
                if (confirm("Ali želite to postavko označiti kot ročno likvidirano?")) {
                    const res = await fetch('/api/likvidacija/manualna', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ izpisek_postavka_id: postavkaId, manualna: true })
                    });
                    if (res.ok) {
                        document.getElementById('likvidacija-modal-overlay').style.display = 'none';
                        if (sourceBox) {
                            sourceBox.querySelector('.i-manualna').value = "1";
                            window.osveziLikvidacijskiGumb(sourceBox);
                        } else {
                            const izpId = document.getElementById('izpisek_id_skrito')?.value;
                            if (izpId) window.showUrediIzpisek(izpId);
                            else renderIzpiski();
                        }
                    } else {
                        alert("Napaka pri označevanju ročne likvidacije.");
                    }
                }
            };
        }

        const btnPreklicManual = document.getElementById('btn-preklic-manualne');
        if (btnPreklicManual) {
            btnPreklicManual.onclick = async () => {
                const res = await fetch('/api/likvidacija/manualna', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ izpisek_postavka_id: postavkaId, manualna: false })
                });
                if (res.ok) {
                    document.getElementById('likvidacija-modal-overlay').style.display = 'none';
                    if (sourceBox) {
                        sourceBox.querySelector('.i-manualna').value = "0";
                        window.osveziLikvidacijskiGumb(sourceBox);
                    } else {
                        const izpId = document.getElementById('izpisek_id_skrito')?.value;
                        if (izpId) window.showUrediIzpisek(izpId);
                        else renderIzpiski();
                    }
                } else {
                    alert("Napaka pri preklicu ročne likvidacije.");
                }
            };
        }

    } catch(e) { 
        console.error(e);
        document.getElementById('likv-vsebina').innerHTML = 'Napaka pri nalaganju podatkov.'; 
    }
};;

window.preracunajLikvidacijo = function(skupniZnesek) {
    let porabljeno = 0;
    document.querySelectorAll('.likv-input').forEach(inp => {
        porabljeno += parseNumberJS(inp.value);
    });
    const preostanek = skupniZnesek - porabljeno;
    const el = document.getElementById('likv-preostanek');
    el.textContent = formatMoneyJS(preostanek);
    if (Math.abs(preostanek) < 0.01) el.style.color = 'green';
    else if (preostanek < 0) el.style.color = 'red';
    else el.style.color = 'orange';
};

window.osveziLogotip = async function() {
    try {
        const res = await fetch('/api/nastavitve');
        if (res.ok) {
            const data = await res.json();
            const logoContainer = document.getElementById('brand-logo-container');
            if (logoContainer) {
                if (data.logo_url) {
                    logoContainer.innerHTML = `<img src="${data.logo_url}" alt="${data.kratko_ime || data.naziv || 'Logotip'}" style="max-width:100%; max-height:45px; object-fit:contain;">`;
                } else {
                    logoContainer.innerHTML = `<h1 id="brand-text">Invoice83</h1>`;
                }
            }
        }
    } catch(e) {
        console.error("Napaka pri osveževanju logotipa", e);
    }
};

window.handleLogoUpload = async function(input) {
    if (!input.files || !input.files.length) return;
    const file = input.files[0];
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const res = await fetch('/api/nastavitve/logo', {
            method: 'POST',
            body: formData
        });
        
        if (res.ok) {
            alert("Logotip je bil uspešno naložen.");
            window.osveziLogotip();
            
            // Posodobi predogled v nastavitvah, če obstaja
            const prev = document.getElementById('settings-logo-preview');
            const btnRemove = document.getElementById('btn-remove-logo');
            const data = await res.json();
            if (prev && data.path) {
                prev.innerHTML = `<img src="${data.path}?t=${new Date().getTime()}" style="max-width:100%; max-height:100%; object-fit:contain;">`;
                if (btnRemove) btnRemove.style.display = 'block';
            }
        } else {
            const err = await res.json();
            alert("Napaka pri nalaganju logotipa: " + (err.detail || "Neznana napaka"));
        }
    } catch (e) {
        console.error(e);
        alert("Napaka pri komunikaciji s strežnikom.");
    } finally {
        input.value = '';
    }
};

window.odstraniLogotip = async function() {
    if (!confirm("Ali ste prepričani, da želite odstraniti logotip podjetja?")) return;
    try {
        const res = await fetch('/api/nastavitve/logo', {
            method: 'DELETE'
        });
        if (res.ok) {
            alert("Logotip je bil odstranjen.");
            window.osveziLogotip();
            const prev = document.getElementById('settings-logo-preview');
            const btnRemove = document.getElementById('btn-remove-logo');
            if (prev) prev.innerHTML = '<span style="font-size: 0.8rem; color: var(--text-muted);">Ni logotipa</span>';
            if (btnRemove) btnRemove.style.display = 'none';
        } else {
            alert("Napaka pri brisanju logotipa.");
        }
    } catch(e) {
        console.error(e);
        alert("Napaka pri komunikaciji s strežnikom.");
    }
};

// --- PODJETJA (MULTI-COMPANY) ---
window.osveziPodjetja = async function() {
    try {
        const res = await fetch('/api/companies');
        const data = await res.json();
        const switcher = document.getElementById('company-switcher');
        if (!switcher) return;
        
        let html = '';
        data.items.forEach(c => {
            html += `<option value="${c.id}" ${c.id === data.active_id ? 'selected' : ''}>${c.name}</option>`;
        });
        html += '<option value="new">+ Dodaj novo podjetje...</option>';
        switcher.innerHTML = html;
    } catch(e) { console.error("Napaka pri nalaganju podjetij", e); }
};

window.switchCompany = async function(id) {
    if (id === 'new') {
        renderNastavitve('podjetje', true);
        return;
    }
    const res = await fetch(`/api/companies/switch/${id}`, { method: 'POST' });
    if (res.ok) {
        window.location.reload();
    } else {
        alert("Napaka pri preklopu podjetja.");
    }
};

// Zapri popup ob kliku zunaj okna
document.addEventListener('click', function(e) {
    const overlay = document.getElementById('partner-popup-overlay');
    if(overlay && e.target === overlay) window.zapriPartnerPopup();
    
    const likvOverlay = document.getElementById('likvidacija-modal-overlay');
    if(likvOverlay && e.target === likvOverlay) likvOverlay.style.display = 'none';
});

// --- ZAGON: Naloži zadnji aktivni modul ob odprtju (samo za trenutno sejo/osvežitev) ---
try {
    window.llamaLearningMode = true; // Privzeto true
    fetch('/api/settings/llama')
        .then(res => res.json())
        .then(data => {
            window.llamaLearningMode = !!data.learning_mode;
            const activeTab = window.appTabs.find(t => t.id === window.activeTabId);
            if (activeTab && activeTab.module === 'prejeti_racuni') {
                renderDokumenti('prejeti_racuni', 'Prejeti računi');
            }
        })
        .catch(err => console.error("Napaka pri branju Llama nastavitev", err));

    window.toggleLlamaLearningMode = async function(checked) {
        window.llamaLearningMode = checked;
        try {
            await fetch('/api/settings/llama', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ learning_mode: checked })
            });
            // Osveži prikaz glede na to kje smo
            const activeTab = window.appTabs.find(t => t.id === window.activeTabId);
            if (activeTab) {
                if (activeTab.module === 'nastavitve') {
                    renderNastavitve('ai');
                } else if (activeTab.module === 'prejeti_racuni') {
                    renderDokumenti('prejeti_racuni', 'Prejeti računi');
                }
            }
        } catch (err) {
            console.error("Napaka pri shranjevanju Llama nastavitve", err);
        }
    };

    window._llamaMarkAccurateAndConfirm = function(btn) {
        const modal = btn.closest('.modal-overlay');
        if (modal) {
            const confirmBtn = modal.querySelector('#btn-confirm-import');
            if (confirmBtn) {
                confirmBtn.click();
            }
        }
    };

    osveziPodjetja();
    window.osveziLogotip();
    
    // Obnovimo shranjene zavihke iz seje ob osvežitvi. Če jih ni, odpremo nadzorno ploščo.
    if (!window.loadTabsState()) {
        showModule('dashboard');
    }
    
    window._appLoaded = true;
    if (window._bootTimer) clearTimeout(window._bootTimer);
} catch (bootErr) {
    console.error("Boot Error:", bootErr);
    const errOverlay = document.getElementById('startup-monitor-overlay');
    if (errOverlay) {
        errOverlay.style.display = 'flex';
        document.getElementById('startup-error-msg').innerHTML = 
            `<b>Napaka pri zagonu:</b> <br>${bootErr.message}<br><small style='color:#999'>Preverite konzolo brskalnika.</small>`;
    }
}

async function showBulkImportPreview(items, tip) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal-backdrop';
        modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; z-index:2000;";
        
        const isDoc = tip === 'prejeti_racuni';
        const title = isDoc ? "Množičen uvoz računov" : "Množičen uvoz bančnih izpiskov";

        // Preverimo, koliko partnerjev manjka
        const missingPartners = isDoc ? items.filter(item => !item.partner_obstaja) : [];
        
        let tableRows = items.map((item, idx) => {
            if (!isDoc) {
                return `<tr>
                    <td style="padding:10px;">${item.stevilka_izpiska || 'Neznano'}</td>
                    <td style="padding:10px;">${formatDateJS(item.datum)}</td>
                    <td style="padding:10px;">Bančni izpisek</td>
                    <td style="padding:10px; text-align:right; font-weight:bold;">${formatNumberJS(item.koncno_stanje)} €</td>
                </tr>`;
            }
            const partnerMissing = !item.partner_obstaja;
            const partnerLabel = partnerMissing
                ? `<span style="color:#c92a2a; font-weight:bold;">⚠️ ${item.partner.naziv || 'Neznan'} — NI V BAZI!</span>`
                : `<span style="color:#2b8a3e;">✓ ${item.partner.naziv || 'Neznan'}</span>`;
            return `<tr style="${partnerMissing ? 'background:#fff5f5;' : ''}">
                <td style="padding:10px;">${item.stevilka}</td>
                <td style="padding:10px;">${formatDateJS(item.datum_izdaje)}</td>
                <td style="padding:10px;">${partnerLabel}</td>
                <td style="padding:10px; text-align:right; font-weight:bold;">${formatNumberJS(item.znesek_skupaj)} €</td>
            </tr>`;
        }).join('');

        const missingWarn = (isDoc && missingPartners.length > 0) ? `
            <div style="background:#fff5f5; border:1px solid #ffc9c9; border-radius:6px; padding:12px; margin-bottom:16px; color:#c92a2a;">
                <strong>⚠️ ${missingPartners.length} partner(jev) ni v bazi!</strong>
                <p style="margin-top:6px; font-size:0.9rem; line-height:1.4;">
                    Pred množičnim uvozom morate urediti vse označene partnerje. Prekličite uvoz, pojdite v modul 
                    <strong>Partnerji</strong> in dodajte manjkajoče partnerje, nato uvozite ponovno.
                </p>
                <ul style="margin-top:6px; font-size:0.85rem; padding-left:18px;">
                    ${missingPartners.map(m => `<li>${m.partner.naziv || 'Neznan'} (${m.partner.davcna_stevilka || '—'})</li>`).join('')}
                </ul>
            </div>
        ` : '';

        modal.innerHTML = `
            <div style="background:white; padding:30px; border-radius:12px; max-width:800px; width:90%; max-height:80vh; overflow:auto; box-shadow:0 10px 40px rgba(0,0,0,0.2);">
                <h3 style="margin-top:0; color:var(--primary-blue);">${title}</h3>
                <p style="color:#666; margin-bottom:20px;">V ZIP arhivu je bilo najdenih <strong>${items.length}</strong> dokumentov. Ali jih želite uvoziti vse hkrati?</p>
                
                ${missingWarn}

                <table style="width:100%; border-collapse:collapse; margin-bottom:25px;">
                    <thead style="background:#f8f9fa;">
                        <tr>
                            <th style="padding:10px; text-align:left;">Številka</th>
                            <th style="padding:10px; text-align:left;">Datum</th>
                            <th style="padding:10px; text-align:left;">Partner / Opis</th>
                            <th style="padding:10px; text-align:right;">Znesek</th>
                        </tr>
                    </thead>
                    <tbody>${tableRows}</tbody>
                </table>

                <div style="display:flex; justify-content:flex-end; gap:12px;">
                    <button class="btn" style="background:#eee; color:#333;" id="bulk-cancel">Prekliči</button>
                    <button class="btn btn-blue" id="bulk-confirm" style="padding:10px 25px; font-weight:bold;"
                        ${(isDoc && missingPartners.length > 0) ? 'disabled style="opacity:0.5; cursor:not-allowed; padding:10px 25px; font-weight:bold;"' : ''}>
                        Vnesi vse (${items.length})
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        modal.querySelector('#bulk-cancel').onclick = () => {
            modal.remove();
            resolve(false);
        };
        
        modal.querySelector('#bulk-confirm').onclick = async () => {
            // Dvojna zaščita — ne dovolimo, če kateri partner manjka
            if (isDoc && items.some(item => !item.partner_obstaja)) {
                alert('Nekateri partnerji niso v bazi. Dodajte jih najprej in uvozite ponovno.');
                return;
            }

            const btn = modal.querySelector('#bulk-confirm');
            const originalText = btn.innerText;
            btn.innerText = "Shranjujem...";
            btn.disabled = true;
            
            try {
                const url = isDoc ? '/api/dokumenti/import_eslog_bulk_potrdi' : '/api/izpiski/bulk_potrdi';
                const res = await fetch(url, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ items: items })
                });
                
                if (res.ok) {
                    modal.remove();
                    alert(`Uspešno uvoženih ${items.length} dokumentov.`);
                    if (isDoc) renderDokumenti('prejeti_racuni', 'Prejeti računi');
                    else renderIzpiski();
                    resolve(true);
                } else {
                    const err = await res.json();
                    alert("Prišlo je do napake pri množičnem shranjevanju: " + (err.detail || "Neznana napaka"));
                    btn.innerText = originalText;
                    btn.disabled = false;
                }
            } catch (e) {
                console.error(e);
                alert("Napaka pri komunikaciji s strežnikom.");
                btn.innerText = originalText;
                btn.disabled = false;
            }
        };
    });
}


// --- NAVODILA IN POMOČ ---
async function renderHelp() {
    titleEl.textContent = "Navodila in pomoč";
    
    const helpTopics = [
        {
            id: 'splosno',
            title: 'O programu Invoice83',
            icon: '🏢',
            content: 'Invoice83 je celovita rešitev za vodenje računovodstva za manjša podjetja in s.p.',
            details: `
                <h4>Pregled aplikacije</h4>
                <p>Invoice83 je zasnovan tako, da vam prihrani čas pri vsakodnevnih opravilih. Glavne prednosti so:</p>
                <ul>
                    <li><strong>Preglednost:</strong> Vse na enem mestu - od računov do glavne knjige.</li>
                    <li><strong>Avtomatizacija:</strong> Pametni uvoz dokumentov, OCR in samodejno številčenje.</li>
                    <li><strong>Hitrost:</strong> Sodoben vmesnik (SPA) s pojavnimi okni omogoča delo brez čakanja na nalaganje strani.</li>
                </ul>
                <div style="background:#f1f3f5; padding:15px; border-radius:8px; margin-top:15px;">
                    <strong>Namig:</strong> Na nadzorni plošči lahko spremljate prihodke, odhodke in neplačane račune v realnem času.
                </div>
            `
        },
        {
            id: 'izdani',
            title: 'Izdani računi',
            icon: '📄',
            content: 'Ustvarjanje, pošiljanje in vodenje izdanih dokumentov.',
            details: `
                <div style="text-align:center; margin-bottom:20px;">
                    <img src="/brain/9cbc2d23-060b-4ae5-83e1-2513837211eb/help_invoice_creation_1776943686342.png" style="max-width:100%; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                </div>
                <ol>
                    <li>Pojdite v modul <strong>Izdani računi</strong>.</li>
                    <li>Kliknite gumb <strong>+ Nov dokument</strong> (odpre se hitro pojavno okno).</li>
                    <li>Izberite kupca. Številka dokumenta se določi <strong>samodejno</strong>.</li>
                    <li>Vnesite postavke. Vsaki postavki lahko dodate tudi <strong>popust (rabat)</strong>.</li>
                    <li>Kliknite <strong>Shrani</strong>.</li>
                </ol>
                <p>Dokumenti so takoj pripravljeni za tisk v PDF ali neposredno pošiljanje po e-pošti.</p>
            `
        },
        {
            id: 'prejeti',
            title: 'Prejeti računi in Uvoz',
            icon: '📥',
            content: 'Pametni uvoz in OCR prepoznavanje dokumentov.',
            details: `
                <div style="text-align:center; margin-bottom:20px;">
                    <img src="/brain/9cbc2d23-060b-4ae5-83e1-2513837211eb/help_ocr_import_1776944528721.png" style="max-width:100%; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                </div>
                <h4>Množičen uvoz in OCR</h4>
                <p>Program Invoice83 podpira napredno tehnologijo OCR za branje podatkov s slik.</p>
                <ul>
                    <li><strong>XML uvoz:</strong> Najhitrejši način za e-SLOG račune s samodejnim prepoznavanjem postavk.</li>
                    <li><strong>OCR prepoznavanje:</strong> Naložite sliko računa (PNG/JPG), program pa bo samodejno prepoznal datum, znesek in številko.</li>
                    <li><strong>Preprečevanje dvojnikov:</strong> Sistem vas bo opozoril, če račun s to številko pri istem dobavitelju že obstaja.</li>
                </ul>
            `
        },
        {
            id: 'izpiski',
            title: 'Bančni izpiski',
            icon: '🏦',
            content: 'Uvoz bančnega prometa in likvidacija odprtih postavk.',
            details: `
                <div style="text-align:center; margin-bottom:20px;">
                    <img src="/brain/9cbc2d23-060b-4ae5-83e1-2513837211eb/help_bank_liquidation_1776944554620.png" style="max-width:100%; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                </div>
                <h4>Likvidacija računov</h4>
                <p>Postopek povezovanja bančnih transakcij z računi imenujemo likvidacija.</p>
                <ol>
                    <li>Uvozite bančni izpisek (PDF ali SEPA XML).</li>
                    <li>Program bo samodejno označil račune, kjer se ujemajo partner in znesek.</li>
                    <li>Za neprepoznane postavke kliknite ikono <strong>Lijak (Likvidacija)</strong>.</li>
                </ol>
            `
        },
        {
            id: 'potni',
            title: 'Potni nalogi',
            icon: '🚗',
            content: 'Obračun kilometrine in dnevnic za zaposlene.',
            details: `
                <div style="text-align:center; margin-bottom:20px;">
                    <img src="/brain/9cbc2d23-060b-4ae5-83e1-2513837211eb/help_travel_map_1776944665132.png" style="max-width:100%; border-radius:8px; box-shadow:0 4px 10px rgba(0,0,0,0.1);">
                </div>
                <h4>Izračun razdalje z zemljevidi</h4>
                <p>Pri vnosu potnega naloga vam ni treba ročno preverjati kilometrov.</p>
                <ul>
                    <li>Vnesite relacijo in kliknite gumb <strong>Zemljevid</strong>.</li>
                    <li>Sistem bo preko OpenStreetMap izračunal natančno razdaljo.</li>
                </ul>
            `
        },
        {
            id: 'place',
            title: 'Plače in Prispevki',
            icon: '💰',
            content: 'Obračun plač za zaposlene in prispevkov za s.p.',
            details: `
                <h4>Obračun prispevkov</h4>
                <p>Vnesite bruto plačo ali vrsto zavarovanja (npr. s.p. 100%), sistem pa bo izračunal:</p>
                <ul>
                    <li>Prispevke za PIZ, ZZ, starševstvo in zaposlovanje.</li>
                    <li>Akontacijo dohodnine.</li>
                    <li>Neto znesek za izplačilo.</li>
                </ul>
                <p>Sistem pripravi tudi UPN-QR kode za plačilo vseh prispevkov in neto plače. Obračuni se ob knjiženju samodejno prenesejo v <strong>Glavno knjigo</strong>.</p>
            `
        },
        {
            id: 'zaloga',
            title: 'Materialno vodenje in Zaloga',
            icon: '📦',
            content: 'Sledenje zalogam artiklov, avtomatsko knjiženje prejemov in prodaje.',
            details: `
                <h4>Realnočasovno vodenje zalog</h4>
                <p>Program Invoice83 omogoča popolno sledljivost vašega blaga brez odvečnega dela.</p>
                <ul>
                    <li><strong>Avtomatski premiki:</strong> Zaloga se posodobi takoj, ko <strong>shranite</strong> dokument (račun ali prejeti račun).</li>
                    <li><strong>Prejeti računi (Prejem):</strong> Ko shranite prejeti račun, program samodejno poveča zalogo artiklov, ki so na dokumentu.</li>
                    <li><strong>Izdani računi (Prodaja):</strong> Ob shranjevanju izdanega računa se zaloga ustrezno zmanjša.</li>
                </ul>
                <div style="background:#e7f5ff; padding:15px; border-radius:8px; border-left:5px solid var(--primary-blue); margin:15px 0;">
                    <strong>Pametno ustvarjanje:</strong> Če artikla še nimate v šifrantu, ga lahko ustvarite neposredno iz vrstice računa s klikom na ikono 💾. Program bo samodejno povezal ID artikla z vrstico in posodobil zalogo ob shranjevanju dokumenta.
                </div>
                <p>Stanje zaloge lahko kadarkoli preverite v <strong>Šifrantu artiklov</strong>.</p>
            `
        },
        {
            id: 'dashboard',
            title: 'Osebna nadzorna plošča',
            icon: '📊',
            content: 'Prilagodite svojo nadzorno ploščo z gradniki po vaši meri.',
            details: `
                <h4>Personalizacija nadzorne plošče</h4>
                <p>Nadzorna plošča je vaš prvi stik z aplikacijo. Zdaj jo lahko popolnoma prilagodite:</p>
                <ul>
                    <li><strong>Urejanje blokov:</strong> Kliknite gumb <strong>"Uredi nadzorno ploščo"</strong> v zgornjem desnem kotu.</li>
                    <li><strong>Dodajanje novih:</strong> Izbirate lahko med različnimi tipi blokov (grafi prihodkov, seznami neplačanih računov, stanje zaloge, opomniki).</li>
                    <li><strong>Premikanje in brisanje:</strong> Bloke lahko poljubno razporejate ali odstranite tiste, ki jih ne potrebujete.</li>
                    <li><strong>Shranjevanje:</strong> Ko ste z razporeditvijo zadovoljni, kliknite <strong>"Shrani razpored"</strong>. Nastavitve se bodo shranile v vaš profil podjetja.</li>
                </ul>
                <div style="background:#fff9db; padding:15px; border-radius:8px; border-left:5px solid #fab005; margin:15px 0;">
                    <strong>Namig:</strong> Začnite s preprostim razporedom (npr. Graf prihodkov in Seznam neplačanih računov) in ga kasneje dopolnjujte glede na vaše potrebe.
                </div>
            `
        },
        {
            id: 'crm',
            title: 'CRM in Upravljanje strank',
            icon: '🤝',
            content: 'Vodenje prodajnih priložnosti, interakcij in opravil za vaše partnerje.',
            details: `
                <h4>CRM Modul (Customer Relationship Management)</h4>
                <p>Invoice83 zdaj vključuje celovito orodje za upravljanje odnosov s strankami:</p>
                <ul>
                    <li><strong>Prodajni kanal (Kanban):</strong> Pregledno sledenje priložnostim od prvega stika do sklenjenega posla.</li>
                    <li><strong>Interakcije:</strong> Beleženje vseh klicev, e-poštnih sporočil in sestankov neposredno pri partnerju.</li>
                    <li><strong>Aktivnosti:</strong> Načrtovanje in sledenje opravilom (To-Do), da nikoli ne pozabite na klic ali sestanek.</li>
                    <li><strong>Zgodovina:</strong> Celovit pregled vseh dogodkov, povezanih s posamezno stranko, na enem mestu.</li>
                </ul>
                <p>Modul CRM je tesno povezan s <strong>Partnerji</strong>, kjer lahko vidite vse interakcije neposredno v detajlih partnerja.</p>
            `
        },
        {
            id: 'finance',
            title: 'Glavna knjiga in Finance',
            icon: '📉',
            content: 'Samodejno in ročno knjiženje temeljnic, bruto bilanca in finančna poročila.',
            details: `
                <h4>Računovodsko vodenje financ</h4>
                <p>Invoice83 ni le program za račune, ampak celovit računovodski sistem:</p>
                <ul>
                    <li><strong>Temeljnice:</strong> Sistem samodejno knjiži prejete in izdane račune ter plače. Omogoča tudi vnos ročnih temeljnic.</li>
                    <li><strong>Bruto bilanca:</strong> Takojšen vpogled v stanje kontov in poslovanje podjetja.</li>
                    <li><strong>Konto kartica:</strong> Podrobno iskanje in pregled vseh knjižb na posameznem kontu v izbranem obdobju.</li>
                    <li><strong>Osnovna sredstva:</strong> Vodenje registra osnovnih sredstev in samodejni obračun amortizacije.</li>
                </ul>
                <p>Vsa poročila lahko izvozite za potrebe zunanjega računovodstva ali davčne uprave.</p>
            `
        },
        {
            id: 'kompenzacije',
            title: 'Kompenzacije in povezovanje',
            icon: '🔗',
            content: 'Medsebojno zapiranje dokumentov in povezovanje računov.',
            details: `
                <h4>Povezovanje dokumentov in Kompenzacije</h4>
                <p>Sistem omogoča napredno povezovanje dokumentov za namen kompenzacij ali sledljivosti:</p>
                <ul>
                    <li><strong>Iskanje:</strong> Pri urejanju dokumenta lahko v polju "Išči dokument za kompenzacijo" poiščete poljuben račun ali dobropis.</li>
                    <li><strong>Povezava:</strong> Ko izberete dokument, se ta poveže s trenutnim. To je vidno v razdelku "Kompenzacija".</li>
                    <li><strong>Navigacija:</strong> S klikom na gumb <strong>Odpri ↗</strong> lahko takoj preklopite na povezan dokument, s gumbom <strong>← Nazaj</strong> pa se vrnete na prejšnjega.</li>
                </ul>
                <p>To omogoča hitro prehajanje med povezanimi računi in dobropisi brez iskanja po seznamih.</p>
            `
        }
    ];

    window.renderHelpDetail = function(topicId) {
        const topic = helpTopics.find(t => t.id === topicId);
        if (!topic) return;

        const mainContent = document.getElementById('help-main-area');
        mainContent.innerHTML = `
            <div style="animation: fadeIn 0.3s forwards;">
                <button class="btn" style="background:#eee; color:#333; margin-bottom:20px;" onclick="window.renderHelpList()">← Nazaj na seznam</button>
                <div style="display:flex; align-items:center; gap:15px; margin-bottom:20px;">
                    <span style="font-size:2.5rem;">${topic.icon}</span>
                    <h2 style="margin:0; color:var(--primary-blue);">${topic.title}</h2>
                </div>
                <div class="help-details-body" style="font-size:1.1rem; line-height:1.6; color:#333;">
                    ${topic.details}
                </div>
                <div style="margin-top:40px; padding:20px; background:var(--bg-sidebar); border-radius:12px; display:flex; align-items:center; gap:15px;">
                    <div style="font-size:2rem;">💡</div>
                    <div>
                        <strong>Potrebujete več informacij?</strong><br>
                        Pišite nam na <a href="mailto:invoice@83.si">invoice@83.si</a> in z veseljem vam bomo pomagali.
                    </div>
                </div>
            </div>
        `;
    };

    window.renderHelpList = function() {
        const mainContent = document.getElementById('help-main-area');
        mainContent.innerHTML = `
            <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="color: var(--primary-blue); font-size: 1.8rem; margin-bottom: 10px;">Kako vam lahko pomagamo?</h2>
                <p style="color: #666;">Prebrskajte med navodili ali uporabite iskalnik spodaj.</p>
                <div style="position: relative; max-width: 500px; margin: 20px auto;">
                    <input type="text" id="help-search" placeholder="Išči po navodilih (npr. uvoz, qr koda, potni nalog)..." 
                           style="width: 100%; padding: 12px 40px 12px 15px; border: 2px solid #e9ecef; border-radius: 30px; font-size: 1rem; outline: none; transition: border-color 0.2s;">
                    <span style="position: absolute; right: 15px; top: 12px; font-size: 1.2rem;">🔍</span>
                </div>
            </div>

            <div id="help-content-list" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px;">
                ${helpTopics.map(topic => `
                    <div class="help-card" data-id="${topic.id}" data-title="${topic.title.toLowerCase()}" data-content="${topic.content.toLowerCase()}"
                         onclick="window.renderHelpDetail('${topic.id}')"
                         style="background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 10px; padding: 20px; transition: all 0.2s; cursor: pointer; position:relative; overflow:hidden;">
                        <div style="font-size:2rem; margin-bottom:10px;">${topic.icon}</div>
                        <h4 style="color: var(--primary-blue); margin-top: 0; margin-bottom: 10px;">${topic.title}</h4>
                        <p style="font-size: 0.9rem; color: #444; line-height: 1.5; margin-bottom: 0;">${topic.content}</p>
                        <div style="position:absolute; bottom:0; right:0; padding:10px; opacity:0.1; font-size:4rem; transform:translate(20%, 20%);">${topic.icon}</div>
                    </div>
                `).join('')}
            </div>

            <div id="help-no-results" style="display: none; text-align: center; padding: 40px; color: #888;">
                <p style="font-size: 3rem; margin-bottom: 10px;">🤔</p>
                <p>Nismo našli navodil za vaš iskalni niz. Poskusite z drugimi besedami.</p>
            </div>
        `;

        // Iskanje v realnem času
        const searchInput = document.getElementById('help-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const query = e.target.value.toLowerCase().trim();
                const cards = document.querySelectorAll('.help-card');
                let visibleCount = 0;
                cards.forEach(card => {
                    const title = card.getAttribute('data-title');
                    const content = card.getAttribute('data-content');
                    if (title.includes(query) || content.includes(query)) {
                        card.style.display = 'block';
                        visibleCount++;
                    } else {
                        card.style.display = 'none';
                    }
                });
                document.getElementById('help-no-results').style.display = visibleCount === 0 ? 'block' : 'none';
            });
        }
    };

    contentDiv.innerHTML = `
        <div id="help-wrapper" style="max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.05);">
            <div id="help-main-area"></div>
            
            <div style="margin-top: 50px; padding-top: 30px; border-top: 1px solid #eee; text-align: center;">
                <h4 style="margin-bottom: 10px;">Še vedno potrebujete pomoč?</h4>
                <p style="color: #666; font-size: 0.9rem;">Če niste našli odgovora, nas lahko kontaktirate na <a href="mailto:invoice@83.si" style="color: var(--primary-blue); font-weight: bold;">invoice@83.si</a>.</p>
            </div>
        </div>
        <style>
            .help-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 10px 20px rgba(0,0,0,0.08);
                border-color: var(--primary-blue);
                background: white;
            }
            .help-card:hover h4 { color: var(--primary-red); }
            @keyframes fadeIn { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
            .help-details-body h4 { color: var(--primary-blue); margin-top:25px; margin-bottom:10px; border-bottom:1px solid #eee; padding-bottom:5px; }
            .help-details-body ul, .help-details-body ol { padding-left:20px; }
            .help-details-body li { margin-bottom:8px; }
        </style>
    `;

    window.renderHelpList();
}


async function renderZgodovina() {
    titleEl.textContent = "Zgodovina sprememb";
    contentDiv.innerHTML = `
        <div id="zgodovina-wrapper" style="max-width: 900px; margin: 0 auto; background: white; padding: 30px; border-radius: 12px; box-shadow: 0 5px 20px rgba(0,0,0,0.05);">
            <div style="display:flex; align-items:center; gap:15px; margin-bottom:30px; border-bottom: 2px solid var(--bg-sidebar); padding-bottom: 15px;">
                <span style="font-size:2.5rem;">🕒</span>
                <h2 style="margin:0; color:var(--primary-blue);">Zgodovina sprememb in novosti</h2>
            </div>
            <div id="zgodovina-marker" style="background:#fff; border:1px solid #eee; border-radius:10px; padding:20px; box-shadow: 0 2px 10px rgba(0,0,0,0.02);">
                    <div style="margin-bottom:25px;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                            <span style="background:var(--primary-blue); color:white; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">23. 06. 2026</span>
                            <span style="color:#666; font-size:0.9rem;">Zadnja posodobitev</span>
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
                            <li>Popravek napake pri shranjevanju likvidacij (varnostna varovalka za None vrstico)</li>
                        </ul>
                    </div>

                    <div style="margin-bottom:25px; padding-top:15px; border-top:1px dashed #eee;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                            <span style="background:#f1f3f5; color:#495057; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">16. 06. 2026</span>
                            
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
                            <li><strong>Oblikovanje:</strong> Gumbi za prenos dokumentov imajo sedaj boljšo vidnost ter enak, prefinjen bel slog s svetlo obrobo in prehodom ob preletu, kot gumb "Pošlji po e-pošti".</li>
                            <li><strong>Obračun plač in prispevkov:</strong> Razmejitev na "Skupaj prispevki" in "Skupaj povračila" v desnem delu obračunskega lista (pod QR kodo). Prehrana (malica) in potni stroški se ne vštevata več v prispevke in se ne seštevata skupaj.</li>
                            <li><strong>Potni nalogi:</strong> Izboljšana logika — zaposlenim se ne izpolnijo vnaprej dnevi in kilometri v potnih nalogih (ko gre za potne stroške), temveč se to vpisuje/izračunava dinamično.</li>
                            <li><strong>Popravek prevoza:</strong> Odpravljena napaka pri preračunavanju "Skupaj prevoz" (narobe preračunano od aprila naprej).</li>
                            <li><strong>Uporabniški vmesnik (UI):</strong> Vzpostavljen ločen, samostojen zavihek "Zgodovina sprememb" ter osvežena in posodobljena "Navodila in pomoč".</li>
                        </ul>
                    </div>

                    <div style="margin-bottom:25px; padding-top:15px; border-top:1px dashed #eee;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                            <span style="background:#f1f3f5; color:#495057; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">10. 06. 2026</span>
                            
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
                            <li><strong>CRM Modul:</strong> Celovit sistem za upravljanje strank, kontaktov, interakcij (klici, sestanki) in opravil s kanban pogledom prodajnega kanala.</li>
                            <li><strong>Kompenzacije:</strong> Napredno povezovanje dokumentov za namen kompenzacij in hitro prehajanje med povezanimi dokumenti (navigacija naprej/nazaj).</li>
                            <li><strong>Varnost:</strong> Avtomatsko preverjanje podvojenih številk dokumentov ob uvozu in ročnem vnosu, kar preprečuje napake v knjigovodstvu.</li>
                            <li><strong>UI Modernizacija:</strong> Prehod na sistem pojavnih oken (Popups) za vse dokumente in partnerje, kar omogoča delo brez osveževanja strani.</li>
                            <li><strong>Popusti in rabati:</strong> Popolna podpora za popuste na nivoju postavk dokumentov z avtomatskim preračunom DDV in skupnega zneska.</li>
                            <li><strong>OCR Izboljšave:</strong> Natančnejše prepoznavanje datumov storitve, popustov in rabatov pri uvozu dokumentov.</li>
                            <li><strong>Poslovna leta:</strong> Izboljšana logika preklapljanja med leti; sistem si zapomni leto tudi pri hitrem pregledu dokumentov.</li>
                        </ul>
                    </div>

                    <div style="margin-bottom:25px; padding-top:15px; border-top:1px dashed #eee;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                            <span style="background:#f1f3f5; color:#495057; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">19. 05. 2026</span>
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
                            <li><strong>Preverjanje številk:</strong> Dodano dinamično preverjanje podvojenih številk računov ob izhodu iz polja.</li>
                            <li><strong>Navigacija:</strong> Sistem si zdaj zapomni aktivni modul po osvežitvi strani (Session Storage).</li>
                            <li><strong>Stabilnost uvoza:</strong> Popravljeno prepoznavanje določenih formatov e-SLOG XML dokumentov.</li>
                        </ul>
                    </div>

                    <div style="margin-bottom:25px; padding-top:15px; border-top:1px dashed #eee;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                            <span style="background:#f1f3f5; color:#495057; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">15. 05. 2026</span>
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
                            <li><strong>Modularna nadzorna plošča:</strong> Prilagodljiv gradnik blokov (Block Builder) za osebno nadzorno ploščo.</li>
                            <li><strong>Modernizacija vmesnika:</strong> Prehod na celovit sistem pojavnih oken (popups) za vse dokumente in entitete.</li>
                            <li><strong>Hitrejša navigacija:</strong> Odstranjeni nepotrebni "Nalagam..." zasloni; neposreden dostop do urejanja s klikom na vrstico tabele.</li>
                            <li><strong>Samodejno številčenje:</strong> Vsi dokumenti (izdani, prejeti, ponudbe) zdaj uporabljajo samodejno zaporedno številčenje.</li>
                            <li><strong>Izboljšana odzivnost:</strong> Optimizirano delovanje aplikacije kot enostranska aplikacija (SPA).</li>
                        </ul>
                    </div>

                    <div style="margin-bottom:25px; padding-top:15px; border-top:1px dashed #eee;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                            <span style="background:#f1f3f5; color:#495057; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">08. 05. 2026</span>
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
                            <li><strong>Bizi.si:</strong> Izboljšano samodejno iskanje in bogatenje podatkov o podjetjih pri uvozu dokumentov.</li>
                            <li><strong>Zaposleni:</strong> Čistejši in bolj pregleden vmesnik v Seznamu zaposlenih (odstranjeni nepotrebni navigacijski elementi).</li>
                            <li><strong>Posodobitve:</strong> Vzpostavljen sistem za hitrejši prenos popravkov in novih funkcij do uporabnikov.</li>
                        </ul>
                    </div>

                    
                    <div style="margin-bottom:25px; padding-top:15px; border-top:1px dashed #eee;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                            <span style="background:#f1f3f5; color:#495057; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">07. 05. 2026</span>
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
                            <li><strong>Knjiženje plač:</strong> Implementiran celoten sistem knjiženja obračunov plač in prispevkov v glavno knjigo (temeljnice).</li>
                            <li><strong>Status "Zaprto":</strong> Obračuni zdaj sledijo statusu knjiženja; ko je dokument knjižen, dobi oznako "Zaprto" in se zaklene za urejanje.</li>
                            <li><strong>Množične akcije:</strong> Dodana podpora za skupinsko knjiženje in razknjiževanje obračunov neposredno iz seznama.</li>
                            <li><strong>Glavna knjiga:</strong> Avtomatska porazdelitev stroškov na ustrezne konte (bruto plače, neto izplačila, prispevki, dohodnina).</li>
                        </ul>
                    </div>

                    <div style="margin-bottom:25px; padding-top:15px; border-top:1px dashed #eee;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                            <span style="background:#f1f3f5; color:#495057; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">04. 05. 2026</span>
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
                            <li><strong>DDV upravljanje:</strong> Dokumenti se samodejno prilagodijo glede na status davčnega zavezanca — ne-zavezanci ne vidijo DDV stolpcev na računih in ponudbah.</li>
                            <li><strong>DDV izbira po postavkah:</strong> Davčni zavezanci lahko za vsako postavko izberejo stopnjo DDV (22 %, 9,5 %, 5 %, 0 %) z avtomatskim izračunom.</li>
                            <li><strong>Enota mere (EM):</strong> Dodan stolpec za mersko enoto pri vseh postavkah dokumentov (standard e-SLOG).</li>
                            <li><strong>Preglednejše postavke:</strong> Opis v svoji vrstici, vse numerične vrednosti spodaj z oznakami — za zavezance in nezavezance.</li>
                            <li><strong>Zakonska klavzula:</strong> Ne-zavezanci imajo na vsakem dokumentu samodejno besedilo po 94. členu ZDDV-1.</li>
                        </ul>
                    </div>

                    <div style="margin-bottom:25px; padding-top:15px; border-top:1px dashed #eee;">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
                            <span style="background:#f1f3f5; color:#495057; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">30. 04. 2026</span>
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
                            <li><strong>Optimizacija navigacije:</strong> Omogočeno neposredno urejanje partnerjev, zaposlenih in prispevkov neposredno v seznamih.</li>
                            <li><strong>Poenostavljen UI:</strong> Odstranjeni odvečni gumbi "Uredi" za bolj čist izgled.</li>
                            <li><strong>Ponudbe:</strong> Dodan gumb "Ustvari račun" neposredno iz pregleda ponudbe.</li>
                            <li><strong>Stabilnost:</strong> Izboljšana izolacija demo okolja in popravki časovnih pasov.</li>
                            <li><strong>Kopiranje:</strong> Nova funkcija za hitro podvajanje obstoječih dokumentov.</li>
                            <li><strong>E-pošta:</strong> Vzpostavljen dnevnik poslanih sporočil za boljši nadzor nad distribucijo.</li>
                        </ul>
                    </div>

                    <div style="margin-bottom:25px; padding-top:15px; border-top:1px dashed #eee;">
                        <div style="margin-bottom:10px;">
                            <span style="background:#f1f3f5; color:#495057; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">28. 04. 2026</span>
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
                            <li><strong>Nastavitve PDF:</strong> Možnost vklopa/izklopa QR kode in bančnih podatkov na dokumentih.</li>
                            <li><strong>Plačila:</strong> Podpora za vnos delnih plačil na računih.</li>
                        </ul>
                    </div>

                    <div style="margin-bottom:25px; padding-top:15px; border-top:1px dashed #eee;">
                        <div style="margin-bottom:10px;">
                            <span style="background:#f1f3f5; color:#495057; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">24. 04. 2026</span>
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
                            <li><strong>Napreden uvoz:</strong> Interaktivno urejanje postavk PDF računov pred končnim uvozom.</li>
                            <li><strong>Partnerji:</strong> Avtomatsko prepoznavanje in dodajanje novih dobaviteljev iz PDF dokumentov.</li>
                        </ul>
                    </div>

                    <div style="margin-bottom:25px; padding-top:15px; border-top:1px dashed #eee;">
                        <div style="margin-bottom:10px;">
                            <span style="background:#f1f3f5; color:#495057; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">22. 04. 2026</span>
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
                            <li><strong>Tuji računi:</strong> Podpora za GBP in USD s samodejnim preračunom po tečaju BS.</li>
                            <li><strong>Pomoč:</strong> Vzpostavitev prve verzije modula "Navodila in pomoč".</li>
                        </ul>
                    </div>

                    <div style="margin-bottom:25px; padding-top:15px; border-top:1px dashed #eee;">
                        <div style="margin-bottom:10px;">
                            <span style="background:#f1f3f5; color:#495057; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">21. 04. 2026</span>
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
                            <li><strong>Zaposleni:</strong> Avtomatiziran izračun letnega dopusta.</li>
                            <li><strong>Potni nalogi:</strong> Integracija z zemljevidi za izračun razdalj in dnevnic.</li>
                        </ul>
                    </div>

                    <div style="margin-bottom:25px; padding-top:15px; border-top:1px dashed #eee;">
                        <div style="margin-bottom:10px;">
                            <span style="background:#f1f3f5; color:#495057; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">20. 04. 2026</span>
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
                            <li><strong>Demo:</strong> Vzpostavitev javne preizkusne verzije programa.</li>
                            <li><strong>Filtri:</strong> Dodano napredno sortiranje in iskanje po vseh modulih.</li>
                        </ul>
                    </div>

                    <div style="margin-bottom:25px; padding-top:15px; border-top:1px dashed #eee;">
                        <div style="margin-bottom:10px;">
                            <span style="background:#f1f3f5; color:#495057; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">18. 04. 2026</span>
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
                            <li><strong>Poročila:</strong> Implementacija Bruto bilance.</li>
                            <li><strong>FIFO likvidacija:</strong> Pametno zapiranje računov na podlagi bančnih izpiskov.</li>
                        </ul>
                    </div>

                    <div style="padding-top:15px; border-top:1px dashed #eee;">
                        <div style="margin-bottom:10px;">
                            <span style="background:#f1f3f5; color:#495057; padding:4px 10px; border-radius:20px; font-size:0.85rem; font-weight:bold;">17. 04. 2026</span>
                        </div>
                        <ul style="margin-top:5px; padding-left:20px;">
                            <li><strong>Začetek:</strong> Prva stabilna verzija z moduli za račune, partnerje in bančne izpiske.</li>
                        </ul>
                    </div>

            </div>
        </div>
    `;
}


window.knjiziAmortizacijo = async function() {
    const leto = getLeto();
    if (!confirm(`Ali želite knjižiti letno amortizacijo za leto ${leto}?`)) return;
    
    odpriTemeljnicaPopup(async function(tid, naziv) {
        try {
            const res = await fetch(`/api/amortizacija/${leto}/knjizi`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ temeljnica_id: tid, novi_naziv: naziv })
            });
            if (res.ok) {
                alert("Amortizacija uspešno knjižena.");
                renderGlavnaKnjiga();
            } else {
                const err = await res.json();
                alert("Napaka: " + (err.detail || ""));
            }
        } catch(e) { alert("Napaka komunikacije."); }
    });
};

window.knjiziAmortizacijoIzbrana = async function() {
    const leto = getLeto();
    let ids = window.appSelection.ids;
    
    let msg = `Ali zelite knjiziti letno amortizacijo za vsa aktivna osnovna sredstva za leto ${leto}?`;
    if (ids.length > 0) {
        msg = `Ali zelite knjiziti amortizacijo za ${ids.length} izbranih osnovnih sredstev za leto ${leto}?`;
    }
    
    if (!confirm(msg)) return;
    
    odpriTemeljnicaPopup(async function(tid, naziv) {
        try {
            const payload = { temeljnica_id: tid, novi_naziv: naziv };
            if (ids.length > 0) payload.ids = ids;
            
            const res = await fetch(`/api/amortizacija/${leto}/knjizi`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                alert("Amortizacija uspesno knjizena.");
                window.appSelection.ids = [];
                if (activeModule === 'osnovna_sredstva') renderOsnovnaSredstva();
                else renderGlavnaKnjiga();
            } else {
                const err = await res.json();
                alert("Napaka: " + (err.detail || ""));
            }
        } catch(e) { alert("Napaka komunikacije."); }
    });
};

window.razknjiziAmortizacijo = async function() {
    const leto = getLeto();
    if (!confirm(`Ali želite razknjižiti amortizacijo za leto ${leto}?`)) return;
    try {
        const res = await fetch(`/api/amortizacija/${leto}/razknjizi`, { method: 'POST' });
        if (res.ok) {
            alert("Amortizacija razknjižena.");
            renderGlavnaKnjiga();
        } else {
            const err = await res.json();
            alert("Napaka: " + (err.detail || ""));
        }
    } catch(e) { alert("Napaka komunikacije."); }
};

// --- GLAVNA KNJIGA ---
async function renderGlavnaKnjiga() {
    titleEl.textContent = "Glavna knjiga (Temeljnice)";
    contentDiv.innerHTML = '<p>Nalagam...</p>';
    const leto = getLeto();
    
    try {
        const res = await fetch(`/api/temeljnice?leto=${leto}`);
        const data = await res.json();
        
        let html = `
            <div style="margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; background:#f8f9fa; padding:15px; border-radius:8px; border:1px solid #dee2e6;">
                <div style="display: flex; gap: 10px;">
                    <button class="btn btn-blue" onclick="showDodajTemeljnico()">+ Nova ročna temeljnica</button>
                    <button class="btn" style="background:#5c7cfa; color:white;" onclick="knjiziAmortizacijo()">Knjiži amortizacijo za leto ${leto}</button>
                    <button class="btn" style="background:#f08c00; color:white;" onclick="razknjiziAmortizacijo()">Razknjiži amortizacijo</button>
                </div>
            </div>
            <table class="tbl-dash" style="width:100%;">
                <thead>
                    <tr>
                        <th>Številka</th>
                        <th>Vrsta</th>
                        <th>Datum</th>
                        <th>Opis</th>
                        <th style="text-align:right">Promet V Breme</th>
                        <th style="text-align:right">Promet V Dobro</th>
                        <th>Zaklenjeno</th>
                        <th style="text-align:right" width="80">Akcije</th>
                    </tr>
                </thead>
                <tbody>
        `;
        
        if (data.length === 0) {
            html += `<tr><td colspan="8" style="text-align:center">V letu ${leto} ni knjiženih temeljnic.</td></tr>`;
        } else {
            data.forEach(t => {
                const isBalanced = Math.abs((t.promet_breme || 0) - (t.promet_dobro || 0)) < 0.01;
                html += `
                    <tr>
                        <td><span style="color:var(--primary-blue); font-weight:bold; cursor:pointer; text-decoration:underline;" onclick="showTemeljnicaDetajl(${t.id})">${t.stevilka}</span></td>
                        <td><span style="background:#e9ecef; padding:3px 8px; border-radius:10px; font-size:0.8em; font-weight:bold;">${t.vrsta}</span></td>
                        <td>${formatDateJS(t.datum)}</td>
                        <td>${t.opis || ''}</td>
                        <td style="text-align:right; font-weight:bold;">${formatNumberJS(t.promet_breme || 0)}</td>
                        <td style="text-align:right; font-weight:bold; color:${isBalanced ? '#2b8a3e' : '#e03131'};">${formatNumberJS(t.promet_dobro || 0)}</td>
                        <td>${t.zaklenjeno ? '<span style="color:#868e96;" title="Ustvarjeno avtomatsko">🔒 DA</span>' : 'NE'}</td>
                        <td class="action-buttons">
                            <button class="icon-btn btn-red" onclick="brisiTemeljnico(${t.id}, ${t.zaklenjeno})" title="Briši">${ICONS.delete}</button>
                        </td>
                    </tr>
                `;
            });
        }
        
        html += `</tbody></table>`;
        contentDiv.innerHTML = html;
        
    } catch (e) {
        contentDiv.innerHTML = `<p style="color:red">Napaka pri nalaganju glavne knjige.</p>`;
    }
}

async function showTemeljnicaDetajl(id) {
    try {
        const res = await fetch(`/api/temeljnice/detajl/${id}`);
        if (!res.ok) throw new Error("Ni mogoče naložiti temeljnice");
        const t = await res.json();
        
        const title = `Temeljnica: ${t.stevilka}`;
        const vrst = `<span style="font-size:0.7em; color:#868e96; background:#f1f3f5; padding:3px 8px; border-radius:10px; vertical-align:middle; margin-left:10px;">${t.vrsta}</span>`;
        
        let innerHtml = `
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; background:#f8f9fa; padding:15px; border-radius:6px; margin-bottom:20px;">
                    <div><strong>Datum:</strong> ${formatDateJS(t.datum)}</div>
                    <div><strong>Poslovno leto:</strong> ${t.poslovno_leto}</div>
                    <div style="grid-column: span 2;"><strong>Opis:</strong> ${t.opis || '/'}</div>
                </div>
                
                <h4 style="margin-bottom:10px; color:#495057;">Postavke</h4>
                <table class="tbl-dash" style="width:100%;">
                    <thead>
                        <tr>
                            <th>Konto</th>
                            <th>Partner</th>
                            <th>Opis postavke</th>
                            <th style="text-align:right">V Breme</th>
                            <th style="text-align:right">V Dobro</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        let sumB = 0, sumD = 0;
        t.postavke.forEach(p => {
            sumB += p.znesek_v_breme;
            sumD += p.znesek_v_dobro;
            innerHtml += `
                <tr>
                    <td style="font-weight:bold;">${p.konto}</td>
                    <td>${p.partner_naziv || '/'}</td>
                    <td>${p.opis || ''}</td>
                    <td style="text-align:right;">${p.znesek_v_breme > 0 ? formatNumberJS(p.znesek_v_breme) : ''}</td>
                    <td style="text-align:right;">${p.znesek_v_dobro > 0 ? formatNumberJS(p.znesek_v_dobro) : ''}</td>
                </tr>
            `;
        });
        
        const isBalanced = Math.abs(sumB - sumD) < 0.01;
        innerHtml += `
                    </tbody>
                    <tfoot>
                        <tr style="background:#f1f3f5; font-weight:bold;">
                            <td colspan="3" style="text-align:right;">Skupaj:</td>
                            <td style="text-align:right;">${formatNumberJS(sumB)}</td>
                            <td style="text-align:right; color:${isBalanced?'#2b8a3e':'#e03131'};">${formatNumberJS(sumD)}</td>
                        </tr>
                    </tfoot>
                </table>
                <div style="margin-top:20px; text-align:right;">
                    <button class="btn" onclick="window.zapriGlavniPopup()">Zapri</button>
                </div>
        `;
        window.odpriGlavniPopup(title + vrst, innerHtml, "", true);
        
    } catch (e) {
        alert(e.message);
    }
}

async function showDodajTemeljnico() {
    const leto = getLeto();
    const title = 'Nova ročna temeljnica';
    const innerHtml = `
            <form id="frm-temeljnica" onsubmit="shraniTemeljnico(event)">
                <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:15px; margin-bottom:20px;">
                    <div class="form-group">
                        <label>Številka temeljnice *</label>
                        <input type="text" id="t_stevilka" value="ROČ-${leto}-001" required>
                    </div>
                    <div class="form-group">
                        <label>Datum *</label>
                        <input type="date" id="t_datum" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label>Vrsta</label>
                        <input type="text" id="t_vrsta" value="ROC" readonly style="background:#e9ecef;">
                    </div>
                </div>
                <div class="form-group">
                    <label>Opis temeljnice</label>
                    <input type="text" id="t_opis">
                </div>
                
                <h4 style="margin-top:30px; margin-bottom:15px; border-bottom:1px solid #eee; padding-bottom:10px;">Postavke</h4>
                <div id="t-postavke-container"></div>
                <button type="button" class="btn" style="margin-top:10px; background:#f1f3f5; color:#333;" onclick="dodajTemeljnicaPostavko()">+ Dodaj postavko</button>
                
                <div style="margin-top:30px; padding-top:20px; border-top:1px solid #eee; display:flex; justify-content:flex-end; gap:15px;">
                    <button type="button" class="btn" onclick="window.zapriGlavniPopup()" style="background:#eee; color:#333;">Prekliči</button>
                    <button type="submit" class="btn btn-blue">Shrani temeljnico</button>
                </div>
            </form>
    `;
    
    window.odpriGlavniPopup(title, innerHtml, "", true);
    
    // Dodamo prvi dve prazni postavki (V breme in V dobro)
    window._t_postavke = [];
    dodajTemeljnicaPostavko();
    dodajTemeljnicaPostavko();
}

function dodajTemeljnicaPostavko() {
    const idx = window._t_postavke.length;
    window._t_postavke.push({ id: Date.now() + Math.random() });
    osveziTemeljnicaPostavkeUI();
}

function odstraniTemeljnicaPostavko(idx) {
    window._t_postavke.splice(idx, 1);
    osveziTemeljnicaPostavkeUI();
}

function osveziTemeljnicaPostavkeUI() {
    const cont = document.getElementById('t-postavke-container');
    if (!cont) return;
    
    let html = `
        <table class="tbl-dash" style="width:100%; border:1px solid #dee2e6;">
            <thead style="background:#f8f9fa;">
                <tr>
                    <th width="120">Konto</th>
                    <th>Opis (opcijsko)</th>
                    <th width="120">V breme</th>
                    <th width="120">V dobro</th>
                    <th width="40"></th>
                </tr>
            </thead>
            <tbody>
    `;
    
    window._t_postavke.forEach((p, i) => {
        html += `
            <tr>
                <td>
                    <input type="text" list="konti-datalist" id="tp_konto_${i}" class="tp-input" placeholder="000" required style="width:100%; padding:6px;">
                </td>
                <td>
                    <input type="text" id="tp_opis_${i}" class="tp-input" style="width:100%; padding:6px;">
                </td>
                <td>
                    <input type="number" step="0.01" id="tp_breme_${i}" class="tp-input tp-znesek" style="width:100%; padding:6px; text-align:right;" onchange="this.value=(parseFloat(this.value)||0)>0?this.value:''; if(this.value) document.getElementById('tp_dobro_${i}').value=''; izracunajSaldoTemeljnice();">
                </td>
                <td>
                    <input type="number" step="0.01" id="tp_dobro_${i}" class="tp-input tp-znesek" style="width:100%; padding:6px; text-align:right;" onchange="this.value=(parseFloat(this.value)||0)>0?this.value:''; if(this.value) document.getElementById('tp_breme_${i}').value=''; izracunajSaldoTemeljnice();">
                </td>
                <td style="text-align:center;">
                    <button type="button" class="icon-btn btn-red" onclick="odstraniTemeljnicaPostavko(${i})" tabindex="-1">✕</button>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
            <tfoot>
                <tr style="background:#f8f9fa; font-weight:bold;">
                    <td colspan="2" style="text-align:right;">SKUPAJ:</td>
                    <td id="tp_sum_breme" style="text-align:right;">0.00</td>
                    <td id="tp_sum_dobro" style="text-align:right;">0.00</td>
                    <td></td>
                </tr>
                <tr>
                    <td colspan="5" id="tp_saldo_msg" style="text-align:center; padding:10px; font-weight:bold; color:#e03131;">Temeljnica ni usklajena!</td>
                </tr>
            </tfoot>
        </table>
        <style>
            .tp-input { border: 1px solid #ced4da; border-radius: 4px; box-sizing: border-box; }
            .tp-input:focus { border-color: var(--primary-blue); outline: none; }
        </style>
    `;
    
    cont.innerHTML = html;
    izracunajSaldoTemeljnice();
}

function izracunajSaldoTemeljnice() {
    let sB = 0, sD = 0;
    window._t_postavke.forEach((_, i) => {
        const b = parseFloat(document.getElementById(`tp_breme_${i}`)?.value) || 0;
        const d = parseFloat(document.getElementById(`tp_dobro_${i}`)?.value) || 0;
        sB += b;
        sD += d;
    });
    
    const elSumB = document.getElementById('tp_sum_breme');
    const elSumD = document.getElementById('tp_sum_dobro');
    const msg = document.getElementById('tp_saldo_msg');
    
    if (elSumB) elSumB.textContent = sB.toFixed(2);
    if (elSumD) elSumD.textContent = sD.toFixed(2);
    
    if (msg) {
        if (Math.abs(sB - sD) < 0.01 && sB > 0) {
            msg.textContent = "Temeljnica je usklajena ✓";
            msg.style.color = "#2b8a3e";
        } else {
            msg.textContent = "Temeljnica ni usklajena ali je prazna!";
            msg.style.color = "#e03131";
        }
    }
}

async function shraniTemeljnico(e) {
    e.preventDefault();
    
    let sB = 0, sD = 0;
    let postavke = [];
    
    for (let i = 0; i < window._t_postavke.length; i++) {
        const k = document.getElementById(`tp_konto_${i}`).value;
        const op = document.getElementById(`tp_opis_${i}`).value;
        const b = parseFloat(document.getElementById(`tp_breme_${i}`).value) || 0;
        const d = parseFloat(document.getElementById(`tp_dobro_${i}`).value) || 0;
        
        if (k && (b > 0 || d > 0)) {
            postavke.push({ konto: k, opis: op, znesek_v_breme: b, znesek_v_dobro: d });
            sB += b;
            sD += d;
        }
    }
    
    if (postavke.length === 0) {
        alert("Dodajte vsaj eno veljavno postavko!");
        return;
    }
    if (Math.abs(sB - sD) >= 0.01) {
        alert("Zneski v breme in v dobro morajo biti usklajeni (enaki)!");
        return;
    }
    
    const data = {
        poslovno_leto: getLeto(),
        vrsta: document.getElementById('t_vrsta').value,
        stevilka: document.getElementById('t_stevilka').value,
        datum: document.getElementById('t_datum').value,
        opis: document.getElementById('t_opis').value,
        postavke: postavke
    };
    
    try {
        const res = await fetch('/api/temeljnice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (res.ok) {
            window.zapriGlavniPopup();
        } else {
            const err = await res.json();
            alert("Napaka pri shranjevanju: " + err.detail);
        }
    } catch(err) { alert("Napaka komunikacije s strežnikom"); }
}

async function brisiTemeljnico(id, isLocked) {
    if (isLocked) {
        if (!confirm("OPOZORILO: Ta temeljnica je bila avtomatsko ustvarjena. Ce jo izbrisete, boste morda morali ustrezne dokumente (racun, izpisek, amortizacijo) razknjiziti rocno, sicer bodo ti ostali oznaceni kot knjizeni. Zelite vseeno izbrisati temeljnico?")) {
            return;
        }
    } else {
        if (!confirm("Ste prepričani, da želite izbrisati to ročno temeljnico?")) return;
    }
    
    try {
        const res = await fetch(`/api/temeljnice/${id}`, { method: 'DELETE' });
        if (res.ok) {
            renderGlavnaKnjiga();
        } else {
            const err = await res.json();
            alert(err.detail);
        }
    } catch(e) { alert("Napaka komunikacije s strežnikom."); }
}

async function renderFinancnaPorocila() {
    titleEl.textContent = "Finančna poročila";
    const leto = getLeto();
    
    contentDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; background: #f8f9fa; padding: 15px; border-radius: 8px; border: 1px solid #dee2e6;">
            <div style="display: flex; gap: 20px;">
                <button class="btn btn-blue" onclick="loadReport('bilanca_stanja')">Bilanca stanja</button>
                <button class="btn btn-blue" onclick="loadReport('izkaz_poslovnega_izida')">Izkaz poslovnega izida</button>
            </div>
            <div id="report-controls" style="display:none; gap: 10px;">
                <button class="btn" style="background:#6c757d; font-size:0.85em;" onclick="toggleAllReports(true)">Razširi vse</button>
                <button class="btn" style="background:#6c757d; font-size:0.85em;" onclick="toggleAllReports(false)">Skrij vse</button>
            </div>
        </div>
        <div id="report-container">
            <p style="color: #666;">Izberite poročilo zgoraj, da ga naložite za leto ${leto}.</p>
        </div>
    `;
}

window.loadReport = async function(vrsta) {
    const leto = getLeto();
    const container = document.getElementById('report-container');
    container.innerHTML = '<p>Nalagam poročilo...</p>';
    
    const naslov = vrsta === 'bilanca_stanja' ? 'Bilanca stanja' : 'Izkaz poslovnega izida';
    
    try {
        const [reportRes, settingsRes] = await Promise.all([
            fetch(`/api/reports/statement?vrsta=${vrsta}&leto=${leto}`),
            fetch('/api/nastavitve')
        ]);
        
        if (!reportRes.ok) throw new Error("Napaka pri pridobivanju podatkov poročila.");
        const data = await reportRes.json();
        
        let podjetje = "Moje podjetje";
        if (settingsRes.ok) {
            const settings = await settingsRes.json();
            podjetje = settings.naziv || podjetje;
        }
        
        let html = `
            <div style="background: white; padding: 30px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); border-top: 5px solid var(--primary-blue);">
                <div style="margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 15px;">
                    <div style="font-size: 1.2em; font-weight: 700; color: #333;">${podjetje}</div>
                    <div style="color: #666; font-size: 0.9em;">Finančno poročilo</div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                    <h3 style="margin:0; color:var(--primary-blue);">${naslov} za leto ${leto}</h3>
                    <button class="btn btn-blue" onclick="window.print()">Tiskaj / PDF</button>
                </div>
                <table class="tbl-report" style="width:100%; border-collapse:collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid #333;">
                            <th style="text-align:left; padding:8px;">AOP</th>
                            <th style="text-align:left; padding:8px;">Postavka</th>
                            <th style="text-align:right; padding:8px;">Znesek</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        data.forEach((row, idx) => {
            const isHeader = row.naziv.startsWith('A.') || row.naziv.startsWith('B.') || row.naziv.startsWith('C.') || 
                             row.naziv.startsWith('Č.') || row.naziv.startsWith('D.') || row.naziv.startsWith('E.') ||
                             row.naziv.startsWith('F.') || row.naziv.startsWith('G.') || row.naziv.startsWith('H.') ||
                             row.naziv.match(/^[IVX]+\./) || row.naziv === row.naziv.toUpperCase();
            
            const style = isHeader ? 'font-weight:bold; background:#f8f9fa;' : '';
            const indent = (!isHeader && !row.naziv.match(/^[0-9]/)) ? 'padding-left:30px;' : '';
            
            const hasKonti = row.konti && row.konti.length > 0;
            const trClass = hasKonti ? 'expandable-row' : '';
            const clickAttr = hasKonti ? `onclick="toggleReportRow(this, 'breakdown-${idx}')"` : '';
            
            html += `
                <tr class="${trClass}" style="${style} border-bottom: 1px solid #eee;" ${clickAttr}>
                    <td style="padding:8px; width:60px;">${row.aop}</td>
                    <td style="padding:8px; ${indent}">
                        ${hasKonti ? '<span class="row-expand-icon">+</span>' : ''}
                        ${row.naziv}
                    </td>
                    <td style="padding:8px; text-align:right; font-weight:${isHeader?'700':'400'};">${formatMoneyJS(row.vrednost)}</td>
                </tr>
            `;
            
            if (hasKonti) {
                html += `
                    <tr id="breakdown-${idx}" class="breakdown-row">
                        <td colspan="3">
                            <div class="breakdown-container">
                                <table class="breakdown-table">
                                    <thead>
                                        <tr style="background:#f1f3f5;">
                                            <th style="padding:5px 10px; width:100px;">Konto</th>
                                            <th style="padding:5px 10px;">Naziv konta</th>
                                            <th style="padding:5px 10px; text-align:right;">Znesek</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${row.konti.map(k => `
                                            <tr style="cursor:pointer;" onclick="event.stopPropagation(); window.prikaziKontoKartico('${k.konto}')" title="Klikni za podrobnosti po knjižbah">
                                                <td style="color:var(--primary-blue); font-weight:600;">${k.konto}</td>
                                                <td>${k.naziv}</td>
                                                <td style="text-align:right; font-weight:600;">${formatMoneyJS(k.vrednost)}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        </td>
                    </tr>
                `;
            }
        });
        
        html += `
                    </tbody>
                </table>
                <div style="margin-top:30px; font-size:0.8em; color:#999; border-top:1px solid #eee; padding-top:10px;">
                    Generirano: ${new Date().toLocaleString('sl-SI')}
                </div>
            </div>
        `;
        
        container.innerHTML = html;
        document.getElementById('report-controls').style.display = 'flex';
    } catch(e) {
        container.innerHTML = `<p style="color:red;">Napaka: ${e.message}</p>`;
    }
}

window.toggleReportRow = function(el, targetId) {
    const target = document.getElementById(targetId);
    if (!target) return;
    
    const isExpanded = target.classList.contains('active');
    if (isExpanded) {
        target.classList.remove('active');
        el.classList.remove('expanded');
        el.querySelector('.row-expand-icon').textContent = '+';
    } else {
        target.classList.add('active');
        el.classList.add('expanded');
        el.querySelector('.row-expand-icon').textContent = '−';
    }
};

window.toggleAllReports = function(expand) {
    const rows = document.querySelectorAll('.expandable-row');
    rows.forEach(row => {
        const targetId = row.getAttribute('onclick').match(/'([^']+)'/)[1];
        const target = document.getElementById(targetId);
        if (!target) return;
        
        if (expand) {
            target.classList.add('active');
            row.classList.add('expanded');
            row.querySelector('.row-expand-icon').textContent = '−';
        } else {
            target.classList.remove('active');
            row.classList.remove('expanded');
            row.querySelector('.row-expand-icon').textContent = '+';
        }
    });
};

async function renderKontoKartica(initialKonto = '') {
    titleEl.textContent = "Iskanje po kontih (Konto kartica)";
    const leto = getLeto();
    
    contentDiv.innerHTML = `
        <div class="dash-section" style="margin-bottom:20px;">
            <div style="display:flex; gap:15px; align-items:flex-end;">
                <div class="form-group" style="margin:0; flex:1;">
                    <label>Številka konta (ali začetek)</label>
                    <input type="text" id="kk_konto" value="${initialKonto}" list="konti-datalist" placeholder="npr. 485" onkeypress="if(event.key==='Enter') window.searchKontoKartica()">
                </div>
                <div class="form-group" style="margin:0;">
                    <label>Leto</label>
                    <input type="number" id="kk_leto" value="${leto}" style="width:100px;">
                </div>
                <button class="btn btn-blue" onclick="window.searchKontoKartica()">Išči</button>
            </div>
        </div>
        <div id="kk-results">
            <p style="color:#999; text-align:center; padding:40px;">Vnesite številko konta zgoraj za prikaz knjižb.</p>
        </div>
    `;
    
    if (initialKonto) {
        setTimeout(() => window.searchKontoKartica(), 50);
    }
}

window.searchKontoKartica = async function() {
    const kontoEl = document.getElementById('kk_konto');
    if (!kontoEl) return;
    const konto = kontoEl.value.trim();
    const leto = document.getElementById('kk_leto').value;
    const resultsDiv = document.getElementById('kk-results');
    
    if (!konto) {
        alert("Prosim vnesite številko konta.");
        return;
    }
    
    resultsDiv.innerHTML = '<p style="text-align:center; padding:20px;">Iščem...</p>';
    
    try {
        const res = await fetch(`/api/reports/konto_kartica?konto=${konto}&leto=${leto}`);
        if (!res.ok) throw new Error("Napaka pri pridobivanju podatkov.");
        
        const data = await res.json();
        if (data.length === 0) {
            resultsDiv.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">Ni najdenih knjižb za ta konto v izbranem letu.</p>';
            return;
        }
        
        let sumaBreme = 0;
        let sumaDobro = 0;
        
        let html = `
            <div style="background:white; border-radius:8px; box-shadow:0 2px 10px rgba(0,0,0,0.05); overflow:hidden;">
                <table style="width:100%; border-collapse:collapse; font-size:0.9em;">
                    <thead>
                        <tr style="background:#f8f9fa; border-bottom:2px solid #dee2e6;">
                            <th style="padding:10px;">Datum</th>
                            <th style="padding:10px;">Temeljnica</th>
                            <th style="padding:10px;">Konto</th>
                            <th style="padding:10px;">Partner</th>
                            <th style="padding:10px;">Opis knjižbe</th>
                            <th style="padding:10px; text-align:right;">Breme</th>
                            <th style="padding:10px; text-align:right;">Dobro</th>
                            <th style="padding:10px; text-align:center;">Vezava</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        data.forEach(row => {
            sumaBreme += row.znesek_v_breme || 0;
            sumaDobro += row.znesek_v_dobro || 0;
            
            const b = row.znesek_v_breme > 0 ? formatMoneyJS(row.znesek_v_breme) : '';
            const d = row.znesek_v_dobro > 0 ? formatMoneyJS(row.znesek_v_dobro) : '';
            
            let linkHtml = '';
            if (row.dokument_id && row.dokument_tip) {
                linkHtml = `<button class="icon-btn" title="Odpri dokument" onclick="odpriVezaniDokument(${row.dokument_id}, '${row.dokument_tip}')">${ICONS.invoice}</button>`;
            }
            
            html += `
                <tr style="border-bottom:1px solid #eee;">
                    <td style="padding:10px; white-space:nowrap;">${formatDateJS(row.datum)}</td>
                    <td style="padding:10px; color:var(--primary-blue); font-weight:600;">${row.temeljnica_stevilka} (${row.temeljnica_vrsta})</td>
                    <td style="padding:10px; font-weight:500;">${row.konto}</td>
                    <td style="padding:10px;">${row.partner_naziv || '/'}</td>
                    <td style="padding:10px;">${row.opis || ''}</td>
                    <td style="padding:10px; text-align:right; font-weight:600; color:#1971c2;">${b}</td>
                    <td style="padding:10px; text-align:right; font-weight:600; color:#c92a2a;">${d}</td>
                    <td style="padding:10px; text-align:center;">${linkHtml}</td>
                </tr>
            `;
        });
        
        const saldo = sumaBreme - sumaDobro;
        
        html += `
                    </tbody>
                    <tfoot>
                        <tr style="background:#f8f9fa; font-weight:700; border-top:2px solid #dee2e6;">
                            <td colspan="5" style="padding:12px; text-align:right;">SKUPAJ:</td>
                            <td style="padding:12px; text-align:right; color:#1971c2;">${formatMoneyJS(sumaBreme)}</td>
                            <td style="padding:12px; text-align:right; color:#c92a2a;">${formatMoneyJS(sumaDobro)}</td>
                            <td></td>
                        </tr>
                        <tr style="background:#f1f3f5; font-weight:800; font-size:1.1em;">
                            <td colspan="5" style="padding:12px; text-align:right;">SALDO:</td>
                            <td colspan="2" style="padding:12px; text-align:center; color:${saldo >= 0 ? '#1971c2' : '#c92a2a'}">
                                ${formatMoneyJS(Math.abs(saldo))} ${saldo >= 0 ? '(B)' : '(D)'}
                            </td>
                            <td></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;
        
        resultsDiv.innerHTML = html;
        
    } catch(e) {
        resultsDiv.innerHTML = `<p style="color:red; text-align:center; padding:20px;">Napaka: ${e.message}</p>`;
    }
}

window.odpriVezaniDokument = async function(id, tip) {
    if (['izdani_racuni', 'prejeti_racuni', 'prejete_ponudbe', 'ponudbe', 'dobropisi', 'prejeti_dobropisi'].includes(tip)) {
        await editDokument(id, tip);
    } else if (tip === 'place') {
        renderPlace();
    } else if (tip === 'izpiski') {
        renderIzpiski();
    }
};

window.prikaziKontoKartico = function(konto) {
    showModule('konto_kartica');
    renderKontoKartica(konto);
};

// --- POPUP IZBIRNIK ARTIKLOV ---
let _zadnjiPostavkaDiv = null;

window.odpriArtikelPopupZaPostavko = function(postavkaDiv) {
    _zadnjiPostavkaDiv = postavkaDiv;
    document.getElementById('ap_search').value = '';
    document.getElementById('ap_vrsta_filter').value = '';
    document.getElementById('artikel-popup-overlay').style.display = 'flex';
    window.filterArtikelPopup();
};

window.zapriArtikelPopup = function() {
    document.getElementById('artikel-popup-overlay').style.display = 'none';
};

window.filterArtikelPopup = async function() {
    const query = document.getElementById('ap_search').value.toLowerCase();
    const vrsta = document.getElementById('ap_vrsta_filter').value;
    const listDiv = document.getElementById('ap_list');
    
    listDiv.innerHTML = '<p style="text-align:center; padding:20px;">Nalagam...</p>';
    
    try {
        const res = await fetch('/api/artikli_storitve');
        let data = await res.json();
        
        // Lokalno filtriranje
        let filtrirano = data.filter(a => {
            const matchesQuery = a.naziv.toLowerCase().includes(query) || a.sifra.toLowerCase().includes(query);
            const matchesVrsta = !vrsta || a.vrsta === vrsta;
            return matchesQuery && matchesVrsta && a.aktiven;
        });

        if (filtrirano.length === 0) {
            listDiv.innerHTML = '<p style="text-align:center; padding:20px; color:#666;">Ni najdenih artiklov/storitev.</p>';
            return;
        }

        let html = '<table class="table-small"><thead><tr><th>Šifra</th><th>Naziv</th><th style="text-align:right">Zaloga</th><th style="text-align:right">Cena MP</th><th>Akcija</th></tr></thead><tbody>';
        filtrirano.forEach(a => {
            const zText = a.vodi_zalogo ? `<span style="font-weight:bold; color:${a.zaloga_kolicina > 0 ? '#2b8a3e' : '#e03131'}">${formatNumberJS(a.zaloga_kolicina)}</span>` : '-';
            html += `
                <tr>
                    <td><code>${a.sifra}</code></td>
                    <td><div style="font-weight:500;">${a.naziv}</div><div style="font-size:0.8em; color:#888;">${a.opis || ''}</div></td>
                    <td style="text-align:right">${zText}</td>
                    <td style="text-align:right; font-weight:bold; color:var(--primary-blue);">${formatNumberJS(a.cena_malo)} €</td>
                    <td style="text-align:center;">
                        <button class="btn btn-blue" style="padding:4px 10px; font-size:0.85em;" onclick="window.izberiArtikelZaPostavko(${JSON.stringify(a).replace(/"/g, '&quot;')})">Izberi</button>
                    </td>
                </tr>
            `;
        });
        html += '</tbody></table>';
        listDiv.innerHTML = html;
    } catch(e) {
        listDiv.innerHTML = '<p style="color:red">Napaka pri nalaganju.</p>';
    }
};

window.izberiArtikelZaPostavko = function(artikel) {
    if (!_zadnjiPostavkaDiv) return;
    
    const idInp = _zadnjiPostavkaDiv.querySelector('.p-artikel-id');
    const opisInp = _zadnjiPostavkaDiv.querySelector('.p-opis');
    const cenaInp = _zadnjiPostavkaDiv.querySelector('.p-cena');
    const ddvSel = _zadnjiPostavkaDiv.querySelector('.p-ddv');
    const emSel = _zadnjiPostavkaDiv.querySelector('.p-em');

    if (idInp) idInp.value = artikel.id;
    if (opisInp) opisInp.value = artikel.naziv; 
    
    if (cenaInp) cenaInp.value = formatNumberJS(artikel.cena_malo);
    
    if (ddvSel) {
        for (let opt of ddvSel.options) {
            if (parseFloat(opt.value) === artikel.stopnja_ddv) {
                opt.selected = true;
                break;
            }
        }
    }

    if (emSel) {
        for (let opt of emSel.options) {
            if (opt.value.toLowerCase() === artikel.enota_mere.toLowerCase()) {
                opt.selected = true;
                break;
            }
        }
    }

    window.zapriArtikelPopup();
    window.kalkulirajZneske();
};

window.odpriDodajArtikelIzPopupa = function() {
    document.getElementById('artikel-popup-overlay').style.display = 'none';
    renderArtikliForm(null, true); // true = isPopup
};

window.zapriArtikelFormPopup = function() {
    document.getElementById('artikel-form-popup-overlay').style.display = 'none';
};

window.shraniPostavkoKotArtikel = function(row) {
    window._zadnjiPostavkaDiv = row;
    const opis = row.querySelector('.p-opis').value;
    const cena = parseNumberJS(row.querySelector('.p-cena').value);
    const ddv = parseNumberJS(row.querySelector('.p-ddv')?.value || '22');
    const em = row.querySelector('.p-em').value;
    const konto = row.querySelector('.p-konto').value;
    
    const syntheticData = {
        naziv: opis,
        cena_malo: cena,
        stopnja_ddv: ddv,
        enota_mere: em,
        konto: konto,
        vrsta: 'artikel',
        vodi_zalogo: true,
        zacetna_zaloga: 0.0 // Uporabnik želi pustiti na 0 in da se doda iz dokumenta
    };
    
    renderArtikliForm(syntheticData, true); 
};

// --- LOGIKA ZA KOMPENZACIJE IN NAVIGACIJO NAZAJ ---

window.serializeCurrentFormState = function() {
    const tip = window._currentFormContext ? window._currentFormContext.tip : '';
    const naslov = window._currentFormContext ? window._currentFormContext.naslov : '';
    
    const postavke = [];
    document.querySelectorAll('#postavke-container .postavka-item').forEach(tr => {
        postavke.push({
            artikel_id: parseInt(tr.querySelector('.p-artikel-id')?.value) || null,
            opis: tr.querySelector('.p-opis')?.value || "",
            kolicina: parseNumberJS(tr.querySelector('.p-kol')?.value) || 1,
            enota_mere: tr.querySelector('.p-em')?.value || "",
            cena_enote: parseNumberJS(tr.querySelector('.p-cena')?.value) || 0,
            popust: parseNumberJS(tr.querySelector('.p-popust')?.value) || 0,
            stopnja_ddv: parseNumberJS(tr.querySelector('.p-ddv')?.value) || 0,
            znesek_skupaj: parseNumberJS(tr.querySelector('.p-znesek')?.value) || 0,
            konto: tr.querySelector('.p-konto')?.value || ""
        });
    });

    const zakljucna = [];
    document.querySelectorAll('#d_zakljucno_container textarea').forEach(tx => {
        zakljucna.push(tx.value);
    });

    const stateDelnaPlacila = [];
    const listEl = document.getElementById('delna_placila_list');
    if (listEl) {
        listEl.querySelectorAll('.delno-placilo-row').forEach(row => {
            const datum = parseDateISO(row.querySelector('.dp-datum').value);
            const nacin = row.querySelector('.dp-nacin').value;
            const znesek = parseNumberJS(row.querySelector('.dp-znesek').value) || 0;
            const sklic = row.querySelector('.dp-sklic').value.trim();
            const povezan_doc_id = parseInt(row.querySelector('.dp-povezan-doc-id')?.value) || null;
            stateDelnaPlacila.push({ datum, nacin, znesek, sklic, povezan_doc_id });
        });
    }

    return {
        context: { tip, naslov },
        data: {
            id: window._currentEditId,
            stevilka: document.getElementById('d_stevilka')?.value || "",
            interna_stevilka: document.getElementById('d_interna_stevilka')?.value || "",
            partner_id: parseInt(document.getElementById('d_partner')?.value) || null,
            datum_izdaje: parseDateISO(document.getElementById('d_datum_izdaje')?.value || ""),
            datum_zapadlosti: parseDateISO(document.getElementById('d_datum_zapadlosti')?.value || ""),
            datum_storitve_od: parseDateISO(document.getElementById('d_datum_storitve_od')?.value || ""),
            datum_storitve_do: parseDateISO(document.getElementById('d_datum_storitve_do')?.value || ""),
            status: document.getElementById('d_status')?.value || "neplačano",
            datum_placila: parseDateISO(document.getElementById('d_datum_placila')?.value || ""),
            nacin_placila: document.getElementById('d_nacin_placila')?.value || "",
            sklic: document.getElementById('d_sklic')?.value || "",
            noga_dokumenta: document.getElementById('d_noga')?.value || "",
            valuta: document.getElementById('d_valuta')?.value || "EUR",
            tecaj: parseNumberJS(document.getElementById('d_tecaj')?.value || "1"),
            vkljuci_placilo: document.getElementById('d_vkljuci_placilo') ? document.getElementById('d_vkljuci_placilo').checked : true,
            odstotek_placila: document.getElementById('d_odstotek_placila') ? parseFloat(document.getElementById('d_odstotek_placila').value) : 100,
            kompenzacija_doc_id: window._selectedKompenzacijaDocId,
            delno_placano_znesek: parseNumberJS(document.getElementById('d_delno_placano_znesek')?.value || "0"),
            zakljucno_besedilo: zakljucna.join('\n\n'),
            delna_placila: JSON.stringify(stateDelnaPlacila),
            postavke: postavke
        }
    };
};

window.vrniNaPrejsnjiDokument = function() {
    if (!window._dokumentHistoryStack || window._dokumentHistoryStack.length === 0) return;
    const last = window._dokumentHistoryStack.pop();
    window._navigatingHistory = true;
    showDodajDokument(last.context.tip, last.context.naslov, last.data);
};

window.odpriKompenzacijskiDokument = async function(id, tip) {
    const state = window.serializeCurrentFormState();
    if (!window._dokumentHistoryStack) window._dokumentHistoryStack = [];
    window._dokumentHistoryStack.push(state);
    
    window._navigatingHistory = true;
    // Poimenovanje tipov za naslov
    let naslov = tip.replace(/_/g, ' ');
    naslov = naslov.charAt(0).toUpperCase() + naslov.slice(1);
    
    try {
        const res = await fetch(`/api/dokumenti/detajl/${id}`);
        const data = await res.json();
        showDodajDokument(tip, naslov, data);
    } catch(e) {
        alert("Napaka pri odpiranju dokumenta.");
    }
};

window.osveziKompenzacijaUI = async function() {
    const container = document.getElementById('kompenzacija_container');
    if (!container) return;

    if (window._selectedKompenzacijaDocId) {
        container.innerHTML = `<p style="font-size:0.9em; color:#666; margin-bottom:10px;">Nalagam podatke o povezanem dokumentu...</p>`;
        try {
            const res = await fetch(`/api/dokumenti/detajl/${window._selectedKompenzacijaDocId}`);
            if (!res.ok) throw new Error("Dokument ni najden");
            const doc = await res.json();
            
            container.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; background:#fff; border:1px solid #ced4da; padding:10px; border-radius:4px;">
                    <div>
                        <div style="font-weight:600; color:var(--primary-blue);">${doc.stevilka}</div>
                        <div style="font-size:0.85em; color:#666;">${doc.partner_naziv} | ${formatMoneyJS(doc.znesek_skupaj)} €</div>
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button type="button" class="btn btn-blue" style="padding:4px 10px; font-size:0.85em;" onclick="window.odpriKompenzacijskiDokument(${doc.id}, '${doc.tip}')">Odpri ↗</button>
                        <button type="button" class="btn" style="padding:4px 10px; font-size:0.85em; background:#f8d7da; color:#721c24; border:1px solid #f5c6cb;" onclick="window.odstraniKompenzacijaDok()">Odstrani ✕</button>
                    </div>
                </div>
            `;
        } catch(e) {
            container.innerHTML = `<p style="color:red; font-size:0.9em;">Napaka: povezanega dokumenta ni bilo mogoče najti.</p>
                                   <button type="button" class="btn btn-blue" style="margin-top:5px;" onclick="window._selectedKompenzacijaDocId=null; window.osveziKompenzacijaUI();">Išči znova</button>`;
        }
    } else {
        container.innerHTML = `
            <div class="form-group">
                <label>Išči dokument za kompenzacijo (št. ali partner)</label>
                <input type="text" id="kompenzacija_search" placeholder="Vpišite vsaj 3 znake..." oninput="window.iskiKompenzacijaDok(this.value)">
                <div id="kompenzacija_search_results" style="margin-top:5px; border:1px solid #eee; border-radius:4px; max-height:200px; overflow-y:auto; background:#fff; display:none;"></div>
            </div>
        `;
    }
};

window.iskiKompenzacijaDok = async function(query) {
    const resultsDiv = document.getElementById('kompenzacija_search_results');
    if (!resultsDiv) return;
    
    if (query.length < 3) {
        resultsDiv.style.display = 'none';
        return;
    }

    try {
        const tipi = ['izdani_racuni', 'prejeti_racuni', 'dobropisi', 'prejeti_dobropisi'];
        let vsi = [];
        for (const t of tipi) {
            const res = await fetch(`/api/dokumenti/${t}`);
            const data = await res.json();
            vsi = vsi.concat(data);
        }

        const filtrirano = vsi.filter(d => {
            const matchesQuery = d.stevilka.toLowerCase().includes(query.toLowerCase()) || 
                                 (d.partner_naziv && d.partner_naziv.toLowerCase().includes(query.toLowerCase()));
            const notSelf = d.id !== window._currentEditId;
            return matchesQuery && notSelf;
        });

        if (filtrirano.length === 0) {
            resultsDiv.innerHTML = `<div style="padding:10px; color:#999; font-size:0.85em;">Ni rezultatov</div>`;
        } else {
            resultsDiv.innerHTML = filtrirano.map(d => `
                <div style="padding:8px 12px; cursor:pointer; border-bottom:1px solid #f0f0f0; font-size:0.85em;" 
                     onmouseover="this.style.background='#f8f9fa'" onmouseout="this.style.background='white'"
                     onclick="window.izberiKompenzacijaDok(${d.id})">
                    <div style="font-weight:600;">${d.stevilka}</div>
                    <div style="color:#666;">${d.partner_naziv} | ${formatMoneyJS(d.znesek_skupaj)} €</div>
                </div>
            `).join('');
        }
        resultsDiv.style.display = 'block';

    } catch(e) {
        resultsDiv.innerHTML = `<div style="padding:10px; color:red; font-size:0.85em;">Napaka pri iskanju</div>`;
        resultsDiv.style.display = 'block';
    }
};

window.izberiKompenzacijaDok = async function(id) {
    window._selectedKompenzacijaDocId = id;
    window.osveziKompenzacijaUI();
    try {
        const res = await fetch(`/api/dokumenti/detajl/${id}`);
        if (res.ok) {
            const doc = await res.json();
            const datumInp = document.getElementById('d_datum_placila');
            if (datumInp && doc.datum_izdaje) {
                datumInp.value = formatDateJS(doc.datum_izdaje);
            }
        }
    } catch (e) {
        console.error("Napaka pri branju datuma kompenzacije:", e);
    }
};

window.odstraniKompenzacijaDok = function() {
    window._selectedKompenzacijaDocId = null;
    window.osveziKompenzacijaUI();
};

window.osveziStatusPlacilaAuto = function() {
    const dStatusSel = document.getElementById('d_status');
    if (!dStatusSel) return;
    
    // Če je status že 'plačano', ni treba delati nič
    if (dStatusSel.value === 'plačano') return;

    // Pridobimo skupni znesek računa
    const skupajZnesekEl = document.getElementById('skupaj-znesek');
    if (!skupajZnesekEl) return;
    let rawText = skupajZnesekEl.textContent || "";
    let cleanText = rawText;
    if (rawText.includes('Skupaj:')) {
        cleanText = rawText.split('Skupaj:')[1] || rawText;
    }
    if (cleanText.includes('(') && cleanText.includes('EUR)')) {
        const match = cleanText.match(/\(([^)]+)\s*EUR\)/);
        if (match) {
            cleanText = match[1];
        }
    } else {
        cleanText = cleanText.replace(/[a-zA-Z€]/g, '').trim();
    }
    const skupajZnesek = parseNumberJS(cleanText) || 0;
    if (skupajZnesek === 0) return;

    // Pridobimo znesek prvega plačila
    const delnoPlacanoInp = document.getElementById('d_delno_placano_znesek');
    const delnoPlacanoVal = delnoPlacanoInp ? (parseNumberJS(delnoPlacanoInp.value) || 0) : 0;

    // Pridobimo vsoto ostalih delnih plačil
    let delnaSum = 0;
    const listEl = document.getElementById('delna_placila_list');
    if (listEl) {
        listEl.querySelectorAll('.dp-znesek').forEach(inp => {
            delnaSum += parseNumberJS(inp.value) || 0;
        });
    }

    const skupnoPlacano = delnoPlacanoVal + delnaSum;

    // Če je celoten račun pokrit (z toleranco), status spremenimo v Plačano
    if (skupnoPlacano >= skupajZnesek - 0.01) {
        dStatusSel.value = 'plačano';
        // NE skrijemo polj za delno plačilo, če so dejansko vneseni zneski (da uporabnik vidi ločitev plačil)
        const dpBox = document.getElementById('delna_placila_container');
        const delnoPlacanoBox = document.getElementById('d_delno_placano_box');
        if (skupnoPlacano > 0) {
            if (dpBox) dpBox.style.display = 'block';
            if (delnoPlacanoBox) delnoPlacanoBox.style.display = 'block';
        } else {
            if (dpBox) dpBox.style.display = 'none';
            if (delnoPlacanoBox) delnoPlacanoBox.style.display = 'none';
        }
    }
};

window._appLoaded = true;

// =============================================
// UJP B2B POMOŽNE FUNKCIJE
// =============================================

window.posljiNaUjp = async (id, stevilka) => {
    const testMsg = '⚠️ POZOR: Ali ste prepričani, da želite poslati račun ' + stevilka + ' na UJP?\n\n' +
        'Preverite, da je:\n• Digitalno potrdilo pravilno naloženo\n• Testni način izklopljen (za produkcijsko pošiljanje)\n• Partner pravilno določen z davčno številko\n\nNadaljujete?';
    if (!confirm(testMsg)) return;

    // Pokažemo loading stanje
    const btn = event && event.target ? event.target : null;
    if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

    try {
        const res = await fetch(`/api/dokumenti/posji_ujp/${id}`, { method: 'POST' });
        const data = await res.json();
        if (res.ok) {
            alert('✅ ' + (data.message || 'Račun uspešno poslan na UJP!'));
        } else {
            alert('❌ Napaka: ' + (data.detail || 'Neznana napaka'));
        }
    } catch (e) {
        alert('❌ Napaka pri komunikaciji s strežnikom: ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = '🏛️'; }
    }
};

window.naloziUjpCert = async () => {
    const fileInput = document.getElementById('ujp-cert-file');
    if (!fileInput || !fileInput.files[0]) {
        alert('Najprej izberite datoteko (.p12 ali .pfx).');
        return;
    }
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    try {
        const res = await fetch('/api/nastavitve/ujp_cert', { method: 'POST', body: formData });
        const data = await res.json();
        if (res.ok) {
            alert('✅ Potrdilo ' + data.filename + ' je bilo uspešno naloženo!');
            renderNastavitve('ujp');
        } else {
            alert('❌ Napaka: ' + (data.detail || 'Neznana napaka'));
        }
    } catch (e) {
        alert('❌ Napaka: ' + e.message);
    }
};

window.shraniUjpGeslo = async () => {
    const password = document.getElementById('ujp-cert-password')?.value || '';
    const testMode = document.getElementById('ujp-test-mode')?.checked !== false;
    try {
        const res = await fetch('/api/nastavitve/ujp_settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ujp_cert_password: password, ujp_test_mode: testMode })
        });
        const data = await res.json();
        if (res.ok) {
            alert('✅ Nastavitve UJP shranjene.');
        } else {
            alert('❌ Napaka: ' + (data.detail || 'Neznana napaka'));
        }
    } catch (e) {
        alert('❌ Napaka: ' + e.message);
    }
};

window.izbrisiUjpCert = async () => {
    if (!confirm('Ali res želite izbrisati naloženo digitalno potrdilo?')) return;
    try {
        const res = await fetch('/api/nastavitve/ujp_cert', { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            alert('✅ Potrdilo je bilo izbrisano.');
            renderNastavitve('ujp');
        } else {
            alert('❌ Napaka: ' + (data.detail || 'Neznana napaka'));
        }
    } catch (e) {
        alert('❌ Napaka: ' + e.message);
    }
};

