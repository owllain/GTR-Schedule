import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET all proformas
export async function GET() {
  try {
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
