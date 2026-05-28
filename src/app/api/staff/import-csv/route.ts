import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// POST import staff from CSV
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo CSV' }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(line => line.trim());

    if (lines.length === 0) {
      return NextResponse.json({ error: 'El archivo CSV está vacío' }, { status: 400 });
    }

    // Skip header row if it contains 'nombre' or 'Nombre'
    let startIndex = 0;
    const firstLine = lines[0].toLowerCase();
    if (firstLine.includes('nombre') || firstLine.includes('apellido')) {
      startIndex = 1;
    }

    const results = { created: 0, errors: 0, details: [] as string[] };

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parse CSV line (handle commas and basic quoting)
      const parts = parseCSVLine(line);

      if (parts.length < 2) {
        results.errors++;
        results.details.push(`Línea ${i + 1}: datos insuficientes`);
        continue;
      }

      const nombre = parts[0]?.trim();
      const apellido = parts[1]?.trim();
      const finDeSemana = parts[2]?.trim()?.toUpperCase() || 'MIXTO';
      const proformaNombre = parts[3]?.trim() || '';

      if (!nombre || !apellido) {
        results.errors++;
        results.details.push(`Línea ${i + 1}: nombre o apellido vacío`);
        continue;
      }

      // Validate finDeSemanaPreferente
      const validFinDeSemana = ['MIXTO', 'SABADO', 'DOMINGO'];
      const finDeSemanaPreferente = validFinDeSemana.includes(finDeSemana) ? finDeSemana : 'MIXTO';

      // Find proforma if specified
      let proformaId: string | null = null;
      if (proformaNombre) {
        const proforma = await db.proforma.findFirst({
          where: { nombre: { contains: proformaNombre, mode: 'insensitive' } },
        });
        if (proforma) {
          proformaId = proforma.id;
        }
      }

      try {
        await db.staff.create({
          data: {
            nombre,
            apellido,
            finDeSemanaPreferente,
            proformaId,
          },
        });
        results.created++;
      } catch (e) {
        results.errors++;
        results.details.push(`Línea ${i + 1}: error al crear ${nombre} ${apellido}`);
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Error importing CSV:', error);
    return NextResponse.json({ error: 'Error importing CSV' }, { status: 500 });
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
