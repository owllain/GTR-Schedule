// Schedule generation logic following Costa Rica labor law
// Standard: 48 hrs/week (Diurna)
// Weekend day (Sat or Sun) = 10 hours by default
// When working a weekend day: 10h weekend + 38h L-V = 7.6h/day (7h36m) L-V
// When NOT working weekends: 48h L-V = 9.6h/day (9h36m) L-V
// Rule: If works Saturday, doesn't work Sunday, and vice versa

export type FinDeSemanaType = 'MIXTO' | 'SABADO' | 'DOMINGO';
export type EntryType = 'NORMAL' | 'VACACION' | 'INCAPACIDAD' | 'LICENCIA' | 'PERMISO' | 'FERIADO' | 'DESCANSO';

export interface StaffInfo {
  id: string;
  nombre: string;
  apellido: string;
  finDeSemanaPreferente: FinDeSemanaType;
  proformaId: string | null;
  proformaEntries?: ProformaEntryInfo[];
}

export interface ProformaEntryInfo {
  diaSemana: number; // 0=Dom, 1=Lun, ..., 6=Sab
  horaEntrada: string;
  horaSalida: string;
  esDescanso: boolean;
}

export interface NovedadInfo {
  staffId: string;
  startDate: string;
  endDate: string;
  type: EntryType;
  description?: string;
}

export interface ScheduleEntryInput {
  staffId: string;
  date: string;
  entryTime: string;
  exitTime: string;
  hours: number;
  type: EntryType;
  notes?: string;
  isWeekend: boolean;
  isManual: boolean;
}

// Calculate hours between two time strings (HH:mm)
export function calculateHours(entryTime: string, exitTime: string): number {
  if (!entryTime || !exitTime) return 0;
  const [entryH, entryM] = entryTime.split(':').map(Number);
  const [exitH, exitM] = exitTime.split(':').map(Number);

  let entryMinutes = entryH * 60 + entryM;
  let exitMinutes = exitH * 60 + exitM;

  // Handle overnight shifts (e.g., 18:00 - 00:00)
  if (exitMinutes <= entryMinutes) {
    exitMinutes += 24 * 60;
  }

  return (exitMinutes - entryMinutes) / 60;
}

// Standard weekly hours target
export const WEEKLY_TARGET_HOURS = 48;

// Standard weekend hours
export const WEEKEND_DAY_HOURS = 10;

// Get the ISO week number for a date
export function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + 'T12:00:00');
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// Get the day of week (0=Sun, 1=Mon, ..., 6=Sat) for a date string
function getDayOfWeek(dateStr: string): number {
  const date = new Date(dateStr + 'T12:00:00');
  return date.getDay();
}

// Check if a date is a Costa Rica national holiday
function isCostaRicaHoliday(dateStr: string): boolean {
  const [year, month, day] = dateStr.split('-').map(Number);

  const fixedHolidays = [
    `${year}-01-01`, // Año Nuevo
    `${year}-04-11`, // Día de Juan Santamaría
    `${year}-05-01`, // Día del Trabajador
    `${year}-07-25`, // Anexión de Guanacaste
    `${year}-08-02`, // Día de la Virgen de los Ángeles
    `${year}-08-15`, // Día de la Madre
    `${year}-09-15`, // Día de la Independencia
    `${year}-12-25`, // Navidad
  ];

  return fixedHolidays.includes(dateStr);
}

// Check if a date falls within any novedad period
function getNovedadForDate(date: string, novedades: NovedadInfo[]): NovedadInfo | null {
  return novedades.find(n => date >= n.startDate && date <= n.endDate) || null;
}

// Default time calculations for the standard 48h work week
export function getDefaultTimes(worksWithWeekend: boolean) {
  if (!worksWithWeekend) {
    // No weekend work: L-V 8:00-17:36 (9h36m each, 48h total)
    return {
      weekday: { entry: '08:00', exit: '17:36' },
      weekend: { entry: '', exit: '' },
    };
  }

  // With weekend work: L-V 8:00-15:36 (7h36m each, 38h total) + weekend 8:00-18:00 (10h)
  return {
    weekday: { entry: '08:00', exit: '15:36' },
    weekend: { entry: '08:00', exit: '18:00' },
  };
}

