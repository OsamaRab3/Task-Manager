import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import PomodoroSession from "@/models/PomodoroSession"
import Task from "@/models/Task"

// Helper to get a unique user ID (in a real app, this would come from authentication)
function getUserId() {
  return "demo-user-id"
}

export async function GET() {
  try {
    await dbConnect()
    const userId = getUserId()

    const sessions = await PomodoroSession.find({ userId }).sort({ date: -1 })

    return NextResponse.json({ success: true, data: sessions })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await dbConnect()
    const userId = getUserId()

    const data = await request.json()

    // Add userId to the session data
    const sessionData = {
      ...data,
      userId,
    }

    const session = await PomodoroSession.create(sessionData)

    // If this session is associated with a task, increment its pomodoro count
    if (session.taskId) {
      await Task.findByIdAndUpdate(session.taskId, { $inc: { pomodoroCount: 1 } })
    }

    return NextResponse.json({ success: true, data: session }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
