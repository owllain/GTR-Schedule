import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateSchedule, type StaffInfo, type NovedadInfo } from '@/lib/schedule-generator';

// POST generate schedule for a given month
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { year, month } = body;

    if (!year || !month) {
      return NextResponse.json({ error: 'Year and month are required' }, { status: 400 });
    }

    const yearNum = parseInt(year);
    const monthNum = parseInt(month);

    // Get all active staff
    const staffRecords = await db.staff.findMany({ where: { activo: true } });
    
    if (staffRecords.length === 0) {
      return NextResponse.json({ error: 'No hay personal activo registrado' }, { status: 400 });
    }

    // Get novedades for the month
    const startDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
    const endDate = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const novedadRecords = await db.novedad.findMany({
      where: {
        OR: [
          { startDate: { gte: startDate, lte: endDate } },
          { endDate: { gte: startDate, lte: endDate } },
          { startDate: { lte: startDate }, endDate: { gte: endDate } },
        ],
      },
    });

    const staffInfo: StaffInfo[] = staffRecords.map(s => ({
      id: s.id,
      nombre: s.nombre,
      apellido: s.apellido,
      jornadaPreferente: s.jornadaPreferente as StaffInfo['jornadaPreferente'],
      finDeSemanaPreferente: s.finDeSemanaPreferente as StaffInfo['finDeSemanaPreferente'],
      horaEntrada: s.horaEntrada,
      horaSalida: s.horaSalida,
      horaEntradaSabado: s.horaEntradaSabado,
      horaSalidaSabado: s.horaSalidaSabado,
      horaEntradaDomingo: s.horaEntradaDomingo,
      horaSalidaDomingo: s.horaSalidaDomingo,
    }));

    const novedadInfo: NovedadInfo[] = novedadRecords.map(n => ({
      staffId: n.staffId,
      startDate: n.startDate,
      endDate: n.endDate,
      type: n.type as NovedadInfo['type'],
      description: n.description || undefined,
    }));

    // Generate schedule entries
    const entries = generateSchedule(staffInfo, yearNum, monthNum, novedadInfo);

    // Delete existing entries for this month (regenerate)
    await db.scheduleEntry.deleteMany({
      where: {
        date: { gte: startDate, lte: endDate },
      },
    });

    // Insert new entries
    const created = await db.scheduleEntry.createMany({
      data: entries.map(e => ({
        staffId: e.staffId,
        date: e.date,
        entryTime: e.entryTime,
        exitTime: e.exitTime,
        hours: e.hours,
        type: e.type,
        notes: e.notes,
        isWeekend: e.isWeekend,
        isManual: e.isManual,
      })),
    });

    return NextResponse.json({ 
      message: `Horario generado exitosamente para ${yearNum}-${String(monthNum).padStart(2, '0')}`,
      entriesCreated: created.count,
    });
  } catch (error) {
    console.error('Error generating schedule:', error);
    return NextResponse.json({ error: 'Error generating schedule' }, { status: 500 });
  }
}
