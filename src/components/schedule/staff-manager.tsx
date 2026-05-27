'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, User, Clock, CalendarDays } from 'lucide-react'

interface StaffMember {
  id: string
  nombre: string
  apellido: string
  jornadaPreferente: string
  finDeSemanaPreferente: string
  horaEntrada: string
  horaSalida: string
  horaEntradaSabado: string
  horaSalidaSabado: string
  horaEntradaDomingo: string
  horaSalidaDomingo: string
  activo: boolean
}

interface StaffManagerProps {
  onRefresh: () => void
}

const jornadaLabels: Record<string, string> = {
  DIURNA: 'Diurna',
  MIXTA: 'Mixta',
  NOCTURNA: 'Nocturna',
}

const finDeSemanaLabels: Record<string, string> = {
  MIXTO: 'Mixto (alterna Sáb/Dom)',
  SABADO: 'Solo Sábados',
  DOMINGO: 'Solo Domingos',
}

const jornadaColors: Record<string, string> = {
  DIURNA: 'bg-amber-100 text-amber-800 border-amber-200',
  MIXTA: 'bg-purple-100 text-purple-800 border-purple-200',
  NOCTURNA: 'bg-indigo-100 text-indigo-800 border-indigo-200',
}

const finDeSemanaColors: Record<string, string> = {
  MIXTO: 'bg-teal-100 text-teal-800 border-teal-200',
  SABADO: 'bg-sky-100 text-sky-800 border-sky-200',
  DOMINGO: 'bg-rose-100 text-rose-800 border-rose-200',
}

