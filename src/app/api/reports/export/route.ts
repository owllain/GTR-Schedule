import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import * as XLSX from 'xlsx'

function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + 'T12:00:00')
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

type ExportKind = 'month' | 'staff' | 'comparative'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const type = body?.type as ExportKind

    if (!type || !['month', 'staff', 'comparative'].includes(type)) {
      return NextResponse.json({ error: 'type requerido: month | staff | comparative' }, { status: 400 })
    }

    const workbook = XLSX.utils.book_new()
    let filename = 'reporte.xlsx'

    if (type === 'month') {
      const year = Number(body.year)
      const month = Number(body.month)
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const daysInMonth = new Date(year, month, 0).getDate()
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

      const staffList = await db.staff.findMany({
        where: { activo: true },
        include: { proforma: true },
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      })
      const entries = await db.scheduleEntry.findMany({ where: { date: { gte: startDate, lte: endDate } } })

      const mensual = staffList.map(s => {
        const my = entries.filter(e => e.staffId === s.id)
        const totalHoras = my.reduce((sum, e) => sum + e.hours, 0)
        const diasLaborados = my.filter(e => (e.type === 'NORMAL' || e.type === 'VACACION') && e.hours > 0).length
        const diasVacacion = my.filter(e => e.type === 'VACACION').length
        const horasVacacion = my.filter(e => e.type === 'VACACION').reduce((sum, e) => sum + e.hours, 0)
        return {
          Empleado: `${s.nombre} ${s.apellido}`,
          Proforma: s.proforma?.nombre ?? 'Sin proforma',
          FDS: s.finDeSemanaPreferente,
          TotalHoras: Math.round(totalHoras * 100) / 100,
          DiasLaborados: diasLaborados,
          DiasVacacion: diasVacacion,
          HorasVacacion: Math.round(horasVacacion * 100) / 100,
        }
      })

      const planilla = mensual.map(row => ({
        Empleado: row.Empleado,
        HorasNormales: Math.round((row.TotalHoras - row.HorasVacacion) * 100) / 100,
        HorasVacaciones: row.HorasVacacion,
        HorasPagables: row.TotalHoras,
      }))

      const conciliacion = planilla.map(row => ({
        Empleado: row.Empleado,
        HorasSistema: row.HorasPagables,
        HorasPlanilla: row.HorasPagables,
        Diferencia: 0,
      }))

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(mensual), 'Reporte Mensual')
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(planilla), 'Planilla')
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(conciliacion), 'Conciliacion')
      filename = `reporte_mensual_${year}_${String(month).padStart(2, '0')}.xlsx`
    }

    if (type === 'staff') {
      const staffId = String(body.staffId || '')
      const startDate = String(body.startDate || '')
      const endDate = String(body.endDate || '')
      const staff = await db.staff.findUnique({ where: { id: staffId } })
      if (!staff) return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 })

      const entries = await db.scheduleEntry.findMany({
        where: { staffId, date: { gte: startDate, lte: endDate } },
        orderBy: { date: 'asc' },
      })

      const historial = entries.map(e => ({
        Fecha: e.date,
        Entrada: e.entryTime,
        Salida: e.exitTime,
        Horas: e.hours,
        Tipo: e.type,
        Manual: e.isManual ? 'Si' : 'No',
        Notas: e.notes ?? '',
      }))

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(historial), 'Historial')
      filename = `historial_${staff.nombre}_${staff.apellido}.xlsx`
    }

    if (type === 'comparative') {
      const year = Number(body.year)
      const month = Number(body.month)
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`
      const daysInMonth = new Date(year, month, 0).getDate()
      const endDate = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`

      const staffList = await db.staff.findMany({
        where: { activo: true },
        include: { proforma: true },
        orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      })
      const entries = await db.scheduleEntry.findMany({ where: { date: { gte: startDate, lte: endDate } } })
      const weeks = Array.from(new Set(entries.map(e => getWeekNumber(e.date)))).sort((a, b) => a - b)

      const comparativo = staffList.map(s => {
        const my = entries.filter(e => e.staffId === s.id)
        const total = Math.round(my.reduce((sum, e) => sum + e.hours, 0) * 100) / 100
        const meta = weeks.length * 48
        const base: Record<string, string | number> = {
          Empleado: `${s.nombre} ${s.apellido}`,
          Proforma: s.proforma?.nombre ?? 'Sin proforma',
          TotalHoras: total,
          Meta: meta,
          CumplimientoPct: meta > 0 ? Math.round((total / meta) * 100) : 0,
        }
        for (const w of weeks) {
          base[`Sem${w}`] = Math.round(my.filter(e => getWeekNumber(e.date) === w).reduce((sum, e) => sum + e.hours, 0) * 100) / 100
        }
        return base
      })

      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(comparativo), 'Comparativo BI')
      filename = `comparativo_${year}_${String(month).padStart(2, '0')}.xlsx`
    }

    const file = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    return new NextResponse(file, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting reports xlsx:', error)
    return NextResponse.json({ error: 'No se pudo generar el XLSX de reportes' }, { status: 500 })
  }
}
