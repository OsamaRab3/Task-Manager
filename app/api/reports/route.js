import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import WeeklyReport from "@/models/WeeklyReport"
import Task from "@/models/Task"
import PomodoroSession from "@/models/PomodoroSession"

// Helper to get a unique user ID (in a real app, this would come from authentication)
function getUserId() {
  return "demo-user-id"
}

// Helper to get start of week
function getStartOfWeek(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day
  return new Date(d.setDate(diff))
}

// Helper to format date to YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split("T")[0]
}

export async function GET() {
  try {
    await dbConnect()
    const userId = getUserId()

    const reports = await WeeklyReport.find({ userId }).sort({ weekStart: -1 })

    return NextResponse.json({ success: true, data: reports })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await dbConnect()
    const userId = getUserId()

    // Generate reports for all weeks
    const tasks = await Task.find({ userId })

    if (tasks.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    // Get all dates from tasks
    const allDates = tasks.map((task) => new Date(task.createdAt))
    const earliestDate = new Date(Math.min(...allDates.map((d) => d.getTime())))
    const startOfEarliestWeek = getStartOfWeek(earliestDate)
    const today = new Date()
    const startOfCurrentWeek = getStartOfWeek(today)

    const pomodoroSessions = await PomodoroSession.find({ userId })

    const reports = []
    const currentWeekStart = new Date(startOfEarliestWeek)

    while (currentWeekStart <= startOfCurrentWeek) {
      const weekStartStr = formatDate(currentWeekStart)
      const weekEndDate = new Date(currentWeekStart)
      weekEndDate.setDate(currentWeekStart.getDate() + 6)
      const weekEndStr = formatDate(weekEndDate)

      // Get tasks completed this week
      const tasksCompletedThisWeek = tasks.filter(
        (task) =>
          task.completedAt &&
          formatDate(new Date(task.completedAt)) >= weekStartStr &&
          formatDate(new Date(task.completedAt)) <= weekEndStr,
      )

      // Calculate time spent on tasks this week
      const tasksActiveThisWeek = tasks.filter((task) => {
        const createdBeforeWeekEnd = formatDate(new Date(task.createdAt)) <= weekEndStr
        const completedAfterWeekStart = !task.completedAt || formatDate(new Date(task.completedAt)) >= weekStartStr
        return createdBeforeWeekEnd && completedAfterWeekStart
      })

      const timeSpentThisWeek = tasksActiveThisWeek.reduce((total, task) => total + task.timeSpent, 0)

      // Calculate expected vs actual time ratio
      const tasksWithExpectedTime = tasksCompletedThisWeek.filter((task) => task.expectedTime > 0)
      let expectedVsActual = 1
      if (tasksWithExpectedTime.length > 0) {
        const totalExpected = tasksWithExpectedTime.reduce((total, task) => total + task.expectedTime, 0)
        const totalActual = tasksWithExpectedTime.reduce((total, task) => total + task.timeSpent, 0)
        expectedVsActual = totalExpected > 0 ? totalActual / totalExpected : 1
      }

      // Count pomodoros this week
      const pomodorosThisWeek = pomodoroSessions.filter(
        (session) =>
          formatDate(new Date(session.date)) >= weekStartStr && formatDate(new Date(session.date)) <= weekEndStr,
      ).length

      // Create or update the report
      const report = await WeeklyReport.findOneAndUpdate(
        { weekStart: currentWeekStart, userId },
        {
          tasksCompleted: tasksCompletedThisWeek.length,
          totalTimeSpent: timeSpentThisWeek,
          expectedVsActual,
          pomodoroCount: pomodorosThisWeek,
          userId,
        },
        { upsert: true, new: true },
      )

      reports.push(report)

      // Move to next week
      currentWeekStart.setDate(currentWeekStart.getDate() + 7)
    }

    return NextResponse.json({ success: true, data: reports })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