export function StaffManager({ onRefresh }: StaffManagerProps) {
  const { toast } = useToast()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    jornadaPreferente: 'DIURNA',
    finDeSemanaPreferente: 'MIXTO',
    horaEntrada: '08:00',
    horaSalida: '17:00',
    horaEntradaSabado: '08:00',
    horaSalidaSabado: '13:00',
    horaEntradaDomingo: '08:00',
    horaSalidaDomingo: '18:00',
  })

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/staff')
      const data = await res.json()
      setStaff(Array.isArray(data) ? data : [])
    } catch {
      toast({ title: 'Error', description: 'No se pudo cargar el personal', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchStaff() }, [fetchStaff])

  const getDefaultTimes = (jornada: string) => {
    switch (jornada) {
      case 'DIURNA':
        return { horaEntrada: '08:00', horaSalida: '17:00', horaEntradaSabado: '08:00', horaSalidaSabado: '13:00', horaEntradaDomingo: '08:00', horaSalidaDomingo: '18:00' }
      case 'MIXTA':
        return { horaEntrada: '08:00', horaSalida: '17:36', horaEntradaSabado: '08:00', horaSalidaSabado: '13:00', horaEntradaDomingo: '08:00', horaSalidaDomingo: '18:00' }
      case 'NOCTURNA':
        return { horaEntrada: '18:00', horaSalida: '00:00', horaEntradaSabado: '18:00', horaSalidaSabado: '00:00', horaEntradaDomingo: '18:00', horaSalidaDomingo: '00:00' }
      default:
        return { horaEntrada: '08:00', horaSalida: '17:00', horaEntradaSabado: '08:00', horaSalidaSabado: '13:00', horaEntradaDomingo: '08:00', horaSalidaDomingo: '18:00' }
    }
  }

  const handleJornadaChange = (jornada: string) => {
    const defaults = getDefaultTimes(jornada)
    setFormData(prev => ({ ...prev, jornadaPreferente: jornada, ...defaults }))
  }

  const handleSubmit = async () => {
    if (!formData.nombre || !formData.apellido) {
      toast({ title: 'Error', description: 'Nombre y apellido son requeridos', variant: 'destructive' })
      return
    }

    try {
      if (editingStaff) {
        await fetch('/api/staff', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingStaff.id, ...formData }),
        })
        toast({ title: 'Actualizado', description: `${formData.nombre} ${formData.apellido} actualizado exitosamente` })
      } else {
        await fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        })
        toast({ title: 'Creado', description: `${formData.nombre} ${formData.apellido} agregado exitosamente` })
      }
      setDialogOpen(false)
      setEditingStaff(null)
      resetForm()
      fetchStaff()
      onRefresh()
    } catch {
      toast({ title: 'Error', description: 'No se pudo guardar', variant: 'destructive' })
    }
  }

  const handleEdit = (s: StaffMember) => {
    setEditingStaff(s)
    setFormData({
      nombre: s.nombre,
      apellido: s.apellido,
      jornadaPreferente: s.jornadaPreferente,
      finDeSemanaPreferente: s.finDeSemanaPreferente,
      horaEntrada: s.horaEntrada,
      horaSalida: s.horaSalida,
      horaEntradaSabado: s.horaEntradaSabado,
      horaSalidaSabado: s.horaSalidaSabado,
      horaEntradaDomingo: s.horaEntradaDomingo,
      horaSalidaDomingo: s.horaSalidaDomingo,
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Está seguro de eliminar a ${nombre}?`)) return
    try {
      await fetch(`/api/staff?id=${id}`, { method: 'DELETE' })
      toast({ title: 'Eliminado', description: `${nombre} eliminado` })
      fetchStaff()
      onRefresh()
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' })
    }
  }

  const resetForm = () => {
    setFormData({
      nombre: '',
      apellido: '',
      jornadaPreferente: 'DIURNA',
      finDeSemanaPreferente: 'MIXTO',
      horaEntrada: '08:00',
      horaSalida: '17:00',
      horaEntradaSabado: '08:00',
      horaSalidaSabado: '13:00',
      horaEntradaDomingo: '08:00',
      horaSalidaDomingo: '18:00',
    })
    setEditingStaff(null)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <User className="w-5 h-5 text-emerald-600" />
              Gestión de Personal
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Administre el personal y sus preferencias de jornada
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open)
            if (!open) resetForm()
          }}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                <Plus className="w-4 h-4" />
                Agregar Personal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingStaff ? 'Editar Personal' : 'Agregar Personal'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Name fields */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input id="nombre" value={formData.nombre} onChange={e => setFormData(p => ({ ...p, nombre: e.target.value }))} placeholder="Ej: Juan" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="apellido">Apellido *</Label>
                    <Input id="apellido" value={formData.apellido} onChange={e => setFormData(p => ({ ...p, apellido: e.target.value }))} placeholder="Ej: Pérez" />
                  </div>
                </div>

                {/* Jornada y Fin de semana */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Jornada Preferente
                    </Label>
                    <Select value={formData.jornadaPreferente} onValueChange={handleJornadaChange}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DIURNA">Diurna (48h/semana)</SelectItem>
                        <SelectItem value="MIXTA">Mixta (42h/semana)</SelectItem>
                        <SelectItem value="NOCTURNA">Nocturna (36h/semana)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4" />
                      Fin de Semana Preferente
                    </Label>
                    <Select value={formData.finDeSemanaPreferente} onValueChange={v => setFormData(p => ({ ...p, finDeSemanaPreferente: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MIXTO">Mixto (alterna Sáb/Dom)</SelectItem>
                        <SelectItem value="SABADO">Solo Sábados</SelectItem>
                        <SelectItem value="DOMINGO">Solo Domingos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Weekday hours */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 text-slate-700">Horario Entre Semana (Lun-Vie)</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hora Entrada</Label>
                      <Input type="time" value={formData.horaEntrada} onChange={e => setFormData(p => ({ ...p, horaEntrada: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora Salida</Label>
                      <Input type="time" value={formData.horaSalida} onChange={e => setFormData(p => ({ ...p, horaSalida: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Saturday hours */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 text-slate-700">Horario Sábado</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hora Entrada</Label>
                      <Input type="time" value={formData.horaEntradaSabado} onChange={e => setFormData(p => ({ ...p, horaEntradaSabado: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora Salida</Label>
                      <Input type="time" value={formData.horaSalidaSabado} onChange={e => setFormData(p => ({ ...p, horaSalidaSabado: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Sunday hours */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 text-slate-700">Horario Domingo</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Hora Entrada</Label>
                      <Input type="time" value={formData.horaEntradaDomingo} onChange={e => setFormData(p => ({ ...p, horaEntradaDomingo: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>Hora Salida</Label>
                      <Input type="time" value={formData.horaSalidaDomingo} onChange={e => setFormData(p => ({ ...p, horaSalidaDomingo: e.target.value }))} />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>Cancelar</Button>
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleSubmit}>
                    {editingStaff ? 'Actualizar' : 'Guardar'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-500">Cargando personal...</div>
          ) : staff.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <User className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No hay personal registrado</p>
              <p className="text-sm">Agregue personal para comenzar a generar horarios</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Jornada</TableHead>
                    <TableHead>Fin de Semana</TableHead>
                    <TableHead className="hidden md:table-cell">Horario Lun-Vie</TableHead>
                    <TableHead className="hidden lg:table-cell">Horario Sáb</TableHead>
                    <TableHead className="hidden lg:table-cell">Horario Dom</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map(s => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.nombre} {s.apellido}</TableCell>
                      <TableCell>
                        <Badge className={jornadaColors[s.jornadaPreferente]} variant="outline">
                          {jornadaLabels[s.jornadaPreferente]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={finDeSemanaColors[s.finDeSemanaPreferente]} variant="outline">
                          {finDeSemanaLabels[s.finDeSemanaPreferente]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-slate-600">
                        {s.horaEntrada} - {s.horaSalida}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-slate-600">
                        {s.horaEntradaSabado} - {s.horaSalidaSabado}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-slate-600">
                        {s.horaEntradaDomingo} - {s.horaSalidaDomingo}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(s)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(s.id, `${s.nombre} ${s.apellido}`)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