// Generate weekend rotation assignments
// For SABADO: always work Saturdays, rest Sundays
// For DOMINGO: always work Sundays, rest Saturdays
// For MIXTO: work one weekend day per weekend, rotate for variety
export function generateWeekendRotation(
  staff: StaffInfo[],
  year: number,
  month: number,
  novedades: NovedadInfo[]
): Map<string, Set<string>> { // date -> Set of staff IDs working that date
  const rotation = new Map<string, Set<string>>();

  const daysInMonth = new Date(year, month, 0).getDate();

  // Collect all weekends (Saturday-Sunday pairs)
  const weekends: { saturday: string; sunday: string }[] = [];
  let currentSat: string | null = null;

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dow = getDayOfWeek(dateStr);
    if (dow === 6) {
      currentSat = dateStr;
    }
    if (dow === 0 && currentSat) {
      weekends.push({ saturday: currentSat, sunday: dateStr });
      currentSat = null;
    }
  }

  // Handle case where month starts with a Sunday (no preceding Saturday in same month)
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dow = getDayOfWeek(dateStr);
    if (dow === 0) {
      // Check if this Sunday is already paired
      if (!rotation.has(dateStr) && !weekends.some(w => w.sunday === dateStr)) {
        rotation.set(dateStr, new Set()); // Standalone Sunday
      }
    }
  }

  // Categorize staff
  const sabadoStaff = staff.filter(s => s.finDeSemanaPreferente === 'SABADO');
  const domingoStaff = staff.filter(s => s.finDeSemanaPreferente === 'DOMINGO');
  const mixtoStaff = staff.filter(s => s.finDeSemanaPreferente === 'MIXTO');

  // Track rotation for mixto staff
  const satCount = new Map<string, number>();
  const sunCount = new Map<string, number>();
  staff.forEach(s => { satCount.set(s.id, 0); sunCount.set(s.id, 0); });

  // Process each weekend pair
  for (const weekend of weekends) {
    const satWorkers = new Set<string>();
    const sunWorkers = new Set<string>();

    // SABADO-only staff always work Saturdays
    for (const s of sabadoStaff) {
      const novedad = getNovedadForDate(weekend.saturday, novedades.filter(n => n.staffId === s.id));
      if (!novedad) {
        satWorkers.add(s.id);
        satCount.set(s.id, (satCount.get(s.id) || 0) + 1);
      }
    }

    // DOMINGO-only staff always work Sundays
    for (const s of domingoStaff) {
      const novedad = getNovedadForDate(weekend.sunday, novedades.filter(n => n.staffId === s.id));
      if (!novedad) {
        sunWorkers.add(s.id);
        sunCount.set(s.id, (sunCount.get(s.id) || 0) + 1);
      }
    }

    // MIXTO staff: split between Saturday and Sunday for variety
    // Sort by: least total assignments first, then prefer opposite of what they did more
    const availableMixto = mixtoStaff.filter(s => {
      const satNov = getNovedadForDate(weekend.saturday, novedades.filter(n => n.staffId === s.id));
      const sunNov = getNovedadForDate(weekend.sunday, novedades.filter(n => n.staffId === s.id));
      return !satNov && !sunNov; // Available for the whole weekend
    });

    const sortedMixto = [...availableMixto].sort((a, b) => {
      const aTotal = (satCount.get(a.id) || 0) + (sunCount.get(a.id) || 0);
      const bTotal = (satCount.get(b.id) || 0) + (sunCount.get(b.id) || 0);
      if (aTotal !== bTotal) return aTotal - bTotal;
      // Prefer assigning to the day they've worked less
      const aDiff = (sunCount.get(a.id) || 0) - (satCount.get(a.id) || 0); // Positive = worked more sun
      const bDiff = (sunCount.get(b.id) || 0) - (satCount.get(b.id) || 0);
      return aDiff - bDiff; // Higher diff = prefer Saturday
    });

    // Alternate: first goes to Saturday, second to Sunday, etc.
    for (let i = 0; i < sortedMixto.length; i++) {
      const s = sortedMixto[i];
      if (i % 2 === 0) {
        // Assign to Saturday
        satWorkers.add(s.id);
        satCount.set(s.id, (satCount.get(s.id) || 0) + 1);
      } else {
        // Assign to Sunday
        sunWorkers.add(s.id);
        sunCount.set(s.id, (sunCount.get(s.id) || 0) + 1);
      }
    }

    rotation.set(weekend.saturday, satWorkers);
    rotation.set(weekend.sunday, sunWorkers);
  }

  return rotation;
}

