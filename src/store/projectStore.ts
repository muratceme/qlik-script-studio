import { create, useStore } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { temporal, type TemporalState } from 'zundo';
import type { Project } from '@/model/types';
import { newProject } from '@/model/defaults';
import { migrateProject } from '@/model/migrate';

export interface ProjectState {
  project: Project;
  /** Replace the whole project (import, sample, new). */
  replaceProject: (project: Project) => void;
  /** Mutate the project through an immer draft. */
  update: (recipe: (project: Project) => void) => void;
}

/**
 * Leading-edge throttle: the first change inside the window records a history
 * entry, later ones inside the same window are merged into it. This keeps
 * typing in an input from producing one undo step per keystroke.
 */
function throttleHistory<T>(fn: (state: T) => void, waitMs: number): (state: T) => void {
  let last = 0;
  return (state) => {
    const now = Date.now();
    if (now - last >= waitMs) {
      last = now;
      fn(state);
    }
  };
}

export const STORAGE_KEY = 'qlik-script-studio:project';

export const useProjectStore = create<ProjectState>()(
  persist(
    temporal(
      immer((set) => ({
        project: newProject(),
        replaceProject: (project) => set({ project }),
        update: (recipe) =>
          set((state) => {
            recipe(state.project);
          }),
      })),
      {
        partialize: (state) => ({ project: state.project }) as ProjectState,
        limit: 100,
        equality: (a, b) => a.project === b.project,
        handleSet: (handleSet) => throttleHistory(handleSet, 400),
      },
    ),
    {
      name: STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ project: state.project }),
      merge: (persisted, current) => {
        const stored = (persisted as { project?: unknown } | undefined)?.project;
        const migrated = stored ? migrateProject(stored) : null;
        return { ...current, project: migrated ?? current.project };
      },
    },
  ),
);

export const useTemporalStore = <T>(selector: (state: TemporalState<ProjectState>) => T): T =>
  useStore(useProjectStore.temporal, selector);

/** Clears undo history, e.g. after loading a different project. */
export function resetHistory(): void {
  useProjectStore.temporal.getState().clear();
}
