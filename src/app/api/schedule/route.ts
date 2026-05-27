import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { calculateHours } from '@/lib/schedule-generator';

// GET schedule entries for a given month
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month are required' }, { status: 400 });
    }

    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
    const endDate = `${year}-${month.padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const entries = await db.scheduleEntry.findMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
      include: { staff: true },
      orderBy: [{ date: 'asc' }, { staff: { apellido: 'asc' } }],
    });

    // Calculate weekly summaries
    const staffList = await db.staff.findMany({ where: { activo: true } });
    const weeklySummaries: Record<string, { weekNum: number; weekStart: string; weekEnd: string; hours: number; target: number }[]> = {};

    for (const s of staffList) {
      const staffEntries = entries.filter(e => e.staffId === s.id && e.hours > 0);
      const weekMap = new Map<number, { hours: number; dates: Set<string> }>();

      for (const entry of staffEntries) {
        const date = new Date(entry.date + 'T12:00:00');
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);

        if (!weekMap.has(weekNum)) {
          weekMap.set(weekNum, { hours: 0, dates: new Set() });
        }
        weekMap.get(weekNum)!.hours += entry.hours;
        weekMap.get(weekNum)!.dates.add(entry.date);
      }

      const targetHours = s.jornadaPreferente === 'DIURNA' ? 48 : s.jornadaPreferente === 'MIXTA' ? 42 : 36;
      weeklySummaries[s.id] = Array.from(weekMap.entries()).map(([weekNum, data]) => {
        const sortedDates = Array.from(data.dates).sort();
        return {
          weekNum,
          weekStart: sortedDates[0],
          weekEnd: sortedDates[sortedDates.length - 1],
          hours: Math.round(data.hours * 100) / 100,
          target: targetHours,
        };
      }).sort((a, b) => a.weekNum - b.weekNum);
    }

    return NextResponse.json({ entries, weeklySummaries });
  } catch (error) {
    console.error('Error fetching schedule:', error);
    return NextResponse.json({ error: 'Error fetching schedule' }, { status: 500 });
  }
}

// PUT update a single schedule entry
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, entryTime, exitTime, type, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const existing = await db.scheduleEntry.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 });
    }

    let hours = existing.hours;
    const newEntryTime = entryTime ?? existing.entryTime;
    const newExitTime = exitTime ?? existing.exitTime;
    const newType = type ?? existing.type;

    if (newType === 'DESCANSO' || newType === 'VACACION' || newType === 'INCAPACIDAD' || newType === 'LICENCIA' || newType === 'FERIADO' || newType === 'PERMISO') {
      hours = 0;
    } else if (newEntryTime && newExitTime) {
      hours = calculateHours(newEntryTime, newExitTime);
    }

    const updated = await db.scheduleEntry.update({
      where: { id },
      data: {
        entryTime: newEntryTime,
        exitTime: newExitTime,
        hours: Math.round(hours * 100) / 100,
        type: newType,
        notes: notes !== undefined ? notes : existing.notes,
        isManual: true,
      },
      include: { staff: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating schedule entry:', error);
    return NextResponse.json({ error: 'Error updating schedule entry' }, { status: 500 });
  }
}
