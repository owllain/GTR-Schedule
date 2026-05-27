'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { CalendarDays, Download, RefreshCw, Clock, Edit2, ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2 } from 'lucide-react'

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
  staff: { id: string; nombre: string; apellido: string; jornadaPreferente: string }
}

interface StaffInfo {
  id: string
  nombre: string
  apellido: string
  jornadaPreferente: string
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
  VACACION: 'bg-green-100 text-green-800',
  INCAPACIDAD: 'bg-red-100 text-red-800',
  LICENCIA: 'bg-yellow-100 text-yellow-800',
  PERMISO: 'bg-orange-100 text-orange-800',
  FERIADO: 'bg-blue-100 text-blue-800',
  DESCANSO: 'bg-slate-100 text-slate-500',
}

const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export function ScheduleDashboard({ onRefresh }: ScheduleDashboardProps) {
  const { toast } = useToast()
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [entries, setEntries] = useState<ScheduleEntry[]>([])
  const [staffList, setStaffList] = useState<StaffInfo[]>([])
  const [weeklySummaries, setWeeklySummaries] = useState<Record<string, WeeklySummary[]>>({})
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [editEntry, setEditEntry] = useState<ScheduleEntry | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editForm, setEditForm] = useState({ entryTime: '', exitTime: '', type: 'NORMAL', notes: '' })

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

  useEffect(() => { fetchSchedule() }, [fetchSchedule])
  useEffect(() => { fetchStaff() }, [fetchStaff])

  const handleGenerate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/schedule/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: 'Horario generado', description: data.message })
        fetchSchedule()
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
        const contentType = res.headers.get('content-type') || ''
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        
        // Get filename from content-disposition header
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
      const res = await fetch('/api/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editEntry.id,
          entryTime: editForm.type === 'DESCANSO' || editForm.type === 'VACACION' || editForm.type === 'INCAPACIDAD' || editForm.type === 'LICENCIA' || editForm.type === 'FERIADO' || editForm.type === 'PERMISO' ? '' : editForm.entryTime,
          exitTime: editForm.type === 'DESCANSO' || editForm.type === 'VACACION' || editForm.type === 'INCAPACIDAD' || editForm.type === 'LICENCIA' || editForm.type === 'FERIADO' || editForm.type === 'PERMISO' ? '' : editForm.exitTime,
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

  // Build calendar data
  const daysInMonth = new Date(year, month, 0).getDate()
  const entryMap = new Map<string, Map<string, ScheduleEntry>>()
  for (const entry of entries) {
    if (!entryMap.has(entry.date)) entryMap.set(entry.date, new Map())
    entryMap.get(entry.date)!.set(entry.staffId, entry)
  }

  // Get weekly summary for a staff member
  const getStaffWeeklySummary = (staffId: string): WeeklySummary[] => {
    return weeklySummaries[staffId] || []
  }

  // Calculate month total for staff
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

  const targetHours = (jornada: string) => {
    switch (jornada) { case 'DIURNA': return 48; case 'MIXTA': return 42; case 'NOCTURNA': return 36; default: return 48 }
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={prevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <div className="min-w-[200px] text-center">
                <Select value={String(month)} onValueChange={v => setMonth(parseInt(v))}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthNames.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Select value={String(year)} onValueChange={v => setYear(parseInt(v))}>
                <SelectTrigger className="w-[100px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={nextMonth}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button onClick={handleGenerate} disabled={generating || staffList.length === 0} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CalendarDays className="w-4 h-4" />}
                {generating ? 'Generando...' : 'Generar Horario'}
              </Button>
              <Button onClick={handleExport} disabled={entries.length === 0} variant="outline" className="gap-2">
                <Download className="w-4 h-4" />
                Exportar Excel
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Weekly Summary Cards */}
      {staffList.length > 0 && entries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-emerald-600" />
              Resumen Semanal de Horas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Jornada</TableHead>
                    <TableHead>Meta Semanal</TableHead>
                    {getStaffWeeklySummary(staffList[0]?.id || '').map(w => (
                      <TableHead key={w.weekNum} className="text-center">
                        Sem {w.weekNum}
                      </TableHead>
                    ))}
                    <TableHead className="text-center font-bold">Total Mes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffList.map(s => {
                    const summaries = getStaffWeeklySummary(s.id)
                    const monthTotal = getMonthTotal(s.id)
                    const target = targetHours(s.jornadaPreferente)
                    const numWeeks = summaries.length || 1
                    const monthTarget = target * numWeeks

                    return (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">{s.nombre} {s.apellido}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {s.jornadaPreferente}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{target}h</TableCell>
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
                          <span className={`font-bold ${Math.abs(monthTotal - monthTarget) > target ? 'text-red-600' : 'text-emerald-600'}`}>
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

      {/* Schedule Calendar Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-emerald-600" />
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

                      // Calculate week number
                      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
                      const dayNum = d.getUTCDay() || 7
                      d.setUTCDate(d.getUTCDate() + 4 - dayNum)
                      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
                      const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)

                      // Add weekly separator
                      if (weekNum !== lastWeekNum && lastWeekNum !== -1) {
                        // Add weekly total row
                        rows.push(
                          <TableRow key={`week-${lastWeekNum}`} className="bg-emerald-50 font-bold">
                            <TableCell className="sticky left-0 bg-emerald-50 z-10 font-bold text-emerald-700">
                              Total Sem
                            </TableCell>
                            {staffList.map(s => {
                              const summary = weeklySummaries[s.id]?.find(w => w.weekNum === lastWeekNum)
                              const hours = summary?.hours || 0
                              const target = summary?.target || 0
                              return (
                                <TableCell key={s.id} className="text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <span className={hours > target + 2 ? 'text-red-600' : hours < target - 2 ? 'text-amber-600' : 'text-emerald-700'}>
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
                        // Empty separator row
                        rows.push(
                          <TableRow key={`sep-${weekNum}`}>
                            <TableCell colSpan={staffList.length + 1} className="h-2 bg-slate-50 p-0" />
                          </TableRow>
                        )
                      }
                      lastWeekNum = weekNum

                      const dayEntryMap = entryMap.get(dateStr)

                      rows.push(
                        <TableRow key={dateStr} className={isWeekend ? 'bg-slate-50/50' : ''}>
                          <TableCell className={`sticky left-0 z-10 font-medium ${isWeekend ? 'bg-slate-50/50' : 'bg-white'}`}>
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
                              <TableCell key={s.id} className={`text-center cursor-pointer hover:bg-slate-100 transition-colors ${colorClass}`} onClick={() => handleEditEntry(entry)}>
                                {entry.type === 'DESCANSO' ? (
                                  <span className="text-slate-400">D</span>
                                ) : isSpecial ? (
                                  <span className="font-medium text-xs">{label}</span>
                                ) : (
                                  <div className="flex flex-col">
                                    <span className="font-medium">{entry.entryTime} - {entry.exitTime}</span>
                                    <span className="text-[10px] text-slate-500">{entry.hours}h</span>
                                  </div>
                                )}
                                {entry.isManual && <span className="text-[9px] text-amber-500">✎</span>}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      )

                      // Last day - add final week total
                      if (day === daysInMonth) {
                        rows.push(
                          <TableRow key={`week-${weekNum}`} className="bg-emerald-50 font-bold">
                            <TableCell className="sticky left-0 bg-emerald-50 z-10 font-bold text-emerald-700">
                              Total Sem
                            </TableCell>
                            {staffList.map(s => {
                              const summary = weeklySummaries[s.id]?.find(w => w.weekNum === weekNum)
                              const hours = summary?.hours || 0
                              const target = summary?.target || 0
                              return (
                                <TableCell key={s.id} className="text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <span className={hours > target + 2 ? 'text-red-600' : hours < target - 2 ? 'text-amber-600' : 'text-emerald-700'}>
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
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 text-sm">
              <span className="font-medium text-slate-600">Leyenda:</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300" /> VAC = Vacaciones</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300" /> INC = Incapacidad</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300" /> LIC = Licencia</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-100 border border-orange-300" /> PER = Permiso</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-300" /> FER = Feriado</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-300" /> D = Descanso</span>
              <span className="flex items-center gap-1"><span className="text-amber-500 text-xs">✎</span> Editado manualmente</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Entry Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
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
                  {editEntry.isWeekend && <Badge className="ml-2" variant="outline">Fin de semana</Badge>}
                </p>
                <p className="text-sm text-slate-600">
                  Jornada: <span className="font-medium">{editEntry.staff?.jornadaPreferente}</span>
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

              {editForm.type === 'NORMAL' && editForm.entryTime && editForm.exitTime && (
                <div className="bg-emerald-50 p-3 rounded-lg">
                  <p className="text-sm">
                    Horas calculadas: <span className="font-bold text-emerald-700">
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
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveEdit}>Guardar</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
