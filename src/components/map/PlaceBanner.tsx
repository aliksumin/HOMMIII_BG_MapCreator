interface Props {
  /** the waiting tile or token, e.g. "Far Tile F3" */
  name: string;
  /** what to do next, e.g. "tap a spot on the board" */
  hint: string;
  /** why it can't go where it is shown; empty when it fits */
  problem: string;
  /** R and Shift+R turn it too */
  keys: boolean;
  onTurn?: (step: number) => void;
  /** places it where a tap showed it; left out until a tap shows it somewhere it fits */
  onPlace?: () => void;
  onCancel?: () => void;
}

/** The note over the map while a tile or token from the palette waits to be placed. */
export function PlaceBanner({ name, hint, problem, keys, onTurn, onPlace, onCancel }: Props) {
  return (
    <div className="board-banner" role="status" onPointerDown={(e) => e.stopPropagation()}>
      <p>
        Placing <b>{name}</b>: {problem ? <span className="problem">{problem}</span> : hint}
      </p>
      <div className="banner-buttons">
        {onTurn && (
          <>
            <button type="button" aria-label="Turn left" title={keys ? "Turn left (Shift+R)" : "Turn left"} onClick={() => onTurn(5)}>
              &#x21BA;
            </button>
            <button type="button" aria-label="Turn right" title={keys ? "Turn right (R)" : "Turn right"} onClick={() => onTurn(1)}>
              &#x21BB;
            </button>
          </>
        )}
        {onPlace && (
          <button type="button" className="go" onClick={onPlace}>
            Place
          </button>
        )}
        {onCancel && (
          <button type="button" title="Stop placing (Esc)" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
