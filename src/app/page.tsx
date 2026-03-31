"use client";

import { useEffect, useMemo, useState } from "react";

type Booking = {
  id: string;
  guestName: string;
  email: string;
  checkIn: string;
  checkOut: string;
  notes: string;
  rating?: number;
};

function ymd(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function inRange(day: string, start: string, end: string) {
  return day >= start && day < end;
}

function renderStars(rating?: number) {
  const value = Math.max(1, Math.min(5, Number(rating || 5)));
  return "★".repeat(value) + "☆".repeat(5 - value);
}

export default function Home() {
  const [month, setMonth] = useState(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [form, setForm] = useState({
    guestName: "",
    email: "",
    checkIn: "",
    checkOut: "",
    notes: "",
    rating: 5,
  });
  const [message, setMessage] = useState("");

  const [modalDate, setModalDate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    guestName: "",
    email: "",
    checkIn: "",
    checkOut: "",
    notes: "",
    rating: 5,
  });

  async function loadBookings() {
    const r = await fetch("/api/bookings", { cache: "no-store" });
    if (!r.ok) return;
    const data = await r.json();
    setBookings(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    loadBookings();
  }, []);

  const days = useMemo(() => {
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const out: Date[] = [];
    const firstWeekday = (start.getDay() + 6) % 7;
    for (let i = 0; i < firstWeekday; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() - (firstWeekday - i));
      out.push(d);
    }
    for (let d = 1; d <= end.getDate(); d++) out.push(new Date(month.getFullYear(), month.getMonth(), d));
    while (out.length % 7 !== 0) {
      const d = new Date(out[out.length - 1]);
      d.setDate(d.getDate() + 1);
      out.push(d);
    }
    return out;
  }, [month]);

  const sorted = useMemo(() => [...bookings].sort((a, b) => a.checkIn.localeCompare(b.checkIn)), [bookings]);

  const modalBookings = useMemo(() => {
    if (!modalDate) return [];
    return sorted.filter((b) => inRange(modalDate, b.checkIn, b.checkOut));
  }, [modalDate, sorted]);

  async function createBooking(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    if (!form.guestName || !form.email || !form.checkIn || !form.checkOut) {
      setMessage("Completa todos los campos obligatorios.");
      return;
    }
    if (form.checkOut <= form.checkIn) {
      setMessage("La salida debe ser posterior a la entrada.");
      return;
    }
    const r = await fetch("/api/bookings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await r.json();
    if (!r.ok) {
      setMessage(data?.error || "No se pudo crear la reserva");
      return;
    }

    await loadBookings();
    setForm({ guestName: "", email: "", checkIn: "", checkOut: "", notes: "", rating: 5 });
    setMessage("Reserva creada correctamente ✅");
  }

  function startEdit(b: Booking) {
    setEditingId(b.id);
    setEditForm({
      guestName: b.guestName,
      email: b.email,
      checkIn: b.checkIn,
      checkOut: b.checkOut,
      notes: b.notes || "",
      rating: b.rating || 5,
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    const r = await fetch("/api/bookings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: editingId, ...editForm }),
    });
    if (!r.ok) return;
    await loadBookings();
    setEditingId(null);
  }

  async function removeBooking(id: string) {
    await fetch(`/api/bookings?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadBookings();
    if (editingId === id) setEditingId(null);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-10">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6">
          <h1 className="text-3xl font-semibold">Casa de Vera · Reservas</h1>
          <p className="text-zinc-400 mt-1">Gestiona estancias para dormir con calendario visual.</p>
        </header>

        <section className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="flex items-center justify-between mb-4">
              <button className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>←</button>
              <h2 className="text-xl font-medium capitalize">
                {month.toLocaleDateString("es-ES", { month: "long", year: "numeric" })}
              </h2>
              <button className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>→</button>
            </div>

            <div className="grid grid-cols-7 gap-2 text-center text-xs text-zinc-400 mb-2">
              {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((d) => <div key={d}>{d}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((d) => {
                const key = ymd(d);
                const inCurrent = d.getMonth() === month.getMonth();
                const reserved = bookings.filter((b) => inRange(key, b.checkIn, b.checkOut));
                const clickable = reserved.length > 0;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => clickable && (setModalDate(key), setEditingId(null))}
                    className={`rounded-xl border p-2 min-h-24 text-left ${inCurrent ? "border-zinc-700 bg-zinc-900" : "border-zinc-800 bg-zinc-950 text-zinc-600"} ${clickable ? "cursor-pointer hover:border-indigo-500" : "cursor-default"}`}
                  >
                    <div className="text-sm mb-1">{d.getDate()}</div>
                    <div className="space-y-1">
                      {reserved.slice(0, 2).map((r) => (
                        <div key={r.id} className="text-[11px] px-2 py-1 rounded bg-emerald-700/70 truncate">{r.guestName}</div>
                      ))}
                      {reserved.length > 2 && <div className="text-[11px] text-zinc-400">+{reserved.length - 2} más</div>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <form onSubmit={createBooking} className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3">
            <h3 className="text-lg font-medium">Nueva reserva</h3>
            <input className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2" placeholder="Nombre" value={form.guestName} onChange={(e) => setForm({ ...form, guestName: e.target.value })} />
            <input className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2" type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <input className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2" type="date" value={form.checkIn} onChange={(e) => setForm({ ...form, checkIn: e.target.value })} />
              <input className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2" type="date" value={form.checkOut} onChange={(e) => setForm({ ...form, checkOut: e.target.value })} />
            </div>
            <select className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2" value={form.rating} onChange={(e) => setForm({ ...form, rating: Number(e.target.value) })}>
              {[5,4,3,2,1].map((n) => <option key={n} value={n}>{renderStars(n)} ({n}/5)</option>)}
            </select>

            <textarea className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 min-h-20" placeholder="Notas" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 py-2 font-medium">Guardar reserva</button>
            {message && <p className="text-sm text-zinc-300">{message}</p>}
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
          <h3 className="text-lg font-medium mb-3">Próximas reservas</h3>
          <div className="space-y-2">
            {sorted.length === 0 ? (
              <p className="text-zinc-400">No hay reservas todavía.</p>
            ) : (
              sorted.map((b) => (
                <div key={b.id} className="rounded-xl border border-zinc-700 p-3 flex flex-wrap justify-between gap-2">
                  <div>
                    <p className="font-medium">{b.guestName}</p>
                    <p className="text-sm text-zinc-400">{b.email} · 1 huésped</p>
                    <p className="text-sm text-amber-300">{renderStars(b.rating)}</p>
                  </div>
                  <p className="text-sm text-zinc-300">{b.checkIn} → {b.checkOut}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {modalDate && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-zinc-700 bg-zinc-900 p-4 space-y-4 max-h-[90vh] overflow-auto">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Reservas del día {modalDate}</h3>
              <button className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700" onClick={() => { setModalDate(null); setEditingId(null); }}>Cerrar</button>
            </div>

            {modalBookings.length === 0 ? (
              <p className="text-zinc-400">No hay reservas activas este día.</p>
            ) : (
              <div className="space-y-3">
                {modalBookings.map((b) => (
                  <div key={b.id} className="rounded-xl border border-zinc-700 p-3 space-y-2">
                    {editingId === b.id ? (
                      <form onSubmit={saveEdit} className="space-y-2">
                        <input className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2" value={editForm.guestName} onChange={(e) => setEditForm({ ...editForm, guestName: e.target.value })} />
                        <input className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2" type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                        <div className="grid grid-cols-2 gap-2">
                          <input className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2" type="date" value={editForm.checkIn} onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })} />
                          <input className="rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2" type="date" value={editForm.checkOut} onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })} />
                        </div>
                        <select className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2" value={editForm.rating} onChange={(e) => setEditForm({ ...editForm, rating: Number(e.target.value) })}>
                          {[5,4,3,2,1].map((n) => <option key={n} value={n}>{renderStars(n)} ({n}/5)</option>)}
                        </select>
                        <textarea className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 min-h-20" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
                        <div className="flex gap-2 justify-end">
                          <button type="button" className="px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700" onClick={() => setEditingId(null)}>Cancelar</button>
                          <button className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500">Guardar cambios</button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="font-medium">{b.guestName}</p>
                        <p className="text-sm text-zinc-400">{b.email}</p>
                        <p className="text-sm text-amber-300">{renderStars(b.rating)}</p>
                        <p className="text-sm text-zinc-300">{b.checkIn} → {b.checkOut}</p>
                        {b.notes && <p className="text-sm text-zinc-400">{b.notes}</p>}
                        <div className="flex gap-2 justify-end">
                          <button className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500" onClick={() => startEdit(b)}>Editar</button>
                          <button className="px-3 py-2 rounded-lg bg-rose-700 hover:bg-rose-600" onClick={() => removeBooking(b.id)}>Borrar</button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
