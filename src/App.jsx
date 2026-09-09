import { useEffect, useMemo, useState } from "react";
import { Check, Lock, RotateCcw, Users } from "lucide-react";

const USERS = [
  { id: "MIGUEL", name: "MIGUEL", color: "#2563eb" },
  { id: "JOAO", name: "JOAO", color: "#16a34a" },
  { id: "TOME", name: "TOME", color: "#9333ea" },
  { id: "PEDRO", name: "PEDRO", color: "#e5484d" },
];

const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const START_HOUR = 7;
const END_HOUR = 23;
const STORAGE_KEY = "weekly-unavailability";

const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, index) => {
  const hour = START_HOUR + index;

  return {
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    endLabel: `${String(hour + 1).padStart(2, "0")}:00`,
  };
});

function emptySlot() {
  return { normal: [], fixed: [] };
}

function getEmptyUnavailability() {
  return Object.fromEntries(
    DAYS.map((day) => [
      day,
      Object.fromEntries(HOURS.map(({ hour }) => [hour, emptySlot()])),
    ]),
  );
}

function cleanUsers(users, userIds) {
  return Array.isArray(users) ? users.filter((userId) => userIds.has(userId)) : [];
}

function normalizeSlot(value, userIds) {
  if (Array.isArray(value)) {
    return { normal: cleanUsers(value, userIds), fixed: [] };
  }

  return {
    normal: cleanUsers(value?.normal, userIds),
    fixed: cleanUsers(value?.fixed, userIds),
  };
}

function getSlotUsers(slot) {
  return [...new Set([...(slot?.normal ?? []), ...(slot?.fixed ?? [])])];
}

function normalizeUnavailability(value) {
  const base = getEmptyUnavailability();
  const userIds = new Set(USERS.map((user) => user.id));

  for (const day of DAYS) {
    for (const { hour } of HOURS) {
      base[day][hour] = normalizeSlot(value?.[day]?.[hour], userIds);
    }
  }

  return base;
}

function loadUnavailability() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeUnavailability(JSON.parse(saved)) : getEmptyUnavailability();
  } catch {
    return getEmptyUnavailability();
  }
}

function UserBadge({ user, compact = false }) {
  return (
    <span
      className={`user-badge ${compact ? "user-badge-compact" : ""}`}
      style={{ "--user-color": user.color }}
    >
      <span className="user-dot" />
      {user.name}
    </span>
  );
}

function UnavailabilityCell({ day, hour, selectedUser, slot, fixedMode, onToggle }) {
  const unavailableUserIds = getSlotUsers(slot);
  const users = USERS.filter((user) => unavailableUserIds.includes(user.id));
  const selectedNormal = slot.normal.includes(selectedUser);
  const selectedFixed = slot.fixed.includes(selectedUser);
  const selected = selectedNormal || selectedFixed;
  const everyoneUnavailable = users.length === USERS.length;
  const label =
    users.length === 0
      ? `${day} ${hour}:00, nobody marked unavailable`
      : `${day} ${hour}:00, unavailable: ${users.map((user) => user.name).join(", ")}`;

  return (
    <button
      type="button"
      className={`availability-cell ${selected ? "selected-by-current-user" : ""} ${
        everyoneUnavailable ? "everyone-available" : ""
      } ${selectedFixed ? "fixed-by-current-user" : ""}`}
      onClick={() => onToggle(day, hour)}
      aria-label={`${label}${selectedFixed ? ", fixed marker" : ""}`}
      title={fixedMode ? "Fixed mode: click to toggle a protected unavailable marker" : undefined}
    >
      {users.length === 0 ? (
        <span className="empty-cell-text">+</span>
      ) : (
        <span
          className="availability-segments"
          style={{ gridTemplateColumns: `repeat(${users.length}, minmax(0, 1fr))` }}
        >
          {users.map((user) => (
            <span
              key={user.id}
              className={`availability-segment ${slot.fixed.includes(user.id) ? "fixed-segment" : ""}`}
              style={{ backgroundColor: user.color }}
              title={`${user.name}${slot.fixed.includes(user.id) ? " fixed" : ""}`}
            />
          ))}
        </span>
      )}

      {selected && (
        <span className="selected-check" aria-hidden="true">
          {selectedFixed ? <Lock size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={4} />}
        </span>
      )}

      {everyoneUnavailable && (
        <span className="all-badge">
          <Users size={11} />
          ALL 4
        </span>
      )}
    </button>
  );
}

