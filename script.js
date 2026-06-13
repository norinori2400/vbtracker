

    function openModal(id) {
        var modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        updateUI();
    }

    function closeModal(id) {
        var modal = document.getElementById(id);
        if (!modal) return;
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }

    function closeModalOnBackdrop(event, id) {
        if (event.target && event.target.id === id) closeModal(id);
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            var modals = document.getElementsByClassName('modal-overlay');
            for (var i = 0; i < modals.length; i++) modals[i].classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    var MAX_PLAYERS = 50;
    var DEFAULT_VISIBLE_PLAYERS = 20;

    var players = [];
    for (var i = 1; i <= MAX_PLAYERS; i++) { players.push('p' + i); }
    players.push('us_team');
    players.push('team');

    var playerNames = {};
    for (var i = 1; i <= MAX_PLAYERS; i++) { playerNames['p' + i] = '選手 No.' + i; }
    playerNames['us_team'] = '自チーム(全体)';
    playerNames['team'] = '相手チーム(全体)';

    // 内部ID(p1〜p50)は固定し、氏名と背番号は別管理にします。
    // これにより、背番号や氏名表記を変更してもスタッツは同じ選手IDに紐づきます。
    var playerNumbers = {};
    for (var i = 1; i <= MAX_PLAYERS; i++) { playerNumbers['p' + i] = String(i); }

    // 試合で使用する選手だけを入力対象・S-Lineup・通常交代候補に表示します。
    // 既存データ移行のため、初期状態ではp1〜p20を表示ON、p21〜p50を表示OFFにします。
    var playerVisible = {};
    for (var i = 1; i <= MAX_PLAYERS; i++) { playerVisible['p' + i] = i <= DEFAULT_VISIBLE_PLAYERS; }

    function normalizePlayerNumbers(map) {
        var normalized = {};
        for (var i = 1; i <= MAX_PLAYERS; i++) {
            var id = 'p' + i;
            normalized[id] = map && map[id] !== undefined && map[id] !== null && String(map[id]).trim() !== '' ? String(map[id]).trim() : String(i);
        }
        return normalized;
    }

    function normalizePlayerNames(map) {
        var normalized = {};
        for (var i = 1; i <= MAX_PLAYERS; i++) {
            var id = 'p' + i;
            normalized[id] = map && map[id] !== undefined && map[id] !== null && String(map[id]).trim() !== '' ? String(map[id]).trim() : '選手 No.' + i;
        }
        normalized.us_team = (map && map.us_team) ? map.us_team : '自チーム(全体)';
        normalized.team = (map && map.team) ? map.team : '相手チーム(全体)';
        return normalized;
    }

    function normalizePlayerVisible(map) {
        var normalized = {};
        for (var i = 1; i <= MAX_PLAYERS; i++) {
            var id = 'p' + i;
            normalized[id] = map && map[id] !== undefined ? !!map[id] : (i <= DEFAULT_VISIBLE_PLAYERS);
        }
        return normalized;
    }

    function isPlayerVisible(id) {
        if (id === 'us_team' || id === 'team') return true;
        return !!playerVisible[id];
    }

    function visibleOwnPlayerIds() {
        var arr = [];
        for (var i = 1; i <= MAX_PLAYERS; i++) {
            var id = 'p' + i;
            if (isPlayerVisible(id)) arr.push(id);
        }
        return arr;
    }

    function getPlayerNumber(id, numberMap) {
        if (id === 'team' || id === 'us_team') return '';
        var map = numberMap || playerNumbers || {};
        var fallback = String(id || '').replace('p','');
        return map[id] !== undefined && map[id] !== null && String(map[id]).trim() !== '' ? String(map[id]).trim() : fallback;
    }

    function getPlayerNameOnly(id, nameMap) {
        var map = nameMap || playerNames || {};
        if (id === 'team') return map[id] || playerNames[id] || '相手チーム(全体)';
        if (id === 'us_team') return map[id] || playerNames[id] || '自チーム(全体)';
        return map[id] || playerNames[id] || ('選手 No.' + String(id || '').replace('p',''));
    }

    function getPlayerDisplayName(id, nameMap, numberMap) {
        if (id === 'team' || id === 'us_team') return getPlayerNameOnly(id, nameMap);
        return getPlayerNumber(id, numberMap) + ' ' + getPlayerNameOnly(id, nameMap);
    }

    function updatePlayerButtonLabel(id) {
        var btn = document.getElementById('btn-' + id);
        if (!btn) return;
        btn.innerText = (id === 'team' || id === 'us_team') ? playerNames[id] : getPlayerDisplayName(id);
    }

    var appTitlePrefix = 'SEIMEI HS';
    var selfTeamName = '清明';
    var oppTeamName = '相手';
    var selectedPlayer = 'p1';
    var matchType = 'practice';
    var officialMatchNumber = 1;
    var matchDateKey = '';
    var currentSet = 1;
    var historyLog = []; 
    var timeoutCount = { us: 0, them: 0 };
    var subCount = { us: 0, them: 0 };
    var setResults = [];
    var globalArchive = []; 
    var autoBackups = []; 

    var startingLineup = { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' };
    var startSideSetting = 'S'; 
    var hasServeAuthority = true; 

    function createEmptyStats() {
        var obj = {};
        for (var k = 0; k < players.length; k++) {
            obj[players[k]] = {
                attack_kill: 0, attack_error: 0, block_kill: 0, block_error: 0,
                serve_ace: 0, serve_error: 0, reception_error: 0, dig_error: 0, toss_error: 0, miscommunication_error: 0, other_error: 0,
                v_dribble: 0, v_net: 0, v_over: 0, v_passing: 0, v_positional: 0, v_hold: 0, v_backrow: 0
            };
        }
        return obj;
    }



    function ensureStatsDataShape(data) {
        var template = createEmptyStats();
        data = data || {};
        for (var pid in template) {
            if (!data[pid]) data[pid] = {};
            for (var key in template[pid]) {
                if (data[pid][key] === undefined || data[pid][key] === null || isNaN(Number(data[pid][key]))) data[pid][key] = 0;
            }
        }
        return data;
    }

    function ensureStatsData(data) {
        var base = createEmptyStats();
        data = data || {};
        for (var p in data) {
            if (!base[p]) base[p] = data[p];
            else {
                for (var k in data[p]) base[p][k] = data[p][k] || 0;
            }
        }
        return base;
    }

    function hasAnyStatsForPlayer(id, statsData) {
        var d = statsData && statsData[id];
        if (!d) return false;
        for (var k in d) {
            if ((d[k] || 0) !== 0) return true;
        }
        return false;
    }

    function getStatsDisplayIds(statsData) {
        var ids = [];
        for (var i = 1; i <= MAX_PLAYERS; i++) {
            var id = 'p' + i;
            if (isPlayerVisible(id) || hasAnyStatsForPlayer(id, statsData)) ids.push(id);
        }
        ids.push('us_team');
        ids.push('team');
        return ids;
    }

    var setData = createEmptyStats();
    var todayData = createEmptyStats();
    var allData = createEmptyStats();
    var currentView = 'set';

    function loadStorage() {
        if (localStorage.getItem('vball_currentSet_s')) {
            currentSet = parseInt(localStorage.getItem('vball_currentSet_s'));
            historyLog = JSON.parse(localStorage.getItem('vball_historyLog_s'));
            timeoutCount = JSON.parse(localStorage.getItem('vball_timeoutCount_s'));
            subCount = JSON.parse(localStorage.getItem('vball_subCount_s')) || { us: 0, them: 0 };
            setResults = JSON.parse(localStorage.getItem('vball_setResults_s')) || [];
            playerNames = normalizePlayerNames(JSON.parse(localStorage.getItem('vball_playerNames_s') || 'null'));
            playerNumbers = normalizePlayerNumbers(JSON.parse(localStorage.getItem('vball_playerNumbers_s') || 'null'));
            playerVisible = normalizePlayerVisible(JSON.parse(localStorage.getItem('vball_playerVisible_s') || 'null'));
            setData = JSON.parse(localStorage.getItem('vball_setData_s'));
            todayData = JSON.parse(localStorage.getItem('vball_todayData_s'));
            allData = JSON.parse(localStorage.getItem('vball_allData_s'));
            selectedPlayer = localStorage.getItem('vball_selectedPlayer_s') || 'p1';
            startingLineup = JSON.parse(localStorage.getItem('vball_startingLineup_s')) || { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' };
            startSideSetting = localStorage.getItem('vball_startSideSetting_s') || 'S';
            hasServeAuthority = localStorage.getItem('vball_hasServeAuthority_s') !== 'false';
            oppTeamName = localStorage.getItem('vball_oppTeamName_s') || '相手';
            appTitlePrefix = localStorage.getItem('vball_appTitlePrefix_s') || appTitlePrefix;
            selfTeamName = localStorage.getItem('vball_selfTeamName_s') || selfTeamName;
            matchType = localStorage.getItem('vball_matchType_s') || matchType;
            officialMatchNumber = parseInt(localStorage.getItem('vball_officialMatchNumber_s') || officialMatchNumber, 10) || 1;
            matchDateKey = localStorage.getItem('vball_matchDateKey_s') || matchDateKey;
        }
        playerNames = normalizePlayerNames(playerNames);
        playerNumbers = normalizePlayerNumbers(playerNumbers);
        playerVisible = normalizePlayerVisible(playerVisible);
        setData = ensureStatsData(setData);
        todayData = ensureStatsData(todayData);
        allData = ensureStatsData(allData);
        if (!playerNames.us_team) playerNames.us_team = '自チーム(全体)';
        setData = ensureStatsDataShape(setData);
        todayData = ensureStatsDataShape(todayData);
        allData = ensureStatsDataShape(allData);
        globalArchive = JSON.parse(localStorage.getItem('vball_globalArchive_s')) || [];
        autoBackups = JSON.parse(localStorage.getItem('vball_autoBackups_s')) || [];
        normalizeMatchManagementOnLoad();
    }

    function saveStorage() {
        localStorage.setItem('vball_currentSet_s', currentSet);
        localStorage.setItem('vball_historyLog_s', JSON.stringify(historyLog));
        localStorage.setItem('vball_timeoutCount_s', JSON.stringify(timeoutCount));
        localStorage.setItem('vball_subCount_s', JSON.stringify(subCount));
        localStorage.setItem('vball_setResults_s', JSON.stringify(setResults));
        localStorage.setItem('vball_playerNames_s', JSON.stringify(playerNames));
        localStorage.setItem('vball_playerNumbers_s', JSON.stringify(playerNumbers));
        localStorage.setItem('vball_playerVisible_s', JSON.stringify(playerVisible));
        localStorage.setItem('vball_setData_s', JSON.stringify(setData));
        localStorage.setItem('vball_todayData_s', JSON.stringify(todayData));
        localStorage.setItem('vball_allData_s', JSON.stringify(allData));
        localStorage.setItem('vball_selectedPlayer_s', selectedPlayer);
        localStorage.setItem('vball_startingLineup_s', JSON.stringify(startingLineup));
        localStorage.setItem('vball_startSideSetting_s', startSideSetting);
        localStorage.setItem('vball_hasServeAuthority_s', hasServeAuthority);
        localStorage.setItem('vball_oppTeamName_s', oppTeamName);
        localStorage.setItem('vball_appTitlePrefix_s', appTitlePrefix);
        localStorage.setItem('vball_selfTeamName_s', selfTeamName);
        localStorage.setItem('vball_matchType_s', matchType);
        localStorage.setItem('vball_officialMatchNumber_s', officialMatchNumber);
        localStorage.setItem('vball_matchDateKey_s', matchDateKey);
        localStorage.setItem('vball_globalArchive_s', JSON.stringify(globalArchive));
        localStorage.setItem('vball_autoBackups_s', JSON.stringify(autoBackups));
        updateAutoBackupUI();
    }

    function getTodayKey() {
        var now = new Date();
        return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
    }

    function getMatchLabel() {
        if (matchType === 'official') return '公式戦 第' + officialMatchNumber + '試合';
        return '練習試合';
    }

    function normalizeMatchManagementOnLoad() {
        if (matchType !== 'official' && matchType !== 'practice') matchType = 'practice';
        officialMatchNumber = parseInt(officialMatchNumber || 1, 10) || 1;
        var today = getTodayKey();
        if (!matchDateKey) matchDateKey = today;
        if (matchType === 'practice' && matchDateKey !== today) {
            // 練習試合は日付が変わったら第1セットから開始する。
            currentSet = 1;
            setData = createEmptyStats();
            historyLog = [];
            timeoutCount = { us: 0, them: 0 };
            subCount = { us: 0, them: 0 };
            startSideSetting = 'S';
            hasServeAuthority = true;
            matchDateKey = today;
        }
    }

    function resetCurrentSetForMatchChange() {
        currentSet = 1;
        setData = createEmptyStats();
        historyLog = [];
        timeoutCount = { us: 0, them: 0 };
        subCount = { us: 0, them: 0 };
        startSideSetting = 'S';
        hasServeAuthority = true;
        closeLineupPlayerPicker();
        updateSideToggleUI();
    }

    function setMatchTypeUI(type) {
        var officialBtn = document.getElementById('match-type-official-btn');
        var practiceBtn = document.getElementById('match-type-practice-btn');
        var officialBox = document.getElementById('official-match-settings');
        var practiceBox = document.getElementById('practice-match-settings');
        if (officialBtn) officialBtn.classList.toggle('active', type === 'official');
        if (practiceBtn) practiceBtn.classList.toggle('active', type === 'practice');
        if (officialBox) officialBox.style.display = type === 'official' ? 'block' : 'none';
        if (practiceBox) practiceBox.style.display = type === 'practice' ? 'block' : 'none';
        var summary = document.getElementById('match-management-summary');
        var input = document.getElementById('official-match-number-input');
        var nextNo = input ? (parseInt(input.value || officialMatchNumber, 10) || 1) : officialMatchNumber;
        if (summary) {
            summary.innerHTML = type === 'official'
                ? '設定予定：公式戦 第' + nextNo + '試合<br>適用後の表示：第1セットから管理'
                : '設定予定：練習試合<br>同日内はセット数を積み上げ、日付変更時は第1セットへ戻します。';
        }
    }

    function updateMatchManagementUI() {
        var input = document.getElementById('official-match-number-input');
        if (input) input.value = officialMatchNumber;
        var practiceSummary = document.getElementById('practice-date-summary');
        if (practiceSummary) practiceSummary.innerText = '管理日付：' + (matchDateKey || getTodayKey()) + ' / 今日：' + getTodayKey();
        setMatchTypeUI(matchType);
        var contextEl = document.getElementById('match-context-display');
        if (contextEl) contextEl.innerText = getMatchLabel();
    }

    function applyMatchSettings() {
        var selectedType = document.getElementById('match-type-official-btn') && document.getElementById('match-type-official-btn').classList.contains('active') ? 'official' : 'practice';
        var input = document.getElementById('official-match-number-input');
        var nextNumber = input ? (parseInt(input.value || '1', 10) || 1) : officialMatchNumber;
        if (nextNumber < 1) nextNumber = 1;
        var shouldReset = false;
        if (selectedType !== matchType) shouldReset = true;
        if (selectedType === 'official' && nextNumber !== officialMatchNumber) shouldReset = true;
        var msg = selectedType === 'official'
            ? '公式戦 第' + nextNumber + '試合に設定します。セット数は第1セットに戻ります。よろしいですか？'
            : '練習試合に設定します。日付管理により、同日内はセット数を積み上げます。よろしいですか？';
        if (shouldReset && !confirm(msg)) return;
        matchType = selectedType;
        officialMatchNumber = nextNumber;
        if (matchType === 'practice') matchDateKey = getTodayKey();
        if (shouldReset) resetCurrentSetForMatchChange();
        saveStorage();
        updateMatchManagementUI();
        updateUI();
        alert('試合管理を更新しました。');
    }

    function initSetup() {
        loadStorage(); 
        updateBaseDataUI();
        document.getElementById('opp-team-name-input').value = oppTeamName;
        updateOppLabels();
        updateSideToggleUI();
        updateMatchManagementUI();

        var btnContainer = document.getElementById('player-btn-container');
        var editContainer = document.getElementById('edit-inputs-container');
        btnContainer.innerHTML = ''; editContainer.innerHTML = '';

        for (var m = 0; m < players.length; m++) {
            (function(p) {
                var isOpp = (p === 'team');
                var isOwnTeam = (p === 'us_team');
                if (isOpp || isOwnTeam || isPlayerVisible(p)) {
                    var btn = document.createElement('button');
                    btn.className = 'p-btn' + (isOpp ? ' opp-team-btn' : '') + (isOwnTeam ? ' own-team-btn' : '') + (p === selectedPlayer ? ' active' : '');
                    btn.id = 'btn-' + p; btn.innerText = (isOpp || isOwnTeam) ? playerNames[p] : getPlayerDisplayName(p);
                    btn.onclick = function() { selectPlayer(p); };
                    btnContainer.appendChild(btn);
                }

                if (!isOpp && !isOwnTeam) {
                    var div = document.createElement('div');
                    div.className = 'edit-input player-data-row';
                    div.style.flexDirection = 'column';
                    div.style.alignItems = 'stretch';
                    div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
                                    '<div style="font-size:0.78rem;color:#94a3b8;font-weight:bold;">登録' + p.replace('p','') + '（内部ID：' + p + '）</div>' +
                                    '<label title="入力対象に表示" style="font-size:0.78rem;color:#e5e7eb;font-weight:bold;white-space:nowrap;display:flex;align-items:center;justify-content:center;min-width:28px;"><input type="checkbox" id="visible-' + p + '" ' + (isPlayerVisible(p) ? 'checked' : '') + '></label>' +
                                    '</div>' +
                                    '<div style="display:grid;grid-template-columns:80px 1fr;gap:6px;align-items:center;">' +
                                    '<input type="text" id="number-' + p + '" value="' + escapeHtml(playerNumbers[p] || p.replace('p','')) + '" placeholder="背番号" inputmode="numeric" style="width:100%;box-sizing:border-box;">' +
                                    '<input type="text" id="input-' + p + '" value="' + escapeHtml(playerNames[p]) + '" placeholder="氏名" style="width:100%;box-sizing:border-box;">' +
                                    '</div>';
                    editContainer.appendChild(div);
                    div.querySelector('#visible-' + p).onchange = function() { setPlayerVisible(p, this.checked); };
                    div.querySelector('#number-' + p).oninput = function() { renamePlayerNumber(p, this.value); };
                    div.querySelector('#input-' + p).oninput = function() { renamePlayer(p, this.value); };
                }
            })(players[m]);
        }
        if (!document.getElementById('btn-' + selectedPlayer)) selectedPlayer = 'us_team';
        document.getElementById('current-set-num').innerText = currentSet;
        
        buildArchiveDaySelect();
        updateAutoBackupUI();
        updateUI();
    }

    function setStartSide(side) {
        if (historyLog.length > 0) {
            if (!confirm('すでに現在のセットの得点記録が始まっています。開始設定を変更すると、これまでのローテーション計算が再計算されます。変更しますか？')) {
                return;
            }
        }
        startSideSetting = side;
        updateSideToggleUI();
        saveStorage();
        updateUI();
    }

    function updateSideToggleUI() {
        var sBtn = document.getElementById('side-s-btn');
        var rBtn = document.getElementById('side-r-btn');
        if (startSideSetting === 'S') {
            sBtn.classList.add('active'); rBtn.classList.remove('active');
        } else {
            rBtn.classList.add('active'); sBtn.classList.remove('active');
        }
    }

    function getAppFullTitle() {
        return (appTitlePrefix && appTitlePrefix.trim() ? appTitlePrefix.trim() : 'SEIMEI HS') + ' Volleyball Tracker';
    }

    function updateBaseDataUI() {
        var titleEl = document.getElementById('app-title-display');
        if (titleEl) titleEl.innerText = getAppFullTitle();
        document.title = getAppFullTitle();
        var teamEl = document.getElementById('self-team-name-display');
        if (teamEl) teamEl.innerText = selfTeamName || '清明';
        var prefixInput = document.getElementById('app-title-prefix-input');
        if (prefixInput) prefixInput.value = appTitlePrefix || 'SEIMEI HS';
        var teamInput = document.getElementById('self-team-name-input');
        if (teamInput) teamInput.value = selfTeamName || '清明';
        var labels = document.getElementsByClassName('self-team-text-label');
        for (var i=0; i<labels.length; i++) labels[i].innerText = selfTeamName || '清明';
    }

    function updateBaseDataSettings() {
        var prefixInput = document.getElementById('app-title-prefix-input');
        var teamInput = document.getElementById('self-team-name-input');
        appTitlePrefix = prefixInput && prefixInput.value.trim() ? prefixInput.value.trim() : 'SEIMEI HS';
        selfTeamName = teamInput && teamInput.value.trim() ? teamInput.value.trim() : '清明';
        updateBaseDataUI();
        saveStorage();
        updateUI();
    }

    function updateOppName(val) {
        oppTeamName = val.trim() ? val : '相手';
        updateOppLabels();
        saveStorage();
        updateUI(); 
    }

    function updateOppLabels() {
        playerNames['team'] = oppTeamName + '(全体)';
        var oppBtn = document.getElementById('btn-team');
        if(oppBtn) oppBtn.innerText = playerNames['team'];
        setAnalysisOpponentLabel(getCurrentAnalysisOpponentLabel());
    }

    function setAnalysisOpponentLabel(label) {
        var safeLabel = label || '相手';
        var labels = document.getElementsByClassName('opp-team-text-label');
        for(var i=0; i<labels.length; i++) {
            labels[i].innerText = safeLabel;
        }
    }

    function getCurrentAnalysisOpponentLabel() {
        return currentView === 'set' ? (oppTeamName || '相手') : '相手';
    }

    function getCurrentStatsNameMap() {
        var map = Object.assign({}, playerNames);
        if (currentView !== 'set') {
            map['team'] = '相手(全体)';
        }
        return map;
    }

    function getUniqueOppNames(items) {
        var list = [];
        for (var i = 0; i < items.length; i++) {
            var name = (items[i].oppName || '相手').trim() || '相手';
            if (!list.includes(name)) list.push(name);
        }
        return list;
    }

    function getArchiveTotalNameMap(daySets, baseMap) {
        var map = Object.assign({}, baseMap || playerNames);
        var oppList = getUniqueOppNames(daySets || []);
        map['team'] = (oppList.length === 1 ? oppList[0] : '相手') + '(全体)';
        return map;
    }

    var posLabels = { 1: 'BR (P1)', 2: 'FR (P2)', 3: 'FC (P3)', 4: 'FL (P4)', 5: 'BL (P5)', 6: 'BC (P6)' };

    function drawCourt(runtimeRotation) {
        for(var pos=1; pos<=6; pos++) {
            var pId = runtimeRotation[pos];
            var numEl = document.getElementById('num-p' + pos);
            var nameEl = document.getElementById('name-p' + pos);
            var cellEl = document.getElementById('pos-p' + pos);
            
            if(pId && pId !== 'none') {
                numEl.innerText = getPlayerNumber(pId);
                nameEl.innerText = getPlayerNameOnly(pId);
            } else {
                numEl.innerText = '-';
                nameEl.innerText = '未配置';
            }

            if(pos === 1 && hasServeAuthority) {
                cellEl.classList.add('server');
            } else {
                cellEl.classList.remove('server');
            }
        }
    }

    function drawStartingLineupBox() {
        for(var pos=1; pos<=6; pos++) {
            var pId = startingLineup[pos];
            var startNumEl = document.getElementById('start-num-' + pos);
            var startNameEl = document.getElementById('start-name-' + pos);
            var cellEl = startNumEl ? startNumEl.closest('.start-cell') : null;
            
            if(pId) {
                startNumEl.innerText = getPlayerNumber(pId);
                startNameEl.innerText = getPlayerNameOnly(pId);
                if (cellEl) { cellEl.classList.add('filled'); cellEl.classList.remove('empty'); }
            } else {
                startNumEl.innerText = '-';
                startNameEl.innerText = '未配置';
                if (cellEl) { cellEl.classList.add('empty'); cellEl.classList.remove('filled'); }
            }
            if (cellEl) {
                if (lineupBatchMode && pos === lineupBatchOrder[lineupBatchIndex]) {
                    cellEl.classList.add('batch-target');
                } else {
                    cellEl.classList.remove('batch-target');
                }
            }
        }
    }

    var selectingLineupPos = null;
    var lineupBatchMode = false;
    var lineupBatchOrder = [1, 2, 3, 4, 5, 6];
    var lineupBatchIndex = 0;

    function changeStartingPlayer(pos) {
        selectingLineupPos = pos;
        var picker = document.getElementById('lineup-player-picker');
        var title = document.getElementById('lineup-picker-title');
        var box = document.getElementById('lineup-player-buttons');
        if (!picker || !title || !box) return;

        title.innerText = posLabels[pos] + ' に配置する選手を選択';
        box.innerHTML = '';

        var usedMap = {};
        for (var lineupPos in startingLineup) {
            if (parseInt(lineupPos) !== pos && startingLineup[lineupPos]) {
                usedMap[startingLineup[lineupPos]] = true;
            }
        }

        var lineupCandidates = visibleOwnPlayerIds();
        for (var i = 0; i < lineupCandidates.length; i++) {
            (function(pId) {
                var btn = document.createElement('button');
                btn.className = 'lineup-player-btn';
                if (startingLineup[pos] === pId) btn.classList.add('current');
                if (usedMap[pId]) btn.classList.add('used');
                btn.innerHTML = '<span style="font-size:1rem;">' + escapeHtml(getPlayerNumber(pId)) + '</span><br><span style="font-size:0.78rem;">' + escapeHtml(getPlayerNameOnly(pId)) + '</span>' + (usedMap[pId] ? '<br><span class="lineup-used-badge">コート内</span>' : '');
                btn.onclick = function() { setStartingPlayerFromButton(pId); };
                box.appendChild(btn);
            })(lineupCandidates[i]);
        }

        picker.classList.add('active');
        picker.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function setStartingPlayerFromButton(playerId) {
        if (!selectingLineupPos) return;
        var targetPos = selectingLineupPos;
        startingLineup[targetPos] = playerId;

        // ポップアップを閉じなくても、S-Lineupの6枠・コート表示・保存データが即時更新されるように明示的に再描画する。
        drawStartingLineupBox();
        saveStorage();
        updateUI();

        var status = document.getElementById('lineup-rotate-status');
        if (lineupBatchMode) {
            lineupBatchIndex++;
            if (lineupBatchIndex >= lineupBatchOrder.length) {
                lineupBatchMode = false;
                selectingLineupPos = null;
                closeLineupPlayerPicker();
                drawStartingLineupBox();
                if (status) status.innerText = 'S-Lineup一括入力が完了しました。必要に応じて個別修正できます。';
            } else {
                if (status) status.innerText = posLabels[targetPos] + ' に ' + getPlayerDisplayName(playerId) + ' を配置しました。次は ' + posLabels[lineupBatchOrder[lineupBatchIndex]] + ' です。';
                changeStartingPlayer(lineupBatchOrder[lineupBatchIndex]);
            }
        } else {
            if (status) status.innerText = posLabels[targetPos] + ' に ' + getPlayerDisplayName(playerId) + ' を配置しました。';
            closeLineupPlayerPicker();
        }
    }

    function closeLineupPlayerPicker() {
        selectingLineupPos = null;
        if (lineupBatchMode) {
            lineupBatchMode = false;
            lineupBatchIndex = 0;
            var status = document.getElementById('lineup-rotate-status');
            if (status) status.innerText = 'S-Lineup一括入力を中止しました。';
        }
        var picker = document.getElementById('lineup-player-picker');
        if (picker) picker.classList.remove('active');
        drawStartingLineupBox();
    }

    function computeRotateClockwise(rotObj) {
        var temp = rotObj[1];
        rotObj[1] = rotObj[2];
        rotObj[2] = rotObj[3];
        rotObj[3] = rotObj[4];
        rotObj[4] = rotObj[5];
        rotObj[5] = rotObj[6];
        rotObj[6] = temp;
        return rotObj;
    }

    function computeRotateCounterClockwise(rotObj) {
        var temp = rotObj[1];
        rotObj[1] = rotObj[6];
        rotObj[6] = rotObj[5];
        rotObj[5] = rotObj[4];
        rotObj[4] = rotObj[3];
        rotObj[3] = rotObj[2];
        rotObj[2] = temp;
        return rotObj;
    }

    function normalizeStartingLineupMap(src) {
        var out = {};
        for (var pos = 1; pos <= 6; pos++) {
            out[pos] = (src && src[pos]) ? src[pos] : null;
        }
        return out;
    }

    function rotateLineupOnceForward(lineup) {
        // バレーのローテーションを1つ進める：P2→P1、P3→P2、P4→P3、P5→P4、P6→P5、P1→P6
        var cur = normalizeStartingLineupMap(lineup);
        return { 1: cur[2], 2: cur[3], 3: cur[4], 4: cur[5], 5: cur[6], 6: cur[1] };
    }

    function rotateLineupOnceBack(lineup) {
        // 1つ戻す：P6→P1、P1→P2、P2→P3、P3→P4、P4→P5、P5→P6
        var cur = normalizeStartingLineupMap(lineup);
        return { 1: cur[6], 2: cur[1], 3: cur[2], 4: cur[3], 5: cur[4], 6: cur[5] };
    }

    function getLineupRotateCount() {
        var sel = document.getElementById('lineup-rotate-count');
        var n = sel ? parseInt(sel.value, 10) : 1;
        if (!n || n < 1) n = 1;
        if (n > 5) n = 5;
        return n;
    }

    function startLineupBatchInput() {
        lineupBatchMode = true;
        lineupBatchIndex = 0;
        var status = document.getElementById('lineup-rotate-status');
        if (status) status.innerText = 'S-Lineup一括入力を開始します。まず ' + posLabels[lineupBatchOrder[0]] + ' の選手を選択してください。';
        drawStartingLineupBox();
        changeStartingPlayer(lineupBatchOrder[0]);
    }

    function clearStartingLineup() {
        if (!confirm('S-Lineupの6か所をすべて消去しますか？')) return;
        lineupBatchMode = false;
        lineupBatchIndex = 0;
        selectingLineupPos = null;
        var picker = document.getElementById('lineup-player-picker');
        if (picker) picker.classList.remove('active');
        for (var pos = 1; pos <= 6; pos++) {
            startingLineup[pos] = null;
        }
        drawStartingLineupBox();
        saveStorage();
        updateUI();
        var status = document.getElementById('lineup-rotate-status');
        if (status) status.innerText = 'S-Lineupを6か所とも消去しました。';
        if (confirm('P1→P6の順に一括入力を開始しますか？')) {
            startLineupBatchInput();
        } else if (status) {
            status.innerText = 'S-Lineupを6か所とも消去しました。必要なポジションをタップして再設定できます。';
        }
    }

    function rotateStartingLineupBy(delta) {
        var steps = Math.abs(parseInt(delta, 10) || 0);
        if (steps === 0) return;
        // 6ローテで元に戻るので無駄な処理を避ける
        steps = steps % 6;
        if (steps === 0) return;

        var next = normalizeStartingLineupMap(startingLineup);
        for (var i = 0; i < steps; i++) {
            next = (delta > 0) ? rotateLineupOnceForward(next) : rotateLineupOnceBack(next);
        }
        startingLineup = next;
        closeLineupPlayerPicker();
        drawStartingLineupBox();
        saveStorage();
        updateUI();

        var status = document.getElementById('lineup-rotate-status');
        if (status) {
            status.innerText = (delta > 0 ? steps + 'つ進めました。' : steps + 'つ戻しました。') + ' 配置を確認してからセットを開始してください。';
        }
    }

    function shiftStartingLineup(direction) {
        // 旧ボタン互換用。HTMLのキャッシュが残っていても動くように残します。
        rotateStartingLineupBy(direction === 'forward' ? 1 : -1);
    }

    var pendingRotationAdjustDelta = 0;
    var pendingRotationAdjustPreview = null;

    function drawRotationAdjustPreview(rotationState, titleText) {
        var titleEl = document.getElementById('rotation-adjust-preview-title');
        if (titleEl) titleEl.innerText = titleText || '現在のローテ位置';
        for (var pos = 1; pos <= 6; pos++) {
            var pId = rotationState ? rotationState[pos] : null;
            var numEl = document.getElementById('ra-num-p' + pos);
            var nameEl = document.getElementById('ra-name-p' + pos);
            var cellEl = document.getElementById('ra-pos-p' + pos);
            if (numEl) numEl.innerText = (pId && pId !== 'none') ? getPlayerNumber(pId) : '-';
            if (nameEl) nameEl.innerText = (pId && pId !== 'none') ? getPlayerNameOnly(pId) : '未配置';
            if (cellEl) {
                if (pos === 1 && hasServeAuthority) cellEl.classList.add('server');
                else cellEl.classList.remove('server');
            }
        }
    }

    function resetRotationAdjustPreview() {
        pendingRotationAdjustDelta = 0;
        pendingRotationAdjustPreview = getCurrentRotationStateForSubstitution();
        drawRotationAdjustPreview(pendingRotationAdjustPreview, '現在のローテ位置');
        var statusEl = document.getElementById('rotation-adjust-status');
        if (statusEl) statusEl.innerText = '未変更';
        var noteEl = document.getElementById('rotation-adjust-note');
        if (noteEl) noteEl.value = '';
        var applyBtn = document.getElementById('rotation-adjust-apply-btn');
        if (applyBtn) applyBtn.disabled = true;
    }

    function previewRotationAdjust(delta) {
        delta = parseInt(delta, 10) || 0;
        if (delta !== 1 && delta !== -1) return;
        if (!pendingRotationAdjustPreview) pendingRotationAdjustPreview = getCurrentRotationStateForSubstitution();
        pendingRotationAdjustPreview = applyRotationAdjustmentToState(pendingRotationAdjustPreview, delta);
        pendingRotationAdjustDelta += delta;
        drawRotationAdjustPreview(pendingRotationAdjustPreview, '修正後プレビュー');
        var statusEl = document.getElementById('rotation-adjust-status');
        if (statusEl) {
            if (pendingRotationAdjustDelta === 0) statusEl.innerText = '未変更';
            else statusEl.innerText = pendingRotationAdjustDelta > 0 ? (pendingRotationAdjustDelta + 'つ進める') : (Math.abs(pendingRotationAdjustDelta) + 'つ戻す');
        }
        var applyBtn = document.getElementById('rotation-adjust-apply-btn');
        if (applyBtn) applyBtn.disabled = (pendingRotationAdjustDelta === 0);
    }

    function applyPendingRotationAdjust() {
        if (!pendingRotationAdjustDelta) {
            alert('ローテ位置が変更されていません。');
            return;
        }
        var scoreUs = document.getElementById('score-us') ? document.getElementById('score-us').innerText : '0';
        var scoreThem = document.getElementById('score-them') ? document.getElementById('score-them').innerText : '0';
        var noteEl = document.getElementById('rotation-adjust-note');
        var note = noteEl ? (noteEl.value || '').trim() : '';
        historyLog.push({
            type: 'rotation_adjust',
            delta: pendingRotationAdjustDelta,
            scoreAt: scoreUs + '-' + scoreThem,
            note: note,
            timestamp: Date.now()
        });
        pendingRotationAdjustDelta = 0;
        pendingRotationAdjustPreview = null;
        closeModal('irregularAdjustModal');
        closeModal('rotationAdjustModal');
        updateUI();
    }

    function recordRotationAdjust(delta) {
        // 旧呼び出し互換用。即時確定ではなくプレビュー方式に寄せます。
        previewRotationAdjust(delta);
    }

    function applyRotationAdjustmentToState(rotationState, delta) {
        var d = parseInt(delta, 10) || 0;
        var steps = Math.abs(d) % 6;
        var next = normalizeStartingLineupMap(rotationState);
        for (var i = 0; i < steps; i++) {
            next = d > 0 ? rotateLineupOnceForward(next) : rotateLineupOnceBack(next);
        }
        return next;
    }

    function selectPlayer(id) {
        selectedPlayer = id;
        var buttons = document.getElementsByClassName('p-btn');
        for (var i = 0; i < buttons.length; i++) { buttons[i].classList.remove('active'); }
        document.getElementById('btn-' + id).classList.add('active');
        saveStorage();
    }

    function renamePlayer(id, newName) {
        playerNames[id] = newName.trim() ? newName.trim() : '選手 No.' + id.replace('p','');
        updatePlayerButtonLabel(id);
        updateUI();
    }

    function renamePlayerNumber(id, newNumber) {
        playerNumbers[id] = String(newNumber || '').trim() || id.replace('p','');
        updatePlayerButtonLabel(id);
        updateUI();
    }


    function setPlayerVisible(id, checked) {
        playerVisible[id] = !!checked;
        if (!playerVisible[selectedPlayer] && selectedPlayer === id) selectedPlayer = 'us_team';
        saveStorage();
        initSetup();
    }

    function getDisplayedScore() {
        return {
            us: parseInt(document.getElementById('score-us').innerText, 10) || 0,
            them: parseInt(document.getElementById('score-them').innerText, 10) || 0
        };
    }

    function initializeScoreAdjustFields() {
        var sc = getDisplayedScore();
        var usEl = document.getElementById('score-adjust-us');
        var themEl = document.getElementById('score-adjust-them');
        var usLabel = document.getElementById('score-adjust-us-label');
        var themLabel = document.getElementById('score-adjust-them-label');
        var beforeEl = document.getElementById('score-adjust-before');
        var noteEl = document.getElementById('score-adjust-note');
        if (usEl) usEl.value = sc.us;
        if (themEl) themEl.value = sc.them;
        if (usLabel) usLabel.innerText = selfTeamName || '自チーム';
        if (themLabel) themLabel.innerText = oppTeamName || '相手';
        if (beforeEl) beforeEl.innerText = '現在表示：' + sc.us + ' - ' + sc.them;
        if (noteEl) noteEl.value = '';
    }

    function openIrregularAdjustModal() {
        initializeScoreAdjustFields();
        openModal('irregularAdjustModal');
        resetRotationAdjustPreview();
    }

    function openScoreAdjustModal() {
        openIrregularAdjustModal();
    }

    function stepScoreAdjust(side, delta) {
        var el = document.getElementById(side === 'us' ? 'score-adjust-us' : 'score-adjust-them');
        if (!el) return;
        var v = parseInt(el.value, 10) || 0;
        el.value = Math.max(0, v + delta);
    }

    function applyScoreAdjustment() {
        var before = getDisplayedScore();
        var toUs = Math.max(0, parseInt(document.getElementById('score-adjust-us').value, 10) || 0);
        var toThem = Math.max(0, parseInt(document.getElementById('score-adjust-them').value, 10) || 0);
        if (before.us === toUs && before.them === toThem) {
            alert('得点が変更されていません。');
            return;
        }
        var note = (document.getElementById('score-adjust-note').value || '').trim();
        historyLog.push({
            type: 'score_adjust',
            fromUs: before.us,
            fromThem: before.them,
            toUs: toUs,
            toThem: toThem,
            note: note,
            timestamp: new Date().toISOString()
        });
        closeModal('irregularAdjustModal');
        updateUI();
    }

    function recordTimeout(team) {
        if (timeoutCount[team] >= 2) { alert('タイムアウト上限に達しています。'); return; }
        var scoreUs = document.getElementById('score-us').innerText;
        var scoreThem = document.getElementById('score-them').innerText;
        timeoutCount[team]++;
        historyLog.push({ type: 'timeout', team: team, scoreAt: scoreUs + '-' + scoreThem });
        updateUI();
    }

    var editChoiceTargetIndex = null;

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function(ch) {
            return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
        });
    }

    function showChoiceModal(title, subtitle, options, compact, extraHtml) {
        document.getElementById('choice-modal-title').innerText = title || '選択';
        document.getElementById('choice-modal-subtitle').innerText = subtitle || '';
        document.getElementById('choice-modal-extra').innerHTML = extraHtml || '';
        var box = document.getElementById('choice-modal-options');
        box.className = 'choice-grid' + (compact ? ' compact' : '');
        box.innerHTML = '';
        for (var i = 0; i < options.length; i++) {
            (function(opt) {
                var btn = document.createElement('button');
                btn.className = 'choice-btn' + (opt.kind ? ' ' + opt.kind : '');
                btn.innerHTML = opt.html || opt.label;
                btn.onclick = function() { if (opt.onClick) opt.onClick(); };
                box.appendChild(btn);
            })(options[i]);
        }
        openModal('choiceModal');
    }

    function closeChoiceModal() { closeModal('choiceModal'); }

    function playerChoiceOptions(includeTeam, handler) {
        var opts = [];
        var choiceIds = visibleOwnPlayerIds();
        for (var i = 0; i < choiceIds.length; i++) {
            (function(id) {
                opts.push({
                    html: '<span class="choice-player-num">' + escapeHtml(getPlayerNumber(id)) + '</span><span class="choice-player-name">' + escapeHtml(getPlayerNameOnly(id)) + '</span>',
                    onClick: function() { handler(id); }
                });
            })(choiceIds[i]);
        }
        if (includeTeam) {
            opts.push({ label: '相手チーム全体', kind: 'warning', onClick: function(){ handler('team'); } });
        }
        return opts;
    }

    function playerChoiceOptionsFromIds(ids, handler, kindClass) {
        var opts = [];
        for (var i = 0; i < ids.length; i++) {
            (function(id) {
                var num = getPlayerNumber(id);
                opts.push({
                    kind: kindClass || '',
                    html: '<span class="choice-player-num">' + escapeHtml(num) + '</span><span class="choice-player-name">' + escapeHtml(getPlayerNameOnly(id)) + '</span>',
                    onClick: function() { handler(id); }
                });
            })(ids[i]);
        }
        return opts;
    }

    function allOwnPlayerIds() {
        var arr = [];
        for (var i = 1; i <= MAX_PLAYERS; i++) arr.push('p' + i);
        return arr;
    }

    function exceptionalSubPlayerIds() {
        // 公式戦では登録表示ONの選手のみ。練習試合では全員を例外交代候補にします。
        return matchType === 'official' ? visibleOwnPlayerIds() : allOwnPlayerIds();
    }

    function getCurrentRotationStateForSubstitution() {
        var rotationState = Object.assign({}, startingLineup);
        var serverState = (startSideSetting === 'S');
        var isFirstPointAfterReceiveStart = (startSideSetting === 'R');
        for (var i = 0; i < historyLog.length; i++) {
            var action = historyLog[i];
            if (action.type === 'stat') {
                var item = action.item;
                var isUsAction = (action.player !== 'team');
                var isPositive = ['attack_kill', 'block_kill', 'serve_ace'].includes(item);
                var isUsPoint = isUsAction ? isPositive : !isPositive;
                if (isUsPoint) {
                    if (serverState === false) {
                        rotationState = computeRotateClockwise(rotationState);
                        serverState = true;
                        if (isFirstPointAfterReceiveStart) isFirstPointAfterReceiveStart = false;
                    }
                } else {
                    if (serverState === true) {
                        serverState = false;
                        if (isFirstPointAfterReceiveStart) isFirstPointAfterReceiveStart = false;
                    }
                }
            } else if (action.type === 'substitution' && action.team === 'us' && action.outPlayer && action.inPlayer) {
                for (var posKey in rotationState) {
                    if (rotationState[posKey] === action.outPlayer) rotationState[posKey] = action.inPlayer;
                }
            } else if (action.type === 'rotation_adjust') {
                rotationState = applyRotationAdjustmentToState(rotationState, action.delta);
            }
        }
        return rotationState;
    }

    function getCourtPlayerIds() {
        var rotation = getCurrentRotationStateForSubstitution();
        var result = [];
        for (var pos = 1; pos <= 6; pos++) {
            var id = rotation[pos];
            if (id && id !== 'none' && result.indexOf(id) === -1) result.push(id);
        }
        return result;
    }

    function getBenchPlayerIds(courtIds) {
        var courtMap = {};
        for (var i = 0; i < courtIds.length; i++) courtMap[courtIds[i]] = true;
        var result = [];
        var candidateIds = visibleOwnPlayerIds();
        for (var n = 0; n < candidateIds.length; n++) {
            var id = candidateIds[n];
            if (!courtMap[id]) result.push(id);
        }
        return result;
    }

    function uniquePlayerIds(arr) {
        var seen = {};
        var result = [];
        for (var i = 0; i < arr.length; i++) {
            var id = arr[i];
            if (id && id !== 'none' && !seen[id]) { seen[id] = true; result.push(id); }
        }
        return result;
    }

    function getStartingPlayerIds() {
        var arr = [];
        for (var pos = 1; pos <= 6; pos++) arr.push(startingLineup[pos]);
        return uniquePlayerIds(arr);
    }

    function buildSubstitutionRuleState() {
        var starters = getStartingPlayerIds();
        var starterMap = {};
        for (var i = 0; i < starters.length; i++) starterMap[starters[i]] = true;

        var state = {
            starters: starters,
            starterMap: starterMap,
            pairByStarter: {},       // starter -> substitute
            pairedStarterBySub: {},  // substitute -> starter
            starterReturned: {},     // starter has already returned once
            subExited: {}            // substitute has left court after entering
        };

        for (var h = 0; h < historyLog.length; h++) {
            var a = historyLog[h];
            if (!a || a.type !== 'substitution' || a.team !== 'us' || !a.outPlayer || !a.inPlayer || a.exceptionalSub) continue;

            var outIsStarter = !!starterMap[a.outPlayer];
            var inIsStarter = !!starterMap[a.inPlayer];

            if (outIsStarter && !inIsStarter) {
                if (!state.pairByStarter[a.outPlayer]) state.pairByStarter[a.outPlayer] = a.inPlayer;
                if (!state.pairedStarterBySub[a.inPlayer]) state.pairedStarterBySub[a.inPlayer] = a.outPlayer;
            } else if (!outIsStarter && inIsStarter) {
                if (state.pairByStarter[a.inPlayer] === a.outPlayer) {
                    state.starterReturned[a.inPlayer] = true;
                    state.subExited[a.outPlayer] = true;
                } else {
                    // 既存データや手動編集で組み合わせが崩れた場合も、安全側に倒して再出場不可にする
                    state.subExited[a.outPlayer] = true;
                }
            }
        }
        return state;
    }

    function getLegalSubOutPlayerIds() {
        var courtIds = getCourtPlayerIds();
        var state = buildSubstitutionRuleState();
        var result = [];
        for (var i = 0; i < courtIds.length; i++) {
            var id = courtIds[i];
            if (!isPlayerVisible(id)) continue;
            if (state.starterMap[id]) {
                // スタメンは、いったん戻った後は同セット内で再びOUTできない
                if (!state.starterReturned[id]) result.push(id);
            } else {
                // 交代で入った選手は、同じ組み合わせのスタメンと戻す場合だけOUT候補にする
                var pairedStarter = state.pairedStarterBySub[id];
                if (pairedStarter && !state.starterReturned[pairedStarter]) result.push(id);
            }
        }
        return result;
    }

    function getLegalSubInPlayerIds(outId) {
        var courtIds = getCourtPlayerIds();
        var benchIds = getBenchPlayerIds(courtIds);
        var benchMap = {};
        for (var b = 0; b < benchIds.length; b++) benchMap[benchIds[b]] = true;
        var state = buildSubstitutionRuleState();

        if (state.starterMap[outId]) {
            var result = [];
            for (var i = 0; i < benchIds.length; i++) {
                var id = benchIds[i];
                // スタメン同士の交代は通常交代では候補外。交代で入って一度退いた選手も再出場不可。
                if (!state.starterMap[id] && !state.subExited[id]) result.push(id);
            }
            return result;
        }

        var pairedStarter = state.pairedStarterBySub[outId];
        if (pairedStarter && benchMap[pairedStarter] && !state.starterReturned[pairedStarter]) return [pairedStarter];
        return [];
    }

    function statChoiceOptions(handler, isUsAction) {
        var keys = ['attack_kill','attack_error','block_kill','block_error','serve_ace','serve_error','reception_error','dig_error','toss_error','miscommunication_error','other_error','v_net','v_over','v_passing','v_dribble','v_hold','v_positional','v_backrow'];
        var opts = [];
        for (var i = 0; i < keys.length; i++) {
            (function(key) {
                var positive = ['attack_kill','block_kill','serve_ace'].includes(key);
                opts.push({
                    label: getLabel(key, isUsAction),
                    kind: positive ? 'success' : (key.indexOf('v_') === 0 ? 'warning' : 'danger'),
                    onClick: function(){ handler(key); }
                });
            })(keys[i]);
        }
        return opts;
    }

    function opponentNumberOptions(handler) {
        var opts = [];
        for (var i = 1; i <= 30; i++) {
            (function(num) { opts.push({ label: String(num), onClick: function(){ handler(String(num)); } }); })(i);
        }
        return opts;
    }

    function recordSubstitution(team) {
        if (subCount[team] >= 6) { alert('メンバー交代上限に達しています。'); return; }
        startSubstitutionFlow(team, null, function(subInfo) {
            var scoreUs = document.getElementById('score-us').innerText;
            var scoreThem = document.getElementById('score-them').innerText;
            subInfo.type = 'substitution';
            subInfo.team = team;
            subInfo.scoreAt = scoreUs + '-' + scoreThem;
            subCount[team]++;
            historyLog.push(subInfo);
            updateUI();
        });
    }

    function startSubstitutionFlow(team, existingAction, done) {
        if (team === 'us') {
            showChoiceModal('交代選手を記録', (selfTeamName + 'の交代内容を選択してください。通常はOUTをコート内6人、INをコート外選手に絞って表示します。'), [
                { label: '交代回数のみ', onClick: function(){ closeChoiceModal(); done({}); } },
                { label: '交代選手を記録', kind: 'success', onClick: function(){ chooseSubOutPlayer(done, false); } }
            ], false);
        } else {
            showChoiceModal('相手交代記録', '相手チームの交代内容を選択してください。番号はボタンで選べます。', [
                { label: '交代回数のみ', onClick: function(){ closeChoiceModal(); done({ note: '' }); } },
                { label: '相手番号を選ぶ', kind: 'warning', onClick: function(){ chooseOpponentSubOut(done); } }
            ], false);
        }
    }

    function chooseSubOutPlayer(done, exceptionalMode) {
        var ids = exceptionalMode ? exceptionalSubPlayerIds() : getLegalSubOutPlayerIds();
        var opts = playerChoiceOptionsFromIds(ids, function(outId){ chooseSubInPlayer(outId, done, exceptionalMode); }, 'out-mode');
        if (!exceptionalMode) {
            if (opts.length === 0) opts.push({ label: '通常交代の候補なし', kind: 'danger', onClick: function(){} });
            opts.push({ label: '例外的な交代', kind: 'warning', onClick: function(){ chooseSubOutPlayer(done, true); } });
        }
        var sub = exceptionalMode ? '例外モード：OUT/INとも全選手から選択できます。' : '通常モード：競技者交代の組み合わせ規定に沿って、OUT候補を絞っています。';
        showChoiceModal('OUT', sub, opts, false, '<div class="choice-step-note out-label"><strong>OUT</strong>：コートから下がる選手</div>');
    }

    function chooseSubInPlayer(outId, done, exceptionalMode) {
        var ids = exceptionalMode ? exceptionalSubPlayerIds() : getLegalSubInPlayerIds(outId);
        ids = ids.filter(function(id){ return id !== outId; });
        var opts = playerChoiceOptionsFromIds(ids, function(inId){
            closeChoiceModal();
            done({ outPlayer: outId, inPlayer: inId, exceptionalSub: !!exceptionalMode });
        }, 'in-mode');
        if (!exceptionalMode && opts.length === 0) opts.push({ label: '通常交代の候補なし', kind: 'danger', onClick: function(){} });
        var extra = '<div class="choice-step-note out-label"><strong>OUT</strong>：' + escapeHtml(getPlayerDisplayName(outId)) + '</div>' +
                    '<div class="choice-step-note in-label"><strong>IN</strong>：入る選手を選択</div>';
        var sub = exceptionalMode ? '例外モード：全選手から選べます。' : '通常モード：スタメンの再出場は同じ交代相手との組み合わせだけに絞っています。';
        showChoiceModal('IN', sub, opts, false, extra);
    }

    function chooseOpponentSubOut(done) {
        showChoiceModal('OUT', '相手チームで下がる番号を選んでください。', opponentNumberOptions(function(outNo){ chooseOpponentSubIn(outNo, done); }), true);
    }

    function chooseOpponentSubIn(outNo, done) {
        var extra = '<div class="choice-step-note out-label"><strong>OUT</strong>：' + escapeHtml(outNo) + '</div>' + '<div class="choice-step-note in-label"><strong>IN</strong>：入る番号を選択</div>';
        showChoiceModal('IN', '相手チームで入る番号を選んでください。', opponentNumberOptions(function(inNo){
            closeChoiceModal();
            done({ note: outNo + ' → ' + inNo, outOppNum: outNo, inOppNum: inNo });
        }), true, extra);
    }

    function addStat(item) {
        activePlayerHighlightFix(selectedPlayer);
        setData[selectedPlayer][item] = (setData[selectedPlayer][item] || 0) + 1;
        todayData[selectedPlayer][item] = (todayData[selectedPlayer][item] || 0) + 1;
        allData[selectedPlayer][item] = (allData[selectedPlayer][item] || 0) + 1;
        
        historyLog.push({ type: 'stat', player: selectedPlayer, item: item });
        updateUI();
    }

    function activePlayerHighlightFix(id) {
        var btn = document.getElementById('btn-' + id);
        if(btn) {
            var buttons = document.getElementsByClassName('p-btn');
            for (var i = 0; i < buttons.length; i++) { buttons[i].classList.remove('active'); }
            btn.classList.add('active');
        }
    }

    function undoLast() {
        if (historyLog.length === 0) return;
        deleteLogAt(historyLog.length - 1, true);
    }

    function adjustStatCount(player, item, delta) {
        if (!player || !item) return;
        if (!setData[player]) setData[player] = {};
        if (!todayData[player]) todayData[player] = {};
        if (!allData[player]) allData[player] = {};
        setData[player][item] = Math.max(0, (setData[player][item] || 0) + delta);
        todayData[player][item] = Math.max(0, (todayData[player][item] || 0) + delta);
        allData[player][item] = Math.max(0, (allData[player][item] || 0) + delta);
    }

    function deleteLogAt(index, skipConfirm) {
        if (index < 0 || index >= historyLog.length) return;
        var target = historyLog[index];
        if (!skipConfirm && !confirm('この記録を削除しますか？')) return;
        historyLog.splice(index, 1);
        if (target.type === 'stat') {
            adjustStatCount(target.player, target.item, -1);
        } else if (target.type === 'timeout') {
            if (timeoutCount[target.team] > 0) timeoutCount[target.team]--;
        } else if (target.type === 'substitution') {
            if (subCount[target.team] > 0) subCount[target.team]--;
        }
        updateUI();
    }

    function editLogAt(index) {
        if (index < 0 || index >= historyLog.length) return;
        var action = historyLog[index];
        var options = [
            { label: 'この記録を削除', kind: 'danger', onClick: function(){ closeChoiceModal(); deleteLogAt(index, false); } }
        ];
        if (action.type === 'stat') {
            options.push({ label: '選手を変更', onClick: function(){ chooseEditStatPlayer(index); } });
            options.push({ label: '内容を変更', onClick: function(){ chooseEditStatItem(index); } });
        }
        if (action.type === 'substitution') {
            options.push({ label: '交代内容を変更', kind: 'warning', onClick: function(){ chooseEditSubstitution(index); } });
        }
        showChoiceModal('記録編集', 'タップした記録に対する操作を選んでください。', options, false);
    }

    function chooseEditStatPlayer(index) {
        var action = historyLog[index];
        if (!action || action.type !== 'stat') return;
        showChoiceModal('選手を変更', '変更後の選手を選んでください。相手チーム全体も選択できます。', playerChoiceOptions(true, function(newPlayer){
            adjustStatCount(action.player, action.item, -1);
            action.player = newPlayer;
            adjustStatCount(action.player, action.item, 1);
            selectedPlayer = newPlayer;
            closeChoiceModal();
            updateUI();
        }), false);
    }

    function chooseEditStatItem(index) {
        var action = historyLog[index];
        if (!action || action.type !== 'stat') return;
        var isUsAction = action.player !== 'team';
        showChoiceModal('内容を変更', '変更後のプレー内容を選んでください。', statChoiceOptions(function(newItem){
            adjustStatCount(action.player, action.item, -1);
            action.item = newItem;
            adjustStatCount(action.player, action.item, 1);
            closeChoiceModal();
            updateUI();
        }, isUsAction), false);
    }

    function chooseEditSubstitution(index) {
        var action = historyLog[index];
        if (!action || action.type !== 'substitution') return;
        startSubstitutionFlow(action.team, action, function(newInfo){
            action.outPlayer = newInfo.outPlayer || undefined;
            action.inPlayer = newInfo.inPlayer || undefined;
            action.outOppNum = newInfo.outOppNum || undefined;
            action.inOppNum = newInfo.inOppNum || undefined;
            action.exceptionalSub = !!newInfo.exceptionalSub;
            action.note = newInfo.note || '';
            updateUI();
        });
    }

    function finishSet() {
        var scoreUs = parseInt(document.getElementById('score-us').innerText);
        var scoreThem = parseInt(document.getElementById('score-them').innerText);
        
        if (confirm('第 ' + currentSet + ' セットを終了し、データを保存して次のセットに進みますか？\n対戦相手: ' + oppTeamName + '\nスコア: ' + scoreUs + ' - ' + scoreThem)) {
            
            var now = new Date();
            var weeks = ['日', '月', '火', '水', '木', '金', '土'];
            var dateString = now.getFullYear() + '/' + (now.getMonth() + 1) + '/' + now.getDate();
            var dayString = '（' + weeks[now.getDay()] + '）';
            var timeString = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
            var fullTimestamp = dateString + dayString + ' ' + timeString;

            var archiveItem = {
                id: 'set_' + Date.now(),
                date: dateString,
                timestamp: fullTimestamp,
                oppName: oppTeamName,
                matchType: matchType,
                matchNumber: matchType === 'official' ? officialMatchNumber : null,
                matchLabel: getMatchLabel(),
                setNum: currentSet,
                score: scoreUs + '-' + scoreThem,
                usScore: scoreUs,
                themScore: scoreThem,
                statsSnap: JSON.parse(JSON.stringify(setData)),
                playerNamesSnap: JSON.parse(JSON.stringify(playerNames)),
                playerNumbersSnap: JSON.parse(JSON.stringify(playerNumbers)),
                historyLogSnap: JSON.parse(JSON.stringify(historyLog))
            };

            globalArchive.push(archiveItem);
            createAutoBackup(getMatchLabel() + ' 第' + currentSet + 'セット終了 / vs ' + oppTeamName + ' / ' + scoreUs + '-' + scoreThem);

            setResults.push({ matchType: matchType, matchNumber: matchType === 'official' ? officialMatchNumber : null, matchLabel: getMatchLabel(), set: currentSet, us: scoreUs, them: scoreThem, opp: oppTeamName });
            currentSet++;

            // 次セットはスコア・ログ・T.O・交代回数を完全に初期化。
            // S-Lineupは前セットのものを残し、S-Lineup画面で必要に応じて調整します。
            setData = createEmptyStats(); 
            historyLog = []; 
            timeoutCount = { us: 0, them: 0 }; 
            subCount = { us: 0, them: 0 };
            startSideSetting = 'S'; 
            hasServeAuthority = true;
            updateSideToggleUI();

            closeLineupPlayerPicker();
            buildArchiveDaySelect();
            updateUI();

            var logContainer = document.getElementById('running-score-log');
            if (logContainer) logContainer.scrollTop = 0;
            window.scrollTo({ top: 0, behavior: 'smooth' });

            setTimeout(function() {
                alert('第' + (currentSet - 1) + 'セットを保存しました。第' + currentSet + 'セットを開始できます。S-Lineupは前セットの配置を引き継いでいます。');
            }, 80);
        }
    }

    function buildArchiveDaySelect() {
        var daySelect = document.getElementById('archive-day-select');
        daySelect.innerHTML = '<option value="">日付を選択...</option>';

        var uniqueDays = [];
        for(var i=0; i<globalArchive.length; i++) {
            var d = globalArchive[i].date;
            if(!uniqueDays.includes(d)) { uniqueDays.push(d); }
        }
        uniqueDays.sort(function(a,b){ return b.localeCompare(a); });

        for(var j=0; j<uniqueDays.length; j++) {
            var dayOpt = document.createElement('option');
            dayOpt.value = uniqueDays[j];
            dayOpt.innerText = uniqueDays[j];
            daySelect.appendChild(dayOpt);
        }

        onArchiveDayChanged();
    }

    function onArchiveDayChanged() {
        var dayVal = document.getElementById('archive-day-select').value;
        var setSelect = document.getElementById('archive-set-select');
        var totalBtn = document.getElementById('archive-day-total-btn');
        var displayArea = document.getElementById('archive-display-area');

        displayArea.style.display = 'none'; 

        if (!dayVal) {
            setSelect.innerHTML = '<option value="">まず日付を選んでください</option>';
            setSelect.disabled = true;
            totalBtn.disabled = true;
            return;
        }

        setSelect.disabled = false;
        totalBtn.disabled = false;

        setSelect.innerHTML = '<option value="">セットを選択...</option>';
        var filtered = globalArchive.filter(function(x) { return x.date === dayVal; });
        
        for (var i = filtered.length - 1; i >= 0; i--) {
            var item = filtered[i];
            var opt = document.createElement('option');
            opt.value = item.id;
            
            var resultMark = '-';
            var uS = item.usScore !== undefined ? item.usScore : parseInt(item.score.split('-')[0]);
            var tS = item.themScore !== undefined ? item.themScore : parseInt(item.score.split('-')[1]);
            if (uS > tS) { resultMark = '○'; } else if (uS < tS) { resultMark = '●'; }

            var itemLabel = item.matchLabel ? (item.matchLabel + ' ') : '';
            opt.innerText = item.timestamp.split(' ')[1] + '〜 ' + itemLabel + 'vs ' + item.oppName + ' (第' + item.setNum + 'S: ' + item.score + ') ' + resultMark;
            setSelect.appendChild(opt);
        }
    }

    function viewArchiveSetItem() {
        var setId = document.getElementById('archive-set-select').value;
        var area = document.getElementById('archive-display-area');
        var titleEl = document.getElementById('archive-view-title');
        var tbody = document.getElementById('archive-tbody');
        var logContainer = document.getElementById('archive-running-score-log');
        var logTitleEl = document.getElementById('archive-log-title');

        if (!setId) { area.style.display = 'none'; return; }

        var matched = globalArchive.find(function(x){ return x.id === setId; });
        if(!matched) return;

        tbody.innerHTML = '';
        logContainer.innerHTML = '';

        var resultMark = '-';
        var uS = matched.usScore !== undefined ? matched.usScore : parseInt(matched.score.split('-')[0]);
        var tS = matched.themScore !== undefined ? matched.themScore : parseInt(matched.score.split('-')[1]);
        if (uS > tS) { resultMark = '○'; } else if (uS < tS) { resultMark = '●'; }

        var matchedLabel = matched.matchLabel ? (matched.matchLabel + ' ') : '';
        titleEl.innerText = '📑 【1セット記録】 ' + matched.timestamp + ' ' + matchedLabel + 'vs ' + matched.oppName + ' (第' + matched.setNum + 'S: ' + matched.score + ') ' + resultMark;
        renderTableRows(tbody, matched.statsSnap, matched.playerNamesSnap, matched.playerNumbersSnap);
        
        logTitleEl.innerText = '📝 第' + matched.setNum + 'セットのランニングスコア';
        if (matched.historyLogSnap && matched.historyLogSnap.length > 0) {
            renderArchiveLogs(logContainer, matched.historyLogSnap, matched.playerNamesSnap, matched.playerNumbersSnap);
        } else {
            logContainer.innerHTML = '<div style="color:#aaa; text-align:center; padding-top:10px;">スコアログなし</div>';
        }
        area.style.display = 'block';
    }

    function viewArchiveDayTotal() {
        var dayVal = document.getElementById('archive-day-select').value;
        var area = document.getElementById('archive-display-area');
        var titleEl = document.getElementById('archive-view-title');
        var tbody = document.getElementById('archive-tbody');
        var logContainer = document.getElementById('archive-running-score-log');
        var logTitleEl = document.getElementById('archive-log-title');

        if (!dayVal) return;

        document.getElementById('archive-set-select').value = '';

        var daySets = globalArchive.filter(function(x){ return x.date === dayVal; });
        if(daySets.length === 0) return;

        tbody.innerHTML = '';
        logContainer.innerHTML = '';

        var aggregatedStats = createEmptyStats();
        var oppList = getUniqueOppNames(daySets);

        for(var k=0; k<daySets.length; k++) {
            var sData = daySets[k].statsSnap;
            
            for(var pKey in sData) {
                for(var sKey in sData[pKey]) {
                    aggregatedStats[pKey][sKey] += (sData[pKey][sKey] || 0);
                }
            }
        }

        var archiveNameMap = getArchiveTotalNameMap(daySets, daySets[daySets.length-1].playerNamesSnap);
        var oppTitle = oppList.length === 1 ? oppList[0] : '複数（' + oppList.join(', ') + '）';
        titleEl.innerText = '📅 【1日合計データ】 ' + dayVal + ' （相手: ' + oppTitle + ' / 計 ' + daySets.length + 'セット）';
        renderTableRows(tbody, aggregatedStats, archiveNameMap, daySets[daySets.length-1].playerNumbersSnap || playerNumbers);
        
        logTitleEl.innerText = '📝 ランニングスコア';
        logContainer.innerHTML = '<div style="color:#aaa; text-align:center; padding-top:10px;">※1日合算データではランニングスコアは表示されません。各セットごとの詳細ログをご覧ください。</div>';
        area.style.display = 'block';
    }

    function renderArchiveLogs(containerElement, logSnap, nameMap, numberMap) {
        var scoreUs = 0, scoreThem = 0;
        for (var i = 0; i < logSnap.length; i++) {
            var action = logSnap[i];
            if (action.type === 'stat') {
                var item = action.item; 
                var isUsAction = (action.player !== 'team'); 
                var isPositive = ['attack_kill', 'block_kill', 'serve_ace'].includes(item);
                var isUsPoint = isUsAction ? isPositive : !isPositive;
                
                if (isUsPoint) { scoreUs++; } else { scoreThem++; }

                var logItem = document.createElement('div');
                logItem.className = 'log-item editable-log ' + (isUsPoint ? 'us' : 'them');
                logItem.onclick = (function(idx){ return function(){ editLogAt(idx); }; })(i);
                var pName = getPlayerDisplayName(action.player, nameMap, numberMap);
                
                if (action.player !== 'team') {
                    pName = '<span style="color: #7dd3fc; font-weight: 600;">' + pName + '</span>';
                }
                
                logItem.innerHTML = '<strong>[' + scoreUs + ' - ' + scoreThem + ']</strong> ' + pName + ' : ' + getLabelWithMap(item, isUsAction, nameMap);
                containerElement.appendChild(logItem);
            } else if (action.type === 'timeout') {
                var logItem = document.createElement('div'); logItem.className = 'log-item timeout';
                var teamName = action.team === 'us' ? selfTeamName : (nameMap['team'] ? nameMap['team'].replace('(全体)','') : '相手チーム');
                logItem.innerHTML = '⏳ T.O: ' + teamName + ' (' + action.scoreAt + ')';
                containerElement.appendChild(logItem);
            } else if (action.type === 'substitution') {
                var logItem = document.createElement('div'); logItem.className = 'log-item substitution';
                var teamName = action.team === 'us' ? selfTeamName : (nameMap['team'] ? nameMap['team'].replace('(全体)','') : '相手チーム');
                logItem.innerHTML = '🔄 交代: ' + teamName + ' (' + action.scoreAt + ')';
                containerElement.appendChild(logItem);
            } else if (action.type === 'score_adjust') {
                var beforeText = (action.fromUs || 0) + ' - ' + (action.fromThem || 0);
                scoreUs = Math.max(0, parseInt(action.toUs, 10) || 0);
                scoreThem = Math.max(0, parseInt(action.toThem, 10) || 0);
                var logItem = document.createElement('div'); logItem.className = 'log-item score-adjust';
                var noteText = action.note ? '：' + action.note : '';
                logItem.innerHTML = '<strong>[' + scoreUs + ' - ' + scoreThem + ']</strong> ⚙ 得点修正 ' + beforeText + ' → ' + scoreUs + ' - ' + scoreThem + noteText;
                containerElement.appendChild(logItem);
            } else if (action.type === 'rotation_adjust') {
                var logItem = document.createElement('div');
                logItem.className = 'log-item rotation-adjust';
                var adjustText = action.delta > 0 ? (Math.abs(action.delta) + 'つ進める') : (Math.abs(action.delta) + 'つ戻す');
                var noteText = action.note ? '：' + action.note : '';
                logItem.innerHTML = '🔄 ローテ修正：' + adjustText + ' (' + (action.scoreAt || (scoreUs + '-' + scoreThem)) + ')' + noteText;
                containerElement.appendChild(logItem);
            }
        }
    }

    function getPlayerStatSummary(p, statsData, nameMap, numberMap) {
        var d = statsData[p] || {};
        var ak = d.attack_kill || 0; var ae = d.attack_error || 0;
        var bk = d.block_kill || 0; var be = d.block_error || 0;
        var sa = d.serve_ace || 0; var se = d.serve_error || 0;
        var rcErr = d.reception_error || 0; var dgErr = d.dig_error || 0;
        var tsErr = d.toss_error || 0; var mcErr = d.miscommunication_error || 0; var otErr = d.other_error || 0;
        var vDr = d.v_dribble || 0; var vNt = d.v_net || 0;
        var vPs = d.v_passing || 0; var vPo = d.v_positional || 0;
        var vOv = d.v_over || 0; var vHl = d.v_hold || 0; var vBack = d.v_backrow || 0;
        var techErrors = rcErr + dgErr + tsErr + mcErr + otErr;
        var violations = vDr + vNt + vPs + vPo + vOv + vHl + vBack;
        var points = ak + bk + sa;
        return {
            id: p, name: getPlayerDisplayName(p, nameMap, numberMap), points: points,
            ak: ak, ae: ae, bk: bk, be: be, sa: sa, se: se,
            techErrors: techErrors, violations: violations
        };
    }

    function statPairHtml(good, bad) {
        return '<div class="stat-pair"><span class="stat-good">○' + good + '</span><span class="stat-bad">×' + bad + '</span></div>';
    }

    function getSortedStatSummaries(statsData, nameMap, numberMap) {
        var list = getStatsDisplayIds(statsData).map(function(p){ return getPlayerStatSummary(p, statsData, nameMap, numberMap); });
        list.sort(function(a, b) {
            if (a.id === 'team' && b.id !== 'team') return 1;
            if (b.id === 'team' && a.id !== 'team') return -1;
            if (a.id === 'us_team' && b.id !== 'us_team') return 1;
            if (b.id === 'us_team' && a.id !== 'us_team') return -1;
            if (b.points !== a.points) return b.points - a.points;
            var bErrors = b.techErrors + b.violations + b.ae + b.be + b.se;
            var aErrors = a.techErrors + a.violations + a.ae + a.be + a.se;
            if (aErrors !== bErrors) return aErrors - bErrors;
            return a.id.localeCompare(b.id, 'ja');
        });
        return list;
    }

    function renderTableRows(tbodyElement, statsData, nameMap, numberMap) {
        var list = getSortedStatSummaries(statsData, nameMap, numberMap);
        for (var j = 0; j < list.length; j++) {
            var s = list[j];
            var row = document.createElement('tr');
            if(s.id === 'team') row.className = 'opp-summary-row';
            if(s.id === 'us_team') row.className = 'own-summary-row';
            row.innerHTML = '<td style="font-weight:bold;">' + s.name + '</td>' +
                            '<td class="point-total">' + s.points + '</td>' +
                            '<td>' + statPairHtml(s.ak, s.ae) + '</td>' +
                            '<td>' + statPairHtml(s.bk, s.be) + '</td>' +
                            '<td>' + statPairHtml(s.sa, s.se) + '</td>' +
                            '<td><span class="num-red">' + s.techErrors + '</span></td>' +
                            '<td><span class="num-red">' + s.violations + '</span></td>';
            tbodyElement.appendChild(row);
        }
    }

    // 割合・分析計算ロジック
    function calculateAndDrawAnalysis(activeData, opponentLabel) {
        setAnalysisOpponentLabel(opponentLabel || '相手');

        // 1. <span class="self-team-text-label">清明</span>の得点内訳計算
        var usOwnPoint = 0; // 自力得点（清明のスパイク、ブロック、エース）
        for (var i = 1; i <= MAX_PLAYERS; i++) {
            var pd = activeData['p' + i] || {};
            usOwnPoint += (pd.attack_kill || 0) + (pd.block_kill || 0) + (pd.serve_ace || 0);
        }
        
        var oppData = activeData['team'] || {};
        // 相手の各種ミス、反則のすべて＝清明の得点になる
        var usPointFromOppErr = (oppData.attack_error || 0) + (oppData.block_error || 0) + (oppData.serve_error || 0) +
                                (oppData.reception_error || 0) + (oppData.dig_error || 0) + (oppData.toss_error || 0) + (oppData.miscommunication_error || 0) + (oppData.other_error || 0) +
                                (oppData.v_dribble || 0) + (oppData.v_net || 0) + (oppData.v_over || 0) + (oppData.v_passing || 0) + (oppData.v_positional || 0) + (oppData.v_hold || 0) + (oppData.v_backrow || 0);
        
        var totalUsScore = usOwnPoint + usPointFromOppErr;
        var usOwnPct = 0; var usOppErrPct = 0;
        if (totalUsScore > 0) {
            usOwnPct = Math.round((usOwnPoint / totalUsScore) * 100);
            usOppErrPct = 100 - usOwnPct;
        }

        document.getElementById('analysis-us-summary').innerText = totalUsScore + '点 (自力 ' + usOwnPct + '% : 相手ミス ' + usOppErrPct + '%)';
        document.getElementById('bar-us-own').style.width = usOwnPct + '%';
        document.getElementById('bar-us-opp-err').style.width = usOppErrPct + '%';

        // 2. 相手チームの得点内訳計算
        // 相手の自力得点（相手のアタック決定、ブロック決定、エース）
        var themOwnPoint = (oppData.attack_kill || 0) + (oppData.block_kill || 0) + (oppData.serve_ace || 0);
        
        // 清明の各種ミス、反則のすべて＝相手チームの得点になる
        var themPointFromUsErr = 0;
        for (var i = 1; i <= MAX_PLAYERS; i++) {
            var pd = activeData['p' + i] || {};
            themPointFromUsErr += (pd.attack_error || 0) + (pd.block_error || 0) + (pd.serve_error || 0) +
                                  (pd.reception_error || 0) + (pd.dig_error || 0) + (pd.toss_error || 0) + (pd.miscommunication_error || 0) + (pd.other_error || 0) +
                                  (pd.v_dribble || 0) + (pd.v_net || 0) + (pd.v_over || 0) + (pd.v_passing || 0) + (pd.v_positional || 0) + (pd.v_hold || 0) + (pd.v_backrow || 0);
        }

        var totalThemScore = themOwnPoint + themPointFromUsErr;
        var themOwnPct = 0; var themUsErrPct = 0;
        if (totalThemScore > 0) {
            themOwnPct = Math.round((themOwnPoint / totalThemScore) * 100);
            themUsErrPct = 100 - themOwnPct;
        }

        document.getElementById('analysis-them-summary').innerText = totalThemScore + '点 (自力 ' + themOwnPct + '% : ' + (selfTeamName || '清明') + 'ミス ' + themUsErrPct + '%)';
        document.getElementById('bar-them-opp').style.width = themOwnPct + '%';
        document.getElementById('bar-them-own-err').style.width = themUsErrPct + '%';
    }

    function clearArchive() {
        if(confirm('🚨 これまでに保存した過去のアーカイブデータを【すべて削除】しますか？\n（現在のセットデータは消えません）')) {
            globalArchive = [];
            saveStorage();
            buildArchiveDaySelect();
        }
    }

    function switchView(view) {
        currentView = view;
        var tabs = document.getElementsByClassName('tab');
        for (var i = 0; i < tabs.length; i++) { tabs[i].classList.remove('active'); }
        document.getElementById('tab-' + view).classList.add('active');
        updateUI();
    }

    function isStandardSetEndReady(scoreUs, scoreThem) {
        var maxScore = Math.max(scoreUs || 0, scoreThem || 0);
        var diff = Math.abs((scoreUs || 0) - (scoreThem || 0));
        return maxScore >= 25 && diff >= 2;
    }

    function updateSetFinishButtonState(scoreUs, scoreThem) {
        var btn = document.getElementById('set-finish-btn');
        var usScoreEl = document.getElementById('score-us');
        var themScoreEl = document.getElementById('score-them');
        if (btn) {
            btn.classList.remove('set-end-ready');
            btn.innerText = 'セット終了';
            btn.title = '手動でセット終了できます';
        }
        if (usScoreEl) usScoreEl.classList.remove('set-winner-ready');
        if (themScoreEl) themScoreEl.classList.remove('set-winner-ready');

        var ready = isStandardSetEndReady(scoreUs, scoreThem);
        if (!ready) return;

        if (btn) btn.title = '25点以上かつ2点差以上：セット終了条件達成';
        if (scoreUs > scoreThem && usScoreEl) {
            usScoreEl.classList.add('set-winner-ready');
        } else if (scoreThem > scoreUs && themScoreEl) {
            themScoreEl.classList.add('set-winner-ready');
        }
    }

    function updateUI() {
        var currentSetEl = document.getElementById('current-set-num');
        if (currentSetEl) currentSetEl.innerText = currentSet;
        var matchContextEl = document.getElementById('match-context-display');
        if (matchContextEl) matchContextEl.innerText = getMatchLabel();
        var scoreUs = 0, scoreThem = 0;
        var logContainer = document.getElementById('running-score-log');
        logContainer.innerHTML = ''; 

        var toUsEl = document.getElementById('to-us-count');
        var toThemEl = document.getElementById('to-them-count');
        var subUsEl = document.getElementById('sub-us-count');
        var subThemEl = document.getElementById('sub-them-count');
        toUsEl.innerText = timeoutCount.us;
        toThemEl.innerText = timeoutCount.them;
        subUsEl.innerText = subCount.us;
        subThemEl.innerText = subCount.them;
        toUsEl.classList.toggle('count-alert', timeoutCount.us >= 2);
        toThemEl.classList.toggle('count-alert', timeoutCount.them >= 2);
        subUsEl.classList.toggle('count-alert', subCount.us >= 5);
        subThemEl.classList.toggle('count-alert', subCount.them >= 5);

        var historyDisplay = document.getElementById('set-history-display');
        if (setResults && setResults.length > 0) {
            historyDisplay.innerHTML = setResults.map(function(r) { 
                var mark = '-';
                if (r.us > r.them) { mark = '○'; } else if (r.us < r.them) { mark = '●'; }
                var rLabel = r.matchLabel ? (r.matchLabel + ' ') : '';
                return '<div class="history-item">' + rLabel + '第' + r.set + 'S vs' + r.opp + ' <b>[' + r.us + '-' + r.them + ']</b> ' + mark + '</div>'; 
            }).join('');
            historyDisplay.scrollTop = historyDisplay.scrollHeight;
        } else { 
            historyDisplay.innerHTML = '<div style="color:#aaa; text-align:center; padding-top:10px;">履歴なし</div>'; 
        }

        var currentRotationState = Object.assign({}, startingLineup);
        var currentServerState = (startSideSetting === 'S'); 
        var isFirstPointAfterReceiveStart = (startSideSetting === 'R');

        for (var i = 0; i < historyLog.length; i++) {
            var action = historyLog[i];
            if (action.type === 'stat') {
                var item = action.item; 
                var isUsAction = (action.player !== 'team'); 
                var isPositive = ['attack_kill', 'block_kill', 'serve_ace'].includes(item);
                var isUsPoint = isUsAction ? isPositive : !isPositive;
                
                if (isUsPoint) { 
                    scoreUs++; 
                    if (currentServerState === false) {
                        currentRotationState = computeRotateClockwise(currentRotationState);
                        currentServerState = true; 
                        if (isFirstPointAfterReceiveStart) {
                            isFirstPointAfterReceiveStart = false; 
                        }
                    }
                } else { 
                    scoreThem++; 
                    if (currentServerState === true) {
                        currentServerState = false; 
                        if (isFirstPointAfterReceiveStart) {
                            isFirstPointAfterReceiveStart = false;
                        }
                    }
                }

                var logItem = document.createElement('div');
                logItem.className = 'log-item editable-log ' + (isUsPoint ? 'us' : 'them');
                logItem.onclick = (function(idx){ return function(){ editLogAt(idx); }; })(i);
                
                var dispPlayerName = getPlayerDisplayName(action.player);
                if (action.player !== 'team') {
                    dispPlayerName = '<span style="color: #7dd3fc; font-weight: 600;">' + dispPlayerName + '</span>';
                }
                
                logItem.innerHTML = '<strong>[' + scoreUs + ' - ' + scoreThem + ']</strong> ' + dispPlayerName + ' : ' + getLabel(item, isUsAction) + '<span class="log-actions-hint">編集</span>';
                logContainer.appendChild(logItem);
            } else if (action.type === 'timeout') {
                var logItem = document.createElement('div'); logItem.className = 'log-item timeout editable-log';
                logItem.onclick = (function(idx){ return function(){ editLogAt(idx); }; })(i);
                var teamName = action.team === 'us' ? selfTeamName : oppTeamName;
                logItem.innerHTML = '⏳ T.O: ' + teamName + ' (' + action.scoreAt + ')' + '<span class="log-actions-hint">編集</span>';
                logContainer.appendChild(logItem);
            } else if (action.type === 'substitution') {
                if (action.team === 'us' && action.outPlayer && action.inPlayer) {
                    for (var posKey in currentRotationState) {
                        if (currentRotationState[posKey] === action.outPlayer) currentRotationState[posKey] = action.inPlayer;
                    }
                }
                var logItem = document.createElement('div'); logItem.className = 'log-item substitution editable-log';
                logItem.onclick = (function(idx){ return function(){ editLogAt(idx); }; })(i);
                var teamName = action.team === 'us' ? selfTeamName : oppTeamName;
                var detail = '';
                if (action.team === 'us' && action.outPlayer && action.inPlayer) detail = '：' + getPlayerDisplayName(action.outPlayer) + ' → ' + getPlayerDisplayName(action.inPlayer);
                if (action.team !== 'us' && action.note) detail = '：' + action.note;
                logItem.innerHTML = '🔄 交代: ' + teamName + detail + ' (' + action.scoreAt + ')' + '<span class="log-actions-hint">編集</span>';
                logContainer.appendChild(logItem);
            } else if (action.type === 'score_adjust') {
                var beforeText = (action.fromUs || 0) + ' - ' + (action.fromThem || 0);
                scoreUs = Math.max(0, parseInt(action.toUs, 10) || 0);
                scoreThem = Math.max(0, parseInt(action.toThem, 10) || 0);
                var logItem = document.createElement('div'); logItem.className = 'log-item score-adjust editable-log';
                logItem.onclick = (function(idx){ return function(){ editLogAt(idx); }; })(i);
                var noteText = action.note ? '：' + action.note : '';
                logItem.innerHTML = '<strong>[' + scoreUs + ' - ' + scoreThem + ']</strong> ⚙ 得点修正 ' + beforeText + ' → ' + scoreUs + ' - ' + scoreThem + noteText + '<span class="log-actions-hint">編集</span>';
                logContainer.appendChild(logItem);
            } else if (action.type === 'rotation_adjust') {
                currentRotationState = applyRotationAdjustmentToState(currentRotationState, action.delta);
                var logItem = document.createElement('div');
                logItem.className = 'log-item rotation-adjust';
                var adjustText = action.delta > 0 ? (Math.abs(action.delta) + 'つ進める') : (Math.abs(action.delta) + 'つ戻す');
                var noteText = action.note ? '：' + action.note : '';
                logItem.innerHTML = '🔄 ローテ修正：' + adjustText + ' (' + (action.scoreAt || (scoreUs + '-' + scoreThem)) + ')' + noteText;
                logContainer.appendChild(logItem);
            }
        }

        hasServeAuthority = currentServerState;
        document.getElementById('score-us').innerText = scoreUs;
        document.getElementById('score-them').innerText = scoreThem;
        updateSetFinishButtonState(scoreUs, scoreThem);
        logContainer.scrollTop = logContainer.scrollHeight;

        drawCourt(currentRotationState);
        drawStartingLineupBox();

        var activeData = (currentView === 'today') ? todayData : (currentView === 'all' ? allData : setData);
        var activeNameMap = getCurrentStatsNameMap();
        var tbody = document.getElementById('stats-tbody'); tbody.innerHTML = ''; 
        renderTableRows(tbody, activeData, activeNameMap, playerNumbers);

        // 割合分析表示を更新
        calculateAndDrawAnalysis(activeData, getCurrentAnalysisOpponentLabel());

        activePlayerHighlightFix(selectedPlayer);
        saveStorage(); 
    }

    function csvEscape(value) {
        var s = String(value === undefined || value === null ? '' : value);
        return '"' + s.replace(/"/g, '""') + '"';
    }

    function downloadTextFile(filename, content, mimeType) {
        var blob = new Blob(['\ufeff' + content], { type: mimeType || 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename; document.body.appendChild(a); a.click();
        document.body.removeChild(a); URL.revokeObjectURL(url);
    }

    function statsToCsvRows(statsData, nameMap, numberMap) {
        var rows = [['選手名','得点','スパイク○得点','スパイク×ミス','ブロック○決定','ブロック×ミス','サーブ○エース','サーブ×ミス','ミス合計','反則合計']];
        var list = getSortedStatSummaries(statsData, nameMap, numberMap);
        for (var j=0; j<list.length; j++) {
            var s = list[j];
            rows.push([s.name, s.points, s.ak, s.ae, s.bk, s.be, s.sa, s.se, s.techErrors, s.violations]);
        }
        return rows;
    }

    function rowsToCsv(rows) { return rows.map(function(r){ return r.map(csvEscape).join(','); }).join('\n'); }

    function exportActiveStatsCSV() {
        var activeData = (currentView === 'today') ? todayData : (currentView === 'all' ? allData : setData);
        var label = currentView === 'set' ? '現セット' : (currentView === 'today' ? '本日通算' : '全通算');
        var activeNameMap = getCurrentStatsNameMap();
        var opponentLabel = getCurrentAnalysisOpponentLabel();
        var rows = [[getAppFullTitle(), label, '第' + currentSet + 'セット', 'vs ' + opponentLabel], []].concat(statsToCsvRows(activeData, activeNameMap, playerNumbers));
        downloadTextFile('seimei_volleyball_stats_' + label + '.csv', rowsToCsv(rows), 'text/csv;charset=utf-8;');
    }

    function exportArchiveDayCSV() {
        var dayVal = document.getElementById('archive-day-select').value;
        if (!dayVal) { alert('先に日付を選択してください。'); return; }
        var daySets = globalArchive.filter(function(x){ return x.date === dayVal; });
        if (daySets.length === 0) { alert('出力できるデータがありません。'); return; }
        var aggregatedStats = createEmptyStats();
        var namesSnap = getArchiveTotalNameMap(daySets, daySets[daySets.length-1].playerNamesSnap || playerNames);
        for(var k=0; k<daySets.length; k++) {
            var sData = daySets[k].statsSnap;
            for(var pKey in sData) for(var sKey in sData[pKey]) aggregatedStats[pKey][sKey] += (sData[pKey][sKey] || 0);
        }
        var rows = [[getAppFullTitle(),'アーカイブ1日合計',dayVal,'計' + daySets.length + 'セット'], []].concat(statsToCsvRows(aggregatedStats, namesSnap, daySets[daySets.length-1].playerNumbersSnap || playerNumbers));
        downloadTextFile('seimei_volleyball_archive_' + dayVal.replace(/\//g,'-') + '.csv', rowsToCsv(rows), 'text/csv;charset=utf-8;');
    }

    function tableHtmlFromStats(statsData, nameMap) {
        var rows = statsToCsvRows(statsData, nameMap, playerNumbers);
        var html = '<table><thead><tr>' + rows[0].map(function(h){return '<th>'+h+'</th>';}).join('') + '</tr></thead><tbody>';
        for (var i=1; i<rows.length; i++) html += '<tr>' + rows[i].map(function(c){return '<td>'+c+'</td>';}).join('') + '</tr>';
        return html + '</tbody></table>';
    }

    function runningLogHtml() {
        var div = document.createElement('div');
        var scoreUs = 0, scoreThem = 0;
        for (var i=0; i<historyLog.length; i++) {
            var a = historyLog[i];
            var line = '';
            if (a.type === 'stat') {
                var isUsAction = (a.player !== 'team');
                var isPositive = ['attack_kill','block_kill','serve_ace'].includes(a.item);
                var isUsPoint = isUsAction ? isPositive : !isPositive;
                if (isUsPoint) scoreUs++; else scoreThem++;
                line = '[' + scoreUs + '-' + scoreThem + '] ' + getPlayerDisplayName(a.player) + ' : ' + getLabel(a.item, isUsAction);
            } else if (a.type === 'timeout') {
                line = 'T.O: ' + (a.team === 'us' ? selfTeamName : oppTeamName) + ' (' + a.scoreAt + ')';
            } else if (a.type === 'substitution') {
                var detail = '';
                if (a.team === 'us' && a.outPlayer && a.inPlayer) detail = '：' + getPlayerDisplayName(a.outPlayer) + ' → ' + getPlayerDisplayName(a.inPlayer);
                if (a.team !== 'us' && a.note) detail = '：' + a.note;
                line = '交代: ' + (a.team === 'us' ? selfTeamName : oppTeamName) + detail + ' (' + a.scoreAt + ')';
            } else if (a.type === 'score_adjust') {
                var beforeText = (a.fromUs || 0) + '-' + (a.fromThem || 0);
                scoreUs = Math.max(0, parseInt(a.toUs, 10) || 0);
                scoreThem = Math.max(0, parseInt(a.toThem, 10) || 0);
                line = '[' + scoreUs + '-' + scoreThem + '] 得点修正 ' + beforeText + ' → ' + scoreUs + '-' + scoreThem + (a.note ? '：' + a.note : '');
            } else if (a.type === 'rotation_adjust') {
                var adjustText = a.delta > 0 ? (Math.abs(a.delta) + 'つ進める') : (Math.abs(a.delta) + 'つ戻す');
                line = 'ローテ修正：' + adjustText + ' (' + (a.scoreAt || (scoreUs + '-' + scoreThem)) + ')' + (a.note ? '：' + a.note : '');
            }
            div.innerHTML += '<div class="print-log">' + line + '</div>';
        }
        return div.innerHTML;
    }

    function openPrintView() {
        var activeData = (currentView === 'today') ? todayData : (currentView === 'all' ? allData : setData);
        var label = currentView === 'set' ? '現セット' : (currentView === 'today' ? '本日通算' : '全通算');
        var activeNameMap = getCurrentStatsNameMap();
        var opponentLabel = getCurrentAnalysisOpponentLabel();
        var html = '<html><head><title>SEIMEI Volleyball Report</title><style>body{font-family:Arial,sans-serif;padding:20px;}h1,h2{color:#1e3a8a;}table{width:100%;border-collapse:collapse;font-size:12px;}th,td{border:1px solid #999;padding:6px;text-align:left;}th{background:#f3f4f6}.print-log{border-bottom:1px solid #ddd;padding:4px;font-size:12px;}</style></head><body>' +
            '<h1>' + getAppFullTitle() + '</h1><h2>' + label + ' / 第' + currentSet + 'セット / vs ' + opponentLabel + '</h2>' +
            '<h3>スタッツ集計</h3>' + tableHtmlFromStats(activeData, activeNameMap) + '<h3>ランニングスコア</h3>' + runningLogHtml() +
            '<script>window.onload=function(){window.print();}<\/script></body></html><!-- Ver.1.2.27 match-management -->';
        var w = window.open('', '_blank'); w.document.open(); w.document.write(html); w.document.close();
    }

    function openArchivePrintView() {
        var dayVal = document.getElementById('archive-day-select').value;
        if (!dayVal) { alert('先に日付を選択してください。'); return; }
        viewArchiveDayTotal();
        var printContents = document.getElementById('archive-display-area').innerHTML;
        var html = '<html><head><title>Archive Report</title><style>body{font-family:Arial,sans-serif;padding:20px;}h4,h5{color:#1e3a8a;}table{width:100%;border-collapse:collapse;font-size:12px;}th,td{border:1px solid #999;padding:6px;text-align:left;}th{background:#f3f4f6}.log-container{display:none;}</style></head><body>' + printContents + '<script>window.onload=function(){window.print();}<\/script></body></html><!-- Ver.1.2.27 match-management -->';
        var w = window.open('', '_blank'); w.document.open(); w.document.write(html); w.document.close();
    }

    function getLabel(item, isUsAction) {
        return getLabelWithMap(item, isUsAction, playerNames);
    }

    function getLabelWithMap(item, isUsAction, nameMap) {
        var labels = {
            attack_kill: 'スパイク', attack_error: 'スパイクミス', block_kill: 'ブロック', block_error: 'ブロックミス',
            serve_ace: 'サービスエース', serve_error: 'サーブミス', reception_error: 'レセプションミス', dig_error: 'ディグミス', toss_error: 'トスミス', miscommunication_error: 'ミスコミュニケーション', other_error: 'その他のミス',
            v_dribble: 'ドリブル', v_net: 'タッチネット', v_over: 'オーバーネット', v_passing: 'パッシングザセンターライン', v_positional: 'ポジショナルフォールト', v_hold: 'ホールディング', v_backrow: 'バックプレー'
        };
        if (!isUsAction) {
            if (item === 'attack_kill') return 'スパイク';
            if (item === 'serve_ace') return 'サービスエース';
            if (item === 'block_kill') return 'ブロック';
            return labels[item] || item;
        }
        return labels[item] || item;
    }


    function buildAppDataBackup() {
        return {
            appName: getAppFullTitle(),
            appVersion: 'tablet-dark-data-zip-v1.2.39',
            exportedAt: new Date().toISOString(),
            matchType: matchType,
            officialMatchNumber: officialMatchNumber,
            matchDateKey: matchDateKey,
            currentSet: currentSet,
            historyLog: historyLog,
            timeoutCount: timeoutCount,
            subCount: subCount,
            setResults: setResults,
            globalArchive: globalArchive,
            autoBackups: autoBackups,
            playerNames: playerNames,
            playerNumbers: playerNumbers,
            playerVisible: playerVisible,
            selectedPlayer: selectedPlayer,
            oppTeamName: oppTeamName,
            appTitlePrefix: appTitlePrefix,
            selfTeamName: selfTeamName,
            startingLineup: startingLineup,
            startSideSetting: startSideSetting,
            hasServeAuthority: hasServeAuthority,
            setData: setData,
            todayData: todayData,
            allData: allData,
            currentView: currentView
        };
    }


    function createAutoBackup(label) {
        try {
            var snapshot = buildAppDataBackup();
            snapshot.autoBackups = [];
            var item = {
                id: 'backup_' + Date.now(),
                label: label || '自動バックアップ',
                createdAt: new Date().toISOString(),
                summary: label || '',
                data: snapshot
            };
            autoBackups.unshift(item);
            if (autoBackups.length > 30) autoBackups = autoBackups.slice(0, 30);
            localStorage.setItem('vball_autoBackups_s', JSON.stringify(autoBackups));
            updateAutoBackupUI();
        } catch (err) {
            console.warn('Auto backup failed:', err);
        }
    }

    function updateAutoBackupUI() {
        var countEl = document.getElementById('auto-backup-count');
        var listEl = document.getElementById('auto-backup-list');
        if (countEl) countEl.innerText = Array.isArray(autoBackups) ? autoBackups.length : 0;
        if (!listEl) return;
        if (!Array.isArray(autoBackups) || autoBackups.length === 0) {
            listEl.innerHTML = '<div style="color:#64748b;text-align:center;">バックアップなし</div>';
            return;
        }
        listEl.innerHTML = autoBackups.slice(0, 10).map(function(b){
            var d = b.createdAt ? new Date(b.createdAt) : null;
            var time = d && !isNaN(d.getTime()) ? (d.getFullYear() + '/' + (d.getMonth()+1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0')) : '';
            return '<div class="backup-item"><b>' + (time || '日時不明') + '</b><br>' + (b.label || b.summary || '自動バックアップ') + '</div>';
        }).join('');
    }

    function exportAppDataZIP() {
        // 外部ライブラリなしで安定運用するため、内容は復元可能なJSONとして保存します。
        // ZIPボタンからも同じ完全バックアップを取得できます。
        exportAppDataJSON();
    }

    function importAppDataFile(event) {
        var file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!file) return;
        if (/\.zip$/i.test(file.name)) {
            alert('この修正版では安全のためZIP直接読み込みではなく、JSONバックアップを読み込んでください。');
            return;
        }
        importAppDataJSON({ target: { files: [file], value: '' } });
    }

    function exportAppDataJSON() {
        var data = buildAppDataBackup();
        var now = new Date();
        var stamp = now.getFullYear().toString() +
            String(now.getMonth() + 1).padStart(2, '0') +
            String(now.getDate()).padStart(2, '0') + '_' +
            String(now.getHours()).padStart(2, '0') +
            String(now.getMinutes()).padStart(2, '0');
        var filename = 'seimei_volleyball_backup_' + stamp + '.json';
        downloadTextFile(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8;');
    }

    function normalizeImportedStats(stats) {
        var base = createEmptyStats();
        if (!stats) return base;
        for (var pKey in base) {
            if (!stats[pKey]) continue;
            for (var sKey in base[pKey]) {
                base[pKey][sKey] = Number(stats[pKey][sKey] || 0);
            }
        }
        return base;
    }

    function applyImportedAppData(data) {
        if (!data || typeof data !== 'object') throw new Error('データ形式が正しくありません。');
        if (data.appName && String(data.appName).indexOf('Volleyball Tracker') === -1) {
            if (!confirm('このファイルは別アプリのデータの可能性があります。読み込みを続けますか？')) return;
        }

        currentSet = Number(data.currentSet || 1);
        historyLog = Array.isArray(data.historyLog) ? data.historyLog : [];
        timeoutCount = data.timeoutCount || { us: 0, them: 0 };
        subCount = data.subCount || { us: 0, them: 0 };
        setResults = Array.isArray(data.setResults) ? data.setResults : [];
        globalArchive = Array.isArray(data.globalArchive) ? data.globalArchive : [];
        autoBackups = Array.isArray(data.autoBackups) ? data.autoBackups : [];
        playerNames = normalizePlayerNames(data.playerNames || playerNames);
        playerNumbers = normalizePlayerNumbers(data.playerNumbers || playerNumbers);
        playerVisible = normalizePlayerVisible(data.playerVisible || playerVisible);
        if (!playerNames.us_team) playerNames.us_team = '自チーム(全体)';
        if (!playerNames.team) playerNames.team = '相手チーム(全体)';
        selectedPlayer = data.selectedPlayer || 'p1';
        oppTeamName = data.oppTeamName || (playerNames.team || '相手').replace('(全体)', '') || '相手';
        appTitlePrefix = data.appTitlePrefix || appTitlePrefix || 'SEIMEI HS';
        selfTeamName = data.selfTeamName || selfTeamName || '清明';
        matchType = data.matchType || matchType || 'practice';
        officialMatchNumber = parseInt(data.officialMatchNumber || officialMatchNumber || 1, 10) || 1;
        matchDateKey = data.matchDateKey || matchDateKey || getTodayKey();
        startingLineup = data.startingLineup || { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' };
        startSideSetting = data.startSideSetting || 'S';
        hasServeAuthority = data.hasServeAuthority !== false;
        setData = normalizeImportedStats(data.setData);
        todayData = normalizeImportedStats(data.todayData);
        allData = normalizeImportedStats(data.allData);
        currentView = data.currentView || 'set';

        saveStorage();
        initSetup();
        switchView(currentView);
        updateUI();
        closeModal('dataModal');
        alert('データを読み込みました。');
    }

    function importAppDataJSON(event) {
        var file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!file) return;
        if (!confirm('現在のブラウザ内データを、選択したファイルの内容で上書きします。よろしいですか？')) return;

        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var data = JSON.parse(e.target.result);
                applyImportedAppData(data);
            } catch (err) {
                alert('読み込みに失敗しました。JSONファイルの形式を確認してください。\n' + err.message);
            }
        };
        reader.onerror = function() { alert('ファイルを読み込めませんでした。'); };
        reader.readAsText(file, 'utf-8');
    }


    function exportRosterCSV() {
        var rows = [['登録番号','表示','背番号','氏名']];
        for (var i = 1; i <= MAX_PLAYERS; i++) {
            var id = 'p' + i;
            rows.push([i, isPlayerVisible(id) ? '1' : '0', playerNumbers[id] || String(i), playerNames[id] || '']);
        }
        downloadTextFile('volleyball_roster.csv', rowsToCsv(rows), 'text/csv;charset=utf-8;');
    }

    function parseCsvText(text) {
        var rows = [];
        var row = [];
        var cell = '';
        var inQuotes = false;
        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            var code = text.charCodeAt(i);
            if (inQuotes) {
                if (ch === '"') {
                    if (text[i + 1] === '"') { cell += '"'; i++; }
                    else { inQuotes = false; }
                } else {
                    cell += ch;
                }
            } else {
                if (ch === '"') inQuotes = true;
                else if (ch === ',') { row.push(cell); cell = ''; }
                else if (code === 10) { row.push(cell); rows.push(row); row = []; cell = ''; }
                else if (code === 13) { /* skip */ }
                else cell += ch;
            }
        }
        if (cell.length || row.length) { row.push(cell); rows.push(row); }
        return rows;
    }

    function normalizeRosterVisibleValue(value) {
        var v = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
        return ['1','true','on','yes','y','表示','○','〇','あり','有'].includes(v);
    }

    function importRosterCSV(event) {
        var file = event.target.files && event.target.files[0];
        event.target.value = '';
        if (!file) return;
        if (!confirm('名簿CSVを読み込みます。登録番号に対応する背番号・氏名・表示チェックを上書きします。よろしいですか？')) return;
        var reader = new FileReader();
        reader.onload = function(e) {
            try {
                var text = String(e.target.result || '').replace(/^﻿/, '');
                var rows = parseCsvText(text).filter(function(r){ return r.some(function(c){ return String(c).trim() !== ''; }); });
                if (rows.length < 2) throw new Error('CSVにデータ行がありません。');
                var start = 0;
                if (String(rows[0][0] || '').indexOf('登録') !== -1 || String(rows[0][0] || '').toLowerCase() === 'id') start = 1;
                var changed = 0;
                for (var r = start; r < rows.length; r++) {
                    var row = rows[r];
                    var reg = parseInt(String(row[0] || '').replace(/[^0-9]/g, ''), 10);
                    if (!reg || reg < 1 || reg > MAX_PLAYERS) continue;
                    var id = 'p' + reg;
                    playerVisible[id] = normalizeRosterVisibleValue(row[1]);
                    if (row[2] !== undefined && String(row[2]).trim() !== '') playerNumbers[id] = String(row[2]).trim();
                    if (row[3] !== undefined && String(row[3]).trim() !== '') playerNames[id] = String(row[3]).trim();
                    changed++;
                }
                if (changed === 0) throw new Error('読み込める登録番号がありませんでした。');
                playerNames = normalizePlayerNames(playerNames);
                playerNumbers = normalizePlayerNumbers(playerNumbers);
                playerVisible = normalizePlayerVisible(playerVisible);
                saveStorage();
                initSetup();
                updateUI();
                alert('名簿CSVを読み込みました。更新件数：' + changed + '件');
            } catch (err) {
                alert('名簿CSVの読み込みに失敗しました。\n' + err.message);
            }
        };
        reader.onerror = function(){ alert('CSVファイルを読み込めませんでした。'); };
        reader.readAsText(file, 'utf-8');
    }

    function resetAll() {
        if (confirm('⚠️【完全にリセットします】選手名、現在のデータ、過去のすべてのアーカイブが消去されます。よろしいですか？')) {
            localStorage.clear(); currentSet = 1; document.getElementById('current-set-num').innerText = currentSet;
            setData = createEmptyStats(); todayData = createEmptyStats(); allData = createEmptyStats();
            startingLineup = { 1: 'p1', 2: 'p2', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'p6' };
            startSideSetting = 'S'; hasServeAuthority = true; oppTeamName = '相手'; appTitlePrefix = 'SEIMEI HS'; selfTeamName = '清明'; matchType = 'practice'; officialMatchNumber = 1; matchDateKey = getTodayKey();
            playerVisible = normalizePlayerVisible(null);
            historyLog = []; setResults = []; timeoutCount = { us: 0, them: 0 }; subCount = { us: 0, them: 0 }; globalArchive = []; autoBackups = [];
            switchView('set'); initSetup(); updateUI();
        }
    }


    function registerPWAServiceWorker() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
                navigator.serviceWorker.register('./service-worker.js')
                    .then(function(reg) { console.log('Service Worker registered:', reg.scope); })
                    .catch(function(err) { console.log('Service Worker registration failed:', err); });
            });
        }
    }
    registerPWAServiceWorker();

    initSetup(); updateUI();
