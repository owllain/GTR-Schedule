'use client'

import { useState, useEffect, useCallback, type DragEvent } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { CalendarDays, Download, RefreshCw, Clock, Edit2, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2, LayoutTemplate, Move, Wand2 } from 'lucide-react'

interface Proforma {
  id: string
  nombre: string
  descripcion: string | null
  entradas: { diaSemana: number; horaEntrada: string; horaSalida: string; esDescanso: boolean }[]
}

interface ScheduleEntry {
  id: string
  staffId: string
  date: string
  entryTime: string
  exitTime: string
  hours: number
  type: string
  notes: string | null
  isWeekend: boolean
  isManual: boolean
  staff: { id: string; nombre: string; apellido: string; finDeSemanaPreferente: string }
}

interface StaffInfo {
  id: string
  nombre: string
  apellido: string
  finDeSemanaPreferente: string
  proformaId: string | null
  proforma: Proforma | null
}

interface WeeklySummary {
  weekNum: number
  weekStart: string
  weekEnd: string
  hours: number
  target: number
}

interface ScheduleDashboardProps {
  onRefresh: () => void
}

const typeLabels: Record<string, string> = {
  NORMAL: '',
  VACACION: 'VAC',
  INCAPACIDAD: 'INC',
  LICENCIA: 'LIC',
  PERMISO: 'PER',
  FERIADO: 'FER',
  DESCANSO: 'D',
}

const typeColors: Record<string, string> = {
  NORMAL: '',
  VACACION: 'bg-emerald-100 text-emerald-800',
  INCAPACIDAD: 'bg-red-100 text-red-800',
  LICENCIA: 'bg-amber-100 text-amber-800',
  PERMISO: 'bg-orange-100 text-orange-800',
  FERIADO: 'bg-violet-100 text-violet-800',
  DESCANSO: 'bg-slate-100 text-slate-400',
}

const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

interface PlannerTemplate {
  id: string
  label: string
  type: string
  entryTime: string
  exitTime: string
  notes?: string
}

const plannerTemplates: PlannerTemplate[] = [
  { id: 'normal-84', label: '08:00-16:00', type: 'NORMAL', entryTime: '08:00', exitTime: '16:00' },
  { id: 'normal-94', label: '09:00-16:00', type: 'NORMAL', entryTime: '09:00', exitTime: '16:00' },
  { id: 'normal-86', label: '08:00-18:00', type: 'NORMAL', entryTime: '08:00', exitTime: '18:00' },
  { id: 'normal-96', label: '09:00-18:00', type: 'NORMAL', entryTime: '09:00', exitTime: '18:00' },
  { id: 'descanso', label: 'Descanso', type: 'DESCANSO', entryTime: '', exitTime: '' },
  { id: 'vac-8h', label: 'Vacación 8h', type: 'VACACION', entryTime: '', exitTime: '', notes: '[VAC_HOURS:8] Vacación día completo' },
  { id: 'vac-4h', label: 'Vacación 4h', type: 'VACACION', entryTime: '', exitTime: '', notes: '[VAC_HOURS:4] Vacación medio día' },
]

