'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Plus, Pencil, Trash2, User, Upload, FileText, LayoutTemplate, Download } from 'lucide-react'

interface Proforma {
  id: string
  nombre: string
  descripcion: string | null
}

interface StaffMember {
  id: string
  nombre: string
  apellido: string
  finDeSemanaPreferente: string
  proformaId: string | null
  proforma: Proforma | null
  activo: boolean
}

interface StaffManagerProps {
  onRefresh: () => void
}

const finDeSemanaLabels: Record<string, string> = {
  MIXTO: 'Mixto (alterna)',
  SABADO: 'Solo Sábados',
  DOMINGO: 'Solo Domingos',
}

const finDeSemanaColors: Record<string, string> = {
  MIXTO: 'bg-teal-100 text-teal-800 border-teal-200',
  SABADO: 'bg-blue-100 text-blue-800 border-blue-200',
  DOMINGO: 'bg-rose-100 text-rose-800 border-rose-200',
}

export function StaffManager({ onRefresh }: StaffManagerProps) {
  const { toast } = useToast()
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [proformas, setProformas] = useState<Proforma[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    finDeSemanaPreferente: 'MIXTO',
    proformaId: '',
  })

  const fetchStaff = useCallback(async () => {
    try {
      const res = await fetch('/api/staff')
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error((data && typeof data === 'object' && 'error' in data ? String((data as { error?: string }).error) : '') || 'No se pudo cargar el personal')
      }

      setStaff(Array.isArray(data) ? data : [])
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar el personal'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchProformas = useCallback(async () => {
    try {
      const res = await fetch('/api/proformas')
      const data = await res.json()
      setProformas(Array.isArray(data) ? data : [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchStaff() }, [fetchStaff])
  useEffect(() => { fetchProformas() }, [fetchProformas])

  const handleSubmit = async () => {
    if (!formData.nombre || !formData.apellido) {
      toast({ title: 'Error', description: 'Nombre y apellido son requeridos', variant: 'destructive' })
      return
    }

    try {
      const payload = {
        ...formData,
        proformaId: formData.proformaId || null,
      }

      let res: Response
      let successMessage = ''

      if (editingStaff) {
        res = await fetch('/api/staff', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingStaff.id, ...payload }),
        })
        successMessage = `${formData.nombre} ${formData.apellido} actualizado`
      } else {
        res = await fetch('/api/staff', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        successMessage = `${formData.nombre} ${formData.apellido} agregado`
      }

      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error((data && typeof data === 'object' && 'error' in data ? String((data as { error?: string }).error) : '') || 'No se pudo guardar')
      }

      toast({ title: editingStaff ? 'Actualizado' : 'Creado', description: successMessage })
      setDialogOpen(false)
      setEditingStaff(null)
      resetForm()
      await fetchStaff()
      onRefresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const handleEdit = (s: StaffMember) => {
    setEditingStaff(s)
    setFormData({
      nombre: s.nombre,
      apellido: s.apellido,
      finDeSemanaPreferente: s.finDeSemanaPreferente,
      proformaId: s.proformaId || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string, nombre: string) => {
    if (!confirm(`¿Está seguro de eliminar a ${nombre}?`)) return
    try {
      const res = await fetch(`/api/staff?id=${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        throw new Error((data && typeof data === 'object' && 'error' in data ? String((data as { error?: string }).error) : '') || 'No se pudo eliminar')
      }

      toast({ title: 'Eliminado', description: `${nombre} eliminado` })
      await fetchStaff()
      onRefresh()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    }
  }

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      toast({ title: 'Error', description: 'Solo se permiten archivos CSV', variant: 'destructive' })
      return
    }

    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/staff/import-csv', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error((data && typeof data === 'object' && 'error' in data ? String((data as { error?: string }).error) : '') || 'No se pudo importar el archivo CSV')
      }

      if (data.created > 0) {
        toast({
          title: 'Importación exitosa',
          description: `${data.created} empleado(s) importado(s)${data.errors > 0 ? `, ${data.errors} error(es)` : ''}`,
        })
        await fetchStaff()
        onRefresh()
      } else {
        toast({
          title: 'Sin importaciones',
          description: 'No se pudieron importar empleados. Verifique el formato del CSV.',
          variant: 'destructive',
        })
      }

      if (data.details?.length > 0) {
        console.log('Import details:', data.details)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo importar el archivo CSV'
      toast({ title: 'Error', description: message, variant: 'destructive' })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const handleDownloadTemplate = () => {
    // Usar TextEncoder para garantizar UTF-8 correcto y BOM para Excel
    const rows = [
      'nombre,apellido,finDeSemanaPreferente,proforma',
      'Jose,Castro,MIXTO,Estandar 48h (sin fin de semana)',
      'Maria,Lozano,DOMINGO,Domingo regular',
    ]
    const content = rows.join('\r\n') + '\r\n'
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF])
    const encoder = new TextEncoder()
    const body = encoder.encode(content)
    const blob = new Blob([bom, body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'plantilla_personal.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const resetForm = () => {
    setFormData({
      nombre: '',
      apellido: '',
      finDeSemanaPreferente: 'MIXTO',
      proformaId: '',
    })
    setEditingStaff(null)
  }

  return (
    <div className="space-y-6">
      <Card className="border-slate-200/80 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <CardTitle className="text-xl flex items-center gap-2">
              <User className="w-5 h-5 text-teal-600" />
              Gestión de Personal
            </CardTitle>
            <CardDescription className="mt-1">
              Administre el personal. Los horarios se editan en la pestaña de Horarios.
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {/* CSV Import */}
            <input
              type="file"
              accept=".csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleCSVImport}
            />
            <Button
              variant="outline"
              className="gap-2 border-dashed"
              onClick={handleDownloadTemplate}
            >
              <Download className="w-4 h-4" />
              Plantilla CSV
            </Button>
            <Button
              variant="outline"
              className="gap-2 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <Upload className="w-4 h-4" />
              {importing ? 'Importando...' : 'Importar CSV'}
            </Button>

            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open)
              if (!open) resetForm()
            }}>
              <DialogTrigger asChild>
                <Button className="bg-teal-600 hover:bg-teal-700 gap-2 shadow-sm">
                  <Plus className="w-4 h-4" />
                  Agregar
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>{editingStaff ? 'Editar Personal' : 'Agregar Personal'}</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
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

                  <div className="space-y-2">
                    <Label>Fin de Semana Preferente</Label>
                    <Select value={formData.finDeSemanaPreferente} onValueChange={v => setFormData(p => ({ ...p, finDeSemanaPreferente: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MIXTO">Mixto (alterna Sáb/Dom)</SelectItem>
                        <SelectItem value="SABADO">Solo Sábados</SelectItem>
                        <SelectItem value="DOMINGO">Solo Domingos</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-400">
                      Si elige &quot;Mixto&quot;, se alterna fines de semana. Si elige Sábado o Domingo, solo trabaja ese día.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <LayoutTemplate className="w-4 h-4" />
                      Proforma de Horario (opcional)
                    </Label>
                    <Select value={formData.proformaId} onValueChange={v => setFormData(p => ({ ...p, proformaId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Sin proforma (editar manualmente)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NONE">Sin proforma</SelectItem>
                        {proformas.map(p => (
                          <SelectItem key={p.id} value={p.id}>{p.nombre}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-slate-400">
                      La proforma define los horarios. Puede editar manualmente después.
                    </p>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <DialogClose asChild>
                      <Button variant="outline">Cancelar</Button>
                    </DialogClose>
                    <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleSubmit}>
                      {editingStaff ? 'Actualizar' : 'Guardar'}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-slate-500">Cargando personal...</div>
          ) : staff.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <User className="w-12 h-12 mx-auto mb-3 text-slate-300" />
              <p className="font-medium">No hay personal registrado</p>
              <p className="text-sm">Agregue personal o importe desde CSV para comenzar</p>
              <div className="mt-4 p-3 bg-slate-50 rounded-lg text-xs text-slate-500 max-w-md mx-auto">
                <FileText className="w-4 h-4 inline mr-1" />
                Formato CSV: nombre, apellido, finDeSemana (MIXTO/SABADO/DOMINGO), proforma (opcional)
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre Completo</TableHead>
                    <TableHead>Fin de Semana</TableHead>
                    <TableHead className="hidden md:table-cell">Proforma</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.map(s => (
                    <TableRow key={s.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-white text-xs font-bold shadow-sm">
                            {s.nombre[0]}{s.apellido[0]}
                          </div>
                          {s.nombre} {s.apellido}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={finDeSemanaColors[s.finDeSemanaPreferente]} variant="outline">
                          {finDeSemanaLabels[s.finDeSemanaPreferente]}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {s.proforma ? (
                          <Badge variant="outline" className="text-xs bg-violet-50 text-violet-700 border-violet-200">
                            <LayoutTemplate className="w-3 h-3 mr-1" />
                            {s.proforma.nombre}
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400">Sin proforma</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(s)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => handleDelete(s.id, `${s.nombre} ${s.apellido}`)}>
                            <Trash2 className="w-3.5 h-3.5" />
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
