import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Lock,
  RotateCcw,
  Users,
} from "lucide-react";

import { supabase } from "./lib/supabase";

const USERS = [
  {
    id: "MIGUEL",
    name: "MIGUEL",
    color: "#2563eb",
  },
  {
    id: "JOAO",
    name: "JOAO",
    color: "#16a34a",
  },
  {
    id: "TOME",
    name: "TOME",
    color: "#9333ea",
  },
  {
    id: "PEDRO",
    name: "PEDRO",
    color: "#e5484d",
  },
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

const HOURS = Array.from(
  { length: END_HOUR - START_HOUR },
  (_, index) => {
    const hour = START_HOUR + index;

    return {
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      endLabel: `${String(hour + 1).padStart(2, "0")}:00`,
    };
  },
);

function emptySlot() {
  return {
    normal: [],
    fixed: [],
  };
}

function getEmptyUnavailability() {
  return Object.fromEntries(
    DAYS.map((day) => [
      day,
      Object.fromEntries(
        HOURS.map(({ hour }) => [
          hour,
          emptySlot(),
        ]),
      ),
    ]),
  );
}

function getSlotUsers(slot) {
  return [
    ...new Set([
      ...(slot?.normal ?? []),
      ...(slot?.fixed ?? []),
    ]),
  ];
}

function recordsToUnavailability(records) {
  const result = getEmptyUnavailability();

  for (const record of records) {
    if (!result[record.day]?.[record.hour]) {
      continue;
    }

    const target = record.fixed
      ? result[record.day][record.hour].fixed
      : result[record.day][record.hour].normal;

    if (!target.includes(record.user_id)) {
      target.push(record.user_id);
    }
  }

  return result;
}

function getISOWeekValue(date = new Date()) {
  const target = new Date(
    Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
    ),
  );

  const dayNumber = target.getUTCDay() || 7;

  target.setUTCDate(
    target.getUTCDate() + 4 - dayNumber,
  );

  const yearStart = new Date(
    Date.UTC(target.getUTCFullYear(), 0, 1),
  );

  const weekNumber = Math.ceil(
    ((target - yearStart) / 86400000 + 1) / 7,
  );

  return `${target.getUTCFullYear()}-W${String(
    weekNumber,
  ).padStart(2, "0")}`;
}

function getMondayFromWeekValue(weekValue) {
  const match =
    /^(\d{4})-W(\d{2})$/.exec(weekValue);

  if (!match) {
    return new Date();
  }

  const year = Number(match[1]);
  const week = Number(match[2]);

  const fourthJanuary = new Date(
    Date.UTC(year, 0, 4),
  );

  const fourthJanuaryDay =
    fourthJanuary.getUTCDay() || 7;

  const monday = new Date(fourthJanuary);

  monday.setUTCDate(
    fourthJanuary.getUTCDate() -
      fourthJanuaryDay +
      1 +
      (week - 1) * 7,
  );

  return monday;
}

function getWeekDateRange(weekValue) {
  const monday =
    getMondayFromWeekValue(weekValue);

  const sunday = new Date(monday);

  sunday.setUTCDate(
    sunday.getUTCDate() + 6,
  );

  const formatter = new Intl.DateTimeFormat(
    "en-GB",
    {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    },
  );

  return `${formatter.format(
    monday,
  )} to ${formatter.format(sunday)}`;
}

function shiftWeek(weekValue, amount) {
  const monday =
    getMondayFromWeekValue(weekValue);

  monday.setUTCDate(
    monday.getUTCDate() + amount * 7,
  );

  return getISOWeekValue(
    new Date(
      monday.getUTCFullYear(),
      monday.getUTCMonth(),
      monday.getUTCDate(),
    ),
  );
}

function UserBadge({
  user,
  compact = false,
}) {
  return (
    <span
      className={`user-badge ${
        compact
          ? "user-badge-compact"
          : ""
      }`}
      style={{
        "--user-color": user.color,
      }}
    >
      <span className="user-dot" />
      {user.name}
    </span>
  );
}

