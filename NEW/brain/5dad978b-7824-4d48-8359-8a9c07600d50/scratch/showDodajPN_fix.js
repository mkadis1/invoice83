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
