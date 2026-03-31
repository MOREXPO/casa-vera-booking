import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

const FILE = path.join(process.cwd(), "data", "bookings.json");

type Booking = {
  id: string;
  guestName: string;
  email: string;
  checkIn: string;
  checkOut: string;
  notes: string;
  rating: number;
};

async function readBookings(): Promise<Booking[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeBookings(bookings: Booking[]) {
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(bookings, null, 2), "utf8");
}

export async function GET() {
  const bookings = await readBookings();
  return NextResponse.json(bookings);
}

export async function POST(request: Request) {
  const body = await request.json();
  const bookings = await readBookings();

  const rating = Math.max(1, Math.min(5, Number(body.rating || 5)));
  const entry: Booking = {
    id: crypto.randomUUID(),
    guestName: String(body.guestName || "").trim(),
    email: String(body.email || "").trim().toLowerCase(),
    checkIn: String(body.checkIn || ""),
    checkOut: String(body.checkOut || ""),
    notes: String(body.notes || "").trim(),
    rating,
  };

  if (!entry.guestName || !entry.email || !entry.checkIn || !entry.checkOut) {
    return NextResponse.json({ ok: false, error: "Campos obligatorios incompletos" }, { status: 400 });
  }
  if (entry.checkOut <= entry.checkIn) {
    return NextResponse.json({ ok: false, error: "Rango de fechas inválido" }, { status: 400 });
  }

  const overlap = bookings.some((b) => entry.checkIn < b.checkOut && entry.checkOut > b.checkIn);
  if (overlap) {
    return NextResponse.json({ ok: false, error: "Ese rango ya está reservado" }, { status: 409 });
  }

  const next = [entry, ...bookings];
  await writeBookings(next);
  return NextResponse.json({ ok: true, booking: entry });
}

export async function PATCH(request: Request) {
  const body = await request.json();
  const bookings = await readBookings();
  const id = String(body.id || "");
  if (!id) return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });

  const idx = bookings.findIndex((b) => b.id === id);
  if (idx === -1) return NextResponse.json({ ok: false, error: "No encontrada" }, { status: 404 });

  const updated: Booking = {
    ...bookings[idx],
    guestName: String(body.guestName ?? bookings[idx].guestName).trim(),
    email: String(body.email ?? bookings[idx].email).trim().toLowerCase(),
    checkIn: String(body.checkIn ?? bookings[idx].checkIn),
    checkOut: String(body.checkOut ?? bookings[idx].checkOut),
    notes: String(body.notes ?? bookings[idx].notes).trim(),
    rating: Math.max(1, Math.min(5, Number(body.rating ?? bookings[idx].rating ?? 5))),
  };

  if (!updated.guestName || !updated.email || !updated.checkIn || !updated.checkOut) {
    return NextResponse.json({ ok: false, error: "Campos obligatorios incompletos" }, { status: 400 });
  }
  if (updated.checkOut <= updated.checkIn) {
    return NextResponse.json({ ok: false, error: "Rango de fechas inválido" }, { status: 400 });
  }

  const overlap = bookings.some((b) => b.id !== id && updated.checkIn < b.checkOut && updated.checkOut > b.checkIn);
  if (overlap) {
    return NextResponse.json({ ok: false, error: "Ese rango ya está reservado" }, { status: 409 });
  }

  bookings[idx] = updated;
  await writeBookings(bookings);
  return NextResponse.json({ ok: true, booking: updated });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = String(searchParams.get("id") || "");
  if (!id) return NextResponse.json({ ok: false, error: "id requerido" }, { status: 400 });

  const bookings = await readBookings();
  const next = bookings.filter((b) => b.id !== id);
  await writeBookings(next);
  return NextResponse.json({ ok: true });
}
