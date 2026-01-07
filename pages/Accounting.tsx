import React, { useState, useEffect } from 'react';
import {
    getFixedExpenses, saveFixedExpense, deleteFixedExpense,
    getPayroll, saveWorkShift, deleteWorkShift,
    getPurchases, savePurchase, deletePurchase,
    getSessions, getUsers
} from '../services/db';
import {
    FixedExpense, WorkShift, Purchase, ShiftSession, User, PayrollStatus
} from '../types';
import {
    PieChart, DollarSign, Calendar, Users, ShoppingCart,
    Plus, Trash2, Save, Filter, TrendingUp, TrendingDown,
    Clock, AlertCircle, Check, X, CheckCircle, XCircle, Eye, ArrowRight
} from 'lucide-react';

interface AccountingProps {
    user: User;
}

const Accounting: React.FC<AccountingProps> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<'SUMMARY' | 'EXPENSES' | 'PAYROLL' | 'PURCHASES'>(
        user.role === 'EMPLOYEE' ? 'PAYROLL' : 'SUMMARY'
    );
    const [loading, setLoading] = useState(true);

    // Data Stores
    const [expenses, setExpenses] = useState<FixedExpense[]>([]);
    const [payroll, setPayroll] = useState<WorkShift[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [sessions, setSessions] = useState<ShiftSession[]>([]);
    const [employees, setEmployees] = useState<User[]>([]);

    // Filters
    const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

    // Inputs - Expenses
    const [expName, setExpName] = useState('');
    const [expAmount, setExpAmount] = useState('');
    const [expDate, setExpDate] = useState('');
    const [expType, setExpType] = useState<'EXPENSE' | 'BANK_COMMITMENT'>('EXPENSE');

    // Inputs - Payroll
    const [payEmployeeId, setPayEmployeeId] = useState('');
    const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
    const [payStartTime, setPayStartTime] = useState('');
    const [payEndTime, setPayEndTime] = useState('');
    const [payHours, setPayHours] = useState('');
    const [payRate, setPayRate] = useState('');
    const [paySurcharge, setPaySurcharge] = useState('0');

    // Admin filters
    const [dateRangeStart, setDateRangeStart] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10));
    const [dateRangeEnd, setDateRangeEnd] = useState(new Date().toISOString().slice(0, 10));
    const [filterEmployee, setFilterEmployee] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState<PayrollStatus | 'ALL'>('ALL');

    // Rejection modal
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // Approval modal
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [approveRate, setApproveRate] = useState('');
    const [approveSurcharge, setApproveSurcharge] = useState('0');

    // Inputs - Purchases
    const [purDate, setPurDate] = useState(new Date().toISOString().slice(0, 10));
    const [purProduct, setPurProduct] = useState('');
    const [purQty, setPurQty] = useState('');
    const [purCost, setPurCost] = useState('');

    useEffect(() => {
        loadAllData();
    }, []);

    const loadAllData = async () => {
        setLoading(true);
        const [e, p, pur, s, u] = await Promise.all([
            getFixedExpenses(),
            getPayroll(),
            getPurchases(),
            getSessions(),
            getUsers()
        ]);
        setExpenses(e);
        setPayroll(p);
        setPurchases(pur);
        setSessions(s);
        setEmployees(u.filter(user => user.role === 'EMPLOYEE' || user.role === 'ADMIN'));
        setLoading(false);
    };

    const formatMoney = (amount: number) => {
        return '$' + amount.toLocaleString('es-CO');
    };

    // --- HANDLERS ---

    // EXPENSES
    const handleSaveExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!expName || !expAmount || !expDate) return;
        await saveFixedExpense({
            id: '',
            name: expName,
            amount: Number(expAmount),
            paymentDay: expDate,
            type: expType
        });
        setExpName(''); setExpAmount(''); setExpDate('');
        setExpenses(await getFixedExpenses());
    };

    const handleDeleteExpense = async (id: string) => {
        if (window.confirm('¿Borrar este gasto?')) {
            await deleteFixedExpense(id);
            setExpenses(await getFixedExpenses());
        }
    };

    // PAYROLL
    const calculateHours = (start: string, end: string) => {
        if (!start || !end) return 0;
        const startParts = start.split(':');
        const endParts = end.split(':');
        const startMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
        const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
        let diffMinutes = endMinutes - startMinutes;
        if (diffMinutes < 0) diffMinutes += 24 * 60;
        return Math.round((diffMinutes / 60) * 100) / 100;
    };

    const handleSavePayroll = async (e: React.FormEvent) => {
        e.preventDefault();

        // If employee, use their ID. If admin, use selected ID.
        const targetEmployeeId = user.role === 'EMPLOYEE' ? user.id : payEmployeeId;

        // Validation
        if (!targetEmployeeId || !payStartTime || !payEndTime) return;
        if (user.role === 'ADMIN' && !payRate) return; // Admin must set rate

        const hours = calculateHours(payStartTime, payEndTime);
        const rate = user.role === 'ADMIN' ? Number(payRate) : 0;
        const sur = user.role === 'ADMIN' ? Number(paySurcharge) : 0;
        const total = (hours * rate) + sur;

        // Find employee name
        const emp = employees.find(u => u.id === targetEmployeeId) || (user.role === 'EMPLOYEE' ? user : undefined);

        await saveWorkShift({
            id: '',
            employeeId: targetEmployeeId,
            employeeName: emp?.name || 'Desconocido',
            date: payDate,
            startTime: payStartTime,
            endTime: payEndTime,
            hoursWorked: hours,
            hourlyRate: rate,
            surcharges: sur,
            totalPay: total,
            status: 'PENDING'
        });

        setPayStartTime(''); setPayEndTime(''); setPaySurcharge('0');
        setPayroll(await getPayroll());
    };

    const handleApproveShift = (id: string) => {
        const shift = payroll.find(s => s.id === id);
        if (!shift) return;

        setSelectedShiftId(id);
        // Pre-fill with existing values or defaults
        setApproveRate(shift.hourlyRate > 0 ? shift.hourlyRate.toString() : '');
        setApproveSurcharge(shift.surcharges.toString());
        setShowApproveModal(true);
    };

    const confirmApproveShift = async () => {
        if (!selectedShiftId || !approveRate) return;

        const shift = payroll.find(s => s.id === selectedShiftId);
        if (!shift) return;

        const rate = Number(approveRate);
        const surcharge = Number(approveSurcharge);
        const total = (shift.hoursWorked * rate) + surcharge;

        const updated: WorkShift = {
            ...shift,
            hourlyRate: rate,
            surcharges: surcharge,
            totalPay: total,
            status: 'APPROVED',
            approvedAt: new Date().toISOString(),
            approvedBy: user.id
        };

        await saveWorkShift(updated);
        setPayroll(await getPayroll());
        setShowApproveModal(false);
        setSelectedShiftId(null);
        setApproveRate('');
        setApproveSurcharge('0');
    };

    const handleRejectShift = (id: string) => {
        setSelectedShiftId(id);
        setRejectionReason('');
        setShowRejectModal(true);
    };

    const confirmRejectShift = async () => {
        if (!selectedShiftId || !rejectionReason.trim()) return;

        const shifts = await getPayroll();
        const shift = shifts.find(s => s.id === selectedShiftId);
        if (!shift) return;

        const updated = {
            ...shift,
            status: 'REJECTED' as PayrollStatus,
            rejectionReason: rejectionReason
        };

        await saveWorkShift(updated);
        setPayroll(await getPayroll());
        setShowRejectModal(false);
        setSelectedShiftId(null);
        setRejectionReason('');
    };

    const handleDeletePayroll = async (id: string) => {
        if (window.confirm('¿Borrar este registro de turno?')) {
            await deleteWorkShift(id);
            setPayroll(await getPayroll());
        }
    };

    // PURCHASES
    const handleSavePurchase = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!purProduct || !purQty || !purCost) return;

        const qty = Number(purQty);
        const cost = Number(purCost);

        await savePurchase({
            id: '',
            date: purDate,
            productName: purProduct,
            quantity: qty,
            unitCost: cost,
            totalCost: qty * cost
        });

        setPurProduct(''); setPurQty(''); setPurCost('');
        setPurchases(await getPurchases());
    };

    const handleDeletePurchase = async (id: string) => {
        if (window.confirm('¿Borrar esta compra?')) {
            await deletePurchase(id);
            setPurchases(await getPurchases());
        }
    };

    // --- CALCULATIONS FOR SUMMARY ---

    const getSummaryData = () => {
        const monthlySessions = sessions.filter(s => s.closedAt?.startsWith(selectedMonth));
        const totalRevenue = monthlySessions.reduce((acc, s) => acc + (s.salesReport?.totalRevenue || 0), 0);

        const monthlyPurchases = purchases.filter(p => p.date.startsWith(selectedMonth));
        const totalPurchases = monthlyPurchases.reduce((acc, p) => acc + p.totalCost, 0);

        const monthlyPayroll = payroll.filter(p => p.date.startsWith(selectedMonth));
        const totalPayroll = monthlyPayroll.reduce((acc, p) => acc + p.totalPay, 0);

        const totalFixed = expenses.filter(e => e.type === 'EXPENSE').reduce((acc, e) => acc + e.amount, 0);
        const totalBank = expenses.filter(e => e.type === 'BANK_COMMITMENT').reduce((acc, e) => acc + e.amount, 0);

        const totalExpenses = totalPurchases + totalPayroll + totalFixed + totalBank;
        const realProfit = totalRevenue - totalExpenses;

        return {
            totalRevenue,
            totalPurchases,
            totalPayroll,
            totalFixed,
            totalBank,
            totalExpenses,
            realProfit
        };
    };

    const summary = getSummaryData();

    // Filter payroll for admin view
    const filteredPayroll = payroll.filter(p => {
        const dateMatch = p.date >= dateRangeStart && p.date <= dateRangeEnd;

        let empMatch = true;
        if (user.role === 'ADMIN') {
            empMatch = filterEmployee === 'ALL' || p.employeeId === filterEmployee;
        } else {
            empMatch = p.employeeId === user.id;
        }

        const statusMatch = filterStatus === 'ALL' || p.status === filterStatus;
        return dateMatch && empMatch && statusMatch;
    });

    const totalFilteredPayroll = filteredPayroll.reduce((acc, p) => acc + p.totalPay, 0);
    const pendingCount = payroll.filter(p => p.status === 'PENDING').length;

    if (loading) return <div className="p-8 text-center text-slate-400">Cargando contabilidad...</div>;

    return (
        <div className="space-y-6 pb-20">
            {/* Rejection Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-bar-800 w-full max-w-md rounded-2xl border border-bar-600 p-6">
                        <h3 className="text-xl font-bold text-bar-text mb-4">Rechazar Turno</h3>
                        <textarea
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="Motivo del rechazo..."
                            className="w-full bg-bar-900 border border-bar-600 rounded p-3 text-bar-text h-32 resize-none"
                        />
                        <div className="flex gap-3 mt-4">
                            <button
                                onClick={() => setShowRejectModal(false)}
                                className="flex-1 bg-bar-700 hover:bg-bar-600 text-bar-text py-2 rounded"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmRejectShift}
                                disabled={!rejectionReason.trim()}
                                className="flex-1 bg-rose-600 hover:bg-rose-500 text-bar-text py-2 rounded disabled:opacity-50"
                            >
                                Rechazar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Approval Modal */}
            {showApproveModal && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-bar-800 w-full max-w-md rounded-2xl border border-bar-600 p-6">
                        <h3 className="text-xl font-bold text-bar-text mb-4">Aprobar Turno</h3>
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm text-slate-300">Valor Hora</label>
                                <input
                                    type="number"
                                    value={approveRate}
                                    onChange={(e) => setApproveRate(e.target.value)}
                                    placeholder="$"
                                    className="w-full bg-bar-900 border border-bar-600 rounded p-3 text-bar-text outline-none focus:border-emerald-500"
                                    autoFocus
                                />
                            </div>
                            <div>
                                <label className="text-sm text-slate-300">Recargos / Bonificaciones</label>
                                <input
                                    type="number"
                                    value={approveSurcharge}
                                    onChange={(e) => setApproveSurcharge(e.target.value)}
                                    placeholder="0"
                                    className="w-full bg-bar-900 border border-bar-600 rounded p-3 text-bar-text outline-none focus:border-emerald-500"
                                />
                            </div>

                            {approveRate && (
                                <div className="p-3 bg-bar-900 rounded text-center border border-bar-600">
                                    <span className="text-xs text-slate-400">Total a Pagar Estimado: </span>
                                    <span className="text-emerald-400 font-bold text-lg">
                                        {formatMoney(
                                            (payroll.find(s => s.id === selectedShiftId)?.hoursWorked || 0) * Number(approveRate) + Number(approveSurcharge)
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowApproveModal(false)}
                                className="flex-1 px-4 py-2 bg-bar-700 hover:bg-bar-600 text-bar-text rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmApproveShift}
                                disabled={!approveRate}
                                className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-bar-text font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Confirmar Aprobación
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-bar-text">Contabilidad</h2>
                    <p className="text-slate-400">Gestión financiera integral del negocio</p>
                </div>

                <div className="flex items-center gap-2 bg-bar-800 p-2 rounded-lg border border-bar-700">
                    <Calendar size={18} className="text-slate-400" />
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={e => setSelectedMonth(e.target.value)}
                        className="bg-transparent text-bar-text outline-none font-bold"
                    />
                </div>
            </div>

            {/* TABS */}
            <div className="flex overflow-x-auto gap-2 border-b border-bar-700 pb-1">
                {user.role === 'ADMIN' && (
                    <>
                        <button
                            onClick={() => setActiveTab('SUMMARY')}
                            className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 ${activeTab === 'SUMMARY'
                                ? 'bg-bar-800 text-bar-500 border-t border-x border-bar-700'
                                : 'text-slate-400 hover:text-bar-text'
                                }`}
                        >
                            <PieChart size={18} /> Resumen
                        </button>
                        <button
                            onClick={() => setActiveTab('EXPENSES')}
                            className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 ${activeTab === 'EXPENSES'
                                ? 'bg-bar-800 text-bar-500 border-t border-x border-bar-700'
                                : 'text-slate-400 hover:text-bar-text'
                                }`}
                        >
                            <DollarSign size={18} /> Gastos Fijos y Bancos
                        </button>
                    </>
                )}
                <button
                    onClick={() => setActiveTab('PAYROLL')}
                    className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 ${activeTab === 'PAYROLL'
                        ? 'bg-bar-800 text-bar-500 border-t border-x border-bar-700'
                        : 'text-slate-400 hover:text-bar-text'
                        }`}
                >
                    <Users size={18} /> Nómina
                    {pendingCount > 0 && user.role === 'ADMIN' && <span className="bg-amber-500 text-bar-900 text-xs px-2 py-0.5 rounded-full">{pendingCount}</span>}
                </button>
                {user.role === 'ADMIN' && (
                    <button
                        onClick={() => setActiveTab('PURCHASES')}
                        className={`px-4 py-2 rounded-t-lg font-bold flex items-center gap-2 ${activeTab === 'PURCHASES'
                            ? 'bg-bar-800 text-bar-500 border-t border-x border-bar-700'
                            : 'text-slate-400 hover:text-bar-text'
                            }`}
                    >
                        <ShoppingCart size={18} /> Compras
                    </button>
                )}
            </div>

            {/* --- TAB CONTENT: SUMMARY --- */}
            {activeTab === 'SUMMARY' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <div className="bg-bar-800 p-6 rounded-xl border border-bar-700">
                            <div className="flex justify-between mb-4">
                                <span className="text-slate-400 text-sm font-bold uppercase">Ingresos Totales</span>
                                <TrendingUp className="text-emerald-500" />
                            </div>
                            <p className="text-3xl font-bold text-bar-text">{formatMoney(summary.totalRevenue)}</p>
                            <p className="text-xs text-slate-500 mt-2">Basado en cierres de caja del mes</p>
                        </div>

                        <div className="bg-bar-800 p-6 rounded-xl border border-bar-700">
                            <div className="flex justify-between mb-4">
                                <span className="text-slate-400 text-sm font-bold uppercase">Total Egresos</span>
                                <TrendingDown className="text-rose-500" />
                            </div>
                            <p className="text-3xl font-bold text-rose-400">-{formatMoney(summary.totalExpenses)}</p>
                            <div className="flex gap-2 text-xs mt-2 overflow-x-auto">
                                <span className="bg-rose-900/30 px-2 py-1 rounded text-rose-200">Compras: {formatMoney(summary.totalPurchases)}</span>
                                <span className="bg-rose-900/30 px-2 py-1 rounded text-rose-200">Nómina: {formatMoney(summary.totalPayroll)}</span>
                            </div>
                        </div>

                        <div className={`p-6 rounded-xl border ${summary.realProfit >= 0 ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-rose-900/20 border-rose-500/50'}`}>
                            <div className="flex justify-between mb-4">
                                <span className="white text-sm font-bold uppercase">Ganancia Real</span>
                                <DollarSign className={summary.realProfit >= 0 ? "text-emerald-400" : "text-rose-400"} />
                            </div>
                            <p className={`text-4xl font-bold ${summary.realProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {formatMoney(summary.realProfit)}
                            </p>
                            <p className="text-xs text-slate-300 mt-2">
                                Dinero estimado libre tras pagar todo
                            </p>
                        </div>
                    </div>

                    <div className="bg-bar-800 rounded-xl border border-bar-700 overflow-hidden">
                        <div className="p-4 bg-bar-900/50 border-b border-bar-700 font-bold text-bar-text">
                            Detalle de Egresos
                        </div>
                        <div className="divide-y divide-bar-700">
                            <div className="p-4 flex justify-between items-center hover:bg-bar-700/20">
                                <div className="flex items-center gap-3">
                                    <div className="bg-blue-500/20 p-2 rounded text-blue-400"><Clock size={18} /></div>
                                    <div>
                                        <p className="text-bar-text font-medium">Gastos Fijos</p>
                                        <p className="text-xs text-slate-400">Arriendo, Servicios, etc.</p>
                                    </div>
                                </div>
                                <span className="text-bar-text font-mono">{formatMoney(summary.totalFixed)}</span>
                            </div>
                            <div className="p-4 flex justify-between items-center hover:bg-bar-700/20">
                                <div className="flex items-center gap-3">
                                    <div className="bg-purple-500/20 p-2 rounded text-purple-400"><DollarSign size={18} /></div>
                                    <div>
                                        <p className="text-bar-text font-medium">Compromisos Bancarios</p>
                                        <p className="text-xs text-slate-400">Créditos y Deudas</p>
                                    </div>
                                </div>
                                <span className="text-bar-text font-mono">{formatMoney(summary.totalBank)}</span>
                            </div>
                            <div className="p-4 flex justify-between items-center hover:bg-bar-700/20">
                                <div className="flex items-center gap-3">
                                    <div className="bg-orange-500/20 p-2 rounded text-orange-400"><Users size={18} /></div>
                                    <div>
                                        <p className="text-bar-text font-medium">Nómina de Empleados</p>
                                        <p className="text-xs text-slate-400">Pagos de turnos del mes</p>
                                    </div>
                                </div>
                                <span className="text-bar-text font-mono">{formatMoney(summary.totalPayroll)}</span>
                            </div>
                            <div className="p-4 flex justify-between items-center hover:bg-bar-700/20">
                                <div className="flex items-center gap-3">
                                    <div className="bg-teal-500/20 p-2 rounded text-teal-400"><ShoppingCart size={18} /></div>
                                    <div>
                                        <p className="text-bar-text font-medium">Compras y Surtido</p>
                                        <p className="text-xs text-slate-400">Inversión en inventario</p>
                                    </div>
                                </div>
                                <span className="text-bar-text font-mono">{formatMoney(summary.totalPurchases)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- TAB CONTENT: EXPENSES --- */}
            {activeTab === 'EXPENSES' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                    <div className="md:col-span-1 bg-bar-800 p-6 rounded-xl border border-bar-700 h-fit">
                        <h3 className="text-lg font-bold text-bar-text mb-4">Registrar Gasto / Deuda</h3>
                        <form onSubmit={handleSaveExpense} className="space-y-4">
                            <div>
                                <label className="text-sm text-slate-300">Tipo</label>
                                <select value={expType} onChange={(e: any) => setExpType(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text outline-none">
                                    <option value="EXPENSE">Gasto Fijo (Arriendo, Luz...)</option>
                                    <option value="BANK_COMMITMENT">Compromiso Bancario (Crédito)</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-sm text-slate-300">Concepto</label>
                                <input required value={expName} onChange={e => setExpName(e.target.value)} placeholder="Ej: Pago Arriendo" className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text outline-none" />
                            </div>
                            <div>
                                <label className="text-sm text-slate-300">Valor Mensual / Cuota</label>
                                <input required type="number" min="0" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="0" className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text outline-none" />
                            </div>
                            <div>
                                <label className="text-sm text-slate-300">Fecha de Pago (Texto)</label>
                                <input required value={expDate} onChange={e => setExpDate(e.target.value)} placeholder="Ej: Día 5 de cada mes" className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text outline-none" />
                            </div>
                            <button type="submit" className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold py-2 rounded">Guardar</button>
                        </form>
                    </div>

                    <div className="md:col-span-2 space-y-4">
                        <h3 className="text-lg font-bold text-bar-text">Listado de Compromisos Mensuales</h3>
                        {expenses.length === 0 && <p className="text-slate-500">No hay gastos registrados.</p>}

                        <div className="grid gap-3">
                            {expenses.map(exp => (
                                <div key={exp.id} className="bg-bar-800 border border-bar-700 p-4 rounded-xl flex justify-between items-center">
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2 rounded-full ${exp.type === 'EXPENSE' ? 'bg-blue-900/50 text-blue-400' : 'bg-purple-900/50 text-purple-400'}`}>
                                            {exp.type === 'EXPENSE' ? <Clock size={20} /> : <DollarSign size={20} />}
                                        </div>
                                        <div>
                                            <p className="font-bold text-bar-text">{exp.name}</p>
                                            <p className="text-xs text-slate-400">{exp.paymentDay}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-bar-text font-bold">{formatMoney(exp.amount)}</p>
                                        <button onClick={() => handleDeleteExpense(exp.id)} className="text-rose-500 hover:text-rose-400 text-xs mt-1">Eliminar</button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {expenses.length > 0 && (
                            <div className="mt-4 p-4 bg-bar-900/50 rounded-xl border border-bar-700 flex justify-between items-center">
                                <span className="text-slate-300 font-bold">Total Mensual Fijo:</span>
                                <span className="text-xl font-bold text-bar-text">{formatMoney(expenses.reduce((acc, e) => acc + e.amount, 0))}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- TAB CONTENT: PAYROLL --- */}
            {activeTab === 'PAYROLL' && (
                <div className="space-y-6 animate-in fade-in">
                    {/* Admin Filters */}
                    <div className="bg-bar-800 p-4 rounded-xl border border-bar-700">
                        <div className="flex flex-wrap gap-4 items-end">
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Desde</label>
                                <input type="date" value={dateRangeStart} onChange={e => setDateRangeStart(e.target.value)} className="bg-bar-900 border border-bar-600 rounded p-2 text-bar-text text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Hasta</label>
                                <input type="date" value={dateRangeEnd} onChange={e => setDateRangeEnd(e.target.value)} className="bg-bar-900 border border-bar-600 rounded p-2 text-bar-text text-sm" />
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Empleado</label>
                                {user.role === 'ADMIN' ? (
                                    <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} className="bg-bar-900 border border-bar-600 rounded p-2 text-bar-text text-sm">
                                        <option value="ALL">Todos</option>
                                        {employees.map(u => (
                                            <option key={u.id} value={u.id}>{u.name}</option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={user.name}
                                        disabled
                                        className="bg-bar-900/50 border border-bar-700 rounded p-2 text-slate-400 text-sm cursor-not-allowed"
                                    />
                                )}
                            </div>
                            <div>
                                <label className="text-xs text-slate-400 block mb-1">Estado</label>
                                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as PayrollStatus | 'ALL')} className="bg-bar-900 border border-bar-600 rounded p-2 text-bar-text text-sm">
                                    <option value="ALL">Todos</option>
                                    <option value="PENDING">Pendientes</option>
                                    <option value="APPROVED">Aprobados</option>
                                    <option value="REJECTED">Rechazados</option>
                                </select>
                            </div>
                            <div className="ml-auto px-4 py-2 bg-bar-900 rounded-lg">
                                <span className="text-slate-400 text-sm">Total: </span>
                                <span className="text-emerald-400 font-bold text-lg">{formatMoney(totalFilteredPayroll)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Registration Form */}
                        <div className="bg-bar-800 p-6 rounded-xl border border-bar-700 h-fit">
                            <h3 className="text-lg font-bold text-bar-text mb-4">Registrar Turno</h3>
                            <form onSubmit={handleSavePayroll} className="space-y-4">
                                <div>
                                    <label className="text-sm text-slate-300">Empleado</label>
                                    {user.role === 'ADMIN' ? (
                                        <select required value={payEmployeeId} onChange={e => setPayEmployeeId(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text outline-none">
                                            <option value="">Seleccionar...</option>
                                            {employees.map(u => (
                                                <option key={u.id} value={u.id}>{u.name}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={user.name}
                                            disabled
                                            className="w-full bg-bar-900/50 border border-bar-700 rounded p-2 text-slate-400 cursor-not-allowed"
                                        />
                                    )}
                                </div>
                                <div>
                                    <label className="text-sm text-slate-300">Fecha</label>
                                    <input type="date" required value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text outline-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-sm text-slate-300">Hora Inicio</label>
                                        <input type="time" required value={payStartTime} onChange={e => setPayStartTime(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text outline-none" />
                                    </div>
                                    <div>
                                        <label className="text-sm text-slate-300">Hora Fin</label>
                                        <input type="time" required value={payEndTime} onChange={e => setPayEndTime(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text outline-none" />
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-amber-400 bg-amber-900/20 p-2 rounded">
                                    <Clock size={16} />
                                    <span>Horas: {calculateHours(payStartTime, payEndTime)}h</span>
                                </div>

                                {user.role === 'ADMIN' && (
                                    <>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div>
                                                <label className="text-sm text-slate-300">Valor Hora</label>
                                                <input type="number" required value={payRate} onChange={e => setPayRate(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text outline-none" placeholder="$" />
                                            </div>
                                            <div>
                                                <label className="text-sm text-slate-300">Recargos ($)</label>
                                                <input type="number" value={paySurcharge} onChange={e => setPaySurcharge(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text outline-none" placeholder="0" />
                                            </div>
                                        </div>

                                        {payStartTime && payEndTime && payRate && (
                                            <div className="p-3 bg-bar-900 rounded text-center border border-bar-600">
                                                <span className="text-xs text-slate-400">Total a Pagar: </span>
                                                <span className="text-emerald-400 font-bold text-lg">{formatMoney((calculateHours(payStartTime, payEndTime) * Number(payRate)) + Number(paySurcharge))}</span>
                                            </div>
                                        )}
                                    </>
                                )}

                                <button type="submit" className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold py-3 rounded-lg">Guardar Turno</button>
                            </form>

                        </div>

                        {/* Payroll List */}
                        <div className="lg:col-span-2 space-y-4">
                            <h3 className="text-lg font-bold text-bar-text">Registro de Turnos</h3>

                            <div className="bg-bar-800 rounded-xl border border-bar-700 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-bar-950 text-slate-400">
                                        <tr>
                                            <th className="p-3">Fecha</th>
                                            <th className="p-3">Empleado</th>
                                            <th className="p-3 text-center">Horario</th>
                                            <th className="p-3 text-center">Horas</th>
                                            <th className="p-3 text-center">Estado</th>
                                            <th className="p-3 text-right">Total</th>
                                            <th className="p-3 w-24">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-bar-700">
                                        {filteredPayroll.length === 0 ? (
                                            <tr><td colSpan={7} className="p-6 text-center text-slate-500">Sin registros en el rango seleccionado</td></tr>
                                        ) : (
                                            filteredPayroll.sort((a, b) => b.date.localeCompare(a.date)).map(p => (
                                                <tr key={p.id} className="hover:bg-bar-700/30">
                                                    <td className="p-3 text-slate-300">{p.date}</td>
                                                    <td className="p-3 text-bar-text font-medium">{p.employeeName}</td>
                                                    <td className="p-3 text-center text-slate-400">
                                                        {p.startTime} <ArrowRight size={12} className="inline" /> {p.endTime}
                                                    </td>
                                                    <td className="p-3 text-center text-slate-400">{p.hoursWorked}h</td>
                                                    <td className="p-3 text-center">
                                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${p.status === 'APPROVED' ? 'bg-emerald-900/50 text-emerald-400' :
                                                            p.status === 'REJECTED' ? 'bg-rose-900/50 text-rose-400' :
                                                                'bg-amber-900/50 text-amber-400'
                                                            }`}>
                                                            {p.status === 'APPROVED' ? 'Aprobado' : p.status === 'REJECTED' ? 'Rechazado' : 'Pendiente'}
                                                        </span>
                                                    </td>
                                                    <td className="p-3 text-right text-emerald-400 font-bold">{formatMoney(p.totalPay)}</td>
                                                    <td className="p-3">
                                                        <div className="flex gap-1">
                                                            {user.role === 'ADMIN' && (
                                                                <>
                                                                    {p.status === 'PENDING' && (
                                                                        <>
                                                                            <button onClick={() => handleApproveShift(p.id)} className="p-1 bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 rounded" title="Aprobar">
                                                                                <Check size={16} />
                                                                            </button>
                                                                            <button onClick={() => handleRejectShift(p.id)} className="p-1 bg-rose-900/30 text-rose-400 hover:bg-rose-900/50 rounded" title="Rechazar">
                                                                                <X size={16} />
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                    <button onClick={() => handleDeletePayroll(p.id)} className="p-1 bg-bar-700 text-slate-400 hover:text-rose-500 rounded" title="Eliminar">
                                                                        <Trash2 size={16} />
                                                                    </button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* --- TAB CONTENT: PURCHASES --- */}
            {
                activeTab === 'PURCHASES' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                        <div className="md:col-span-1 bg-bar-800 p-6 rounded-xl border border-bar-700 h-fit">
                            <h3 className="text-lg font-bold text-bar-text mb-4">Registrar Compra</h3>
                            <form onSubmit={handleSavePurchase} className="space-y-4">
                                <div>
                                    <label className="text-sm text-slate-300">Fecha</label>
                                    <input type="date" required value={purDate} onChange={e => setPurDate(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text outline-none" />
                                </div>
                                <div>
                                    <label className="text-sm text-slate-300">Producto / Descripción</label>
                                    <input required value={purProduct} onChange={e => setPurProduct(e.target.value)} placeholder="Ej: 5 Cajas Poker" className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text outline-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-sm text-slate-300">Cantidad</label>
                                        <input type="number" required value={purQty} onChange={e => setPurQty(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text outline-none" placeholder="0" />
                                    </div>
                                    <div>
                                        <label className="text-sm text-slate-300">Costo Unit.</label>
                                        <input type="number" required value={purCost} onChange={e => setPurCost(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text outline-none" placeholder="$" />
                                    </div>
                                </div>

                                {purQty && purCost && (
                                    <div className="p-2 bg-bar-900 rounded text-center">
                                        <span className="text-xs text-slate-400">Total Compra: </span>
                                        <span className="text-bar-text font-bold">{formatMoney(Number(purQty) * Number(purCost))}</span>
                                    </div>
                                )}

                                <button type="submit" className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold py-2 rounded">Registrar</button>
                            </form>
                        </div>

                        <div className="md:col-span-2 space-y-4">
                            <h3 className="text-lg font-bold text-bar-text">Historial de Surtido</h3>

                            <div className="bg-bar-800 rounded-xl border border-bar-700 overflow-hidden">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-bar-950 text-slate-400">
                                        <tr>
                                            <th className="p-3">Fecha</th>
                                            <th className="p-3">Detalle</th>
                                            <th className="p-3 text-center">Cant.</th>
                                            <th className="p-3 text-right">Total</th>
                                            <th className="p-3 w-10"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-bar-700">
                                        {purchases.length === 0 ? (
                                            <tr><td colSpan={5} className="p-6 text-center text-slate-500">Sin registros</td></tr>
                                        ) : (
                                            purchases.sort((a, b) => b.date.localeCompare(a.date)).map(p => (
                                                <tr key={p.id} className="hover:bg-bar-700/30">
                                                    <td className="p-3 text-slate-300">{p.date}</td>
                                                    <td className="p-3 text-bar-text font-medium">
                                                        {p.productName}
                                                        <div className="text-xs text-slate-500">Unit: {formatMoney(p.unitCost)}</div>
                                                    </td>
                                                    <td className="p-3 text-center text-slate-400">{p.quantity}</td>
                                                    <td className="p-3 text-right text-bar-text font-bold">{formatMoney(p.totalCost)}</td>
                                                    <td className="p-3">
                                                        <button onClick={() => handleDeletePurchase(p.id)} className="text-rose-500 hover:text-bar-text"><Trash2 size={16} /></button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

export default Accounting;
