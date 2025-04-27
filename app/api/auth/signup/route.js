import { NextResponse } from "next/server"
import dbConnect from "@/lib/db"
import User from "@/models/User"
import { hashPassword } from "@/lib/auth"

export async function POST(request) {
  try {
    await dbConnect()

    const { name, email, password } = await request.json()

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json({ success: false, error: "Please provide name, email, and password" }, { status: 400 })
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return NextResponse.json({ success: false, error: "User with this email already exists" }, { status: 409 })
    }

    // Hash password
    const hashedPassword = await hashPassword(password)

    // Create new user
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    })

    // Remove password from response
    const userWithoutPassword = {
      _id: user._id,
      name: user.name,
      email: user.email,
    }

    return NextResponse.json({ success: true, data: userWithoutPassword }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
