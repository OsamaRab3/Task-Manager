import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Task from "@/models/Task"

// Helper to get a unique user ID (in a real app, this would come from authentication)
function getUserId(req) {
  // For demo purposes, we'll use a fixed ID
  // In a real app, this would come from the authenticated user
  return "demo-user-id"
}

export async function GET() {
  try {
    await dbConnect()
    const userId = getUserId()

    const tasks = await Task.find({ userId }).sort({ createdAt: -1 })

    return NextResponse.json({ success: true, data: tasks })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    await dbConnect()
    const userId = getUserId()

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
