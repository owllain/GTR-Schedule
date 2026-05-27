'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StaffManager } from '@/components/schedule/staff-manager'
import { ScheduleDashboard } from '@/components/schedule/schedule-dashboard'
import { NovedadesManager } from '@/components/schedule/novedades-manager'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, Calendar, AlertCircle } from 'lucide-react'

export default function Home() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [staffCount, setStaffCount] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetch('/api/staff')
      .then(r => r.json())
      .then(data => setStaffCount(Array.isArray(data) ? data.length : 0))
      .catch(() => {})
  }, [refreshKey])

  const handleRefresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900">ScheduleCR</h1>
                <p className="text-xs text-slate-500">Generador de Horarios - Costa Rica</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600">
                <Users className="w-4 h-4" />
                <span>{staffCount} empleados activos</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1600px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-lg grid-cols-3">
            <TabsTrigger value="dashboard" className="gap-2">
              <Calendar className="w-4 h-4 hidden sm:block" />
              Horarios
            </TabsTrigger>
            <TabsTrigger value="staff" className="gap-2">
              <Users className="w-4 h-4 hidden sm:block" />
              Personal
            </TabsTrigger>
            <TabsTrigger value="novedades" className="gap-2">
              <AlertCircle className="w-4 h-4 hidden sm:block" />
              Novedades
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <ScheduleDashboard key={`dashboard-${refreshKey}`} onRefresh={handleRefresh} />
          </TabsContent>

          <TabsContent value="staff">
            <StaffManager key={`staff-${refreshKey}`} onRefresh={handleRefresh} />
          </TabsContent>

          <TabsContent value="novedades">
            <NovedadesManager key={`novedades-${refreshKey}`} onRefresh={handleRefresh} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-white/80 backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-500">
            <p>ScheduleCR — Generador de horarios conforme a la legislación laboral de Costa Rica</p>
            <p>Jornada Diurna: 48h | Mixta: 42h | Nocturna: 36h</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
