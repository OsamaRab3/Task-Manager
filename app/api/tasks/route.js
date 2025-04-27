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

export async function GET() {
  try {
    await dbConnect()

    // Get the authenticated user
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    const userId = session.user.id

    const tasks = await Task.find({ userId }).sort({ createdAt: -1 })

    return NextResponse.json({ success: true, data: tasks })
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
