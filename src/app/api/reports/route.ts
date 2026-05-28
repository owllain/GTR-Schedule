import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/reports?type=month&year=2025&month=5
// GET /api/reports?type=staff&staffId=xxx&startDate=2025-01-01&endDate=2025-12-31
// GET /api/reports?type=comparative&year=2025&month=5
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    if (type === 'month') {
      return handleMonthReport(searchParams);
    } else if (type === 'staff') {
      return handleStaffReport(searchParams);
    } else if (type === 'comparative') {
      return handleComparativeReport(searchParams);
    } else {
      return NextResponse.json({ error: 'type requerido: month | staff | comparative' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in reports API:', error);
    return NextResponse.json({ error: 'Error generando reporte' }, { status: 500 });
  }
}

// ── Reporte mensual: resumen por empleado en un mes ────────────
async function handleMonthReport(params: URLSearchParams) {
  const year = params.get('year');
  const month = params.get('month');
  if (!year || !month) {
    return NextResponse.json({ error: 'year y month son requeridos' }, { status: 400 });
  }

  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
  const endDate = `${year}-${month.padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const staffList = await db.staff.findMany({
    where: { activo: true },
    include: { proforma: true },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
  });

  const entries = await db.scheduleEntry.findMany({
    where: { date: { gte: startDate, lte: endDate } },
    orderBy: { date: 'asc' },
  });

  const typeLabels: Record<string, string> = {
    NORMAL: 'Normal',
    DESCANSO: 'Descanso',
    VACACION: 'Vacación',
    INCAPACIDAD: 'Incapacidad',
    LICENCIA: 'Licencia',
    PERMISO: 'Permiso',
    FERIADO: 'Feriado',
  };

  const staffReports = staffList.map((s) => {
    const myEntries = entries.filter((e) => e.staffId === s.id);

    const totalHours = myEntries.filter((e) => e.hours > 0).reduce((sum, e) => sum + e.hours, 0);
    const diasLaborados = myEntries.filter((e) => e.type === 'NORMAL' && e.hours > 0).length;
    const diasDescanso = myEntries.filter((e) => e.type === 'DESCANSO').length;
    const diasVacacion = myEntries.filter((e) => e.type === 'VACACION').length;
    const diasIncapacidad = myEntries.filter((e) => e.type === 'INCAPACIDAD').length;
    const diasLicencia = myEntries.filter((e) => e.type === 'LICENCIA').length;
    const diasPermiso = myEntries.filter((e) => e.type === 'PERMISO').length;
    const diasFeriado = myEntries.filter((e) => e.type === 'FERIADO').length;
    const diasManuales = myEntries.filter((e) => e.isManual).length;

    // Weekly breakdown
    const weekMap = new Map<number, { hours: number; dias: number }>();
    for (const entry of myEntries.filter((e) => e.hours > 0)) {
      const date = new Date(entry.date + 'T12:00:00');
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      if (!weekMap.has(weekNum)) weekMap.set(weekNum, { hours: 0, dias: 0 });
      weekMap.get(weekNum)!.hours += entry.hours;
      weekMap.get(weekNum)!.dias += 1;
    }

    const semanales = Array.from(weekMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([semana, data]) => ({
        semana,
        horas: Math.round(data.hours * 100) / 100,
        dias: data.dias,
        cumple: data.hours >= 46, // margen de 2h
      }));

    const semanasCumplen = semanales.filter((s) => s.cumple).length;

    return {
      id: s.id,
      nombre: `${s.nombre} ${s.apellido}`,
      proforma: s.proforma?.nombre ?? 'Sin proforma',
      finDeSemana: s.finDeSemanaPreferente,
      totalHoras: Math.round(totalHours * 100) / 100,
      diasLaborados,
      diasDescanso,
      diasVacacion,
      diasIncapacidad,
      diasLicencia,
      diasPermiso,
      diasFeriado,
      diasManuales,
      semanales,
      semanasCumplen,
      totalSemanas: semanales.length,
    };
  });

  return NextResponse.json({ year, month, daysInMonth, staffReports });
}

// ── Reporte por personal: historial en rango de fechas ────────
async function handleStaffReport(params: URLSearchParams) {
  const staffId = params.get('staffId');
  const startDate = params.get('startDate');
  const endDate = params.get('endDate');

  if (!staffId || !startDate || !endDate) {
    return NextResponse.json({ error: 'staffId, startDate y endDate son requeridos' }, { status: 400 });
  }

  const staff = await db.staff.findUnique({
    where: { id: staffId },
    include: { proforma: true },
  });

  if (!staff) {
    return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
  }

  const entries = await db.scheduleEntry.findMany({
    where: { staffId, date: { gte: startDate, lte: endDate } },
    orderBy: { date: 'asc' },
  });

  // Group by month
  const monthMap = new Map<string, { horas: number; laborados: number; descanso: number; novedades: number; manuales: number }>();
  for (const e of entries) {
    const ym = e.date.substring(0, 7); // YYYY-MM
    if (!monthMap.has(ym)) monthMap.set(ym, { horas: 0, laborados: 0, descanso: 0, novedades: 0, manuales: 0 });
    const m = monthMap.get(ym)!;
    m.horas += e.hours;
    if (e.type === 'NORMAL' && e.hours > 0) m.laborados += 1;
    if (e.type === 'DESCANSO') m.descanso += 1;
    if (e.type !== 'NORMAL' && e.type !== 'DESCANSO') m.novedades += 1;
    if (e.isManual) m.manuales += 1;
  }

  const porMes = Array.from(monthMap.entries())
    .sort()
    .map(([ym, data]) => ({
      mes: ym,
      horas: Math.round(data.horas * 100) / 100,
      laborados: data.laborados,
      descanso: data.descanso,
      novedades: data.novedades,
      manuales: data.manuales,
    }));

  const totalHoras = entries.filter((e) => e.hours > 0).reduce((sum, e) => sum + e.hours, 0);
  const totalLaborados = entries.filter((e) => e.type === 'NORMAL' && e.hours > 0).length;
  const totalNovedades = entries.filter((e) => e.type !== 'NORMAL' && e.type !== 'DESCANSO').length;

  // Day-by-day detail
  const detalle = entries.map((e) => ({
    fecha: e.date,
    entrada: e.entryTime,
    salida: e.exitTime,
    horas: e.hours,
    tipo: e.type,
    notas: e.notes,
    manual: e.isManual,
  }));

  return NextResponse.json({
    staff: {
      id: staff.id,
      nombre: `${staff.nombre} ${staff.apellido}`,
      proforma: staff.proforma?.nombre ?? 'Sin proforma',
      finDeSemana: staff.finDeSemanaPreferente,
    },
    startDate,
    endDate,
    totalHoras: Math.round(totalHoras * 100) / 100,
    totalLaborados,
    totalNovedades,
    porMes,
    detalle,
  });
}

// ── Reporte comparativo: semanas vs meta 48h ──────────────────
async function handleComparativeReport(params: URLSearchParams) {
  const year = params.get('year');
  const month = params.get('month');

  if (!year || !month) {
    return NextResponse.json({ error: 'year y month son requeridos' }, { status: 400 });
  }

  const startDate = `${year}-${month.padStart(2, '0')}-01`;
  const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
  const endDate = `${year}-${month.padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

  const staffList = await db.staff.findMany({
    where: { activo: true },
    include: { proforma: true },
    orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
  });

  const entries = await db.scheduleEntry.findMany({
    where: { date: { gte: startDate, lte: endDate } },
  });

  // Get all weeks in the month
  const weekSet = new Set<number>();
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${month.padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const date = new Date(dateStr + 'T12:00:00');
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    weekSet.add(weekNum);
  }
  const weeks = Array.from(weekSet).sort((a, b) => a - b);

  const comparative = staffList.map((s) => {
    const myEntries = entries.filter((e) => e.staffId === s.id);
    const totalHoras = myEntries.filter((e) => e.hours > 0).reduce((sum, e) => sum + e.hours, 0);

    const byWeek: Record<number, number> = {};
    for (const entry of myEntries.filter((e) => e.hours > 0)) {
      const date = new Date(entry.date + 'T12:00:00');
      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
      const dayNum = d.getUTCDay() || 7;
      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
      const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
      byWeek[weekNum] = (byWeek[weekNum] ?? 0) + entry.hours;
    }

    const weekData = weeks.map((w) => ({
      semana: w,
      horas: Math.round((byWeek[w] ?? 0) * 100) / 100,
      deficit: Math.max(0, 48 - (byWeek[w] ?? 0)),
      exceso: Math.max(0, (byWeek[w] ?? 0) - 48),
      cumple: (byWeek[w] ?? 0) >= 46,
    }));

    return {
      id: s.id,
      nombre: `${s.nombre} ${s.apellido}`,
      proforma: s.proforma?.nombre ?? 'Sin proforma',
      totalHoras: Math.round(totalHoras * 100) / 100,
      metaMensual: weeks.length * 48,
      cumplimiento: weeks.length > 0 ? Math.round((totalHoras / (weeks.length * 48)) * 100) : 0,
      weekData,
    };
  });

  return NextResponse.json({ year, month, weeks, comparative });
}
