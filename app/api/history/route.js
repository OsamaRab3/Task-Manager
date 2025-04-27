import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]/route"
import dbConnect from "@/lib/db"
import Task from "@/models/Task"
import UserActivity from "@/models/UserActivity"

// Helper to format date to YYYY-MM-DD
function formatDate(date) {
  return new Date(date).toISOString().split("T")[0]
}

// Helper to get date range
function getDateRange(days) {
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  return { startDate, endDate }
}

export async function GET(request) {
  try {
    await dbConnect()

    // Get the authenticated user
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Get query parameters
    const url = new URL(request.url)
    const days = Number.parseInt(url.searchParams.get("days") || "30")

    // Get date range
    const { startDate, endDate } = getDateRange(days)

    // Fetch all tasks within the date range
    const tasks = await Task.find({
      userId,
      $or: [{ createdAt: { $gte: startDate, $lte: endDate } }, { completedAt: { $gte: startDate, $lte: endDate } }],
    }).sort({ createdAt: -1 })

    // Group tasks by day
    const tasksByDay = {}

    tasks.forEach((task) => {
      // Add to created day
      const createdDay = formatDate(task.createdAt)
      if (!tasksByDay[createdDay]) {
        tasksByDay[createdDay] = {
          date: createdDay,
          created: [],
          completed: [],
          timeSpent: 0,
        }
      }
      tasksByDay[createdDay].created.push(task)

      // Add to completed day if completed
      if (task.completed && task.completedAt) {
        const completedDay = formatDate(task.completedAt)
        if (!tasksByDay[completedDay]) {
          tasksByDay[completedDay] = {
            date: completedDay,
            created: [],
            completed: [],
            timeSpent: 0,
          }
        }
        tasksByDay[completedDay].completed.push(task)
        tasksByDay[completedDay].timeSpent += task.timeSpent
      }
    })

    // Convert to array and sort by date
    const historyData = Object.values(tasksByDay).sort((a, b) => new Date(b.date) - new Date(a.date))

    // Track or update user activity for today
    const today = formatDate(new Date())
    const todayData = tasksByDay[today] || { created: [], completed: [], timeSpent: 0 }

    await UserActivity.findOneAndUpdate(
      { userId, date: new Date(today) },
      {
        tasksCreated: todayData.created.length,
        tasksCompleted: todayData.completed.length,
        timeSpent: todayData.timeSpent,
        // We'll update pomodorosCompleted separately when pomodoros are completed
      },
      { upsert: true, new: true },
    )

    // Get user continuity data (last 60 days)
    const { startDate: continuityStartDate } = getDateRange(60)

    const activityData = await UserActivity.find({
      userId,
      date: { $gte: continuityStartDate },
    }).sort({ date: 1 })

    // Calculate streaks and continuity
    let currentStreak = 0
    let longestStreak = 0
    let activeDays = 0

    // Create a map of active days
    const activeDaysMap = {}
    activityData.forEach((day) => {
      const dateStr = formatDate(day.date)
      activeDaysMap[dateStr] =
        day.tasksCreated > 0 || day.tasksCompleted > 0 || day.timeSpent > 0 || day.pomodorosCompleted > 0

      if (activeDaysMap[dateStr]) {
        activeDays++
      }
    })

    // Calculate current streak
    const checkDate = new Date()
    let streakBroken = false

    while (!streakBroken && checkDate >= continuityStartDate) {
      const dateStr = formatDate(checkDate)

      if (activeDaysMap[dateStr]) {
        currentStreak++
      } else {
        streakBroken = true
      }

      // Move to previous day
      checkDate.setDate(checkDate.getDate() - 1)
    }

    // Calculate longest streak
    let tempStreak = 0
    let inStreak = false

    // Sort dates for proper streak calculation
    const sortedDates = Object.keys(activeDaysMap).sort()

    for (let i = 0; i < sortedDates.length; i++) {
      const currentDate = new Date(sortedDates[i])
      const isActive = activeDaysMap[sortedDates[i]]

      if (isActive) {
        if (!inStreak) {
          inStreak = true
          tempStreak = 1
        } else {
          // Check if this is the next consecutive day
          const prevDate = new Date(sortedDates[i - 1])
          const dayDiff = Math.round((currentDate - prevDate) / (1000 * 60 * 60 * 24))

          if (dayDiff === 1) {
            tempStreak++
          } else {
            // Gap in dates, reset streak
            tempStreak = 1
          }
        }

        if (tempStreak > longestStreak) {
          longestStreak = tempStreak
        }
      } else {
        inStreak = false
      }
    }

    // Calculate continuity percentage
    const continuityPercentage = Math.round((activeDays / Math.min(days, 60)) * 100)

    const continuityData = {
      currentStreak,
      longestStreak,
      activeDays,
      totalDays: Math.min(days, 60),
      continuityPercentage,
      activityByDate: activeDaysMap,
    }

    return NextResponse.json({
      success: true,
      data: {
        history: historyData,
        continuity: continuityData,
      },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
