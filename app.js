(function(){
  const TIER1_COLOR = '#ff2f7e';
  const TIER2_COLOR = '#5e1138';
  const NUM_MAZES = 2;

  let tier1 = [], tier2 = [], mazes = [];
  let schedule = [];
  let revealed = new Set();
  let currentView = 'team';
  let activeTeam = null;

  let phaseStartMin = 10 * 60;
  let matchMin = 5;
  let breatheMin = 1;
  let slotCount = 6;

  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }
  function initials(name){
    return name.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join('').toUpperCase().slice(0,2) || '?';
  }
  function colorFor(team){ return tier1.includes(team) ? TIER1_COLOR : TIER2_COLOR; }
  function tierLabel(team){ return tier1.includes(team) ? 'Tier 1' : 'Tier 2'; }

  function fmt(min){
    min = ((Math.round(min) % 1440) + 1440) % 1440;
    const h = Math.floor(min/60), m = min%60;
    return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0');
  }
  function slotStartMin(slot){ return phaseStartMin + slot * (matchMin + breatheMin); }
  function timeLabel(m){ return fmt(m.startMin) + '–' + fmt(m.endMin); }
  function applyClock(){
    slotCount = 0;
    schedule.forEach(m=>{
      m.startMin = slotStartMin(m.timeSlot);
      m.endMin   = m.startMin + matchMin;
      slotCount  = Math.max(slotCount, m.timeSlot + 1);
    });
  }
  function phaseSpanLabel(){
    if(!schedule.length) return '';
    const start = phaseStartMin;
    const end = slotStartMin(slotCount-1) + matchMin;
    return fmt(start) + '–' + fmt(end) + '  ·  ' + (end-start) + ' min total';
  }

  function buildSetupInputs(){
    const t1box = document.getElementById('tier1-inputs');
    const t2box = document.getElementById('tier2-inputs');
    const mazeBox = document.getElementById('maze-inputs');
    t1box.innerHTML=''; t2box.innerHTML=''; mazeBox.innerHTML='';
    for(let i=0;i<6;i++){
      const inp = document.createElement('input');
      inp.className='team-input'; inp.placeholder='Tier 1 team '+(i+1); inp.id='t1-'+i;
      t1box.appendChild(inp);
    }
    for(let i=0;i<6;i++){
      const inp = document.createElement('input');
      inp.className='team-input'; inp.placeholder='Tier 2 team '+(i+1); inp.id='t2-'+i;
      t2box.appendChild(inp);
    }
    const defMazes = ['Maze A','Maze B'];
    for(let i=0;i<NUM_MAZES;i++){
      const inp = document.createElement('input');
      inp.className='maze-input'; inp.placeholder=defMazes[i]; inp.id='maze-'+i;
      mazeBox.appendChild(inp);
    }
  }
  buildSetupInputs();

  function parseSheetText(text){
    const rows = String(text).replace(/\r/g, '')
      .split('\n')
      .map(line => line.split('\t').map(c => c.trim()))
      .filter(cells => cells.some(c => c.length));
    if(rows.length && rows[0].some(c => /tier\s*[12]|team|name/i.test(c))){
      rows.shift();
    }
    const maxCols = rows.reduce((m,r)=> Math.max(m, r.length), 0);
    let t1 = [], t2 = [];
    if(maxCols >= 2){
      rows.forEach(r => { if(r[0]) t1.push(r[0]); if(r[1]) t2.push(r[1]); });
    } else {
      const all = rows.map(r => r[0]).filter(Boolean);
      t1 = all.slice(0, 6);
      t2 = all.slice(6, 12);
    }
    return { t1, t2 };
  }

  function applyImport(text){
    const statusEl = document.getElementById('import-status');
    const { t1, t2 } = parseSheetText(text);
    if(t1.length === 0 && t2.length === 0){
      statusEl.className = 'import-status mono';
      statusEl.textContent = 'Nothing to import';
      return;
    }
    for(let i=0;i<6;i++){
      document.getElementById('t1-'+i).value = t1[i] || '';
      document.getElementById('t2-'+i).value = t2[i] || '';
    }
    const extra = (t1.length > 6 || t2.length > 6) ? ' (extra rows ignored)' : '';
    statusEl.className = 'import-status mono ok';
    statusEl.textContent = 'Filled ' + Math.min(t1.length,6) + ' + ' + Math.min(t2.length,6) + ' names' + extra;
    document.getElementById('setup-error').textContent = '';
  }

  const importArea = document.getElementById('import-area');
  document.getElementById('btn-import').addEventListener('click', ()=> applyImport(importArea.value));
  document.getElementById('btn-import-clear').addEventListener('click', ()=>{
    importArea.value = '';
    const statusEl = document.getElementById('import-status');
    statusEl.className = 'import-status mono';
    statusEl.textContent = '';
  });
  importArea.addEventListener('paste', (ev)=>{
    const text = (ev.clipboardData || window.clipboardData).getData('text');
    if(text){
      ev.preventDefault();
      importArea.value = text;
      applyImport(text);
    }
  });

  document.getElementById('btn-generate').addEventListener('click', ()=>{
    const errBox = document.getElementById('setup-error');
    const t1 = [], t2 = [];
    for(let i=0;i<6;i++) t1.push(document.getElementById('t1-'+i).value.trim());
    for(let i=0;i<6;i++) t2.push(document.getElementById('t2-'+i).value.trim());
    const defMazes = ['Maze A','Maze B'];
    const mz = [];
    for(let i=0;i<NUM_MAZES;i++){
      const v = document.getElementById('maze-'+i).value.trim();
      mz.push(v || defMazes[i]);
    }
    if(t1.some(n=>!n) || t2.some(n=>!n)){
      errBox.textContent = 'Fill in all 12 team names before starting the draw.';
      return;
    }
    const all = [...t1, ...t2];
    if(new Set(all.map(n=>n.toLowerCase())).size !== 12){
      errBox.textContent = 'Team names need to be unique — two teams share a name.';
      return;
    }
    if(new Set(mz.map(m=>m.toLowerCase())).size !== NUM_MAZES){
      errBox.textContent = 'Maze names need to be unique.';
      return;
    }
    const startVal = document.getElementById('phase-start').value || '10:00';
    const parts = startVal.split(':').map(Number);
    phaseStartMin = (parts[0]||0)*60 + (parts[1]||0);
    matchMin   = Math.max(1, parseInt(document.getElementById('match-min').value, 10) || 5);
    breatheMin = Math.max(0, parseInt(document.getElementById('breathe-min').value, 10) || 0);
    errBox.textContent = '';
    tier1 = t1; tier2 = t2; mazes = mz;
    schedule = generateSchedule(tier1, tier2, mazes);
    applyClock();
    revealed = new Set();
    activeTeam = null;
    currentView = 'team';
    goToScreen('draw');
    renderDrawScreen();
  });

  function generateSchedule(t1, t2, mazeNames){
    for(let attempt=0; attempt<400; attempt++){
      const edges = buildEdges(t1, t2);
      if(!edges) continue;
      const teams = [...t1, ...t2];
      const mazeAssign = assignMazes(edges, teams);
      if(!mazeAssign) continue;
      const matches = finalizeMatches(edges, mazeAssign, mazeNames);
      const slots = assignSlots(matches);
      if(!slots) continue;
      matches.forEach((m,i)=> m.timeSlot = slots[i]);
      return matches;
    }
    throw new Error('Could not build a valid schedule — try again.');
  }

  function buildEdges(t1, t2){
    function cycleEdges(arr, type){
      const perm = shuffle(arr);
      const out = [];
      for(let i=0;i<perm.length;i++){
        out.push({a: perm[i], b: perm[(i+1)%perm.length], type});
      }
      return out;
    }
    const same1 = cycleEdges(t1, 'same1');
    const same2 = cycleEdges(t2, 'same2');
    let p1, p2, tries=0;
    do{
      p1 = shuffle(t2);
      p2 = shuffle(t2);
      tries++;
    } while(p1.some((v,i)=> v===p2[i]) && tries<500);
    if(tries>=500) return null;
    const cross = [];
    for(let i=0;i<6;i++){
      cross.push({a: t1[i], b: p1[i], type:'cross'});
      cross.push({a: t1[i], b: p2[i], type:'cross'});
    }
    return [...same1, ...same2, ...cross];
  }

  function assignMazes(edges, teams){
    const cap = Math.ceil(edges.length / NUM_MAZES);
    for(let attempt=0; attempt<400; attempt++){
      const order = shuffle(edges.map((_,i)=>i));
      const assign = new Array(edges.length).fill(-1);
      const vCount = {}; teams.forEach(t=> vCount[t] = new Array(NUM_MAZES).fill(0));
      const mTotal = new Array(NUM_MAZES).fill(0);
      const ok = (function backtrack(pos){
        if(pos === order.length){ return teams.every(t => vCount[t].every(c => c >= 1)); }
        const idx = order[pos], e = edges[idx];
        for(const c of shuffle([...Array(NUM_MAZES).keys()])){
          if(vCount[e.a][c] < 2 && vCount[e.b][c] < 2 && mTotal[c] < cap){
            vCount[e.a][c]++; vCount[e.b][c]++; mTotal[c]++; assign[idx] = c;
            if(backtrack(pos+1)) return true;
            vCount[e.a][c]--; vCount[e.b][c]--; mTotal[c]--; assign[idx] = -1;
          }
        }
        return false;
      })(0);
      if(ok) return assign;
    }
    return null;
  }

  function finalizeMatches(edges, mazeAssign, mazeNames){
    const byMaze = Array.from({length:NUM_MAZES}, ()=>[]);
    edges.forEach((e,i)=> byMaze[mazeAssign[i]].push(e));
    const matches = [];
    let id = 0;
    byMaze.forEach((mazeEdges, mIdx) => {
      mazeEdges.forEach((e) => {
        matches.push({
          id: 'm'+(id++),
          teamA: e.a, teamB: e.b, type: e.type,
          mazeIndex: mIdx, maze: mazeNames[mIdx],
          timeSlot: -1, startMin: 0, endMin: 0
        });
      });
    });
    return matches;
  }

  function assignSlots(matches){
    const n = matches.length;
    const conf = Array.from({length:n}, ()=>[]);
    const loads = {};
    matches.forEach(m=>{ loads[m.mazeIndex] = (loads[m.mazeIndex]||0) + 1; });
    const minK = Math.max(4, ...Object.values(loads));
    for(let i=0;i<n;i++){
      for(let j=i+1;j<n;j++){
        const a = matches[i], b = matches[j];
        if(a.mazeIndex===b.mazeIndex ||
           a.teamA===b.teamA || a.teamA===b.teamB || a.teamB===b.teamA || a.teamB===b.teamB){
          conf[i].push(j); conf[j].push(i);
        }
      }
    }
    for(let k=minK; k<=minK+6; k++){
      for(let attempt=0; attempt<80; attempt++){
        const order = shuffle(matches.map((_,i)=>i));
        const slot = new Array(n).fill(-1);
        const ok = (function search(pos){
          if(pos === n) return true;
          const idx = order[pos];
          for(const c of shuffle([...Array(k).keys()])){
            if(conf[idx].every(j => slot[j] !== c)){
              slot[idx] = c;
              if(search(pos+1)) return true;
              slot[idx] = -1;
            }
          }
          return false;
        })(0);
        if(ok) return slot;
      }
    }
    return null;
  }

  function matchesForTeam(team){
    return schedule.filter(m=>m.teamA===team || m.teamB===team)
      .slice().sort((a,b)=> a.startMin - b.startMin);
  }
  function opponentIn(match, team){ return match.teamA===team ? match.teamB : match.teamA; }
  function typeTagClass(type){ return type==='same1'?'same1': type==='same2'?'same2':'cross'; }
  function typeTagLabel(type, team){
    if(type==='cross') return 'CROSS-TIER';
    return tierLabel(team)==='Tier 1' && type==='same1' ? 'TIER 1 CLASH' : 'TIER 2 CLASH';
  }

  let isDrawingAnimationActive = false;
  let activeDrawTeam = null;
  let skipRequested = false;
  let isAutoPlaying = false;
  let autoPlayTimer = null;
  let controlsBound = false;

  function initTheme(){
    const themeBtn = document.getElementById('theme-toggle');
    if(!themeBtn) return;
    
    const savedTheme = localStorage.getItem('polymaze-theme');
    const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    
    if (savedTheme === 'light' || (!savedTheme && systemPrefersLight)) {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    
    themeBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      const isLight = document.body.classList.contains('light-theme');
      localStorage.setItem('polymaze-theme', isLight ? 'light' : 'dark');
    });
  }
  initTheme();

  function initDrawControls(){
    if (controlsBound) return;
    controlsBound = true;
    
    const btnAuto = document.getElementById('btn-auto-draw');
    const btnQuick = document.getElementById('btn-quick-draw');
    const btnSkip = document.getElementById('btn-skip-draw');
    const btnView = document.getElementById('btn-view-fixtures');
    
    if (btnAuto) btnAuto.addEventListener('click', toggleAutoPlay);
    if (btnQuick) btnQuick.addEventListener('click', quickDrawAll);
    if (btnSkip) {
      btnSkip.addEventListener('click', () => {
        skipRequested = true;
        btnSkip.style.display = 'none';
      });
    }
    if (btnView) {
      btnView.addEventListener('click', () => {
        document.getElementById('celebration-overlay').classList.remove('visible');
        goToScreen('preview');
        renderPreviewScreen();
      });
    }
  }

  function toggleAutoPlay(){
    if (isAutoPlaying) {
      pauseAutoPlay();
    } else {
      startAutoPlay();
    }
  }
  
  function startAutoPlay(){
    isAutoPlaying = true;
    document.getElementById('btn-auto-draw').classList.add('active');
    document.getElementById('auto-draw-text').textContent = 'Pause Auto-Draw';
    updateDrawStatus('Auto-Playing...', true);
    autoPlayNext();
  }
  
  function pauseAutoPlay(){
    isAutoPlaying = false;
    if (autoPlayTimer) {
      clearTimeout(autoPlayTimer);
      autoPlayTimer = null;
    }
    document.getElementById('btn-auto-draw').classList.remove('active');
    document.getElementById('auto-draw-text').textContent = 'Auto-Play Draw';
    updateDrawStatus(isDrawingAnimationActive ? 'Drawing...' : 'Ready', isDrawingAnimationActive);
  }
  
  function updateDrawStatus(text, isActive=false){
    const badge = document.getElementById('draw-status-badge');
    if (badge) {
      badge.textContent = text;
      badge.classList.toggle('active', isActive || isAutoPlaying || isDrawingAnimationActive);
    }
  }
  
  function autoPlayNext(){
    if (!isAutoPlaying) return;
    const incompleteTeam = [...tier1, ...tier2].find(team => {
      const ms = matchesForTeam(team);
      return ms.some(m => !revealed.has(m.id));
    });
    
    if (incompleteTeam) {
      drawTeam(incompleteTeam);
    } else {
      pauseAutoPlay();
    }
  }

  function quickDrawAll() {
    pauseAutoPlay();
    schedule.forEach(m => revealed.add(m.id));
    
    document.querySelectorAll('.team-card').forEach(card => {
      card.classList.add('complete');
      card.querySelectorAll('.dot').forEach(dot => dot.classList.add('filled'));
    });
    
    resetCardHighlights();
    updateProgress();
    triggerDrawCompleteCelebration();
  }

  function triggerDrawCompleteCelebration() {
    pauseAutoPlay();
    isDrawingAnimationActive = false;
    resetCardHighlights();
    
    const overlay = document.getElementById('celebration-overlay');
    if (overlay) {
      overlay.classList.add('visible');
    }
    triggerConfetti();
  }

  function triggerConfetti() {
    const colors = [TIER1_COLOR, '#00f5c4', '#ffb627', '#9e1f55'];
    const shapes = ['triangle', 'square', 'hexagon'];
    const container = document.body;
    
    for (let i = 0; i < 70; i++) {
      const el = document.createElement('div');
      el.className = 'polygon-confetti';
      
      const color = colors[Math.floor(Math.random() * colors.length)];
      const shape = shapes[Math.floor(Math.random() * shapes.length)];
      
      el.style.backgroundColor = color;
      el.style.left = Math.random() * 100 + 'vw';
      el.style.top = '-5vh';
      
      if (shape === 'triangle') {
        el.style.clipPath = 'polygon(50% 0%, 0% 100%, 100% 100%)';
      } else if (shape === 'hexagon') {
        el.style.clipPath = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
      } else {
        el.style.clipPath = 'polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)';
      }
      
      const size = Math.random() * 14 + 10;
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      
      const duration = Math.random() * 3 + 2.5;
      const delay = Math.random() * 0.8;
      
      el.style.animation = `confettiFall ${duration}s linear ${delay}s forwards`;
      el.style.setProperty('--drift', (Math.random() * 260 - 130) + 'px');
      el.style.setProperty('--spin', (Math.random() * 720 - 360) + 'deg');
      
      container.appendChild(el);
      setTimeout(() => el.remove(), (duration + delay) * 1000);
    }
  }

  function updateCardDotsOnly(team) {
    const ms = matchesForTeam(team);
    const revCount = ms.filter(m => revealed.has(m.id)).length;
    
    document.querySelectorAll('.team-card').forEach(card => {
      if (card.querySelector('.name').textContent === team) {
        const dots = card.querySelectorAll('.dot');
        dots.forEach((dot, idx) => {
          dot.classList.toggle('filled', idx < revCount);
        });
        if (revCount === 4) {
          card.classList.add('complete');
        }
      }
    });
  }
  
  function updateCardCompleteState(team) {
    document.querySelectorAll('.team-card').forEach(card => {
      if (card.querySelector('.name').textContent === team) {
        card.classList.add('complete');
      }
    });
  }
  
  function highlightActiveCard(team) {
    document.querySelectorAll('.team-card').forEach(card => {
      const nameEl = card.querySelector('.name');
      if (!nameEl) return;
      const isCurrent = nameEl.textContent === team;
      card.style.transform = isCurrent ? 'scale(1.03) translateX(4px)' : 'scale(0.97)';
      card.style.opacity = isCurrent ? '1' : '0.55';
      card.style.borderColor = isCurrent ? 'var(--pink)' : 'var(--line-dim)';
      if (isCurrent) {
        card.style.boxShadow = '-4px 0 20px var(--pink-glow), 0 0 0 2px var(--pink)';
      } else {
        card.style.boxShadow = 'none';
      }
    });
  }
  
  function resetCardHighlights() {
    document.querySelectorAll('.team-card').forEach(card => {
      card.style.transform = '';
      card.style.opacity = '';
      card.style.borderColor = '';
      card.style.boxShadow = '';
    });
  }

  function animateMatchDraw(m, cardElement, callback) {
    const oppSpan = cardElement.querySelector('.opp-value');
    const mazeSpan = cardElement.querySelector('.maze-value');
    const typeTag = cardElement.querySelector('.type-tag');
    const currentTeam = activeDrawTeam;
    
    const targetOpp = opponentIn(m, currentTeam);
    const targetMaze = m.maze;
    
    const shuffleTeams = [...tier1, ...tier2].filter(t => t !== currentTeam);
    const shuffleMazes = [...mazes, 'Maze C', 'Maze D'];
    
    const delays = [40, 40, 40, 40, 55, 55, 70, 85, 105, 130, 165, 210, 270, 350];
    let stepIndex = 0;
    
    function step() {
      if (skipRequested) {
        lockIn();
        return;
      }
      
      if (stepIndex < delays.length) {
        const randOpp = shuffleTeams[Math.floor(Math.random() * shuffleTeams.length)];
        const randMaze = shuffleMazes[Math.floor(Math.random() * shuffleMazes.length)];
        
        oppSpan.innerHTML = `vs <b>${escapeHtml(randOpp)}</b>`;
        mazeSpan.textContent = randMaze;
        
        setTimeout(step, delays[stepIndex]);
        stepIndex++;
      } else {
        lockIn();
      }
    }
    
    function lockIn() {
      oppSpan.innerHTML = `vs <b>${escapeHtml(targetOpp)}</b>`;
      mazeSpan.textContent = targetMaze;
      cardElement.classList.remove('is-shuffling');
      cardElement.classList.add('is-locked');
      
      const slotTag = cardElement.querySelector('.slot-tag');
      slotTag.textContent = timeLabel(m);
      
      typeTag.className = `type-tag ${typeTagClass(m.type)}`;
      typeTag.textContent = typeTagLabel(m.type, currentTeam);
      typeTag.style.opacity = '1';
      
      const panel = document.getElementById('reveal-panel');
      panel.classList.remove('flash-shake');
      void panel.offsetWidth;
      panel.classList.add('flash-shake');
      setTimeout(() => panel.classList.remove('flash-shake'), 150);
      
      revealed.add(m.id);
      updateCardDotsOnly(currentTeam);
      updateCardDotsOnly(targetOpp);
      updateProgress();
      
      callback();
    }
    
    step();
  }

  function showRevealPanelInstant(team, ms) {
    resetCardHighlights();
    document.getElementById('reveal-title').textContent = team + '’s fixtures';
    document.getElementById('reveal-sub').textContent =
      'Four matches drawn — ' + tierLabel(team) + ' · across both mazes, no time clashes.';
    const rows = document.getElementById('reveal-rows');
    rows.innerHTML='';
    ms.forEach((m)=>{
      const opp = opponentIn(m, team);
      const row = document.createElement('div');
      row.className = 'reveal-row';
      row.innerHTML = `
        <span class="maze-tag-lead mono">${escapeHtml(m.maze)}</span>
        <span class="vs-text">vs <b>${escapeHtml(opp)}</b></span>
        <span class="type-tag ${typeTagClass(m.type)}">${typeTagLabel(m.type, team)}</span>
        <span class="slot-tag mono">${timeLabel(m)}</span>
      `;
      rows.appendChild(row);
    });
  }

  function renderDrawScreen(){
    setPillStates('draw');
    const t1box = document.getElementById('draw-tier1-side');
    const t2box = document.getElementById('draw-tier2-side');
    t1box.innerHTML=''; t2box.innerHTML='';
    [[tier1,t1box,'t1'],[tier2,t2box,'t2']].forEach(([list, box, tierClass])=>{
      list.forEach(team=>{
        const ms = matchesForTeam(team);
        const revCount = ms.filter(m=>revealed.has(m.id)).length;
        const card = document.createElement('div');
        card.className = 'team-card tier-block ' + tierClass + (revCount===4 ? ' complete' : '');
        card.innerHTML = `
          <span class="name">${escapeHtml(team)}</span>
          <span class="dots">${[0,1,2,3].map(i=>`<span class="dot ${i<revCount?'filled':''}"></span>`).join('')}</span>
        `;
        card.addEventListener('click', ()=> {
          if (isDrawingAnimationActive) return;
          drawTeam(team);
        });
        box.appendChild(card);
      });
    });
    initDrawControls();
    updateProgress();
  }

  function drawTeam(team){
    const ms = matchesForTeam(team);
    const unrev = ms.filter(m => !revealed.has(m.id));
    
    activeDrawTeam = team;
    highlightActiveCard(team);
    
    if (unrev.length === 0) {
      showRevealPanelInstant(team, ms);
      updateDrawStatus(isAutoPlaying ? 'Auto-Playing...' : 'Ready', false);
      if (isAutoPlaying) {
        autoPlayTimer = setTimeout(autoPlayNext, 1200);
      }
      return;
    }
    
    isDrawingAnimationActive = true;
    skipRequested = false;
    updateDrawStatus('Drawing ' + team + '...', true);
    
    const skipBtn = document.getElementById('btn-skip-draw');
    if (skipBtn) skipBtn.style.display = 'block';
    
    document.getElementById('reveal-title').textContent = team + '’s fixtures';
    document.getElementById('reveal-sub').textContent =
      'Drawing 4 matches — ' + tierLabel(team) + ' · across both mazes, no time clashes.';
      
    const rowsContainer = document.getElementById('reveal-rows');
    rowsContainer.innerHTML = '';
    
    const rowElements = [];
    ms.forEach((m) => {
      const row = document.createElement('div');
      if (revealed.has(m.id)) {
        const opp = opponentIn(m, team);
        row.className = 'reveal-row';
        row.innerHTML = `
          <span class="maze-tag-lead mono">${escapeHtml(m.maze)}</span>
          <span class="vs-text">vs <b>${escapeHtml(opp)}</b></span>
          <span class="type-tag ${typeTagClass(m.type)}">${typeTagLabel(m.type, team)}</span>
          <span class="slot-tag mono">${timeLabel(m)}</span>
        `;
      } else {
        row.className = 'reveal-row is-pending';
        row.innerHTML = `
          <span class="maze-tag-lead mono maze-value">???</span>
          <span class="vs-text opp-value">vs <b>??????</b></span>
          <span class="type-tag" style="opacity:0;">PENDING</span>
          <span class="slot-tag mono">--:--</span>
          <div class="laser-scanner"></div>
          <div class="suspense-equalizer">
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
            <span class="eq-bar"></span>
          </div>
        `;
      }
      rowsContainer.appendChild(row);
      rowElements.push({ match: m, el: row });
    });
    
    drawNextSequential(0);
    
    function drawNextSequential(index) {
      if (index === 4) {
        isDrawingAnimationActive = false;
        if (skipBtn) skipBtn.style.display = 'none';
        updateCardCompleteState(team);
        
        if (revealed.size === schedule.length) {
          triggerDrawCompleteCelebration();
          return;
        }
        
        updateDrawStatus(isAutoPlaying ? 'Auto-Playing...' : 'Ready', false);
        if (isAutoPlaying) {
          autoPlayTimer = setTimeout(autoPlayNext, 1500);
        }
        return;
      }
      
      const item = rowElements[index];
      if (revealed.has(item.match.id)) {
        drawNextSequential(index + 1);
      } else {
        item.el.classList.remove('is-pending');
        item.el.classList.add('is-shuffling');
        
        animateMatchDraw(item.match, item.el, () => {
          setTimeout(() => {
            drawNextSequential(index + 1);
          }, skipRequested ? 0 : 600);
        });
      }
    }
  }

  function updateProgress(){
    const fill = document.getElementById('progress-fill');
    const label = document.getElementById('progress-label');
    const pct = Math.round((revealed.size/schedule.length)*100);
    fill.style.width = pct+'%';
    label.textContent = revealed.size + ' / ' + schedule.length + ' matches set';
  }

  function renderPreviewScreen(){
    setPillStates('preview');
    const s1 = document.getElementById('side-tier1');
    const s2 = document.getElementById('side-tier2');
    s1.innerHTML=''; s2.innerHTML='';
    tier1.forEach(team=> s1.appendChild(sideItem(team)));
    tier2.forEach(team=> s2.appendChild(sideItem(team)));
    activeTeam = activeTeam || tier1[0];
    highlightSidebar();
    document.getElementById('preview-start').value = fmt(phaseStartMin);
    renderPhaseSpan();
    renderTeamPanel(activeTeam);
    renderByMaze();
    renderTimeline();
    setToggle();
  }

  function renderPhaseSpan(){
    document.getElementById('phase-span').textContent = phaseSpanLabel();
  }

  function sideItem(team){
    const el = document.createElement('div');
    el.className = 'side-team';
    el.dataset.team = team;
    el.innerHTML = `<span class="side-avatar" style="background:${colorFor(team)}">${initials(team)}</span>${escapeHtml(team)}`;
    el.addEventListener('click', ()=>{
      activeTeam = team;
      highlightSidebar();
      currentView='team'; setToggle();
      renderTeamPanel(team);
    });
    return el;
  }

  function highlightSidebar(){
    document.querySelectorAll('.side-team').forEach(el=>{
      el.classList.toggle('active', el.dataset.team === activeTeam);
    });
  }

  function renderTeamPanel(team){
    const panel = document.getElementById('panel-team');
    const ms = matchesForTeam(team);
    let html = `
      <div class="team-detail-head">
        <span class="badge" style="background:${colorFor(team)}">${initials(team)}</span>
        <div>
          <p class="tname">${escapeHtml(team)}</p>
          <p class="ttier">${tierLabel(team)} · 4 fixtures, each maze twice</p>
        </div>
      </div>
      <p class="rotation-note">Plays each maze twice, ${matchMin} min each, never two at the same time.</p>
    `;
    ms.forEach(m=>{
      const opp = opponentIn(m, team);
      html += `
        <div class="fixture-row">
          <div class="fx-when">
            <div class="maze-name">${escapeHtml(m.maze)}</div>
            <div class="fx-time mono">${timeLabel(m)}</div>
          </div>
          <div>
            <div class="opp">vs ${escapeHtml(opp)}</div>
            <div class="opp-tier">${typeTagLabel(m.type, team)}</div>
          </div>
          <span class="type-tag ${typeTagClass(m.type)}">${tierLabel(opp)}</span>
        </div>
      `;
    });
    panel.innerHTML = html;
  }

  function renderByMaze(){
    const panel = document.getElementById('panel-full');
    const byMaze = Array.from({length:NUM_MAZES}, ()=>[]);
    schedule.forEach(m=> byMaze[m.mazeIndex].push(m));
    byMaze.forEach(list=> list.sort((a,b)=> a.startMin-b.startMin));
    let html = `<div class="maze-grid">`;
    byMaze.forEach((list, idx)=>{
      const mazeName = mazes[idx] || ('Maze '+(idx+1));
      html += `
        <div class="maze-session">
          <div class="head">
            <span class="mz-name">${escapeHtml(mazeName)}</span>
            <span class="mz-meta">${list.length} matches · all 12 teams</span>
          </div>`;
      list.forEach((m)=>{
        html += `
          <div class="maze-match">
            <span class="stripe ${typeTagClass(m.type)}"></span>
            <span class="mslot mono">${timeLabel(m)}</span>
            <span class="pair"><b>${escapeHtml(m.teamA)}</b> vs <b>${escapeHtml(m.teamB)}</b></span>
          </div>`;
      });
      html += `</div>`;
    });
    html += `</div>${legendHtml()}`;
    panel.innerHTML = html;
  }

  function renderTimeline(){
    const panel = document.getElementById('panel-timeline');
    const bySlot = Array.from({length:slotCount}, ()=>[]);
    schedule.forEach(m=> bySlot[m.timeSlot].push(m));
    bySlot.forEach(list=> list.sort((a,b)=> a.mazeIndex-b.mazeIndex));
    let html = '';
    bySlot.forEach((list, s)=>{
      if(!list.length) return;
      const start = slotStartMin(s);
      html += `
        <div class="tl-slot">
          <div class="tl-head">
            <span class="tl-num mono">SLOT ${String(s+1).padStart(2,'0')}</span>
            <span class="tl-time">${fmt(start)}–${fmt(start+matchMin)}</span>
            <span class="tl-count mono">${list.length} ${list.length===1?'match':'matches'} at once</span>
          </div>
          <div class="tl-matches">`;
      list.forEach(m=>{
        html += `
          <div class="tl-match ${typeTagClass(m.type)}">
            <span class="tl-maze mono">${escapeHtml(m.maze)}</span>
            <span class="tl-pair"><b>${escapeHtml(m.teamA)}</b> vs <b>${escapeHtml(m.teamB)}</b></span>
          </div>`;
      });
      html += `</div></div>`;
    });
    html += legendHtml();
    panel.innerHTML = html;
  }

  function legendHtml(){
    return `<div class="legend">
        <span><i style="background:${TIER1_COLOR}"></i>Tier 1 clash</span>
        <span><i style="background:${TIER2_COLOR}"></i>Tier 2 clash</span>
        <span><i style="background:#ffb627"></i>Cross-tier</span>
        <span style="color:#b9a3b1">No team plays twice at once · ${matchMin} min matches · ${breatheMin} min rest between a team's games.</span>
      </div>`;
  }

  document.getElementById('preview-start').addEventListener('change', (e)=>{
    const parts = (e.target.value || '10:00').split(':').map(Number);
    phaseStartMin = (parts[0]||0)*60 + (parts[1]||0);
    applyClock();
    renderPhaseSpan();
    renderTeamPanel(activeTeam);
    renderByMaze();
    renderTimeline();
  });

  document.getElementById('toggle-team').addEventListener('click', ()=>{ currentView='team'; setToggle(); });
  document.getElementById('toggle-full').addEventListener('click', ()=>{ currentView='full'; setToggle(); });
  document.getElementById('toggle-timeline').addEventListener('click', ()=>{ currentView='timeline'; setToggle(); });
  function setToggle(){
    const map = { team:'panel-team', full:'panel-full', timeline:'panel-timeline' };
    document.getElementById('toggle-team').classList.toggle('on', currentView==='team');
    document.getElementById('toggle-full').classList.toggle('on', currentView==='full');
    document.getElementById('toggle-timeline').classList.toggle('on', currentView==='timeline');
    Object.entries(map).forEach(([view, id])=>{
      document.getElementById(id).style.display = (currentView===view) ? 'block' : 'none';
    });
  }

  function goToScreen(name){
    ['setup','draw','preview'].forEach(s=>{
      document.getElementById('screen-'+s).classList.toggle('visible', s===name);
    });
  }
  function setPillStates(stage){
    const order = ['setup','draw','preview'];
    order.forEach(s=>{
      const el = document.getElementById('pill-'+s);
      el.classList.remove('active');
      if(s===stage) el.classList.add('active');
    });
  }

  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  setPillStates('setup');
})();
