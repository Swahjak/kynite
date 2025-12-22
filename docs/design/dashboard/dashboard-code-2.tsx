"use client"
import { TopBar } from "@/components/wall-hub/top-bar"
import { mockFamilyMembers, mockCalendarEvents } from "@/lib/mock-data"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Utensils, Droplet, HomeIcon, Heart, Clock } from "lucide-react"

export default function WallHubPage() {
  const currentTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })

  const currentDate = "Mon, Oct 24"

  const todayEvents = mockCalendarEvents.filter((event) => {
    const eventDate = new Date(event.startTime)
    const today = new Date()
    return eventDate.toDateString() === today.toDateString()
  })

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: "var(--color-surface)" }}>
      <TopBar
        familyName="The Smiths"
        showWeather
        weatherTemp="68°F"
        weatherCondition="Cloudy"
        currentDate={currentDate}
      />

      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-7xl mx-auto">
          {/* Greeting and Clock */}
          <div className="mb-8">
            <h2 className="text-3xl mb-2" style={{ color: "var(--color-text-secondary)" }}>
              Good Morning, The Smiths
            </h2>
            <div className="text-7xl font-bold" style={{ color: "var(--color-text-primary)" }}>
              {currentTime}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-8">
            {/* Left Column - Today's Flow */}
            <div className="col-span-2 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#00C896" }}
                  >
                    <Clock className="w-4 h-4 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                    Today's Flow
                  </h3>
                </div>
                <div
                  className="px-4 py-2 rounded-full text-sm font-medium"
                  style={{ backgroundColor: "#D4F4E8", color: "#00C896" }}
                >
                  3 Events Remaining
                </div>
              </div>

              {/* Current Event - NOW */}
              <div
                className="p-6 rounded-2xl border-l-4"
                style={{
                  backgroundColor: "white",
                  borderLeftColor: "#00C896",
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span
                        className="px-3 py-1 rounded-full text-sm font-bold"
                        style={{ backgroundColor: "#00C896", color: "white" }}
                      >
                        NOW
                      </span>
                      <span className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                        08:00 AM
                      </span>
                    </div>
                    <div className="text-sm mb-1" style={{ color: "var(--color-text-tertiary)" }}>
                      Until 10:00 AM
                    </div>
                  </div>
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#E8F5E9" }}
                  >
                    <svg className="w-8 h-8" fill="none" stroke="#00C896" viewBox="0 0 24 24">
                      <circle cx="12" cy="12" r="10" strokeWidth="2" />
                      <path d="M12 6v6l4 2" strokeWidth="2" />
                    </svg>
                  </div>
                </div>
                <h4 className="text-3xl font-bold mt-3 mb-2" style={{ color: "var(--color-text-primary)" }}>
                  Soccer Practice
                </h4>
                <div className="flex items-center gap-2 text-lg" style={{ color: "var(--color-text-secondary)" }}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>City Park Field 4</span>
                </div>
              </div>

              {/* Next Events */}
              <div className="p-6 rounded-2xl" style={{ backgroundColor: "white" }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-sm mb-1" style={{ color: "var(--color-text-tertiary)" }}>
                      NEXT
                    </div>
                    <div className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                      04:30 PM
                    </div>
                  </div>
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#FFF4E6" }}
                  >
                    <Utensils className="w-7 h-7" style={{ color: "#FFB84D" }} />
                  </div>
                </div>
                <h4 className="text-xl font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>
                  Dinner Prep
                </h4>
                <div className="text-base" style={{ color: "var(--color-text-secondary)" }}>
                  Kitchen Duty: Leo
                </div>
              </div>

              <div className="p-6 rounded-2xl" style={{ backgroundColor: "white" }}>
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-sm mb-1" style={{ color: "var(--color-text-tertiary)" }}>
                      LATER
                    </div>
                    <div className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                      07:00 PM
                    </div>
                  </div>
                  <div
                    className="w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#F3E5F5" }}
                  >
                    <svg className="w-7 h-7" fill="none" stroke="#9C27B0" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                    </svg>
                  </div>
                </div>
                <h4 className="text-xl font-bold mb-1" style={{ color: "var(--color-text-primary)" }}>
                  Reading Time
                </h4>
                <div className="text-base" style={{ color: "var(--color-text-secondary)" }}>
                  Quiet Hour
                </div>
              </div>
            </div>

            {/* Right Column - Active Timers & Weekly Stars */}
            <div className="space-y-6">
              {/* Active Timers */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: "#FFE0B2" }}
                  >
                    <Clock className="w-4 h-4" style={{ color: "#FFB84D" }} />
                  </div>
                  <h3 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                    Active Timers
                  </h3>
                </div>

                <div className="p-6 rounded-2xl mb-4" style={{ backgroundColor: "white" }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-bold" style={{ color: "var(--color-text-primary)" }}>
                      Screen Time
                    </h4>
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: "#E8F5E9" }}
                    >
                      <svg className="w-6 h-6" fill="#00C896" viewBox="0 0 24 24">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
                        <line x1="8" y1="21" x2="16" y2="21" stroke="#00C896" strokeWidth="2" />
                        <line x1="12" y1="17" x2="12" y2="21" stroke="#00C896" strokeWidth="2" />
                      </svg>
                    </div>
                  </div>
                  <div className="text-sm mb-2" style={{ color: "var(--color-text-secondary)" }}>
                    Leo's Tablet
                  </div>
                  <div className="text-5xl font-bold mb-2" style={{ color: "var(--color-text-primary)" }}>
                    12:43
                    <span className="text-2xl" style={{ color: "var(--color-text-tertiary)" }}>
                      min left
                    </span>
                  </div>
                  <div className="flex gap-2 mb-3">
                    <Button size="sm" variant="outline" className="text-sm bg-transparent">
                      + 15m
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-sm bg-transparent"
                      style={{ borderColor: "#FF6B6B", color: "#FF6B6B" }}
                    >
                      || Pause
                    </Button>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: "#F0F0F0" }}>
                    <div className="h-full rounded-full" style={{ backgroundColor: "#00C896", width: "65%" }} />
                  </div>
                </div>
              </div>

              {/* Weekly Stars */}
              <div>
                <div className="text-sm font-medium mb-3" style={{ color: "var(--color-text-tertiary)" }}>
                  WEEKLY STARS
                </div>
                {mockFamilyMembers
                  .filter((m) => m.role === "child")
                  .map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-4 rounded-xl mb-3"
                      style={{ backgroundColor: "white" }}
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="w-12 h-12">
                          <AvatarFallback style={{ backgroundColor: member.avatarColor, color: "white" }}>
                            {member.name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-bold" style={{ color: "var(--color-text-primary)" }}>
                            {member.name}
                          </div>
                          <div className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                            Level {Math.floor(member.starCount / 10)} Explorer
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <svg className="w-6 h-6" fill="#FFD700" viewBox="0 0 24 24">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                        <span className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
                          {member.starCount}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  className="p-4 rounded-xl flex flex-col items-center gap-2 touch-target-lg"
                  style={{ backgroundColor: "#00C896", color: "white" }}
                >
                  <Utensils className="w-8 h-8" />
                  <span className="text-sm font-medium">Dinner Mode</span>
                </button>
                <button
                  className="p-4 rounded-xl flex flex-col items-center gap-2 touch-target-lg"
                  style={{ backgroundColor: "white", color: "var(--color-text-primary)" }}
                >
                  <Droplet className="w-8 h-8" style={{ color: "#4C9AFF" }} />
                  <span className="text-sm font-medium">Water Plants</span>
                </button>
                <button
                  className="p-4 rounded-xl flex flex-col items-center gap-2 touch-target-lg"
                  style={{ backgroundColor: "white", color: "var(--color-text-primary)" }}
                >
                  <HomeIcon className="w-8 h-8" style={{ color: "#9C27B0" }} />
                  <span className="text-sm font-medium">15m Tidy</span>
                </button>
                <button
                  className="p-4 rounded-xl flex flex-col items-center gap-2 touch-target-lg"
                  style={{ backgroundColor: "white", color: "var(--color-text-primary)" }}
                >
                  <Heart className="w-8 h-8" style={{ color: "#FF6B6B" }} />
                  <span className="text-sm font-medium">Log Chore</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
