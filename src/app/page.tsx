'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StaffManager } from '@/components/schedule/staff-manager'
import { ScheduleDashboard } from '@/components/schedule/schedule-dashboard'
import { NovedadesManager } from '@/components/schedule/novedades-manager'
import { ProformasManager } from '@/components/schedule/proformas-manager'
import { Users, Calendar, AlertCircle, LayoutTemplate } from 'lucide-react'

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
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-teal-50/30 via-white to-emerald-50/20">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 flex items-center justify-center shadow-md">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Gestor de Horarios - STAFF</h1>
                <p className="text-xs text-slate-500">Legislación laboral de Costa Rica</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600 bg-slate-50 px-3 py-1.5 rounded-full">
                <Users className="w-4 h-4 text-teal-600" />
                <span>{staffCount} empleado{staffCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1800px] mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-xl grid-cols-4 h-auto bg-slate-100/80 p-1">
            <TabsTrigger value="dashboard" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-700 text-xs sm:text-sm">
              <Calendar className="w-4 h-4" />
              <span className="hidden sm:inline">Horarios</span>
            </TabsTrigger>
            <TabsTrigger value="staff" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-700 text-xs sm:text-sm">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Personal</span>
            </TabsTrigger>
            <TabsTrigger value="proformas" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-700 text-xs sm:text-sm">
              <LayoutTemplate className="w-4 h-4" />
              <span className="hidden sm:inline">Proformas</span>
            </TabsTrigger>
            <TabsTrigger value="novedades" className="gap-1.5 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-teal-700 text-xs sm:text-sm">
              <AlertCircle className="w-4 h-4" />
              <span className="hidden sm:inline">Novedades</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <ScheduleDashboard key={`dashboard-${refreshKey}`} onRefresh={handleRefresh} />
          </TabsContent>

          <TabsContent value="staff">
            <StaffManager key={`staff-${refreshKey}`} onRefresh={handleRefresh} />
          </TabsContent>

          <TabsContent value="proformas">
            <ProformasManager key={`proformas-${refreshKey}`} onRefresh={handleRefresh} />
          </TabsContent>

          <TabsContent value="novedades">
            <NovedadesManager key={`novedades-${refreshKey}`} onRefresh={handleRefresh} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t bg-white/80 backdrop-blur-sm">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-sm text-slate-500">
              Desarrollado por Alvaro Enrique Cascante Moraga &middot; acascantem@netcom.com.pa
            </p>
            <p className="text-xs text-slate-400">
              Jornada 48h/semana &middot; Fin de semana 10h &middot; L-V ajustable
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
