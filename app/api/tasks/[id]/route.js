import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../auth/[...nextauth]/route"
import dbConnect from "@/lib/db"
import Task from "@/models/Task"
import UserActivity from "@/models/UserActivity"

// Helper to format date to YYYY-MM-DD
function formatDate(date) {
  return new Date(date).toISOString().split("T")[0]
}

export async function GET(request, { params }) {
  try {
    await dbConnect()

    // Get the authenticated user
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    const task = await Task.findOne({ _id: params.id, userId })

    if (!task) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: task })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function PUT(request, { params }) {
  try {
    await dbConnect()

    // Get the authenticated user
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    const data = await request.json()

    // Get the task before update
    const existingTask = await Task.findOne({ _id: params.id, userId })

    if (!existingTask) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 })
    }

    // Check if task is being completed
    const isBeingCompleted = !existingTask.completed && data.completed === true

    // If this is a recurring task being completed, set the lastCompletedDate
    if (existingTask.isRecurring && isBeingCompleted) {
      data.lastCompletedDate = new Date()
    }

    const task = await Task.findOneAndUpdate({ _id: params.id, userId }, data, { new: true, runValidators: true })

    // If task is being completed, update user activity
    if (isBeingCompleted) {
      const completedDate = data.completedAt ? new Date(data.completedAt) : new Date()
      const today = formatDate(completedDate)

      await UserActivity.findOneAndUpdate(
        { userId, date: new Date(today) },
        {
          $inc: {
            tasksCompleted: 1,
            timeSpent: task.timeSpent,
          },
        },
        { upsert: true, new: true },
      )
    }

    return NextResponse.json({ success: true, data: task })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    await dbConnect()

    // Get the authenticated user
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    const task = await Task.findOneAndDelete({ _id: params.id, userId })

    if (!task) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 })
    }

    // Also remove this task from any dependencies
    await Task.updateMany({ dependencies: params.id, userId }, { $pull: { dependencies: params.id } })

    return NextResponse.json({ success: true, data: {} })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
