import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET all staff
export async function GET() {
  try {
    const staff = await db.staff.findMany({
      where: { activo: true },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
    });
    return NextResponse.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    return NextResponse.json({ error: 'Error fetching staff' }, { status: 500 });
  }
}

// POST create new staff
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nombre, apellido, jornadaPreferente, finDeSemanaPreferente, horaEntrada, horaSalida, horaEntradaSabado, horaSalidaSabado, horaEntradaDomingo, horaSalidaDomingo } = body;

    if (!nombre || !apellido) {
      return NextResponse.json({ error: 'Nombre y apellido son requeridos' }, { status: 400 });
    }

    // Set default times based on jornada if not provided
    let defaults = { entry: '08:00', exit: '17:00', satEntry: '08:00', satExit: '13:00', sunEntry: '08:00', sunExit: '18:00' };
    if (jornadaPreferente === 'NOCTURNA') {
      defaults = { entry: '18:00', exit: '00:00', satEntry: '18:00', satExit: '00:00', sunEntry: '18:00', sunExit: '00:00' };
    } else if (jornadaPreferente === 'MIXTA') {
      defaults = { entry: '08:00', exit: '17:36', satEntry: '08:00', satExit: '13:00', sunEntry: '08:00', sunExit: '18:00' };
    }

    const staff = await db.staff.create({
      data: {
        nombre,
        apellido,
        jornadaPreferente: jornadaPreferente || 'DIURNA',
        finDeSemanaPreferente: finDeSemanaPreferente || 'MIXTO',
        horaEntrada: horaEntrada || defaults.entry,
        horaSalida: horaSalida || defaults.exit,
        horaEntradaSabado: horaEntradaSabado || defaults.satEntry,
        horaSalidaSabado: horaSalidaSabado || defaults.satExit,
        horaEntradaDomingo: horaEntradaDomingo || defaults.sunEntry,
        horaSalidaDomingo: horaSalidaDomingo || defaults.sunExit,
      },
    });

    return NextResponse.json(staff, { status: 201 });
  } catch (error) {
    console.error('Error creating staff:', error);
    return NextResponse.json({ error: 'Error creating staff' }, { status: 500 });
  }
}

// PUT update staff
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const staff = await db.staff.update({
      where: { id },
      data,
    });

    return NextResponse.json(staff);
  } catch (error) {
    console.error('Error updating staff:', error);
    return NextResponse.json({ error: 'Error updating staff' }, { status: 500 });
  }
}

// DELETE staff (soft delete)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const staff = await db.staff.update({
      where: { id },
      data: { activo: false },
    });

    return NextResponse.json(staff);
  } catch (error) {
    console.error('Error deleting staff:', error);
    return NextResponse.json({ error: 'Error deleting staff' }, { status: 500 });
  }
}