export default function App() {
  const [selectedUser, setSelectedUser] = useState("MIGUEL");
  const [fixedMode, setFixedMode] = useState(false);
  const [unavailability, setUnavailability] = useState(loadUnavailability);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(unavailability));
  }, [unavailability]);

  const selectedUserData = useMemo(
    () => USERS.find((user) => user.id === selectedUser),
    [selectedUser],
  );

  const openSlots = useMemo(() => {
    const slots = [];

    for (const day of DAYS) {
      for (const { hour, label } of HOURS) {
        if (getSlotUsers(unavailability[day][hour]).length === 0) {
          slots.push({ day, hour, label });
        }
      }
    }

    return slots;
  }, [unavailability]);

  function toggleUnavailability(day, hour) {
    setUnavailability((current) => {
      const currentSlot = current[day][hour];
      const normal = currentSlot.normal.filter((user) => user !== selectedUser);
      const fixed = currentSlot.fixed.filter((user) => user !== selectedUser);
      const isFixed = currentSlot.fixed.includes(selectedUser);
      const isNormal = currentSlot.normal.includes(selectedUser);

      const updatedSlot = fixedMode
        ? { normal, fixed: isFixed ? fixed : [...fixed, selectedUser] }
        : { normal: isNormal ? normal : [...normal, selectedUser], fixed: currentSlot.fixed };

      return {
        ...current,
        [day]: {
          ...current[day],
          [hour]: updatedSlot,
        },
      };
    });
  }

  function updateAllSlots(updater) {
    setUnavailability((current) => {
      const updated = structuredClone(current);

      for (const day of DAYS) {
        for (const { hour } of HOURS) {
          updated[day][hour] = updater(updated[day][hour], day, hour);
        }
      }

      return updated;
    });
  }

  function clearSelectedUser() {
    updateAllSlots((slot) => ({
      ...slot,
      normal: slot.normal.filter((user) => user !== selectedUser),
    }));
  }

  function hardClearSelectedUser() {
    updateAllSlots((slot) => ({
      normal: slot.normal.filter((user) => user !== selectedUser),
      fixed: slot.fixed.filter((user) => user !== selectedUser),
    }));
  }

  function markWholeDay(day) {
    setUnavailability((current) => {
      const updated = structuredClone(current);
      const everySlotSelected = HOURS.every(({ hour }) =>
        updated[day][hour].normal.includes(selectedUser),
      );

      for (const { hour } of HOURS) {
        const slot = updated[day][hour];
        updated[day][hour] = {
          ...slot,
          normal: everySlotSelected
            ? slot.normal.filter((user) => user !== selectedUser)
            : slot.normal.includes(selectedUser) || slot.fixed.includes(selectedUser)
              ? slot.normal
              : [...slot.normal, selectedUser],
        };
      }

      return updated;
    });
  }

  function markAllWeek() {
    const everySlotSelected = DAYS.every((day) =>
      HOURS.every(({ hour }) => unavailability[day][hour].normal.includes(selectedUser)),
    );

    updateAllSlots((slot) => ({
      ...slot,
      normal: everySlotSelected
        ? slot.normal.filter((user) => user !== selectedUser)
        : slot.normal.includes(selectedUser) || slot.fixed.includes(selectedUser)
          ? slot.normal
          : [...slot.normal, selectedUser],
    }));
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Weekly planner</p>
          <h1>Unavailable Schedule</h1>
        </div>
        <UserBadge user={selectedUserData} />
      </header>

      <main className="content">
        <section className="control-panel" aria-label="Unavailability controls">
          <div className="control-section">
            <span className="control-label">Editing user</span>
            <div className="user-selector">
              {USERS.map((user) => (
                <button
                  type="button"
                  key={user.id}
                  className={`user-button ${selectedUser === user.id ? "active" : ""}`}
                  style={{ "--user-color": user.color }}
                  onClick={() => setSelectedUser(user.id)}
                >
                  <span className="selector-colour" />
                  <span>{user.name}</span>
                  {selectedUser === user.id && <Check size={17} strokeWidth={3} />}
                </button>
              ))}
            </div>
          </div>

          <label className={`fixed-mode ${fixedMode ? "active" : ""}`}>
            <input
              type="checkbox"
              checked={fixedMode}
              onChange={(event) => setFixedMode(event.target.checked)}
            />
            <Lock size={16} />
            Fixed marker
          </label>

          <div className="global-actions">
            <button type="button" className="secondary-button" onClick={markAllWeek}>
              Mark / Clear Week
            </button>
            <button type="button" className="secondary-button" onClick={clearSelectedUser}>
              Clear {selectedUserData.name}
            </button>
            <button type="button" className="danger-button" onClick={hardClearSelectedUser}>
              <RotateCcw size={16} />
              Hard Clear {selectedUserData.name}
            </button>
          </div>
        </section>

        <section className="explanation" aria-label="Marker explanation">
          <strong>Normal marks</strong> show when someone is unavailable and can be removed with Clear. <strong>Fixed marks</strong> use the lock mode, survive Clear, and only disappear with Hard Clear.
        </section>

        <section className="legend" aria-label="User color legend">
          {USERS.map((user) => (
            <UserBadge key={user.id} user={user} compact />
          ))}
        </section>

        <section className="schedule-section" aria-label="Weekly timetable">
          <div className="schedule-scroll">
            <div className="schedule-grid">
              <div className="corner-cell">TIME</div>
              {DAYS.map((day) => (
                <div className="day-header" key={day}>
                  <strong>{day}</strong>
                  <button
                    type="button"
                    className="whole-day-button"
                    onClick={() => markWholeDay(day)}
                  >
                    mark day
                  </button>
                </div>
              ))}

              {HOURS.flatMap(({ hour, label, endLabel }) => [
                <div className="time-cell" key={`time-${hour}`}>
                  <strong>{label}</strong>
                  <small>{endLabel}</small>
                </div>,
                ...DAYS.map((day) => (
                  <UnavailabilityCell
                    key={`${day}-${hour}`}
                    day={day}
                    hour={hour}
                    selectedUser={selectedUser}
                    slot={unavailability[day][hour]}
                    fixedMode={fixedMode}
                    onToggle={toggleUnavailability}
                  />
                )),
              ])}
            </div>
          </div>
        </section>

        <section className="common-section" aria-label="Everyone available">
          <div className="common-heading">
            <div>
              <p className="eyebrow">Everyone available</p>
              <h2>Open slots</h2>
            </div>
            <div className="common-count">
              {openSlots.length}
              <span>slots</span>
            </div>
          </div>

          {openSlots.length === 0 ? (
            <div className="no-common">No hour is currently open for all four people.</div>
          ) : (
            <div className="common-list">
              {openSlots.map((slot) => (
                <div className="common-slot" key={`${slot.day}-${slot.hour}`}>
                  <strong>{slot.day}</strong>
                  <span>
                    {slot.label} to {String(slot.hour + 1).padStart(2, "0")}:00
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
