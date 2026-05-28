import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

// POST generate Excel export using openpyxl
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, month } = body;

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month are required' }, { status: 400 });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const endDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const entries = await db.scheduleEntry.findMany({
      where: { date: { gte: startDate, lte: endDate } },
      include: { staff: { include: { proforma: true } } },
      orderBy: [{ date: 'asc' }, { staff: { apellido: 'asc' } }],
    });

    const staffList = await db.staff.findMany({
      where: { activo: true },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      include: { proforma: { include: { entradas: true } } },
    });

    if (entries.length === 0) {
      return NextResponse.json({ error: 'No hay horario generado para este mes' }, { status: 400 });
    }

    // Build data structure for Python script
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    // Create entry map
    const entryMap = new Map<string, Map<string, typeof entries[0]>>();
    for (const entry of entries) {
      if (!entryMap.has(entry.date)) entryMap.set(entry.date, new Map());
      entryMap.get(entry.date)!.set(entry.staffId, entry);
    }

    // Build JSON data for Python
    const exportData: any[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const date = new Date(dateStr + 'T12:00:00');
      const dow = date.getDay();
      const isWeekend = dow === 0 || dow === 6;

      // Week number calculation
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

      const row: any = {
        dateLabel: `${dayNames[dow]} ${String(day).padStart(2, '0')}`,
        fullDate: dateStr,
        isWeekend,
        weekNum,
        dow,
        staffData: {} as any,
      };

      for (const s of staffList) {
        const entry = entryMap.get(dateStr)?.get(s.id);
        if (entry) {
          row.staffData[s.id] = {
            entryTime: entry.entryTime,
            exitTime: entry.exitTime,
            hours: entry.hours,
            type: entry.type,
            isManual: entry.isManual,
          };
        } else {
          row.staffData[s.id] = { entryTime: '', exitTime: '', hours: 0, type: 'DESCANSO', isManual: false };
        }
      }

      exportData.push(row);

      // Add week total after Sunday or last day
      if (dow === 0 || day === daysInMonth) {
        const totalRow: any = {
          dateLabel: 'TOTAL SEM',
          isTotal: true,
          weekNum,
          staffData: {} as any,
        };
        for (const s of staffList) {
          const weekEntries = entries.filter(e => {
            const eDate = new Date(e.date + 'T12:00:00');
            const ed = new Date(Date.UTC(eDate.getFullYear(), eDate.getMonth(), eDate.getDate()));
            const eDayNum = ed.getUTCDay() || 7;
            ed.setUTCDate(ed.getUTCDate() + 4 - eDayNum);
            const eYearStart = new Date(Date.UTC(ed.getUTCFullYear(), 0, 1));
            const eWeekNum = Math.ceil((((ed.getTime() - eYearStart.getTime()) / 86400000) + 1) / 7);
            return e.staffId === s.id && eWeekNum === weekNum && e.hours > 0;
          });
          const weekHours = weekEntries.reduce((sum, e) => sum + e.hours, 0);
          totalRow.staffData[s.id] = { hours: Math.round(weekHours * 100) / 100 };
        }
        exportData.push(totalRow);
      }
    }

    // Calculate month totals
    const monthTotals: any = {};
    for (const s of staffList) {
      const monthHours = entries.filter(e => e.staffId === s.id && e.hours > 0).reduce((sum, e) => sum + e.hours, 0);
      monthTotals[s.id] = Math.round(monthHours * 100) / 100;
    }

    const staffInfo = staffList.map(s => ({
      id: s.id,
      name: `${s.nombre} ${s.apellido}`,
      finDeSemana: s.finDeSemanaPreferente,
      proforma: s.proforma?.nombre || 'Sin proforma',
    }));

    // Generate Excel using Python/openpyxl with ENHANCED COLORS
    const title = `Gestor de Horarios - STAFF - ${monthNames[monthNum - 1]} ${yearNum}`;
    const tmpDir = '/tmp/schedule_export';
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

    const jsonPath = path.join(tmpDir, `data_${yearNum}_${monthNum}.json`);
    const xlsxPath = path.join(tmpDir, `horario_${yearNum}_${String(monthNum).padStart(2, '0')}.xlsx`);

    fs.writeFileSync(jsonPath, JSON.stringify({ title, staffInfo, data: exportData, year: yearNum, month: monthNum, monthTotals }));

    const pythonScript = `
import json
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side, numbers
from openpyxl.utils import get_column_letter

with open('${jsonPath}', 'r') as f:
    data = json.load(f)

wb = Workbook()
ws = wb.active
ws.title = "Horario"

# Enhanced Color Palette - Modern & Vibrant
header_fill = PatternFill(start_color="0F766E", end_color="0F766E", fill_type="solid")  # Teal-700
header_font = Font(color="FFFFFF", bold=True, size=11, name="Calibri")
subheader_fill = PatternFill(start_color="CCFBF1", end_color="CCFBF1", fill_type="solid")  # Teal-100
subheader_font = Font(bold=True, size=9, color="0F766E", name="Calibri")
total_fill = PatternFill(start_color="F0FDFA", end_color="F0FDFA", fill_type="solid")  # Teal-50
total_font = Font(bold=True, size=10, color="0F766E", name="Calibri")
weekend_fill = PatternFill(start_color="FEF3C7", end_color="FEF3C7", fill_type="solid")  # Amber-100
saturday_fill = PatternFill(start_color="DBEAFE", end_color="DBEAFE", fill_type="solid")  # Blue-100
sunday_fill = PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid")  # Red-100
date_col_fill = PatternFill(start_color="E2E8F0", end_color="E2E8F0", fill_type="solid")  # Slate-200
normal_font = Font(size=10, name="Calibri")
bold_font = Font(bold=True, size=10, name="Calibri")
small_font = Font(size=8, color="6B7280", name="Calibri")
hours_font = Font(size=9, bold=True, color="0F766E", name="Calibri")

# Type-specific fills with modern palette
type_colors = {
    'VACACION': PatternFill(start_color="D1FAE5", end_color="D1FAE5", fill_type="solid"),   # Emerald-100
    'INCAPACIDAD': PatternFill(start_color="FECACA", end_color="FECACA", fill_type="solid"), # Red-200
    'LICENCIA': PatternFill(start_color="FEF08A", end_color="FEF08A", fill_type="solid"),    # Yellow-200
    'PERMISO': PatternFill(start_color="FED7AA", end_color="FED7AA", fill_type="solid"),     # Orange-200
    'FERIADO': PatternFill(start_color="C7D2FE", end_color="C7D2FE", fill_type="solid"),     # Indigo-200
    'DESCANSO': PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid"),    # Slate-100
}

type_fonts = {
    'VACACION': Font(size=9, bold=True, color="065F46", name="Calibri"),
    'INCAPACIDAD': Font(size=9, bold=True, color="991B1B", name="Calibri"),
    'LICENCIA': Font(size=9, bold=True, color="854D0E", name="Calibri"),
    'PERMISO': Font(size=9, bold=True, color="9A3412", name="Calibri"),
    'FERIADO': Font(size=9, bold=True, color="3730A3", name="Calibri"),
    'DESCANSO': Font(size=9, color="94A3B8", name="Calibri"),
}

type_labels = {
    'VACACION': 'VAC',
    'INCAPACIDAD': 'INC',
    'LICENCIA': 'LIC',
    'PERMISO': 'PER',
    'FERIADO': 'FER',
    'DESCANSO': 'D',
}

thin_border = Border(
    left=Side(style='thin', color='D1D5DB'),
    right=Side(style='thin', color='D1D5DB'),
    top=Side(style='thin', color='D1D5DB'),
    bottom=Side(style='thin', color='D1D5DB'),
)

# Staff colors for alternating columns
staff_colors = [
    PatternFill(start_color="F0FDF4", end_color="F0FDF4", fill_type="solid"),  # Green-50
    PatternFill(start_color="EFF6FF", end_color="EFF6FF", fill_type="solid"),  # Blue-50
    PatternFill(start_color="FDF4FF", end_color="FDF4FF", fill_type="solid"),  # Fuchsia-50
    PatternFill(start_color="FFF7ED", end_color="FFF7ED", fill_type="solid"),  # Orange-50
    PatternFill(start_color="F0FDFA", end_color="F0FDFA", fill_type="solid"),  # Teal-50
    PatternFill(start_color="FEFCE8", end_color="FEFCE8", fill_type="solid"),  # Yellow-50
    PatternFill(start_color="FFF1F2", end_color="FFF1F2", fill_type="solid"),  # Rose-50
    PatternFill(start_color="ECFDF5", end_color="ECFDF5", fill_type="solid"),  # Emerald-50
    PatternFill(start_color="F5F3FF", end_color="F5F3FF", fill_type="solid"),  # Violet-50
    PatternFill(start_color="ECFEFF", end_color="ECFEFF", fill_type="solid"),  # Cyan-50
]

# Title row
ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=1+len(data['staffInfo'])*3)
title_cell = ws.cell(row=1, column=1, value=data['title'])
title_cell.font = Font(bold=True, size=16, color="0F766E", name="Calibri")
title_cell.alignment = Alignment(horizontal='center', vertical='center')
title_cell.fill = PatternFill(start_color="F0FDFA", end_color="F0FDFA", fill_type="solid")

# Credit row
ws.merge_cells(start_row=2, start_column=1, end_row=2, end_column=1+len(data['staffInfo'])*3)
credit_cell = ws.cell(row=2, column=1, value="Desarrollado por Alvaro Enrique Cascante Moraga  |  acascantem@netcom.com.pa")
credit_cell.font = Font(size=9, italic=True, color="6B7280", name="Calibri")
credit_cell.alignment = Alignment(horizontal='center')

# Header row - Staff names with alternating colors
row = 4
ws.cell(row=row, column=1, value="HORARIO").font = header_font
ws.cell(row=row, column=1).fill = header_fill
ws.cell(row=row, column=1).alignment = Alignment(horizontal='center', vertical='center')
ws.cell(row=row, column=1).border = thin_border

col = 2
for idx, s in enumerate(data['staffInfo']):
    staff_fill = staff_colors[idx % len(staff_colors)]
    ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col+2)
    cell = ws.cell(row=row, column=col, value=s['name'])
    cell.font = Font(bold=True, size=11, color="1E293B", name="Calibri")
    cell.fill = staff_fill
    cell.alignment = Alignment(horizontal='center', vertical='center')
    for c in range(col, col+3):
        ws.cell(row=row, column=c).fill = staff_fill
        ws.cell(row=row, column=c).border = thin_border
    col += 3

# Sub-header - Fin de semana type
row = 5
ws.cell(row=row, column=1, value="").fill = subheader_fill
ws.cell(row=row, column=1).border = thin_border
col = 2
for idx, s in enumerate(data['staffInfo']):
    staff_fill = staff_colors[idx % len(staff_colors)]
    ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col+2)
    fe_map = {'MIXTO': 'Mixto (alterna)', 'SABADO': 'Solo Sabados', 'DOMINGO': 'Solo Domingos'}
    cell = ws.cell(row=row, column=col, value=fe_map.get(s['finDeSemana'], s['finDeSemana']))
    cell.font = Font(size=8, color="0F766E", name="Calibri")
    cell.fill = staff_fill
    cell.alignment = Alignment(horizontal='center')
    for c in range(col, col+3):
        ws.cell(row=row, column=c).fill = staff_fill
        ws.cell(row=row, column=c).border = thin_border
    col += 3

# Sub-header 2 - Entry/Exit/Hours
row = 6
ws.cell(row=row, column=1, value="Fecha").font = bold_font
ws.cell(row=row, column=1).fill = PatternFill(start_color="94A3B8", end_color="94A3B8", fill_type="solid")
ws.cell(row=row, column=1).font = Font(bold=True, size=10, color="FFFFFF", name="Calibri")
ws.cell(row=row, column=1).border = thin_border
ws.cell(row=row, column=1).alignment = Alignment(horizontal='center')
col = 2
for idx, _ in enumerate(data['staffInfo']):
    staff_fill = staff_colors[idx % len(staff_colors)]
    for label in ["Entrada", "Salida", "Horas"]:
        cell = ws.cell(row=row, column=col, value=label)
        cell.font = Font(bold=True, size=8, color="475569", name="Calibri")
        cell.fill = staff_fill
        cell.alignment = Alignment(horizontal='center')
        cell.border = thin_border
        col += 1

# Data rows
row = 7
for entry in data['data']:
    if entry.get('isTotal'):
        # Total row
        ws.cell(row=row, column=1, value=entry['dateLabel']).font = total_font
        ws.cell(row=row, column=1).fill = total_fill
        ws.cell(row=row, column=1).border = thin_border
        ws.cell(row=row, column=1).alignment = Alignment(horizontal='center')
        col = 2
        for idx, s in enumerate(data['staffInfo']):
            sd = entry['staffData'].get(s['id'], {})
            hours = sd.get('hours', 0)
            for c in range(col, col+3):
                ws.cell(row=row, column=c).fill = total_fill
                ws.cell(row=row, column=c).border = thin_border
            cell = ws.cell(row=row, column=col+2, value=hours if hours else "")
            cell.font = total_font
            cell.fill = total_fill
            cell.alignment = Alignment(horizontal='center')
            cell.border = thin_border
            col += 3
        row += 1
        continue

    dow = entry.get('dow', 0)
    is_weekend = entry.get('isWeekend', False)

    # Date column with weekend highlighting
    if dow == 0:
        date_fill = sunday_fill
        date_font_color = "DC2626"
    elif dow == 6:
        date_fill = saturday_fill
        date_font_color = "2563EB"
    elif is_weekend:
        date_fill = weekend_fill
        date_font_color = "000000"
    else:
        date_fill = date_col_fill
        date_font_color = "1E293B"

    # Force text format to prevent Excel auto-converting labels like "Mar 5"
    date_cell = ws.cell(row=row, column=1, value="'" + str(entry['dateLabel']))
    date_cell.font = Font(bold=True, size=10, color=date_font_color, name="Calibri")
    date_cell.border = thin_border
    date_cell.alignment = Alignment(horizontal='center', vertical='center')
    date_cell.number_format = '@'
    if date_fill:
        date_cell.fill = date_fill

    col = 2
    for idx, s in enumerate(data['staffInfo']):
        sd = entry['staffData'].get(s['id'], {})
        entry_type = sd.get('type', 'DESCANSO')
        et = sd.get('entryTime', '')
        xt = sd.get('exitTime', '')
        hrs = sd.get('hours', 0)
        is_manual = sd.get('isManual', False)

        type_fill = type_colors.get(entry_type)
        type_font = type_fonts.get(entry_type)

        if entry_type in type_labels:
            label = type_labels[entry_type]
            for c in range(col, col+3):
                cell = ws.cell(row=row, column=c)
                if type_fill: cell.fill = type_fill
                cell.border = thin_border
                cell.alignment = Alignment(horizontal='center', vertical='center')
            ws.cell(row=row, column=col, value=label).font = type_font or Font(size=9, name="Calibri")
            ws.cell(row=row, column=col+1, value="")
            ws.cell(row=row, column=col+2, value="")
        else:
            # NORMAL entry
            staff_fill = staff_colors[idx % len(staff_colors)] if not is_weekend else None

            c1 = ws.cell(row=row, column=col, value=et)
            c1.font = normal_font
            c1.alignment = Alignment(horizontal='center', vertical='center')
            c1.border = thin_border
            if is_weekend and dow == 6: c1.fill = saturday_fill
            elif is_weekend and dow == 0: c1.fill = sunday_fill
            elif staff_fill: c1.fill = staff_fill

            c2 = ws.cell(row=row, column=col+1, value=xt)
            c2.font = normal_font
            c2.alignment = Alignment(horizontal='center', vertical='center')
            c2.border = thin_border
            if is_weekend and dow == 6: c2.fill = saturday_fill
            elif is_weekend and dow == 0: c2.fill = sunday_fill
            elif staff_fill: c2.fill = staff_fill

            c3 = ws.cell(row=row, column=col+2, value=hrs if hrs else "")
            c3.font = hours_font
            c3.alignment = Alignment(horizontal='center', vertical='center')
            c3.border = thin_border
            if is_weekend and dow == 6: c3.fill = saturday_fill
            elif is_weekend and dow == 0: c3.fill = sunday_fill
            elif staff_fill: c3.fill = staff_fill

            if is_manual:
                c1.font = Font(size=10, name="Calibri", color="B45309")
                c2.font = Font(size=10, name="Calibri", color="B45309")

        col += 3
    row += 1

# Month total row
ws.cell(row=row+1, column=1, value="TOTAL MES").font = Font(bold=True, size=11, color="0F766E", name="Calibri")
ws.cell(row=row+1, column=1).fill = PatternFill(start_color="CCFBF1", end_color="CCFBF1", fill_type="solid")
ws.cell(row=row+1, column=1).border = thin_border
ws.cell(row=row+1, column=1).alignment = Alignment(horizontal='center')
col = 2
for s in data['staffInfo']:
    mt = data.get('monthTotals', {}).get(s['id'], 0)
    for c in range(col, col+2):
        ws.cell(row=row+1, column=c).fill = PatternFill(start_color="CCFBF1", end_color="CCFBF1", fill_type="solid")
        ws.cell(row=row+1, column=c).border = thin_border
    cell = ws.cell(row=row+1, column=col+2, value=mt if mt else "")
    cell.font = Font(bold=True, size=11, color="0F766E", name="Calibri")
    cell.fill = PatternFill(start_color="CCFBF1", end_color="CCFBF1", fill_type="solid")
    cell.alignment = Alignment(horizontal='center')
    cell.border = thin_border
    col += 3

# Footer credit row
footer_row = row + 3
ws.merge_cells(start_row=footer_row, start_column=1, end_row=footer_row, end_column=1+len(data['staffInfo'])*3)
ws.cell(row=footer_row, column=1, value="Desarrollado por Alvaro Enrique Cascante Moraga  |  acascantem@netcom.com.pa").font = Font(size=8, italic=True, color="94A3B8", name="Calibri")

# Column widths
ws.column_dimensions['A'].width = 14
col_idx = 2
for s in data['staffInfo']:
    name_width = max(len(s['name']) // 3 + 1, 7)
    for i in range(3):
        ws.column_dimensions[get_column_letter(col_idx)].width = name_width
        col_idx += 1

# Row heights
ws.row_dimensions[1].height = 30
ws.row_dimensions[4].height = 24
ws.row_dimensions[5].height = 18
ws.row_dimensions[6].height = 18

# Freeze panes
ws.freeze_panes = 'B7'

wb.save('${xlsxPath}')
print("OK")
`;

    try {
      execSync(`python3 -c '${pythonScript.replace(/'/g, "'\"'\"'")}'`, { timeout: 30000 });
    } catch (e) {
      console.error('Python error:', e);
      return generateHtmlExport(entries, staffList, yearNum, monthNum, monthNames, dayNames, entryMap, daysInMonth);
    }

    // Read the generated file
    const fileBuffer = fs.readFileSync(xlsxPath);

    // Clean up temp files
    try { fs.unlinkSync(jsonPath); } catch {}
    try { fs.unlinkSync(xlsxPath); } catch {}

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="horario_${monthNames[monthNum-1]}_${yearNum}.xlsx"`,
      },
    });
  } catch (error) {
    console.error('Error exporting schedule:', error);
    return NextResponse.json({ error: 'Error exporting schedule' }, { status: 500 });
  }
}

function generateHtmlExport(
  entries: any[],
  staffList: any[],
  yearNum: number,
  monthNum: number,
  monthNames: string[],
  dayNames: string[],
  entryMap: Map<string, Map<string, any>>,
  daysInMonth: number
) {
  const title = `Gestor de Horarios - STAFF - ${monthNames[monthNum - 1]} ${yearNum}`;
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
  <head><meta charset="UTF-8"></head><body>
  <h2>${title}</h2>
  <p style="font-size:10px;color:gray;">Desarrollado por Alvaro Enrique Cascante Moraga | acascantem@netcom.com.pa</p>
  <table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;">`;

  html += '<tr style="background-color:#0F766E;color:white;font-weight:bold;"><td>Fecha</td>';
  for (const s of staffList) {
    html += `<td colspan="3" style="text-align:center;">${s.nombre} ${s.apellido}</td>`;
  }
  html += '</tr>';

  html += '<tr style="background-color:#CCFBF1;font-weight:bold;"><td></td>';
  for (const s of staffList) {
    html += '<td>Entrada</td><td>Salida</td><td>Horas</td>';
  }
  html += '</tr>';

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const date = new Date(dateStr + 'T12:00:00');
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const bgColor = dow === 0 ? '#FEE2E2' : dow === 6 ? '#DBEAFE' : isWeekend ? '#FEF3C7' : '';
    const style = bgColor ? `style="background-color:${bgColor};"` : '';

    html += `<tr ${style}><td>${dayNames[dow]} ${day}</td>`;
    for (const s of staffList) {
      const entry = entryMap.get(dateStr)?.get(s.id);
      if (entry && entry.type === 'NORMAL') {
        html += `<td>${entry.entryTime}</td><td>${entry.exitTime}</td><td style="color:#0F766E;font-weight:bold;">${entry.hours}</td>`;
      } else if (entry && entry.type === 'DESCANSO') {
        html += '<td style="color:#94A3B8;">D</td><td></td><td></td>';
      } else if (entry) {
        const labels: any = { VACACION: 'VAC', INCAPACIDAD: 'INC', LICENCIA: 'LIC', PERMISO: 'PER', FERIADO: 'FER' };
        html += `<td style="font-weight:bold;">${labels[entry.type] || entry.type}</td><td></td><td></td>`;
      } else {
        html += '<td>-</td><td></td><td></td>';
      }
    }
    html += '</tr>';
  }

  html += '</table></body></html>';
  const blob = Buffer.from(html, 'utf-8');

  return new NextResponse(blob, {
    headers: {
      'Content-Type': 'application/vnd.ms-excel',
      'Content-Disposition': `attachment; filename="horario_${monthNames[monthNum-1]}_${yearNum}.xls"`,
    },
  });
}
