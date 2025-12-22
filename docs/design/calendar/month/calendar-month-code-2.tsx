"use client"

import { useState } from "react"
import { TopBar } from "@/components/wall-hub/top-bar"
import { mockFamilyMembers } from "@/lib/mock-data"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight } from "lucide-react"

export default function SchedulePage() {
  const [currentDate, setCurrentDate] = useState(new Date(2023, 9, 23)) // Oct 23, 2023
  const [selectedMember, setSelectedMember] = useState<string>("everyone")
  const [view, setView] = useState<"today" | "week" | "day" | "month">("week")

  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() - 7)
    setCurrentDate(newDate)
  }

  const goToNextWeek = () => {
    const newDate = new Date(currentDate)
    newDate.setDate(currentDate.getDate() + 7)
    setCurrentDate(newDate)
  }

  const getWeekDates = () => {
    const dates = []
    const startOfWeek = new Date(currentDate)
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay() + 1) // Monday

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek)
      date.setDate(startOfWeek.getDate() + i)
      dates.push(date)
    }
    return dates
  }

  const getMonthDates = () => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const startingDayOfWeek = firstDay.getDay()

    const dates = []
    // Add previous month days
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month, -i)
      dates.push({ date, isCurrentMonth: false })
    }

    // Add current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      dates.push({ date: new Date(year, month, i), isCurrentMonth: true })
    }

    // Add next month days to complete the grid
    const remainingDays = 42 - dates.length // 6 weeks * 7 days
    for (let i = 1; i <= remainingDays; i++) {
      dates.push({ date: new Date(year, month + 1, i), isCurrentMonth: false })
    }

    return dates
  }

  const weekDates = getWeekDates()
  const monthDates = getMonthDates()

  const mockEvents = [
    { day: 1, time: "8:00 AM", title: "School Drop-off", color: "#4C9AFF" },
    { day: 1, time: "4:00 PM", title: "Soccer Practice", location: "City Fields", color: "#4C9AFF", assignee: "Leo" },
    { day: 1, time: "6:00 PM", title: "Gym Session", color: "#9C27B0", assignees: ["D", "M"] },
    { day: 2, time: "8:00 AM", title: "School Drop-off", color: "#4C9AFF" },
    { day: 2, time: "5:00 PM", title: "Piano Lesson", color: "#FF6B6B", assignee: "Leo" },
    { day: 2, time: "6:30 PM", title: "Family Dinner", color: "#00C896" },
    { day: 3, time: "8:00 AM", title: "School Drop-off", color: "#4C9AFF" },
    { day: 3, time: "5:30 PM", title: "Grocery Run", color: "#FF6B6B" },
    { day: 4, time: "8:00 AM", title: "School Drop-off", color: "#4C9AFF" },
    { day: 5, time: "8:00 AM", title: "School Drop-off", color: "#4C9AFF" },
    { day: 5, time: "7:00 PM", title: "Date Night ❤️", location: "Downtown", color: "#FF6B6B", assignees: ["D", "M"] },
    { day: 6, time: "9:00 AM", title: "Pancakes", color: "#FFB84D" },
    { day: 6, time: "11:00 AM", title: "Birthday Party", location: "Max's House", color: "#FFB84D" },
    { day: 0, time: "10:00 AM", title: "Church", color: "#9C27B0" },
    { day: 0, time: "12:00 PM", title: "Family Brunch", color: "#00C896" },
  ]

  const getEventsForDay = (dayIndex: number) => {
    return mockEvents.filter((e) => e.day === dayIndex)
  }

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: "var(--color-surface)" }}>
      <TopBar familyName="FAMILY OS" showWeather />

      <div className="flex-1 overflow-hidden flex flex-col p-8">
        <div className="max-w-7xl mx-auto w-full flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button onClick={goToPreviousWeek} variant="ghost" size="icon" className="touch-target-lg">
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                  {view === "month"
                    ? currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
                    : `Oct 23 - Oct 29`}
                </h1>
                <p className="text-base" style={{ color: "var(--color-text-secondary)" }}>
                  Manage your family's weekly rhythm
                </p>
              </div>
              <Button onClick={goToNextWeek} variant="ghost" size="icon" className="touch-target-lg">
                <ChevronRight className="w-6 h-6" />
              </Button>
            </div>

            <div className="flex items-center gap-4">
              {/* Streak Badge */}
              <div
                className="flex items-center gap-2 px-4 py-2 rounded-full"
                style={{ backgroundColor: "#D4F4E8", border: "2px solid #00C896" }}
              >
                <span className="text-xl">🔥</span>
                <div>
                  <div className="text-xs font-medium" style={{ color: "var(--color-text-secondary)" }}>
                    STREAK
                  </div>
                  <div className="text-lg font-bold" style={{ color: "#00C896" }}>
                    85%
                  </div>
                </div>
              </div>

              {/* View Toggles */}
              <div
                className="flex gap-2 border rounded-lg p-1"
                style={{ borderColor: "var(--color-border)", backgroundColor: "white" }}
              >
                <Button
                  size="sm"
                  variant={view === "today" ? "default" : "ghost"}
                  onClick={() => setView("today")}
                  style={view === "today" ? { backgroundColor: "#00C896", color: "white" } : {}}
                >
                  Today
                </Button>
                <Button
                  size="sm"
                  variant={view === "week" ? "default" : "ghost"}
                  onClick={() => setView("week")}
                  style={view === "week" ? { backgroundColor: "#00C896", color: "white" } : {}}
                >
                  Week
                </Button>
                <Button
                  size="sm"
                  variant={view === "day" ? "default" : "ghost"}
                  onClick={() => setView("day")}
                  style={view === "day" ? { backgroundColor: "#00C896", color: "white" } : {}}
                >
                  Day
                </Button>
                <Button
                  size="sm"
                  variant={view === "month" ? "default" : "ghost"}
                  onClick={() => setView("month")}
                  style={view === "month" ? { backgroundColor: "#00C896", color: "white" } : {}}
                >
                  Month
                </Button>
              </div>
            </div>
          </div>

          {/* Family Member Filter */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setSelectedMember("everyone")}
              className={`flex items-center gap-2 px-6 py-3 rounded-full touch-target-lg ${
                selectedMember === "everyone" ? "font-bold" : ""
              }`}
              style={
                selectedMember === "everyone"
                  ? { backgroundColor: "var(--color-text-primary)", color: "white" }
                  : { backgroundColor: "white", color: "var(--color-text-secondary)" }
              }
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z" />
              </svg>
              <span>Everyone</span>
            </button>
            {mockFamilyMembers.map((member) => (
              <button
                key={member.id}
                onClick={() => setSelectedMember(member.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-full touch-target-lg ${
                  selectedMember === member.id ? "font-bold" : ""
                }`}
                style={
                  selectedMember === member.id
                    ? { backgroundColor: member.avatarColor, color: "white" }
                    : { backgroundColor: "white", color: "var(--color-text-secondary)" }
                }
              >
                <Avatar className="w-6 h-6">
                  <AvatarFallback style={{ backgroundColor: member.avatarColor, color: "white", fontSize: "12px" }}>
                    {member.name.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span>{member.name}</span>
              </button>
            ))}
          </div>

          {view === "month" ? (
            // Month View
            <div className="flex-1 overflow-auto">
              <div className="grid grid-cols-7 gap-2 mb-2">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                  <div
                    key={day}
                    className="text-center text-sm font-bold py-2"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-2">
                {monthDates.map((dateObj, idx) => {
                  const isToday = dateObj.date.toDateString() === new Date(2023, 9, 24).toDateString()
                  return (
                    <div
                      key={idx}
                      className={`aspect-square p-3 rounded-xl ${!dateObj.isCurrentMonth ? "opacity-40" : ""}`}
                      style={{
                        backgroundColor: isToday ? "#00C896" : "white",
                        border: isToday ? "none" : "1px solid var(--color-border)",
                      }}
                    >
                      <div
                        className="text-lg font-bold mb-1"
                        style={{ color: isToday ? "white" : "var(--color-text-primary)" }}
                      >
                        {dateObj.date.getDate()}
                      </div>
                      <div className="space-y-1">
                        {[1, 2].map((i) => (
                          <div
                            key={i}
                            className="w-full h-1 rounded-full"
                            style={{ backgroundColor: isToday ? "white" : "#00C896", opacity: 0.5 }}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto overflow-y-hidden">
              <div className="inline-flex gap-4 min-w-max pb-4">
                {weekDates.map((date, idx) => {
                  const isToday = idx === 1 // Tuesday in mockup
                  const dayName = date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()
                  const dayNum = date.getDate()
                  const dayEvents = getEventsForDay(idx)

                  return (
                    <div key={idx} className="flex flex-col w-72" style={{ minWidth: "288px" }}>
                      {/* Day Header */}
                      <div
                        className={`rounded-t-2xl p-4 text-center ${isToday ? "border-2" : ""}`}
                        style={
                          isToday
                            ? { backgroundColor: "#00C896", borderColor: "#00C896" }
                            : { backgroundColor: "white" }
                        }
                      >
                        <div
                          className="text-sm font-medium mb-1"
                          style={{ color: isToday ? "white" : "var(--color-text-secondary)" }}
                        >
                          {dayName}
                        </div>
                        <div
                          className="text-3xl font-bold"
                          style={{ color: isToday ? "white" : "var(--color-text-primary)" }}
                        >
                          {dayNum}
                        </div>
                        {isToday && (
                          <div
                            className="mt-2 px-3 py-1 rounded-full text-xs font-bold inline-block"
                            style={{ backgroundColor: "white", color: "#00C896" }}
                          >
                            TODAY
                          </div>
                        )}
                        {idx === 0 && (
                          <div className="mt-2 text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                            4/5
                          </div>
                        )}
                      </div>

                      {/* Events Column - with vertical scroll */}
                      <div
                        className="rounded-b-2xl p-4 space-y-3 flex-1 overflow-y-auto"
                        style={{ backgroundColor: "#F8F9FA", maxHeight: "600px" }}
                      >
                        {dayEvents.map((event, eventIdx) => (
                          <div
                            key={eventIdx}
                            className="p-4 rounded-xl border-l-4"
                            style={{
                              backgroundColor: "white",
                              borderLeftColor: event.color,
                            }}
                          >
                            <div className="text-xs font-medium mb-2" style={{ color: event.color }}>
                              {event.time}
                            </div>
                            <div className="font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>
                              {event.title}
                            </div>
                            {event.location && (
                              <div
                                className="flex items-center gap-1 text-xs"
                                style={{ color: "var(--color-text-secondary)" }}
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {event.location}
                              </div>
                            )}
                            {event.assignee && (
                              <div className="flex items-center gap-1 mt-2">
                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                  <circle cx="12" cy="8" r="4" />
                                  <path d="M12 14c-6 0-8 3-8 3v2h16v-2s-2-3-8-3z" />
                                </svg>
                                <span className="text-xs" style={{ color: "var(--color-text-secondary)" }}>
                                  {event.assignee}
                                </span>
                              </div>
                            )}
                            {event.assignees && (
                              <div className="flex gap-1 mt-2">
                                {event.assignees.map((a, i) => (
                                  <div
                                    key={i}
                                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                                    style={{ backgroundColor: i === 0 ? "#4C9AFF" : "#FF6B6B", color: "white" }}
                                  >
                                    {a}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Bottom Section */}
                      <div className="p-4 bg-white rounded-b-2xl border-t" style={{ borderColor: "#E0E0E0" }}>
                        {idx === 1 && (
                          <div className="space-y-2">
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border-2 border-dashed border-blue-200">
                              <input type="checkbox" className="w-5 h-5 rounded" style={{ accentColor: "#4C9AFF" }} />
                              <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                                Read 20 mins
                              </span>
                            </label>
                            <label className="flex items-center gap-3 p-3 rounded-lg bg-blue-50 border-2 border-dashed border-blue-200">
                              <input type="checkbox" className="w-5 h-5 rounded" style={{ accentColor: "#4C9AFF" }} />
                              <span className="text-sm font-medium" style={{ color: "var(--color-text-primary)" }}>
                                Pack Lunches
                              </span>
                            </label>
                          </div>
                        )}
                        {idx === 0 && (
                          <label className="flex items-center gap-3 p-3 rounded-lg bg-green-50">
                            <input
                              type="checkbox"
                              checked
                              readOnly
                              className="w-5 h-5 rounded"
                              style={{ accentColor: "#00C896" }}
                            />
                            <span
                              className="text-sm font-medium line-through"
                              style={{ color: "var(--color-text-tertiary)" }}
                            >
                              Trash to Curb
                            </span>
                          </label>
                        )}
                        {idx > 2 && (
                          <div className="text-center text-sm" style={{ color: "var(--color-text-tertiary)" }}>
                            {["3 Routines", "4 Routines", "3 Routines", "Clean Room", "Meal Prep"][idx - 3]}
                          </div>
                        )}
                        {idx === 0 && idx !== 1 && (
                          <div className="text-center text-xs mt-2" style={{ color: "var(--color-text-tertiary)" }}>
                            Free Time ⛱️
                          </div>
                        )}
                        {idx === 6 && (
                          <div className="text-center text-xs" style={{ color: "var(--color-text-tertiary)" }}>
                            Nap Time 😴
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
