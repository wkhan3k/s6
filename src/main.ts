// Tile Clicker: a small idle game built on the D1 starter.
// @deno-types="./asset-url.d.ts"
import tileUrl from "./assets/tile.svg?no-inline";
import "./styles.css";

type UpgradeId = "polish" | "auto" | "kiln";

interface Upgrade {
  id: UpgradeId;
  name: string;
  blurb: string;
  baseCost: number;
  growth: number;
  kind: "click" | "second";
  perLevel: number;
}

interface State {
  tiles: number;
  earned: number;
  clicks: number;
  levels: Record<UpgradeId, number>;
  savedAt: number;
}

const UPGRADES: readonly Upgrade[] = [
  {
    id: "polish",
    name: "Hand polish",
    blurb: "+1 tile per click",
    baseCost: 20,
    growth: 2.6,
    kind: "click",
    perLevel: 1,
  },
  {
    id: "auto",
    name: "Auto-tiler",
    blurb: "+1 tile per second",
    baseCost: 50,
    growth: 1.55,
    kind: "second",
    perLevel: 1,
  },
  {
    id: "kiln",
    name: "Kiln",
    blurb: "+5 tiles per second",
    baseCost: 500,
    growth: 1.6,
    kind: "second",
    perLevel: 5,
  },
];

const SAVE_KEY = "s6-tile-clicker.v1";

const app = document.querySelector<HTMLElement>("#app");
if (!app) throw new Error("Missing #app root element");

app.innerHTML = `
  <header class="masthead">
    <p class="eyebrow">CMPM 121 &middot; s6</p>
    <h1>Tile Clicker</h1>
    <p class="sub">Tap the tile. Hire helpers. Watch the pile grow.</p>
  </header>

  <section class="hud" aria-label="Score">
    <div class="hud-main">
      <p class="hud-label">Tiles</p>
      <p class="score" id="score">0</p>
    </div>
    <p class="rate" id="rate">+1 per click &middot; 0 per second</p>
  </section>

  <p class="toast" id="toast" role="status" hidden></p>

  <section class="stage">
    <button class="clicker" id="clicker" type="button" aria-label="Click the tile">
      <img
        src="${tileUrl}"
        alt=""
        width="96"
        height="96"
        draggable="false"
      />
    </button>
    <div class="particles" id="particles" aria-hidden="true"></div>
  </section>

  <section class="shop" aria-labelledby="shop-title">
    <h2 id="shop-title">Helpers</h2>
    <ul class="upgrades" id="upgrades"></ul>
  </section>

  <footer class="foot">
    <p id="meta">0 clicks &middot; 0 earned all-time</p>
    <button class="reset" id="reset" type="button">Reset save</button>
  </footer>
`;

const score = must<HTMLElement>("#score");
const rate = must<HTMLElement>("#rate");
const meta = must<HTMLElement>("#meta");
const stage = must<HTMLElement>(".stage");
const clicker = must<HTMLButtonElement>("#clicker");
const particles = must<HTMLElement>("#particles");
const upgradeList = must<HTMLUListElement>("#upgrades");
const reset = must<HTMLButtonElement>("#reset");
const toast = must<HTMLElement>("#toast");

function must<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

interface Row {
  li: HTMLLIElement;
  button: HTMLButtonElement;
  cost: HTMLElement;
  level: HTMLElement;
}

const rows = new Map<UpgradeId, Row>();

for (const upgrade of UPGRADES) {
  const li = document.createElement("li");
  li.className = "upgrade";
  li.innerHTML = `
    <div class="upgrade-info">
      <p class="upgrade-name">
        ${upgrade.name} <span class="level" data-level>Lv 0</span>
      </p>
      <p class="upgrade-blurb">${upgrade.blurb}</p>
    </div>
    <button class="buy" type="button" data-buy>
      <span class="buy-label">Buy</span>
      <span class="price" data-cost>0</span>
    </button>
  `;

  const button = li.querySelector<HTMLButtonElement>("[data-buy]")!;
  const cost = li.querySelector<HTMLElement>("[data-cost]")!;
  const level = li.querySelector<HTMLElement>("[data-level]")!;

  button.addEventListener("click", () => buy(upgrade));
  upgradeList.append(li);
  rows.set(upgrade.id, { li, button, cost, level });
}

