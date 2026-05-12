import React, { useState, useEffect } from 'react';
import {
    getFixedExpenses, saveFixedExpense, deleteFixedExpense,
    getPayroll, saveWorkShift, deleteWorkShift,
    getPurchases, savePurchase, deletePurchase,
    getSessions, getUsers, getFinancialMovements, approveFinancialMovement, rejectFinancialMovement,
    getTransactionsInRange, getCreditCustomers, approveFinancialMovementCorrection,
    getPayrollConfig, savePayrollConfig
} from '../services/db';
import {
    FixedExpense, WorkShift, Purchase, ShiftSession, User, PayrollStatus, FinancialMovement, CreditTransaction, CreditCustomer
} from '../types';
import {
    PieChart, DollarSign, Calendar, Users, ShoppingCart,
    Plus, Trash2, Save, Filter, TrendingUp, TrendingDown,
    Clock, AlertCircle, Check, X, CheckCircle, XCircle, Eye, ArrowRight, Receipt, Wallet, AlertTriangle, History
} from 'lucide-react';

interface AccountingProps {
    user: User;
}

const Accounting: React.FC<AccountingProps> = ({ user }) => {
    const [activeTab, setActiveTab] = useState<'SUMMARY' | 'EXPENSES' | 'PAYROLL' | 'PURCHASES' | 'AUDIT'>(
        user.role === 'EMPLOYEE' ? 'PAYROLL' : 'AUDIT'
    );
    const [loading, setLoading] = useState(true);

    // Data Stores
    const [expenses, setExpenses] = useState<FixedExpense[]>([]);
    const [payroll, setPayroll] = useState<WorkShift[]>([]);
    const [purchases, setPurchases] = useState<Purchase[]>([]);
    const [sessions, setSessions] = useState<ShiftSession[]>([]);
    const [employees, setEmployees] = useState<User[]>([]);
    const [financialMovements, setFinancialMovements] = useState<FinancialMovement[]>([]);
    const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
    const [allCreditCustomers, setAllCreditCustomers] = useState<CreditCustomer[]>([]);

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

    // Admin filters for Payroll
    const [dateRangeStart, setDateRangeStart] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10));
    const [dateRangeEnd, setDateRangeEnd] = useState(new Date().toISOString().slice(0, 10));
    const [filterEmployee, setFilterEmployee] = useState('ALL');
    const [filterStatus, setFilterStatus] = useState<PayrollStatus | 'ALL'>('ALL');

    // Rejection modal (Payroll)
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
    const [rejectionReason, setRejectionReason] = useState('');

    // Approval modal (Payroll)
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [approveRate, setApproveRate] = useState('');
    const [approveSurcharge, setApproveSurcharge] = useState('0');

    // Payroll Config
    const [confWeekdayRate, setConfWeekdayRate] = useState('');
    const [confWeekendRate, setConfWeekendRate] = useState('');
    const [confOvernightRate, setConfOvernightRate] = useState('');
    const [isSavingConfig, setIsSavingConfig] = useState(false);

    // Inputs - Purchases
    const [purDate, setPurDate] = useState(new Date().toISOString().slice(0, 10));
    const [purProduct, setPurProduct] = useState('');
    const [purQty, setPurQty] = useState('');
    const [purCost, setPurCost] = useState('');

    useEffect(() => {
        loadAllData();
    }, [selectedMonth]);

    const loadAllData = async () => {
        setLoading(true);
        const [e, p, pur, s, u, fm, customers, pConfig] = await Promise.all([
            getFixedExpenses(),
            getPayroll(),
            getPurchases(),
            getSessions(),
            getUsers(),
            getFinancialMovements(),
            getCreditCustomers(),
            getPayrollConfig()
        ]);
        // Load credit transactions for the selected month to calculate portfolio recovery
        const startOfMonth = `${selectedMonth}-01T00:00:00Z`;
        const endOfMonth = `${selectedMonth}-31T23:59:59Z`; // Approximate, enough for range
        const ct = await getTransactionsInRange(startOfMonth, endOfMonth);

        setExpenses(e);
        setPayroll(p);
        setPurchases(pur);
        setSessions(s);
        setEmployees(u.filter(user => user.role === 'EMPLOYEE' || user.role === 'ADMIN'));
        setFinancialMovements(fm);
        setCreditTransactions(ct);
        setAllCreditCustomers(customers);
        
        if (pConfig) {
            setConfWeekdayRate(pConfig.weekdayRate?.toString() || '');
            setConfWeekendRate(pConfig.weekendRate?.toString() || '');
            setConfOvernightRate(pConfig.overnightRate?.toString() || '');
        }

        setLoading(false);
    };

    const handleApproveCorrection = async (id: string, status: 'APPROVED' | 'REJECTED') => {
        try {
            await approveFinancialMovementCorrection(id, status, user.id);
            alert(`Corrección ${status === 'APPROVED' ? 'aprobada' : 'rechazada'} correctamente.`);
            loadAllData();
        } catch (error) {
            console.error("Error approving correction:", error);
            alert("Error al procesar la corrección.");
        }
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

    const calculateEstimate = (dateStr: string, start: string, end: string) => {
        if (!dateStr || !start || !end) return { total: 0, norm: 0, over: 0, isWeekend: false };
        const date = new Date(dateStr);
        const day = date.getUTCDay();
        const isWeekend = day === 0 || day === 6;
        const baseRate = isWeekend ? Number(confWeekendRate) : Number(confWeekdayRate);
        const overRate = Number(confOvernightRate);

        const [startH, startM] = start.split(':').map(Number);
        const [endH, endM] = end.split(':').map(Number);
        const startMin = startH * 60 + startM;
        let endMin = endH * 60 + endM;

        let normMin = 0;
        let overMin = 0;

        if (endMin < startMin) {
            normMin = 1440 - startMin;
            overMin = endMin;
        } else {
            if (startMin < 360) overMin = endMin - startMin;
            else normMin = endMin - startMin;
        }

        const total = (normMin / 60) * baseRate + (overMin / 60) * overRate;
        return { total, norm: normMin / 60, over: overMin / 60, isWeekend };
    };

    const handleSavePayroll = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Future date validation
        const today = new Date().toISOString().slice(0, 10);
        if (payDate > today) {
            alert('❌ No puedes registrar turnos con fecha futura.');
            return;
        }

        const targetEmployeeId = user.role === 'ADMIN' ? payEmployeeId : user.id;
        
        if (!targetEmployeeId) {
            alert('Por favor selecciona un empleado.');
            return;
        }
        if (!payStartTime || !payEndTime) {
            alert('Por favor indica hora de inicio y fin.');
            return;
        }

        const hours = calculateHours(payStartTime, payEndTime);
        const rate = user.role === 'ADMIN' ? Number(payRate) : 0;
        const sur = user.role === 'ADMIN' ? Number(paySurcharge) : 0;
        const total = (hours * rate) + sur;

        const emp = employees.find(u => u.id === targetEmployeeId) || (user.role === 'EMPLOYEE' ? user : undefined);

        try {
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

            alert('✅ Turno registrado correctamente. Pendiente de aprobación.');
            setPayStartTime(''); setPayEndTime(''); setPaySurcharge('0');
            setPayroll(await getPayroll());
        } catch (error) {
            console.error(error);
            alert('❌ Error al registrar turno. Por favor intenta de nuevo.');
        }
    };

    const handleApproveShift = (id: string) => {
        const shift = payroll.find(s => s.id === id);
        if (!shift) return;
        setSelectedShiftId(id);
        setApproveRate(shift.hourlyRate > 0 ? shift.hourlyRate.toString() : '');
        setApproveSurcharge(shift.surcharges.toString());
        setShowApproveModal(true);
    };

    const confirmApproveShift = async () => {
        if (!selectedShiftId) return;
        const shift = payroll.find(s => s.id === selectedShiftId);
        if (!shift) return;
        
        const surcharge = Number(approveSurcharge) || 0;
        
        const updated = {
            ...shift,
            surcharges: surcharge,
            status: 'APPROVED' as PayrollStatus,
            approvedAt: new Date().toISOString(),
            approvedBy: user.id
        };
        
        try {
            await saveWorkShift(updated as any);
            setPayroll(await getPayroll());
            setShowApproveModal(false);
            setSelectedShiftId(null);
        } catch (error) {
            console.error(error);
            alert('Error al aprobar el turno.');
        }
    };

    const handleRejectShift = (id: string) => {
        setSelectedShiftId(id);
        setRejectionReason('');
        setShowRejectModal(true);
    };

    const confirmRejectShift = async () => {
        if (!selectedShiftId || !rejectionReason.trim()) return;
        const shift = payroll.find(s => s.id === selectedShiftId);
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
    };

    const handleDeletePayroll = async (id: string) => {
        if (window.confirm('¿Borrar este registro de turno?')) {
            await deleteWorkShift(id);
            setPayroll(await getPayroll());
        }
    };

    const handleSavePayrollConfig = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingConfig(true);
        try {
            await savePayrollConfig({
                weekdayRate: Number(confWeekdayRate),
                weekendRate: Number(confWeekendRate),
                overnightRate: Number(confOvernightRate),
                updatedBy: user.name
            });
            alert('✅ Tarifas actualizadas correctamente.');
        } catch (error) {
            console.error(error);
            alert('❌ Error al guardar las tarifas.');
        } finally {
            setIsSavingConfig(false);
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

    // FINANCIAL AUDIT
    const handleApproveMovement = async (id: string) => {
        if (!window.confirm('¿Aprobar este movimiento financiero?')) return;
        try {
            await approveFinancialMovement(id, user.id);
            setFinancialMovements(await getFinancialMovements());
        } catch (error) {
            alert('Error al aprobar movimiento');
        }
    };

    const handleRejectMovement = async (id: string) => {
        const reason = window.prompt('Motivo del rechazo:');
        if (reason === null) return;
        if (!reason.trim()) {
            alert('Debes indicar un motivo');
            return;
        }
        try {
            await rejectFinancialMovement(id, user.id, reason);
            setFinancialMovements(await getFinancialMovements());
        } catch (error) {
            alert('Error al rechazar movimiento');
        }
    };

    // --- CALCULATIONS FOR SUMMARY ---

    const getSummaryData = () => {
        const monthlySessions = sessions.filter(s => s.closedAt?.startsWith(selectedMonth));
        const totalRevenue = monthlySessions.reduce((acc, s) => acc + (s.salesReport?.totalRevenue || 0), 0);

        const monthlyPurchases = purchases.filter(p => p.date.startsWith(selectedMonth));
        const totalPurchases = monthlyPurchases.reduce((acc, p) => acc + p.totalCost, 0);

        const monthlyPayroll = payroll.filter(p => p.date.startsWith(selectedMonth) && p.status === 'APPROVED');
        const totalPayroll = monthlyPayroll.reduce((acc, p) => acc + p.totalPay, 0);

        const totalFixed = expenses.filter(e => e.type === 'EXPENSE').reduce((acc, e) => acc + e.amount, 0);
        const totalBank = expenses.filter(e => e.type === 'BANK_COMMITMENT').reduce((acc, e) => acc + e.amount, 0);

        // Financial Movements (APPROVED)
        const monthlyApprovedMovements = financialMovements.filter(m => m.status === 'APPROVED' && m.date.startsWith(selectedMonth));
        
        const totalProduction = monthlyApprovedMovements
            .filter(m => m.type === 'PRODUCTION')
            .reduce((acc, m) => acc + m.amount, 0);
            
        const totalSupplierPaymentsFromAdmin = monthlyApprovedMovements
            .filter(m => m.type === 'PAYMENT' && m.source === 'ADMIN_FUNDS')
            .reduce((acc, m) => acc + m.amount, 0);

        // Portfolio Recovery (Abonos where shiftSessionId != originalShiftSessionId)
        const portfolioRecovery = creditTransactions
            .filter(t => t.type === 'PAYMENT' && t.shiftSessionId !== t.originalShiftSessionId)
            .reduce((acc, t) => acc + t.amount, 0);

        const totalExpenses = totalPurchases + totalPayroll + totalFixed + totalBank + totalSupplierPaymentsFromAdmin;
        const realProfit = (totalRevenue + totalProduction) - totalExpenses;

        // Total Portfolio (Sum of currentUsed from all active customers)
        const totalPendingPortfolio = allCreditCustomers
            .filter(c => c.active)
            .reduce((acc, c) => acc + c.currentUsed, 0);

        return {
            totalRevenue: totalRevenue + totalProduction,
            totalPurchases,
            totalPayroll,
            totalFixed,
            totalBank,
            totalSupplierPaymentsFromAdmin,
            totalExpenses,
            realProfit,
            totalProduction,
            portfolioRecovery,
            totalPendingPortfolio
        };
    };

    const summary = getSummaryData();

    // Filter payroll list
    const filteredPayroll = payroll.filter(p => {
        const itemDate = p.date.slice(0, 10);
        const dateMatch = itemDate >= dateRangeStart && itemDate <= dateRangeEnd;
        const empMatch = user.role === 'ADMIN' ? (filterEmployee === 'ALL' || p.employeeId === filterEmployee) : (p.employeeId === user.id);
        const statusMatch = filterStatus === 'ALL' || p.status === filterStatus;
        return dateMatch && empMatch && statusMatch;
    });

    const totalFilteredPayroll = filteredPayroll.reduce((acc, p) => acc + p.totalPay, 0);
    const pendingShiftsCount = payroll.filter(p => p.status === 'PENDING').length;
    const pendingFinancialMovements = financialMovements.filter(m => m.status === 'PENDING');
    const pendingCorrections = financialMovements.filter(m => m.correctionStatus === 'PENDING');

    if (loading) return <div className="p-8 text-center text-slate-400">Cargando contabilidad...</div>;

    return (
        <div className="space-y-6 pb-20">
            {/* Rejection Modal (Payroll) */}
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
                            <button onClick={() => setShowRejectModal(false)} className="flex-1 bg-bar-700 hover:bg-bar-600 text-bar-text py-2 rounded">Cancelar</button>
                            <button onClick={confirmRejectShift} disabled={!rejectionReason.trim()} className="flex-1 bg-rose-600 hover:bg-rose-500 text-bar-text py-2 rounded disabled:opacity-50">Rechazar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Approval Modal (Payroll) */}
            {showApproveModal && (() => {
                const shift = payroll.find(s => s.id === selectedShiftId);
                if (!shift) return null;

                const date = new Date(shift.date);
                const day = date.getUTCDay();
                const isWeekend = day === 0 || day === 6;
                const baseRate = isWeekend ? Number(confWeekendRate) : Number(confWeekdayRate);
                
                // Simple preview logic (same as backend)
                const [startH, startM] = shift.startTime.split(':').map(Number);
                const [endH, endM] = shift.endTime.split(':').map(Number);
                const startMin = startH * 60 + startM;
                let endMin = endH * 60 + endM;

                let normMin = 0;
                let overMin = 0;

                if (endMin < startMin) {
                    normMin = 1440 - startMin;
                    overMin = endMin;
                } else {
                    if (startMin < 360) overMin = endMin - startMin;
                    else normMin = endMin - startMin;
                }

                const estimatedTotal = (normMin / 60) * baseRate + (overMin / 60) * Number(confOvernightRate) + (Number(approveSurcharge) || 0);

                return (
                    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
                        <div className="bg-bar-800 w-full max-w-md rounded-3xl border border-bar-700 p-8 shadow-2xl">
                            <h3 className="text-2xl font-black text-bar-text mb-2 uppercase tracking-tighter">Aprobar Turno</h3>
                            <p className="text-slate-400 text-sm mb-6">Revisa el cálculo automático antes de confirmar.</p>
                            
                            <div className="space-y-4 mb-8">
                                <div className="bg-bar-950/50 p-5 rounded-2xl border border-bar-700/50 space-y-3">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-500 font-bold uppercase tracking-wider">Tipo de Día:</span>
                                        <span className={`font-black uppercase ${isWeekend ? 'text-amber-500' : 'text-emerald-500'}`}>
                                            {isWeekend ? 'Fin de Semana' : 'Día Ordinario'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-500 font-bold uppercase tracking-wider">Tarifa Base:</span>
                                        <span className="text-bar-text font-mono font-bold">{formatMoney(baseRate)}/h</span>
                                    </div>
                                    {overMin > 0 && (
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-500 font-bold uppercase tracking-wider">Tarifa Nocturna:</span>
                                            <span className="text-bar-text font-mono font-bold">{formatMoney(Number(confOvernightRate))}/h</span>
                                        </div>
                                    )}
                                    <div className="pt-3 border-t border-bar-700 flex justify-between items-center">
                                        <span className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Total Estimado:</span>
                                        <span className="text-2xl font-black text-emerald-400 font-mono">{formatMoney(Math.round(estimatedTotal))}</span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Recargos / Bonos Extras</label>
                                    <input 
                                        type="number" 
                                        value={approveSurcharge} 
                                        onChange={(e) => setApproveSurcharge(e.target.value)} 
                                        placeholder="0" 
                                        className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-bar-text font-bold focus:border-bar-500 outline-none" 
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button onClick={() => setShowApproveModal(false)} className="flex-1 py-4 bg-bar-700 hover:bg-bar-600 text-bar-text rounded-2xl font-bold transition-all">Cancelar</button>
                                <button 
                                    onClick={confirmApproveShift} 
                                    className="flex-1 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-emerald-900/20 transition-all active:scale-95"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="w-full">
                    <h2 className="text-2xl md:text-3xl font-black text-bar-text uppercase tracking-tight">Contabilidad</h2>
                    <p className="text-slate-400 text-sm">Gestión financiera integral</p>
                </div>
                <div className="w-full md:w-auto flex items-center justify-between md:justify-start gap-2 bg-bar-800 p-2 rounded-xl border border-bar-700">
                    <Calendar size={18} className="text-slate-400" />
                    <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="bg-transparent text-bar-text outline-none font-bold text-sm" />
                </div>
            </div>

            {/* TABS */}
            <div className="flex overflow-x-auto no-scrollbar gap-1 border-b border-bar-700 -mx-4 px-4 md:mx-0 md:px-0">
                {user.role === 'ADMIN' && (
                    <button onClick={() => setActiveTab('SUMMARY')} className={`px-4 py-3 rounded-t-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap text-sm ${activeTab === 'SUMMARY' ? 'bg-bar-800 text-bar-500 border-t border-x border-bar-700' : 'text-slate-400'}`}><PieChart size={18} /> Resumen</button>
                )}
                {user.role === 'ADMIN' && (
                    <button onClick={() => setActiveTab('EXPENSES')} className={`px-4 py-3 rounded-t-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap text-sm ${activeTab === 'EXPENSES' ? 'bg-bar-800 text-bar-500 border-t border-x border-bar-700' : 'text-slate-400'}`}><DollarSign size={18} /> Gastos Fijos</button>
                )}
                <button onClick={() => setActiveTab('PAYROLL')} className={`px-4 py-3 rounded-t-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap text-sm ${activeTab === 'PAYROLL' ? 'bg-bar-800 text-bar-500 border-t border-x border-bar-700' : 'text-slate-400'}`}>
                    <Users size={18} /> Nómina
                    {pendingShiftsCount > 0 && user.role === 'ADMIN' && <span className="bg-amber-500 text-bar-950 text-[10px] px-1.5 py-0.5 rounded-full">{pendingShiftsCount}</span>}
                </button>
                {user.role === 'ADMIN' && (
                    <>
                        <button onClick={() => setActiveTab('PURCHASES')} className={`px-4 py-3 rounded-t-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap text-sm ${activeTab === 'PURCHASES' ? 'bg-bar-800 text-bar-500 border-t border-x border-bar-700' : 'text-slate-400'}`}><ShoppingCart size={18} /> Compras</button>
                        <button onClick={() => setActiveTab('AUDIT')} className={`px-4 py-3 rounded-t-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap text-sm ${activeTab === 'AUDIT' ? 'bg-bar-800 text-bar-500 border-t border-x border-bar-700' : 'text-slate-400'}`}>
                            <AlertCircle size={18} /> Auditoría
                            {(pendingFinancialMovements.length > 0 || pendingCorrections.length > 0) && (
                                <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.5 rounded-full animate-pulse ml-2">
                                    {pendingFinancialMovements.length + pendingCorrections.length}
                                </span>
                            )}
                        </button>
                    </>
                )}
            </div>

            {/* TAB CONTENT: SUMMARY */}
            {activeTab === 'SUMMARY' && user.role === 'ADMIN' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        <div className="bg-bar-800 p-6 rounded-2xl border border-bar-700 shadow-xl">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Ingresos Totales</span>
                            <p className="text-2xl md:text-3xl font-black text-bar-text mt-2">{formatMoney(summary.totalRevenue)}</p>
                            <p className="text-[10px] text-slate-500 mt-1 uppercase">Ventas + Producción</p>
                        </div>
                        <div className="bg-bar-800 p-6 rounded-2xl border border-bar-700 shadow-xl">
                            <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Total Egresos</span>
                            <p className="text-2xl md:text-3xl font-black text-rose-400 mt-2">-{formatMoney(summary.totalExpenses)}</p>
                            <p className="text-[10px] text-slate-500 mt-1 uppercase">Gastos Operativos</p>
                        </div>
                        <div className={`p-6 rounded-2xl border shadow-xl ${summary.realProfit >= 0 ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-rose-900/20 border-rose-500/50'}`}>
                            <span className="text-[10px] font-black uppercase tracking-widest">Ganancia Real</span>
                            <p className={`text-3xl md:text-4xl font-black mt-2 ${summary.realProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatMoney(summary.realProfit)}</p>
                        </div>
                        <div className="bg-amber-500/10 p-6 rounded-2xl border border-amber-500/30 shadow-xl">
                            <span className="text-amber-500 text-[10px] font-black uppercase tracking-widest">Cartera Pendiente</span>
                            <p className="text-2xl md:text-3xl font-black text-amber-500 mt-2">{formatMoney(summary.totalPendingPortfolio)}</p>
                            <p className="text-[10px] text-slate-500 mt-1 uppercase">Por cobrar</p>
                        </div>
                    </div>

                    <div className="bg-bar-800 rounded-xl border border-bar-700 overflow-hidden">
                        <div className="p-4 bg-bar-900/50 border-b border-bar-700 font-bold text-bar-text">Desglose Mensual</div>
                        <div className="divide-y divide-bar-700">
                            <div className="p-4 flex justify-between"><span>Gastos Fijos</span><span className="font-mono">{formatMoney(summary.totalFixed)}</span></div>
                            <div className="p-4 flex justify-between"><span>Bancos / Créditos</span><span className="font-mono">{formatMoney(summary.totalBank)}</span></div>
                            <div className="p-4 flex justify-between"><span>Nómina Aprobada</span><span className="font-mono">{formatMoney(summary.totalPayroll)}</span></div>
                            <div className="p-4 flex justify-between"><span>Compras de Inventario</span><span className="font-mono">{formatMoney(summary.totalPurchases)}</span></div>
                            <div className="p-4 flex justify-between"><span>Producción Extra (Aprobada)</span><span className="text-emerald-400 font-mono">+{formatMoney(summary.totalProduction)}</span></div>
                            <div className="p-4 flex justify-between items-start">
                                <div>
                                    <span>Pagos con Fondos Ya Entregados (Admin)</span>
                                    <p className="text-[10px] text-slate-500 italic">No afecta el cuadre de caja</p>
                                </div>
                                <span className="text-rose-400 font-mono">-{formatMoney(summary.totalSupplierPaymentsFromAdmin)}</span>
                            </div>
                            <div className="p-4 flex justify-between bg-bar-900/30 border-t border-bar-700">
                                <span className="flex items-center gap-2 text-bar-500 font-bold uppercase text-[10px] tracking-widest">
                                    <Wallet size={14} /> Recuperación de Cartera
                                </span>
                                <span className="text-bar-500 font-mono font-bold">{formatMoney(summary.portfolioRecovery)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: EXPENSES */}
            {activeTab === 'EXPENSES' && user.role === 'ADMIN' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                    <div className="bg-bar-800 p-6 rounded-xl border border-bar-700 h-fit">
                        <h3 className="text-lg font-bold text-bar-text mb-4">Registrar Gasto / Deuda</h3>
                        <form onSubmit={handleSaveExpense} className="space-y-4">
                            <select value={expType} onChange={(e: any) => setExpType(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text text-sm"><option value="EXPENSE">Gasto Fijo</option><option value="BANK_COMMITMENT">Compromiso Bancario</option></select>
                            <input required value={expName} onChange={e => setExpName(e.target.value)} placeholder="Concepto (Arriendo, Luz...)" className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text text-sm" />
                            <input required type="number" min="0" value={expAmount} onChange={e => setExpAmount(e.target.value)} placeholder="Valor Mensual" className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text text-sm" />
                            <input required value={expDate} onChange={e => setExpDate(e.target.value)} placeholder="Fecha/Día de Pago" className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text text-sm" />
                            <button type="submit" className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold py-2 rounded">Guardar</button>
                        </form>
                    </div>
                    <div className="md:col-span-2 space-y-3">
                        {expenses.length === 0 && <p className="text-slate-500">No hay gastos registrados.</p>}
                        {expenses.map(exp => (
                            <div key={exp.id} className="bg-bar-800 border border-bar-700 p-4 rounded-xl flex justify-between items-center transition-all hover:border-bar-500/50">
                                <div><p className="font-bold text-bar-text">{exp.name}</p><p className="text-xs text-slate-400">{exp.paymentDay} - {exp.type === 'EXPENSE' ? 'Fijo' : 'Banco'}</p></div>
                                <div className="text-right"><p className="font-mono text-bar-text font-bold">{formatMoney(exp.amount)}</p><button onClick={() => handleDeleteExpense(exp.id)} className="text-rose-500 hover:text-rose-400 text-xs mt-1">Eliminar</button></div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB CONTENT: PAYROLL */}
            {activeTab === 'PAYROLL' && (
                <div className="space-y-6 animate-in fade-in">
                    {/* Tarifa Config (Admin Only) */}
                    {user.role === 'ADMIN' && (
                        <div className="bg-bar-800 p-6 rounded-3xl border border-bar-700 shadow-2xl">
                            <h3 className="text-xl font-black text-bar-text mb-6 uppercase tracking-tighter flex items-center gap-2">
                                <DollarSign size={24} className="text-bar-500" />
                                Configuración de Tarifas Globales
                            </h3>
                            <form onSubmit={handleSavePayrollConfig} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Hora Entre Semana</label>
                                    <input 
                                        type="number" 
                                        value={confWeekdayRate} 
                                        onChange={e => setConfWeekdayRate(e.target.value)} 
                                        className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-bar-text font-bold focus:border-bar-500 outline-none" 
                                        placeholder="$"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Hora Fines/Festivos</label>
                                    <input 
                                        type="number" 
                                        value={confWeekendRate} 
                                        onChange={e => setConfWeekendRate(e.target.value)} 
                                        className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-bar-text font-bold focus:border-bar-500 outline-none" 
                                        placeholder="$"
                                    />
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Hora Nocturna (12am+)</label>
                                    <input 
                                        type="number" 
                                        value={confOvernightRate} 
                                        onChange={e => setConfOvernightRate(e.target.value)} 
                                        className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-bar-text font-bold focus:border-bar-500 outline-none" 
                                        placeholder="$"
                                    />
                                </div>
                                <button 
                                    type="submit" 
                                    disabled={isSavingConfig}
                                    className="bg-bar-500 hover:bg-bar-400 text-bar-950 font-black uppercase tracking-widest py-4 px-6 rounded-2xl transition-all active:scale-95 disabled:opacity-50"
                                >
                                    {isSavingConfig ? 'Guardando...' : 'Guardar Tarifas'}
                                </button>
                            </form>
                        </div>
                    )}

                    <div className="bg-bar-800 p-4 rounded-xl border border-bar-700 flex flex-wrap gap-4 items-end">
                        <div><label className="text-[10px] text-slate-400 block mb-1">Desde</label><input type="date" value={dateRangeStart} onChange={e => setDateRangeStart(e.target.value)} className="bg-bar-900 border border-bar-600 rounded p-1.5 text-bar-text text-xs" /></div>
                        <div><label className="text-[10px] text-slate-400 block mb-1">Hasta</label><input type="date" value={dateRangeEnd} onChange={e => setDateRangeEnd(e.target.value)} className="bg-bar-900 border border-bar-600 rounded p-1.5 text-bar-text text-xs" /></div>
                        {user.role === 'ADMIN' && (
                            <div>
                                <label className="text-[10px] text-slate-400 block mb-1">Empleado</label>
                                <select value={filterEmployee} onChange={e => setFilterEmployee(e.target.value)} className="bg-bar-900 border border-bar-600 rounded p-1.5 text-bar-text text-xs">
                                    <option value="ALL">Todos</option>
                                    {employees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="ml-auto bg-emerald-900/30 px-4 py-2 rounded-lg border border-emerald-500/30"><span className="text-emerald-400 text-xs font-bold">Total: {formatMoney(totalFilteredPayroll)}</span></div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-bar-800 p-6 rounded-3xl border border-bar-700 h-fit shadow-2xl">
                            <h3 className="text-xl font-black text-bar-text mb-6 uppercase tracking-tighter flex items-center gap-2">
                                <Clock size={24} className="text-bar-500" />
                                Registrar Turno
                            </h3>
                            <form onSubmit={handleSavePayroll} className="space-y-6">
                                {user.role === 'ADMIN' && (
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Empleado</label>
                                        <select required value={payEmployeeId} onChange={e => setPayEmployeeId(e.target.value)} className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-bar-text font-bold focus:border-bar-500 outline-none">
                                            <option value="">Seleccionar...</option>
                                            {employees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                        </select>
                                    </div>
                                )}
                                
                                <div>
                                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Fecha del Turno</label>
                                    <input type="date" required value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-bar-text font-bold focus:border-bar-500 outline-none" />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Entrada</label>
                                        <input type="time" required value={payStartTime} onChange={e => setPayStartTime(e.target.value)} className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-bar-text font-bold focus:border-bar-500 outline-none" />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Salida</label>
                                        <input type="time" required value={payEndTime} onChange={e => setPayEndTime(e.target.value)} className="w-full bg-bar-900 border border-bar-700 rounded-2xl p-4 text-bar-text font-bold focus:border-bar-500 outline-none" />
                                    </div>
                                </div>

                                {/* Preview Section */}
                                {payStartTime && payEndTime && (
                                    <div className="bg-bar-950/50 p-5 rounded-2xl border border-bar-700/50 space-y-3 animate-in zoom-in-95 duration-200">
                                        {(() => {
                                            const est = calculateEstimate(payDate, payStartTime, payEndTime);
                                            return (
                                                <>
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="text-slate-500 font-bold uppercase tracking-widest">Día:</span>
                                                        <span className={est.isWeekend ? 'text-amber-500 font-black' : 'text-emerald-500 font-black'}>{est.isWeekend ? 'FIN DE SEMANA' : 'ORDINARIO'}</span>
                                                    </div>
                                                    <div className="flex justify-between text-[10px]">
                                                        <span className="text-slate-500 font-bold uppercase tracking-widest">Horas Normales:</span>
                                                        <span className="text-bar-text font-black">{est.norm.toFixed(1)}h</span>
                                                    </div>
                                                    {est.over > 0 && (
                                                        <div className="flex justify-between text-[10px]">
                                                            <span className="text-slate-500 font-bold uppercase tracking-widest">Horas Nocturnas:</span>
                                                            <span className="text-amber-400 font-black">{est.over.toFixed(1)}h</span>
                                                        </div>
                                                    )}
                                                    <div className="pt-3 border-t border-bar-700 flex justify-between items-center">
                                                        <span className="text-slate-400 font-black uppercase text-[10px] tracking-widest">Estimado:</span>
                                                        <span className="text-xl font-black text-emerald-400 font-mono">{formatMoney(Math.round(est.total))}</span>
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                )}

                                <button 
                                    type="submit" 
                                    className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-black uppercase tracking-widest py-4 rounded-2xl shadow-lg transition-all active:scale-95"
                                >
                                    Guardar Turno
                                </button>
                            </form>
                        </div>
                        <div className="lg:col-span-2 overflow-hidden bg-bar-800 rounded-2xl border border-bar-700 shadow-xl">
                            <table className="w-full text-left text-xs">
                                <thead className="bg-bar-950 text-slate-400">
                                    <tr>
                                        <th className="p-4 hidden md:table-cell">Fecha</th>
                                        <th className="p-4">Empleado</th>
                                        <th className="p-4 text-center hidden md:table-cell">Horas</th>
                                        <th className="p-4 text-center">Estado</th>
                                        <th className="p-4 text-right">Total</th>
                                        <th className="p-4"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-bar-700">
                                    {filteredPayroll.map(p => (
                                        <tr key={p.id} className="hover:bg-bar-700/20 transition-colors">
                                            <td className="p-4 font-mono hidden md:table-cell text-slate-500">{p.date.slice(0, 10)}</td>
                                            <td className="p-4">
                                                <p className="font-bold text-bar-text">{p.employeeName}</p>
                                                <p className="text-[10px] text-slate-500 md:hidden">{p.date.slice(0, 10)} | {p.hoursWorked}h</p>
                                            </td>
                                            <td className="p-4 text-center hidden md:table-cell">{p.hoursWorked}h</td>
                                            <td className="p-4 text-center">
                                                <span className={`px-2 py-1 rounded-lg font-black text-[9px] uppercase tracking-wider border ${
                                                    p.status === 'APPROVED' 
                                                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                                                        : p.status === 'REJECTED' 
                                                        ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                                                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                                                }`}>
                                                    {p.status === 'APPROVED' ? 'Aprobado' : p.status === 'REJECTED' ? 'Rechazado' : 'Pendiente'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right font-bold text-emerald-400">{formatMoney(p.totalPay)}</td>
                                            <td className="p-4">
                                                <div className="flex gap-1 justify-end">
                                                    {user.role === 'ADMIN' && p.status === 'PENDING' && (
                                                        <>
                                                            <button onClick={() => handleApproveShift(p.id)} className="p-1 hover:text-emerald-400 text-slate-400"><Check size={16} /></button>
                                                            <button onClick={() => handleRejectShift(p.id)} className="p-1 hover:text-rose-400 text-slate-400"><X size={16} /></button>
                                                        </>
                                                    )}
                                                    <button onClick={() => handleDeletePayroll(p.id)} className="p-1 hover:text-rose-500 text-slate-600"><Trash2 size={16} /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB CONTENT: AUDIT */}
            {activeTab === 'AUDIT' && user.role === 'ADMIN' && (
                <div className="space-y-4 animate-in fade-in">
                    <h3 className="text-xl font-bold text-bar-text">Auditoría de Movimientos</h3>
                    
                    {/* CORRECTIONS SECTION */}
                    {pendingCorrections.length > 0 && (
                        <div className="space-y-4 mb-8">
                            <h3 className="text-amber-500 font-bold flex items-center gap-2 px-2 uppercase text-xs tracking-widest">
                                <AlertTriangle size={16} /> Solicitudes de Corrección de Monto
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {pendingCorrections.map(m => (
                                    <div key={m.id} className="bg-amber-900/10 border border-amber-500/30 p-5 rounded-2xl relative overflow-hidden">
                                        <div className="absolute top-0 right-0 bg-amber-500 text-bar-900 px-3 py-1 text-[10px] font-black uppercase">
                                            Pendiente
                                        </div>
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h4 className="text-bar-text font-bold text-lg">{m.employeeName}</h4>
                                                <p className="text-slate-400 text-xs italic">{m.description || (m.type === 'PRODUCTION' ? 'Producción Extra' : 'Pago Proveedor')}</p>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-2 gap-4 mb-5 bg-bar-950/50 p-3 rounded-xl border border-bar-700/50">
                                            <div>
                                                <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Monto Original</p>
                                                <p className="text-lg font-mono text-slate-400 line-through">{formatMoney(m.amount)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-amber-500 font-bold uppercase mb-1">Monto Solicitado</p>
                                                <p className="text-xl font-mono text-amber-400 font-bold">{formatMoney(m.correctionRequestedAmount || 0)}</p>
                                            </div>
                                        </div>

                                        <div className="mb-6">
                                            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Razón de la Corrección</p>
                                            <p className="text-sm text-slate-300 bg-bar-900/50 p-3 rounded-lg border border-bar-800">
                                                "{m.correctionReason}"
                                            </p>
                                        </div>

                                        <div className="flex gap-3">
                                            <button 
                                                onClick={() => handleApproveCorrection(m.id, 'REJECTED')}
                                                className="flex-1 py-2.5 bg-bar-800 hover:bg-rose-900/30 text-slate-400 hover:text-rose-400 border border-bar-700 hover:border-rose-500/50 rounded-xl text-sm font-bold transition-all"
                                            >
                                                Rechazar
                                            </button>
                                            <button 
                                                onClick={() => handleApproveCorrection(m.id, 'APPROVED')}
                                                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-emerald-900/20 transition-all"
                                            >
                                                Aprobar
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-4">
                        {financialMovements.length === 0 ? <p className="text-center text-slate-500 py-10">No hay movimientos para auditar.</p> :
                            financialMovements.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(m => (
                                <div key={m.id} className={`bg-bar-800 rounded-xl border p-4 transition-all ${m.status === 'PENDING' ? 'border-amber-500 shadow-lg' : 'border-bar-700 opacity-60'}`}>
                                    <div className="flex flex-col md:flex-row justify-between gap-4">
                                        <div className="flex items-center gap-4">
                                            <div className={`p-3 rounded-full ${m.type === 'PRODUCTION' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                                                {m.type === 'PRODUCTION' ? <TrendingUp size={24} /> : <Receipt size={24} />}
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-bold text-bar-text uppercase text-xs tracking-widest">{m.type === 'PRODUCTION' ? 'Producción' : 'Pago'}</h4>
                                                <p className="text-2xl font-bold">{formatMoney(m.amount)}</p>
                                                <p className="text-xs text-slate-400">{m.date} - Por: {m.employeeName}</p>
                                            </div>
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            {m.type === 'PAYMENT' && <p className="text-xs font-bold text-slate-300">Factura: {m.invoiceNumber} | Origen: {m.source === 'CASH_DRAWER' ? 'CAJA' : 'ADMIN'}</p>}
                                            <p className="text-sm text-slate-400 italic">"{m.description}"</p>
                                            {m.status === 'REJECTED' && <p className="text-xs text-rose-400 bg-rose-900/20 p-1 rounded">Razón: {m.rejectionReason}</p>}
                                            {m.originalAmount && (
                                                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 bg-bar-900/40 p-1.5 rounded border border-bar-700/30 mt-1">
                                                    <History size={12} className="text-amber-500/50" />
                                                    <span>
                                                        Monto corregido: de <span className="line-through">{formatMoney(m.originalAmount)}</span> a <span className="font-bold text-slate-400">{formatMoney(m.amount)}</span> — Razón: <span className="italic">{m.correctionReason}</span>
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {m.status === 'PENDING' && (
                                            <div className="flex md:flex-col gap-2">
                                                <button 
                                                    disabled={m.correctionStatus === 'PENDING'}
                                                    onClick={() => handleApproveMovement(m.id)} 
                                                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <Check size={18}/> Aprobar
                                                </button>
                                                <button 
                                                    disabled={m.correctionStatus === 'PENDING'}
                                                    onClick={() => handleRejectMovement(m.id)} 
                                                    className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                                                >
                                                    <X size={18}/> Rechazar
                                                </button>
                                                {m.correctionStatus === 'PENDING' && (
                                                    <p className="text-[10px] text-amber-500 font-bold italic text-center animate-pulse">
                                                        Corrección pendiente de revisión
                                                    </p>
                                                )}
                                            </div>
                                        )}
                                        {m.status !== 'PENDING' && <div className="flex items-center"><span className={`px-3 py-1 rounded-full text-xs font-black uppercase ${m.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>{m.status}</span></div>}
                                    </div>
                                </div>
                            ))
                        }
                    </div>
                </div>
            )}

            {/* TAB CONTENT: PURCHASES */}
            {activeTab === 'PURCHASES' && user.role === 'ADMIN' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in">
                    <div className="bg-bar-800 p-6 rounded-xl border border-bar-700 h-fit">
                        <h3 className="text-lg font-bold text-bar-text mb-4">Registrar Compra</h3>
                        <form onSubmit={handleSavePurchase} className="space-y-4">
                            <input type="date" required value={purDate} onChange={e => setPurDate(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text text-sm" />
                            <input required value={purProduct} onChange={e => setPurProduct(e.target.value)} placeholder="Producto" className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text text-sm" />
                            <div className="grid grid-cols-2 gap-2">
                                <input type="number" required value={purQty} onChange={e => setPurQty(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text text-sm" placeholder="Cant." />
                                <input type="number" required value={purCost} onChange={e => setPurCost(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text text-sm" placeholder="Costo Unit" />
                            </div>
                            <button type="submit" className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold py-2 rounded">Registrar</button>
                        </form>
                    </div>
                    <div className="md:col-span-2 overflow-hidden bg-bar-800 rounded-2xl border border-bar-700 shadow-xl">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-bar-950 text-slate-400">
                                <tr>
                                    <th className="p-4 hidden md:table-cell">Fecha</th>
                                    <th className="p-4">Producto</th>
                                    <th className="p-4 text-center hidden md:table-cell">Cant.</th>
                                    <th className="p-4 text-right">Total</th>
                                    <th className="p-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-bar-700">
                                {purchases.map(p => (
                                    <tr key={p.id} className="hover:bg-bar-700/20 transition-colors">
                                        <td className="p-4 hidden md:table-cell text-slate-500 font-mono">{p.date}</td>
                                        <td className="p-4">
                                            <p className="font-bold text-bar-text">{p.productName}</p>
                                            <p className="text-[10px] text-slate-500 md:hidden">{p.date} | {p.quantity} uds</p>
                                        </td>
                                        <td className="p-4 text-center hidden md:table-cell">{p.quantity}</td>
                                        <td className="p-4 text-right font-bold text-bar-text">{formatMoney(p.totalCost)}</td>
                                        <td className="p-4">
                                            <button onClick={() => handleDeletePurchase(p.id)} className="p-1 text-rose-500 hover:text-rose-400">
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Accounting;
