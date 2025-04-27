import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]/route"
import dbConnect from "@/lib/db"
import Task from "@/models/Task"

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

    return NextResponse.json({ success: true, data: task }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
