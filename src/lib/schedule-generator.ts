// Schedule generation logic following Costa Rica labor law
// Diurna: 48 hrs/week, Mixta: 42 hrs/week, Nocturna: 36 hrs/week
// Key rule: Staff who work weekends get compensatory days off during the week

export type JornadaType = 'DIURNA' | 'MIXTA' | 'NOCTURNA';
export type FinDeSemanaType = 'MIXTO' | 'SABADO' | 'DOMINGO';
export type EntryType = 'NORMAL' | 'VACACION' | 'INCAPACIDAD' | 'LICENCIA' | 'PERMISO' | 'FERIADO' | 'DESCANSO';

export interface StaffInfo {
  id: string;
  nombre: string;
  apellido: string;
  jornadaPreferente: JornadaType;
  finDeSemanaPreferente: FinDeSemanaType;
  horaEntrada: string;
  horaSalida: string;
  horaEntradaSabado: string;
  horaSalidaSabado: string;
  horaEntradaDomingo: string;
  horaSalidaDomingo: string;
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

// Get the target weekly hours based on jornada type
export function getWeeklyTargetHours(jornada: JornadaType): number {
  switch (jornada) {
    case 'DIURNA': return 48;
    case 'MIXTA': return 42;
    case 'NOCTURNA': return 36;
    default: return 48;
  }
}

// Get default shift times for a jornada type
export function getDefaultShiftTimes(jornada: JornadaType) {
  switch (jornada) {
    case 'DIURNA':
      return { weekday: { entry: '08:00', exit: '17:36' }, saturday: { entry: '08:00', exit: '13:00' }, sunday: { entry: '08:00', exit: '18:00' } };
    case 'MIXTA':
      return { weekday: { entry: '08:00', exit: '16:48' }, saturday: { entry: '08:00', exit: '13:00' }, sunday: { entry: '08:00', exit: '18:00' } };
    case 'NOCTURNA':
      return { weekday: { entry: '18:00', exit: '00:00' }, saturday: { entry: '18:00', exit: '00:00' }, sunday: { entry: '18:00', exit: '00:00' } };
    default:
      return { weekday: { entry: '08:00', exit: '17:36' }, saturday: { entry: '08:00', exit: '13:00' }, sunday: { entry: '08:00', exit: '18:00' } };
  }
}

// Check if a date falls within any novedad period
function getNovedadForDate(date: string, novedades: NovedadInfo[]): NovedadInfo | null {
  return novedades.find(n => date >= n.startDate && date <= n.endDate) || null;
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

// Generate weekend rotation assignments
// The algorithm tries to alternate weekends for "mixto" staff
// and assign sabado/domingo only staff to their respective days
// It maximizes rotation to minimize repeats
export function generateWeekendRotation(
  staff: StaffInfo[],
  year: number,
  month: number,
  novedades: NovedadInfo[]
): Map<string, { staffWorking: string[]; isSaturday: boolean; isSunday: boolean }> {
  const rotation = new Map<string, { staffWorking: string[]; isSaturday: boolean; isSunday: boolean }>();
  
  // Get all Saturdays and Sundays in the month
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Collect all weekends (Saturday-Sunday pairs)
  const saturdays: string[] = [];
  const sundays: string[] = [];
  
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dow = getDayOfWeek(dateStr);
    if (dow === 6) saturdays.push(dateStr);
    if (dow === 0) sundays.push(dateStr);
  }
  
  // Categorize staff by weekend preference
  const mixtoStaff = staff.filter(s => s.finDeSemanaPreferente === 'MIXTO');
  const sabadoStaff = staff.filter(s => s.finDeSemanaPreferente === 'SABADO');
  const domingoStaff = staff.filter(s => s.finDeSemanaPreferente === 'DOMINGO');
  
  // Track how many times each staff has been assigned to each day type
  const satCount = new Map<string, number>();
  const sunCount = new Map<string, number>();
  staff.forEach(s => { satCount.set(s.id, 0); sunCount.set(s.id, 0); });
  
  // Track last assignment for variety
  const lastAssignment = new Map<string, 'saturday' | 'sunday' | null>();
  staff.forEach(s => lastAssignment.set(s.id, null));
  
  // Number of staff needed per weekend day
  // Typically 2-3 for Saturday, 1-2 for Sunday
  const totalStaff = staff.length;
  const satSlotsNeeded = Math.max(2, Math.min(4, Math.ceil(totalStaff * 0.3)));
  const sunSlotsNeeded = Math.max(1, Math.min(3, Math.ceil(totalStaff * 0.2)));
  
  // Assign staff to each Saturday
  for (const satDate of saturdays) {
    const workingStaff: string[] = [];
    
    // Assign SABADO-only staff first
    for (const s of sabadoStaff) {
      if (workingStaff.length >= satSlotsNeeded) break;
      const novedad = getNovedadForDate(satDate, novedades);
      if (!novedad) {
        workingStaff.push(s.id);
        satCount.set(s.id, (satCount.get(s.id) || 0) + 1);
        lastAssignment.set(s.id, 'saturday');
      }
    }
    
    // Fill remaining slots with mixto staff, rotating for variety
    const sortedMixto = [...mixtoStaff]
      .filter(s => !workingStaff.includes(s.id))
      .sort((a, b) => {
        const aTotal = (satCount.get(a.id) || 0) + (sunCount.get(a.id) || 0);
        const bTotal = (satCount.get(b.id) || 0) + (sunCount.get(b.id) || 0);
        if (aTotal !== bTotal) return aTotal - bTotal;
        // Prefer opposite of last assignment
        const aPreferSat = lastAssignment.get(a.id) === 'sunday' ? -1 : 1;
        const bPreferSat = lastAssignment.get(b.id) === 'sunday' ? -1 : 1;
        return aPreferSat - bPreferSat;
      });
    
    for (const s of sortedMixto) {
      if (workingStaff.length >= satSlotsNeeded) break;
      const novedad = getNovedadForDate(satDate, novedades);
      if (!novedad) {
        workingStaff.push(s.id);
        satCount.set(s.id, (satCount.get(s.id) || 0) + 1);
        lastAssignment.set(s.id, 'saturday');
      }
    }
    
    rotation.set(satDate, { staffWorking: workingStaff, isSaturday: true, isSunday: false });
  }
  
  // Assign staff to each Sunday
  for (const sunDate of sundays) {
    const workingStaff: string[] = [];
    
    // Assign DOMINGO-only staff first
    for (const s of domingoStaff) {
      if (workingStaff.length >= sunSlotsNeeded) break;
      const novedad = getNovedadForDate(sunDate, novedades);
      if (!novedad) {
        workingStaff.push(s.id);
        sunCount.set(s.id, (sunCount.get(s.id) || 0) + 1);
        lastAssignment.set(s.id, 'sunday');
      }
    }
    
    // Fill remaining slots with mixto staff
    const sortedMixto = [...mixtoStaff]
      .filter(s => !workingStaff.includes(s.id))
      .sort((a, b) => {
        const aTotal = (satCount.get(a.id) || 0) + (sunCount.get(a.id) || 0);
        const bTotal = (satCount.get(b.id) || 0) + (sunCount.get(b.id) || 0);
        if (aTotal !== bTotal) return aTotal - bTotal;
        const aPreferSun = lastAssignment.get(a.id) === 'saturday' ? -1 : 1;
        const bPreferSun = lastAssignment.get(b.id) === 'saturday' ? -1 : 1;
        return aPreferSun - bPreferSun;
      });
    
    for (const s of sortedMixto) {
      if (workingStaff.length >= sunSlotsNeeded) break;
      const novedad = getNovedadForDate(sunDate, novedades);
      if (!novedad) {
        workingStaff.push(s.id);
        sunCount.set(s.id, (sunCount.get(s.id) || 0) + 1);
        lastAssignment.set(s.id, 'sunday');
      }
    }
    
    rotation.set(sunDate, { staffWorking: workingStaff, isSaturday: false, isSunday: true });
  }
  
  return rotation;
}

// Main schedule generation function
export function generateSchedule(
  staff: StaffInfo[],
  year: number,
  month: number,
  novedades: NovedadInfo[]
): ScheduleEntryInput[] {
  const entries: ScheduleEntryInput[] = [];
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Generate weekend rotation
  const weekendRotation = generateWeekendRotation(staff, year, month, novedades);
  
  // Determine which weekdays each staff gets off as compensatory for weekend work
  // Rule: If you work Saturday, you get Friday off (same ISO week). 
  // If you work Sunday, you get Monday off (same ISO week).
  // For nocturna (Gerson), they work Mon-Sat by default (6 × 6h = 36h), Sunday off.
  
  // Build a set of (staffId, date) pairs where staff gets compensatory day off
  const compensatoryDays = new Map<string, Set<string>>(); // staffId -> Set of dates off
  
  for (const s of staff) {
    compensatoryDays.set(s.id, new Set());
  }
  
  // For each weekend assignment, assign a compensatory weekday off in the SAME week
  for (const [weekendDate, rotationData] of weekendRotation) {
    for (const staffId of rotationData.staffWorking) {
      const s = staff.find(st => st.id === staffId);
      if (!s) continue;
      
      // Nocturna staff don't need compensatory days (they work 6 days × 6h = 36h)
      if (s.jornadaPreferente === 'NOCTURNA') continue;
      
      const weekendDateObj = new Date(weekendDate + 'T12:00:00');
      const dow = weekendDateObj.getDay();
      
      // Find compensatory day in the SAME ISO week
      let compDate: Date;
      if (dow === 6) { // Saturday worked -> Friday off (day before, same week)
        compDate = new Date(weekendDateObj);
        compDate.setDate(compDate.getDate() - 1); // Friday
      } else { // Sunday worked -> Friday before off (same ISO week)
        compDate = new Date(weekendDateObj);
        compDate.setDate(compDate.getDate() - 2); // Friday
      }
      
      // Make sure compensatory day is still in the same month and is a weekday
      if (compDate.getMonth() + 1 === month && compDate.getFullYear() === year) {
        const compDow = compDate.getDay();
        if (compDow >= 1 && compDow <= 5) { // Mon-Fri
          const compStr = `${year}-${String(month).padStart(2, '0')}-${String(compDate.getDate()).padStart(2, '0')}`;
          compensatoryDays.get(staffId)?.add(compStr);
        }
      }
    }
  }
  
  // Now generate all entries
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dow = getDayOfWeek(dateStr);
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = isCostaRicaHoliday(dateStr);
    
    for (const s of staff) {
      // Check novedades first
      const novedad = getNovedadForDate(dateStr, novedades);
      
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
        // Check if this staff is assigned to work this weekend
        const rotationData = weekendRotation.get(dateStr);
        const isAssigned = rotationData?.staffWorking.includes(s.id) || false;
        
        if (isAssigned) {
          let entryTime: string;
          let exitTime: string;
          
          if (s.horaEntradaSabado && s.horaSalidaSabado && dow === 6) {
            entryTime = s.horaEntradaSabado;
            exitTime = s.horaSalidaSabado;
          } else if (s.horaEntradaDomingo && s.horaSalidaDomingo && dow === 0) {
            entryTime = s.horaEntradaDomingo;
            exitTime = s.horaSalidaDomingo;
          } else {
            const defaults = getDefaultShiftTimes(s.jornadaPreferente as JornadaType);
            const shift = dow === 6 ? defaults.saturday : defaults.sunday;
            entryTime = shift.entry;
            exitTime = shift.exit;
          }
          
          const hours = calculateHours(entryTime, exitTime);
          
          entries.push({
            staffId: s.id,
            date: dateStr,
            entryTime,
            exitTime,
            hours,
            type: 'NORMAL',
            isWeekend: true,
            isManual: false,
          });
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
        // Weekday - check if this is a compensatory day off
        const isCompensatory = compensatoryDays.get(s.id)?.has(dateStr) || false;
        
        if (isCompensatory) {
          entries.push({
            staffId: s.id,
            date: dateStr,
            entryTime: '',
            exitTime: '',
            hours: 0,
            type: 'DESCANSO',
            notes: 'Descanso compensatorio',
            isWeekend: false,
            isManual: false,
          });
        } else {
          // Normal weekday work
          const entryTime = s.horaEntrada;
          const exitTime = s.horaSalida;
          const hours = calculateHours(entryTime, exitTime);
          
          entries.push({
            staffId: s.id,
            date: dateStr,
            entryTime,
            exitTime,
            hours,
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
