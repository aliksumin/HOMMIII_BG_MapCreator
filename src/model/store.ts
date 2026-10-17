// The one store: the scenario being edited, the current step, undo history,
// and the autosave into this browser.

import { create } from "zustand";
import { newScenario, upgradeScenario } from "./defaults.ts";
import type { Category, Scenario } from "./types.ts";

export type StepId =
  | "basics"
  | "story"
  | "setup"
  | "map"
  | "mapsetup"
  | "opponents"
  | "conditions"
  | "events"
  | "rules"
  | "review";

export const STEPS: readonly { id: StepId; label: string; hint: string }[] = [
  { id: "basics", label: "Basics", hint: "Name, type, author and title icon" },
  { id: "story", label: "Story", hint: "Flavor text, long story, story book" },
  { id: "setup", label: "Player Setup", hint: "Length, players, resources, Units, Town" },
  { id: "map", label: "Map", hint: "Lay out the Map Tiles" },
  { id: "mapsetup", label: "Map Setup", hint: "Tile list and Hero placement" },
  { id: "opponents", label: "AI Opponent", hint: "AI Hero for campaigns and coops" },
  { id: "conditions", label: "Victory & Defeat", hint: "How the Scenario is won and lost" },
  { id: "events", label: "Timed Events", hint: "What happens in which Round" },
  { id: "rules", label: "Rules", hint: "Additional rules and own sections" },
  { id: "review", label: "Review & Export", hint: "Check, preview, download" },
];

const INDEX_KEY = "h3sc:projects";
const projectKey = (id: string) => `h3sc:project:${id}`;
const LAST_KEY = "h3sc:last";

export interface ProjectEntry {
  id: string;
  name: string;
  category: Category;
  updatedAt: string;
}

function readIndex(): ProjectEntry[] {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    return raw ? (JSON.parse(raw) as ProjectEntry[]) : [];
  } catch {
    return [];
  }
}

function writeIndex(entries: ProjectEntry[]): void {
  try {
    localStorage.setItem(INDEX_KEY, JSON.stringify(entries));
  } catch {
    /* storage full or blocked: the project file download still works */
  }
}

/** Projects saved in this browser, newest first. */
export function listProjects(): ProjectEntry[] {
  return readIndex().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function loadProject(id: string): Scenario | null {
  try {
    const raw = localStorage.getItem(projectKey(id));
    return raw ? upgradeScenario(JSON.parse(raw) as Partial<Scenario>) : null;
  } catch {
    return null;
  }
}

export function deleteProject(id: string): void {
  try {
    localStorage.removeItem(projectKey(id));
  } catch {
    /* ignore */
  }
  writeIndex(readIndex().filter((e) => e.id !== id));
}

function saveProject(s: Scenario): boolean {
  try {
    localStorage.setItem(projectKey(s.id), JSON.stringify(s));
    localStorage.setItem(LAST_KEY, s.id);
    const entry: ProjectEntry = { id: s.id, name: s.name || "Untitled Scenario", category: s.category, updatedAt: s.updatedAt };
    writeIndex([entry, ...readIndex().filter((e) => e.id !== s.id)]);
    return true;
  } catch {
    return false;
  }
}

function lastProject(): Scenario | null {
  try {
    const id = localStorage.getItem(LAST_KEY);
    return id ? loadProject(id) : null;
  } catch {
    return null;
  }
}

const HISTORY = 100;

interface AppState {
  scenario: Scenario;
  /** false while the welcome screen shows */
  started: boolean;
  step: StepId;
  past: Scenario[];
  future: Scenario[];
  /** last update tag and time, to merge keystrokes into one undo step */
  lastTag: string;
  lastAt: number;
  saveFailed: boolean;
  /**
   * Changes the scenario. `tag` merges quick successive edits of the same
   * field into one undo step.
   */
  update: (recipe: (draft: Scenario) => void, tag?: string) => void;
  setStep: (step: StepId) => void;
  undo: () => void;
  redo: () => void;
  open: (scenario: Scenario) => void;
  start: (category: Category) => void;
  home: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  scenario: lastProject() ?? newScenario(),
  started: false,
  step: "basics",
  past: [],
  future: [],
  lastTag: "",
  lastAt: 0,
  saveFailed: false,
  update: (recipe, tag = "") => {
    const { scenario, past, lastTag, lastAt } = get();
    const draft = structuredClone(scenario);
    recipe(draft);
    draft.updatedAt = new Date().toISOString();
    const now = Date.now();
    const merge = tag !== "" && tag === lastTag && now - lastAt < 1200;
    set({
      scenario: draft,
      past: merge ? past : [...past.slice(-HISTORY + 1), scenario],
      future: [],
      lastTag: tag,
      lastAt: now,
    });
  },
  setStep: (step) => {
    set({ step });
    window.scrollTo?.({ top: 0 });
  },
  undo: () => {
    const { past, scenario, future } = get();
    if (!past.length) return;
    set({ scenario: past[past.length - 1], past: past.slice(0, -1), future: [scenario, ...future], lastTag: "" });
  },
  redo: () => {
    const { past, scenario, future } = get();
    if (!future.length) return;
    set({ scenario: future[0], past: [...past, scenario], future: future.slice(1), lastTag: "" });
  },
  open: (scenario) =>
    set({ scenario: upgradeScenario(scenario), started: true, step: "basics", past: [], future: [], lastTag: "" }),
  start: (category) => set({ scenario: newScenario(category), started: true, step: "basics", past: [], future: [], lastTag: "" }),
  home: () => set({ started: false }),
}));

// Autosave, debounced.
let timer: ReturnType<typeof setTimeout> | undefined;
useStore.subscribe((state, prev) => {
  if (!state.started || state.scenario === prev.scenario) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    const ok = saveProject(useStore.getState().scenario);
    if (ok === useStore.getState().saveFailed) useStore.setState({ saveFailed: !ok });
  }, 500);
});

/** Shorthand for components: the scenario and its updater. */
export function useScenario(): [Scenario, AppState["update"]] {
  const scenario = useStore((s) => s.scenario);
  const update = useStore((s) => s.update);
  return [scenario, update];
}