// Main schedule generation function
export function generateSchedule(
  staff: StaffInfo[],
  year: number,
  month: number,
  novedades: NovedadInfo[],
  useBlankEntries: boolean = true
): ScheduleEntryInput[] {
  const entries: ScheduleEntryInput[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();

  // Generate weekend rotation
  const weekendRotation = generateWeekendRotation(staff, year, month, novedades);

  // Build a map of which weekend days each staff works
  const staffWeekendWork = new Map<string, Set<string>>(); // staffId -> Set of weekend dates they work
  for (const s of staff) {
    staffWeekendWork.set(s.id, new Set());
  }
  for (const [date, workingIds] of weekendRotation) {
    for (const staffId of workingIds) {
      staffWeekendWork.get(staffId)?.add(date);
    }
  }

  // Determine if each staff works ANY weekend day in this month
  const staffWorksWithWeekend = new Map<string, boolean>();
  for (const s of staff) {
    staffWorksWithWeekend.set(s.id, (staffWeekendWork.get(s.id)?.size || 0) > 0);
  }

  // Generate entries for each day
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dow = getDayOfWeek(dateStr);
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = isCostaRicaHoliday(dateStr);

    for (const s of staff) {
      // Check novedades first
      const novedad = getNovedadForDate(dateStr, novedades.filter(n => n.staffId === s.id));

      if (novedad) {
        entries.push({
          staffId: s.id,
          date: dateStr,
          entryTime: '',
          exitTime: '',
          hours: 0,
          type: novedad.type as EntryType,
          notes: novedad.description || undefined,
          isWeekend,
          isManual: false,
        });
        continue;
      }

      if (isHoliday) {
        entries.push({
          staffId: s.id,
          date: dateStr,
          entryTime: '',
          exitTime: '',
          hours: 0,
          type: 'FERIADO',
          notes: 'Feriado nacional',
          isWeekend,
          isManual: false,
        });
        continue;
      }

      if (isWeekend) {
        // Check if this staff is assigned to work this weekend day
        const isWorkingWeekend = staffWeekendWork.get(s.id)?.has(dateStr) || false;

        if (isWorkingWeekend) {
          // Check if staff has a proforma with times for this day
          const proformaEntry = s.proformaEntries?.find(pe => pe.diaSemana === dow);

          if (proformaEntry && !proformaEntry.esDescanso) {
            // Use proforma times
            const hours = calculateHours(proformaEntry.horaEntrada, proformaEntry.horaSalida);
            entries.push({
              staffId: s.id,
              date: dateStr,
              entryTime: proformaEntry.horaEntrada,
              exitTime: proformaEntry.horaSalida,
              hours,
              type: 'NORMAL',
              isWeekend: true,
              isManual: false,
            });
          } else if (!useBlankEntries) {
            // Default: weekend day = 10h (8:00-18:00)
            entries.push({
              staffId: s.id,
              date: dateStr,
              entryTime: '08:00',
              exitTime: '18:00',
              hours: WEEKEND_DAY_HOURS,
              type: 'NORMAL',
              isWeekend: true,
              isManual: false,
            });
          } else {
            // Blank entry - user will fill in
            entries.push({
              staffId: s.id,
              date: dateStr,
              entryTime: '',
              exitTime: '',
              hours: 0,
              type: 'NORMAL',
              isWeekend: true,
              isManual: false,
            });
          }
        } else {
          // Day off on weekend
          entries.push({
            staffId: s.id,
            date: dateStr,
            entryTime: '',
            exitTime: '',
            hours: 0,
            type: 'DESCANSO',
            isWeekend: true,
            isManual: false,
          });
        }
      } else {
        // Weekday
        // Check if staff has a proforma with times for this weekday
        const proformaEntry = s.proformaEntries?.find(pe => pe.diaSemana === dow);

        if (proformaEntry && proformaEntry.esDescanso) {
          entries.push({
            staffId: s.id,
            date: dateStr,
            entryTime: '',
            exitTime: '',
            hours: 0,
            type: 'DESCANSO',
            notes: 'Según proforma',
            isWeekend: false,
            isManual: false,
          });
        } else if (proformaEntry && !proformaEntry.esDescanso) {
          const hours = calculateHours(proformaEntry.horaEntrada, proformaEntry.horaSalida);
          entries.push({
            staffId: s.id,
            date: dateStr,
            entryTime: proformaEntry.horaEntrada,
            exitTime: proformaEntry.horaSalida,
            hours,
            type: 'NORMAL',
            isWeekend: false,
            isManual: false,
          });
        } else if (!useBlankEntries) {
          // Default: if works weekend → 8:00-15:36 (7h36m), else 8:00-17:36 (9h36m)
          const worksWeekend = staffWorksWithWeekend.get(s.id) || false;
          const defaultTimes = getDefaultTimes(worksWeekend);
          const hours = calculateHours(defaultTimes.weekday.entry, defaultTimes.weekday.exit);
          entries.push({
            staffId: s.id,
            date: dateStr,
            entryTime: defaultTimes.weekday.entry,
            exitTime: defaultTimes.weekday.exit,
            hours,
            type: 'NORMAL',
            isWeekend: false,
            isManual: false,
          });
        } else {
          // Blank entry - user will fill in
          entries.push({
            staffId: s.id,
            date: dateStr,
            entryTime: '',
            exitTime: '',
            hours: 0,
            type: 'NORMAL',
            isWeekend: false,
            isManual: false,
          });
        }
      }
    }
  }

  return entries;
}

// Apply a proforma to existing schedule entries
export function applyProformaToEntries(
  entries: ScheduleEntryInput[],
  proformaEntries: ProformaEntryInfo[],
  staffWorksWithWeekend: boolean
): ScheduleEntryInput[] {
  return entries.map(entry => {
    if (entry.type !== 'NORMAL' || entry.isManual) return entry;

    const dow = getDayOfWeek(entry.date);
    const proformaEntry = proformaEntries.find(pe => pe.diaSemana === dow);

    if (!proformaEntry) return entry;

    if (proformaEntry.esDescanso) {
      return { ...entry, entryTime: '', exitTime: '', hours: 0, type: 'DESCANSO' as EntryType, notes: 'Según proforma' };
    }

    const hours = calculateHours(proformaEntry.horaEntrada, proformaEntry.horaSalida);
    return {
      ...entry,
      entryTime: proformaEntry.horaEntrada,
      exitTime: proformaEntry.horaSalida,
      hours,
      type: 'NORMAL' as EntryType,
    };
  });
}
