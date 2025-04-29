"use client"

import { Header } from "@/components/header"
import TaskManager from "@/app/task-manager"

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <main className="py-8">
        <TaskManager />
      </main>
    </div>
  )
}
