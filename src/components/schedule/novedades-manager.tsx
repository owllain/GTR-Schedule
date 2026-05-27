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
import { Plus, Trash2, AlertCircle, Calendar } from 'lucide-react'

interface Novedad {
  id: string
  staffId: string
  startDate: string
  endDate: string
  type: string
  description: string | null
  staff: { id: string; nombre: string; apellido: string }
}

interface StaffInfo {
  id: string
  nombre: string
  apellido: string
}

interface NovedadesManagerProps {
  onRefresh: () => void
}

const typeLabels: Record<string, string> = {
  VACACION: 'Vacaciones',
  INCAPACIDAD: 'Incapacidad',
  LICENCIA: 'Licencia',
  PERMISO: 'Permiso',
  FERIADO: 'Feriado',
}

const typeColors: Record<string, string> = {
  VACACION: 'bg-green-100 text-green-800 border-green-200',
  INCAPACIDAD: 'bg-red-100 text-red-800 border-red-200',
  LICENCIA: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  PERMISO: 'bg-orange-100 text-orange-800 border-orange-200',
  FERIADO: 'bg-blue-100 text-blue-800 border-blue-200',
}

export function NovedadesManager({ onRefresh }: NovedadesManagerProps) {
  const { toast } = useToast()
  const [novedades, setNovedades] = useState<Novedad[]>([])
  const [staffList, setStaffList] = useState<StaffInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    staffId: '',
    startDate: '',
    endDate: '',
    type: 'VACACION',
    description: '',
  })

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  const fetchNovedades = useCallback(async () => {
    try {
      const res = await fetch(`/api/novedades?year=${currentYear}&month=${currentMonth}`)
      const data = await res.json()
      setNovedades(Array.isArray(data) ? data : [])
    } catch {
      toast({ title: 'Error', description: 'No se pudieron cargar las novedades', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [currentYear, currentMonth, toast])

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/staff')
      const data = await res.json()
      setStaffList(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchNovedades() }, [fetchNovedades])
  useEffect(() => { fetchStaff() }, [fetchStaff])

  const handleSubmit = async () => {
    if (!formData.staffId || !formData.startDate || !formData.endDate || !formData.type) {
      toast({ title: 'Error', description: 'Todos los campos son requeridos', variant: 'destructive' })
      return
    }

    if (formData.endDate < formData.startDate) {
      toast({ title: 'Error', description: 'La fecha fin no puede ser menor que la fecha inicio', variant: 'destructive' })
      return
    }

    try {
      const res = await fetch('/api/novedades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (res.ok) {
        toast({ title: 'Creado', description: 'Novedad registrada exitosamente' })
        setDialogOpen(false)
        resetForm()
        fetchNovedades()
        onRefresh()
      } else {
        const data = await res.json()
        toast({ title: 'Error', description: data.error, variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'No se pudo crear la novedad', variant: 'destructive' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Está seguro de eliminar esta novedad?')) return
    try {
      await fetch(`/api/novedades?id=${id}`, { method: 'DELETE' })
      toast({ title: 'Eliminado', description: 'Novedad eliminada' })
      fetchNovedades()
      onRefresh()
    } catch {
      toast({ title: 'Error', description: 'No se pudo eliminar', variant: 'destructive' })
    }
  }

  const resetForm = () => {
    setFormData({
      staffId: '',
      startDate: '',
      endDate: '',
      type: 'VACACION',
      description: '',
    })
  }

  const calculateDays = (start: string, end: string) => {
    const s = new Date(start + 'T12:00:00')
    const e = new Date(end + 'T12:00:00')
    return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Novedades
            </CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Registre vacaciones, incapacidades, licencias y permisos
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) resetForm() }}>
            <DialogTrigger asChild>
              <Button className="bg-amber-600 hover:bg-amber-700 gap-2" disabled={staffList.length === 0}>
                <Plus className="w-4 h-4" />
                Agregar Novedad
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Novedad</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Empleado *</Label>
                  <Select value={formData.staffId} onValueChange={v => setFormData(p => ({ ...p, staffId: v }))}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar empleado..." /></SelectTrigger>
                    <SelectContent>
                      {staffList.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.nombre} {s.apellido}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Novedad *</Label>
                  <Select value={formData.type} onValueChange={v => setFormData(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VACACION">Vacaciones</SelectItem>
                      <SelectItem value="INCAPACIDAD">Incapacidad</SelectItem>
                      <SelectItem value="LICENCIA">Licencia</SelectItem>
                      <SelectItem value="PERMISO">Permiso</SelectItem>
                      <SelectItem value="FERIADO">Feriado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fecha Inicio *</Label>
                    <Input type="date" value={formData.startDate} onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Fecha Fin *</Label>
                    <Input type="date" value={formData.endDate} onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))} />
                  </div>
                </div>

                {formData.startDate && formData.endDate && formData.endDate >= formData.startDate && (
                  <div className="bg-amber-50 p-3 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Duración: <span className="font-bold">{calculateDays(formData.startDate, formData.endDate)} día(s)</span>
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Input value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} placeholder="Descripción opcional..." />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm() }}>Cancelar</Button>
                  <Button className="bg-amber-600 hover:bg-amber-700" onClick={handleSubmit}>Guardar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-500">Cargando novedades...</div>
          ) : novedades.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No hay novedades registradas</p>
              <p className="text-sm">Agregue vacaciones, incapacidades u otras novedades</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empleado</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Fecha Inicio</TableHead>
                    <TableHead>Fecha Fin</TableHead>
                    <TableHead>Días</TableHead>
                    <TableHead className="hidden md:table-cell">Descripción</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {novedades.map(n => (
                    <TableRow key={n.id}>
                      <TableCell className="font-medium">{n.staff?.nombre} {n.staff?.apellido}</TableCell>
                      <TableCell>
                        <Badge className={typeColors[n.type] || ''} variant="outline">
                          {typeLabels[n.type] || n.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{n.startDate}</TableCell>
                      <TableCell>{n.endDate}</TableCell>
                      <TableCell className="text-center">{calculateDays(n.startDate, n.endDate)}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-slate-600">{n.description || '-'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="text-red-500 hover:text-red-700" onClick={() => handleDelete(n.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
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
