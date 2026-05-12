import React, { useState, useEffect } from 'react';
import { getCreditCustomers, saveCreditCustomer, registerCreditTransaction, registerPaymentTransaction, getCustomerHistory, getActiveSession } from '../services/db';
import { CreditCustomer, CreditTransaction, User, PaymentMethod, ShiftSession } from '../types';
import {
    Plus, Edit2, Search, DollarSign,
    AlertTriangle, Lock, History, CheckCircle, X, Check, Wallet, Banknote, ArrowDownCircle, ArrowUpCircle
} from 'lucide-react';

interface Props {
    user: User;
}

const CreditCustomers: React.FC<Props> = ({ user }) => {
    const [customers, setCustomers] = useState<CreditCustomer[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Modals state
    const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
    const [isFiaoModalOpen, setIsFiaoModalOpen] = useState(false);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);

    // Selection state
    const [selectedCustomer, setSelectedCustomer] = useState<CreditCustomer | null>(null);
    const [history, setHistory] = useState<CreditTransaction[]>([]);
    const [activeSession, setActiveSession] = useState<ShiftSession | null>(null);
    const [selectedOriginalDebt, setSelectedOriginalDebt] = useState<CreditTransaction | null>(null);

    // Form states (Customer)
    const [cName, setCName] = useState('');
    const [cDoc, setCDoc] = useState('');
    const [cPhone, setCPhone] = useState('');
    const [cLimit, setCLimit] = useState('');
    const [cObs, setCObs] = useState('');
    const [cActive, setCActive] = useState(true);

    // Form states (Fiao)
    const [fAmount, setFAmount] = useState('');
    const [fObs, setFObs] = useState('');
    const [fError, setFError] = useState('');

    // Form states (Payment/Abono)
    const [pAmount, setPAmount] = useState('');
    const [pMethod, setPMethod] = useState<PaymentMethod>('CASH');
    const [pObs, setPObs] = useState('');
    const [pError, setPError] = useState('');

    useEffect(() => {
        loadCustomers();
        loadActiveSession();
    }, []);

    const loadActiveSession = async () => {
        const session = await getActiveSession();
        setActiveSession(session);
    };

    const loadCustomers = async () => {
        setLoading(true);
        const data = await getCreditCustomers();
        setCustomers(data);
        setLoading(false);
    };

    const getStatusColor = (current: number, max: number) => {
        const percentage = (current / max) * 100;
        if (percentage >= 90) return 'bg-rose-500';
        if (percentage >= 60) return 'bg-amber-500';
        return 'bg-emerald-500';
    };

    const getStatusText = (current: number, max: number) => {
        const percentage = (current / max) * 100;
        if (percentage >= 90) return { text: 'CRÍTICO', color: 'text-rose-400', blocked: true };
        if (percentage >= 60) return { text: 'ADVERTENCIA', color: 'text-amber-400', blocked: false };
        return { text: 'NORMAL', color: 'text-emerald-400', blocked: false };
    };

    // --- ACTIONS ---

    const handleOpenCustomerModal = (customer?: CreditCustomer) => {
        if (customer) {
            setSelectedCustomer(customer);
            setCName(customer.name);
            setCDoc(customer.documentId || '');
            setCPhone(customer.phone || '');
            setCLimit(customer.maxLimit.toString());
            setCObs(customer.observations || '');
            setCActive(customer.active);
        } else {
            setSelectedCustomer(null);
            setCName('');
            setCDoc('');
            setCPhone('');
            setCLimit('');
            setCObs('');
            setCActive(true);
        }
        setIsCustomerModalOpen(true);
    };

    const handleSaveCustomer = async (e: React.FormEvent) => {
        e.preventDefault();
        if (user.role !== 'ADMIN') return;

        const newCustomer: CreditCustomer = {
            id: selectedCustomer ? selectedCustomer.id : '',
            name: cName,
            documentId: cDoc,
            phone: cPhone,
            maxLimit: Number(cLimit),
            currentUsed: selectedCustomer ? selectedCustomer.currentUsed : 0,
            observations: cObs,
            active: cActive
        };

        await saveCreditCustomer(newCustomer);
        setIsCustomerModalOpen(false);
        loadCustomers();
    };

    // --- FIAO LOGIC ---

    const handleOpenFiaoModal = (customer: CreditCustomer) => {
        const status = getStatusText(customer.currentUsed, customer.maxLimit);
        if (status.blocked) return;

        setSelectedCustomer(customer);
        setFAmount('');
        setFObs('');
        setFError('');
        setIsFiaoModalOpen(true);
    };

    const handleSaveFiao = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCustomer) return;

        const amount = Number(fAmount);
        if (amount <= 0) {
            setFError("El monto debe ser mayor a 0");
            return;
        }

        if (!fObs.trim()) {
            setFError("La observación es obligatoria (detalla los productos).");
            return;
        }

        try {
            await registerCreditTransaction(selectedCustomer.id, amount, fObs, user, activeSession?.id);
            setIsFiaoModalOpen(false);
            loadCustomers();
            alert(`✅ Fiao registrado exitosamente por $${amount.toLocaleString()}`);
        } catch (err: any) {
            setFError(err.message);
        }
    };

    // --- PAYMENT LOGIC ---

    const handleOpenPaymentModal = (customer: CreditCustomer, originalDebt?: CreditTransaction) => {
        setSelectedCustomer(customer);
        setSelectedOriginalDebt(originalDebt || null);
        if (originalDebt) {
            setPAmount(originalDebt.amount.toString());
            setPObs(`Abono a deuda del ${new Date(originalDebt.date).toLocaleDateString()}`);
        } else {
            setPAmount('');
            setPObs('');
        }
        setPMethod('CASH');
        setPError('');
        setIsPaymentModalOpen(true);
    };

    const handleSavePayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedCustomer) return;

        const amount = Number(pAmount);
        if (amount <= 0) {
            setPError("El monto debe ser mayor a 0");
            return;
        }

        try {
            await registerPaymentTransaction(
                selectedCustomer.id, 
                amount, 
                pMethod, 
                pObs, 
                user, 
                activeSession?.id, 
                selectedOriginalDebt?.shiftSessionId || selectedOriginalDebt?.originalShiftSessionId
            );
            setIsPaymentModalOpen(false);
            loadCustomers();
            alert(`✅ Abono registrado exitosamente por $${amount.toLocaleString()}`);
        } catch (err: any) {
            setPError(err.message);
        }
    };


    const handleViewHistory = async (customer: CreditCustomer) => {
        // Both roles can see history now
        setSelectedCustomer(customer);
        const data = await getCustomerHistory(customer.id);
        setHistory(data);
        setIsHistoryModalOpen(true);
    };

    const filteredCustomers = customers.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.documentId && c.documentId.includes(searchTerm))
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="w-full">
                    <h2 className="text-2xl md:text-3xl font-black text-bar-text uppercase tracking-tight">Clientes Autorizados (Fiao)</h2>
                    <p className="text-slate-400 text-sm">Gestión de cuentas por cobrar y abonos</p>
                </div>
                {user.role === 'ADMIN' && (
                    <button
                        onClick={() => handleOpenCustomerModal()}
                        className="w-full md:w-auto bg-bar-500 hover:bg-bar-400 text-bar-950 font-black px-6 py-4 md:py-2 rounded-2xl md:rounded-lg flex items-center justify-center gap-2 transition-colors shadow-xl md:shadow-lg shadow-bar-500/20"
                    >
                        <Plus size={24} className="md:w-5 md:h-5" />
                        Nuevo Cliente
                    </button>
                )}
            </div>

            {/* Search Bar */}
            <div className="relative">
                <Search className="absolute left-3 top-3 text-slate-500" size={20} />
                <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Buscar cliente por nombre o documento..."
                    className="w-full bg-bar-800 border border-bar-700 rounded-xl py-3 pl-10 pr-4 text-bar-text focus:outline-none focus:ring-1 focus:ring-bar-500"
                />
            </div>

            {/* Customers Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                {filteredCustomers.map(customer => {
                    const status = getStatusText(customer.currentUsed, customer.maxLimit);
                    const percentage = Math.min((customer.currentUsed / customer.maxLimit) * 100, 100);
                    const colorClass = getStatusColor(customer.currentUsed, customer.maxLimit);

                    return (
                        <div key={customer.id} className={`bg-bar-800 rounded-2xl border-2 ${status.blocked ? 'border-rose-900/50' : 'border-bar-700/50'} shadow-xl overflow-hidden relative transition-all active:scale-[0.98]`}>
                            {!customer.active && (
                                <div className="absolute inset-0 bg-bar-950/80 flex items-center justify-center z-10 backdrop-blur-sm">
                                    <span className="bg-slate-700 text-slate-300 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest">INACTIVO</span>
                                </div>
                            )}

                            <div className="p-5 md:p-6">
                                <div className="flex justify-between items-start mb-3">
                                    <div className="max-w-[70%]">
                                        <h3 className="text-xl font-black text-bar-text truncate uppercase tracking-tight">{customer.name}</h3>
                                        {customer.documentId && <p className="text-[10px] text-slate-500 font-bold tracking-widest mt-0.5">ID: {customer.documentId}</p>}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleViewHistory(customer)} className="p-3 bg-bar-900/50 text-slate-400 hover:text-blue-400 rounded-xl transition-colors" title="Ver Historial">
                                            <History size={20} />
                                        </button>
                                        {user.role === 'ADMIN' && (
                                            <button onClick={() => handleOpenCustomerModal(customer)} className="p-3 bg-bar-900/50 text-slate-400 hover:text-bar-text rounded-xl transition-colors" title="Editar Cliente">
                                                <Edit2 size={20} />
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Status Indicator */}
                                <div className="flex items-center gap-2 mb-5">
                                    <span className={`w-3 h-3 rounded-full ${colorClass} ${status.blocked ? 'animate-pulse' : ''}`} />
                                    <span className={`text-[10px] font-black tracking-widest uppercase ${status.color}`}>
                                        {status.text} {status.blocked && "- Cupo Agotado"}
                                    </span>
                                </div>

                                {/* Credit Bar */}
                                <div className="space-y-2 mb-6 bg-bar-900/30 p-4 rounded-xl border border-bar-700/30">
                                    <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase">
                                        <span>Usado: {customer.currentUsed.toLocaleString()}</span>
                                        <span>Cupo: {customer.maxLimit.toLocaleString()}</span>
                                    </div>
                                    <div className="h-3 w-full bg-bar-950 rounded-full overflow-hidden border border-bar-700/20">
                                        <div
                                            className={`h-full ${colorClass} transition-all duration-700 ease-out`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    <div className="text-right text-xs font-black text-bar-text font-mono">
                                        DISP: ${(customer.maxLimit - customer.currentUsed).toLocaleString()}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="grid grid-cols-2 gap-4 mt-2">
                                    <button
                                        onClick={() => handleOpenPaymentModal(customer)}
                                        disabled={!customer.active}
                                        className="flex flex-col items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white py-4 rounded-2xl text-xs font-black uppercase transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
                                    >
                                        <Banknote size={24} />
                                        Abonar
                                    </button>

                                    <button
                                        onClick={() => handleOpenFiaoModal(customer)}
                                        disabled={status.blocked || !customer.active}
                                        className={`flex flex-col items-center justify-center gap-1 py-4 rounded-2xl text-xs font-black uppercase transition-all shadow-lg ${status.blocked || !customer.active
                                                ? 'bg-bar-900 text-slate-600 border border-bar-700'
                                                : 'bg-bar-500 hover:bg-bar-400 text-bar-950 shadow-bar-500/20'
                                            }`}
                                    >
                                        {status.blocked ? <Lock size={24} /> : <Wallet size={24} />}
                                        Fiar
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* --- MODAL: CREATE / EDIT CUSTOMER (ADMIN) --- */}
            {isCustomerModalOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center md:p-4">
                    <div className="bg-bar-800 w-full md:max-w-lg h-full md:h-auto rounded-t-3xl md:rounded-2xl border-t md:border border-bar-600 shadow-2xl flex flex-col">
                        <div className="p-6 border-b border-bar-700 flex justify-between items-center shrink-0">
                            <h3 className="text-xl font-black text-bar-text uppercase tracking-tight">
                                {selectedCustomer ? 'Editar Cliente' : 'Nuevo Cliente'}
                            </h3>
                            <button onClick={() => setIsCustomerModalOpen(false)} className="p-2 bg-bar-900/50 rounded-xl text-slate-400 hover:text-bar-text">
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveCustomer} className="p-6 space-y-5 overflow-y-auto flex-1">
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Nombre Completo *</label>
                                <input required type="text" value={cName} onChange={e => setCName(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2.5 text-bar-text focus:border-bar-500 outline-none" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Identificación</label>
                                    <input type="text" value={cDoc} onChange={e => setCDoc(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2.5 text-bar-text focus:border-bar-500 outline-none" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Teléfono</label>
                                    <input type="text" value={cPhone} onChange={e => setCPhone(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2.5 text-bar-text focus:border-bar-500 outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-emerald-400 mb-1">Cupo Máximo ($) *</label>
                                <input required type="number" min="0" value={cLimit} onChange={e => setCLimit(e.target.value)} className="w-full bg-bar-900 border border-emerald-500/50 rounded p-2.5 text-bar-text font-mono text-lg focus:border-emerald-500 outline-none" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Observaciones</label>
                                <textarea rows={2} value={cObs} onChange={e => setCObs(e.target.value)} className="w-full bg-bar-900 border border-bar-600 rounded p-2.5 text-bar-text focus:border-bar-500 outline-none" />
                            </div>

                            {selectedCustomer && (
                                <div className="flex items-center gap-3 pt-2">
                                    <label className="text-sm font-medium text-slate-300">Estado:</label>
                                    <button
                                        type="button"
                                        onClick={() => setCActive(!cActive)}
                                        className={`px-3 py-1 rounded text-xs font-bold ${cActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'}`}
                                    >
                                        {cActive ? 'ACTIVO' : 'INACTIVO'}
                                    </button>
                                </div>
                            )}

                            <div className="pt-4">
                                <button type="submit" className="w-full bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold py-3 rounded-lg flex justify-center items-center gap-2">
                                    <Check size={20} />
                                    Guardar Cliente
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL: REGISTER FIAO (EMPLOYEE/ADMIN) --- */}
            {isFiaoModalOpen && selectedCustomer && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-end md:items-center justify-center md:p-4">
                    <div className="bg-bar-800 w-full md:max-w-md h-[95vh] md:h-auto rounded-t-[3rem] md:rounded-3xl border-t md:border border-bar-600 shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-8 md:p-6 bg-bar-900/50 border-b border-bar-700 text-center md:text-left shrink-0">
                            <div className="w-12 h-1.5 bg-bar-700 rounded-full mx-auto mb-6 md:hidden" />
                            <h3 className="text-2xl md:text-xl font-black text-bar-text mb-1 uppercase tracking-tighter">Registrar Fiao</h3>
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">{selectedCustomer.name}</p>
                        </div>
                        <form onSubmit={handleSaveFiao} className="p-8 md:p-6 space-y-6 overflow-y-auto flex-1 no-scrollbar">
                            <div className="bg-bar-900 p-4 rounded-xl border border-bar-700">
                                <div className="flex justify-between text-sm text-slate-400 mb-2">
                                    <span>Cupo Máximo:</span>
                                    <span>${selectedCustomer.maxLimit.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-sm text-slate-400 mb-2">
                                    <span>Deuda Actual:</span>
                                    <span className="text-rose-400">${selectedCustomer.currentUsed.toLocaleString()}</span>
                                </div>
                                <div className="border-t border-bar-700 pt-2 flex justify-between font-bold text-bar-text">
                                    <span>Disponible:</span>
                                    <span className="text-emerald-400">${(selectedCustomer.maxLimit - selectedCustomer.currentUsed).toLocaleString()}</span>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-bar-text mb-2">Valor del Consumo *</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-3.5 text-slate-500" size={20} />
                                    <input
                                        type="number"
                                        autoFocus
                                        required
                                        min="1"
                                        max={selectedCustomer.maxLimit - selectedCustomer.currentUsed}
                                        value={fAmount}
                                        onChange={e => {
                                            setFAmount(e.target.value);
                                            setFError('');
                                        }}
                                        className="w-full bg-bar-900 border border-bar-600 rounded-xl py-3 pl-10 pr-4 text-bar-text text-xl font-bold focus:border-bar-500 outline-none"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-bar-text mb-2">Detalle de Productos (Obligatorio) *</label>
                                <textarea
                                    required
                                    rows={3}
                                    value={fObs}
                                    onChange={e => {
                                        setFObs(e.target.value);
                                        setFError('');
                                    }}
                                    className="w-full bg-bar-900 border border-bar-600 rounded-xl p-3 text-bar-text focus:border-bar-500 outline-none text-sm"
                                    placeholder="Ej: 2 Cervezas Poker + 1 Paquete papas"
                                />
                                <p className="text-xs text-slate-500 mt-1">Describe exactamente qué se llevó el cliente.</p>
                            </div>

                            {fError && <p className="text-rose-400 text-sm flex items-center gap-1 bg-rose-900/20 p-2 rounded"><AlertTriangle size={14} /> {fError}</p>}

                            <div className="grid grid-cols-2 gap-4">
                                <button type="button" onClick={() => setIsFiaoModalOpen(false)} className="py-3 rounded-lg border border-bar-600 text-slate-300 hover:bg-bar-700 font-medium">
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={!fObs.trim()}
                                    className="py-3 rounded-lg bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold shadow-lg shadow-bar-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    Confirmar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL: REGISTER PAYMENT (ABONO) --- */}
            {isPaymentModalOpen && selectedCustomer && (
                <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-end md:items-center justify-center md:p-4">
                    <div className="bg-bar-800 w-full md:max-w-md h-[95vh] md:h-auto rounded-t-[3rem] md:rounded-3xl border-t md:border border-bar-600 shadow-2xl flex flex-col overflow-hidden">
                        <div className="p-8 md:p-6 bg-emerald-950/20 border-b border-bar-700 text-center md:text-left shrink-0">
                            <div className="w-12 h-1.5 bg-bar-700 rounded-full mx-auto mb-6 md:hidden" />
                            <h3 className="text-2xl md:text-xl font-black text-emerald-400 mb-1 uppercase tracking-tighter">Registrar Abono</h3>
                            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">{selectedCustomer.name}</p>
                        </div>
                        <form onSubmit={handleSavePayment} className="p-8 md:p-6 space-y-6 overflow-y-auto flex-1 no-scrollbar">
                            <div className="bg-bar-900 p-4 rounded-xl border border-bar-700 flex justify-between items-center">
                                <span className="text-slate-400">Deuda Actual:</span>
                                <span className="text-xl font-bold text-bar-text">${selectedCustomer.currentUsed.toLocaleString()}</span>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-bar-text mb-2">Valor a Abonar *</label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-3.5 text-slate-500" size={20} />
                                    <input
                                        type="number"
                                        autoFocus
                                        required
                                        min="1"
                                        value={pAmount}
                                        onChange={e => {
                                            setPAmount(e.target.value);
                                            setPError('');
                                        }}
                                        className="w-full bg-bar-900 border border-bar-600 rounded-xl py-3 pl-10 pr-4 text-bar-text text-xl font-bold focus:border-emerald-500 outline-none"
                                        placeholder="0"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-bar-text mb-2">Método de Pago</label>
                                <div className="grid grid-cols-3 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPMethod('CASH')}
                                        className={`py-2 px-1 text-xs font-bold rounded-lg border ${pMethod === 'CASH' ? 'bg-emerald-600 border-emerald-500 text-bar-text' : 'bg-bar-900 border-bar-700 text-slate-400'}`}
                                    >
                                        EFECTIVO
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPMethod('TRANSFER')}
                                        className={`py-2 px-1 text-xs font-bold rounded-lg border ${pMethod === 'TRANSFER' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-bar-900 border-bar-700 text-slate-400'}`}
                                    >
                                        TRANSFERENCIA
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPMethod('CARD')}
                                        className={`py-2 px-1 text-xs font-bold rounded-lg border ${pMethod === 'CARD' ? 'bg-purple-600 border-purple-500 text-white' : 'bg-bar-900 border-bar-700 text-slate-400'}`}
                                    >
                                        DATÁFONO
                                    </button>
                                </div>
                                {pMethod === 'CASH' ? (
                                    <p className="text-xs text-emerald-400 mt-2 flex items-center gap-1">
                                        <Plus size={12} />
                                        Se sumará al dinero a entregar en el cierre.
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-400 mt-2">
                                        No afecta el efectivo en caja del turno.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Observación (Opcional)</label>
                                <input
                                    type="text"
                                    value={pObs}
                                    onChange={e => setPObs(e.target.value)}
                                    className="w-full bg-bar-900 border border-bar-600 rounded-lg p-3 text-white focus:border-bar-500 outline-none text-sm"
                                    placeholder="Ej: Pago parcial..."
                                />
                            </div>

                            {pError && <p className="text-rose-400 text-sm flex items-center gap-1 bg-rose-900/20 p-2 rounded"><AlertTriangle size={14} /> {pError}</p>}

                            <div className="grid grid-cols-2 gap-4">
                                <button type="button" onClick={() => setIsPaymentModalOpen(false)} className="py-3 rounded-lg border border-bar-600 text-slate-300 hover:bg-bar-700 font-medium">
                                    Cancelar
                                </button>
                                <button type="submit" className="py-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold shadow-lg shadow-emerald-600/20">
                                    Registrar Abono
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* --- MODAL: HISTORY --- */}
            {isHistoryModalOpen && selectedCustomer && (
                <div className="fixed inset-0 z-[110] bg-black/95 backdrop-blur-md flex items-end md:items-center justify-center md:p-4">
                    <div className="bg-bar-800 w-full md:max-w-3xl h-full md:h-[90vh] md:rounded-3xl border-t md:border border-bar-600 shadow-2xl flex flex-col">
                        <div className="p-8 md:p-6 border-b border-bar-700 flex justify-between items-center shrink-0">
                            <div>
                                <h3 className="text-2xl md:text-xl font-black text-white uppercase tracking-tighter">Historial de Cuenta</h3>
                                <p className="text-sm text-slate-500 font-bold uppercase">{selectedCustomer.name}</p>
                            </div>
                            <button onClick={() => setIsHistoryModalOpen(false)} className="p-3 bg-bar-900/50 rounded-2xl text-slate-400 hover:text-white">
                                <X size={28} />
                            </button>
                        </div>
                        <div className="overflow-y-auto flex-1 no-scrollbar">
                            {/* Mobile View: Transaction Cards */}
                            <div className="md:hidden p-4 space-y-4">
                                {history.length === 0 ? (
                                    <p className="text-center text-slate-500 py-10">No hay movimientos.</p>
                                ) : (
                                    history.map(h => (
                                        <div key={h.id} className="bg-bar-900/50 p-5 rounded-2xl border border-bar-700/50">
                                            <div className="flex justify-between items-start mb-3">
                                                {h.type === 'DEBT' ? (
                                                    <span className="flex items-center gap-1.5 text-rose-400 font-black text-[10px] bg-rose-950/30 px-3 py-1.5 rounded-lg border border-rose-500/20 uppercase tracking-widest">
                                                        <ArrowUpCircle size={14} /> Consumo
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 text-emerald-400 font-black text-[10px] bg-emerald-950/30 px-3 py-1.5 rounded-lg border border-emerald-500/20 uppercase tracking-widest">
                                                        <ArrowDownCircle size={14} /> Abono
                                                    </span>
                                                )}
                                                <span className={`text-lg font-black font-mono ${h.type === 'DEBT' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                    {h.type === 'DEBT' ? '+' : '-'}${h.amount.toLocaleString()}
                                                </span>
                                            </div>
                                            <p className="text-slate-300 text-sm mb-4 leading-relaxed italic">"{h.observation || 'Sin detalle'}"</p>
                                            <div className="flex justify-between items-end border-t border-bar-700/50 pt-3">
                                                <div className="text-[10px] text-slate-500 font-bold uppercase">
                                                    <div>{new Date(h.date).toLocaleDateString()} {new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                    <div className="text-bar-500 mt-0.5">{h.employeeName}</div>
                                                </div>
                                                {h.type === 'DEBT' && (
                                                    <button 
                                                        onClick={() => handleOpenPaymentModal(selectedCustomer, h)}
                                                        className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
                                                    >
                                                        Pagar Esta
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Desktop View: Table */}
                            <table className="hidden md:table w-full text-left text-sm">
                                <thead className="bg-bar-950 text-slate-400 sticky top-0">
                                    <tr>
                                        <th className="p-4">Tipo</th>
                                        <th className="p-4">Detalle / Obs</th>
                                        <th className="p-4">Fecha / Usuario</th>
                                        <th className="p-4 text-right">Monto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-bar-700">
                                    {history.map(h => (
                                        <tr key={h.id} className="hover:bg-bar-700/30 transition-colors">
                                            <td className="p-4">
                                                {h.type === 'DEBT' ? (
                                                    <span className="flex items-center gap-1 text-rose-400 font-bold text-xs bg-rose-900/20 px-2 py-1 rounded w-fit">
                                                        <ArrowUpCircle size={14} /> Consumo
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1 text-emerald-400 font-bold text-xs bg-emerald-900/20 px-2 py-1 rounded w-fit">
                                                        <ArrowDownCircle size={14} /> Abono
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-4 text-slate-300 max-w-xs">
                                                <p className="line-clamp-2 italic">"{h.observation || '-'}"</p>
                                            </td>
                                            <td className="p-4 text-slate-400 text-xs">
                                                <div>{new Date(h.date).toLocaleDateString()} {new Date(h.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                                                <div className="text-slate-500 uppercase font-bold text-[10px]">{h.employeeName}</div>
                                            </td>
                                            <td className={`p-4 text-right font-bold ${h.type === 'DEBT' ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                <div className="flex flex-col items-end gap-2">
                                                    <span className="text-lg font-mono">{h.type === 'DEBT' ? '+' : '-'}${h.amount.toLocaleString()}</span>
                                                    {h.type === 'DEBT' && (
                                                        <button 
                                                            onClick={() => handleOpenPaymentModal(selectedCustomer, h)}
                                                            className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1 rounded-lg font-black uppercase tracking-widest transition-colors"
                                                        >
                                                            Pagar Deuda
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-bar-700 bg-bar-900/50 text-right">
                            <span className="text-slate-400 mr-2">Deuda Total Actual:</span>
                            <span className="text-xl font-bold text-white">${selectedCustomer.currentUsed.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};

export default CreditCustomers;