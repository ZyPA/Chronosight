const root = document.querySelector('.sockets');
const container = document.querySelector('.container');
const defaultConfig = { root };
function capitalize(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
}
function createSocketHTML(config) {
    const container = config.root;
    if (!container)
        return;
    const div = document.createElement('button');
    div.className = 'socket';
    div.id = config.id;
    div.innerHTML = `
    <div class="socket-header">
      <img class="socket-icon" alt="${capitalize(config.id)} icon" src="assets/${config.id}.webp" />
      <span class="socket-title">${capitalize(config.id)}</span>
      <span class="socket-status"></span>
    </div>
    <span class="socket-value"></span>
    <div class="socket-footer">
      <span class="socket-average-label">1h</span>
      <span class="socket-average"></span>
    </div>
  `;
    container.appendChild(div);
}
function createSocketSlot() {
    const slot = document.createElement('div');
    slot.className = 'socket-slot';
    slot.innerHTML = `
    <div class="socket-slot-inner empty" id="socket-slot-inner">
    </div>
  `;
    if (container)
        container.insertBefore(slot, root);
}
createSocketSlot();
function moveSocketToSlot(socketId) {
    const slotInner = document.getElementById('socket-slot-inner');
    const socketsContainer = document.querySelector('.sockets');
    if (!slotInner || !socketsContainer)
        return;
    const ghost = socketsContainer.querySelector('.socket-ghost');
    if (ghost)
        socketsContainer.removeChild(ghost);
    const existing = slotInner.querySelector('.socket');
    if (existing) {
        socketsContainer.appendChild(existing);
        slotInner.classList.add('empty');
        cycleConfigs.forEach((cfg) => {
            const el = document.getElementById(cfg.id);
            if (el && el.parentElement === socketsContainer) {
                socketsContainer.appendChild(el);
            }
        });
    }
    if (socketId) {
        const socketEl = document.getElementById(socketId);
        if (socketEl) {
            slotInner.classList.remove('empty');
            slotInner.innerHTML = '';
            slotInner.appendChild(socketEl);
            const ghostDiv = document.createElement('div');
            ghostDiv.className = 'socket socket-ghost';
            ghostDiv.innerHTML = `<div class='socket-header'></div><span class='socket-value'></span><div class='socket-footer'></div>`;
            const socketIndex = cycleConfigs.findIndex((cfg) => cfg.id === socketId);
            const sockets = Array.from(socketsContainer.querySelectorAll('.socket'));
            const filtered = sockets.filter((el) => !el.classList.contains('socket-ghost') &&
                el.parentElement === socketsContainer);
            if (socketIndex >= 0 && socketIndex < filtered.length) {
                socketsContainer.insertBefore(ghostDiv, filtered[socketIndex]);
            }
            else {
                socketsContainer.appendChild(ghostDiv);
            }
        }
    }
}
class Cycle {
    config;
    k;
    amp;
    elements;
    socketed = false;
    lastState = {};
    constructor(config) {
        this.config = config;
        this.k = (2 * Math.PI) / config.period;
        this.amp = config.amp ?? 15;
        const el = document.getElementById(config.id);
        this.elements = {
            root: el,
            status: el.querySelector('.socket-status'),
            value: el.querySelector('.socket-value'),
            average: el.querySelector('.socket-average'),
        };
        el.addEventListener('click', () => this.toggleSocket());
    }
    getEffect(time) {
        const now = time / 3600000;
        return Math.sin(this.k * now) * this.amp;
    }
    getAverage1H(time) {
        const now = time / 3600000;
        const end = now + 1;
        return ((-this.amp / this.k) * (Math.cos(this.k * end) - Math.cos(this.k * now)));
    }
    update(time, isBest = false) {
        const value = this.getEffect(time);
        const next = this.getEffect(time + 1);
        const average = this.getAverage1H(time);
        const isPositive = value > 0;
        const isIncreasing = value < next;
        const state = isBest ? 'best' : isPositive ? 'positive' : 'negative';
        const avgState = average > 0 ? 'positive' : 'negative';
        const status = isIncreasing ? 'increasing' : 'decreasing';
        const statusSymbol = status === 'increasing' ? '▲' : '▼';
        const formattedValue = `${isPositive ? '+' : ''}${value.toFixed(2)}%`;
        const formattedAverage = `${average > 0 ? '+' : ''}${average.toFixed(2)}%`;
        if (this.lastState.state !== state) {
            this.elements.root.setAttribute('data-state', state);
            this.lastState.state = state;
        }
        if (this.lastState.avgState !== avgState) {
            this.elements.average.setAttribute('data-state', avgState);
            this.lastState.avgState = avgState;
        }
        if (this.lastState.value !== formattedValue) {
            this.elements.value.textContent = formattedValue;
            this.lastState.value = formattedValue;
        }
        if (this.lastState.average !== formattedAverage) {
            this.elements.average.textContent = formattedAverage;
            this.lastState.average = formattedAverage;
        }
        if (this.lastState.status !== status) {
            this.elements.status.setAttribute('data-status', status);
            this.lastState.status = status;
        }
        if (this.lastState.statusSymbol !== statusSymbol) {
            this.elements.status.textContent = statusSymbol;
            this.lastState.statusSymbol = statusSymbol;
        }
    }
    toggleSocket() {
        if (this.socketed) {
            this.socketed = false;
            onSocketChange(null);
        }
        else {
            onSocketChange(this.config.id);
        }
    }
    setSocketed(val) {
        this.socketed = val;
    }
}
const cycleConfigs = [
    { ...defaultConfig, id: 'diamond', period: 3 },
    { ...defaultConfig, id: 'ruby', period: 12 },
    { ...defaultConfig, id: 'jade', period: 24 },
];
cycleConfigs.forEach(createSocketHTML);
const cycles = Object.fromEntries(cycleConfigs.map((cfg) => [cfg.id, new Cycle(cfg)]));
let socketedKey = null;
function onSocketChange(newKey) {
    socketedKey = newKey;
    for (const [key, cycle] of Object.entries(cycles)) {
        cycle.setSocketed(key === socketedKey);
    }
    moveSocketToSlot(socketedKey);
}
function getBest(time, currentSocket) {
    const entries = Object.entries(cycles)
        .map(([key, cycle]) => {
        const value = cycle.getEffect(time);
        const avg = cycle.getAverage1H(time);
        return value >= 0 ? { key, value, avg } : null;
    })
        .filter(Boolean);
    if (!entries.length)
        return 'none';
    const bestByAvg = entries.slice().sort((a, b) => b.avg - a.avg)[0];
    if (currentSocket) {
        const current = entries.find((e) => e.key == currentSocket);
        if (current && current.value >= bestByAvg.value)
            return currentSocket;
    }
    return bestByAvg.key;
}
function startRenderLoop() {
    function render() {
        const time = Date.now();
        const bestKey = getBest(time, socketedKey);
        for (const [key, cycle] of Object.entries(cycles)) {
            cycle.update(time, key === bestKey);
        }
        requestAnimationFrame(render);
    }
    render();
}
startRenderLoop();
