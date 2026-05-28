import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const defaultProformas = [
  {
    nombre: 'Estándar 48h (sin fin de semana)',
    descripcion: 'L-V 8:00-17:36, S-D descanso. Total: 48h',
    entradas: [
      { diaSemana: 0, horaEntrada: '', horaSalida: '', esDescanso: true },
      { diaSemana: 1, horaEntrada: '08:00', horaSalida: '17:36', esDescanso: false },
      { diaSemana: 2, horaEntrada: '08:00', horaSalida: '17:36', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '17:36', esDescanso: false },
      { diaSemana: 4, horaEntrada: '08:00', horaSalida: '17:36', esDescanso: false },
      { diaSemana: 5, horaEntrada: '08:00', horaSalida: '17:36', esDescanso: false },
      { diaSemana: 6, horaEntrada: '', horaSalida: '', esDescanso: true },
    ],
  },
  {
    nombre: 'Con Sábado (48h)',
    descripcion: 'L-V 8:00-15:36, S 8:00-18:00, D descanso. Total: 48h',
    entradas: [
      { diaSemana: 0, horaEntrada: '', horaSalida: '', esDescanso: true },
      { diaSemana: 1, horaEntrada: '08:00', horaSalida: '15:36', esDescanso: false },
      { diaSemana: 2, horaEntrada: '08:00', horaSalida: '15:36', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '15:36', esDescanso: false },
      { diaSemana: 4, horaEntrada: '08:00', horaSalida: '15:36', esDescanso: false },
      { diaSemana: 5, horaEntrada: '08:00', horaSalida: '15:36', esDescanso: false },
      { diaSemana: 6, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
    ],
  },
  {
    nombre: 'Con Domingo (48h)',
    descripcion: 'L-V 8:00-15:36, S descanso, D 8:00-18:00. Total: 48h',
    entradas: [
      { diaSemana: 0, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 1, horaEntrada: '08:00', horaSalida: '15:36', esDescanso: false },
      { diaSemana: 2, horaEntrada: '08:00', horaSalida: '15:36', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '15:36', esDescanso: false },
      { diaSemana: 4, horaEntrada: '08:00', horaSalida: '15:36', esDescanso: false },
      { diaSemana: 5, horaEntrada: '08:00', horaSalida: '15:36', esDescanso: false },
      { diaSemana: 6, horaEntrada: '', horaSalida: '', esDescanso: true },
    ],
  },
  {
    nombre: 'Domingo regular',
    descripcion: 'L a Mié 8:00-16:00, J-V 9:00-16:00, D 8:00-18:00.',
    entradas: [
      { diaSemana: 0, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 1, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 2, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 4, horaEntrada: '09:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 5, horaEntrada: '09:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 6, horaEntrada: '', horaSalida: '', esDescanso: true },
    ],
  },
  {
    nombre: 'Sábado regular',
    descripcion: 'L-V 8:00-16:00, S 8:00-18:00, D descanso.',
    entradas: [
      { diaSemana: 0, horaEntrada: '', horaSalida: '', esDescanso: true },
      { diaSemana: 1, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 2, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 4, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 5, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 6, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
    ],
  },
  {
    nombre: 'Domingo regular (versión 2)',
    descripcion: 'L-M 9:00-16:00, Mi-V 8:00-16:00, D 8:00-18:00.',
    entradas: [
      { diaSemana: 0, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 1, horaEntrada: '09:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 2, horaEntrada: '09:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 4, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 5, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 6, horaEntrada: '', horaSalida: '', esDescanso: true },
    ],
  },
  {
    nombre: 'Sábado regular (versión 2)',
    descripcion: 'L-V 8:00-16:00, S 8:00-18:00, D libre.',
    entradas: [
      { diaSemana: 0, horaEntrada: '', horaSalida: '', esDescanso: true },
      { diaSemana: 1, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 2, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 4, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 5, horaEntrada: '08:00', horaSalida: '16:00', esDescanso: false },
      { diaSemana: 6, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
    ],
  },
  {
    nombre: 'Estandar 48h (8 a 18)',
    descripcion: 'L-Mi 8:00-18:00, J-V 9:00-18:00, S-D descanso.',
    entradas: [
      { diaSemana: 0, horaEntrada: '', horaSalida: '', esDescanso: true },
      { diaSemana: 1, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 2, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 4, horaEntrada: '09:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 5, horaEntrada: '09:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 6, horaEntrada: '', horaSalida: '', esDescanso: true },
    ],
  },
  {
    nombre: 'Estandar 48h (L-M 9 a 18)',
    descripcion: 'L-M 9:00-18:00, Mi-V 8:00-18:00, S-D descanso.',
    entradas: [
      { diaSemana: 0, horaEntrada: '', horaSalida: '', esDescanso: true },
      { diaSemana: 1, horaEntrada: '09:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 2, horaEntrada: '09:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 3, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 4, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 5, horaEntrada: '08:00', horaSalida: '18:00', esDescanso: false },
      { diaSemana: 6, horaEntrada: '', horaSalida: '', esDescanso: true },
    ],
  },
  {
    nombre: 'Nocturno con sábado laborado',
    descripcion: 'L-V 18:00-00:00, S 18:00-00:00, D descanso.',
    entradas: [
      { diaSemana: 0, horaEntrada: '', horaSalida: '', esDescanso: true },
      { diaSemana: 1, horaEntrada: '18:00', horaSalida: '00:00', esDescanso: false },
      { diaSemana: 2, horaEntrada: '18:00', horaSalida: '00:00', esDescanso: false },
      { diaSemana: 3, horaEntrada: '18:00', horaSalida: '00:00', esDescanso: false },
      { diaSemana: 4, horaEntrada: '18:00', horaSalida: '00:00', esDescanso: false },
      { diaSemana: 5, horaEntrada: '18:00', horaSalida: '00:00', esDescanso: false },
      { diaSemana: 6, horaEntrada: '18:00', horaSalida: '00:00', esDescanso: false },
    ],
  },
];

async function seedDefaultProformas() {
  const count = await db.proforma.count();
  if (count > 0) return;

  await db.$transaction(
    defaultProformas.map(proforma =>
      db.proforma.create({
        data: {
          nombre: proforma.nombre,
          descripcion: proforma.descripcion,
          entradas: {
            create: proforma.entradas.map(entry => ({
              diaSemana: entry.diaSemana,
              horaEntrada: entry.esDescanso ? '' : entry.horaEntrada,
              horaSalida: entry.esDescanso ? '' : entry.horaSalida,
              esDescanso: entry.esDescanso,
            })),
          },
        },
      })
    )
  );
}

// GET all proformas
export async function GET() {
  try {
    await seedDefaultProformas();
    const proformas = await db.proforma.findMany({
      include: { entradas: { orderBy: { diaSemana: 'asc' } }, _count: { select: { staff: true } } },
      orderBy: { nombre: 'asc' },
    });
    return NextResponse.json(proformas);
  } catch (error) {
    console.error('Error fetching proformas:', error);
    return NextResponse.json({ error: 'Error fetching proformas' }, { status: 500 });
  }
}

// POST create new proforma
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nombre, descripcion, entradas } = body;

    if (!nombre) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    if (!entradas || !Array.isArray(entradas) || entradas.length === 0) {
      return NextResponse.json({ error: 'Debe incluir al menos una entrada de horario' }, { status: 400 });
    }

    const proforma = await db.proforma.create({
      data: {
        nombre,
        descripcion: descripcion || null,
        entradas: {
          create: entradas.map((e: { diaSemana: number; horaEntrada: string; horaSalida: string; esDescanso: boolean }) => ({
            diaSemana: e.diaSemana,
            horaEntrada: e.esDescanso ? '' : e.horaEntrada,
            horaSalida: e.esDescanso ? '' : e.horaSalida,
            esDescanso: e.esDescanso,
          })),
        },
      },
      include: { entradas: { orderBy: { diaSemana: 'asc' } } },
    });

    return NextResponse.json(proforma, { status: 201 });
  } catch (error) {
    console.error('Error creating proforma:', error);
    return NextResponse.json({ error: 'Error creating proforma' }, { status: 500 });
  }
}

