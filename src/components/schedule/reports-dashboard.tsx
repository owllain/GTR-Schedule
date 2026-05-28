'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  BarChart3,
  Calendar,
  User,
  TrendingUp,
  Download,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Briefcase,
  Coffee,
  Plane,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────

interface StaffOption {
  id: string
  nombre: string
  apellido: string
}

interface WeekData {
  semana: number
  horas: number
  deficit: number
  exceso: number
  cumple: boolean
}

interface StaffMonthReport {
  id: string
  nombre: string
  proforma: string
  finDeSemana: string
  totalHoras: number
  diasLaborados: number
  diasDescanso: number
  diasVacacion: number
  diasIncapacidad: number
  diasLicencia: number
  diasPermiso: number
  diasFeriado: number
  diasManuales: number
  semanales: { semana: number; horas: number; dias: number; cumple: boolean }[]
  semanasCumplen: number
  totalSemanas: number
}

interface StaffHistoryMonth {
  mes: string
  horas: number
  laborados: number
  descanso: number
  novedades: number
  manuales: number
}

interface StaffHistoryDetail {
  fecha: string
  entrada: string
  salida: string
  horas: number
  tipo: string
  notas: string | null
  manual: boolean
}

interface ComparativeRow {
  id: string
  nombre: string
  proforma: string
  totalHoras: number
  metaMensual: number
  cumplimiento: number
  weekData: WeekData[]
}

// ── Constants ──────────────────────────────────────────────────

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

const YEARS = Array.from({ length: 8 }, (_, i) => 2026 + i)

const typeLabels: Record<string, string> = {
  NORMAL: 'Normal', DESCANSO: 'Descanso', VACACION: 'Vacación',
  INCAPACIDAD: 'Incapacidad', LICENCIA: 'Licencia', PERMISO: 'Permiso', FERIADO: 'Feriado',
}

const typeBadge: Record<string, string> = {
  NORMAL: 'bg-teal-50 text-teal-700 border-teal-200',
  DESCANSO: 'bg-slate-100 text-slate-500 border-slate-200',
  VACACION: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  INCAPACIDAD: 'bg-red-100 text-red-700 border-red-200',
  LICENCIA: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  PERMISO: 'bg-orange-100 text-orange-700 border-orange-200',
  FERIADO: 'bg-indigo-100 text-indigo-700 border-indigo-200',
}

const fdsLabel: Record<string, string> = {
  MIXTO: 'Mixto', SABADO: 'Sábado', DOMINGO: 'Domingo',
}

// ── Helpers ────────────────────────────────────────────────────

function horasColor(h: number, target = 48) {
  if (h >= target - 1) return 'text-emerald-600'
  if (h >= target - 4) return 'text-amber-600'
  return 'text-red-500'
}

function cumplimientoColor(pct: number) {
  if (pct >= 95) return 'bg-emerald-500'
  if (pct >= 80) return 'bg-amber-400'
  return 'bg-red-400'
}

function exportCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
  const lines = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))]
  const body = new TextEncoder().encode(lines.join('\r\n'))
  const blob = new Blob([bom, body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

async function exportReportXlsx(payload: Record<string, string | number>, fallbackFilename: string) {
  const res = await fetch('/api/reports/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || 'No se pudo exportar XLSX')
  }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const disposition = res.headers.get('content-disposition')
  const filenameMatch = disposition?.match(/filename="?([^"]+)"?/)
  a.download = filenameMatch ? filenameMatch[1] : fallbackFilename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Sub-components ─────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color?: string
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${color ?? 'bg-teal-50'}`}>
        <Icon className={`w-4 h-4 ${color ? 'text-white' : 'text-teal-600'}`} />
      </div>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-xl font-bold text-slate-900 leading-tight">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function WeekBar({ horas, target = 48 }: { horas: number; target?: number }) {
  const pct = Math.min(100, (horas / target) * 100)
  const color = horas >= target - 1 ? 'bg-emerald-500' : horas >= target - 4 ? 'bg-amber-400' : 'bg-red-400'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold w-10 text-right ${horasColor(horas)}`}>{horas}h</span>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────

export function ReportsDashboard() {
  const { toast } = useToast()
  const now = new Date()
  const [activeView, setActiveView] = useState<'month' | 'staff' | 'comparative'>('month')

  // Shared selectors
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [staffList, setStaffList] = useState<StaffOption[]>([])
  const [selectedStaff, setSelectedStaff] = useState<string>('')
  const [startDate, setStartDate] = useState(`${now.getFullYear()}-01-01`)
  const [endDate, setEndDate] = useState(`${now.getFullYear()}-12-31`)

  // Report data
  const [monthReport, setMonthReport] = useState<{ staffReports: StaffMonthReport[]; daysInMonth: number } | null>(null)
  const [staffReport, setStaffReport] = useState<{
    staff: { nombre: string; proforma: string; finDeSemana: string }
    totalHoras: number; totalLaborados: number; totalNovedades: number
    porMes: StaffHistoryMonth[]; detalle: StaffHistoryDetail[]
  } | null>(null)
  const [comparativeReport, setComparativeReport] = useState<{ weeks: number[]; comparative: ComparativeRow[] } | null>(null)

  const [loading, setLoading] = useState(false)
  const [expandedStaff, setExpandedStaff] = useState<Set<string>>(new Set())
  const [showDetail, setShowDetail] = useState(false)

  useEffect(() => {
    fetch('/api/staff')
      .then(r => r.json())
      .then(data => setStaffList(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  const runReport = useCallback(async () => {
    setLoading(true)
    try {
      if (activeView === 'month') {
        const r = await fetch(`/api/reports?type=month&year=${year}&month=${month}`)
        const data = await r.json()
        if (!r.ok) throw new Error(data.error)
        setMonthReport(data)
      } else if (activeView === 'staff') {
        if (!selectedStaff) { toast({ title: 'Selecciona un empleado', variant: 'destructive' }); return }
        const r = await fetch(`/api/reports?type=staff&staffId=${selectedStaff}&startDate=${startDate}&endDate=${endDate}`)
        const data = await r.json()
        if (!r.ok) throw new Error(data.error)
        setStaffReport(data)
      } else {
        const r = await fetch(`/api/reports?type=comparative&year=${year}&month=${month}`)
        const data = await r.json()
        if (!r.ok) throw new Error(data.error)
        setComparativeReport(data)
      }
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [activeView, year, month, selectedStaff, startDate, endDate, toast])

  const toggleExpand = (id: string) => {
    setExpandedStaff(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── Export handlers ──────────────────────────────────────────

  const exportMonth = async () => {
    if (!monthReport) return
    try {
      await exportReportXlsx(
        { type: 'month', year, month },
        `reporte_mensual_${MONTHS[month - 1]}_${year}.xlsx`
      )
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const exportStaff = async () => {
    if (!staffReport || !selectedStaff) return
    try {
      await exportReportXlsx(
        { type: 'staff', staffId: selectedStaff, startDate, endDate },
        `historial_${staffReport.staff.nombre.replace(/ /g, '_')}.xlsx`
      )
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    }
  }

  const exportComparative = async () => {
    if (!comparativeReport) return
    try {
      await exportReportXlsx(
        { type: 'comparative', year, month },
        `comparativo_${MONTHS[month - 1]}_${year}.xlsx`
      )
    } catch (e) {
      toast({ title: 'Error', description: (e as Error).message, variant: 'destructive' })
    }
  }

  // ── Render ───────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* View Selector */}
      <div className="flex flex-wrap gap-2">
        {([
          { key: 'month', label: 'Reporte Mensual', icon: Calendar },
          { key: 'staff', label: 'Historial por Empleado', icon: User },
          { key: 'comparative', label: 'Comparativo de Cumplimiento', icon: TrendingUp },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setActiveView(key); setMonthReport(null); setStaffReport(null); setComparativeReport(null) }}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all
              ${activeView === key
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:border-teal-300 hover:bg-teal-50'
              }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Filters Card */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-teal-600" />
            {activeView === 'month' && 'Configurar reporte mensual'}
            {activeView === 'staff' && 'Configurar historial de empleado'}
            {activeView === 'comparative' && 'Configurar comparativo de cumplimiento'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            {(activeView === 'month' || activeView === 'comparative') && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500 font-medium">Año</label>
                  <Select value={String(year)} onValueChange={v => setYear(Number(v))}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {YEARS.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500 font-medium">Mes</label>
                  <Select value={String(month)} onValueChange={v => setMonth(Number(v))}>
                    <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {activeView === 'staff' && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500 font-medium">Empleado</label>
                  <Select value={selectedStaff} onValueChange={setSelectedStaff}>
                    <SelectTrigger className="w-52">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {staffList.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nombre} {s.apellido}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500 font-medium">Desde</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="h-9 px-3 rounded-md border border-input text-sm bg-transparent"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-500 font-medium">Hasta</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="h-9 px-3 rounded-md border border-input text-sm bg-transparent"
                  />
                </div>
              </>
            )}

            <Button
              onClick={runReport}
              disabled={loading}
              className="bg-teal-600 hover:bg-teal-700 gap-2"
            >
              <BarChart3 className="w-4 h-4" />
              {loading ? 'Generando...' : 'Generar reporte'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── MONTH REPORT ────────────────────────────────────── */}
      {activeView === 'month' && monthReport && (
        <div className="space-y-4">
          {/* Summary header */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">
              {MONTHS[month - 1]} {year} · {monthReport.staffReports.length} empleados
            </h3>
            <Button variant="outline" size="sm" onClick={exportMonth} className="gap-2">
              <Download className="w-4 h-4" /> Exportar XLSX
            </Button>
          </div>

          {/* Overview stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Clock} label="Empleados" value={monthReport.staffReports.length} />
            <StatCard
              icon={CheckCircle2}
              label="Promedio de horas"
              value={`${(monthReport.staffReports.reduce((s, r) => s + r.totalHoras, 0) / (monthReport.staffReports.length || 1)).toFixed(1)}h`}
            />
            <StatCard
              icon={TrendingUp}
              label="Semanas completas"
              value={`${monthReport.staffReports.filter(r => r.semanasCumplen === r.totalSemanas).length}/${monthReport.staffReports.length}`}
              sub="todos con 48h"
            />
            <StatCard
              icon={AlertTriangle}
              label="Con novedades"
              value={monthReport.staffReports.filter(r => r.diasVacacion + r.diasIncapacidad + r.diasLicencia + r.diasPermiso + r.diasFeriado > 0).length}
              sub="empleados"
            />
          </div>

          {/* Per-staff cards */}
          <div className="space-y-3">
            {monthReport.staffReports.map(s => {
              const expanded = expandedStaff.has(s.id)
              const novedades = s.diasVacacion + s.diasIncapacidad + s.diasLicencia + s.diasPermiso + s.diasFeriado
              return (
                <Card key={s.id} className="border-slate-200/80 shadow-sm overflow-hidden">
                  <button
                    className="w-full text-left"
                    onClick={() => toggleExpand(s.id)}
                  >
                    <div className="flex items-center gap-4 p-4">
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
                        {s.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
                      </div>

                      {/* Name + proforma */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{s.nombre}</p>
                        <p className="text-xs text-slate-400 truncate">{s.proforma}</p>
                      </div>

                      {/* Hours */}
                      <div className="text-right shrink-0">
                        <p className={`text-2xl font-bold ${horasColor(s.totalHoras)}`}>{s.totalHoras}h</p>
                        <p className="text-xs text-slate-400">{s.diasLaborados} días lab.</p>
                      </div>

                      {/* Weeks compliance */}
                      <div className="hidden md:block shrink-0 w-24">
                        <p className="text-xs text-slate-500 mb-1">Semanas OK</p>
                        <div className="flex gap-1">
                          {s.semanales.map(sw => (
                            <div
                              key={sw.semana}
                              className={`h-5 flex-1 rounded-sm ${sw.cumple ? 'bg-emerald-400' : 'bg-red-300'}`}
                              title={`Sem ${sw.semana}: ${sw.horas}h`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{s.semanasCumplen}/{s.totalSemanas}</p>
                      </div>

                      {/* Novedades badge */}
                      {novedades > 0 && (
                        <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs shrink-0">
                          {novedades} nov.
                        </Badge>
                      )}

                      {/* Expand icon */}
                      <div className="text-slate-400 shrink-0">
                        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {expanded && (
                    <div className="border-t border-slate-100 bg-slate-50/60 p-4 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                      <div className="text-center">
                        <Briefcase className="w-4 h-4 mx-auto text-teal-600 mb-1" />
                        <p className="text-lg font-bold text-slate-800">{s.diasLaborados}</p>
                        <p className="text-xs text-slate-500">Laborados</p>
                      </div>
                      <div className="text-center">
                        <Coffee className="w-4 h-4 mx-auto text-slate-400 mb-1" />
                        <p className="text-lg font-bold text-slate-800">{s.diasDescanso}</p>
                        <p className="text-xs text-slate-500">Descanso</p>
                      </div>
                      <div className="text-center">
                        <Plane className="w-4 h-4 mx-auto text-emerald-500 mb-1" />
                        <p className="text-lg font-bold text-slate-800">{s.diasVacacion}</p>
                        <p className="text-xs text-slate-500">Vacación</p>
                      </div>
                      <div className="text-center">
                        <XCircle className="w-4 h-4 mx-auto text-red-400 mb-1" />
                        <p className="text-lg font-bold text-slate-800">{s.diasIncapacidad}</p>
                        <p className="text-xs text-slate-500">Incapacidad</p>
                      </div>
                      <div className="text-center">
                        <FileText className="w-4 h-4 mx-auto text-yellow-500 mb-1" />
                        <p className="text-lg font-bold text-slate-800">{s.diasLicencia}</p>
                        <p className="text-xs text-slate-500">Licencia</p>
                      </div>
                      <div className="text-center">
                        <AlertTriangle className="w-4 h-4 mx-auto text-orange-400 mb-1" />
                        <p className="text-lg font-bold text-slate-800">{s.diasPermiso}</p>
                        <p className="text-xs text-slate-500">Permiso</p>
                      </div>
                      <div className="text-center">
                        <Calendar className="w-4 h-4 mx-auto text-indigo-400 mb-1" />
                        <p className="text-lg font-bold text-slate-800">{s.diasFeriado}</p>
                        <p className="text-xs text-slate-500">Feriado</p>
                      </div>
                      <div className="text-center">
                        <Clock className="w-4 h-4 mx-auto text-slate-600 mb-1" />
                        <p className="text-lg font-bold text-slate-800">{s.diasManuales}</p>
                        <p className="text-xs text-slate-500">Manuales</p>
                      </div>

                      {/* Weekly breakdown */}
                      {s.semanales.length > 0 && (
                        <div className="col-span-2 sm:col-span-4 lg:col-span-8 pt-2 border-t border-slate-200 space-y-1.5">
                          <p className="text-xs font-medium text-slate-600">Horas por semana (meta 48h)</p>
                          {s.semanales.map(sw => (
                            <div key={sw.semana} className="flex items-center gap-3">
                              <span className="text-xs text-slate-400 w-16">Sem {sw.semana}</span>
                              <WeekBar horas={sw.horas} />
                              {sw.cumple
                                ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                                : <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                              }
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* ── STAFF HISTORY REPORT ────────────────────────────── */}
      {activeView === 'staff' && staffReport && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">{staffReport.staff.nombre}</h3>
              <p className="text-sm text-slate-500">{staffReport.staff.proforma} · {fdsLabel[staffReport.staff.finDeSemana]}</p>
            </div>
            <Button variant="outline" size="sm" onClick={exportStaff} className="gap-2">
              <Download className="w-4 h-4" /> Exportar XLSX
            </Button>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Clock} label="Total horas" value={`${staffReport.totalHoras}h`} />
            <StatCard icon={Briefcase} label="Días laborados" value={staffReport.totalLaborados} />
            <StatCard icon={AlertTriangle} label="Novedades" value={staffReport.totalNovedades} sub="vacación, incap., etc." />
            <StatCard icon={Calendar} label="Período" value={staffReport.porMes.length} sub="meses con actividad" />
          </div>

          {/* Monthly breakdown */}
          <Card className="border-slate-200/80 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Resumen por mes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {staffReport.porMes.map(m => {
                  const [y, mo] = m.mes.split('-').map(Number)
                  return (
                    <div key={m.mes} className="flex items-center gap-4 p-3 rounded-xl bg-slate-50/60 hover:bg-slate-50">
                      <div className="w-24 shrink-0">
                        <p className="text-sm font-semibold text-slate-700">{MONTHS[mo - 1]}</p>
                        <p className="text-xs text-slate-400">{y}</p>
                      </div>
                      <div className="flex-1">
                        <WeekBar horas={m.horas} target={m.horas > 0 ? Math.round(m.horas / 4) * 4 : 192} />
                      </div>
                      <div className="flex gap-3 shrink-0 text-center">
                        <div>
                          <p className={`text-base font-bold ${horasColor(m.horas / 4)}`}>{m.horas}h</p>
                          <p className="text-[10px] text-slate-400">total</p>
                        </div>
                        <div>
                          <p className="text-base font-bold text-slate-700">{m.laborados}</p>
                          <p className="text-[10px] text-slate-400">días lab.</p>
                        </div>
                        {m.novedades > 0 && (
                          <div>
                            <p className="text-base font-bold text-amber-600">{m.novedades}</p>
                            <p className="text-[10px] text-slate-400">novedades</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Day-by-day detail toggle */}
          <div>
            <Button
              variant="outline"
              onClick={() => setShowDetail(d => !d)}
              className="gap-2 w-full justify-between"
            >
              <span className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Ver detalle diario ({staffReport.detalle.length} días)
              </span>
              {showDetail ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>

            {showDetail && (
              <Card className="mt-2 border-slate-200/80 shadow-sm">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50 text-xs text-slate-500">
                          <th className="text-left px-4 py-2">Fecha</th>
                          <th className="text-center px-3 py-2">Entrada</th>
                          <th className="text-center px-3 py-2">Salida</th>
                          <th className="text-center px-3 py-2">Horas</th>
                          <th className="text-center px-3 py-2">Tipo</th>
                          <th className="text-left px-3 py-2">Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staffReport.detalle.map(d => (
                          <tr key={d.fecha} className="border-b border-slate-50 hover:bg-slate-50/40">
                            <td className="px-4 py-1.5 font-mono text-xs text-slate-600">{d.fecha}</td>
                            <td className="px-3 py-1.5 text-center text-xs">{d.entrada || '—'}</td>
                            <td className="px-3 py-1.5 text-center text-xs">{d.salida || '—'}</td>
                            <td className="px-3 py-1.5 text-center">
                              <span className={`text-xs font-bold ${d.horas > 0 ? horasColor(d.horas, 8) : 'text-slate-300'}`}>
                                {d.horas > 0 ? `${d.horas}h` : '—'}
                              </span>
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <Badge className={`text-[10px] ${typeBadge[d.tipo] ?? 'bg-slate-100 text-slate-600'}`} variant="outline">
                                {typeLabels[d.tipo] ?? d.tipo}
                              </Badge>
                            </td>
                            <td className="px-3 py-1.5 text-xs text-slate-400">{d.notas ?? ''}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {/* ── COMPARATIVE REPORT ──────────────────────────────── */}
      {activeView === 'comparative' && comparativeReport && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-800">
              Cumplimiento 48h — {MONTHS[month - 1]} {year}
            </h3>
            <Button variant="outline" size="sm" onClick={exportComparative} className="gap-2">
              <Download className="w-4 h-4" /> Exportar XLSX
            </Button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Users_} label="Empleados" value={comparativeReport.comparative.length} />
            <StatCard
              icon={CheckCircle2}
              label="Cumplen meta"
              value={comparativeReport.comparative.filter(c => c.cumplimiento >= 95).length}
              sub="≥ 95%"
              color="bg-emerald-500"
            />
            <StatCard
              icon={AlertTriangle}
              label="En riesgo"
              value={comparativeReport.comparative.filter(c => c.cumplimiento >= 80 && c.cumplimiento < 95).length}
              sub="80–94%"
              color="bg-amber-400"
            />
            <StatCard
              icon={XCircle}
              label="Bajo meta"
              value={comparativeReport.comparative.filter(c => c.cumplimiento < 80).length}
              sub="< 80%"
              color="bg-red-400"
            />
          </div>

          {/* Table */}
          <Card className="border-slate-200/80 shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50 text-xs text-slate-500">
                      <th className="text-left px-4 py-3 min-w-[200px]">Empleado</th>
                      <th className="text-center px-3 py-3 min-w-[80px]">Total h</th>
                      <th className="text-center px-3 py-3 min-w-[100px]">Cumplimiento</th>
                      {comparativeReport.weeks.map(w => (
                        <th key={w} className="text-center px-3 py-3 min-w-[80px]">Sem {w}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {comparativeReport.comparative.map((c, idx) => (
                      <tr key={c.id} className={`border-b ${idx % 2 === 0 ? '' : 'bg-slate-50/40'}`}>
                        {/* Name */}
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                              {c.nombre.split(' ').map(n => n[0]).join('').slice(0, 2)}
                            </div>
                            <div>
                              <p className="font-medium text-slate-800">{c.nombre}</p>
                              <p className="text-[10px] text-slate-400 truncate max-w-[160px]">{c.proforma}</p>
                            </div>
                          </div>
                        </td>

                        {/* Total hours */}
                        <td className="px-3 py-2.5 text-center">
                          <span className={`font-bold text-base ${horasColor(c.totalHoras / (comparativeReport.weeks.length || 1))}`}>
                            {c.totalHoras}h
                          </span>
                          <p className="text-[10px] text-slate-400">meta {c.metaMensual}h</p>
                        </td>

                        {/* % Compliance */}
                        <td className="px-3 py-2.5">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`text-sm font-bold ${
                              c.cumplimiento >= 95 ? 'text-emerald-600' :
                              c.cumplimiento >= 80 ? 'text-amber-600' : 'text-red-500'
                            }`}>{c.cumplimiento}%</span>
                            <div className="w-full bg-slate-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full ${cumplimientoColor(c.cumplimiento)}`}
                                style={{ width: `${Math.min(100, c.cumplimiento)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Per-week */}
                        {comparativeReport.weeks.map(w => {
                          const wd = c.weekData.find(d => d.semana === w)
                          const h = wd?.horas ?? 0
                          return (
                            <td key={w} className="px-3 py-2.5 text-center">
                              <div className={`inline-flex items-center justify-center w-14 h-7 rounded-lg text-xs font-bold
                                ${h === 0 ? 'bg-slate-100 text-slate-400' :
                                  wd?.cumple ? 'bg-emerald-50 text-emerald-700' :
                                  h >= 44 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                                }`}>
                                {h > 0 ? `${h}h` : '—'}
                              </div>
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> ≥ 46h (cumple)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> 44–45h (cerca)</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> {'< 44h (déficit)'}</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200" /> Sin datos</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !monthReport && !staffReport && !comparativeReport && (
        <div className="text-center py-16 text-slate-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-slate-200" />
          <p className="font-medium">Configura los filtros y genera el reporte</p>
          <p className="text-sm mt-1">Los datos se toman del horario generado en la base de datos</p>
        </div>
      )}
    </div>
  )
}

// Alias to avoid naming conflict with staffList variable above
function Users_({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
