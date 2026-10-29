(function () {
  'use strict';

  // ---------- Constants (all distances in cm; the mat is 236 x 114 cm) ----------
  const W = 236, H = 114, S = 4;           // S = canvas pixels per cm
  const BASE_SPEED = 40;                   // cm/s at 100% speed
  const BASE_TURN = 150;                   // deg/s at 100% speed
  const HL = 9, HW = 8;                    // robot half-length / half-width
  const SENSOR_OFFSET = 7;                 // color sensor sits this far in front of center

  const COLORS = {
    white: '#ffffff', black: '#222222', red: '#e53935',
    green: '#43a047', blue: '#1e88e5', yellow: '#fdd835'
  };

  // ---------- Challenges ----------
  const LEVELS = [
    {
      name: 'Free play',
      hint: 'Build any program you like and press Run. Try the color sensor on the black lines and colored squares.',
      start: { x: 20, y: 99, h: 0 },
      obstacles: [],
      lines: [
        { x: 60, y: 20, w: 3, h: 70, c: 'black' },
        { x: 60, y: 55, w: 140, h: 3, c: 'black' },
        { x: 140, y: 80, w: 20, h: 20, c: 'red' },
        { x: 180, y: 15, w: 20, h: 20, c: 'green' },
        { x: 100, y: 15, w: 20, h: 20, c: 'blue' }
      ],
      targets: [],
      check: null
    },
    {
      name: '1. Reach target A',
      hint: 'Drive the robot so its center reaches the star. You will need to drive AND turn.',
      start: { x: 20, y: 99, h: 0 },
      obstacles: [],
      lines: [],
      targets: [{ x: 180, y: 30, r: 12, label: 'A' }],
      check: s => s.visited.has(0)
    },
    {
      name: '2. Around the wall',
      hint: 'The wall blocks the way. Find the gap at the top, then reach the star.',
      start: { x: 20, y: 99, h: 0 },
      obstacles: [{ x: 100, y: 30, w: 6, h: 84 }],
      lines: [],
      targets: [{ x: 190, y: 99, r: 12, label: 'A' }],
      check: s => s.visited.has(0)
    },
    {
      name: '3. Stop at the black line',
      hint: 'Use "drive until black line" so the robot stops with its sensor on the line. Finish inside the star zone.',
      start: { x: 20, y: 99, h: 0 },
      obstacles: [],
      lines: [{ x: 120, y: 0, w: 3, h: 114, c: 'black' }],
      targets: [{ x: 113, y: 99, r: 9, label: '■' }],
      check: s => s.inTarget(0)
    },
    {
      name: '4. Mission run and home',
      hint: 'Visit A, then B, then drive back to the launch area (bottom-left box) and stop there.',
      start: { x: 20, y: 99, h: 0 },
      obstacles: [{ x: 150, y: 70, w: 6, h: 44 }],
      lines: [],
      targets: [
        { x: 110, y: 25, r: 10, label: 'A' },
        { x: 200, y: 50, r: 10, label: 'B' }
      ],
      check: s => s.visited.has(0) && s.visited.has(1) && s.x < 30 && s.y > 84
    }
  ];

  // ---------- Blocks ----------
  Blockly.defineBlocksWithJsonArray([
    { type: 'when_start', message0: 'when ▶ Run is pressed', nextStatement: null, colour: 45 },
    {
      type: 'drive', message0: 'drive %1 %2 cm',
      args0: [
        { type: 'field_dropdown', name: 'DIR', options: [['forward', 'F'], ['backward', 'B']] },
        { type: 'field_number', name: 'CM', value: 30, min: 1, max: 300 }
      ],
      previousStatement: null, nextStatement: null, colour: 210
    },
    {
      type: 'turn', message0: 'turn %1 %2 degrees',
      args0: [
        { type: 'field_dropdown', name: 'DIR', options: [['right ↻', 'R'], ['left ↺', 'L']] },
        { type: 'field_number', name: 'DEG', value: 90, min: 1, max: 360 }
      ],
      previousStatement: null, nextStatement: null, colour: 210
    },
    {
      type: 'drive_until_black', message0: 'drive forward until black line (max %1 cm)',
      args0: [{ type: 'field_number', name: 'MAX', value: 100, min: 1, max: 300 }],
      previousStatement: null, nextStatement: null, colour: 190
    },
    {
      type: 'set_speed', message0: 'set speed to %1 %%',
      args0: [{ type: 'field_number', name: 'PCT', value: 50, min: 10, max: 100 }],
      previousStatement: null, nextStatement: null, colour: 260
    },
    {
      type: 'arm', message0: 'move arm %1',
      args0: [{ type: 'field_dropdown', name: 'POS', options: [['down ⬇', 'DOWN'], ['up ⬆', 'UP']] }],
      previousStatement: null, nextStatement: null, colour: 20
    },
    {
      type: 'wait', message0: 'wait %1 seconds',
      args0: [{ type: 'field_number', name: 'SEC', value: 1, min: 0.1, max: 10, precision: 0.1 }],
      previousStatement: null, nextStatement: null, colour: 45
    },
    {
      type: 'repeat_n', message0: 'repeat %1 times %2 %3',
      args0: [
        { type: 'field_number', name: 'TIMES', value: 4, min: 1, max: 50, precision: 1 },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO' }
      ],
      previousStatement: null, nextStatement: null, colour: 120
    },
    {
      type: 'if_color', message0: 'if color sensor sees %1 %2 %3',
      args0: [
        {
          type: 'field_dropdown', name: 'COLOR',
          options: [['black', 'black'], ['white', 'white'], ['red', 'red'],
                    ['green', 'green'], ['blue', 'blue'], ['yellow', 'yellow']]
        },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO' }
      ],
      previousStatement: null, nextStatement: null, colour: 190
    }
  ]);

  const toolbox = {
    kind: 'flyoutToolbox',
    contents: [
      'when_start', 'drive', 'turn', 'drive_until_black', 'set_speed',
      'arm', 'wait', 'repeat_n', 'if_color'
    ].map(type => ({ kind: 'block', type }))
  };

  const DEFAULT_PROGRAM = {
    blocks: {
      languageVersion: 0,
      blocks: [{
        type: 'when_start', x: 24, y: 24,
        next: { block: { type: 'drive', fields: { DIR: 'F', CM: 30 } } }
      }]
    }
  };

  const ws = Blockly.inject('blocklyDiv', {
    toolbox,
    renderer: 'zelos',
    trashcan: true,
    sounds: false,
    grid: { spacing: 25, length: 3, colour: '#d5dbee', snap: true },
    zoom: { controls: true, wheel: false, startScale: 0.95, minScale: 0.5, maxScale: 1.6 },
    move: { scrollbars: true, drag: true, wheel: true }
  });

  const STORAGE_KEY = 'fll-sim-program-v1';
  function loadProgram(state) {
    ws.clear();
    Blockly.serialization.workspaces.load(state, ws);
  }
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    loadProgram(saved ? JSON.parse(saved) : DEFAULT_PROGRAM);
  } catch (e) {
    loadProgram(DEFAULT_PROGRAM);
  }
  ws.addChangeListener(ev => {
    if (ev.isUiEvent) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Blockly.serialization.workspaces.save(ws)));
    } catch (e) { /* storage unavailable: fine */ }
  });
  window.addEventListener('resize', () => Blockly.svgResize(ws));

  // ---------- Simulation state ----------
  const canvas = document.getElementById('mat');
  canvas.width = W * S;
  canvas.height = H * S;
  const ctx = canvas.getContext('2d');

  const els = {
    level: document.getElementById('level'),
    hint: document.getElementById('hint'),
    status: document.getElementById('status'),
    run: document.getElementById('run'),
    stop: document.getElementById('stop'),
    reset: document.getElementById('reset'),
    clear: document.getElementById('clear')
  };

  let level = LEVELS[0];
  const sim = {
    x: 0, y: 0, h: 0, arm: 0, speed: 50,
    trail: [], visited: new Set(), running: false,
    inTarget(i) {
      const t = level.targets[i];
      return !!t && Math.hypot(this.x - t.x, this.y - t.y) <= t.r;
    }
  };
  let stopFlag = false;
  const STOP = { stop: true }, BUMP = { bump: true };

  function setStatus(msg, kind) {
    els.status.textContent = msg;
    els.status.className = kind || '';
  }

  function resetSim() {
    sim.x = level.start.x;
    sim.y = level.start.y;
    sim.h = level.start.h;
    sim.arm = 0;
    sim.speed = 50;
    sim.trail = [[sim.x, sim.y]];
    sim.visited = new Set();
  }

  LEVELS.forEach((l, i) => {
    const o = document.createElement('option');
    o.value = i;
    o.textContent = l.name;
    els.level.appendChild(o);
  });
  els.level.addEventListener('change', () => {
    if (sim.running) stopFlag = true;
    level = LEVELS[Number(els.level.value)];
    els.hint.textContent = '💡 ' + level.hint;
    resetSim();
    setStatus('Build your program, then press Run.', 'info');
  });

  // ---------- Geometry, collisions, sensor ----------
  function robotPoints(x, y, h) {
    const r = h * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    const pts = [];
    const place = (u, v) => pts.push([x + u * c - v * s, y + u * s + v * c]);
    const n = 6;
    for (let i = 0; i <= n; i++) {
      const u = -HL + (2 * HL * i) / n;
      place(u, -HW);
      place(u, HW);
    }
    for (let j = 1; j < 4; j++) {
      const v = -HW + (2 * HW * j) / 4;
      place(HL, v);
      place(-HL, v);
    }
    return pts;
  }

  function blocked(x, y, h) {
    for (const [px, py] of robotPoints(x, y, h)) {
      if (px < 0 || py < 0 || px > W || py > H) return true;
      for (const o of level.obstacles) {
        if (px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.h) return true;
      }
    }
    return false;
  }

  function sensorPos() {
    const r = sim.h * Math.PI / 180;
    return [sim.x + SENSOR_OFFSET * Math.cos(r), sim.y + SENSOR_OFFSET * Math.sin(r)];
  }

  function sensorColor() {
    const [sx, sy] = sensorPos();
    for (let i = level.lines.length - 1; i >= 0; i--) {
      const l = level.lines[i];
      if (sx >= l.x && sx <= l.x + l.w && sy >= l.y && sy <= l.y + l.h) return l.c;
    }
    return 'white';
  }

  function afterMove() {
    sim.trail.push([sim.x, sim.y]);
    level.targets.forEach((t, i) => {
      if (Math.hypot(sim.x - t.x, sim.y - t.y) <= t.r) sim.visited.add(i);
    });
  }

  // ---------- Timing helpers ----------
  let lastT = null;
  function tick() {
    return new Promise(resolve => requestAnimationFrame(t => {
      const dt = lastT === null ? 0.016 : Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      resolve(dt);
    }));
  }
  function checkStop() { if (stopFlag) throw STOP; }

  async function sleep(sec) {
    let left = sec;
    while (left > 0) {
      checkStop();
      left -= await tick();
    }
  }

  // ---------- Robot actions ----------
  async function moveDist(cm, untilBlack) {
    const dir = Math.sign(cm);
    let rem = Math.abs(cm);
    while (rem > 0) {
      checkStop();
      const dt = await tick();
      const d = Math.min(rem, BASE_SPEED * sim.speed / 100 * dt);
      const r = sim.h * Math.PI / 180;
      const nx = sim.x + dir * d * Math.cos(r);
      const ny = sim.y + dir * d * Math.sin(r);
      if (blocked(nx, ny, sim.h)) throw BUMP;
      sim.x = nx;
      sim.y = ny;
      rem -= d;
      afterMove();
      if (untilBlack && sensorColor() === 'black') return;
    }
  }

  async function turnDeg(deg) {
    const dir = Math.sign(deg);
    let rem = Math.abs(deg);
    while (rem > 0) {
      checkStop();
      const dt = await tick();
      const d = Math.min(rem, BASE_TURN * sim.speed / 100 * dt);
      const nh = sim.h + dir * d;
      if (blocked(sim.x, sim.y, nh)) throw BUMP;
      sim.h = nh;
      rem -= d;
    }
  }

  async function moveArm(down) {
    const target = down ? 1 : 0;
    while (Math.abs(sim.arm - target) > 0.001) {
      checkStop();
      const dt = await tick();
      const step = dt / 0.4;
      sim.arm += Math.sign(target - sim.arm) * Math.min(step, Math.abs(target - sim.arm));
    }
  }

  // ---------- Block interpreter ----------
  let lastHighlight = null;
  function highlight(block) {
    try {
      if (lastHighlight) ws.highlightBlock(lastHighlight, false);
      lastHighlight = block ? block.id : null;
      if (block) ws.highlightBlock(block.id, true);
    } catch (e) { /* highlighting is cosmetic */ }
  }

  async function runChain(block) {
    while (block) {
      checkStop();
      highlight(block);
      await execBlock(block);
      await sleep(0.12);
      block = block.getNextBlock();
    }
  }

  async function execBlock(b) {
    switch (b.type) {
      case 'drive': {
        const cm = Number(b.getFieldValue('CM')) || 0;
        await moveDist(b.getFieldValue('DIR') === 'B' ? -cm : cm, false);
        break;
      }
      case 'turn': {
        const deg = Number(b.getFieldValue('DEG')) || 0;
        await turnDeg(b.getFieldValue('DIR') === 'L' ? -deg : deg);
        break;
      }
      case 'drive_until_black':
        await moveDist(Number(b.getFieldValue('MAX')) || 0, true);
        break;
      case 'set_speed':
        sim.speed = Math.max(10, Math.min(100, Number(b.getFieldValue('PCT')) || 50));
        break;
      case 'arm':
        await moveArm(b.getFieldValue('POS') === 'DOWN');
        break;
      case 'wait':
        await sleep(Number(b.getFieldValue('SEC')) || 0);
        break;
      case 'repeat_n': {
        const times = Number(b.getFieldValue('TIMES')) || 0;
        for (let i = 0; i < times; i++) {
          await runChain(b.getInputTargetBlock('DO'));
          highlight(b);
        }
        break;
      }
      case 'if_color':
        if (sensorColor() === b.getFieldValue('COLOR')) {
          await runChain(b.getInputTargetBlock('DO'));
          highlight(b);
        }
        break;
      default:
        break;
    }
  }

  async function runProgram() {
    if (sim.running) return;
    const starts = ws.getTopBlocks(true).filter(b => b.type === 'when_start');
    if (!starts.length) {
      setStatus('Add a "when Run is pressed" block first, then attach your blocks under it.', 'warn');
      return;
    }
    resetSim();
    stopFlag = false;
    sim.running = true;
    lastT = null;
    setStatus('Running…', 'info');
    let outcome = 'done';
    try {
      await runChain(starts[0].getNextBlock());
    } catch (err) {
      if (err === STOP) outcome = 'stopped';
      else if (err === BUMP) outcome = 'bump';
      else { outcome = 'error'; console.error(err); }
    }
    highlight(null);
    sim.running = false;

    if (outcome === 'stopped') { setStatus('Stopped.', 'info'); return; }
    if (outcome === 'error') { setStatus('Something went wrong. Press Reset and try again.', 'warn'); return; }
    const bumpMsg = outcome === 'bump' ? 'Bump! The robot hit something and stopped. ' : '';
    if (level.check) {
      if (level.check(sim)) setStatus('🎉 Challenge complete! Try the next one.', 'ok');
      else setStatus(bumpMsg + 'Not quite yet. Check your numbers and try again!', 'warn');
    } else {
      setStatus(bumpMsg + 'Program finished.', outcome === 'bump' ? 'warn' : 'info');
    }
  }

  els.run.addEventListener('click', runProgram);
  els.stop.addEventListener('click', () => { if (sim.running) stopFlag = true; });
  els.reset.addEventListener('click', () => {
    if (sim.running) stopFlag = true;
    resetSim();
    setStatus('Robot reset to the launch area.', 'info');
  });
  els.clear.addEventListener('click', () => {
    if (!window.confirm('Clear all your blocks and start over?')) return;
    if (sim.running) stopFlag = true;
    loadProgram(DEFAULT_PROGRAM);
  });

  // ---------- Drawing ----------
  function drawMat() {
    ctx.fillStyle = '#eaf2fb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 10 cm grid
    ctx.strokeStyle = 'rgba(30,60,120,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 10) { ctx.moveTo(x * S, 0); ctx.lineTo(x * S, H * S); }
    for (let y = 0; y <= H; y += 10) { ctx.moveTo(0, y * S); ctx.lineTo(W * S, y * S); }
    ctx.stroke();

    // launch area
    ctx.fillStyle = 'rgba(46,125,50,0.15)';
    ctx.fillRect(0, 84 * S, 30 * S, 30 * S);
    ctx.strokeStyle = '#2e7d32';
    ctx.setLineDash([8, 6]);
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 84 * S, 30 * S - 1, 30 * S - 1);
    ctx.setLineDash([]);
    ctx.fillStyle = '#2e7d32';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('LAUNCH', 4 * S, 82 * S);

    // lines and color patches
    level.lines.forEach(l => {
      ctx.fillStyle = COLORS[l.c] || '#000';
      ctx.fillRect(l.x * S, l.y * S, l.w * S, l.h * S);
    });

    // obstacles
    level.obstacles.forEach(o => {
      ctx.fillStyle = '#6b7280';
      ctx.fillRect(o.x * S, o.y * S, o.w * S, o.h * S);
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x * S, o.y * S, o.w * S, o.h * S);
    });

    // targets
    level.targets.forEach((t, i) => {
      const done = sim.visited.has(i);
      ctx.beginPath();
      ctx.arc(t.x * S, t.y * S, t.r * S, 0, Math.PI * 2);
      ctx.fillStyle = done ? 'rgba(67,160,71,0.35)' : 'rgba(251,192,45,0.35)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = done ? '#2e7d32' : '#f9a825';
      ctx.stroke();
      ctx.fillStyle = '#1c2333';
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(done ? '✓' : '★ ' + t.label, t.x * S, t.y * S);
    });
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';

    // trail
    if (sim.trail.length > 1) {
      ctx.strokeStyle = 'rgba(31,58,138,0.35)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      sim.trail.forEach(([x, y], i) => (i ? ctx.lineTo(x * S, y * S) : ctx.moveTo(x * S, y * S)));
      ctx.stroke();
    }

    drawRobot();

    // border
    ctx.strokeStyle = '#1f3a8a';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
  }

  function drawRobot() {
    ctx.save();
    ctx.translate(sim.x * S, sim.y * S);
    ctx.rotate(sim.h * Math.PI / 180);

    // wheels
    ctx.fillStyle = '#111';
    ctx.fillRect(-4 * S, -HW * S - 3, 8 * S, 5);
    ctx.fillRect(-4 * S, HW * S - 2, 8 * S, 5);

    // arm (extends in front; shorter when "up")
    const armLen = 3 + 6 * sim.arm;
    ctx.fillStyle = '#ef6c00';
    ctx.fillRect(HL * S - 2, -3 * S, armLen * S, 6 * S);

    // body
    ctx.fillStyle = '#ffd400';
    ctx.strokeStyle = '#1c2333';
    ctx.lineWidth = 3;
    ctx.fillRect(-HL * S, -HW * S, 2 * HL * S, 2 * HW * S);
    ctx.strokeRect(-HL * S, -HW * S, 2 * HL * S, 2 * HW * S);

    // front arrow
    ctx.fillStyle = '#1c2333';
    ctx.beginPath();
    ctx.moveTo(6 * S, 0);
    ctx.lineTo(1 * S, -4 * S);
    ctx.lineTo(1 * S, 4 * S);
    ctx.closePath();
    ctx.fill();

    // color sensor
    ctx.beginPath();
    ctx.arc(SENSOR_OFFSET * S, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS[sensorColorSafe()] || '#fff';
    ctx.fill();
    ctx.strokeStyle = '#c62828';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  function sensorColorSafe() {
    try { return sensorColor(); } catch (e) { return 'white'; }
  }

  function frameLoop() {
    drawMat();
    requestAnimationFrame(frameLoop);
  }

  // ---------- Start ----------
  els.hint.textContent = '💡 ' + level.hint;
  resetSim();
  setStatus('Build your program, then press Run.', 'info');
  frameLoop();
})();