function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + 'T12:00:00')
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export function ScheduleDashboard({ onRefresh }: ScheduleDashboardProps) {
  const { toast } = useToast()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [staffList, setStaffList] = useState<StaffInfo[]>([])
  const [proformas, setProformas] = useState<Proforma[]>([])
  const [weeklySummaries, setWeeklySummaries] = useState<Record<string, WeeklySummary[]>>({})
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [editEntry, setEditEntry] = useState<ScheduleEntry | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState({ entryTime: '', exitTime: '', type: 'NORMAL', notes: '' })
  const [bulkEditStaff, setBulkEditStaff] = useState<string | null>(null)
  const [bulkProformaId, setBulkProformaId] = useState('')
  const [selectedWeek, setSelectedWeek] = useState<string>('')
  const [smartGroup, setSmartGroup] = useState<'ALL' | 'MIXTO' | 'SABADO' | 'DOMINGO'>('ALL')
  const [smartOnlyWithoutProforma, setSmartOnlyWithoutProforma] = useState(true)
  const [smartProformaId, setSmartProformaId] = useState('')

  const fetchSchedule = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/schedule?year=${year}&month=${month}`)
      const data = await res.json()
      setEntries(data.entries || [])
      setWeeklySummaries(data.weeklySummaries || {})
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar el horario', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [year, month, toast])

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/staff')
      const data = await res.json()
      setStaffList(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
  }, [])

  const fetchProformas = useCallback(async () => {
    try {
      const res = await fetch('/api/proformas')
      const data = await res.json()
      setProformas(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchSchedule() }, [fetchSchedule])
  useEffect(() => { fetchStaff() }, [fetchStaff])
  useEffect(() => { fetchProformas() }, [fetchProformas])

  const handleGenerate = async (useBlank: boolean = true) => {
    setGenerating(true)
    try {
      const res = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month, useBlankEntries: useBlank }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Horario generado', description: data.message })
        await fetchSchedule()
        onRefresh()
      } else {
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo generar el horario', variant: 'destructive' })
    } finally {
      setGenerating(false)
    }
  }

  const handleExport = async () => {
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url

        const disposition = res.headers.get('content-disposition')
        const filenameMatch = disposition?.match(/filename="?([^"]+)"?/)
        const filename = filenameMatch ? filenameMatch[1] : `horario_${monthNames[month - 1]}_${year}.xlsx`

        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        toast({ title: 'Exportado', description: 'Archivo Excel generado exitosamente' })
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo exportar', variant: 'destructive' })
    }
  }

  const handleEditEntry = (entry: ScheduleEntry) => {
    setEditEntry(entry)
    setEditForm({
      entryTime: entry.entryTime,
      exitTime: entry.exitTime,
      type: entry.type,
      notes: entry.notes || '',
    })
    setEditDialogOpen(true)
  }

  const handleSaveEdit = async () => {
    if (!editEntry) return
    try {
      const isNonWorking = ['DESCANSO', 'VACACION', 'INCAPACIDAD', 'LICENCIA', 'FERIADO', 'PERMISO'].includes(editForm.type)
      const res = await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editEntry.id,
          entryTime: isNonWorking ? '' : editForm.entryTime,
          exitTime: isNonWorking ? '' : editForm.exitTime,
          type: editForm.type,
          notes: editForm.notes,
        }),
      })
      if (res.ok) {
        toast({ title: 'Actualizado', description: 'Entrada de horario actualizada' })
        fetchSchedule()
      }
      setEditDialogOpen(false)
    } catch {
      toast({ title: 'Error', description: 'No se pudo actualizar', variant: 'destructive' })
    }
  }

  // Apply proforma to a staff member's existing entries
  const handleApplyProforma = async () => {
    if (!bulkEditStaff || !bulkProformaId) {
      toast({ title: 'Error', description: 'Seleccione empleado y proforma', variant: 'destructive' })
      return
    }

    const proforma = proformas.find(p => p.id === bulkProformaId)
    if (!proforma) return

    try {
      // Update all NORMAL entries for this staff in this month
      const staffEntries = entries.filter(e =>
        e.staffId === bulkEditStaff && e.type === 'NORMAL'
      )

      let updated = 0
      for (const entry of staffEntries) {
        const date = new Date(entry.date + 'T12:00:00')
        const dow = date.getDay()
        const proformaEntry = proforma.entradas.find(pe => pe.diaSemana === dow)

        if (!proformaEntry) continue

        if (proformaEntry.esDescanso) {
          await fetch('/api/schedule', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: entry.id,
              entryTime: '',
              exitTime: '',
              type: 'DESCANSO',
              notes: 'Según proforma',
            }),
          })
        } else {
          await fetch('/api/schedule', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: entry.id,
              entryTime: proformaEntry.horaEntrada,
              exitTime: proformaEntry.horaSalida,
              type: 'NORMAL',
              notes: '',
            }),
          })
        }
        updated++
      }

      // Also update the staff's proforma assignment
      await fetch('/api/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bulkEditStaff, proformaId: bulkProformaId }),
      })

      toast({ title: 'Proforma aplicada', description: `${updated} entradas actualizadas` })
      fetchSchedule()
      setBulkEditStaff(null)
      setBulkProformaId('')
    } catch {
      toast({ title: 'Error', description: 'No se pudo aplicar la proforma', variant: 'destructive' })
    }
  }

  const weekOptions = Array.from(new Set(entries.map(e => getWeekNumber(e.date)))).sort((a, b) => a - b)

  useEffect(() => {
    if (!selectedWeek && weekOptions.length > 0) setSelectedWeek(String(weekOptions[0]))
    if (selectedWeek && !weekOptions.includes(Number(selectedWeek)) && weekOptions.length > 0) {
      setSelectedWeek(String(weekOptions[0]))
    }
  }, [selectedWeek, weekOptions])

  const applyTemplateToEntry = async (entry: ScheduleEntry, template: PlannerTemplate) => {
    const isNonWorking = template.type !== 'NORMAL'
    try {
      const res = await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          entryTime: isNonWorking ? '' : template.entryTime,
          exitTime: isNonWorking ? '' : template.exitTime,
          type: template.type,
          notes: template.notes || '',
        }),
      })
      if (!res.ok) throw new Error('No se pudo actualizar')
      await fetchSchedule()
      toast({ title: 'Planner actualizado', description: `${entry.staff.nombre} ${entry.staff.apellido} · ${template.label}` })
    } catch {
      toast({ title: 'Error', description: 'No se pudo aplicar la plantilla en el planner', variant: 'destructive' })
    }
  }

  const handleDropTemplate = async (entry: ScheduleEntry, event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    const raw = event.dataTransfer.getData('application/json')
    if (!raw) return
    const template = JSON.parse(raw) as PlannerTemplate
    await applyTemplateToEntry(entry, template)
  }

  const handleSmartAssign = async () => {
    if (!smartProformaId) {
      toast({ title: 'Error', description: 'Seleccione una proforma para asignación inteligente', variant: 'destructive' })
      return
    }
    const selectedProforma = proformas.find(p => p.id === smartProformaId)
    if (!selectedProforma) return

    const targetStaff = staffList.filter(s => {
      const groupMatch = smartGroup === 'ALL' || s.finDeSemanaPreferente === smartGroup
      const proformaMatch = !smartOnlyWithoutProforma || !s.proformaId
      return groupMatch && proformaMatch
    })

    if (targetStaff.length === 0) {
      toast({ title: 'Sin coincidencias', description: 'No hay personal que cumpla el filtro inteligente' })
      return
    }

    let updatedEntries = 0
    for (const staff of targetStaff) {
      await fetch('/api/staff', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: staff.id, proformaId: smartProformaId }),
      })

      const staffEntries = entries.filter(e => e.staffId === staff.id && e.type === 'NORMAL')
      for (const entry of staffEntries) {
        const dow = new Date(entry.date + 'T12:00:00').getDay()
        const pe = selectedProforma.entradas.find(x => x.diaSemana === dow)
        if (!pe) continue
        await fetch('/api/schedule', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: entry.id,
            entryTime: pe.esDescanso ? '' : pe.horaEntrada,
            exitTime: pe.esDescanso ? '' : pe.horaSalida,
            type: pe.esDescanso ? 'DESCANSO' : 'NORMAL',
            notes: pe.esDescanso ? 'Según proforma inteligente' : '',
          }),
        })
        updatedEntries++
      }
    }

    await fetchStaff()
    await fetchSchedule()
    toast({
      title: 'Asignación inteligente completada',
      description: `${targetStaff.length} colaboradores actualizados y ${updatedEntries} jornadas ajustadas`,
    })
  }

  // Build calendar data
  const daysInMonth = new Date(year, month, 0).getDate()
  const entryMap = new Map<string, Map<string, ScheduleEntry>>()
  for (const entry of entries) {
    if (!entryMap.has(entry.date)) entryMap.set(entry.date, new Map())
    entryMap.get(entry.date)!.set(entry.staffId, entry)
  }

  const getStaffWeeklySummary = (staffId: string): WeeklySummary[] => {
    return weeklySummaries[staffId] || []
  }

  const getMonthTotal = (staffId: string): number => {
    return entries
      .filter(e => e.staffId === staffId && e.hours > 0)
      .reduce((sum, e) => sum + e.hours, 0)
  }

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  const plannerWeekEntries = entries.filter(e => getWeekNumber(e.date) === Number(selectedWeek))
  const plannerDates = Array.from(new Set(plannerWeekEntries.map(e => e.date))).sort()
  const plannerMap = new Map<string, Map<string, ScheduleEntry>>()
  for (const e of plannerWeekEntries) {
    if (!plannerMap.has(e.staffId)) plannerMap.set(e.staffId, new Map())
    plannerMap.get(e.staffId)!.set(e.date, e)
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={prevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="flex items-center gap-2">
                <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNames.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
                  <SelectTrigger className="w-[100px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button variant="outline" size="icon" onClick={nextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button onClick={() => handleGenerate(true)} disabled={generating || staffList.length === 0} className="bg-teal-600 hover:bg-teal-700 gap-2 shadow-sm">
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
                {generating ? 'Generando...' : 'Generar Horario'}
              </Button>
              <Button onClick={() => handleGenerate(false)} disabled={generating || staffList.length === 0} variant="outline" className="gap-2">
                <Clock className="w-4 h-4" />
                <span className="hidden sm:inline">Generar con Horas</span>
              </Button>
              <Button onClick={handleExport} disabled={entries.length === 0} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                <span className="hidden sm:inline">Exportar Excel</span>
              </Button>
            </div>
          </div>

          {/* Proforma Bulk Apply */}
          {staffList.length > 0 && entries.length > 0 && proformas.length > 0 && (
            <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-3">
              <LayoutTemplate className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-600">Aplicar proforma a:</span>
              <Select value={bulkEditStaff || ''} onValueChange={setBulkEditStaff}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Empleado..." />
                </SelectTrigger>
                <SelectContent>
                  {staffList.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.nombre} {s.apellido}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={bulkProformaId} onValueChange={setBulkProformaId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Proforma..." />
                </SelectTrigger>
                <SelectContent>
                  {proformas.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" onClick={handleApplyProforma} disabled={!bulkEditStaff || !bulkProformaId} className="bg-violet-600 hover:bg-violet-700">
                Aplicar
              </Button>
            </div>
          )}

          {staffList.length > 0 && entries.length > 0 && proformas.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <Wand2 className="w-4 h-4 text-teal-600" />
              <span className="text-slate-600 font-medium">Plantillas por área/cargo (asignación inteligente):</span>
              <Select value={smartGroup} onValueChange={v => setSmartGroup(v as 'ALL' | 'MIXTO' | 'SABADO' | 'DOMINGO')}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Todos los segmentos</SelectItem>
                  <SelectItem value="MIXTO">Área Mixto (rotación)</SelectItem>
                  <SelectItem value="SABADO">Cargo Sábado</SelectItem>
                  <SelectItem value="DOMINGO">Cargo Domingo</SelectItem>
                </SelectContent>
              </Select>
              <Select value={smartProformaId} onValueChange={setSmartProformaId}>
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Proforma objetivo..." />
                </SelectTrigger>
                <SelectContent>
                  {proformas.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Switch checked={smartOnlyWithoutProforma} onCheckedChange={setSmartOnlyWithoutProforma} />
                <span className="text-xs text-slate-500">Solo sin proforma</span>
              </div>
              <Button size="sm" className="bg-teal-600 hover:bg-teal-700" onClick={handleSmartAssign} disabled={!smartProformaId}>
                Asignar inteligente
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Summary Cards */}
      {staffList.length > 0 && entries.length > 0 && (
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-teal-600" />
              Resumen Semanal de Horas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Fin de Semana</TableHead>
                    <TableHead>Meta</TableHead>
                    {getStaffWeeklySummary(staffList[0]?.id || '').map(w => (
                      <TableHead key={w.weekNum} className="text-center">Sem {w.weekNum}</TableHead>
                    ))}
                    <TableHead className="text-center font-bold">Total Mes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffList.map(s => {
                    const summaries = getStaffWeeklySummary(s.id)
                    const monthTotal = getMonthTotal(s.id)
                    const numWeeks = summaries.length || 1
                    const monthTarget = 48 * numWeeks

                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.nombre} {s.apellido}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {s.finDeSemanaPreferente}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">48h</TableCell>
                        {summaries.map(w => {
                          const diff = w.hours - w.target
                          return (
                            <TableCell key={w.weekNum} className="text-center">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span className={`text-sm font-medium ${diff > 2 ? 'text-red-600' : diff < -2 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                      {w.hours}h
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Meta: {w.target}h | Diferencia: {diff > 0 ? '+' : ''}{diff.toFixed(1)}h</p>
                                    <p className="text-xs text-slate-400">{w.weekStart} a {w.weekEnd}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-center">
                          <span className={`font-bold ${Math.abs(monthTotal - monthTarget) > 48 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {Math.round(monthTotal * 10) / 10}h
                          </span>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Weekly Planner DnD */}
      {staffList.length > 0 && entries.length > 0 && (
        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Move className="w-5 h-5 text-teal-600" />
              Planner Semanal (drag-and-drop)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Select value={selectedWeek} onValueChange={setSelectedWeek}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Semana..." />
                </SelectTrigger>
                <SelectContent>
                  {weekOptions.map(w => (
                    <SelectItem key={w} value={String(w)}>Semana {w}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-slate-500">Arrastra una plantilla y suéltala sobre una celda de empleado.</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {plannerTemplates.map(t => (
                <div
                  key={t.id}
                  draggable
                  onDragStart={e => e.dataTransfer.setData('application/json', JSON.stringify(t))}
                  className="px-2.5 py-1.5 text-xs rounded-md border bg-white cursor-grab active:cursor-grabbing hover:border-teal-300"
                >
                  {t.label}
                </div>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left p-2 border">Empleado</th>
                    {plannerDates.map(date => {
                      const dow = dayNames[new Date(date + 'T12:00:00').getDay()]
                      return <th key={date} className="text-center p-2 border min-w-[110px]">{dow} {date.slice(-2)}</th>
                    })}
                  </tr>
                </thead>
                <tbody>
                  {staffList.map(s => (
                    <tr key={s.id}>
                      <td className="p-2 border font-medium bg-white sticky left-0">{s.nombre} {s.apellido}</td>
                      {plannerDates.map(date => {
                        const entry = plannerMap.get(s.id)?.get(date)
                        return (
                          <td
                            key={`${s.id}-${date}`}
                            className="p-1 border text-center align-middle"
                            onDragOver={e => e.preventDefault()}
                            onDrop={e => entry && handleDropTemplate(entry, e)}
                          >
                            {entry ? (
                              <div className={`rounded px-1 py-1 ${typeColors[entry.type] || 'bg-slate-50'}`}>
                                {entry.type === 'NORMAL' && entry.entryTime && entry.exitTime ? `${entry.entryTime}-${entry.exitTime}` : (typeLabels[entry.type] || entry.type)}
                              </div>
                            ) : (
                              <span className="text-slate-300">-</span>
                            )}
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
      )}

      {/* Schedule Calendar Grid */}
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-teal-600" />
            Horario {monthNames[month - 1]} {year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-12 text-slate-500">
              <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin text-slate-300" />
              Cargando horario...
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No hay horario generado</p>
              <p className="text-sm">Haga clic en &quot;Generar Horario&quot; para crear el horario de {monthNames[month - 1]} {year}</p>
              <div className="mt-4 text-xs text-slate-400 space-y-1">
                <p>&quot;Generar Horario&quot; = crea entradas en blanco para editar manualmente</p>
                <p>&quot;Generar con Horas&quot; = asigna horarios automáticamente (8am-5:36pm L-V)</p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-white z-10 min-w-[80px]">Fecha</TableHead>
                    {staffList.map(s => (
                      <TableHead key={s.id} className="text-center min-w-[120px]">
                        {s.nombre} {s.apellido}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const rows: React.ReactNode[] = []
                    let lastWeekNum = -1

                    for (let day = 1; day <= daysInMonth; day++) {
                      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      const date = new Date(dateStr + 'T12:00:00')
                      const dow = date.getDay()
                      const isWeekend = dow === 0 || dow === 6

                      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
                      const dayNum = d.getUTCDay() || 7
                      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
                      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
                      const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)

                      if (weekNum !== lastWeekNum && lastWeekNum !== -1) {
                        rows.push(
                          <TableRow key={`week-${lastWeekNum}`} className="bg-teal-50/70 font-bold">
                            <TableCell className="sticky left-0 bg-teal-50/70 z-10 font-bold text-teal-700">Total Sem</TableCell>
                            {staffList.map(s => {
                              const summary = weeklySummaries[s.id]?.find(w => w.weekNum === lastWeekNum)
                              const hours = summary?.hours || 0
                              const target = summary?.target || 0
                              return (
                                <TableCell key={s.id} className="text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <span className={hours > target + 2 ? 'text-red-600' : hours < target - 2 ? 'text-amber-600' : 'text-teal-700'}>
                                      {hours}h
                                    </span>
                                    {hours > target + 2 && <AlertTriangle className="w-3 h-3 text-red-500" />}
                                    {Math.abs(hours - target) <= 2 && hours > 0 && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                  </div>
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        )
                        rows.push(
                          <TableRow key={`sep-${weekNum}`}>
                            <TableCell colSpan={staffList.length + 1} className="h-1.5 bg-slate-100 p-0" />
                          </TableRow>
                        )
                      }
                      lastWeekNum = weekNum

                      const dayEntryMap = entryMap.get(dateStr)

                      rows.push(
                        <TableRow key={dateStr} className={`${isWeekend ? (dow === 0 ? 'bg-red-50/30' : 'bg-blue-50/30') : ''} hover:bg-slate-50/50`}>
                          <TableCell className={`sticky left-0 z-10 font-medium ${isWeekend ? (dow === 0 ? 'bg-red-50/30' : 'bg-blue-50/30') : 'bg-white'}`}>
                            <div className="flex flex-col">
                              <span className={`text-xs ${dow === 0 ? 'text-red-500' : dow === 6 ? 'text-blue-500' : 'text-slate-500'}`}>
                                {dayNames[dow]}
                              </span>
                              <span>{day}</span>
                            </div>
                          </TableCell>
                          {staffList.map(s => {
                            const entry = dayEntryMap?.get(s.id)
                            if (!entry) {
                              return (
                                <TableCell key={s.id} className="text-center text-slate-300">-</TableCell>
                              )
                            }

                            const isSpecial = entry.type !== 'NORMAL'
                            const colorClass = isSpecial ? typeColors[entry.type] || '' : ''
                            const label = typeLabels[entry.type] || ''

                            return (
                              <TableCell key={s.id} className={`text-center cursor-pointer hover:bg-slate-100/80 transition-colors rounded ${colorClass}`} onClick={() => handleEditEntry(entry)}>
                                {entry.type === 'DESCANSO' ? (
                                  <span className="text-slate-400 text-xs">D</span>
                                ) : isSpecial ? (
                                  <span className="font-medium text-xs">{label}</span>
                                ) : entry.entryTime && entry.exitTime ? (
                                  <div className="flex flex-col">
                                    <span className="font-medium">{entry.entryTime}-{entry.exitTime}</span>
                                    <span className="text-[10px] text-teal-600">{entry.hours}h</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center">
                                    <span className="text-slate-400 text-xs italic">Sin asignar</span>
                                    <span className="text-[10px] text-slate-300">click para editar</span>
                                  </div>
                                )}
                                {entry.isManual && <span className="text-[9px] text-amber-500">✎</span>}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      )

                      if (day === daysInMonth) {
                        rows.push(
                          <TableRow key={`week-${weekNum}`} className="bg-teal-50/70 font-bold">
                            <TableCell className="sticky left-0 bg-teal-50/70 z-10 font-bold text-teal-700">Total Sem</TableCell>
                            {staffList.map(s => {
                              const summary = weeklySummaries[s.id]?.find(w => w.weekNum === weekNum)
                              const hours = summary?.hours || 0
                              const target = summary?.target || 0
                              return (
                                <TableCell key={s.id} className="text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <span className={hours > target + 2 ? 'text-red-600' : hours < target - 2 ? 'text-amber-600' : 'text-teal-700'}>
                                      {hours}h
                                    </span>
                                    {hours > target + 2 && <AlertTriangle className="w-3 h-3 text-red-500" />}
                                    {Math.abs(hours - target) <= 2 && hours > 0 && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                                  </div>
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        )
                      }
                    }
                    return rows
                  })()}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      {entries.length > 0 && (
        <Card className="border-slate-200/80 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="font-medium text-slate-600">Leyenda:</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> VAC = Vacaciones</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> INC = Incapacidad</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> LIC = Licencia</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-300" /> PER = Permiso</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-violet-100 border border-violet-300" /> FER = Feriado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-300" /> D = Descanso</span>
              <span className="flex items-center gap-1"><span className="text-amber-500 text-xs">✎</span> Editado manualmente</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300" /> Sábado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-200" /> Domingo</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Entry Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="w-4 h-4" />
              Editar Horario - {editEntry?.staff?.nombre} {editEntry?.staff?.apellido}
            </DialogTitle>
          </DialogHeader>
          {editEntry && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-50 p-3 rounded-lg">
                <p className="text-sm text-slate-600">
                  Fecha: <span className="font-medium">{editEntry.date}</span>
                  {editEntry.isWeekend && <Badge className="ml-2 bg-amber-100 text-amber-800" variant="outline">Fin de semana</Badge>}
                </p>
                <p className="text-sm text-slate-600">
                  Fin de semana: <span className="font-medium">{editEntry.staff?.finDeSemanaPreferente}</span>
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tipo de Jornada</Label>
                <Select value={editForm.type} onValueChange={v => setEditForm(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NORMAL">Normal</SelectItem>
                    <SelectItem value="DESCANSO">Descanso</SelectItem>
                    <SelectItem value="VACACION">Vacaciones</SelectItem>
                    <SelectItem value="INCAPACIDAD">Incapacidad</SelectItem>
                    <SelectItem value="LICENCIA">Licencia</SelectItem>
                    <SelectItem value="PERMISO">Permiso</SelectItem>
                    <SelectItem value="FERIADO">Feriado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {editForm.type === 'NORMAL' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hora Entrada</Label>
                    <Input type="time" value={editForm.entryTime} onChange={e => setEditForm(p => ({ ...p, entryTime: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora Salida</Label>
                    <Input type="time" value={editForm.exitTime} onChange={e => setEditForm(p => ({ ...p, exitTime: e.target.value }))} />
                  </div>
                </div>
              )}

              {/* Quick fill buttons for NORMAL type */}
              {editForm.type === 'NORMAL' && (
                <div className="space-y-2">
                  <Label className="text-xs text-slate-500">Llenado rápido:</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditForm(p => ({ ...p, entryTime: '08:00', exitTime: '17:36' }))}>
                      8:00-5:36pm (9h36m)
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditForm(p => ({ ...p, entryTime: '08:00', exitTime: '15:36' }))}>
                      8:00-3:36pm (7h36m)
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditForm(p => ({ ...p, entryTime: '08:00', exitTime: '18:00' }))}>
                      8:00-6:00pm (10h)
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => setEditForm(p => ({ ...p, entryTime: '09:00', exitTime: '18:00' }))}>
                      9:00-6:00pm (9h)
                    </Button>
                  </div>
                </div>
              )}

              {editForm.type === 'NORMAL' && editForm.entryTime && editForm.exitTime && (
                <div className="bg-teal-50 p-3 rounded-lg border border-teal-100">
                  <p className="text-sm">
                    Horas calculadas: <span className="font-bold text-teal-700">
                      {(() => {
                        const [eh, em] = editForm.entryTime.split(':').map(Number)
                        const [xh, xm] = editForm.exitTime.split(':').map(Number)
                        let entryMin = eh * 60 + em
                        let exitMin = xh * 60 + xm
                        if (exitMin <= entryMin) exitMin += 24 * 60
                        return ((exitMin - entryMin) / 60).toFixed(1)
                      })()}h
                    </span>
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notas</Label>
                <Input value={editForm.notes} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} placeholder="Notas opcionales..." />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
                <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSaveEdit}>Guardar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
