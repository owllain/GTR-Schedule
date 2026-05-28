import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET all staff
export async function GET() {
  try {
    const staff = await db.staff.findMany({
      where: { activo: true },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      include: { proforma: { include: { entradas: true } } },
    });
    return NextResponse.json(staff);
  } catch (error) {
    console.error('Error fetching staff:', error);
    const message = error instanceof Error ? error.message : 'Error fetching staff';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// POST create new staff
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nombre, apellido, finDeSemanaPreferente, proformaId } = body;

    if (!nombre || !apellido) {
      return NextResponse.json({ error: 'Nombre y apellido son requeridos' }, { status: 400 });
    }

    const staff = await db.staff.create({
      data: {
        nombre,
        apellido,
        finDeSemanaPreferente: finDeSemanaPreferente || 'MIXTO',
        proformaId: (proformaId && proformaId !== 'NONE') ? proformaId : null,
      },
      include: { proforma: { include: { entradas: true } } },
    });

    return NextResponse.json(staff, { status: 201 });
  } catch (error) {
    console.error('Error creating staff:', error);
    const message = error instanceof Error ? error.message : 'Error creating staff';
    return NextResponse.json({ error: message }, { status: 500 });
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

    // Handle proformaId "NONE" -> null
    if (data.proformaId === 'NONE' || data.proformaId === '') {
      data.proformaId = null;
    }

    const staff = await db.staff.update({
      where: { id },
      data,
      include: { proforma: { include: { entradas: true } } },
    });

    return NextResponse.json(staff);
  } catch (error) {
    console.error('Error updating staff:', error);
    const message = error instanceof Error ? error.message : 'Error updating staff';
    return NextResponse.json({ error: message }, { status: 500 });
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
    const message = error instanceof Error ? error.message : 'Error deleting staff';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
