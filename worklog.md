---
Task ID: 1
Agent: Main Agent
Task: Complete rewrite of Gestor de Horarios - STAFF application

Work Log:
- Updated Prisma schema: removed jornadaPreferente and time fields from Staff, added Proforma and ProformaEntry models
- Rewrote schedule-generator.ts with new logic: 48h/week standard, 10h weekend days, 7.6h L-V when weekend worked
- Updated Staff API: simplified (nombre, apellido, finDeSemanaPreferente, proformaId), added "NONE" handling for proformaId
- Created CSV import API at /api/staff/import-csv (supports nombre, apellido, finDeSemana, proforma columns)
- Created Proformas API at /api/proformas with full CRUD and ProformaEntry management
- Updated Schedule generate API: supports useBlankEntries flag, integrates proformas
- Updated Schedule API: simplified weekly target to 48h (no jornada types)
- Enhanced Excel export: modern teal color palette, alternating staff column colors, weekend color coding (blue=Sat, red=Sun), credit row for Alvaro
- Updated branding: "Gestor de Horarios - STAFF" title, "Desarrollado por Alvaro Enrique Cascante Moraga acascantem@netcom.com.pa" in footer/credits
- Rewrote page.tsx: 4 tabs (Horarios, Personal, Proformas, Novedades), modern UI with teal gradient header
- Rewrote staff-manager.tsx: simplified form (no schedule fields), CSV import button, proforma assignment, avatar initials
- Rewrote schedule-dashboard.tsx: proforma bulk apply, "Generar con Horas" button, quick fill buttons in edit dialog, blank entry support
- Created proformas-manager.tsx: card-based layout, weekly schedule grid editor, quick-load default templates, hour calculation badge
- Updated novedades-manager.tsx: consistent modern styling
- Updated layout.tsx: Spanish language, new metadata
- Seeded 5 default proformas: Estándar 48h, Con Sábado, Con Domingo, L-M 8-6/J-V 9-6, L-M 9-4/Mi-V 8-4
- Cleared all test staff data (no defaults)
- Fixed dev script to remove `tee` pipe that was causing server crashes
- All lint checks pass

Stage Summary:
- Complete application rewrite with new branding "Gestor de Horarios - STAFF"
- Staff model simplified: nombre, apellido, finDeSemanaPreferente, proformaId
- Schedule generation: blank mode (default) or with auto-calculated hours
- Weekend rotation: SABADO=only Sat, DOMINGO=only Sun, MIXTO=alternates
- Proformas system: 5 default templates, custom creation, bulk apply to schedules
- CSV import for staff
- Enhanced Excel export with modern colors and credit line
- No default staff data (clean start)
