'use client'

import { useState, useEffect, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StaffManager } from '@/components/schedule/staff-manager'
import { ScheduleDashboard } from '@/components/schedule/schedule-dashboard'
import { NovedadesManager } from '@/components/schedule/novedades-manager'
import { ProformasManager } from '@/components/schedule/proformas-manager'
import { Users, Calendar, AlertCircle, LayoutTemplate, Sparkles, ShieldCheck, Clock3, ArrowRight } from 'lucide-react'

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
                <p className="text-xs text-slate-500">Gestión de personal, proformas y turnos</p>
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
        <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] mb-6">
          <article className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-teal-700">
              <Sparkles className="h-3.5 w-3.5" />
              Guía rápida
            </p>
            <h2 className="max-w-xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Un panel de horarios con ritmo, contraste y menos ruido visual.</h2>
            <p className="mt-4 max-w-2xl text-slate-600">Aquí puedes revisar turnos, personal y proformas desde una sola vista con una navegación más clara.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => setActiveTab('dashboard')} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">Abrir horarios <ArrowRight className="h-4 w-4" /></button>
              <button onClick={() => setActiveTab('proformas')} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-teal-200 hover:bg-teal-50">Ver proformas</button>
            </div>
          </article>

          <article className="grid gap-4 rounded-3xl bg-[linear-gradient(135deg,#0f172a,#111827)] p-6 text-white shadow-sm sm:p-8">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.24em] text-teal-100">Resumen rápido</span>
              <ShieldCheck className="h-5 w-5 text-teal-200" />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
              <p className="text-sm text-teal-100">Personal activo</p>
              <p className="mt-1 text-3xl font-semibold">{staffCount}</p>
              <p className="text-xs text-slate-200">Empleados disponibles para asignar turnos y novedades.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <Clock3 className="h-4 w-4 text-teal-200" />
                <p className="mt-3 text-sm text-teal-100">Turnos</p>
                <p className="text-xl font-semibold">48h / semana</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/8 p-4">
                <Calendar className="h-4 w-4 text-teal-200" />
                <p className="mt-3 text-sm text-teal-100">Calendario</p>
                <p className="text-xl font-semibold">2024–2028</p>
              </div>
            </div>
          </article>
        </section>

        <section className="grid gap-4 md:grid-cols-3 mb-6">
          <article className="rounded-3xl bg-[#aa2d00] p-6 text-white shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-orange-100">Horarios</p>
            <h3 className="mt-3 text-2xl font-semibold">Gestiona turnos y revisa el calendario del mes</h3>
            <p className="mt-2 text-sm text-orange-50/90">Aquí puedes generar, editar y exportar el horario para ver cómo queda cada semana.</p>
          </article>
          <article className="rounded-3xl bg-[#0a2e0e] p-6 text-white shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-100">Personal</p>
            <h3 className="mt-3 text-2xl font-semibold">Administra a tu equipo y carga CSV cuando sea necesario</h3>
            <p className="mt-2 text-sm text-emerald-50/90">Mantén asignados los empleados, sus preferencias de fin de semana y sus proformas.</p>
          </article>
          <article className="rounded-3xl bg-[#f5e9d4] p-6 text-slate-900 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-600">Proformas</p>
            <h3 className="mt-3 text-2xl font-semibold">Crea y reutiliza horarios estándar sin repetir trabajo</h3>
            <p className="mt-2 text-sm text-slate-700">Las proformas ayudan a asignar rápidamente patrones de trabajo y evitar errores manuales.</p>
          </article>
        </section>

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
            <ScheduleDashboard onRefresh={handleRefresh} />
          </TabsContent>

          <TabsContent value="staff">
            <StaffManager onRefresh={handleRefresh} />
          </TabsContent>

          <TabsContent value="proformas">
            <ProformasManager onRefresh={handleRefresh} />
          </TabsContent>

          <TabsContent value="novedades">
            <NovedadesManager onRefresh={handleRefresh} />
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
