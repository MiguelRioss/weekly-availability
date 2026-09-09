import { useEffect, useMemo, useState } from "react";
import { Check, RotateCcw, Users } from "lucide-react";

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
const STORAGE_KEY = "weekly-availability";

const HOURS = Array.from({ length: END_HOUR - START_HOUR }, (_, index) => {
  const hour = START_HOUR + index;

  return {
    hour,
    label: `${String(hour).padStart(2, "0")}:00`,
    endLabel: `${String(hour + 1).padStart(2, "0")}:00`,
  };
});

function getEmptyAvailability() {
  return Object.fromEntries(
    DAYS.map((day) => [
      day,
      Object.fromEntries(HOURS.map(({ hour }) => [hour, []])),
    ]),
  );
}

function normalizeAvailability(value) {
  const base = getEmptyAvailability();
  const userIds = new Set(USERS.map((user) => user.id));

  for (const day of DAYS) {
    for (const { hour } of HOURS) {
      const savedUsers = value?.[day]?.[hour];

      if (Array.isArray(savedUsers)) {
        base[day][hour] = savedUsers.filter((userId) => userIds.has(userId));
      }
    }
  }

  return base;
}

function loadAvailability() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeAvailability(JSON.parse(saved)) : getEmptyAvailability();
  } catch {
    return getEmptyAvailability();
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

function AvailabilityCell({ day, hour, selectedUser, availableUsers, onToggle }) {
  const users = USERS.filter((user) => availableUsers.includes(user.id));
  const selected = availableUsers.includes(selectedUser);
  const everyoneAvailable = users.length === USERS.length;
  const label =
    users.length === 0
      ? `${day} ${hour}:00, nobody available`
      : `${day} ${hour}:00, available: ${users.map((user) => user.name).join(", ")}`;

  return (
    <button
      type="button"
      className={`availability-cell ${selected ? "selected-by-current-user" : ""} ${
        everyoneAvailable ? "everyone-available" : ""
      }`}
      onClick={() => onToggle(day, hour)}
      aria-label={label}
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
              className="availability-segment"
              style={{ backgroundColor: user.color }}
              title={user.name}
            />
          ))}
        </span>
      )}

      {selected && (
        <span className="selected-check" aria-hidden="true">
          <Check size={12} strokeWidth={4} />
        </span>
      )}

      {everyoneAvailable && (
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
  const [availability, setAvailability] = useState(loadAvailability);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(availability));
  }, [availability]);

  const selectedUserData = useMemo(
    () => USERS.find((user) => user.id === selectedUser),
    [selectedUser],
  );

  const commonSlots = useMemo(() => {
    const slots = [];

    for (const day of DAYS) {
      for (const { hour, label } of HOURS) {
        if (availability[day][hour].length === USERS.length) {
          slots.push({ day, hour, label });
        }
      }
    }

    return slots;
  }, [availability]);

  function toggleAvailability(day, hour) {
    setAvailability((current) => {
      const currentUsers = current[day][hour];
      const isAvailable = currentUsers.includes(selectedUser);
      const updatedUsers = isAvailable
        ? currentUsers.filter((user) => user !== selectedUser)
        : [...currentUsers, selectedUser];

      return {
        ...current,
        [day]: {
          ...current[day],
          [hour]: updatedUsers,
        },
      };
    });
  }

  function updateAllSlots(updater) {
    setAvailability((current) => {
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
    updateAllSlots((slot) => slot.filter((user) => user !== selectedUser));
  }

  function markWholeDay(day) {
    setAvailability((current) => {
      const updated = structuredClone(current);
      const everySlotSelected = HOURS.every(({ hour }) =>
        updated[day][hour].includes(selectedUser),
      );

      for (const { hour } of HOURS) {
        const slot = updated[day][hour];
        updated[day][hour] = everySlotSelected
          ? slot.filter((user) => user !== selectedUser)
          : slot.includes(selectedUser)
            ? slot
            : [...slot, selectedUser];
      }

      return updated;
    });
  }

  function markAllWeek() {
    const everySlotSelected = DAYS.every((day) =>
      HOURS.every(({ hour }) => availability[day][hour].includes(selectedUser)),
    );

    updateAllSlots((slot) =>
      everySlotSelected
        ? slot.filter((user) => user !== selectedUser)
        : slot.includes(selectedUser)
          ? slot
          : [...slot, selectedUser],
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">Weekly planner</p>
          <h1>Availability Schedule</h1>
        </div>
        <UserBadge user={selectedUserData} />
      </header>

      <main className="content">
        <section className="control-panel" aria-label="Availability controls">
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

          <div className="global-actions">
            <button type="button" className="secondary-button" onClick={markAllWeek}>
              Select / Clear Week
            </button>
            <button type="button" className="danger-button" onClick={clearSelectedUser}>
              <RotateCcw size={16} />
              Clear {selectedUserData.name}
            </button>
          </div>
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
                    whole day
                  </button>
                </div>
              ))}

              {HOURS.flatMap(({ hour, label, endLabel }) => [
                <div className="time-cell" key={`time-${hour}`}>
                  <strong>{label}</strong>
                  <small>{endLabel}</small>
                </div>,
                ...DAYS.map((day) => (
                  <AvailabilityCell
                    key={`${day}-${hour}`}
                    day={day}
                    hour={hour}
                    selectedUser={selectedUser}
                    availableUsers={availability[day][hour]}
                    onToggle={toggleAvailability}
                  />
                )),
              ])}
            </div>
          </div>
        </section>

        <section className="common-section" aria-label="Common availability">
          <div className="common-heading">
            <div>
              <p className="eyebrow">Everyone available</p>
              <h2>Common slots</h2>
            </div>
            <div className="common-count">
              {commonSlots.length}
              <span>slots</span>
            </div>
          </div>

          {commonSlots.length === 0 ? (
            <div className="no-common">No hour currently works for all four people.</div>
          ) : (
            <div className="common-list">
              {commonSlots.map((slot) => (
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