let state = load();
let perClick = 1;
let perSecond = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function freshState(): State {
  return {
    tiles: 0,
    earned: 0,
    clicks: 0,
    levels: { polish: 0, auto: 0, kiln: 0 },
    savedAt: 0,
  };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

function load(): State {
  const base = freshState();
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return base;
    const data = JSON.parse(raw) as {
      tiles?: unknown;
      earned?: unknown;
      clicks?: unknown;
      levels?: Record<string, unknown>;
      savedAt?: unknown;
    };
    base.tiles = numberOr(data.tiles, 0);
    base.earned = numberOr(data.earned, 0);
    base.clicks = numberOr(data.clicks, 0);
    base.savedAt = numberOr(data.savedAt, 0);
    for (const upgrade of UPGRADES) {
      const level = numberOr(data.levels?.[upgrade.id], 0);
      base.levels[upgrade.id] = Math.floor(level);
    }
  } catch {
    // A corrupt or unavailable save should never block the game.
  }
  return base;
}

function save(): void {
  try {
    state.savedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // Private browsing can reject storage; the game still works unsaved.
  }
}

function compact(value: number): string {
  const whole = Math.floor(value);
  if (whole < 10_000) return whole.toLocaleString("en-US");
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(whole);
}

function costOf(upgrade: Upgrade): number {
  return Math.floor(
    upgrade.baseCost * upgrade.growth ** state.levels[upgrade.id],
  );
}

function recompute(): void {
  perClick = 1;
  perSecond = 0;
  for (const upgrade of UPGRADES) {
    const level = state.levels[upgrade.id];
    if (upgrade.kind === "click") perClick += level * upgrade.perLevel;
    else perSecond += level * upgrade.perLevel;
  }
}

function paint(): void {
  score.textContent = compact(state.tiles);
  rate.textContent = `+${compact(perClick)} per click \u00b7 ` +
    `${compact(perSecond)} per second`;
  meta.textContent = `${compact(state.clicks)} clicks \u00b7 ` +
    `${compact(state.earned)} earned all-time`;

  for (const upgrade of UPGRADES) {
    const row = rows.get(upgrade.id);
    if (!row) continue;
    const level = state.levels[upgrade.id];
    const cost = costOf(upgrade);
    const affordable = state.tiles >= cost;

    row.cost.textContent = compact(cost);
    row.level.textContent = `Lv ${level}`;
    row.button.disabled = !affordable;
    row.button.setAttribute(
      "aria-label",
      `Buy ${upgrade.name} for ${compact(cost)} tiles`,
    );
    row.li.classList.toggle("ready", affordable);
  }
}

function gain(amount: number): void {
  state.tiles += amount;
  state.earned += amount;
}

function buy(upgrade: Upgrade): void {
  const cost = costOf(upgrade);
  if (state.tiles < cost) return;
  state.tiles -= cost;
  state.levels[upgrade.id] += 1;
  recompute();
  save();
  paint();
}

function burst(x: number, y: number, text: string): void {
  const rect = stage.getBoundingClientRect();
  const floater = document.createElement("span");
  floater.className = "floater";
  floater.textContent = text;
  floater.style.left = `${x - rect.left}px`;
  floater.style.top = `${y - rect.top}px`;
  particles.append(floater);
  floater.addEventListener("animationend", () => floater.remove(), {
    once: true,
  });
  setTimeout(() => floater.remove(), 1_200);
}

clicker.addEventListener("click", (event) => {
  const box = clicker.getBoundingClientRect();
  const x = event.clientX || box.left + box.width / 2;
  const y = event.clientY || box.top + box.height / 2;

  gain(perClick);
  state.clicks += 1;
  burst(x, y, `+${compact(perClick)}`);

  clicker.classList.remove("pop");
  void clicker.offsetWidth;
  clicker.classList.add("pop");
  paint();
});

reset.addEventListener("click", () => {
  if (!confirm("Reset tiles, helpers, and stats?")) return;
  state = freshState();
  recompute();
  save();
  paint();
});

function showToast(message: string): void {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.hidden = true;
  }, 5_000);
}

function offlineGain(): number {
  if (state.savedAt <= 0 || perSecond <= 0) return 0;
  const seconds = (Date.now() - state.savedAt) / 1_000;
  if (seconds < 60) return 0;
  return perSecond * Math.min(seconds, 8 * 60 * 60);
}

recompute();

const away = offlineGain();
if (away > 0) {
  gain(away);
  showToast(`While you were away: +${compact(away)} tiles`);
}

let last = performance.now();
let sinceSave = 0;

function tick(): void {
  const now = performance.now();
  const dt = Math.min((now - last) / 1_000, 60);
  last = now;

  if (perSecond > 0) gain(perSecond * dt);

  sinceSave += dt;
  if (sinceSave >= 5) {
    sinceSave = 0;
    save();
  }

  paint();
}

paint();
setInterval(tick, 200);

addEventListener("pagehide", save);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") save();
});
