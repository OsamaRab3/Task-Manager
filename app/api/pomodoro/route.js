import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]/route"
import dbConnect from "@/lib/db"
import PomodoroSession from "@/models/PomodoroSession"
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

    const sessions = await PomodoroSession.find({ userId }).sort({ date: -1 })

    return NextResponse.json({ success: true, data: sessions })
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

    // Add userId to the session data
    const sessionData = {
      ...data,
      userId,
    }

    const pomodoroSession = await PomodoroSession.create(sessionData)

    // If this session is associated with a task, increment its pomodoro count
    if (pomodoroSession.taskId) {
      await Task.findOneAndUpdate({ _id: pomodoroSession.taskId, userId }, { $inc: { pomodoroCount: 1 } })
    }

    // Update user activity for today
    const today = formatDate(new Date(pomodoroSession.date))

    await UserActivity.findOneAndUpdate(
      { userId, date: new Date(today) },
      { $inc: { pomodorosCompleted: 1 } },
      { upsert: true, new: true },
    )

    return NextResponse.json({ success: true, data: pomodoroSession }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
