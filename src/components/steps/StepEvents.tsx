import { EVENT_CHIPS } from "../../data/game.ts";
import { uid } from "../../lib/id.ts";
import { ordinalText } from "../../lib/markup.ts";
import { useScenario } from "../../model/store.ts";
import { Panel } from "../ui/Form.tsx";
import { ListEditor } from "../ui/ListEditor.tsx";

export function StepEvents() {
  const [s, update] = useScenario();
  const maxRound = Math.max(s.rounds ?? 12, ...s.timedEvents.flatMap((e) => e.rounds), 1);
  const used = new Set(s.timedEvents.flatMap((e) => e.rounds));
  const nextFree = Array.from({ length: maxRound - 1 }, (_, i) => i + 2).find((r) => !used.has(r)) ?? 2;

  return (
    <>
      <Panel
        title="Timed Events"
        aside={
          <button
            type="button"
            className="btn small"
            onClick={() => update((d) => void d.timedEvents.push({ id: uid(), rounds: [nextFree], items: [""] }))}
          >
            + Add event
          </button>
        }
      >
        <p className="hint">
          Events resolve at the start of the Rounds you pick. Pick several Rounds for events that repeat; the book prints them in
          Round order (&ldquo;7th and 8th Rounds&rdquo;).
        </p>
        {!s.timedEvents.length && <p className="empty">No Timed Events yet.</p>}
      </Panel>
      {s.timedEvents.map((event, index) => (
        <Panel
          key={event.id}
          title={event.rounds.length ? `${[...event.rounds].sort((a, b) => a - b).map(ordinalText).join(", ")} Round${event.rounds.length > 1 ? "s" : ""}` : "Pick a Round"}
          aside={
            <button type="button" className="btn small danger" onClick={() => update((d) => void d.timedEvents.splice(index, 1))}>
              Remove
            </button>
          }
        >
          <div className="round-picker">
            {Array.from({ length: maxRound }, (_, i) => i + 1).map((r) => (
              <button
                type="button"
                key={r}
                className={event.rounds.includes(r) ? "on" : used.has(r) ? "used" : ""}
                onClick={() =>
                  update((d) => {
                    const e = d.timedEvents[index];
                    e.rounds = e.rounds.includes(r) ? e.rounds.filter((x) => x !== r) : [...e.rounds, r].sort((a, b) => a - b);
                  })
                }
              >
                {r}
              </button>
            ))}
          </div>
          <ListEditor
            items={event.items}
            onChange={(items) => update((d) => void (d.timedEvents[index].items = items), `event-${event.id}`)}
            addLabel="Add an event"
            chips={[
              ...EVENT_CHIPS,
              ...s.timedEvents
                .filter((other) => other.id !== event.id && other.rounds.length)
                .map((other) => `Repeat the Timed Events of Round${other.rounds.length > 1 ? "s" : ""} ${other.rounds.join(" and ")}.`),
            ]}
          />
        </Panel>
      ))}
    </>
  );
}