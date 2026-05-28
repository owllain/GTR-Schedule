import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

function withVacationMetadata(type: string, description: string | undefined, vacationHours: unknown): string | null {
  const base = (description || '').trim();
  if (type !== 'VACACION') return base || null;
  const normalizedHours = Number(vacationHours) === 4 ? 4 : 8;
  const marker = `[VAC_HOURS:${normalizedHours}]`;
  return `${marker}${base ? ` ${base}` : ''}`;
}

// GET all novedades
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const year = searchParams.get('year');
    const month = searchParams.get('month');

    let where = {};
    if (year && month) {
      const startDate = `${year}-${month.padStart(2, '0')}-01`;
      const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();
      const endDate = `${year}-${month.padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      where = {
        OR: [
          { startDate: { gte: startDate, lte: endDate } },
          { endDate: { gte: startDate, lte: endDate } },
          { startDate: { lte: startDate }, endDate: { gte: endDate } },
        ],
      };
    }

    const novedades = await db.novedad.findMany({
      where,
      include: { staff: true },
      orderBy: [{ startDate: 'desc' }],
    });

    return NextResponse.json(novedades);
  } catch (error) {
    console.error('Error fetching novedades:', error);
    return NextResponse.json({ error: 'Error fetching novedades' }, { status: 500 });
  }
}

// POST create novedad
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { staffId, startDate, endDate, type, description, vacationHours } = body;

    if (!staffId || !startDate || !endDate || !type) {
      return NextResponse.json({ error: 'Staff, fecha inicio, fecha fin y tipo son requeridos' }, { status: 400 });
    }

    const novedad = await db.novedad.create({
      data: {
        staffId,
        startDate,
        endDate,
        type,
        description: withVacationMetadata(type, description, vacationHours),
      },
      include: { staff: true },
    });

    return NextResponse.json(novedad, { status: 201 });
  } catch (error) {
    console.error('Error creating novedad:', error);
    return NextResponse.json({ error: 'Error creating novedad' }, { status: 500 });
  }
}

// PUT update novedad
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    const novedad = await db.novedad.update({
      where: { id },
      data,
      include: { staff: true },
    });

    return NextResponse.json(novedad);
  } catch (error) {
    console.error('Error updating novedad:', error);
    return NextResponse.json({ error: 'Error updating novedad' }, { status: 500 });
  }
}

// DELETE novedad
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID es requerido' }, { status: 400 });
    }

    await db.novedad.delete({ where: { id } });

    return NextResponse.json({ message: 'Novedad eliminada' });
  } catch (error) {
    console.error('Error deleting novedad:', error);
    return NextResponse.json({ error: 'Error deleting novedad' }, { status: 500 });
  }
}