// PUT update proforma
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, nombre, descripcion, entradas } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    // Delete existing entries and recreate
    if (entradas && Array.isArray(entradas)) {
      await db.proformaEntry.deleteMany({ where: { proformaId: id } });

      await db.proforma.update({
        where: { id },
        data: {
          nombre: nombre || undefined,
          descripcion: descripcion !== undefined ? descripcion : undefined,
          entradas: {
            create: entradas.map((e: { diaSemana: number; horaEntrada: string; horaSalida: string; esDescanso: boolean }) => ({
              diaSemana: e.diaSemana,
              horaEntrada: e.esDescanso ? '' : e.horaEntrada,
              horaSalida: e.esDescanso ? '' : e.horaSalida,
              esDescanso: e.esDescanso,
            })),
          },
        },
      });
    } else {
      await db.proforma.update({
        where: { id },
        data: { nombre: nombre || undefined, descripcion: descripcion !== undefined ? descripcion : undefined },
      });
    }

    const updated = await db.proforma.findUnique({
      where: { id },
      include: { entradas: { orderBy: { diaSemana: 'asc' } }, _count: { select: { staff: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating proforma:', error);
    return NextResponse.json({ error: 'Error updating proforma' }, { status: 500 });
  }
}

// DELETE proforma
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    // Remove proforma reference from staff
    await db.staff.updateMany({
      where: { proformaId: id },
      data: { proformaId: null },
    });

    await db.proforma.delete({ where: { id } });

    return NextResponse.json({ message: 'Proforma eliminada' });
  } catch (error) {
    console.error('Error deleting proforma:', error);
    return NextResponse.json({ error: 'Error deleting proforma' }, { status: 500 });
  }
}
