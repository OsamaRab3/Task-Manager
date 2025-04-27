"use client"

import { useState, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/components/ui/use-toast"
import { Calendar } from "@/components/ui/calendar"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"
import { format, parseISO, isToday, isYesterday, subDays, differenceInDays } from "date-fns"

// Format time (seconds) to readable format
const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  return `${hours > 0 ? `${hours}h ` : ""}${minutes}m ${secs}s`
}

// Format date for display
const formatDateDisplay = (dateStr: string) => {
  const date = parseISO(dateStr)
  if (isToday(date)) return "Today"
  if (isYesterday(date)) return "Yesterday"
  return format(date, "MMM d, yyyy")
}

type TaskHistoryItem = {
  date: string
  created: any[]
  completed: any[]
  timeSpent: number
}

type ContinuityData = {
  currentStreak: number
  longestStreak: number
  activeDays: number
  totalDays: number
  continuityPercentage: number
  activityByDate: Record<string, boolean>
}

export default function HistoryView() {
  const { data: session, status } = useSession()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(true)
  const [historyData, setHistoryData] = useState<TaskHistoryItem[]>([])
  const [continuityData, setContinuityData] = useState<ContinuityData | null>(null)
  const [dateRange, setDateRange] = useState("30")
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date())
  const [selectedDateTasks, setSelectedDateTasks] = useState<TaskHistoryItem | null>(null)

  // Fetch history data
  const fetchHistoryData = useCallback(async () => {
    if (status !== "authenticated") return

    try {
      setIsLoading(true)
      const response = await fetch(`/api/history?days=${dateRange}`)
      const result = await response.json()

      if (result.success) {
        setHistoryData(result.data.history)
        setContinuityData(result.data.continuity)

        // If a date is selected, find tasks for that date
        if (selectedDate) {
          const dateStr = format(selectedDate, "yyyy-MM-dd")
          const dayData = result.data.history.find((day: TaskHistoryItem) => day.date === dateStr)
          setSelectedDateTasks(dayData || null)
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to load history data",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to the server",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast, status, dateRange, selectedDate])

  // Load data when component mounts or when date range changes
  useEffect(() => {
    if (status === "authenticated") {
      fetchHistoryData()
    }
  }, [fetchHistoryData, status, dateRange])

  // Handle date selection in calendar
  const handleDateSelect = (date: Date | undefined) => {
    setSelectedDate(date)
    if (date) {
      const dateStr = format(date, "yyyy-MM-dd")
      const dayData = historyData.find((day) => day.date === dateStr)
      setSelectedDateTasks(dayData || null)
    } else {
      setSelectedDateTasks(null)
    }
  }

  // Prepare data for activity heatmap
  const getActivityClass = (date: Date) => {
    if (!continuityData) return "bg-gray-100 dark:bg-gray-800"

    const dateStr = format(date, "yyyy-MM-dd")
    const isActive = continuityData.activityByDate[dateStr]

    if (isActive) return "bg-green-500 dark:bg-green-700"

    // Check if date is in the past
    const isPast = differenceInDays(new Date(), date) > 0
    if (isPast) return "bg-red-100 dark:bg-red-900/20"

    return "bg-gray-100 dark:bg-gray-800"
  }

  // Prepare data for activity chart
  const getChartData = () => {
    if (!historyData.length) return []

    // Get last 7 days of data
    const last7Days = [...historyData].sort((a, b) => a.date.localeCompare(b.date)).slice(-7)

    return last7Days.map((day) => ({
      date: formatDateDisplay(day.date),
      created: day.created.length,
      completed: day.completed.length,
      timeSpent: Math.round(day.timeSpent / 60), // Convert to minutes
    }))
  }

  if (status === "loading") {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="continuity">Continuity</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Task History</CardTitle>
                <Select value={dateRange} onValueChange={setDateRange}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select time range" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={getChartData()}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip
                          formatter={(value, name) => {
                            if (name === "timeSpent") return [`${value} min`, "Time Spent"]
                            return [value, name === "created" ? "Tasks Created" : "Tasks Completed"]
                          }}
                        />
                        <Legend />
                        <Bar dataKey="created" name="Created" fill="#3b82f6" />
                        <Bar dataKey="completed" name="Completed" fill="#22c55e" />
                        <Bar dataKey="timeSpent" name="Time (min)" fill="#f59e0b" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-medium">Daily Activity</h3>
                    <ScrollArea className="h-[400px]">
                      {historyData.length > 0 ? (
                        historyData.map((day) => (
                          <div key={day.date} className="mb-6 border-b pb-4 last:border-0">
                            <h4 className="text-md font-medium mb-2 flex justify-between">
                              <span>{formatDateDisplay(day.date)}</span>
                              <span className="text-muted-foreground text-sm">{formatTime(day.timeSpent)} spent</span>
                            </h4>

                            {day.completed.length > 0 && (
                              <div className="mb-3">
                                <h5 className="text-sm font-medium mb-1 text-green-600 dark:text-green-400">
                                  Completed ({day.completed.length})
                                </h5>
                                <ul className="space-y-1 pl-4">
                                  {day.completed.map((task) => (
                                    <li key={task._id} className="text-sm">
                                      {task.title}
                                      <span className="text-xs text-muted-foreground ml-2">
                                        ({formatTime(task.timeSpent)})
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {day.created.length > 0 && (
                              <div>
                                <h5 className="text-sm font-medium mb-1 text-blue-600 dark:text-blue-400">
                                  Created ({day.created.length})
                                </h5>
                                <ul className="space-y-1 pl-4">
                                  {day.created.map((task) => (
                                    <li key={task._id} className="text-sm">
                                      {task.title}
                                      <Badge
                                        variant="outline"
                                        className={`ml-2 ${task.completed ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : ""}`}
                                      >
                                        {task.completed ? "Completed" : "In Progress"}
                                      </Badge>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          No task history available for this period
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="continuity">
          <Card>
            <CardHeader>
              <CardTitle>Continuity Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : continuityData ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-1">Current Streak</p>
                      <p className="text-3xl font-bold">{continuityData.currentStreak} days</p>
                    </div>
                    <div className="border rounded-lg p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-1">Longest Streak</p>
                      <p className="text-3xl font-bold">{continuityData.longestStreak} days</p>
                    </div>
                    <div className="border rounded-lg p-4 text-center">
                      <p className="text-sm text-muted-foreground mb-1">Continuity</p>
                      <p className="text-3xl font-bold">{continuityData.continuityPercentage}%</p>
                      <p className="text-xs text-muted-foreground">
                        {continuityData.activeDays} of {continuityData.totalDays} days
                      </p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-4">Activity Heatmap</h3>
                    <div className="grid grid-cols-7 gap-2">
                      {Array.from({ length: 7 }, (_, i) => (
                        <div key={`header-${i}`} className="text-center text-xs text-muted-foreground">
                          {format(new Date(2023, 0, i + 1), "EEE")}
                        </div>
                      ))}

                      {Array.from({ length: 42 }, (_, i) => {
                        const date = subDays(new Date(), 41 - i)
                        return (
                          <div
                            key={`day-${i}`}
                            className={`h-8 rounded-sm ${getActivityClass(date)}`}
                            title={`${format(date, "MMM d, yyyy")}: ${continuityData.activityByDate[format(date, "yyyy-MM-dd")] ? "Active" : "Inactive"}`}
                          />
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium mb-2">Continuity Tips</h3>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      <li>Complete at least one task every day to maintain your streak</li>
                      <li>Use the Pomodoro timer for focused work sessions</li>
                      <li>Break down large tasks into smaller, manageable ones</li>
                      <li>Set realistic goals that you can achieve consistently</li>
                      <li>Review your progress regularly to stay motivated</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No continuity data available yet. Start using the app regularly to build your streak!
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
          <Card>
            <CardHeader>
              <CardTitle>Calendar View</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={handleDateSelect}
                    className="rounded-md border"
                    modifiersClassNames={{
                      selected: "bg-primary text-primary-foreground",
                    }}
                    modifiers={{
                      active: (date) => {
                        if (!continuityData) return false
                        const dateStr = format(date, "yyyy-MM-dd")
                        return !!continuityData.activityByDate[dateStr]
                      },
                    }}
                    modifiersStyles={{
                      active: {
                        fontWeight: "bold",
                        backgroundColor: "rgba(34, 197, 94, 0.2)",
                      },
                    }}
                  />
                </div>

                <div>
                  <h3 className="text-lg font-medium mb-4">
                    {selectedDate ? format(selectedDate, "MMMM d, yyyy") : "Select a date"}
                  </h3>

                  {selectedDateTasks ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="border rounded-lg p-3">
                          <p className="text-sm text-muted-foreground">Created</p>
                          <p className="text-2xl font-bold">{selectedDateTasks.created.length}</p>
                        </div>
                        <div className="border rounded-lg p-3">
                          <p className="text-sm text-muted-foreground">Completed</p>
                          <p className="text-2xl font-bold">{selectedDateTasks.completed.length}</p>
                        </div>
                        <div className="border rounded-lg p-3 col-span-2">
                          <p className="text-sm text-muted-foreground">Time Spent</p>
                          <p className="text-2xl font-bold">{formatTime(selectedDateTasks.timeSpent)}</p>
                        </div>
                      </div>

                      {selectedDateTasks.completed.length > 0 && (
                        <div>
                          <h4 className="text-md font-medium mb-2">Completed Tasks</h4>
                          <ul className="space-y-1 pl-4">
                            {selectedDateTasks.completed.map((task) => (
                              <li key={task._id} className="text-sm">
                                {task.title}
                                <span className="text-xs text-muted-foreground ml-2">
                                  ({formatTime(task.timeSpent)})
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {selectedDateTasks.created.length > 0 && (
                        <div>
                          <h4 className="text-md font-medium mb-2">Created Tasks</h4>
                          <ul className="space-y-1 pl-4">
                            {selectedDateTasks.created.map((task) => (
                              <li key={task._id} className="text-sm">
                                {task.title}
                                <Badge
                                  variant="outline"
                                  className={`ml-2 ${task.completed ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : ""}`}
                                >
                                  {task.completed ? "Completed" : "In Progress"}
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      {selectedDate ? "No activity on this day" : "Select a date to view details"}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
