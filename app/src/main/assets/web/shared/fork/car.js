/*
 * Fork: "My Car" page controller.
 *
 * Talks ONLY to endpoints that already exist in OverDrive (the same ones
 * vehicle-control.js uses), so it needs no backend changes:
 *   GET  /api/vehicle/state        local SDK snapshot (doors, battery, climate, windows…)
 *   GET  /api/vehicle/cloud-status whether cloud / local-key commands are possible
 *   GET  /api/vehicle/cloud-lock   cloud telemetry (soc, range, inside temp) as fallback
 *   GET  /api/bydcloud/status      VIN
 *   GET  /api/models/selected      3D model id + paint colour
 *   POST /api/vehicle/{lock,unlock,flash,find-car,trunk,window,climate}
 *   /status is already polled by core.js; we read BYD.core.lastStatus for GPS + charging.
 *
 * ES2015 only (no async/await, no spread) so the head-unit WebView can open it too.
 */
(function () {
    'use strict';

    var CAR_NAME_DEFAULT = 'BYD Seal 05 DM-i';
    var NAME_KEY = 'od.car.name';          // localStorage override for the hero title
    var STATE_POLL_MS = 10000;
    var CLOUD_POLL_MS = 60000;
    var CLOUD_LOCK_POLL_MS = 30000;
    var REMOTE_CLIMATE_MINUTES = 20;

    var S = {
        stateOk: false, locked: null,
        acOn: false, acTemp: 22, acFan: 3, insideTemp: null, remoteClimate: false,
        soc: null, rangeKm: null, odoKm: null, trunkOpen: null, windows: {},
        cloud: { configured: false, localKey: false }, cloudLock: null,
        gps: null, charging: null, vin: '',
        modelId: 'seal', color: '#9A9EA5', modelName: '', displayName: '',
        armed: {}, climateTimers: {}
    };
    var hero3d = null;

    // ── helpers ──────────────────────────────────────────────────────────
    function $(id) { return document.getElementById(id); }
    function t(key, fallback) {
        var v = (window.BYD && BYD.i18n && BYD.i18n.t) ? BYD.i18n.t(key) : null;
        return (v == null || v === key) ? fallback : v;
    }
    function toast(msg, type) {
        if (!msg) return;
        if (window.BYD && BYD.core && BYD.core.toast) BYD.core.toast(msg, type || 'info', 2600);
    }
    function getJson(url) {
        return fetch(url).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
        });
    }
    function post(url, body) {
        return fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: body ? JSON.stringify(body) : '{}'
        }).then(function (r) { return r.json(); })
          .catch(function (e) { return { success: false, error: e.message }; });
    }
    function dist(km) {
        if (km == null || isNaN(km)) return '--';
        return (window.BYD && BYD.units) ? BYD.units.dist(km) : Math.round(km) + ' km';
    }
    function setText(id, v) { var el = $(id); if (el) el.textContent = v; }
    function setPending(id, on) { var el = $(id); if (el) el.classList.toggle('is-pending', !!on); }
    function resultToast(res, okMsg, failMsg) {
        if (!res) return;
        var msg = res.message || (res.success ? okMsg : (res.error || failMsg));
        toast(msg, res.success ? 'success' : 'error');
    }
    function canCommand() {
        if (S.cloud.configured || S.cloud.localKey) return true;
        var hint = $('carCloudHint');
        if (hint) hint.hidden = false;
        toast(t('car.need_cloud', 'Connect BYD Cloud first to send commands.'), 'error');
        return false;
    }
    function effectiveSoc() {
        if (S.soc != null) return S.soc;
        if (S.cloudLock && typeof S.cloudLock.socPercent === 'number') return S.cloudLock.socPercent;
        return null;
    }
    function effectiveRange() {
        if (S.rangeKm != null) return S.rangeKm;
        if (S.cloudLock && typeof S.cloudLock.rangeKm === 'number') return S.cloudLock.rangeKm;
        return null;
    }
    function isCharging() { return !!(S.charging && S.charging.charging === true); }
    function isPlugged() { return !!(S.charging && (S.charging.plugged === true || S.charging.charging === true)); }

    // ── rendering ────────────────────────────────────────────────────────
    function renderHero() {
        var soc = effectiveSoc();
        setText('carBatt', soc != null ? Math.round(soc) + '%' : '--%');
        setText('carRange', dist(effectiveRange()));
        var fill = $('carBattFill');
        if (fill) {
            fill.style.width = (soc != null ? Math.max(0, Math.min(100, soc)) : 0) + '%';
            fill.className = 'car-batt-fill' + (soc != null && soc <= 10 ? ' critical' : (soc != null && soc <= 20 ? ' low' : ''));
        }
        var state = $('carState');
        if (!state) return;
        var parts = [];
        if (isCharging()) {
            var kw = S.charging.powerKw;
            parts.push(t('car.charging', 'Charging') + (typeof kw === 'number' && kw > 0 ? ' · ' + kw.toFixed(1) + ' kW' : ''));
        } else if (isPlugged()) {
            parts.push(t('car.plugged', 'Plugged in'));
        } else {
            parts.push(t('car.parked', 'Parked'));
        }
        if (S.locked === true) parts.push(t('car.locked', 'Locked'));
        else if (S.locked === false) parts.push(t('car.unlocked', 'Unlocked'));
        if (!S.stateOk && !S.cloudLock) parts = [t('car.offline', 'Car not reachable')];
        state.textContent = parts.join(' · ');
        state.classList.toggle('is-charging', isCharging());
    }

    function renderQuick() {
        var lock = $('qaLock');
        if (lock) {
            var unlocked = S.locked === false;
            lock.classList.toggle('is-on', unlocked);
            var lbl = lock.querySelector('span');
            if (lbl) lbl.textContent = S.locked === true ? t('car.unlock', 'Unlock') : t('car.lock', 'Lock');
            var a = lock.querySelector('.ico-locked'), b = lock.querySelector('.ico-unlocked');
            if (a) a.style.display = unlocked ? 'none' : '';
            if (b) b.style.display = unlocked ? '' : 'none';
        }
        var clim = $('qaClimate'); if (clim) clim.classList.toggle('is-on', !!S.acOn);
        var trunk = $('qaTrunk'); if (trunk) trunk.classList.toggle('is-on', S.trunkOpen === true);
    }

    function renderClimate() {
        var sub = $('climateSub');
        if (sub) {
            var bits = [S.acOn ? t('car.active', 'Active') : t('car.off', 'Off')];
            if (S.insideTemp != null) bits.push(t('car.interior', 'Interior') + ' ' + Math.round(S.insideTemp) + '°');
            sub.textContent = bits.join(' · ');
            sub.classList.toggle('is-on', !!S.acOn);
        }
        setText('climTemp', String(S.acTemp));
        setText('climFan', String(S.acFan));
        var pw = $('climPower');
        if (pw) {
            pw.textContent = S.acOn ? t('car.turn_off', 'Turn off') : t('car.turn_on', 'Turn on');
            pw.classList.toggle('is-primary', !S.acOn);
        }
        var note = $('climRemoteNote');
        if (note) note.hidden = S.stateOk;
    }

    function renderControls() {
        var sub = $('controlsSub');
        if (!sub) return;
        var w = S.windows || {};
        var names = { lf: 'FL', rf: 'FR', lr: 'RL', rr: 'RR' };
        var open = [];
        Object.keys(names).forEach(function (k) { if (typeof w[k] === 'number' && w[k] > 0) open.push(names[k]); });
        var bits = [];
        if (open.length) bits.push(t('car.windows_open', 'Windows open') + ': ' + open.join(' '));
        if (typeof w.sunshade === 'number' && w.sunshade >= 0) {
            bits.push(t('car.sunshade', 'Sunshade') + ' ' + (w.sunshade > 0 ? t('car.open', 'open') : t('car.closed', 'closed')));
        }
        if (S.trunkOpen === true) bits.push(t('car.trunk_open', 'Trunk open'));
        sub.textContent = bits.length ? bits.join(' · ') : t('car.controls_sub', 'Windows · Sunshade · Trunk');
    }

    function renderLocation() {
        var row = $('rowLocation'), sub = $('locationSub');
        if (!row || !sub) return;
        var g = S.gps;
        if (g && g.hasLocation !== false && typeof g.lat === 'number' && typeof g.lng === 'number') {
            row.href = 'https://maps.google.com/?q=' + g.lat.toFixed(6) + ',' + g.lng.toFixed(6);
            var age = (typeof g.ageMs === 'number') ? g.ageMs : (typeof g.fixAgeMs === 'number' ? g.fixAgeMs : null);
            var ageTxt = age == null ? '' : (age < 60000 ? t('car.just_now', 'just now') : Math.round(age / 60000) + ' min');
            sub.textContent = g.lat.toFixed(5) + ', ' + g.lng.toFixed(5)
                + (ageTxt ? ' · ' + ageTxt : '')
                + (g.isStale ? ' · ' + t('car.stale', 'stale') : '');
        } else {
            row.removeAttribute('href');
            sub.textContent = t('car.no_gps', 'No GPS fix yet');
        }
    }

    function renderCharging() {
        var soc = effectiveSoc();
        var bar = $('chargeSoc');
        if (bar) bar.style.width = (soc != null ? Math.max(0, Math.min(100, soc)) : 0) + '%';
        setText('chargeSocTxt', soc != null ? Math.round(soc) + '%' : '--');
        setText('chargeRange', dist(effectiveRange()));
        var st = '--';
        if (S.charging) {
            st = isCharging() ? t('car.charging', 'Charging')
               : (isPlugged() ? t('car.plugged', 'Plugged in') : t('car.not_plugged', 'Not plugged in'));
            if (isCharging() && typeof S.charging.powerKw === 'number' && S.charging.powerKw > 0) st += ' · ' + S.charging.powerKw.toFixed(1) + ' kW';
        }
        setText('chargeState', st);
        setText('chargingSub', soc != null ? Math.round(soc) + '% · ' + st : st);
    }

    function renderFooter() {
        setText('footOdo', S.odoKm != null ? t('car.odometer', 'Odometer') + ' ' + dist(S.odoKm) : '');
        setText('footVin', S.vin ? 'VIN ' + S.vin : '');
        setText('footModel', S.displayName || S.modelName || CAR_NAME_DEFAULT);
    }

    function renderAll() {
        renderHero(); renderQuick(); renderClimate(); renderControls();
        renderLocation(); renderCharging(); renderFooter();
    }

    // ── data ─────────────────────────────────────────────────────────────
    function refreshState() {
        return getJson('/api/vehicle/state').then(function (d) {
            S.stateOk = !!d.success;
            if (!d.success) return;
            if (d.doors) {
                var o = d.doors.overall;
                if (o === 1) S.locked = true; else if (o === 2) S.locked = false;
            }
            if (d.battery) {
                if (typeof d.battery.soc === 'number') S.soc = d.battery.soc;
                var r = (d.battery.rangeKm != null) ? d.battery.rangeKm : d.battery.bodyworkRangeKm;
                if (typeof r === 'number') S.rangeKm = r;
            }
            if (d.climate) {
                var c = d.climate;
                S.remoteClimate = c.remoteClimateActive === true;
                if (typeof c.acOn === 'boolean') S.acOn = c.acOn || S.remoteClimate;
                else if (S.remoteClimate) S.acOn = true;
                if (typeof c.fanLevel === 'number' && c.fanLevel >= 1 && c.fanLevel <= 7 && !S.climateTimers.fan) S.acFan = c.fanLevel;
                if (typeof c.setpointDriver === 'number' && c.setpointDriver >= 17 && c.setpointDriver <= 33 && !S.climateTimers.temp) S.acTemp = c.setpointDriver;
                if (typeof c.insideTempC === 'number' && c.insideTempC > -40 && c.insideTempC < 90) S.insideTemp = c.insideTempC;
            }
            if (d.windows) S.windows = d.windows;
            if (d.trunk && typeof d.trunk.open === 'boolean') S.trunkOpen = d.trunk.open;
            if (d.odometer && typeof d.odometer.totalKm === 'number') S.odoKm = d.odometer.totalKm;
        }).catch(function () { S.stateOk = false; }).then(renderAll);
    }

    function refreshCloud() {
        return getJson('/api/vehicle/cloud-status').then(function (d) {
            S.cloud.configured = !!(d.configured && d.verified);
            S.cloud.localKey = d.localRemoteKey === true;
            var hint = $('carCloudHint');
            if (hint) hint.hidden = S.cloud.configured || S.cloud.localKey;
        }).catch(function () {});
    }

    function refreshCloudLock() {
        return getJson('/api/vehicle/cloud-lock').then(function (d) {
            if (d && d.success && d.status) {
                S.cloudLock = d.status;
                if (S.insideTemp == null && typeof d.status.insideTempC === 'number') S.insideTemp = d.status.insideTempC;
            }
        }).catch(function () {}).then(renderAll);
    }

    function refreshVin() {
        return getJson('/api/bydcloud/status').then(function (d) {
            if (d && d.status) S.vin = d.status.vin || '';
            renderFooter();
        }).catch(function () {});
    }

    // core.js polls /status for the sidebar; piggyback on its last snapshot.
    function pickStatus() {
        var st = (window.BYD && BYD.core) ? BYD.core.lastStatus : null;
        if (!st) return;
        if (st.gps) S.gps = st.gps;
        if (st.charging) S.charging = st.charging;
        if (S.soc == null && st.soc && typeof st.soc.percent === 'number') S.soc = st.soc.percent;
        if (S.rangeKm == null && st.range && typeof st.range.elecRangeKm === 'number') S.rangeKm = st.range.elecRangeKm;
        renderHero(); renderLocation(); renderCharging();
    }

    // ── 3D hero ──────────────────────────────────────────────────────────
    function initHero3d() {
        var canvas = $('carHeroCanvas');
        if (!canvas || hero3d || typeof window.OverdriveEvCard3D !== 'function') return;
        try {
            hero3d = new window.OverdriveEvCard3D(canvas, { view: 'three-quarter' });
            hero3d.setModel(S.modelId);
            hero3d.setColor(S.color);
        } catch (e) {
            if (window.console) console.warn('[car] 3D hero init failed:', e);
        }
    }

    function loadModel() {
        return getJson('/api/models/selected').then(function (d) {
            if (d && d.modelId) S.modelId = d.modelId;
            if (d && d.color) S.color = d.color;
        }).catch(function () {}).then(function () {
            return fetch('../shared/models/manifest.json').then(function (r) { return r.json(); }).catch(function () { return null; });
        }).then(function (m) {
            if (m && m.models) {
                for (var i = 0; i < m.models.length; i++) {
                    if (m.models[i].id === S.modelId) { S.modelName = m.models[i].name; break; }
                }
            }
            var custom = null;
            try { custom = localStorage.getItem(NAME_KEY); } catch (e) {}
            var isOurCar = S.modelId === 'seal';
            S.displayName = custom || (isOurCar ? CAR_NAME_DEFAULT : (S.modelName || CAR_NAME_DEFAULT));
            setText('carName', S.displayName);
            if (hero3d) { hero3d.setModel(S.modelId); hero3d.setColor(S.color); } else initHero3d();
            renderFooter();
        });
    }

    // ── actions ──────────────────────────────────────────────────────────
    function bind(id, fn) { var el = $(id); if (el) el.addEventListener('click', fn); }

    // Two-tap confirmation for actions that physically open the car.
    function armed(id, label) {
        var el = $(id);
        if (!el) return false;
        if (S.armed[id]) {
            clearTimeout(S.armed[id]); S.armed[id] = null;
            el.classList.remove('is-armed');
            return true;
        }
        el.classList.add('is-armed');
        toast(label, 'info');
        S.armed[id] = setTimeout(function () { S.armed[id] = null; el.classList.remove('is-armed'); }, 3000);
        return false;
    }

    function doLock() {
        if (!canCommand()) return;
        var unlock = S.locked === true;
        setPending('qaLock', true);
        post(unlock ? '/api/vehicle/unlock' : '/api/vehicle/lock').then(function (r) {
            setPending('qaLock', false);
            if (r.success) S.locked = !unlock;
            renderQuick(); renderHero();
            resultToast(r, unlock ? t('car.unlocked_toast', 'Car unlocked') : t('car.locked_toast', 'Car locked'), t('car.cmd_failed', 'Command failed'));
            setTimeout(refreshState, 2500);
        });
    }

    function climatePower(on, btnId) {
        if (!canCommand()) return;
        setPending(btnId, true);
        var req = on
            ? { action: 'power_on', temp: S.acTemp, remoteDurationMinutes: REMOTE_CLIMATE_MINUTES }
            : { action: 'power_off' };
        post('/api/vehicle/climate', req).then(function (r) {
            setPending(btnId, false);
            if (r.success) S.acOn = on;
            renderQuick(); renderClimate();
            resultToast(r, on ? t('car.climate_on', 'Climate on') : t('car.climate_off', 'Climate off'), t('car.cmd_failed', 'Command failed'));
            setTimeout(refreshState, 4000);
        });
    }

    // Steppers update the UI at once and send the latest value after a short pause.
    function scheduleClimate(field, value, req, revertTo) {
        if (S.climateTimers[field]) clearTimeout(S.climateTimers[field]);
        S.climateTimers[field] = setTimeout(function () {
            S.climateTimers[field] = null;
            post('/api/vehicle/climate', req).then(function (r) {
                if (!r.success) {
                    if (field === 'temp') S.acTemp = revertTo; else S.acFan = revertTo;
                    renderClimate();
                    resultToast(r, null, t('car.cmd_failed', 'Command failed'));
                }
            });
        }, 400);
    }
    function setTemp(v) {
        v = Math.max(17, Math.min(33, v));
        if (v === S.acTemp) return;
        var prev = S.acTemp; S.acTemp = v; renderClimate();
        scheduleClimate('temp', v, { action: 'set_temp', zone: 1, temp: v }, prev);
    }
    function setFan(v) {
        v = Math.max(1, Math.min(7, v));
        if (v === S.acFan) return;
        var prev = S.acFan; S.acFan = v; renderClimate();
        scheduleClimate('fan', v, { action: 'set_fan', fan: v }, prev);
    }

    function trunk(action, btnId) {
        setPending(btnId, true);
        post('/api/vehicle/trunk', { action: action }).then(function (r) {
            setPending(btnId, false);
            if (r.success) S.trunkOpen = action === 'open';
            renderQuick(); renderControls();
            resultToast(r, action === 'open' ? t('car.trunk_opening', 'Trunk opening') : t('car.trunk_closing', 'Trunk closing'), t('car.cmd_failed', 'Command failed'));
            setTimeout(refreshState, 4000);
        });
    }

    function windowArea(area, pct, btnId, okMsg) {
        setPending(btnId, true);
        post('/api/vehicle/window', { area: area, targetPercent: pct }).then(function (r) {
            setPending(btnId, false);
            resultToast(r, okMsg, t('car.cmd_failed', 'Command failed'));
            setTimeout(refreshState, 4000);
        });
    }

    function windowsAll(pct, btnId, okMsg) {
        setPending(btnId, true);
        var failed = null, chain = Promise.resolve();
        [1, 2, 3, 4].forEach(function (a) {
            chain = chain.then(function () {
                return post('/api/vehicle/window', { area: a, targetPercent: pct }).then(function (r) {
                    if (!r.success && !failed) failed = r;
                });
            });
        });
        chain.then(function () {
            setPending(btnId, false);
            resultToast(failed || { success: true }, okMsg, t('car.cmd_failed', 'Command failed'));
            setTimeout(refreshState, 4000);
        });
    }

    function bindActions() {
        bind('qaLock', doLock);
        bind('qaClimate', function () { climatePower(!S.acOn, 'qaClimate'); });
        bind('climPower', function () { climatePower(!S.acOn, 'climPower'); });
        bind('qaFlash', function () {
            if (!canCommand()) return;
            setPending('qaFlash', true);
            post('/api/vehicle/flash').then(function (r) {
                setPending('qaFlash', false);
                resultToast(r, t('car.flashed', 'Lights flashed'), t('car.cmd_failed', 'Command failed'));
            });
        });
        bind('qaFind', function () {
            if (!canCommand()) return;
            setPending('qaFind', true);
            post('/api/vehicle/find-car').then(function (r) {
                setPending('qaFind', false);
                resultToast(r, t('car.find_sent', 'Find-car signal sent'), t('car.cmd_failed', 'Command failed'));
            });
        });
        bind('qaTrunk', function () {
            if (S.trunkOpen === true) { trunk('close', 'qaTrunk'); return; }
            if (!armed('qaTrunk', t('car.tap_again_trunk', 'Tap again to open the trunk'))) return;
            trunk('open', 'qaTrunk');
        });
        bind('ctlTrunkOpen', function () { trunk('open', 'ctlTrunkOpen'); });
        bind('ctlTrunkClose', function () { trunk('close', 'ctlTrunkClose'); });
        bind('ctlWinClose', function () { windowsAll(0, 'ctlWinClose', t('car.windows_closing', 'Windows closing')); });
        bind('ctlWinVent', function () {
            setPending('ctlWinVent', true);
            post('/api/vehicle/window', { action: 'vent' }).then(function (r) {
                setPending('ctlWinVent', false);
                resultToast(r, t('car.windows_vented', 'Windows vented'), t('car.cmd_failed', 'Command failed'));
                setTimeout(refreshState, 4000);
            });
        });
        bind('ctlShadeOpen',  function () { windowArea(6, 100, 'ctlShadeOpen',  t('car.sunshade_opening', 'Sunshade opening')); });
        bind('ctlShadeClose', function () { windowArea(6, 0,   'ctlShadeClose', t('car.sunshade_closing', 'Sunshade closing')); });
        bind('ctlRoofOpen',   function () { windowArea(5, 100, 'ctlRoofOpen',   t('car.sunroof_opening', 'Sunroof opening')); });
        bind('ctlRoofClose',  function () { windowArea(5, 0,   'ctlRoofClose',  t('car.sunroof_closing', 'Sunroof closing')); });
        bind('climTempDown', function () { setTemp(S.acTemp - 1); });
        bind('climTempUp',   function () { setTemp(S.acTemp + 1); });
        bind('climFanDown',  function () { setFan(S.acFan - 1); });
        bind('climFanUp',    function () { setFan(S.acFan + 1); });

        var rows = document.querySelectorAll('.car-row[data-panel]');
        Array.prototype.forEach.call(rows, function (row) {
            row.addEventListener('click', function () {
                var panel = $(row.getAttribute('data-panel'));
                if (!panel) return;
                var open = !panel.classList.contains('is-open');
                panel.classList.toggle('is-open', open);
                row.setAttribute('aria-expanded', open ? 'true' : 'false');
            });
        });
    }

    // ── boot ─────────────────────────────────────────────────────────────
    window.toggleSidebar = function () {
        var sb = $('sidebar'), ov = $('sidebarOverlay');
        if (sb) sb.classList.toggle('open');
        if (ov) ov.classList.toggle('show');
    };

    function boot() {
        bindActions();
        loadModel();
        refreshCloud();
        refreshState();
        refreshCloudLock();
        refreshVin();
        pickStatus();
        setTimeout(pickStatus, 1500);   // core.js' first /status poll lands shortly after boot
        setInterval(refreshState, STATE_POLL_MS);
        setInterval(refreshCloud, CLOUD_POLL_MS);
        setInterval(refreshCloudLock, CLOUD_LOCK_POLL_MS);
        setInterval(pickStatus, 5000);
        document.addEventListener('visibilitychange', function () {
            if (!document.hidden) { refreshState(); pickStatus(); }
        });
    }

    document.addEventListener('DOMContentLoaded', function () {
        if (window.BYD && BYD.i18n && BYD.core && BYD.i18n.init) {
            BYD.i18n.init().then(function () { BYD.core.init(); boot(); }, function () { boot(); });
        } else {
            boot();
        }
    });
})();
