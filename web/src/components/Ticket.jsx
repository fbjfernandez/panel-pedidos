export default function Ticket({ order, size }) {
  return <section className="ticket-sheet font-mono text-black" style={{ width: `${size}mm` }}>
    <h2 className="text-center text-base font-black uppercase">Despacho</h2>
    <p className="text-center text-xs">#{order.id.slice(0, 8).toUpperCase()}</p>
    <div className="my-3 border-t-2 border-dashed border-black" />
    <p className="text-xs">DESTINO: <strong>{order.destination.toUpperCase()}</strong></p>
    <p className="mt-2 text-xs">DESTINATARIO</p><p className="text-base font-extrabold break-words">{order.customer_name}</p>
    <p className="mt-2 text-xs">DNI / RUC</p><p className="text-base font-bold">{order.customer_dni}</p>
    {order.phone && <><p className="mt-2 text-xs">TELÉFONO</p><p className="font-bold">{order.phone}</p></>}
    <p className="mt-2 text-xs">AGENCIA</p><p className="font-bold break-words">{order.agency || '—'}</p>
    <p className="mt-2 text-xs">DIRECCIÓN</p><p className="font-bold break-words">{order.address}</p>
    <div className="my-3 border-t-2 border-dashed border-black" />
    <p className="text-xs">Fecha: {new Date(order.created_at).toLocaleString('es-PE')}</p>
    <p className="mt-3 text-center text-xs">Verifica los datos antes del despacho</p>
  </section>
}
