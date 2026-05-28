'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, LayoutTemplate, Clock, Users } from 'lucide-react'

interface ProformaEntry {
  id?: string
  diaSemana: number
  horaEntrada: string
  horaSalida: string
  esDescanso: boolean
}

interface Proforma {
  id: string
  nombre: string
  descripcion: string | null
  entradas: ProformaEntry[]
  _count?: { staff: number }
}

interface ProformasManagerProps {
  onRefresh: () => void
}

const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const dayShortNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']

// Default proformas for quick setup
const defaultProformas = [
  {
    nombre: 'Estándar 48h (sin fin de semana)',
    descripcion: 'L-V 8:00-17:36, S-D descanso. Total: 48h',
    entradas: [
      { diaSemana: 0, horaEntrada: '', horaSalida: '', esDescanso: true },
      { diaSemana: 1, horaEntrada: '08:00', horaSalida: '17:36', esDescanso: false },
      { diaSemana: 2, horaEntrada: '08:00', horaSalida: '17:36', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '17:36', esDescanso: false },
      { diaSemana: 4, horaEntrada: '08:00', horaSalida: '17:36', esDescanso: false },
      { diaSemana: 5, horaEntrada: '08:00', horaSalida: '17:36', esDescanso: false },
      { diaSemana: 6, horaEntrada: '', horaSalida: '', esDescanso: true },
    ],
  },
  {
    nombre: 'L-M 8-4, J-V 9-4 (sin fin de semana)',
    descripcion: 'L-Ma-Mi 8:00-16:00, Jue-Vie 9:00-16:00, S-D descanso. Total: 48h',
    entradas: [
      { diaSemana: 0, horaEntrada: '', horaSalida: '', esDescanso: true },
      { diaSemana: 1, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 2, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 4, horaEntrada: '09:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 5, horaEntrada: '09:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 6, horaEntrada: '', horaSalida: '', esDescanso: true },
    ],
  },
  // ── Proformas con Domingo ────────────────────────────────────
  {
    nombre: 'Domingo regular',
    descripcion: 'L-Mi 8-4pm, J-V 9-4pm, Sáb descanso, Dom 8-6pm. ~48h',
    entradas: [
      { diaSemana: 0, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 1, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 2, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 4, horaEntrada: '09:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 5, horaEntrada: '09:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 6, horaEntrada: '', horaSalida: '', esDescanso: true },
    ],
  },
  {
    nombre: 'Domingo regular L-Mar 9-4',
    descripcion: 'L-Mar 9-4pm, Mi-V 8-4pm, Sáb descanso, Dom 8-6pm. ~48h',
    entradas: [
      { diaSemana: 0, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 1, horaEntrada: '09:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 2, horaEntrada: '09:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 4, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 5, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 6, horaEntrada: '', horaSalida: '', esDescanso: true },
    ],
  },
  // ── Proformas con Sábado ─────────────────────────────────────
  {
    nombre: 'Sábado regular',
    descripcion: 'L-Mi 8-4pm, J-V 9-4pm, Sáb 8-6pm, Dom descanso. ~48h',
    entradas: [
      { diaSemana: 0, horaEntrada: '', horaSalida: '', esDescanso: true },
      { diaSemana: 1, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 2, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 4, horaEntrada: '09:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 5, horaEntrada: '09:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 6, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
    ],
  },
  {
    nombre: 'Sábado regular L-Mar 9-4',
    descripcion: 'L-Mar 9-4pm, Mi-V 8-4pm, Sáb 8-6pm, Dom descanso. ~48h',
    entradas: [
      { diaSemana: 0, horaEntrada: '', horaSalida: '', esDescanso: true },
      { diaSemana: 1, horaEntrada: '09:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 2, horaEntrada: '09:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 4, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 5, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 6, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
    ],
  },
  // ── Estándar 48h con jornada 8-6pm ───────────────────────────
  {
    nombre: 'Estándar 48h (8-6pm sin fin de semana)',
    descripcion: 'L-Mi 8-6pm, J-V 9-6pm, S-D descanso. Total: 48h',
    entradas: [
      { diaSemana: 0, horaEntrada: '', horaSalida: '', esDescanso: true },
      { diaSemana: 1, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 2, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 4, horaEntrada: '09:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 5, horaEntrada: '09:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 6, horaEntrada: '', horaSalida: '', esDescanso: true },
    ],
  },
  {
    nombre: 'Estándar 48h L-Mar 9-6 (sin fin de semana)',
    descripcion: 'L-Mar 9-6pm, Mi-V 8-6pm, S-D descanso. Total: 48h',
    entradas: [
      { diaSemana: 0, horaEntrada: '', horaSalida: '', esDescanso: true },
      { diaSemana: 1, horaEntrada: '09:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 2, horaEntrada: '09:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 4, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 5, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 6, horaEntrada: '', horaSalida: '', esDescanso: true },
    ],
  },
  // ── Horario nocturno con Sábado ───────────────────────────────
  {
    nombre: 'Nocturno con Sábado (6pm-12am)',
    descripcion: 'L-V 18:00-00:00, Sáb 18:00-00:00, Dom descanso. ~48h',
    entradas: [
      { diaSemana: 0, horaEntrada: '', horaSalida: '', esDescanso: true },
      { diaSemana: 1, horaEntrada: '18:00', horaSalida: '00:00', esDescanso: false },
      { diaSemana: 2, horaEntrada: '18:00', horaSalida: '00:00', esDescanso: false },
      { diaSemana: 3, horaEntrada: '18:00', horaSalida: '00:00', esDescanso: false },
      { diaSemana: 4, horaEntrada: '18:00', horaSalida: '00:00', esDescanso: false },
      { diaSemana: 5, horaEntrada: '18:00', horaSalida: '00:00', esDescanso: false },
      { diaSemana: 6, horaEntrada: '18:00', horaSalida: '00:00', esDescanso: false },
    ],
  },
]

function calculateWeeklyHours(entradas: ProformaEntry[]): number {
  return entradas.reduce((total, e) => {
    if (e.esDescanso || !e.horaEntrada || !e.horaSalida) return total
    const [eh, em] = e.horaEntrada.split(':').map(Number)
    const [xh, xm] = e.horaSalida.split(':').map(Number)
    let entryMin = eh * 60 + em
    let exitMin = xh * 60 + xm
    if (exitMin <= entryMin) exitMin += 24 * 60
    return total + (exitMin - entryMin) / 60
  }, 0)
}

export function ProformasManager({ onRefresh }: ProformasManagerProps) {
  const { toast } = useToast()
  const [proformas, setProformas] = useState<Proforma[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProforma, setEditingProforma] = useState<Proforma | null>(null)
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    entradas: [...defaultProformas[0].entradas] as ProformaEntry[],
  })

  const fetchProformas = useCallback(async () => {
    try {
      const res = await fetch('/api/proformas')
      const data = await res.json()
      setProformas(Array.isArray(data) ? data : [])
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las proformas', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchProformas() }, [fetchProformas])

  const handleEdit = (p: Proforma) => {
    setEditingProforma(p)
    setFormData({
      nombre: p.nombre,
      descripcion: p.descripcion || '',
      entradas: p.entradas.sort((a, b) => a.diaSemana - b.diaSemana),
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Está seguro de eliminar la proforma "${nombre}"?`)) return
    try {
      await fetch(`/api/proformas?id=${id}`, { method: 'DELETE' })
      toast({ title: 'Eliminada', description: `Proforma "${nombre}" eliminada` })
      fetchProformas()
      onRefresh()
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' })
    }
  }

  const handleSubmit = async () => {
    if (!formData.nombre) {
      toast({ title: 'Error', description: 'El nombre es requerido', variant: 'destructive' })
      return
    }

    try {
      if (editingProforma) {
        await fetch('/api/proformas', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingProforma.id, ...formData }),
        })
        toast({ title: 'Actualizada', description: `Proforma "${formData.nombre}" actualizada` })
      } else {
        await fetch('/api/proformas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        toast({ title: 'Creada', description: `Proforma "${formData.nombre}" creada` })
      }
      setDialogOpen(false)
      setEditingProforma(null)
      resetForm()
      fetchProformas()
      onRefresh()
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar', variant: 'destructive' })
    }
  }

  const handleLoadDefault = (defaultIdx: number) => {
    const def = defaultProformas[defaultIdx]
    setFormData({
      nombre: def.nombre,
      descripcion: def.descripcion,
      entradas: [...def.entradas],
    })
  }

  const resetForm = () => {
    setFormData({
      nombre: '',
      descripcion: '',
      entradas: [...defaultProformas[0].entradas],
    })
    setEditingProforma(null)
  }

  const updateEntry = (diaSemana: number, field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      entradas: prev.entradas.map(e =>
        e.diaSemana === diaSemana ? { ...e, [field]: value } : e
      ),
    }))
  }

  const weeklyHours = calculateWeeklyHours(formData.entradas)

  const getProformaBadgeColor = (hours: number) => {
    if (hours === 48) return 'bg-emerald-100 text-emerald-800 border-emerald-200'
    if (hours >= 42) return 'bg-amber-100 text-amber-800 border-amber-200'
    return 'bg-red-100 text-red-800 border-red-200'
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-teal-600" />
              Proformas de Horario
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Plantillas de horario predefinidas para asignar al personal
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button className="bg-teal-600 hover:bg-teal-700 gap-2 shadow-sm">
                <Plus className="w-4 h-4" />
                Crear Proforma
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingProforma ? 'Editar Proforma' : 'Crear Proforma'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label>Nombre de la Proforma *</Label>
                    <Input value={formData.nombre} onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Estándar 48h" />
                  </div>
                  <div className="space-y-2">
                    <Label>Descripción</Label>
                    <Input value={formData.descripcion} onChange={e => setFormData(p => ({ ...p, descripcion: e.target.value }))} placeholder="Descripción opcional..." />
                  </div>
                </div>

                {/* Weekly schedule grid */}
                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-700">Horario Semanal</h4>
                    <Badge className={getProformaBadgeColor(weeklyHours)} variant="outline">
                      <Clock className="w-3 h-3 mr-1" />
                      {weeklyHours.toFixed(1)}h/semana
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    {[1, 2, 3, 4, 5, 6, 0].map(dow => {
                      const entry = formData.entradas.find(e => e.diaSemana === dow)
                      if (!entry) return null
                      const isWeekend = dow === 0 || dow === 6
                      return (
                        <div key={dow} className={`flex items-center gap-3 p-2 rounded-lg ${isWeekend ? 'bg-amber-50/50' : 'bg-slate-50/50'}`}>
                          <span className={`w-20 text-sm font-medium ${isWeekend ? 'text-amber-700' : 'text-slate-700'}`}>
                            {dayShortNames[dow]}
                          </span>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={!entry.esDescanso}
                              onCheckedChange={checked => {
                                updateEntry(dow, 'esDescanso', !checked)
                                if (checked && !entry.horaEntrada) {
                                  updateEntry(dow, 'horaEntrada', '08:00')
                                  updateEntry(dow, 'horaSalida', isWeekend ? '18:00' : '17:36')
                                }
                              }}
                            />
                            <span className="text-xs text-slate-500">{entry.esDescanso ? 'Descanso' : 'Laboral'}</span>
                          </div>
                          {!entry.esDescanso && (
                            <div className="flex items-center gap-2 ml-auto">
                              <Input type="time" value={entry.horaEntrada} onChange={e => updateEntry(dow, 'horaEntrada', e.target.value)} className="w-28 text-sm" />
                              <span className="text-slate-400">a</span>
                              <Input type="time" value={entry.horaSalida} onChange={e => updateEntry(dow, 'horaSalida', e.target.value)} className="w-28 text-sm" />
                              {entry.horaEntrada && entry.horaSalida && (
                                <span className="text-xs text-teal-600 font-medium min-w-[40px]">
                                  {(() => {
                                    const [eh, em] = entry.horaEntrada.split(':').map(Number)
                                    const [xh, xm] = entry.horaSalida.split(':').map(Number)
                                    let entryMin = eh * 60 + em
                                    let exitMin = xh * 60 + xm
                                    if (exitMin <= entryMin) exitMin += 24 * 60
                                    return ((exitMin - entryMin) / 60).toFixed(1) + 'h'
                                  })()}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <DialogClose asChild>
                    <Button variant="outline">Cancelar</Button>
                  </DialogClose>
                  <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSubmit}>
                    {editingProforma ? 'Actualizar' : 'Guardar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-500">Cargando proformas...</div>
          ) : proformas.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <LayoutTemplate className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No hay proformas registradas</p>
              <p className="text-sm">Cree proformas para asignar horarios rápidamente al personal</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {proformas.map(p => {
                const hours = calculateWeeklyHours(p.entradas)
                return (
                  <Card key={p.id} className="border-slate-200/60 hover:border-teal-200 transition-colors">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{p.nombre}</CardTitle>
                          {p.descripcion && (
                            <CardDescription className="text-xs mt-1">{p.descripcion}</CardDescription>
                          )}
                        </div>
                        <Badge className={getProformaBadgeColor(hours)} variant="outline">
                          {hours.toFixed(1)}h
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                      <div className="flex flex-wrap gap-1 mb-3">
                        {p.entradas.sort((a, b) => a.diaSemana - b.diaSemana).map(e => (
                          <span key={e.diaSemana} className={`text-[10px] px-1.5 py-0.5 rounded ${e.esDescanso ? 'bg-slate-100 text-slate-400' : 'bg-teal-50 text-teal-700'}`}>
                            {dayShortNames[e.diaSemana]} {e.esDescanso ? 'D' : `${e.horaEntrada}-${e.horaSalida}`}
                          </span>
                        ))}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1 text-xs text-slate-500">
                          <Users className="w-3 h-3" />
                          {p._count?.staff || 0} asignado{p._count?.staff !== 1 ? 's' : ''}
                        </div>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(p)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => handleDelete(p.id, p.nombre)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
