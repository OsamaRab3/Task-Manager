import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import Task from "@/models/Task"

// Helper to get a unique user ID (in a real app, this would come from authentication)
function getUserId() {
  // For demo purposes, we'll use a fixed ID
  return "demo-user-id"
}

export async function GET(request, { params }) {
  try {
    await dbConnect()
    const userId = getUserId()

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
    const userId = getUserId()

    const data = await request.json()

    const task = await Task.findOneAndUpdate({ _id: params.id, userId }, data, { new: true, runValidators: true })

    if (!task) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, data: task })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(request, { params }) {
  try {
    await dbConnect()
    const userId = getUserId()

    const task = await Task.findOneAndDelete({ _id: params.id, userId })

    if (!task) {
      return NextResponse.json({ success: false, error: "Task not found" }, { status: 404 })
    }

    // Also remove this task from any dependencies
    await Task.updateMany({ dependencies: params.id }, { $pull: { dependencies: params.id } })

    return NextResponse.json({ success: true, data: {} })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
