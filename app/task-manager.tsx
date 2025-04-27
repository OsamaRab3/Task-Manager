"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Plus, Pencil, Trash2, Play, Square, Timer, Link, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useToast } from "@/components/ui/use-toast"
import { useSession } from "next-auth/react"
import HistoryView from "@/components/history-view"

// Format time (seconds) to readable format
const formatTime = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  return `${hours > 0 ? `${hours}h ` : ""}${minutes}m ${secs}s`
}

// Format time for timer display (MM:SS)
const formatTimerDisplay = (seconds: number) => {
  const minutes = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
}

// Get the start of the week (Sunday)
const getStartOfWeek = (date: Date) => {
  const day = date.getDay() // 0 for Sunday, 1 for Monday, etc.
  const diff = date.getDate() - day
  return new Date(date.setDate(diff))
}

// Format date to YYYY-MM-DD
const formatDate = (date: Date) => {
  return date.toISOString().split("T")[0]
}

// Get week range string (e.g., "May 1 - May 7, 2023")
const getWeekRangeString = (date: Date) => {
  const startOfWeek = getStartOfWeek(new Date(date))
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 6)

  const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }
  const startStr = startOfWeek.toLocaleDateString("en-US", options)
  const endStr = endOfWeek.toLocaleDateString("en-US", options)
  const yearStr = endOfWeek.getFullYear()

  return `${startStr} - ${endStr}, ${yearStr}`
}

// Pie Chart Component
function PieChartComponent({ data }: { data: { name: string; value: number; status: string }[] }) {
  // Only include tasks with time > 0
  const filteredData = data.filter((item) => item.value > 0)

  // Colors based on task status
  const COLORS = {
    completed: "#22c55e", // green-500
    "in-progress": "#3b82f6", // blue-500
    pending: "#94a3b8", // slate-400
  }

  if (filteredData.length === 0) {
    return <div className="flex items-center justify-center h-full text-muted-foreground">No time data available</div>
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={filteredData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
        >
          {filteredData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[entry.status as keyof typeof COLORS]} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => formatTime(value)} labelFormatter={(name) => `Task: ${name}`} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  )
}

// Task type definition
type Task = {
  _id?: string
  id: string
  title: string
  completed: boolean
  inProgress: boolean
  timeSpent: number
  startTime: number | null
  expectedTime: number // in seconds
  dependencies: string[] // IDs of tasks this task depends on
  createdAt: string // ISO date string
  completedAt: string | null // ISO date string
  pomodoroCount: number // Number of completed pomodoros
}

// Pomodoro session type
type PomodoroSession = {
  _id?: string
  taskId: string | null
  date: string // ISO date string
  duration: number // in seconds
}

// Weekly report type
type WeeklyReport = {
  _id?: string
  weekStart: string // ISO date string
  tasksCompleted: number
  totalTimeSpent: number
  expectedVsActual: number // ratio of expected to actual time
  pomodoroCount: number
}

