import { runAfterTransition } from "@kobalte/utils";
import "./style.css";

class RetentionProbe extends HTMLElement {}
customElements.define("retention-probe", RetentionProbe);

const count = document.querySelector("#count");
const control = document.querySelector("#control");
const stopped = document.querySelector("#stopped");
const status = document.querySelector("#status");
const result = document.querySelector("#result");
const targets = document.querySelector("#targets");
let weakTargets = [];
let stats = {};

// Weak references allow an external GC + inspection without keeping the probes alive.
window.repro = Object.freeze({
  getResult: () => ({ ...stats }),
  countAliveTargets: () => weakTargets.filter(reference => reference.deref() !== undefined).length,
});

function render() {
  result.textContent = JSON.stringify(stats, null, 2);
}

const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

async function run(stopEndPropagation) {
  const total = count.valueAsNumber;
  if (!Number.isInteger(total) || total < 1 || total > 5000) {
    status.textContent = "Enter a whole number from 1 to 5000";
    return;
  }
  control.disabled = stopped.disabled = count.disabled = true;
  status.textContent = "Running";
  stats = { stopEndPropagation, created: total, started: 0, ended: 0, cancelled: 0, removed: 0, callbackRan: false, done: false };
  const probes = Array.from({ length: total }, () => document.createElement("retention-probe"));
  weakTargets = probes.map(probe => new WeakRef(probe));
  const starts = [];
  const ends = [];

  for (const probe of probes) {
    starts.push(new Promise(resolve => {
      probe.addEventListener("transitionrun", () => { stats.started++; resolve(); }, { once: true });
    }));
    ends.push(new Promise(resolve => {
      probe.addEventListener("transitionend", event => {
        if (stopEndPropagation) event.stopPropagation();
        stats.ended++;
        resolve();
      }, { once: true });
    }));
    probe.addEventListener("transitioncancel", () => stats.cancelled++, { once: true });
  }

  let deadline;
  const timeout = new Promise((_, reject) => {
    deadline = setTimeout(() => reject(new Error("CSS transitions did not complete within 10 seconds")), 10000);
  });
  try {
    targets.append(...probes);
    // Establish the initial computed style before requesting a real CSS transition.
    void targets.offsetHeight;
    for (const probe of probes) probe.classList.add("running");
    await Promise.race([Promise.all(starts), timeout]);
    runAfterTransition(() => { stats.callbackRan = true; render(); });
    await Promise.race([Promise.all(ends), timeout]);
    await nextFrame();
    // The transition is over: removing the element now cannot generate transitioncancel.
    for (const probe of probes) probe.remove();
    stats.removed = total;
    await nextFrame();
    await nextFrame();
    stats.done = true;
    status.textContent = stats.callbackRan ? "Callback ran" : "Callback blocked";
    render();
  } finally {
    clearTimeout(deadline);
    targets.replaceChildren();
  }
}

function start(stopEndPropagation) {
  run(stopEndPropagation).catch(error => {
    status.textContent = `Failed: ${error.message}`;
    render();
  });
}

control.addEventListener("click", () => start(false));
stopped.addEventListener("click", () => start(true));
document.querySelector("#reload").addEventListener("click", () => location.reload());
