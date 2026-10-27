import { useSyncExternalStore } from "react";

const COARSE = "(pointer: coarse)";

const watchPointer = (onChange: () => void) => {
  const query = window.matchMedia?.(COARSE);
  query?.addEventListener("change", onChange);
  return () => query?.removeEventListener("change", onChange);
};

/** True when the main pointer is a finger, so there is likely no keyboard for the shortcuts. */
export function useTouch(): boolean {
  return useSyncExternalStore(watchPointer, () => window.matchMedia?.(COARSE).matches ?? false);
}

interface Props {
  /** the selection in words, e.g. "2 tiles and 1 token" */
  name: string;
  onRotate: (step: number) => void;
  /** places another of the one selected tile or token; left out for a group */
  onAgain?: () => void;
  /** taps add to the selection or drop from it, as Shift+click does */
  adding: boolean;
  onAdding: (on: boolean) => void;
  onDelete: () => void;
  onDone: () => void;
}

/** The buttons over the map for the selected tiles and tokens, for fingers as well as the mouse. */
export function ActionBar({ name, onRotate, onAgain, adding, onAdding, onDelete, onDone }: Props) {
  return (
    <div className="action-bar" role="toolbar" aria-label={`${name} selected`}>
      <button type="button" aria-label="Rotate left" title="Rotate left (Shift+R)" onClick={() => onRotate(5)}>
        <span aria-hidden="true">&#x21BA;</span>
        Left
      </button>
      <button type="button" aria-label="Rotate right" title="Rotate right (R)" onClick={() => onRotate(1)}>
        <span aria-hidden="true">&#x21BB;</span>
        Right
      </button>
      {onAgain && (
        <button type="button" aria-label="Same again" title="Hold another of these ready to place" onClick={onAgain}>
          <span aria-hidden="true">&#x2750;</span>
          Same again
        </button>
      )}
      <button
        type="button"
        className={adding ? "on" : ""}
        aria-pressed={adding}
        aria-label="Select more"
        title="Tap more tiles or tokens to add them to the selection (Shift+click)"
        onClick={() => onAdding(!adding)}
      >
        <span aria-hidden="true">+</span>
        More
      </button>
      <button type="button" className="danger" aria-label="Delete" title="Delete (Del)" onClick={onDelete}>
        <span aria-hidden="true">&#x2715;</span>
        Delete
      </button>
      <button type="button" aria-label="Done, unselect" title="Unselect (Esc)" onClick={onDone}>
        <span aria-hidden="true">&#x2713;</span>
        Done
      </button>
    </div>
  );
}
