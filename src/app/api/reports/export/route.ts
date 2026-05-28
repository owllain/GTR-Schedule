import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { execSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + 'T12:00:00')
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const type = body?.type as 'month' | 'staff' | 'comparative'

    if (!type || !['month', 'staff', 'comparative'].includes(type)) {
      return NextResponse.json({ error: 'type requerido: month | staff | comparative' }, { status: 400 })
    }

    const payload = await buildExportPayload(type, body)
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'reports-export-'))
    const jsonPath = path.join(tmpDir, `report_${Date.now()}.json`)
    const xlsxPath = path.join(tmpDir, payload.filename)
    fs.writeFileSync(jsonPath, JSON.stringify(payload.data), 'utf-8')

    const pythonScript = `
import json
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

with open(r'${jsonPath.replace(/\\/g, '\\\\')}', 'r', encoding='utf-8') as f:
    data = json.load(f)

wb = Workbook()
wb.remove(wb.active)

header_fill = PatternFill(start_color="0F766E", end_color="0F766E", fill_type="solid")
header_font = Font(color="FFFFFF", bold=True)
thin = Side(style='thin', color='D1D5DB')
border = Border(left=thin, right=thin, top=thin, bottom=thin)

for sheet in data['sheets']:
    ws = wb.create_sheet(title=sheet['name'][:31])
    ws.append(sheet['headers'])
    for row in sheet['rows']:
        ws.append(row)

    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center', vertical='center')
        cell.border = border

    for r in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=1, max_col=ws.max_column):
        for c in r:
            c.border = border

    for col in ws.columns:
        max_len = 0
        col_letter = col[0].column_letter
        for cell in col:
            val = "" if cell.value is None else str(cell.value)
            if len(val) > max_len:
                max_len = len(val)
        ws.column_dimensions[col_letter].width = min(45, max(12, max_len + 2))

    ws.freeze_panes = "A2"

wb.save(r'${xlsxPath.replace(/\\/g, '\\\\')}')
print("OK")
`

    execSync(`python3 -c "${pythonScript.replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`, { timeout: 30000 })
    const fileBuffer = fs.readFileSync(xlsxPath)

    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${payload.filename}"`,
      },
    })
  } catch (error) {
    console.error('Error exporting reports xlsx:', error)
    return NextResponse.json({ error: 'No se pudo generar el XLSX de reportes' }, { status: 500 })
  }
}

async function buildExportPayload(type: 'month' | 'staff' | 'comparative', body: any): Promise<{ filename: string; data: { sheets: Array<{ name: string; headers: string[]; rows: Array<Array<string | number>> }> } }> {
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

    const rows = staffList.map(s => {
      const my = entries.filter(e => e.staffId === s.id)
      const totalHoras = my.reduce((sum, e) => sum + e.hours, 0)
      const diasLaborados = my.filter(e => (e.type === 'NORMAL' || e.type === 'VACACION') && e.hours > 0).length
      const diasVacacion = my.filter(e => e.type === 'VACACION').length
      const horasVacacion = my.filter(e => e.type === 'VACACION').reduce((sum, e) => sum + e.hours, 0)
      return [
        `${s.nombre} ${s.apellido}`,
        s.proforma?.nombre ?? 'Sin proforma',
        s.finDeSemanaPreferente,
        Math.round(totalHoras * 100) / 100,
        diasLaborados,
        diasVacacion,
        Math.round(horasVacacion * 100) / 100,
      ]
    })

    const planillaRows = staffList.map(s => {
      const my = entries.filter(e => e.staffId === s.id)
      const horasNormales = my.filter(e => e.type === 'NORMAL').reduce((sum, e) => sum + e.hours, 0)
      const horasVacaciones = my.filter(e => e.type === 'VACACION').reduce((sum, e) => sum + e.hours, 0)
      return [
        `${s.nombre} ${s.apellido}`,
        Math.round(horasNormales * 100) / 100,
        Math.round(horasVacaciones * 100) / 100,
        Math.round((horasNormales + horasVacaciones) * 100) / 100,
      ]
    })

    return {
      filename: `reporte_mensual_${year}_${String(month).padStart(2, '0')}.xlsx`,
      data: {
        sheets: [
          {
            name: 'Reporte Mensual',
            headers: ['Empleado', 'Proforma', 'FDS', 'Total Horas', 'Dias Laborados', 'Dias Vacacion', 'Horas Vacacion'],
            rows,
          },
          {
            name: 'Planilla',
            headers: ['Empleado', 'Horas Normales', 'Horas Vacaciones', 'Horas Pagables'],
            rows: planillaRows,
          },
          {
            name: 'Conciliacion Nomina',
            headers: ['Empleado', 'Horas en sistema', 'Horas pagables', 'Diferencia'],
            rows: planillaRows.map(r => [r[0], r[3], r[3], 0]),
          },
        ],
      },
    }
  }

  if (type === 'staff') {
    const staffId = String(body.staffId || '')
    const startDate = String(body.startDate || '')
    const endDate = String(body.endDate || '')
    const staff = await db.staff.findUnique({ where: { id: staffId } })
    if (!staff) throw new Error('Empleado no encontrado')

    const entries = await db.scheduleEntry.findMany({
      where: { staffId, date: { gte: startDate, lte: endDate } },
      orderBy: { date: 'asc' },
    })

    const rows = entries.map(e => [e.date, e.entryTime, e.exitTime, e.hours, e.type, e.isManual ? 'Si' : 'No', e.notes ?? ''])
    return {
      filename: `historial_${staff.nombre}_${staff.apellido}.xlsx`,
      data: {
        sheets: [
          { name: 'Historial', headers: ['Fecha', 'Entrada', 'Salida', 'Horas', 'Tipo', 'Manual', 'Notas'], rows },
        ],
      },
    }
  }

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

  const rows = staffList.map(s => {
    const my = entries.filter(e => e.staffId === s.id)
    const total = my.reduce((sum, e) => sum + e.hours, 0)
    const meta = weeks.length * 48
    const byWeek = weeks.map(w => Math.round(my.filter(e => getWeekNumber(e.date) === w).reduce((sum, e) => sum + e.hours, 0) * 100) / 100)
    const pct = meta > 0 ? Math.round((total / meta) * 100) : 0
    return [`${s.nombre} ${s.apellido}`, s.proforma?.nombre ?? 'Sin proforma', Math.round(total * 100) / 100, meta, pct, ...byWeek]
  })

  return {
    filename: `comparativo_${year}_${String(month).padStart(2, '0')}.xlsx`,
    data: {
      sheets: [
        {
          name: 'Comparativo BI',
          headers: ['Empleado', 'Proforma', 'Total Horas', 'Meta', 'Cumplimiento %', ...weeks.map(w => `Sem ${w}`)],
          rows,
        },
      ],
    },
  }
}
