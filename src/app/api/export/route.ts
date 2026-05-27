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
      include: { staff: true },
      orderBy: [{ date: 'asc' }, { staff: { apellido: 'asc' } }],
    });

    const staffList = await db.staff.findMany({
      where: { activo: true },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
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
    let lastWeekNum = -1;

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
        dateLabel: `${dayNames[dow]} ${day}`,
        fullDate: dateStr,
        isWeekend,
        weekNum,
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
          };
        } else {
          row.staffData[s.id] = { entryTime: '', exitTime: '', hours: 0, type: 'DESCANSO' };
        }
      }

      exportData.push(row);

      // Add week total after Sunday or last day
      if (dow === 0 || day === daysInMonth) {
        const totalRow: any = {
          dateLabel: 'TOTAL',
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

      lastWeekNum = weekNum;
    }

    const staffInfo = staffList.map(s => ({
      id: s.id,
      name: `${s.nombre} ${s.apellido}`,
      jornada: s.jornadaPreferente,
      targetHours: s.jornadaPreferente === 'DIURNA' ? 48 : s.jornadaPreferente === 'MIXTA' ? 42 : 36,
    }));

    // Generate Excel using Python/openpyxl
    const title = `Horario Staff ${monthNames[monthNum - 1]} ${yearNum}`;
    const tmpDir = '/tmp/schedule_export';
    if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
    
    const jsonPath = path.join(tmpDir, `data_${yearNum}_${monthNum}.json`);
    const xlsxPath = path.join(tmpDir, `horario_${yearNum}_${String(monthNum).padStart(2, '0')}.xlsx`);
    
    fs.writeFileSync(jsonPath, JSON.stringify({ title, staffInfo, data: exportData, year: yearNum, month: monthNum }));

    const pythonScript = `
import json
import sys
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, PatternFill, Border, Side
from openpyxl.utils import get_column_letter

with open('${jsonPath}', 'r') as f:
    data = json.load(f)

wb = Workbook()
ws = wb.active
ws.title = "Horario"

# Colors
header_fill = PatternFill(start_color="1A7A4C", end_color="1A7A4C", fill_type="solid")
header_font = Font(color="FFFFFF", bold=True, size=11)
subheader_fill = PatternFill(start_color="E8F5E9", end_color="E8F5E9", fill_type="solid")
subheader_font = Font(bold=True, size=9)
total_fill = PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid")
total_font = Font(bold=True, size=10, color="1A7A4C")
weekend_fill = PatternFill(start_color="F0F9FF", end_color="F0F9FF", fill_type="solid")
normal_font = Font(size=10)
bold_font = Font(bold=True, size=10)
small_font = Font(size=8, color="666666")
thin_border = Border(
    left=Side(style='thin', color='CCCCCC'),
    right=Side(style='thin', color='CCCCCC'),
    top=Side(style='thin', color='CCCCCC'),
    bottom=Side(style='thin', color='CCCCCC'),
)

# Title
ws.merge_cells(start_row=1, start_column=1, end_row=1, end_column=1+len(data['staffInfo'])*3)
title_cell = ws.cell(row=1, column=1, value=data['title'])
title_cell.font = Font(bold=True, size=14, color="1A7A4C")
title_cell.alignment = Alignment(horizontal='center')

# Header row - Staff names
row = 3
ws.cell(row=row, column=1, value="HORARIO").font = header_font
ws.cell(row=row, column=1).fill = header_fill
ws.cell(row=row, column=1).alignment = Alignment(horizontal='center', vertical='center')
ws.cell(row=row, column=1).border = thin_border

col = 2
for s in data['staffInfo']:
    ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col+2)
    cell = ws.cell(row=row, column=col, value=s['name'])
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal='center', vertical='center')
    ws.cell(row=row, column=col+1).fill = header_fill
    ws.cell(row=row, column=col+2).fill = header_fill
    ws.cell(row=row, column=col).border = thin_border
    ws.cell(row=row, column=col+1).border = thin_border
    ws.cell(row=row, column=col+2).border = thin_border
    col += 3

# Sub-header - Jornada type
row = 4
ws.cell(row=row, column=1, value="").fill = subheader_fill
ws.cell(row=row, column=1).border = thin_border
col = 2
for s in data['staffInfo']:
    ws.merge_cells(start_row=row, start_column=col, end_row=row, end_column=col+2)
    cell = ws.cell(row=row, column=col, value=s['jornada'] + " (" + str(s['targetHours']) + "h)")
    cell.font = subheader_font
    cell.fill = subheader_fill
    cell.alignment = Alignment(horizontal='center')
    ws.cell(row=row, column=col+1).fill = subheader_fill
    ws.cell(row=row, column=col+2).fill = subheader_fill
    ws.cell(row=row, column=col).border = thin_border
    ws.cell(row=row, column=col+1).border = thin_border
    ws.cell(row=row, column=col+2).border = thin_border
    col += 3

# Sub-header 2 - Entry/Exit/Hours
row = 5
ws.cell(row=row, column=1, value="Fecha").font = bold_font
ws.cell(row=row, column=1).fill = PatternFill(start_color="F0FDF4", end_color="F0FDF4", fill_type="solid")
ws.cell(row=row, column=1).border = thin_border
ws.cell(row=row, column=1).alignment = Alignment(horizontal='center')
col = 2
for _ in data['staffInfo']:
    for label in ["Entrada", "Salida", "Horas"]:
        cell = ws.cell(row=row, column=col, value=label)
        cell.font = Font(bold=True, size=8)
        cell.fill = PatternFill(start_color="F0FDF4", end_color="F0FDF4", fill_type="solid")
        cell.alignment = Alignment(horizontal='center')
        cell.border = thin_border
        col += 1

# Data rows
row = 6
for entry in data['data']:
    if entry.get('isTotal'):
        # Total row
        ws.cell(row=row, column=1, value=entry['dateLabel']).font = total_font
        ws.cell(row=row, column=1).fill = total_fill
        ws.cell(row=row, column=1).border = thin_border
        ws.cell(row=row, column=1).alignment = Alignment(horizontal='center')
        col = 2
        for s in data['staffInfo']:
            sd = entry['staffData'].get(s['id'], {})
            hours = sd.get('hours', 0)
            ws.cell(row=row, column=col, value="").fill = total_fill
            ws.cell(row=row, column=col).border = thin_border
            ws.cell(row=row, column=col+1, value="").fill = total_fill
            ws.cell(row=row, column=col+1).border = thin_border
            cell = ws.cell(row=row, column=col+2, value=hours if hours else "")
            cell.font = total_font
            cell.fill = total_fill
            cell.alignment = Alignment(horizontal='center')
            cell.border = thin_border
            col += 3
        row += 1
        continue
    
    is_weekend = entry.get('isWeekend', False)
    fill = weekend_fill if is_weekend else None
    
    date_cell = ws.cell(row=row, column=1, value=entry['dateLabel'])
    date_cell.font = bold_font
    date_cell.border = thin_border
    date_cell.alignment = Alignment(horizontal='center', vertical='center')
    if fill:
        date_cell.fill = fill
    
    col = 2
    for s in data['staffInfo']:
        sd = entry['staffData'].get(s['id'], {})
        entry_type = sd.get('type', 'DESCANSO')
        et = sd.get('entryTime', '')
        xt = sd.get('exitTime', '')
        hrs = sd.get('hours', 0)
        
        type_colors = {
            'VACACION': PatternFill(start_color="DCFCE7", end_color="DCFCE7", fill_type="solid"),
            'INCAPACIDAD': PatternFill(start_color="FEE2E2", end_color="FEE2E2", fill_type="solid"),
            'LICENCIA': PatternFill(start_color="FEF9C3", end_color="FEF9C3", fill_type="solid"),
            'PERMISO': PatternFill(start_color="FFEDD5", end_color="FFEDD5", fill_type="solid"),
            'FERIADO': PatternFill(start_color="DBEAFE", end_color="DBEAFE", fill_type="solid"),
            'DESCANSO': PatternFill(start_color="F1F5F9", end_color="F1F5F9", fill_type="solid"),
        }
        type_labels = {
            'VACACION': 'VAC',
            'INCAPACIDAD': 'INC',
            'LICENCIA': 'LIC',
            'PERMISO': 'PER',
            'FERIADO': 'FER',
            'DESCANSO': 'D',
        }
        
        type_fill = type_colors.get(entry_type)
        
        if entry_type in type_labels:
            label = type_labels[entry_type]
            c1 = ws.cell(row=row, column=col, value=label)
            c1.font = Font(size=9, bold=True, color="666666")
            c1.alignment = Alignment(horizontal='center', vertical='center')
            c1.border = thin_border
            if type_fill: c1.fill = type_fill
            ws.cell(row=row, column=col+1, value="").border = thin_border
            if type_fill: ws.cell(row=row, column=col+1).fill = type_fill
            ws.cell(row=row, column=col+2, value="").border = thin_border
            if type_fill: ws.cell(row=row, column=col+2).fill = type_fill
        else:
            c1 = ws.cell(row=row, column=col, value=et)
            c1.font = normal_font
            c1.alignment = Alignment(horizontal='center', vertical='center')
            c1.border = thin_border
            if fill: c1.fill = fill
            
            c2 = ws.cell(row=row, column=col+1, value=xt)
            c2.font = normal_font
            c2.alignment = Alignment(horizontal='center', vertical='center')
            c2.border = thin_border
            if fill: c2.fill = fill
            
            c3 = ws.cell(row=row, column=col+2, value=hrs if hrs else "")
            c3.font = Font(size=9, bold=True, color="1A7A4C")
            c3.alignment = Alignment(horizontal='center', vertical='center')
            c3.border = thin_border
            if fill: c3.fill = fill
        
        col += 3
    row += 1

# Column widths
ws.column_dimensions['A'].width = 12
col_idx = 2
for s in data['staffInfo']:
    name_width = max(len(s['name']) // 3 + 1, 5)
    for i in range(3):
        ws.column_dimensions[get_column_letter(col_idx)].width = name_width
        col_idx += 1

# Row heights
ws.row_dimensions[1].height = 25
ws.row_dimensions[3].height = 22
ws.row_dimensions[4].height = 18
ws.row_dimensions[5].height = 18

wb.save('${xlsxPath}')
print("OK")
`;

    try {
      execSync(`python3 -c '${pythonScript.replace(/'/g, "'\"'\"'")}'`, { timeout: 30000 });
    } catch (e) {
      console.error('Python error:', e);
      // Fallback: use the HTML-based approach
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
  const title = `Horario Staff ${monthNames[monthNum - 1]} ${yearNum}`;
  let html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
  <head><meta charset="UTF-8"></head><body>
  <h2>${title}</h2><table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;">`;
  
  html += '<tr style="background-color:#1a7a4c;color:white;font-weight:bold;"><td>Fecha</td>';
  for (const s of staffList) {
    html += `<td colspan="3" style="text-align:center;">${s.nombre} ${s.apellido}</td>`;
  }
  html += '</tr>';

  html += '<tr style="background-color:#f0fdf4;font-weight:bold;"><td></td>';
  for (const s of staffList) {
    html += '<td>Entrada</td><td>Salida</td><td>Horas</td>';
  }
  html += '</tr>';

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const date = new Date(dateStr + 'T12:00:00');
    const dow = date.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const style = isWeekend ? 'style="background-color:#f0f9ff;"' : '';
    
    html += `<tr ${style}><td>${dayNames[dow]} ${day}</td>`;
    for (const s of staffList) {
      const entry = entryMap.get(dateStr)?.get(s.id);
      if (entry && entry.type === 'NORMAL') {
        html += `<td>${entry.entryTime}</td><td>${entry.exitTime}</td><td>${entry.hours}</td>`;
      } else if (entry && entry.type === 'DESCANSO') {
        html += '<td>D</td><td></td><td></td>';
      } else if (entry) {
        const labels: any = { VACACION: 'VAC', INCAPACIDAD: 'INC', LICENCIA: 'LIC', PERMISO: 'PER', FERIADO: 'FER' };
        html += `<td>${labels[entry.type] || entry.type}</td><td></td><td></td>`;
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
