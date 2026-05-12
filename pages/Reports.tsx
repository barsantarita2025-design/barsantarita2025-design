import React, { useState, useEffect } from 'react';
import { getSessions, clearHistoricalData, getUsers, reopenSession, approveSession, getFinancialMovements } from '../services/db';
import { ShiftSession, User, FinancialMovement } from '../types';
import { Download, Archive, Info, Eye, RotateCcw, Search, Calendar, DollarSign, User as UserIcon, AlertTriangle, FileText, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { STORAGE_KEYS } from '../constants';

interface Props {
    user?: User; // Optional because Layout might pass it, but we also read from local if needed
}

const Reports: React.FC<Props> = () => {
    const [sessions, setSessions] = useState<ShiftSession[]>([]);
    const [filteredSessions, setFilteredSessions] = useState<ShiftSession[]>([]);
    const [usersMap, setUsersMap] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [movements, setMovements] = useState<FinancialMovement[]>([]);

    // User state
    const [currentUser, setCurrentUser] = useState<User | null>(null);

    // Modal State
    const [selectedSession, setSelectedSession] = useState<ShiftSession | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);
    const [reopenReason, setReopenReason] = useState('');
    const [isReopenMode, setIsReopenMode] = useState(false);

    // Filters
    const [filterUser, setFilterUser] = useState('ALL');

    const navigate = useNavigate();

    useEffect(() => {
        const load = async () => {
            // Get Current User
            const storedUser = localStorage.getItem(STORAGE_KEYS.AUTH_USER);
            if (!storedUser) return;
            const user = JSON.parse(storedUser) as User;
            setCurrentUser(user);

            // Get All Users for mapping IDs to Names
            const allUsers = await getUsers();
            const uMap: Record<string, string> = {};
            allUsers.forEach(u => uMap[u.id] = u.name);
            setUsersMap(uMap);

            // Get Sessions
            const data = await getSessions();
            // Sort descending
            const sorted = data.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
            setSessions(sorted);

            // Initial Filter
            if (user.role === 'EMPLOYEE') {
                setFilteredSessions(sorted.filter(s => s.closedBy === user.id));
            } else {
                setFilteredSessions(sorted);
            }

            // Get Movements
            const allMovements = await getFinancialMovements();
            setMovements(allMovements);

            setLoading(false);
        };
        load();
    }, []);

    useEffect(() => {
        if (!currentUser) return;

        if (currentUser.role === 'ADMIN') {
            if (filterUser === 'ALL') {
                setFilteredSessions(sessions);
            } else {
                setFilteredSessions(sessions.filter(s => s.closedBy === filterUser));
            }
        }
    }, [filterUser, sessions, currentUser]);

    const handleExport = () => {
        const dataStr = JSON.stringify(sessions, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `barflow_export_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        if (window.confirm("La descarga ha comenzado. ¿Deseas limpiar los datos históricos?")) {
            clearHistoricalData();
            setSessions([]);
            setFilteredSessions([]);
        }
    };

    const openDetail = (session: ShiftSession) => {
        setSelectedSession(session);
        setIsDetailOpen(true);
        setIsReopenMode(false);
        setReopenReason('');
    };

    const handleReopen = async () => {
        if (!selectedSession || !currentUser || !reopenReason.trim()) return;

        try {
            await reopenSession(selectedSession.id, reopenReason, currentUser);
            setIsDetailOpen(false);
            alert("Turno reabierto correctamente. Redirigiendo a Inventario...");
            navigate('/inventory');
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    const handleApprove = async () => {
        if (!selectedSession || !currentUser) return;

        try {
            await approveSession(selectedSession.id, currentUser);
            setIsDetailOpen(false);
            alert("Turno aprobado correctamente.");
            // Reload data
            const data = await getSessions();
            const sorted = data.sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime());
            setSessions(sorted);
            setFilteredSessions(sorted); // Reset filter or re-apply logic if needed
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    if (loading || !currentUser) return <div className="text-slate-400 p-8">Cargando historial...</div>;

    return (
        <div className="space-y-6 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="w-full">
                    <h2 className="text-2xl md:text-3xl font-black text-bar-text uppercase tracking-tight">Historial de Turnos</h2>
                    <p className="text-slate-400 text-sm">
                        {currentUser.role === 'ADMIN' ? 'Auditoría y control financiero global' : 'Resumen de mis turnos finalizados'}
                    </p>
                </div>

                {currentUser.role === 'ADMIN' && (
                    <button
                        onClick={handleExport}
                        className="w-full md:w-auto flex items-center justify-center gap-3 bg-bar-800 hover:bg-bar-700 text-slate-300 border border-bar-600 px-6 py-4 md:py-2 rounded-2xl md:rounded-lg text-sm font-black uppercase tracking-widest transition-all shadow-xl md:shadow-lg"
                    >
                        <Download size={20} className="md:w-4 md:h-4" /> Exportar Datos
                    </button>
                )}
            </div>

            {/* ADMIN FILTERS */}
            {currentUser.role === 'ADMIN' && (
                <div className="bg-bar-800 p-5 rounded-2xl border border-bar-700/50 flex flex-col md:flex-row items-start md:items-center gap-4 shadow-lg">
                    <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <Search size={14} /> Filtrar por Cajero
                    </span>
                    <select
                        value={filterUser}
                        onChange={e => setFilterUser(e.target.value)}
                        className="w-full md:w-auto bg-bar-900 border border-bar-600 rounded-xl p-3 text-bar-text text-sm font-bold outline-none focus:border-bar-500 transition-all"
                    >
                        <option value="ALL">TODOS LOS EMPLEADOS</option>
                        {Object.entries(usersMap).map(([id, name]) => (
                            <option key={id} value={id}>{name.toUpperCase()}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* MAIN CONTENT: CARDS ON MOBILE, TABLE ON DESKTOP */}
            <div className="bg-bar-800 rounded-2xl border border-bar-700/50 overflow-hidden shadow-2xl">
                {/* MOBILE VIEW: CARDS */}
                <div className="md:hidden divide-y divide-bar-700">
                    {filteredSessions.length === 0 ? (
                        <div className="p-10 text-center text-slate-500 font-bold">No hay registros históricos.</div>
                    ) : (
                        filteredSessions.map(s => {
                            const diff = s.salesReport?.difference || 0;
                            const isOpen = s.status !== 'CLOSED';
                            return (
                                <div key={s.id} onClick={() => openDetail(s)} className="p-5 active:bg-bar-700/50 transition-colors cursor-pointer">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 text-bar-text font-black text-sm uppercase tracking-tight">
                                                <Calendar size={14} className="text-bar-500" />
                                                {new Date(s.closedAt || s.openedAt).toLocaleDateString()}
                                            </div>
                                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                                                Cajero: {usersMap[s.closedBy || ''] || 'Desconocido'}
                                            </p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${isOpen ? 'bg-amber-900/30 text-amber-400 border border-amber-500/20' : 'bg-slate-900/30 text-slate-400 border border-slate-700/50'}`}>
                                            {isOpen ? 'Pendiente' : 'Cerrado'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4 bg-bar-950/30 p-4 rounded-xl border border-bar-700/30">
                                        <div>
                                            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Venta Total</p>
                                            <p className="text-lg font-black font-mono text-bar-text">${(s.salesReport?.totalRevenue || 0).toLocaleString()}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Entregado</p>
                                            <p className="text-lg font-black font-mono text-emerald-400">${(s.realCash || s.salesReport?.cashToDeliver || 0).toLocaleString()}</p>
                                        </div>
                                    </div>
                                    {Math.abs(diff) > 0 && (
                                        <div className="mt-3 flex items-center justify-between">
                                            <span className="text-[10px] text-slate-500 font-black uppercase">Diferencia de Caja:</span>
                                            <span className={`text-xs font-black font-mono px-2 py-0.5 rounded ${diff < 0 ? 'bg-rose-950/30 text-rose-400 border border-rose-500/20' : 'bg-blue-950/30 text-blue-400 border border-blue-500/20'}`}>
                                                {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                    <div className="mt-4 flex items-center justify-center text-[10px] font-black text-bar-500 uppercase tracking-widest gap-2">
                                        <Eye size={12} /> Tocar para ver desglose completo
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* DESKTOP VIEW: TABLE */}
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead>
                            <tr className="bg-bar-950 text-slate-500 uppercase tracking-widest text-[10px] font-black">
                                <th className="p-5">Fecha Cierre</th>
                                <th className="p-5">Cajero</th>
                                <th className="p-5 text-center">Estado</th>
                                <th className="p-5 text-right">Venta Total</th>
                                <th className="p-5 text-right">Efectivo Entregado</th>
                                <th className="p-5 text-right">Diferencia</th>
                                <th className="p-5 text-center">Detalle</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-bar-700/50">
                            {filteredSessions.map(s => {
                                const diff = s.salesReport?.difference || 0;
                                return (
                                    <tr key={s.id} className="hover:bg-bar-700/20 transition-colors">
                                        <td className="p-5 text-slate-300">
                                            <div className="flex items-center gap-2 font-bold">
                                                <Calendar size={14} className="text-slate-500" />
                                                {new Date(s.closedAt || s.openedAt).toLocaleDateString()}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-bold ml-6 uppercase">
                                                {new Date(s.closedAt || s.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="p-5 text-bar-text font-black uppercase tracking-tight">
                                            {usersMap[s.closedBy || ''] || 'Desconocido'}
                                        </td>
                                        <td className="p-5 text-center">
                                            <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${s.status === 'CLOSED' ? 'bg-slate-900/50 text-slate-400 border border-slate-700/50' : 'bg-amber-900/50 text-amber-400 border border-amber-500/20'}`}>
                                                {s.status === 'CLOSED' ? 'CERRADO' : 'PENDIENTE'}
                                            </span>
                                        </td>
                                        <td className="p-5 text-right font-mono font-bold text-bar-text">
                                            ${(s.salesReport?.totalRevenue || 0).toLocaleString()}
                                        </td>
                                        <td className="p-5 text-right font-mono font-black text-emerald-400">
                                            ${(s.realCash || s.salesReport?.cashToDeliver || 0).toLocaleString()}
                                        </td>
                                        <td className="p-5 text-right">
                                            <span className={`font-mono font-black px-2 py-1 rounded-lg text-xs ${diff < 0 ? 'bg-rose-900/20 text-rose-400 border border-rose-500/20' : (diff > 0 ? 'bg-blue-900/20 text-blue-400 border border-blue-500/20' : 'text-slate-600')}`}>
                                                {diff > 0 ? '+' : ''}{diff.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="p-5 text-center">
                                            <button onClick={() => openDetail(s)} className="p-2 bg-bar-900/50 hover:bg-bar-700 text-bar-500 hover:text-bar-text rounded-xl transition-all">
                                                <Eye size={20} />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- DETAIL MODAL --- */}
            {isDetailOpen && selectedSession && selectedSession.salesReport && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-end md:items-center justify-center md:p-4">
                    <div className="bg-bar-800 w-full md:max-w-2xl h-[95vh] md:h-auto rounded-t-[3rem] md:rounded-3xl border-t md:border border-bar-600 shadow-2xl flex flex-col overflow-hidden">

                        {/* Header */}
                        <div className="p-8 md:p-6 border-b border-bar-700 text-center md:text-left shrink-0">
                            <div className="w-12 h-1.5 bg-bar-700 rounded-full mx-auto mb-6 md:hidden" />
                            <h3 className="text-2xl md:text-xl font-black text-bar-text flex items-center justify-center md:justify-start gap-3 uppercase tracking-tighter">
                                <FileText size={24} className="text-bar-500" /> Detalle de Turno
                            </h3>
                            <div className="mt-2 text-[10px] md:text-sm text-slate-500 font-bold uppercase tracking-widest">
                                Cajero: <span className="text-bar-text">{usersMap[selectedSession.closedBy || '']}</span>
                                <span className="mx-2 md:mx-3 text-bar-700">|</span>
                                {new Date(selectedSession.closedAt || '').toLocaleString()}
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex-1 overflow-y-auto p-8 md:p-6 space-y-6 no-scrollbar">

                            {/* Financial Summary */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-bar-950/50 p-5 md:p-4 rounded-2xl border border-bar-700/50">
                                    <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-1">Venta Bruta</p>
                                    <p className="text-bar-text font-mono text-2xl md:text-lg font-black">${selectedSession.salesReport.totalRevenue.toLocaleString()}</p>
                                </div>
                                <div className="bg-bar-950/50 p-5 md:p-4 rounded-2xl border border-bar-700/50">
                                    <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-1">Fiaos (Cuentas)</p>
                                    <p className="text-rose-400 font-mono text-2xl md:text-lg font-black">-${selectedSession.salesReport.totalCreditSales.toLocaleString()}</p>
                                </div>
                                <div className="bg-bar-950/50 p-5 md:p-4 rounded-2xl border border-bar-700/50">
                                    <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-1">Abonos (Caja)</p>
                                    <p className="text-emerald-400 font-mono text-2xl md:text-lg font-black">+${selectedSession.salesReport.totalCashPayments.toLocaleString()}</p>
                                </div>
                                <div className="bg-bar-950/50 p-5 md:p-4 rounded-2xl border border-bar-700/50">
                                    <p className="text-slate-500 text-[10px] uppercase font-black tracking-widest mb-1">Gastos Turno</p>
                                    <p className="text-rose-300 font-mono text-2xl md:text-lg font-black">
                                        -${(movements
                                            .filter(m => m.sessionId === selectedSession.id && m.type === 'PAYMENT' && m.status === 'APPROVED')
                                            .reduce((acc, m) => acc + m.amount, 0)
                                        ).toLocaleString()}
                                    </p>
                                </div>
                            </div>

                            {/* Cash Reconciliation */}
                            <div className="bg-bar-950 p-6 rounded-3xl border border-bar-700/50 shadow-inner">
                                <h4 className="text-bar-text text-sm font-black mb-5 flex items-center gap-2 uppercase tracking-widest">
                                    <DollarSign size={16} className="text-emerald-500" /> Arqueo de Efectivo
                                </h4>
                                <div className="space-y-4">
                                    <div className="flex justify-between text-slate-500 text-xs font-bold uppercase tracking-widest">
                                        <span>Dinero Esperado (Sistema):</span>
                                        <span className="font-mono text-bar-text">${selectedSession.salesReport.cashToDeliver.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between items-center bg-bar-900/50 p-4 rounded-2xl border border-bar-700/30">
                                        <span className="text-slate-300 text-xs font-black uppercase tracking-widest">Dinero Real (Entregado):</span>
                                        <span className="font-mono text-2xl font-black text-emerald-400">${(selectedSession.realCash || 0).toLocaleString()}</span>
                                    </div>
                                    <div className="pt-2 flex justify-between items-center">
                                        <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Balance de Caja:</span>
                                        <span className={`font-mono font-black px-4 py-2 rounded-xl text-lg ${(selectedSession.salesReport.difference || 0) < 0 ? 'bg-rose-900/30 text-rose-400 border border-rose-500/20' :
                                            (selectedSession.salesReport.difference || 0) > 0 ? 'bg-blue-900/30 text-blue-400 border border-blue-500/20' :
                                                'bg-slate-900/30 text-slate-400 border border-slate-700/50'
                                            }`}>
                                            {selectedSession.salesReport.difference > 0 ? '+' : ''}{(selectedSession.salesReport.difference || 0).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Observations */}
                            <div className="space-y-2">
                                <h4 className="text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2">Comentarios de Cierre</h4>
                                <div className="bg-bar-900/30 p-5 rounded-2xl border border-bar-700/30 text-sm text-slate-300 italic leading-relaxed">
                                    <FileText size={14} className="inline mr-2 text-bar-700" />
                                    {selectedSession.closingObservation || "No se registraron comentarios adicionales para este cierre."}
                                </div>
                            </div>

                            {/* Audit Log (If exists) */}
                            {selectedSession.auditLog && selectedSession.auditLog.length > 0 && (
                                <div>
                                    <h4 className="text-amber-500 text-sm font-bold mb-2 flex items-center gap-2"><AlertTriangle size={14} /> Auditoría</h4>
                                    <div className="space-y-2">
                                        {selectedSession.auditLog.map((log, idx) => (
                                            <div key={idx} className="text-xs bg-amber-900/10 border border-amber-900/30 p-2 rounded text-amber-200">
                                                <span className="font-bold">{log.action}: </span> {log.reason} - {log.userName} ({new Date(log.date).toLocaleString()})
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="p-8 md:p-6 border-t border-bar-700 bg-bar-950/80 shrink-0">
                            {currentUser.role === 'ADMIN' ? (
                                selectedSession.status === 'PENDING_APPROVAL' ? (
                                    <div className="flex flex-col md:flex-row gap-4">
                                        <button onClick={() => setIsDetailOpen(false)} className="order-2 md:order-1 flex-1 py-4 text-slate-400 font-black uppercase tracking-widest text-xs">
                                            Volver
                                        </button>
                                        <button
                                            onClick={handleApprove}
                                            className="order-1 md:order-2 flex-[2] bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-emerald-900/20"
                                        >
                                            <CheckCircle size={18} className="inline mr-2" /> Aprobar Auditoría
                                        </button>
                                    </div>
                                ) : (
                                    !isReopenMode ? (
                                        <div className="flex flex-col md:flex-row gap-4">
                                            <button onClick={() => setIsDetailOpen(false)} className="order-2 md:order-1 flex-1 py-4 text-slate-400 font-black uppercase tracking-widest text-xs">
                                                Cerrar Detalle
                                            </button>
                                            <button
                                                onClick={() => setIsReopenMode(true)}
                                                className="order-1 md:order-2 flex-[2] bg-rose-900/30 hover:bg-rose-900/50 text-rose-400 border border-rose-500/20 py-4 rounded-2xl font-black uppercase tracking-widest text-xs flex justify-center items-center gap-2 transition-all"
                                            >
                                                <RotateCcw size={18} /> Solicitar Reapertura
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="space-y-5 animate-in fade-in slide-in-from-bottom-5">
                                            <label className="block text-[10px] text-rose-400 font-black uppercase tracking-widest ml-1">Razón de la Corrección *</label>
                                            <input
                                                type="text"
                                                autoFocus
                                                value={reopenReason}
                                                onChange={e => setReopenReason(e.target.value)}
                                                placeholder="Ej: Ajuste de stock o error en registro..."
                                                className="w-full bg-bar-900 border border-rose-500/30 rounded-2xl p-4 text-bar-text text-sm focus:border-rose-500 outline-none transition-all shadow-inner"
                                            />
                                            <div className="flex gap-4">
                                                <button
                                                    onClick={() => setIsReopenMode(false)}
                                                    className="flex-1 py-4 text-slate-500 font-black uppercase tracking-widest text-xs"
                                                >
                                                    Cancelar
                                                </button>
                                                <button
                                                    onClick={handleReopen}
                                                    disabled={!reopenReason.trim()}
                                                    className="flex-[2] py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest text-xs disabled:opacity-30 shadow-xl shadow-rose-900/20"
                                                >
                                                    Confirmar Acción
                                                </button>
                                            </div>
                                        </div>
                                    )
                                )
                            ) : (
                                <button onClick={() => setIsDetailOpen(false)} className="w-full bg-bar-700 hover:bg-bar-600 text-bar-text py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all">
                                    Entendido
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Reports;