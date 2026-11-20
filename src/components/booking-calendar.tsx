import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, Check, AlertCircle } from "lucide-react";
import { getAvailableSlots, type SlotAvailability } from "@/lib/booking-store";
import { type BookingSettings } from "@/lib/booking-types";

interface BookingCalendarProps {
  settings: BookingSettings;
  selectedDate: string; // YYYY-MM-DD
  selectedTime: string; // HH:MM
  onSelectDate: (date: string) => void;
  onSelectTime: (time: string) => void;
}

export function BookingCalendar({
  settings,
  selectedDate,
  selectedTime,
  onSelectDate,
  onSelectTime,
}: BookingCalendarProps) {
  const today = useMemo(() => new Date(), []);
  const todayStr = useMemo(() => today.toISOString().split("T")[0], [today]);

  const [currentMonth, setCurrentMonth] = useState(() => {
    if (selectedDate) {
      const [y, m] = selectedDate.split("-").map(Number);
      return new Date(y, m - 1, 1);
    }
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const monthName = currentMonth.toLocaleString("default", { month: "long" });

  // Can we navigate back? Only if currentMonth is after today's month
  const canGoPrev = useMemo(() => {
    const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    return currentMonth.getTime() > startOfThisMonth.getTime();
  }, [currentMonth, today]);

  function prevMonth() {
    if (!canGoPrev) return;
    setCurrentMonth(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    // allow up to 4 months in advance
    setCurrentMonth(new Date(year, month + 1, 1));
  }

  // Days in month calculation
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
    const totalDays = new Date(year, month + 1, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isDisabled: boolean }[] = [];

    // Empty lead cells
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ dateStr: "", dayNum: 0, isCurrentMonth: false, isDisabled: true });
    }

    for (let day = 1; day <= totalDays; day++) {
      const mm = String(month + 1).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      const dateStr = `${year}-${mm}-${dd}`;
      const dayOfWeek = new Date(year, month, day).getDay();

      const isPast = dateStr < todayStr;
      const isNotWorkingDay = !settings.workingDays.includes(dayOfWeek);
      const isBlocked = settings.blockedDates.includes(dateStr);

      const isDisabled = isPast || isNotWorkingDay || isBlocked;

      days.push({
        dateStr,
        dayNum: day,
        isCurrentMonth: true,
        isDisabled,
      });
    }

    return days;
  }, [year, month, todayStr, settings]);

  // Slots for currently selected date
  const slots: SlotAvailability[] = useMemo(() => {
    if (!selectedDate) return [];
    return getAvailableSlots(selectedDate);
  }, [selectedDate]);

  function formatTimeDisplay(hhmm: string): string {
    const [h, m] = hhmm.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const hour12 = h % 12 || 12;
    return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Left Column: Interactive Month Calendar */}
      <div className="lg:col-span-7 bg-charcoal text-paper p-6 md:p-8 rounded border border-rule-light shadow-xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-rule-light">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-gold-accent uppercase block">
              Step 03 · Calendar
            </span>
            <h3 className="text-xl md:text-2xl font-display font-medium text-paper">
              {monthName} {year}
            </h3>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={prevMonth}
              disabled={!canGoPrev}
              aria-label="Previous month"
              className="p-2 rounded border border-rule-light text-paper-soft hover:bg-paper/10 hover:text-paper disabled:opacity-30 disabled:pointer-events-none transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next month"
              className="p-2 rounded border border-rule-light text-paper-soft hover:bg-paper/10 hover:text-paper transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Days of week header */}
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d, idx) => (
            <span key={idx} className="text-[11px] font-bold text-paper-faint uppercase tracking-wider py-1">
              {d}
            </span>
          ))}
        </div>

        {/* Calendar days grid */}
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {calendarDays.map((cell, idx) => {
            if (!cell.isCurrentMonth) {
              return <div key={idx} className="h-10 md:h-12" />;
            }

            const isSelected = selectedDate === cell.dateStr;
            const isToday = todayStr === cell.dateStr;

            return (
              <button
                key={idx}
                type="button"
                disabled={cell.isDisabled}
                onClick={() => {
                  onSelectDate(cell.dateStr);
                  onSelectTime(""); // reset slot when date changes
                }}
                className={`h-10 md:h-12 w-full rounded flex flex-col items-center justify-center text-xs font-medium transition-all relative
                  ${cell.isDisabled ? "text-paper-faint/30 cursor-not-allowed bg-transparent" : "cursor-pointer"}
                  ${!cell.isDisabled && !isSelected ? "hover:bg-paper/15 text-paper" : ""}
                  ${isSelected ? "bg-primary text-primary-foreground font-bold shadow-md ring-2 ring-gold-accent" : ""}
                  ${isToday && !isSelected ? "border border-gold-accent/50 text-gold-accent" : ""}
                `}
              >
                <span>{cell.dayNum}</span>
                {isSelected && <span className="w-1 h-1 bg-gold-accent rounded-full mt-0.5" />}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 pt-4 border-t border-rule-light flex flex-wrap items-center justify-between gap-4 text-[11px] text-paper-muted">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary ring-1 ring-gold-accent" />
            <span>Selected Date</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full border border-gold-accent" />
            <span>Today</span>
          </div>
          <div className="flex items-center gap-1.5 text-gold-accent">
            <Clock className="w-3.5 h-3.5" />
            <span>{settings.businessTimezone}</span>
          </div>
        </div>
      </div>

      {/* Right Column: Time Slots Selection */}
      <div className="lg:col-span-5 bg-card border border-border p-6 md:p-8 rounded shadow-sm">
        <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
          <div>
            <span className="text-[10px] font-bold tracking-widest text-primary uppercase block">
              Available Sessions
            </span>
            <h4 className="text-xl font-display font-medium text-charcoal">
              {selectedDate
                ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-US", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })
                : "Select a Date"}
            </h4>
          </div>
          <CalendarIcon className="w-5 h-5 text-primary" />
        </div>

        {!selectedDate ? (
          <div className="py-12 text-center text-muted-foreground space-y-2">
            <CalendarIcon className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-xs">Please select an available date on the calendar to view consultation time slots.</p>
          </div>
        ) : slots.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground space-y-2">
            <AlertCircle className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-xs font-medium text-charcoal">No available consultation slots on this date.</p>
            <p className="text-[11px] text-muted-foreground">
              Please choose another weekday or reach out to our concierge for special arrangements.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2.5 max-h-[340px] overflow-y-auto pr-1">
              {slots.map((slot) => {
                const isSelected = selectedTime === slot.time;
                return (
                  <button
                    key={slot.time}
                    type="button"
                    disabled={!slot.isAvailable}
                    onClick={() => onSelectTime(slot.time)}
                    className={`p-3 rounded border text-xs font-semibold flex items-center justify-between transition-all
                      ${
                        !slot.isAvailable
                          ? "border-border/60 bg-muted/40 text-muted-foreground/40 cursor-not-allowed line-through"
                          : "cursor-pointer"
                      }
                      ${
                        slot.isAvailable && !isSelected
                          ? "border-border bg-background text-charcoal hover:border-primary hover:bg-primary/5"
                          : ""
                      }
                      ${
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow ring-1 ring-primary"
                          : ""
                      }
                    `}
                  >
                    <span>{formatTimeDisplay(slot.time)}</span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                  </button>
                );
              })}
            </div>

            {selectedTime && (
              <div className="p-3 bg-secondary/80 rounded border border-border text-xs text-charcoal flex items-center justify-between animate-fade-in">
                <span className="font-medium">Selected Slot:</span>
                <span className="font-bold text-olive-deep">
                  {formatTimeDisplay(selectedTime)} ({settings.slotDurationMinutes} min session)
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
