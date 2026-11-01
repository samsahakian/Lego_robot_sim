(function () {
  'use strict';

  // ---------- Constants (all distances in cm; the mat is 236 x 114 cm) ----------
  const W = 236, H = 114, S = 4;           // S = canvas pixels per cm
  const BASE_SPEED = 40;                   // cm/s at 100% movement speed
  const BASE_TURN = 150;                   // deg/s at 100% movement speed
  const WHEEL_CM = 17.6;                   // wheel circumference (one rotation = 17.6 cm)
  const ARM_MAX_DEG = 180;                 // arm motor travel from fully up to fully down
  const ARM_DPS = 300;                     // arm motor degrees/sec at 100% motor speed
  const HL = 14, HW = 12;                  // robot half-length / half-width (includes wheels)
  const BODY_HW = 10;                      // half-width of the white body alone
  const SENSOR_OFFSET = 12;                // color sensor sits this far in front of center
  const BASE_R = 50;                       // radius of each quarter-circle base in the bottom corners

  // What is physically plugged into the robot's ports. Kids must discover/read this
  // and use the right ports in their blocks, just like on the real brick.
  const WIRING = { A: 'left', C: 'arm', E: 'right', F: 'color' };
  const PORT_INFO = {
    A: '🔧 Motor: left wheel',
    B: '(empty)',
    C: '🔧 Motor: arm (clockwise = down, counterclockwise = up)',
    D: '(empty)',
    E: '🔧 Motor: right wheel',
    F: '👁 Color sensor (looks down at the mat)'
  };
  const PORTS = ['A', 'B', 'C', 'D', 'E', 'F'];

  const COLORS = {
    white: '#ffffff', black: '#222222', red: '#e53935',
    green: '#43a047', blue: '#1e88e5', yellow: '#fdd835'
  };

  // ---------- Challenges ----------
  const LEVELS = [
    {
      name: 'Free play',
      hint: 'Build any program you like. Remember to set up your motors first! Drag the robot to move it between the two bases, and drag the orange dot to aim it.',
      start: { x: 22, y: 95, h: 0 },
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
      hint: 'Get the star under the robot\'s center. First tell the robot which motors drive its wheels (check the wiring!), then drive AND turn. You can start in either base: drag the robot over and aim it first.',
      start: { x: 22, y: 95, h: 0 },
      obstacles: [],
      lines: [],
      targets: [{ x: 180, y: 30, r: 12, label: 'A' }],
      check: s => s.visited.has(0)
    },
    {
      name: '2. Around the wall',
      hint: 'The wall blocks the way. Find the gap at the top, then reach the star.',
      start: { x: 22, y: 95, h: 0 },
      obstacles: [{ x: 100, y: 30, w: 6, h: 84 }],
      lines: [],
      targets: [{ x: 190, y: 95, r: 12, label: 'A' }],
      check: s => s.visited.has(0)
    },
    {
      name: '3. Stop at the black line',
      hint: 'Use "start moving", then "wait until color sensor … sees black", then "stop moving". Finish inside the star zone. Which port is the sensor on?',
      start: { x: 22, y: 95, h: 0 },
      obstacles: [],
      lines: [{ x: 120, y: 0, w: 3, h: 114, c: 'black' }],
      targets: [{ x: 108, y: 95, r: 9, label: '■' }],
      check: s => s.inTarget(0)
    },
    {
      name: '4. Mission run and home',
      hint: 'Visit A, then B, then drive back so the whole robot is inside a base.',
      start: { x: 22, y: 95, h: 0 },
      obstacles: [{ x: 150, y: 70, w: 6, h: 44 }],
      lines: [],
      targets: [
        { x: 110, y: 25, r: 10, label: 'A' },
        { x: 200, y: 50, r: 10, label: 'B' }
      ],
      check: s => s.visited.has(0) && s.visited.has(1) && s.inBase()
    },
    {
      name: '5. Drop it off',
      hint: 'Drive to the delivery star, lower the arm all the way down (it\'s a motor! how far does it turn?), then bring the robot back inside a base.',
      start: { x: 22, y: 95, h: 0 },
      obstacles: [],
      lines: [],
      targets: [{ x: 150, y: 60, r: 10, label: '📦' }],
      check: s => s.visited.has(0) && s.armDeg >= ARM_MAX_DEG - 5 && s.inBase()
    }
  ];

  // ---------- Blocks ----------
  const portOpts = PORTS.map(p => [p, p]);
  const colorOpts = [['black', 'black'], ['white', 'white'], ['red', 'red'],
                     ['green', 'green'], ['blue', 'blue'], ['yellow', 'yellow']];
  const moveUnits = [['cm', 'cm'], ['inches', 'in'], ['rotations', 'rot'], ['degrees', 'deg'], ['seconds', 'sec']];
  const turnUnits = [['degrees', 'deg'], ['rotations', 'rot'], ['seconds', 'sec']];
  const motorUnits = [['rotations', 'rot'], ['degrees', 'deg'], ['seconds', 'sec']];

  Blockly.defineBlocksWithJsonArray([
    { type: 'when_start', message0: 'when program starts', nextStatement: null, colour: 45 },
    { type: 'when_left_button', message0: 'when left button is pressed', nextStatement: null, colour: 45 },
    { type: 'when_right_button', message0: 'when right button is pressed', nextStatement: null, colour: 45 },
    {
      type: 'set_move_motors', message0: 'set movement motors to %1 + %2',
      args0: [
        { type: 'field_dropdown', name: 'LEFT', options: portOpts },
        { type: 'field_dropdown', name: 'RIGHT', options: [['B', 'B'], ...portOpts.filter(o => o[0] !== 'B')] }
      ],
      previousStatement: null, nextStatement: null, colour: 290
    },
    {
      type: 'set_move_speed', message0: 'set movement speed to %1 %%',
      args0: [{ type: 'field_number', name: 'PCT', value: 75, min: 10, max: 100, precision: 1 }],
      previousStatement: null, nextStatement: null, colour: 290
    },
    {
      type: 'set_motor_speed', message0: 'set motor %1 speed to %2 %%',
      args0: [
        { type: 'field_dropdown', name: 'PORT', options: portOpts },
        { type: 'field_number', name: 'PCT', value: 75, min: 10, max: 100, precision: 1 }
      ],
      previousStatement: null, nextStatement: null, colour: 290
    },
    {
      type: 'move', message0: 'move %1 for %2 %3',
      args0: [
        { type: 'field_dropdown', name: 'DIR', options: [['forward', 'F'], ['backward', 'B']] },
        { type: 'field_number', name: 'VAL', value: 30, min: 0, max: 1000, precision: 0.1 },
        { type: 'field_dropdown', name: 'UNIT', options: moveUnits }
      ],
      previousStatement: null, nextStatement: null, colour: 210
    },
    {
      type: 'turn', message0: 'turn %1 for %2 %3',
      args0: [
        { type: 'field_dropdown', name: 'DIR', options: [['right ↻', 'R'], ['left ↺', 'L']] },
        { type: 'field_number', name: 'VAL', value: 90, min: 0, max: 3600, precision: 0.1 },
        { type: 'field_dropdown', name: 'UNIT', options: turnUnits }
      ],
      previousStatement: null, nextStatement: null, colour: 210
    },
    {
      type: 'start_move', message0: 'start moving %1',
      args0: [{ type: 'field_dropdown', name: 'DIR', options: [['forward', 'F'], ['backward', 'B']] }],
      previousStatement: null, nextStatement: null, colour: 210
    },
    { type: 'stop_move', message0: 'stop moving', previousStatement: null, nextStatement: null, colour: 210 },
    {
      type: 'run_motor', message0: 'run motor %1 %2 for %3 %4',
      args0: [
        { type: 'field_dropdown', name: 'PORT', options: portOpts },
        { type: 'field_dropdown', name: 'DIR', options: [['clockwise ↻', 'CW'], ['counterclockwise ↺', 'CCW']] },
        { type: 'field_number', name: 'VAL', value: 1, min: 0, max: 100, precision: 0.1 },
        { type: 'field_dropdown', name: 'UNIT', options: motorUnits }
      ],
      previousStatement: null, nextStatement: null, colour: 20
    },
    {
      type: 'wait', message0: 'wait %1 seconds',
      args0: [{ type: 'field_number', name: 'SEC', value: 1, min: 0.1, max: 10, precision: 0.1 }],
      previousStatement: null, nextStatement: null, colour: 120
    },
    {
      type: 'wait_color', message0: 'wait until color sensor %1 sees %2',
      args0: [
        { type: 'field_dropdown', name: 'PORT', options: portOpts },
        { type: 'field_dropdown', name: 'COLOR', options: colorOpts }
      ],
      previousStatement: null, nextStatement: null, colour: 190
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
      type: 'if_color', message0: 'if color sensor %1 sees %2 %3 %4',
      args0: [
        { type: 'field_dropdown', name: 'PORT', options: portOpts },
        { type: 'field_dropdown', name: 'COLOR', options: colorOpts },
        { type: 'input_dummy' },
        { type: 'input_statement', name: 'DO' }
      ],
      previousStatement: null, nextStatement: null, colour: 190
    }
  ]);

  const cat = (name, colour, types) => ({
    kind: 'category', name, colour,
    contents: types.map(type => ({ kind: 'block', type }))
  });
  const toolbox = {
    kind: 'categoryToolbox',
    contents: [
      cat('Start', '45', ['when_start', 'when_left_button', 'when_right_button']),
      cat('Setup', '290', ['set_move_motors', 'set_move_speed', 'set_motor_speed']),
      cat('Movement', '210', ['move', 'turn', 'start_move', 'stop_move']),
      cat('Motors', '20', ['run_motor']),
      cat('Sensors', '190', ['wait_color', 'if_color']),
      cat('Control', '120', ['wait', 'repeat_n'])
    ]
  };

  // The starter program deliberately has no setup block: kids have to add it.
  const DEFAULT_PROGRAM = {
    blocks: {
      languageVersion: 0,
      blocks: [{
        type: 'when_start', x: 24, y: 24,
        next: { block: { type: 'move', fields: { DIR: 'F', VAL: 30, UNIT: 'cm' } } }
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

  const STORAGE_KEY = 'fll-sim-program-v2';
  const HARD_KEY = 'fll-sim-hardmode';
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
    clear: document.getElementById('clear'),
    wiring: document.getElementById('wiring'),
    ports: document.getElementById('ports'),
    hard: document.getElementById('hard'),
    btnL: document.getElementById('btnL'),
    btnR: document.getElementById('btnR')
  };

  // wiring panel
  PORTS.forEach(p => {
    const tr = document.createElement('tr');
    const th = document.createElement('th');
    th.textContent = 'Port ' + p;
    const td = document.createElement('td');
    td.textContent = PORT_INFO[p];
    tr.appendChild(th);
    tr.appendChild(td);
    els.ports.appendChild(tr);
  });
  try { els.hard.checked = localStorage.getItem(HARD_KEY) === '1'; } catch (e) { /* ignore */ }
  function applyHard() { els.wiring.style.display = els.hard.checked ? 'none' : ''; }
  els.hard.addEventListener('change', () => {
    applyHard();
    try { localStorage.setItem(HARD_KEY, els.hard.checked ? '1' : '0'); } catch (e) { /* ignore */ }
  });
  applyHard();

  let level = LEVELS[0];
  let startPose = Object.assign({}, level.start);
  let programAlive = false;   // true once the program has been started (Run) and until it is stopped
  const sim = {
    x: 0, y: 0, h: 0, armDeg: 0,
    speed: 75, motorSpeed: {}, moveMotors: null, swapped: false,
    cont: null, pendingBump: false, flash: null,
    trail: [], visited: new Set(), running: false,
    inBase() { return !!inBaseNow(); },
    inTarget(i) {
      const t = level.targets[i];
      return !!t && Math.hypot(this.x - t.x, this.y - t.y) <= t.r;
    }
  };
  let stopFlag = false;
  const STOP = { stop: true }, BUMP = { bump: true };
  function fail(msg) { throw { fail: true, msg }; }

  function setStatus(msg, kind) {
    els.status.textContent = msg;
    els.status.className = kind || '';
  }

  function resetSim() {
    programAlive = false;
    sim.x = startPose.x;
    sim.y = startPose.y;
    sim.h = startPose.h;
    sim.armDeg = 0;
    sim.speed = 75;
    sim.motorSpeed = {};
    sim.moveMotors = null;
    sim.swapped = false;
    sim.cont = null;
    sim.pendingBump = false;
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
    startPose = Object.assign({}, level.start);
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

  function baseCorner(side) { return [side === 'L' ? 0 : W, H]; }
  function inBaseRegion(p, side) {
    const c = baseCorner(side);
    return Math.hypot(p[0] - c[0], p[1] - c[1]) <= BASE_R;
  }
  function fullyInBase(x, y, h, side) {
    return !blocked(x, y, h) && robotPoints(x, y, h).every(p => inBaseRegion(p, side));
  }
  // which base the whole robot is inside right now ('L', 'R' or null)
  function inBaseNow() {
    const pts = robotPoints(sim.x, sim.y, sim.h);
    for (const side of ['L', 'R']) {
      if (pts.every(p => inBaseRegion(p, side))) return side;
    }
    return null;
  }
  // nearest legal spot for the robot's center: pulls the candidate toward a base interior
  function fitInBase(x, y, h) {
    let best = null;
    for (const side of ['L', 'R']) {
      const tx = side === 'L' ? 20 : W - 20, ty = H - 20;
      for (let i = 0; i <= 40; i++) {
        const t = i / 40;
        const px = x + (tx - x) * t, py = y + (ty - y) * t;
        if (fullyInBase(px, py, h, side)) {
          const d = Math.hypot(px - x, py - y);
          if (!best || d < best.d) best = { x: px, y: py, d, side };
          break;
        }
      }
    }
    return best;
  }

  function sensorColor() {
    const r = sim.h * Math.PI / 180;
    const sx = sim.x + SENSOR_OFFSET * Math.cos(r);
    const sy = sim.y + SENSOR_OFFSET * Math.sin(r);
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

  // drive the robot forward along its heading by a signed distance
  function stepForward(d) {
    const r = sim.h * Math.PI / 180;
    const nx = sim.x + d * Math.cos(r);
    const ny = sim.y + d * Math.sin(r);
    if (blocked(nx, ny, sim.h)) return false;
    sim.x = nx;
    sim.y = ny;
    afterMove();
    return true;
  }

  // ---------- Timing helpers ----------
  let lastT = null;
  function tick() {
    return new Promise(resolve => requestAnimationFrame(t => {
      const dt = lastT === null ? 0.016 : Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      // "start moving" keeps the robot driving while later blocks run
      if (sim.cont) {
        const d = sim.cont.dir * BASE_SPEED * sim.speed / 100 * dt;
        if (!stepForward(d)) { sim.cont = null; sim.pendingBump = true; }
      }
      resolve(dt);
    }));
  }
  function checkStop() {
    if (stopFlag) throw STOP;
    if (sim.pendingBump) { sim.pendingBump = false; throw BUMP; }
  }

  async function sleep(sec) {
    let left = sec;
    while (left > 0) {
      checkStop();
      left -= await tick();
    }
  }

  // ---------- Robot actions ----------
  function needMotors() {
    if (!sim.moveMotors) {
      fail('The robot doesn\'t know which motors drive its wheels yet! Add a "set movement motors" block near the top of your program.');
    }
  }

  function setMoveMotors(left, right) {
    if (left === right) fail('The left and right wheel motors can\'t both be port ' + left + '.');
    [left, right].forEach(p => {
      const what = WIRING[p];
      if (!what) fail('Nothing is plugged into port ' + p + '. Check the wiring panel for where the wheel motors are.');
      if (what === 'color') fail('Port ' + p + ' is the color sensor, not a motor.');
      if (what === 'arm') fail('Port ' + p + ' is the arm motor, not a wheel motor.');
    });
    sim.moveMotors = [left, right];
    // swapping left and right makes the robot steer backwards
    sim.swapped = WIRING[left] === 'right';
  }

  function toCm(val, unit) {
    if (unit === 'in') return val * 2.54;
    if (unit === 'rot') return val * WHEEL_CM;
    if (unit === 'deg') return val / 360 * WHEEL_CM;
    return val;
  }

  async function moveFor(sign, val, unit) {
    needMotors();
    sim.cont = null;
    const speed = () => BASE_SPEED * sim.speed / 100;
    if (unit === 'sec') {
      let left = val;
      while (left > 0) {
        checkStop();
        const dt = Math.min(await tick(), left);
        if (!stepForward(sign * speed() * dt)) throw BUMP;
        left -= dt;
      }
      return;
    }
    let rem = toCm(val, unit);
    while (rem > 0) {
      checkStop();
      const dt = await tick();
      const d = Math.min(rem, speed() * dt);
      if (!stepForward(sign * d)) throw BUMP;
      rem -= d;
    }
  }

  async function turnFor(sign, val, unit) {
    needMotors();
    sim.cont = null;
    const dir = sign * (sim.swapped ? -1 : 1);
    const rate = () => BASE_TURN * sim.speed / 100;
    let rem = unit === 'sec' ? val : unit === 'rot' ? val * 360 : val;
    while (rem > 0) {
      checkStop();
      const dt = await tick();
      const d = unit === 'sec' ? Math.min(dt, rem) : Math.min(rem, rate() * dt);
      const turned = unit === 'sec' ? rate() * d : d;
      const nh = sim.h + dir * turned;
      if (blocked(sim.x, sim.y, nh)) throw BUMP;
      sim.h = nh;
      rem -= d;
    }
  }

  async function runMotor(port, dirCode, val, unit) {
    const what = WIRING[port];
    if (!what) fail('Nothing is plugged into port ' + port + '. Which port is the arm motor on?');
    if (what === 'color') fail('Port ' + port + ' is the color sensor, not a motor.');
    if (what === 'left' || what === 'right') {
      fail('Port ' + port + ' is a wheel motor. Use the movement blocks to drive the wheels.');
    }
    const sign = dirCode === 'CW' ? 1 : -1;
    const rate = ARM_DPS * (sim.motorSpeed[port] || 75) / 100;
    const duration = unit === 'sec' ? val : (unit === 'rot' ? val * 360 : val) / rate;
    let left = duration;
    while (left > 0) {
      checkStop();
      const dt = Math.min(await tick(), left);
      sim.armDeg = Math.max(0, Math.min(ARM_MAX_DEG, sim.armDeg + sign * rate * dt));
      left -= dt;
    }
  }

  async function waitColor(port, color) {
    if (WIRING[port] !== 'color') {
      fail(WIRING[port] ? 'Port ' + port + ' isn\'t the color sensor.' : 'There is no color sensor on port ' + port + '.');
    }
    if (sensorColor() === color) return;
    if (!sim.cont) fail('The robot isn\'t moving, so it would wait forever. Use "start moving" before waiting for a color.');
    for (;;) {
      checkStop();
      await tick();
      if (sensorColor() === color) return;
      if (!sim.cont && !sim.pendingBump) fail('The robot stopped before it ever saw ' + color + '.');
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
      try {
        await execBlock(block);
      } catch (e) {
        if (e && e.fail && !e.block) e.block = block;
        throw e;
      }
      // small pause so kids can follow along, but not while driving (keeps timing sharp)
      if (!sim.cont) await sleep(0.12);
      block = block.getNextBlock();
    }
  }

  function num(b, name) { return Number(b.getFieldValue(name)) || 0; }

  async function execBlock(b) {
    switch (b.type) {
      case 'set_move_motors':
        setMoveMotors(b.getFieldValue('LEFT'), b.getFieldValue('RIGHT'));
        break;
      case 'set_move_speed':
        sim.speed = Math.max(10, Math.min(100, num(b, 'PCT') || 75));
        break;
      case 'set_motor_speed': {
        const p = b.getFieldValue('PORT');
        if (!WIRING[p] || WIRING[p] === 'color') fail('There is no motor on port ' + p + '.');
        sim.motorSpeed[p] = Math.max(10, Math.min(100, num(b, 'PCT') || 75));
        break;
      }
      case 'move':
        await moveFor(b.getFieldValue('DIR') === 'B' ? -1 : 1, num(b, 'VAL'), b.getFieldValue('UNIT'));
        break;
      case 'turn':
        await turnFor(b.getFieldValue('DIR') === 'L' ? -1 : 1, num(b, 'VAL'), b.getFieldValue('UNIT'));
        break;
      case 'start_move':
        needMotors();
        sim.cont = { dir: b.getFieldValue('DIR') === 'B' ? -1 : 1 };
        break;
      case 'stop_move':
        sim.cont = null;
        break;
      case 'run_motor':
        await runMotor(b.getFieldValue('PORT'), b.getFieldValue('DIR'), num(b, 'VAL'), b.getFieldValue('UNIT'));
        break;
      case 'wait':
        await sleep(num(b, 'SEC'));
        break;
      case 'wait_color':
        await waitColor(b.getFieldValue('PORT'), b.getFieldValue('COLOR'));
        break;
      case 'repeat_n': {
        const times = num(b, 'TIMES');
        for (let i = 0; i < times; i++) {
          await runChain(b.getInputTargetBlock('DO'));
          highlight(b);
        }
        break;
      }
      case 'if_color': {
        const p = b.getFieldValue('PORT');
        if (WIRING[p] !== 'color') {
          fail(WIRING[p] ? 'Port ' + p + ' isn\'t the color sensor.' : 'There is no color sensor on port ' + p + '.');
        }
        if (sensorColor() === b.getFieldValue('COLOR')) {
          await runChain(b.getInputTargetBlock('DO'));
          highlight(b);
        }
        break;
      }
      default:
        break;
    }
  }

  const BUTTON_HATS = ['when_left_button', 'when_right_button'];
  function hasButtonHats() { return ws.getTopBlocks(false).some(b => BUTTON_HATS.includes(b.type)); }

  // runs one hat block's stack. fresh = the program is (re)starting, so the robot goes
  // back to its placed pose and all setup (motors, speeds) is forgotten.
  async function execute(head, fresh) {
    if (sim.running) return;
    if (fresh) resetSim();
    else { sim.trail = [[sim.x, sim.y]]; sim.cont = null; sim.pendingBump = false; }
    programAlive = true;
    stopFlag = false;
    sim.running = true;
    lastT = null;
    setStatus('Running…', 'info');
    let outcome = 'done', failure = null;
    try {
      await runChain(head.getNextBlock());
    } catch (err) {
      if (err === STOP) outcome = 'stopped';
      else if (err === BUMP) outcome = 'bump';
      else if (err && err.fail) { outcome = 'fail'; failure = err; }
      else { outcome = 'error'; console.error(err); }
    }
    sim.cont = null; // the real robot stops moving when a stack ends
    highlight(null);
    sim.running = false;

    if (outcome === 'stopped') { setStatus('Stopped.', 'info'); return; }
    if (outcome === 'error') { setStatus('Something went wrong. Press Reset and try again.', 'warn'); return; }
    if (outcome === 'fail') {
      if (failure.block) highlight(failure.block);
      setStatus('⚠ ' + failure.msg, 'warn');
      return;
    }
    const bumpMsg = outcome === 'bump' ? 'Bump! The robot hit something and stopped. ' : '';
    const waiting = hasButtonHats() ? ' Press the left ◀ or right ▶ button to run those blocks.' : '';
    if (level.check && level.check(sim)) setStatus('🎉 Challenge complete! Try the next one.', 'ok');
    else if (level.check) setStatus(bumpMsg + 'Not quite yet.' + (waiting || ' Check your numbers and try again!'), 'warn');
    else setStatus(bumpMsg + 'Program finished.' + waiting, outcome === 'bump' ? 'warn' : 'info');
  }

  // the center "start" button: (re)starts the program
  async function runProgram() {
    if (sim.running) return;
    const tops = ws.getTopBlocks(true);
    const start = tops.find(b => b.type === 'when_start');
    if (!start && !hasButtonHats()) {
      setStatus('Add a "when program starts" block first, then attach your blocks under it.', 'warn');
      return;
    }
    if (start) { await execute(start, true); return; }
    resetSim();
    programAlive = true;
    setStatus('Program started. Press the left ◀ or right ▶ button to run your blocks.', 'info');
  }

  function flashButton(which) { sim.flash = { which, until: Date.now() + 200 }; }

  // a press of the hub's left, right or center button
  function pressButton(which) {
    flashButton(which);
    if (which === 'C') { runProgram(); return; }
    const name = which === 'L' ? 'left' : 'right';
    if (sim.running) { setStatus('The robot is still running. Wait for it to finish, or press Stop.', 'warn'); return; }
    if (!programAlive) {
      setStatus('The program isn\'t running yet. Press ▶ Run first (like starting a program on the hub), then press the ' + name + ' button.', 'warn');
      return;
    }
    const hat = ws.getTopBlocks(true).find(b => b.type === (which === 'L' ? 'when_left_button' : 'when_right_button'));
    if (!hat) { setStatus('There is no "when ' + name + ' button is pressed" block in your program.', 'warn'); return; }
    execute(hat, false);
  }

  els.run.addEventListener('click', runProgram);
  els.stop.addEventListener('click', () => {
    programAlive = false;
    if (sim.running) stopFlag = true;
    else setStatus('Program stopped.', 'info');
  });
  els.btnL.addEventListener('click', () => pressButton('L'));
  els.btnR.addEventListener('click', () => pressButton('R'));
  els.reset.addEventListener('click', () => {
    if (sim.running) stopFlag = true;
    resetSim();
    setStatus('Robot reset to the launch area.', 'info');
  });
  els.clear.addEventListener('click', () => {
    if (!window.confirm('Clear all your blocks and start over?')) return;
    if (sim.running) stopFlag = true;
    programAlive = false;
    loadProgram(DEFAULT_PROGRAM);
  });

  // ---------- Dragging the robot ----------
  let drag = null;

  function pointerCm(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
  }
  function hitRobot(p) {
    const a = sim.h * Math.PI / 180, dx = p.x - sim.x, dy = p.y - sim.y;
    const u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a);
    return Math.abs(u) <= HL + 2 && Math.abs(v) <= HW + 2;
  }
  function placeRobot(x, y, h) {
    startPose = { x, y, h: normHeading(h) };
    sim.x = x;
    sim.y = y;
    sim.h = startPose.h;
    sim.trail = [[x, y]];
    sim.visited = new Set();
    sim.cont = null;
    sim.pendingBump = false;
  }

  // hub buttons drawn on the robot (left, center, right)
  const HUB_U = -4;
  function btnPos(which) {
    const v = which === 'L' ? -4.5 : which === 'R' ? 4.5 : 0;
    const a = sim.h * Math.PI / 180;
    return { x: sim.x + HUB_U * Math.cos(a) - v * Math.sin(a), y: sim.y + HUB_U * Math.sin(a) + v * Math.cos(a) };
  }
  function hitButton(p) {
    for (const which of ['L', 'R', 'C']) {
      const b = btnPos(which);
      if (Math.hypot(p.x - b.x, p.y - b.y) <= (which === 'C' ? 2.2 : 3)) return which;
    }
    return null;
  }

  canvas.addEventListener('pointerdown', e => {
    const p = pointerCm(e);
    const bh = hitButton(p);
    if (bh) {
      drag = { mode: 'button', which: bh };
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      e.preventDefault();
      return;
    }
    if (sim.running) return;
    const hp = handlePos();
    if (Math.hypot(p.x - hp.x, p.y - hp.y) <= 6) drag = { mode: 'aim' };
    else if (hitRobot(p)) drag = { mode: 'move', dx: sim.x - p.x, dy: sim.y - p.y };
    else return;
    sim.h = normHeading(sim.h);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    canvas.style.cursor = 'grabbing';
    e.preventDefault();
  });

  canvas.addEventListener('pointermove', e => {
    const p = pointerCm(e);
    if (!drag) {
      if (hitButton(p)) { canvas.style.cursor = 'pointer'; return; }
      if (!sim.running) {
        const hp = handlePos();
        canvas.style.cursor = Math.hypot(p.x - hp.x, p.y - hp.y) <= 6 ? 'crosshair' : (hitRobot(p) ? 'grab' : 'default');
      } else {
        canvas.style.cursor = 'default';
      }
      return;
    }
    if (drag.mode === 'button') return;
    if (drag.mode === 'aim') {
      const h = Math.round(Math.atan2(p.y - sim.y, p.x - sim.x) * 180 / Math.PI / 5) * 5;
      if (fullyInBase(sim.x, sim.y, h, 'L') || fullyInBase(sim.x, sim.y, h, 'R')) {
        placeRobot(sim.x, sim.y, h);
      } else {
        const fit = fitInBase(sim.x, sim.y, h);
        if (fit) placeRobot(fit.x, fit.y, h);
      }
    } else {
      const fit = fitInBase(p.x + drag.dx, p.y + drag.dy, sim.h);
      if (fit) placeRobot(fit.x, fit.y, sim.h);
    }
  });

  function endDrag(e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    canvas.style.cursor = 'default';
    if (d.mode === 'button') {
      if (e && e.type === 'pointerup' && hitButton(pointerCm(e)) === d.which) pressButton(d.which);
      return;
    }
    const side = inBaseNow();
    const deg = Math.round((sim.h % 360 + 360) % 360);
    setStatus('Robot placed in the ' + (side === 'R' ? 'right' : 'left') + ' base, facing ' + deg + '° (0° = pointing right). Build your program, then press Run.', 'info');
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

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

    // the two quarter-circle bases
    const inside = inBaseNow();
    ['L', 'R'].forEach(side => {
      const cx = (side === 'L' ? 0 : W) * S, cy = H * S;
      const a0 = side === 'L' ? -Math.PI / 2 : Math.PI;
      const a1 = side === 'L' ? 0 : Math.PI * 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, BASE_R * S, a0, a1);
      ctx.closePath();
      ctx.fillStyle = inside === side ? 'rgba(46,125,50,0.32)' : 'rgba(46,125,50,0.13)';
      ctx.fill();
      ctx.strokeStyle = '#2e7d32';
      ctx.setLineDash([8, 6]);
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#2e7d32';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.textAlign = side === 'L' ? 'left' : 'right';
      ctx.fillText(side === 'L' ? 'LEFT BASE' : 'RIGHT BASE', (side === 'L' ? 4 : W - 4) * S, (H - BASE_R - 2) * S);
      ctx.textAlign = 'start';
    });

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
      ctx.fillText(done ? '✓' : (t.label.length > 1 && t.label !== 'A' ? t.label : '★ ' + t.label), t.x * S, t.y * S);
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
    drawAimHandle();

    // border
    ctx.strokeStyle = '#1f3a8a';
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
  }

  function drawRobot() {
    ctx.save();
    ctx.translate(sim.x * S, sim.y * S);
    ctx.rotate(sim.h * Math.PI / 180);

    // arm (extends in front; longer when lowered)
    const armLen = 3 + 6 * (sim.armDeg / ARM_MAX_DEG);
    ctx.fillStyle = '#ef6c00';
    ctx.fillRect(HL * S - 2, -3 * S, armLen * S, 6 * S);

    // body: large white rectangle
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1c2333';
    ctx.lineWidth = 3;
    ctx.fillRect(-HL * S, -BODY_HW * S, 2 * HL * S, 2 * BODY_HW * S);
    ctx.strokeRect(-HL * S, -BODY_HW * S, 2 * HL * S, 2 * BODY_HW * S);

    // two big light blue wheels on the sides
    const wheelHalfLen = 9, wheelIn = BODY_HW - 2;
    ctx.fillStyle = '#7fd4f5';
    ctx.strokeStyle = '#1c2333';
    ctx.lineWidth = 2;
    [[-HW, -wheelIn], [wheelIn, HW]].forEach(([v0, v1]) => {
      ctx.fillRect(-wheelHalfLen * S, v0 * S, 2 * wheelHalfLen * S, (v1 - v0) * S);
      ctx.strokeRect(-wheelHalfLen * S, v0 * S, 2 * wheelHalfLen * S, (v1 - v0) * S);
    });

    // front arrow
    ctx.fillStyle = '#1c2333';
    ctx.beginPath();
    ctx.moveTo(9 * S, 0);
    ctx.lineTo(3 * S, -4 * S);
    ctx.lineTo(3 * S, 4 * S);
    ctx.closePath();
    ctx.fill();

    // hub with three buttons (left, center, right), clickable
    ctx.fillStyle = '#4b5563';
    ctx.strokeStyle = '#1c2333';
    ctx.lineWidth = 2;
    ctx.fillRect(-10 * S, -8 * S, 12 * S, 16 * S);
    ctx.strokeRect(-10 * S, -8 * S, 12 * S, 16 * S);
    [['L', -4.5], ['C', 0], ['R', 4.5]].forEach(([which, v]) => {
      const pressed = sim.flash && sim.flash.which === which && Date.now() < sim.flash.until;
      const r = (which === 'C' ? 1.8 : 2.6) * S;
      ctx.beginPath();
      ctx.arc(HUB_U * S, v * S, r, 0, Math.PI * 2);
      ctx.fillStyle = pressed ? '#ef6c00' : (which === 'C' ? '#e5e7eb' : '#1f2937');
      ctx.fill();
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      if (which !== 'C') {
        const d = which === 'L' ? -1 : 1;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(HUB_U * S, (v + d * 1.4) * S);
        ctx.lineTo((HUB_U - 1.2) * S, (v - d * 0.8) * S);
        ctx.lineTo((HUB_U + 1.2) * S, (v - d * 0.8) * S);
        ctx.closePath();
        ctx.fill();
      }
    });

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

  function normHeading(h) {
    let a = ((h % 360) + 360) % 360;
    return a > 180 ? a - 360 : a;
  }

  // the orange dot in front of the robot: drag it to aim
  function handlePos() {
    const r = sim.h * Math.PI / 180, d = HL + 14;
    return {
      x: Math.max(4, Math.min(W - 4, sim.x + d * Math.cos(r))),
      y: Math.max(4, Math.min(H - 4, sim.y + d * Math.sin(r)))
    };
  }

  function drawAimHandle() {
    if (sim.running) return;
    const hp = handlePos();
    ctx.strokeStyle = 'rgba(239,108,0,0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sim.x * S, sim.y * S);
    ctx.lineTo(hp.x * S, hp.y * S);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(hp.x * S, hp.y * S, 4 * S, 0, Math.PI * 2);
    ctx.fillStyle = '#ef6c00';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    if (drag && drag.mode !== 'button') {
      const deg = Math.round((sim.h % 360 + 360) % 360);
      ctx.fillStyle = '#1c2333';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(deg + '°', sim.x * S, (sim.y - HW - 5) * S);
      ctx.textAlign = 'start';
    }
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