export default function TaskManager() {
  const { data: session, status } = useSession()

  // State for tasks and UI
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTaskTitle, setNewTaskTitle] = useState("")
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [editedTitle, setEditedTitle] = useState("")
  const [editedExpectedTime, setEditedExpectedTime] = useState(0)
  const [editedDependencies, setEditedDependencies] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Pomodoro timer state
  const [pomodoroActive, setPomodoroActive] = useState(false)
  const [pomodoroTimeLeft, setPomodoroTimeLeft] = useState(25 * 60) // 25 minutes in seconds
  const [pomodoroSettings, setPomodoroSettings] = useState({
    workDuration: 25 * 60, // 25 minutes in seconds
    shortBreak: 5 * 60, // 5 minutes in seconds
    longBreak: 15 * 60, // 15 minutes in seconds
    sessionsBeforeLongBreak: 4,
  })
  const [currentPomodoroSession, setCurrentPomodoroSession] = useState<"work" | "shortBreak" | "longBreak">("work")
  const [pomodoroCount, setPomodoroCount] = useState(0)
  const [selectedTaskForPomodoro, setSelectedTaskForPomodoro] = useState<string | null>(null)
  const [showPomodoroSettings, setShowPomodoroSettings] = useState(false)
  const [pomodoroHistory, setPomodoroHistory] = useState<PomodoroSession[]>([])

  // Weekly reports state
  const [weeklyReports, setWeeklyReports] = useState<WeeklyReport[]>([])
  const [selectedWeek, setSelectedWeek] = useState<string>(formatDate(getStartOfWeek(new Date())))
  const [isGeneratingReports, setIsGeneratingReports] = useState(false)

  // Toast notifications
  const { toast } = useToast()

  // Audio refs
  const alarmAudioRef = useRef<HTMLAudioElement | null>(null)
  const pomodoroAudioRef = useRef<HTMLAudioElement | null>(null)

  // Timer interval ref
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Initialize audio elements
  useEffect(() => {
    alarmAudioRef.current = new Audio("/alarm.mp3")
    pomodoroAudioRef.current = new Audio("/pomodoro-bell.mp3")

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [])

  // Fetch tasks from API
  const fetchTasks = useCallback(async () => {
    // Only fetch if authenticated
    if (status !== "authenticated") return

    try {
      setIsLoading(true)
      const response = await fetch("/api/tasks")
      const result = await response.json()

      if (result.success) {
        // Convert MongoDB _id to id for frontend compatibility
        const tasksWithId = result.data.map((task: any) => ({
          ...task,
          id: task._id,
          inProgress: false, // Reset inProgress state on load
          startTime: null, // Reset startTime on load
        }))
        setTasks(tasksWithId)
      } else {
        toast({
          title: "Error",
          description: "Failed to load tasks",
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
  }, [toast, status])

  // Fetch pomodoro sessions from API
  const fetchPomodoroSessions = useCallback(async () => {
    // Only fetch if authenticated
    if (status !== "authenticated") return

    try {
      const response = await fetch("/api/pomodoro")
      const result = await response.json()

      if (result.success) {
        setPomodoroHistory(result.data)
      } else {
        toast({
          title: "Error",
          description: "Failed to load pomodoro sessions",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to the server",
        variant: "destructive",
      })
    }
  }, [toast, status])

  // Fetch or generate weekly reports
  const fetchWeeklyReports = useCallback(async () => {
    // Only fetch if authenticated
    if (status !== "authenticated") return

    try {
      setIsGeneratingReports(true)
      const response = await fetch("/api/reports", {
        method: "POST", // Use POST to trigger report generation
      })
      const result = await response.json()

      if (result.success) {
        setWeeklyReports(result.data)

        // Set the most recent week as selected
        if (result.data.length > 0) {
          setSelectedWeek(result.data[0].weekStart)
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to generate reports",
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
      setIsGeneratingReports(false)
    }
  }, [toast, status])

  // Load data on component mount and when authentication status changes
  useEffect(() => {
    if (status === "authenticated") {
      fetchTasks()
      fetchPomodoroSessions()
      fetchWeeklyReports()
    }
  }, [fetchTasks, fetchPomodoroSessions, fetchWeeklyReports, status])

  // Update active timers every second
  useEffect(() => {
    const interval = setInterval(() => {
      setTasks((currentTasks) =>
        currentTasks.map((task) => {
          if (task.inProgress && task.startTime) {
            const updatedTask = {
              ...task,
              timeSpent: task.timeSpent + (Date.now() - task.startTime) / 1000,
              startTime: Date.now(),
            }

            // Check for time overrun
            checkTimeOverrun(updatedTask)

            return updatedTask
          }
          return task
        }),
      )
    }, 1000)

    return () => clearInterval(interval)
  }, [])

  // Save task updates to the server periodically
  useEffect(() => {
    // Only save if authenticated
    if (status !== "authenticated") return

    const saveInterval = setInterval(async () => {
      // Find tasks that are in progress and have accumulated time
      const tasksToUpdate = tasks.filter((task) => task.inProgress && task._id && task.timeSpent > 0)

      if (tasksToUpdate.length > 0) {
        for (const task of tasksToUpdate) {
          try {
            await fetch(`/api/tasks/${task._id}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                timeSpent: task.timeSpent,
              }),
            })
          } catch (error) {
            console.error("Failed to update task time:", error)
          }
        }
      }
    }, 30000) // Save every 30 seconds

    return () => clearInterval(saveInterval)
  }, [tasks, status])

  // Pomodoro timer effect
  useEffect(() => {
    if (pomodoroActive) {
      timerIntervalRef.current = setInterval(() => {
        setPomodoroTimeLeft((prev) => {
          if (prev <= 1) {
            // Timer finished
            if (pomodoroAudioRef.current) {
              pomodoroAudioRef.current.play().catch((e) => console.log("Audio play failed:", e))
            }

            // Show browser notification
            if ("Notification" in window && Notification.permission === "granted") {
              new Notification("Pomodoro Timer", {
                body: `${currentPomodoroSession === "work" ? "Work session" : "Break"} completed!`,
              })
            }

            // Handle session completion
            if (currentPomodoroSession === "work") {
              // Record completed pomodoro
              if (selectedTaskForPomodoro) {
                // Update task pomodoro count
                setTasks((currentTasks) =>
                  currentTasks.map((task) =>
                    task.id === selectedTaskForPomodoro ? { ...task, pomodoroCount: task.pomodoroCount + 1 } : task,
                  ),
                )

                // Add to pomodoro history and save to server
                const newSession: PomodoroSession = {
                  taskId: selectedTaskForPomodoro,
                  date: new Date().toISOString(),
                  duration: pomodoroSettings.workDuration,
                }

                // Save pomodoro session to server
                savePomodoroSession(newSession)
              }

              // Increment pomodoro count
              setPomodoroCount((prev) => {
                const newCount = prev + 1
                // Determine next break type
                if (newCount % pomodoroSettings.sessionsBeforeLongBreak === 0) {
                  setCurrentPomodoroSession("longBreak")
                  setPomodoroTimeLeft(pomodoroSettings.longBreak)
                } else {
                  setCurrentPomodoroSession("shortBreak")
                  setPomodoroTimeLeft(pomodoroSettings.shortBreak)
                }
                return newCount
              })
            } else {
              // Break finished, start work session
              setCurrentPomodoroSession("work")
              setPomodoroTimeLeft(pomodoroSettings.workDuration)
            }

            return 0
          }
          return prev - 1
        })
      }, 1000)
    } else if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current)
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current)
      }
    }
  }, [pomodoroActive, currentPomodoroSession, pomodoroSettings, selectedTaskForPomodoro])

  // Save pomodoro session to server
  const savePomodoroSession = async (session: PomodoroSession) => {
    // Only save if authenticated
    if (status !== "authenticated") return

    try {
      const response = await fetch("/api/pomodoro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(session),
      })

      const result = await response.json()

      if (result.success) {
        setPomodoroHistory((prev) => [...prev, result.data])

        // If this session is associated with a task, update the task's pomodoro count
        if (session.taskId) {
          const taskToUpdate = tasks.find((t) => t.id === session.taskId)
          if (taskToUpdate && taskToUpdate._id) {
            await fetch(`/api/tasks/${taskToUpdate._id}`, {
              method: "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                pomodoroCount: (taskToUpdate.pomodoroCount || 0) + 1,
              }),
            })
          }
        }
      }
    } catch (error) {
      console.error("Failed to save pomodoro session:", error)
    }
  }

  // Add a new task
  const addTask = async () => {
    if (newTaskTitle.trim() === "") return
    if (status !== "authenticated") {
      toast({
        title: "Error",
        description: "You must be signed in to add tasks",
        variant: "destructive",
      })
      return
    }

    setIsSaving(true)

    const newTask: Partial<Task> = {
      title: newTaskTitle,
      completed: false,
      timeSpent: 0,
      expectedTime: 0,
      dependencies: [],
      createdAt: new Date().toISOString(),
      completedAt: null,
      pomodoroCount: 0,
    }

    try {
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newTask),
      })

      const result = await response.json()

      if (result.success) {
        // Add the new task to the state with frontend-specific properties
        setTasks((prev) => [
          ...prev,
          {
            ...result.data,
            id: result.data._id,
            inProgress: false,
            startTime: null,
          },
        ])

        setNewTaskTitle("")

        toast({
          title: "Success",
          description: "Task added successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to add task",
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
      setIsSaving(false)
    }
  }

  // Delete a task
  const deleteTask = async (id: string) => {
    const taskToDelete = tasks.find((task) => task.id === id)
    if (!taskToDelete || !taskToDelete._id) return

    try {
      const response = await fetch(`/api/tasks/${taskToDelete._id}`, {
        method: "DELETE",
      })

      const result = await response.json()

      if (result.success) {
        // First, remove this task from any dependencies in the local state
        setTasks((prev) =>
          prev
            .map((task) => ({
              ...task,
              dependencies: task.dependencies.filter((depId) => depId !== id),
            }))
            .filter((task) => task.id !== id),
        )

        toast({
          title: "Success",
          description: "Task deleted successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to delete task",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to the server",
        variant: "destructive",
      })
    }
  }

  // Start time tracking for a task
  const startTask = (id: string) => {
    const taskToStart = tasks.find((task) => task.id === id)

    // Check if task has unmet dependencies
    if (taskToStart && taskToStart.dependencies.length > 0) {
      const unmetDependencies = taskToStart.dependencies.filter((depId) => {
        const depTask = tasks.find((t) => t.id === depId)
        return depTask && !depTask.completed
      })

      if (unmetDependencies.length > 0) {
        // Show notification about unmet dependencies
        toast({
          title: "Dependencies Not Met",
          description: "This task has dependencies that are not completed yet.",
          variant: "destructive",
        })

        // Don't start the task
        return
      }
    }

    setTasks(
      tasks.map((task) => {
        // Stop any other running tasks
        if (task.inProgress && task.id !== id) {
          return {
            ...task,
            inProgress: false,
            startTime: null,
          }
        }

        // Start the selected task
        if (task.id === id) {
          return {
            ...task,
            inProgress: true,
            startTime: Date.now(),
          }
        }

        return task
      }),
    )
  }

  // Stop time tracking for a task
  const stopTask = async (id: string) => {
    const taskToStop = tasks.find((task) => task.id === id)
    if (!taskToStop || !taskToStop._id) return

    // Update local state
    setTasks(
      tasks.map((task) => {
        if (task.id === id) {
          return {
            ...task,
            inProgress: false,
            startTime: null,
          }
        }
        return task
      }),
    )

    // Save the updated time to the server
    try {
      await fetch(`/api/tasks/${taskToStop._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeSpent: taskToStop.timeSpent,
        }),
      })
    } catch (error) {
      console.error("Failed to update task time:", error)
    }
  }

  // Complete a task
  const completeTask = async (id: string) => {
    const taskToComplete = tasks.find((task) => task.id === id)
    if (!taskToComplete || !taskToComplete._id) return

    const completedAt = new Date().toISOString()

    // Update local state
    setTasks(
      tasks.map((task) => {
        if (task.id === id) {
          // If task is in progress, stop it first
          if (task.inProgress) {
            return {
              ...task,
              completed: true,
              inProgress: false,
              startTime: null,
              completedAt,
            }
          }
          return {
            ...task,
            completed: true,
            completedAt,
          }
        }
        return task
      }),
    )

    // Save the completed task to the server
    try {
      await fetch(`/api/tasks/${taskToComplete._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          completed: true,
          completedAt,
          timeSpent: taskToComplete.timeSpent,
        }),
      })

      // Regenerate reports after completing a task
      fetchWeeklyReports()
    } catch (error) {
      console.error("Failed to update task completion status:", error)
    }
  }

  // Open edit dialog
  const openEditDialog = (task: Task) => {
    setEditingTask(task)
    setEditedTitle(task.title)
    setEditedExpectedTime(task.expectedTime)
    setEditedDependencies([...task.dependencies])
  }

  // Save edited task
  const saveEditedTask = async () => {
    if (!editingTask || !editingTask._id || editedTitle.trim() === "") return

    setIsSaving(true)

    try {
      const response = await fetch(`/api/tasks/${editingTask._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: editedTitle,
          expectedTime: editedExpectedTime,
          dependencies: editedDependencies,
        }),
      })

      const result = await response.json()

      if (result.success) {
        // Update the task in local state
        setTasks(
          tasks.map((task) =>
            task.id === editingTask.id
              ? {
                  ...task,
                  title: editedTitle,
                  expectedTime: editedExpectedTime,
                  dependencies: editedDependencies,
                }
              : task,
          ),
        )

        setEditingTask(null)

        toast({
          title: "Success",
          description: "Task updated successfully",
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to update task",
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
      setIsSaving(false)
    }
  }

  // Toggle dependency selection
  const toggleDependency = (taskId: string) => {
    if (editedDependencies.includes(taskId)) {
      setEditedDependencies(editedDependencies.filter((id) => id !== taskId))
    } else {
      setEditedDependencies([...editedDependencies, taskId])
    }
  }

  // Check if task has exceeded expected time and show notification
  const checkTimeOverrun = (task: Task) => {
    if (task.expectedTime > 0 && task.timeSpent > task.expectedTime && task.inProgress) {
      // Play alarm sound
      if (alarmAudioRef.current) {
        alarmAudioRef.current.play().catch((e) => console.log("Audio play failed:", e))
      }

      // Show browser notification if supported
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("Time Exceeded!", {
          body: `Task "${task.title}" has exceeded the expected time.`,
        })
      }

      return true
    }
    return false
  }

  // Start pomodoro timer
  const startPomodoro = () => {
    setPomodoroActive(true)
  }

  // Pause pomodoro timer
  const pausePomodoro = () => {
    setPomodoroActive(false)
  }

  // Reset pomodoro timer
  const resetPomodoro = () => {
    setPomodoroActive(false)
    setCurrentPomodoroSession("work")
    setPomodoroTimeLeft(pomodoroSettings.workDuration)
  }

  // Skip to next pomodoro session
  const skipToNextSession = () => {
    if (currentPomodoroSession === "work") {
      // Skip to break
      if ((pomodoroCount + 1) % pomodoroSettings.sessionsBeforeLongBreak === 0) {
        setCurrentPomodoroSession("longBreak")
        setPomodoroTimeLeft(pomodoroSettings.longBreak)
      } else {
        setCurrentPomodoroSession("shortBreak")
        setPomodoroTimeLeft(pomodoroSettings.shortBreak)
      }

      // Record completed pomodoro
      if (selectedTaskForPomodoro) {
        // Update task pomodoro count
        setTasks((currentTasks) =>
          currentTasks.map((task) =>
            task.id === selectedTaskForPomodoro ? { ...task, pomodoroCount: task.pomodoroCount + 1 } : task,
          ),
        )

        // Add to pomodoro history
        const newSession: PomodoroSession = {
          taskId: selectedTaskForPomodoro,
          date: new Date().toISOString(),
          duration: pomodoroSettings.workDuration,
        }
        savePomodoroSession(newSession)
      }

      setPomodoroCount((prev) => prev + 1)
    } else {
      // Skip to work
      setCurrentPomodoroSession("work")
      setPomodoroTimeLeft(pomodoroSettings.workDuration)
    }
  }

  // Save pomodoro settings
  const savePomodoroSettings = () => {
    setShowPomodoroSettings(false)
  }

  // Calculate total time spent on completed tasks
  const totalTimeSpent = tasks.filter((task) => task.completed).reduce((total, task) => total + task.timeSpent, 0)

  // Get completed tasks for the chart
  const completedTasks = tasks.filter((task) => task.completed)

  // Get the selected weekly report
  const selectedReport = weeklyReports.find((report) => report.weekStart === selectedWeek) || {
    weekStart: selectedWeek,
    tasksCompleted: 0,
    totalTimeSpent: 0,
    expectedVsActual: 1,
    pomodoroCount: 0,
  }

  // Get weekly report data for chart
  const weeklyChartData = weeklyReports.map((report) => ({
    week: getWeekRangeString(new Date(report.weekStart)),
    tasksCompleted: report.tasksCompleted,
    timeSpent: report.totalTimeSpent / 3600, // Convert to hours
    efficiency: report.expectedVsActual <= 2 ? report.expectedVsActual : 2, // Cap at 2 for better visualization
  }))

  // If not authenticated, show a message
  if (status === "loading") {
    return (
      <div className="container mx-auto p-4 max-w-3xl">
        <Card>
          <CardContent className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl">
      <Tabs defaultValue="tasks">
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="pomodoro">Pomodoro</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
          <TabsTrigger value="history">
            <History className="h-4 w-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <Card>
            <CardHeader>
              <CardTitle>Task Manager with Time Tracking</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-2 mb-6">
                <Input
                  placeholder="Add a new task..."
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTask()}
                  disabled={isSaving}
                />
                <Button onClick={addTask} disabled={isSaving || newTaskTitle.trim() === ""}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No tasks yet. Add your first task above!</p>
                  ) : (
                    tasks.map((task) => {
                      // Check if task has dependencies
                      const hasDependencies = task.dependencies.length > 0

                      // Check if all dependencies are met
                      const unmetDependencies = task.dependencies.filter((depId) => {
                        const depTask = tasks.find((t) => t.id === depId)
                        return depTask && !depTask.completed
                      })

                      const allDependenciesMet = unmetDependencies.length === 0

                      return (
                        <div
                          key={task.id}
                          className={`flex items-center justify-between p-3 border rounded-lg ${
                            task.completed
                              ? "bg-muted"
                              : task.inProgress
                                ? task.expectedTime > 0 && task.timeSpent > task.expectedTime
                                  ? "bg-red-50 dark:bg-red-950/20"
                                  : "bg-green-50 dark:bg-green-950/20"
                                : hasDependencies && !allDependenciesMet
                                  ? "bg-amber-50 dark:bg-amber-950/20"
                                  : ""
                          }`}
                        >
                          <div className="flex-1 mr-4">
                            <div className="flex items-center">
                              <span className={task.completed ? "line-through text-muted-foreground" : ""}>
                                {task.title}
                              </span>
                              {task.inProgress && (
                                <Badge
                                  variant="outline"
                                  className={`ml-2 ${
                                    task.expectedTime > 0 && task.timeSpent > task.expectedTime
                                      ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300"
                                      : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                  }`}
                                >
                                  {task.expectedTime > 0 && task.timeSpent > task.expectedTime
                                    ? "Time Exceeded!"
                                    : "In Progress"}
                                </Badge>
                              )}
                              {task.completed && (
                                <Badge variant="outline" className="ml-2">
                                  Completed
                                </Badge>
                              )}
                              {hasDependencies && !task.completed && (
                                <Badge
                                  variant="outline"
                                  className={`ml-2 ${
                                    allDependenciesMet
                                      ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
                                  }`}
                                >
                                  {allDependenciesMet ? "Dependencies Met" : "Has Dependencies"}
                                </Badge>
                              )}
                              {task.pomodoroCount > 0 && (
                                <Badge
                                  variant="outline"
                                  className="ml-2 bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
                                >
                                  {task.pomodoroCount} {task.pomodoroCount === 1 ? "Pomodoro" : "Pomodoros"}
                                </Badge>
                              )}
                            </div>
                            <div className="text-sm text-muted-foreground mt-1">
                              Time spent: {formatTime(task.timeSpent)}
                              {task.expectedTime > 0 && (
                                <span className="ml-2">
                                  / Expected: {formatTime(task.expectedTime)}
                                  {task.timeSpent > task.expectedTime && !task.inProgress && (
                                    <span className="text-red-500 ml-1">(Exceeded)</span>
                                  )}
                                </span>
                              )}
                              {hasDependencies && (
                                <div className="mt-1">
                                  <span className="flex items-center">
                                    <Link className="h-3 w-3 mr-1" />
                                    Depends on:{" "}
                                    {task.dependencies.map((depId) => {
                                      const depTask = tasks.find((t) => t.id === depId)
                                      return depTask ? (
                                        <span
                                          key={depId}
                                          className={`inline-block mx-1 px-1 text-xs rounded ${
                                            depTask.completed
                                              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
                                              : "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
                                          }`}
                                        >
                                          {depTask.title}
                                        </span>
                                      ) : null
                                    })}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-1">
                            {!task.completed && (
                              <>
                                {task.inProgress ? (
                                  <Button variant="outline" size="icon" onClick={() => stopTask(task.id)}>
                                    <Square className="h-4 w-4" />
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => startTask(task.id)}
                                    disabled={hasDependencies && !allDependenciesMet}
                                  >
                                    <Play className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button variant="outline" size="icon" onClick={() => openEditDialog(task)}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon" onClick={() => completeTask(task.id)}>
                                  ✓
                                </Button>
                              </>
                            )}
                            <Button variant="outline" size="icon" onClick={() => deleteTask(task.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pomodoro">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Pomodoro Timer</span>
                <Button variant="outline" size="sm" onClick={() => setShowPomodoroSettings(true)}>
                  <Timer className="h-4 w-4 mr-2" />
                  Settings
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center space-y-6">
                <div className="text-center">
                  <div className="text-6xl font-bold tabular-nums mb-2">{formatTimerDisplay(pomodoroTimeLeft)}</div>
                  <div className="text-muted-foreground">
                    {currentPomodoroSession === "work"
                      ? "Work Session"
                      : currentPomodoroSession === "shortBreak"
                        ? "Short Break"
                        : "Long Break"}
                  </div>
                </div>

                <div className="flex space-x-4">
                  {pomodoroActive ? (
                    <Button onClick={pausePomodoro}>Pause</Button>
                  ) : (
                    <Button onClick={startPomodoro}>Start</Button>
                  )}
                  <Button variant="outline" onClick={resetPomodoro}>
                    Reset
                  </Button>
                  <Button variant="outline" onClick={skipToNextSession}>
                    Skip
                  </Button>
                </div>

                <div className="w-full max-w-md">
                  <label className="block text-sm font-medium mb-2">Select Task for this Pomodoro</label>
                  <Select value={selectedTaskForPomodoro || "no-task"} onValueChange={setSelectedTaskForPomodoro}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a task" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-task">No task (just timer)</SelectItem>
                      {tasks
                        .filter((task) => !task.completed)
                        .map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.title}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="w-full max-w-md border rounded-lg p-4">
                  <h3 className="font-medium mb-2">Pomodoro Stats</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Today's Pomodoros</p>
                      <p className="text-xl font-bold">
                        {pomodoroHistory.filter((session) => session.date.startsWith(formatDate(new Date()))).length}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Pomodoros</p>
                      <p className="text-xl font-bold">{pomodoroHistory.length}</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports">
          <Card>
            <CardHeader>
              <CardTitle className="flex justify-between items-center">
                <span>Weekly Reports</span>
                <Button variant="outline" size="sm" onClick={fetchWeeklyReports} disabled={isGeneratingReports}>
                  {isGeneratingReports ? (
                    <>
                      <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent rounded-full"></div>
                      Generating...
                    </>
                  ) : (
                    "Refresh Reports"
                  )}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isGeneratingReports ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  <div className="mb-6">
                    <label className="block text-sm font-medium mb-2">Select Week</label>
                    <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a week" />
                      </SelectTrigger>
                      <SelectContent>
                        {weeklyReports.map((report) => (
                          <SelectItem key={report.weekStart} value={report.weekStart}>
                            {getWeekRangeString(new Date(report.weekStart))}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-4">
                        Week of {getWeekRangeString(new Date(selectedReport.weekStart))}
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Tasks Completed</p>
                          <p className="text-2xl font-bold">{selectedReport.tasksCompleted}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Time Spent</p>
                          <p className="text-2xl font-bold">{formatTime(selectedReport.totalTimeSpent)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Pomodoros</p>
                          <p className="text-2xl font-bold">{selectedReport.pomodoroCount}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Efficiency</p>
                          <p className="text-2xl font-bold">
                            {selectedReport.expectedVsActual < 1
                              ? "Ahead of schedule"
                              : selectedReport.expectedVsActual > 1.5
                                ? "Behind schedule"
                                : "On track"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-lg p-4">
                      <h3 className="font-medium mb-2">Tasks Completed This Week</h3>
                      <ScrollArea className="h-[200px]">
                        {tasks
                          .filter(
                            (task) =>
                              task.completedAt &&
                              task.completedAt >= selectedReport.weekStart &&
                              new Date(task.completedAt) <=
                                new Date(
                                  new Date(selectedReport.weekStart).setDate(
                                    new Date(selectedReport.weekStart).getDate() + 6,
                                  ),
                                ),
                          )
                          .map((task) => (
                            <div key={task.id} className="py-2 border-b last:border-0">
                              <div className="font-medium">{task.title}</div>
                              <div className="text-sm text-muted-foreground">
                                Time: {formatTime(task.timeSpent)}
                                {task.expectedTime > 0 && (
                                  <span className="ml-2">/ Expected: {formatTime(task.expectedTime)}</span>
                                )}
                              </div>
                            </div>
                          ))}
                      </ScrollArea>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h3 className="font-medium mb-4">Weekly Progress</h3>
                    <div className="h-[300px]">
                      {weeklyChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={weeklyChartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="week" />
                            <YAxis yAxisId="left" orientation="left" />
                            <YAxis yAxisId="right" orientation="right" />
                            <Tooltip />
                            <Legend />
                            <Bar yAxisId="left" dataKey="tasksCompleted" name="Tasks Completed" fill="#3b82f6" />
                            <Bar yAxisId="left" dataKey="timeSpent" name="Hours Spent" fill="#22c55e" />
                            <Bar
                              yAxisId="right"
                              dataKey="efficiency"
                              name="Efficiency (lower is better)"
                              fill="#f59e0b"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                          No data available yet
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-medium mb-4">Productivity Insights</h3>
                    <div className="space-y-2 text-sm">
                      {selectedReport.tasksCompleted === 0 ? (
                        <p>No completed tasks in this period to generate insights.</p>
                      ) : (
                        <>
                          <p>
                            You completed <strong>{selectedReport.tasksCompleted}</strong> tasks this week, spending a
                            total of <strong>{formatTime(selectedReport.totalTimeSpent)}</strong>.
                          </p>
                          {selectedReport.pomodoroCount > 0 && (
                            <p>
                              You completed <strong>{selectedReport.pomodoroCount}</strong> pomodoro sessions, which is
                              approximately <strong>{Math.round((selectedReport.pomodoroCount * 25) / 60)}</strong>{" "}
                              hours of focused work.
                            </p>
                          )}
                          {selectedReport.expectedVsActual !== 1 && (
                            <p>
                              Your tasks took {selectedReport.expectedVsActual < 1 ? "less" : "more"} time than expected
                              (ratio: {selectedReport.expectedVsActual.toFixed(2)}), suggesting you're
                              {selectedReport.expectedVsActual < 1
                                ? " ahead of schedule and possibly underestimating your efficiency."
                                : selectedReport.expectedVsActual > 1.5
                                  ? " behind schedule and might need to allocate more time for tasks."
                                  : " generally on track with your time estimates."}
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <HistoryView />
        </TabsContent>
      </Tabs>

      {/* Edit Task Dialog */}
      <Dialog open={!!editingTask} onOpenChange={(open) => !open && setEditingTask(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="task-title" className="text-sm font-medium">
                Task Title
              </label>
              <Input
                id="task-title"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                placeholder="Task title"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="expected-time" className="text-sm font-medium">
                Expected Time (minutes)
              </label>
              <Input
                id="expected-time"
                type="number"
                min="0"
                value={editedExpectedTime / 60}
                onChange={(e) => setEditedExpectedTime(Math.max(0, Number.parseFloat(e.target.value) * 60 || 0))}
                placeholder="Expected time in minutes"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Dependencies</label>
              <div className="border rounded-md p-2 max-h-[200px] overflow-y-auto">
                {tasks
                  .filter((task) => task.id !== editingTask?.id)
                  .map((task) => (
                    <div key={task.id} className="flex items-center space-x-2 py-1">
                      <Checkbox
                        id={`dep-${task.id}`}
                        checked={editedDependencies.includes(task.id)}
                        onCheckedChange={() => toggleDependency(task.id)}
                      />
                      <label
                        htmlFor={`dep-${task.id}`}
                        className={`text-sm ${task.completed ? "line-through text-muted-foreground" : ""}`}
                      >
                        {task.title}
                      </label>
                    </div>
                  ))}
                {tasks.filter((task) => task.id !== editingTask?.id).length === 0 && (
                  <p className="text-sm text-muted-foreground py-1">No other tasks available</p>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTask(null)}>
              Cancel
            </Button>
            <Button onClick={saveEditedTask} disabled={isSaving}>
              {isSaving ? (
                <>
                  <div className="animate-spin mr-2 h-4 w-4 border-2 border-b-transparent rounded-full"></div>
                  Saving...
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pomodoro Settings Dialog */}
      <Dialog open={showPomodoroSettings} onOpenChange={setShowPomodoroSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pomodoro Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Work Duration: {Math.floor(pomodoroSettings.workDuration / 60)} minutes
              </label>
              <Slider
                value={[pomodoroSettings.workDuration / 60]}
                min={5}
                max={60}
                step={5}
                onValueChange={(value) =>
                  setPomodoroSettings({
                    ...pomodoroSettings,
                    workDuration: value[0] * 60,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Short Break: {Math.floor(pomodoroSettings.shortBreak / 60)} minutes
              </label>
              <Slider
                value={[pomodoroSettings.shortBreak / 60]}
                min={1}
                max={15}
                step={1}
                onValueChange={(value) =>
                  setPomodoroSettings({
                    ...pomodoroSettings,
                    shortBreak: value[0] * 60,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Long Break: {Math.floor(pomodoroSettings.longBreak / 60)} minutes
              </label>
              <Slider
                value={[pomodoroSettings.longBreak / 60]}
                min={5}
                max={30}
                step={5}
                onValueChange={(value) =>
                  setPomodoroSettings({
                    ...pomodoroSettings,
                    longBreak: value[0] * 60,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Sessions Before Long Break: {pomodoroSettings.sessionsBeforeLongBreak}
              </label>
              <Slider
                value={[pomodoroSettings.sessionsBeforeLongBreak]}
                min={2}
                max={6}
                step={1}
                onValueChange={(value) =>
                  setPomodoroSettings({
                    ...pomodoroSettings,
                    sessionsBeforeLongBreak: value[0],
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPomodoroSettings(false)}>
              Cancel
            </Button>
            <Button onClick={savePomodoroSettings}>Save Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
