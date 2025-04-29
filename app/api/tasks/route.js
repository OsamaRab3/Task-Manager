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

// Helper to check if a recurring task needs to be reset
function shouldResetRecurringTask(task) {
  if (!task.isRecurring) return false

  // If never completed or completed on a different day, it should be reset
  if (!task.lastCompletedDate) return true

  const lastCompletedDate = formatDate(task.lastCompletedDate)
  const today = formatDate(new Date())

  return lastCompletedDate !== today
}

export async function GET() {
  try {
    await dbConnect()

    // Get the authenticated user
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    // Get all tasks
    const tasks = await Task.find({ userId }).sort({ priority: -1, createdAt: -1 })

    // Reset completed status for recurring tasks if needed
    const today = new Date()
    const updatedTasks = []

    for (const task of tasks) {
      if (task.isRecurring && task.completed) {
        // Check if the task was completed on a different day
        if (shouldResetRecurringTask(task)) {
          // Reset the task for today
          task.completed = false
          task.completedAt = null
          await task.save()
          updatedTasks.push(task)
        }
      }
    }

    // Get the updated list of tasks
    const finalTasks =
      updatedTasks.length > 0 ? await Task.find({ userId }).sort({ priority: -1, createdAt: -1 }) : tasks

    return NextResponse.json({ success: true, data: finalTasks })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await dbConnect()

    // Get the authenticated user
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    const data = await request.json()

    // Add userId to the task data
    const taskData = {
      ...data,
      userId,
    }

    const task = await Task.create(taskData)

    // Update user activity for today
    const today = formatDate(new Date())

    await UserActivity.findOneAndUpdate(
      { userId, date: new Date(today) },
      { $inc: { tasksCreated: 1 } },
      { upsert: true, new: true },
    )

    return NextResponse.json({ success: true, data: task }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