function UnavailabilityCell({
  day,
  hour,
  selectedUser,
  slot,
  fixedMode,
  onToggle,
  disabled,
}) {
  const unavailableUserIds =
    getSlotUsers(slot);

  const users = USERS.filter((user) =>
    unavailableUserIds.includes(user.id),
  );

  const selectedNormal =
    slot.normal.includes(selectedUser);

  const selectedFixed =
    slot.fixed.includes(selectedUser);

  const selected =
    selectedNormal || selectedFixed;

  const everyoneUnavailable =
    users.length === USERS.length;

  const label =
    users.length === 0
      ? `${day} ${hour}:00, nobody marked unavailable`
      : `${day} ${hour}:00, unavailable: ${users
          .map((user) => user.name)
          .join(", ")}`;

  return (
    <button
      type="button"
      className={`availability-cell ${
        selected
          ? "selected-by-current-user"
          : ""
      } ${
        everyoneUnavailable
          ? "everyone-available"
          : ""
      } ${
        selectedFixed
          ? "fixed-by-current-user"
          : ""
      }`}
      onClick={() => onToggle(day, hour)}
      disabled={disabled}
      aria-label={`${label}${
        selectedFixed
          ? ", fixed marker"
          : ""
      }`}
      title={
        fixedMode
          ? "Fixed mode: click to toggle a protected unavailable marker"
          : undefined
      }
    >
      {users.length === 0 ? (
        <span className="empty-cell-text">
          +
        </span>
      ) : (
        <span
          className="availability-segments"
          style={{
            gridTemplateColumns: `repeat(${users.length}, minmax(0, 1fr))`,
          }}
        >
          {users.map((user) => (
            <span
              key={user.id}
              className={`availability-segment ${
                slot.fixed.includes(user.id)
                  ? "fixed-segment"
                  : ""
              }`}
              style={{
                backgroundColor: user.color,
              }}
            />
          ))}
        </span>
      )}

      {selected && (
        <span
          className="selected-check"
          aria-hidden="true"
        >
          {selectedFixed ? (
            <Lock
              size={12}
              strokeWidth={3}
            />
          ) : (
            <Check
              size={12}
              strokeWidth={4}
            />
          )}
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
  const [
    selectedUser,
    setSelectedUser,
  ] = useState("MIGUEL");

  const [
    fixedMode,
    setFixedMode,
  ] = useState(false);

  const [
    selectedWeek,
    setSelectedWeek,
  ] = useState(() =>
    getISOWeekValue(),
  );

  const [
    unavailability,
    setUnavailability,
  ] = useState(
    getEmptyUnavailability,
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState(null);

  const loadUnavailability =
    useCallback(async () => {
      try {
        setError(null);

        const {
          data,
          error: loadError,
        } = await supabase
          .from("unavailable_slots")
          .select(
            "id, user_id, day, hour, fixed, created_at",
          );

        if (loadError) {
          throw loadError;
        }

        setUnavailability(
          recordsToUnavailability(
            data ?? [],
          ),
        );
      } catch (loadError) {
        console.error(
          "Could not load unavailable slots:",
          loadError,
        );

        setError(
          loadError.message ??
            "Could not load availability.",
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    loadUnavailability();

    const channel = supabase
      .channel(
        "weekly-availability-live",
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "unavailable_slots",
        },
        () => {
          loadUnavailability();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadUnavailability]);

  const selectedUserData = useMemo(
    () =>
      USERS.find(
        (user) =>
          user.id === selectedUser,
      ),
    [selectedUser],
  );

  const weekDateRange = useMemo(
    () =>
      getWeekDateRange(selectedWeek),
    [selectedWeek],
  );

  const openSlots = useMemo(() => {
    const slots = [];

    for (const day of DAYS) {
      for (const {
        hour,
        label,
      } of HOURS) {
        if (
          getSlotUsers(
            unavailability[day][hour],
          ).length === 0
        ) {
          slots.push({
            day,
            hour,
            label,
          });
        }
      }
    }

    return slots;
  }, [unavailability]);

  async function toggleUnavailability(
    day,
    hour,
  ) {
    if (saving) {
      return;
    }

    const slot =
      unavailability[day][hour];

    setSaving(true);
    setError(null);

    try {
      if (fixedMode) {
        const isFixed =
          slot.fixed.includes(
            selectedUser,
          );

        const {
          error: normalDeleteError,
        } = await supabase
          .from("unavailable_slots")
          .delete()
          .eq(
            "user_id",
            selectedUser,
          )
          .eq("day", day)
          .eq("hour", hour)
          .eq("fixed", false);

        if (normalDeleteError) {
          throw normalDeleteError;
        }

        if (isFixed) {
          const {
            error: fixedDeleteError,
          } = await supabase
            .from(
              "unavailable_slots",
            )
            .delete()
            .eq(
              "user_id",
              selectedUser,
            )
            .eq("day", day)
            .eq("hour", hour)
            .eq("fixed", true);

          if (fixedDeleteError) {
            throw fixedDeleteError;
          }
        } else {
          const {
            error: insertError,
          } = await supabase
            .from(
              "unavailable_slots",
            )
            .insert({
              user_id:
                selectedUser,
              day,
              hour,
              fixed: true,
            });

          if (
            insertError &&
            insertError.code !==
              "23505"
          ) {
            throw insertError;
          }
        }
      } else {
        const isNormal =
          slot.normal.includes(
            selectedUser,
          );

        if (isNormal) {
          const {
            error: deleteError,
          } = await supabase
            .from(
              "unavailable_slots",
            )
            .delete()
            .eq(
              "user_id",
              selectedUser,
            )
            .eq("day", day)
            .eq("hour", hour)
            .eq("fixed", false);

          if (deleteError) {
            throw deleteError;
          }
        } else {
          const {
            error: insertError,
          } = await supabase
            .from(
              "unavailable_slots",
            )
            .insert({
              user_id:
                selectedUser,
              day,
              hour,
              fixed: false,
            });

          if (
            insertError &&
            insertError.code !==
              "23505"
          ) {
            throw insertError;
          }
        }
      }

      await loadUnavailability();
    } catch (toggleError) {
      console.error(
        "Could not update slot:",
        toggleError,
      );

      setError(
        toggleError.message ??
          "Could not save the slot.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function clearSelectedUser() {
    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const {
        error: deleteError,
      } = await supabase
        .from("unavailable_slots")
        .delete()
        .eq(
          "user_id",
          selectedUser,
        )
        .eq("fixed", false);

      if (deleteError) {
        throw deleteError;
      }

      await loadUnavailability();
    } catch (clearError) {
      console.error(
        "Could not clear markers:",
        clearError,
      );

      setError(
        clearError.message ??
          "Could not clear markers.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function hardClearSelectedUser() {
    if (saving) {
      return;
    }

    const confirmed =
      window.confirm(
        `Hard Clear will remove ALL unavailable markers for ${selectedUser}, including Fixed markers. Continue?`,
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const {
        error: deleteError,
      } = await supabase
        .from("unavailable_slots")
        .delete()
        .eq(
          "user_id",
          selectedUser,
        );

      if (deleteError) {
        throw deleteError;
      }

      await loadUnavailability();
    } catch (clearError) {
      console.error(
        "Could not hard clear:",
        clearError,
      );

      setError(
        clearError.message ??
          "Could not hard clear markers.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function markWholeDay(day) {
    if (saving) {
      return;
    }

    const everySlotSelected =
      HOURS.every(({ hour }) =>
        unavailability[day][
          hour
        ].normal.includes(
          selectedUser,
        ),
      );

    setSaving(true);
    setError(null);

    try {
      if (everySlotSelected) {
        const {
          error: deleteError,
        } = await supabase
          .from("unavailable_slots")
          .delete()
          .eq(
            "user_id",
            selectedUser,
          )
          .eq("day", day)
          .eq("fixed", false);

        if (deleteError) {
          throw deleteError;
        }
      } else {
        const rows = HOURS.filter(
          ({ hour }) => {
            const slot =
              unavailability[day][hour];

            return (
              !slot.normal.includes(
                selectedUser,
              ) &&
              !slot.fixed.includes(
                selectedUser,
              )
            );
          },
        ).map(({ hour }) => ({
          user_id: selectedUser,
          day,
          hour,
          fixed: false,
        }));

        if (rows.length > 0) {
          const {
            error: insertError,
          } = await supabase
            .from("unavailable_slots")
            .insert(rows);

          if (
            insertError &&
            insertError.code !==
              "23505"
          ) {
            throw insertError;
          }
        }
      }

      await loadUnavailability();
    } catch (dayError) {
      console.error(
        "Could not update day:",
        dayError,
      );

      setError(
        dayError.message ??
          "Could not update day.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function markAllWeek() {
    if (saving) {
      return;
    }

    const everySlotSelected =
      DAYS.every((day) =>
        HOURS.every(({ hour }) =>
          unavailability[day][
            hour
          ].normal.includes(
            selectedUser,
          ),
        ),
      );

    setSaving(true);
    setError(null);

    try {
      if (everySlotSelected) {
        const {
          error: deleteError,
        } = await supabase
          .from("unavailable_slots")
          .delete()
          .eq(
            "user_id",
            selectedUser,
          )
          .eq("fixed", false);

        if (deleteError) {
          throw deleteError;
        }
      } else {
        const rows = [];

        for (const day of DAYS) {
          for (const {
            hour,
          } of HOURS) {
            const slot =
              unavailability[day][hour];

            const alreadyMarked =
              slot.normal.includes(
                selectedUser,
              ) ||
              slot.fixed.includes(
                selectedUser,
              );

            if (!alreadyMarked) {
              rows.push({
                user_id:
                  selectedUser,
                day,
                hour,
                fixed: false,
              });
            }
          }
        }

        if (rows.length > 0) {
          const {
            error: insertError,
          } = await supabase
            .from("unavailable_slots")
            .insert(rows);

          if (
            insertError &&
            insertError.code !==
              "23505"
          ) {
            throw insertError;
          }
        }
      }

      await loadUnavailability();
    } catch (weekError) {
      console.error(
        "Could not update week:",
        weekError,
      );

      setError(
        weekError.message ??
          "Could not update week.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="app">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              Weekly planner
            </p>

            <h1>
              Unavailable Schedule
            </h1>
          </div>
        </header>

        <main className="content">
          <section className="explanation">
            Loading shared schedule...
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <p className="eyebrow">
            Weekly planner
          </p>

          <h1>
            Unavailable Schedule
          </h1>
        </div>

        <UserBadge
          user={selectedUserData}
        />
      </header>

      <main className="content">
        {error && (
          <section className="explanation error-message">
            <strong>
              Database error:
            </strong>{" "}
            {error}
          </section>
        )}

        <section
          className="calendar-week-panel"
          aria-label="Week selector"
        >
          <div className="calendar-week-info">
            <CalendarDays size={20} />

            <div>
              <span>
                Selected week
              </span>

              <strong>
                {weekDateRange}
              </strong>
            </div>
          </div>

          <div className="calendar-week-controls">
            <button
              type="button"
              className="week-nav-button"
              onClick={() =>
                setSelectedWeek(
                  shiftWeek(
                    selectedWeek,
                    -1,
                  ),
                )
              }
              aria-label="Previous week"
            >
              <ChevronLeft size={18} />
            </button>

            <input
              type="week"
              className="week-input"
              value={selectedWeek}
              onChange={(event) =>
                setSelectedWeek(
                  event.target.value,
                )
              }
            />

            <button
              type="button"
              className="week-nav-button"
              onClick={() =>
                setSelectedWeek(
                  shiftWeek(
                    selectedWeek,
                    1,
                  ),
                )
              }
              aria-label="Next week"
            >
              <ChevronRight size={18} />
            </button>

            <button
              type="button"
              className="current-week-button"
              onClick={() =>
                setSelectedWeek(
                  getISOWeekValue(),
                )
              }
            >
              Current week
            </button>
          </div>
        </section>

        <section
          className="control-panel"
          aria-label="Unavailability controls"
        >
          <div className="control-section">
            <span className="control-label">
              Editing user
            </span>

            <div className="user-selector">
              {USERS.map((user) => (
                <button
                  type="button"
                  key={user.id}
                  className={`user-button ${
                    selectedUser === user.id
                      ? "active"
                      : ""
                  }`}
                  style={{
                    "--user-color":
                      user.color,
                  }}
                  onClick={() =>
                    setSelectedUser(
                      user.id,
                    )
                  }
                  disabled={saving}
                >
                  <span className="selector-colour" />
                  <span>{user.name}</span>

                  {selectedUser ===
                    user.id && (
                    <Check
                      size={17}
                      strokeWidth={3}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>

          <label
            className={`fixed-mode ${
              fixedMode
                ? "active"
                : ""
            }`}
          >
            <input
              type="checkbox"
              checked={fixedMode}
              onChange={(event) =>
                setFixedMode(
                  event.target.checked,
                )
              }
              disabled={saving}
            />

            <Lock size={16} />
            Fixed marker
          </label>

          <div className="global-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={markAllWeek}
              disabled={saving}
            >
              Mark / Clear Week
            </button>

            <button
              type="button"
              className="secondary-button"
              onClick={
                clearSelectedUser
              }
              disabled={saving}
            >
              Clear{" "}
              {selectedUserData.name}
            </button>

            <button
              type="button"
              className="danger-button"
              onClick={
                hardClearSelectedUser
              }
              disabled={saving}
            >
              <RotateCcw size={16} />

              Hard Clear{" "}
              {selectedUserData.name}
            </button>
          </div>
        </section>

        <section
          className="explanation"
          aria-label="Marker explanation"
        >
          <strong>
            Normal marks
          </strong>{" "}
          show when someone is
          unavailable and can be
          removed with Clear.{" "}
          <strong>
            Fixed marks
          </strong>{" "}
          use the lock mode, survive
          Clear, and only disappear
          with Hard Clear.

          {saving && (
            <>
              {" "}
              <strong>
                Saving...
              </strong>
            </>
          )}
        </section>

        <section
          className="legend"
          aria-label="User colour legend"
        >
          {USERS.map((user) => (
            <UserBadge
              key={user.id}
              user={user}
              compact
            />
          ))}
        </section>

        <section
          className="schedule-section"
          aria-label="Weekly timetable"
        >
          <div className="schedule-scroll">
            <div className="schedule-grid">
              <div className="corner-cell">
                TIME
              </div>

              {DAYS.map((day) => (
                <div
                  className="day-header"
                  key={day}
                >
                  <strong>
                    {day}
                  </strong>

                  <button
                    type="button"
                    className="whole-day-button"
                    onClick={() =>
                      markWholeDay(day)
                    }
                    disabled={saving}
                  >
                    mark day
                  </button>
                </div>
              ))}

              {HOURS.flatMap(
                ({
                  hour,
                  label,
                  endLabel,
                }) => [
                  <div
                    className="time-cell"
                    key={`time-${hour}`}
                  >
                    <strong>
                      {label}
                    </strong>

                    <small>
                      {endLabel}
                    </small>
                  </div>,

                  ...DAYS.map(
                    (day) => (
                      <UnavailabilityCell
                        key={`${day}-${hour}`}
                        day={day}
                        hour={hour}
                        selectedUser={
                          selectedUser
                        }
                        slot={
                          unavailability[
                            day
                          ][hour]
                        }
                        fixedMode={
                          fixedMode
                        }
                        onToggle={
                          toggleUnavailability
                        }
                        disabled={
                          saving
                        }
                      />
                    ),
                  ),
                ],
              )}
            </div>
          </div>
        </section>

        <section
          className="common-section"
          aria-label="Everyone available"
        >
          <div className="common-heading">
            <div>
              <p className="eyebrow">
                Everyone available
              </p>

              <h2>
                Open slots
              </h2>
            </div>

            <div className="common-count">
              {openSlots.length}
              <span>slots</span>
            </div>
          </div>

          {openSlots.length === 0 ? (
            <div className="no-common">
              No hour is currently
              open for all four
              people.
            </div>
          ) : (
            <div className="common-list">
              {openSlots.map(
                (slot) => (
                  <div
                    className="common-slot"
                    key={`${slot.day}-${slot.hour}`}
                  >
                    <strong>
                      {slot.day}
                    </strong>

                    <span>
                      {slot.label} to{" "}
                      {String(
                        slot.hour + 1,
                      ).padStart(
                        2,
                        "0",
                      )}
                      :00
                    </span>
                  </div>
                ),
              )}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}