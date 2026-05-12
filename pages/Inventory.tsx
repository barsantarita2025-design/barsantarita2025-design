import React, { useState, useEffect } from 'react';
import { getActiveSession, startSession, closeSession, updateSession, getProducts, getTransactionsInRange, getConfig, updateConfig, getSessionFinancialMovements, requestFinancialMovementCorrection } from '../services/db';
import { ShiftSession, Product, InventoryItem, SalesReport, User, CreditTransaction, FinancialMovement } from '../types';
import { Play, Square, Save, Search, Filter, AlertTriangle, Lock, CheckCircle, XCircle, Loader2, DollarSign, Package, TrendingUp, TrendingDown, Wallet, MessageSquare, ChevronDown, ChevronUp, Receipt, Calculator, AlertCircle, Clock, X, History as HistoryIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FinancialMovementsForm } from '../components/FinancialMovementsForm';

interface InventoryProps {
  user: User;
}

const Inventory: React.FC<InventoryProps> = ({ user }) => {
  const [activeSession, setActiveSession] = useState<ShiftSession | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [inventoryInput, setInventoryInput] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // Closing inputs
  const [realCash, setRealCash] = useState('');
  const [closingObs, setClosingObs] = useState('');

  // New state for Summary Modal
  const [showSummary, setShowSummary] = useState(false);
  const [lastSessionSummary, setLastSessionSummary] = useState<ShiftSession | null>(null);

  // Collapsible inventory panel state
  const [isInventoryCollapsed, setIsInventoryCollapsed] = useState(false);

  // Inventory base (persistent between sessions)
  const [inventoryBase, setInventoryBase] = useState<Record<string, number>>({});

  // Financial Movements Modal
  const [showMovementForm, setShowMovementForm] = useState(false);

  // Search and Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [categories, setCategories] = useState<string[]>(['Todas']);
  const [sessionMovements, setSessionMovements] = useState<FinancialMovement[]>([]);
  
  // Correction State
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionMovement, setCorrectionMovement] = useState<FinancialMovement | null>(null);
  const [correctionAmount, setCorrectionAmount] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const formatFullDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const formatCOP = (amount: number) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const renderMovementDetails = (m: FinancialMovement) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-3">
        <div>
          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Observación detallada</p>
          <p className="text-sm text-slate-300 italic">"{m.description || 'No hay observaciones adicionales'}"</p>
        </div>
        {m.type === 'PAYMENT' && (
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Método de Pago / Origen</p>
            <p className="text-sm text-blue-400 font-bold flex items-center gap-2">
              {m.source === 'CASH_DRAWER' ? '🏪 Efectivo de Caja' : '👤 Fondos del Administrador'}
            </p>
          </div>
        )}
      </div>
      <div className="space-y-3">
        <div>
          <p className="text-[10px] text-slate-500 font-bold uppercase mb-1">Estado del Movimiento</p>
          <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${
            m.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/30' :
            m.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/30' :
            'bg-amber-500/20 text-amber-500 border border-amber-500/30'
          }`}>
            {m.status === 'APPROVED' ? 'Aprobado' : m.status === 'REJECTED' ? 'Rechazado' : 'Pendiente de Auditoría'}
          </span>
        </div>
        
        {m.originalAmount && (
          <div className="flex items-center gap-2 text-xs text-slate-500 bg-bar-950/50 p-3 rounded-xl border border-bar-700">
            <HistoryIcon size={16} className="text-amber-500/50" />
            <div>
              <p className="font-bold text-amber-500/70 text-[10px] uppercase">Historial de Corrección</p>
              <p>Corregido: de <span className="line-through">{formatCOP(m.originalAmount)}</span> a <span className="text-slate-300 font-bold">{formatCOP(m.amount)}</span></p>
              <p className="text-[10px] italic mt-1">— "{m.correctionReason}"</p>
            </div>
          </div>
        )}

        {(!m.correctionStatus || m.correctionStatus === 'REJECTED') && (
          <button 
            onClick={() => {
                setCorrectionMovement(m);
                setCorrectionAmount(m.amount.toString());
                setShowCorrectionModal(true);
            }}
            className="text-xs text-amber-500 hover:text-amber-400 font-bold flex items-center gap-2 mt-2"
          >
            <AlertCircle size={14} /> Solicitar Corrección de Monto
          </button>
        )}
        
        {m.correctionStatus === 'PENDING' && (
          <div className="flex items-center gap-2 text-amber-400 bg-amber-400/10 p-2 rounded border border-amber-400/20 mt-2">
            <Clock size={14} />
            <span className="text-[10px] font-bold uppercase">Corrección en trámite...</span>
          </div>
        )}
      </div>
    </div>
  );

  const handleRequestCorrection = async () => {
    if (!correctionMovement || !correctionAmount || !correctionReason) return;
    
    setIsSubmittingCorrection(true);
    try {
        await requestFinancialMovementCorrection(
            correctionMovement.id, 
            parseFloat(correctionAmount), 
            correctionReason
        );
        showNotification("Solicitud de corrección enviada", "success");
        setShowCorrectionModal(false);
        setCorrectionAmount('');
        setCorrectionReason('');
        // Reload movements
        if (activeSession) {
          const movements = await getSessionFinancialMovements(activeSession.id);
          setSessionMovements(movements);
        }
    } catch (error) {
        console.error("Error requesting correction:", error);
        showNotification("Error al enviar la solicitud", "error");
    } finally {
        setIsSubmittingCorrection(false);
    }
  };

  const loadData = async () => {
    try {
      const session = await getActiveSession();
      const prods = await getProducts();
      const config = await getConfig();
      setActiveSession(session);

      if (session) {
        const movements = await getSessionFinancialMovements(session.id);
        setSessionMovements(movements);
      }

      const activeProds = prods.filter(p => p.active);
      setProducts(activeProds);

      const cats = ['Todas', ...new Set(activeProds.map(p => p.category))];
      setCategories(cats);

      // Load inventory base from config or localStorage
      let base: Record<string, number> = {};
      if (config.inventoryBase) {
        base = config.inventoryBase as Record<string, number>;
      } else {
        const savedBase = localStorage.getItem('barflow_inventory_base');
        if (savedBase) {
          try {
            base = JSON.parse(savedBase);
          } catch (e) {
            console.error("Error parsing inventory base", e);
          }
        }
      }
      setInventoryBase(base);

      setInventoryInput(prev => {
        const next = { ...prev };
        activeProds.forEach(p => {
          // If there's an active session with finalInventory, use those values
          if (session && session.finalInventory && session.finalInventory.length > 0) {
            const existing = session.finalInventory.find(i => i.productId === p.id);
            next[p.id] = existing ? existing.count : 0;
          }
          // If no active session but there's an inventory base, use that
          else if (!session && base[p.id] !== undefined) {
            next[p.id] = base[p.id];
          }
          // Otherwise use 0 or existing value
          else if (next[p.id] === undefined) {
            next[p.id] = 0;
          }
        });
        return next;
      });

      // If reopened, also pre-fill observation
      if (session?.closingObservation) {
        setClosingObs(session.closingObservation);
      }

    } catch (error) {
      console.error("Error loading data", error);
      showNotification("Error cargando datos del sistema", "error");
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleInputChange = (productId: string, val: string) => {
    const num = val === '' ? 0 : parseInt(val);
    setInventoryInput(prev => ({ ...prev, [productId]: num }));
  };

  const handleSaveProgress = async () => {
    setProcessing(true);
    try {
      const currentInventory: InventoryItem[] = products.map(p => ({
        productId: p.id,
        productName: p.name,
        count: inventoryInput[p.id] || 0
      }));

      if (activeSession) {
        // Save to active session
        await updateSession(activeSession.id, {
          initialInventory: activeSession.status === 'OPEN' && !activeSession.closedAt ? activeSession.initialInventory : currentInventory,
          finalInventory: activeSession.status === 'OPEN' ? currentInventory : activeSession.finalInventory
        });
        showNotification("Progreso guardado en la sesión", "success");
      } else if (user.role === 'ADMIN') {
        // Save as base inventory
        setInventoryBase(inventoryInput);
        localStorage.setItem('barflow_inventory_base', JSON.stringify(inventoryInput));
        await updateConfig({ inventoryBase: inventoryInput });
        showNotification("Inventario base actualizado", "success");
      }
    } catch (error: any) {
      console.error("ERROR SAVE:", error);
      showNotification("Error al guardar: " + error.message, "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleStartShift = async () => {
    if (user.role !== 'ADMIN') {
      alert("Error de permisos: Solo el administrador puede iniciar turno.");
      return;
    }

    setProcessing(true);

    try {
      const initialInventory: InventoryItem[] = products.map(p => ({
        productId: p.id,
        productName: p.name,
        count: inventoryInput[p.id] || 0
      }));

      const newSession = await startSession(user.id, initialInventory);
      setActiveSession(newSession);

      // Reset input to 0 for closing count
      const resetInput: Record<string, number> = {};
      products.forEach(p => resetInput[p.id] = 0);
      setInventoryInput(resetInput);

      showNotification("Turno iniciado correctamente", "success");

    } catch (error: any) {
      console.error("ERROR START:", error);
      alert("Ocurrió un error al iniciar: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleEndShift = async () => {
    if (!activeSession) return;
    if (!realCash) {
      alert("Por favor ingresa el 'Efectivo Real en Caja' antes de cerrar el turno.");
      return;
    }

    // --- CHECK FOR PENDING FINANCIAL MOVEMENTS ---
    setProcessing(true);
    try {
      const allMovements = await getSessionFinancialMovements(activeSession.id);
      const pendingCount = allMovements.filter(m => m.status === 'PENDING').length;

      if (pendingCount > 0) {
        alert(`¡CRÍTICO! No se puede cerrar el turno porque hay ${pendingCount} movimiento(s) financiero(s) pendiente(s) de aprobación. Por favor contacta al administrador.`);
        setProcessing(false);
        return;
      }

      if (!window.confirm("Confirmas que las cantidades han sido ingresadas correctamente?")) {
        setProcessing(false);
        return;
      }

      const currentProducts = await getProducts();
      const realCashValue = parseInt(realCash);

      // 1. Calculate Inventory Difference (Theoretical Revenue)
      const finalInventory: InventoryItem[] = currentProducts.map(p => ({
        productId: p.id,
        productName: p.name,
        count: inventoryInput[p.id] || 0
      }));

      // Save final inventory as the new base for next session
      const newBase: Record<string, number> = {};
      finalInventory.forEach(item => {
        newBase[item.productId] = item.count;
      });
      setInventoryBase(newBase);
      localStorage.setItem('barflow_inventory_base', JSON.stringify(newBase));
      await updateConfig({ inventoryBase: newBase });

      let totalRevenue = 0;
      let totalCost = 0;
      const itemsSoldReport = [];
      const initialInv = activeSession.initialInventory || [];

      for (const p of currentProducts) {
        const startCount = initialInv.find(i => i.productId === p.id)?.count || 0;
        const endCount = finalInventory.find(i => i.productId === p.id)?.count || 0;

        const sold = Math.max(0, startCount - endCount);

        const revenue = sold * p.salePrice;
        const cost = sold * p.costPrice;
        const profit = revenue - cost;

        totalRevenue += revenue;
        totalCost += cost;

        itemsSoldReport.push({
          productId: p.id,
          productName: p.name,
          quantity: sold,
          revenue,
          profit
        });
      }

      // 2. Fetch Credit Transactions for this shift to adjust Cash Flow
      const endDate = new Date().toISOString();
      const creditTransactions = await getTransactionsInRange(activeSession.openedAt, endDate);

      // a. Fiaos (Debt) given during this shift -> Subtract from Cash
      const fiaos = creditTransactions.filter(t => t.type === 'DEBT');
      const totalCreditSales = fiaos.reduce((acc, t) => acc + t.amount, 0);

      // b. Payments (Abonos) received during this shift -> Add to Cash (ONLY if CASH method and from SAME shift)
      const cashPayments = creditTransactions.filter(t => 
        t.type === 'PAYMENT' && 
        t.paymentMethod === 'CASH' && 
        t.shiftSessionId === t.originalShiftSessionId
      );
      const totalCashPayments = cashPayments.reduce((acc, t) => acc + t.amount, 0);

      // c. Non-Cash Payments (Transfer/Card) -> Just for reporting
      const otherPayments = creditTransactions.filter(t => t.type === 'PAYMENT' && t.paymentMethod !== 'CASH');
      const totalNonCashPayments = otherPayments.reduce((acc, t) => acc + t.amount, 0);

      // 3. Financial Movements Adjustments
      const approvedMovements = allMovements.filter(m => m.status === 'APPROVED');
      
      const totalProduction = approvedMovements
        .filter(m => m.type === 'PRODUCTION')
        .reduce((acc, m) => acc + m.amount, 0);
        
      const totalCashPaymentsToSuppliers = approvedMovements
        .filter(m => m.type === 'PAYMENT' && m.source === 'CASH_DRAWER')
        .reduce((acc, m) => acc + m.amount, 0);

      // 4. Final Cash Calculation
      // Cash to Deliver (Theoretical) = (Total Inventory Revenue) - (Credit Sales) + (Cash Payments Collected) + (Extra Production) - (Supplier Cash Payments)
      const cashToDeliver = totalRevenue - totalCreditSales + totalCashPayments + totalProduction - totalCashPaymentsToSuppliers;

      // 5. Difference
      const difference = realCashValue - cashToDeliver;

      const salesReport: SalesReport = {
        totalRevenue,
        totalCost,
        totalProfit: totalRevenue - totalCost,
        totalCreditSales,
        totalCashPayments,
        totalNonCashPayments,
        cashToDeliver,
        difference,
        itemsSold: itemsSoldReport
      };

      const completedSession: ShiftSession = {
        ...activeSession,
        closedBy: user.id,
        closedAt: endDate,
        status: user.role === 'ADMIN' ? 'CLOSED' : 'PENDING_APPROVAL',
        finalInventory,
        salesReport,
        realCash: realCashValue,
        closingObservation: closingObs
      };

      await closeSession(completedSession);

      setActiveSession(null);
      setRealCash('');
      setClosingObs('');
      setLastSessionSummary(completedSession);
      setShowSummary(true);

    } catch (error: any) {
      console.error("ERROR END:", error);
      alert("Error crítico al cerrar turno: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const closeSummaryAndReset = () => {
    setShowSummary(false);
    setLastSessionSummary(null);
    setInventoryInput({ ...inventoryBase });

    if (user.role === 'ADMIN') {
      navigate('/');
    } else {
      loadData();
    }
  };

  const filteredProducts = products
    .filter((p, index, self) => self.findIndex(t => t.id === p.id) === index)
    .filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'Todas' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });

  if (loading) return <div className="p-8 text-center text-slate-400">Cargando sistema...</div>;

  const canEdit = user.role === 'ADMIN' || (user.role === 'EMPLOYEE' && activeSession !== null);
  const canEditBaseInventory = user.role === 'ADMIN' && !activeSession;

  return (
    <div className="max-w-4xl mx-auto space-y-6 relative pb-24">
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-lg shadow-2xl flex items-center gap-3 text-bar-text animate-bounce-in ${notification.type === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
          {notification.type === 'success' ? <CheckCircle size={24} /> : <XCircle size={24} />}
          <span className="font-bold">{notification.message}</span>
        </div>
      )}

      {/* --- SUMMARY MODAL --- */}
      {showSummary && lastSessionSummary && lastSessionSummary.salesReport && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-bar-800 w-full max-w-lg rounded-2xl border border-bar-600 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">

            <div className="bg-emerald-600 p-6 text-center shrink-0">
              <CheckCircle className="w-16 h-16 text-bar-text mx-auto mb-2" />
              <h2 className="text-2xl font-bold text-bar-text">
                {lastSessionSummary.status === 'PENDING_APPROVAL' ? 'Turno Enviado a Revisión' : 'Turno Cerrado!'}
              </h2>
              <p className="text-emerald-100">
                {lastSessionSummary.status === 'PENDING_APPROVAL' ? 'Tu turno ha sido enviado para aprobación del administrador.' : 'Resumen de Cierre de Caja'}
              </p>
            </div>

            <div className="p-6 overflow-y-auto space-y-6">
              {/* Main Cash Figure */}
              <div className="text-center bg-bar-900/50 p-6 rounded-xl border border-bar-700">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-500 text-xs font-bold uppercase">Entregado (Real)</p>
                    <p className="text-2xl font-bold text-bar-text">
                      {formatCOP(lastSessionSummary.realCash || 0)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs font-bold uppercase">Esperado (Sistema)</p>
                    <p className="text-2xl font-bold text-slate-300">
                      {formatCOP(lastSessionSummary.salesReport.cashToDeliver)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-bar-700">
                  <p className="text-xs text-slate-400 mb-1">Diferencia (Sobrante / Faltante)</p>
                  <div className={`text-3xl font-bold ${(lastSessionSummary.salesReport.difference || 0) < 0 ? 'text-rose-500' : 'text-blue-400'}`}>
                    {(lastSessionSummary.salesReport.difference || 0) > 0 ? '+' : ''}
                    {formatCOP(lastSessionSummary.salesReport.difference || 0)}
                  </div>
                </div>
              </div>

              {/* Breakdown */}
              <div className="space-y-3 bg-bar-900/30 p-4 rounded-xl border border-bar-700/50">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-300 flex items-center gap-2">
                    <Package size={16} /> Venta Total Inventario
                  </span>
                  <span className="text-bar-text font-mono">{formatCOP(lastSessionSummary.salesReport.totalRevenue)}</span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-rose-400 flex items-center gap-2">
                    <TrendingUp size={16} /> (-) Fiaos (Créditos)
                  </span>
                  <span className="text-rose-400 font-mono">
                    -{formatCOP(lastSessionSummary.salesReport.totalCreditSales)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-emerald-400 flex items-center gap-2">
                    <Wallet size={16} /> (+) Abonos en Efectivo
                  </span>
                  <span className="text-emerald-400 font-mono">
                    +{formatCOP(lastSessionSummary.salesReport.totalCashPayments)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-6 bg-bar-900/50 border-t border-bar-700 shrink-0">
              <button
                onClick={closeSummaryAndReset}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-bar-text font-bold py-3 rounded-xl shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
              >
                Entendido, Finalizar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="w-full">
          <h2 className="text-2xl md:text-3xl font-black text-bar-text uppercase tracking-tight">Gestión de Turno</h2>
          <p className="text-slate-400 text-sm">
            {activeSession
              ? "Turno ABIERTO - Registra el inventario final para cerrar."
              : "Turno CERRADO - El inventario se actualiza automáticamente."}
          </p>
        </div>
        <div className={`w-full md:w-auto px-4 py-3 rounded-2xl font-black text-xs tracking-widest flex items-center justify-center gap-3 transition-all duration-700 ${activeSession ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
          <div className={`w-3 h-3 rounded-full ${activeSession ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
          {activeSession ? 'TURNO ABIERTO' : 'TURNO CERRADO'}
        </div>
      </div>

      {/* REGISTRO DE MOVIMIENTOS - SIEMPRE VISIBLE O MUY PROMINENTE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 bg-gradient-to-br from-bar-800 to-bar-900 border border-bar-700 p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="space-y-2">
                  <h3 className="text-xl font-black text-bar-text flex items-center gap-2 uppercase tracking-tighter">
                      <Calculator className="text-bar-500" /> Control de Efectivo y Producción
                  </h3>
                  <p className="text-slate-400 text-sm">Registra aquí la producción diaria y los pagos a proveedores realizados en el turno.</p>
              </div>
              <button
                onClick={() => setShowMovementForm(true)}
                disabled={!activeSession}
                className={`flex items-center gap-3 font-black px-8 py-4 rounded-2xl shadow-lg transition-all active:scale-95 group whitespace-nowrap ${activeSession 
                        ? 'bg-bar-500 text-bar-950 hover:bg-bar-400 shadow-bar-500/20' 
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'}`}
              >
                <Receipt className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                <span>REGISTRAR PRODUCCIÓN / PAGO</span>
              </button>
          </div>

          {/* PEQUEÑA INFO DE MOVIMIENTOS EN EL TURNO (Opcional) */}
          {activeSession && (
              <div className="bg-bar-800 border border-bar-700 p-6 rounded-2xl flex flex-col justify-center items-center text-center">
                  <span className="text-slate-500 text-xs font-bold uppercase">Estado de Cuenta Diario</span>
                  <div className="mt-2 flex items-center gap-2 text-amber-500">
                      <AlertCircle size={20} />
                      <span className="text-lg font-bold">Revisa pendientes</span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1">Recuerda que todo debe ser aprobado por el administrador.</p>
              </div>
          )}
      </div>
      
      {/* MOVIMIENTOS REGISTRADOS EN ESTE TURNO (VISTA DIRECTA) */}
      {activeSession && sessionMovements.length > 0 && (
        <div className="bg-bar-800 rounded-2xl border border-bar-700 overflow-hidden shadow-xl animate-in fade-in slide-in-from-top-4">
          <div className="p-5 bg-bar-900/50 border-b border-bar-700 flex justify-between items-center">
            <h4 className="font-black text-bar-text text-sm flex items-center gap-2 uppercase tracking-tighter">
              <Clock size={18} className="text-amber-500" /> Movimientos del Turno
            </h4>
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-bar-950 px-2 py-1 rounded-lg border border-bar-700/50">{sessionMovements.length} Registros</span>
          </div>
          <div className="overflow-x-auto">
            {/* Desktop Table View */}
            <table className="hidden md:table w-full text-left text-xs">
              <thead className="bg-bar-950 text-slate-500 uppercase">
                <tr>
                  <th className="p-4">Fecha/Hora</th>
                  <th className="p-4">Tipo</th>
                  <th className="p-4">Descripción</th>
                  <th className="p-4 text-right">Monto</th>
                  <th className="p-4 text-center">Detalles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bar-700">
                {sessionMovements.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(m => (
                  <React.Fragment key={m.id}>
                    <tr className="hover:bg-bar-700/20 transition-colors">
                      <td className="p-4 text-slate-400 font-mono">
                        {formatFullDate(m.date)}
                      </td>
                      <td className="p-4">
                        <span className={`font-bold ${m.type === 'PRODUCTION' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {m.type === 'PRODUCTION' ? '💰 PROD' : '🧾 PAGO'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-300 max-w-[200px] truncate">
                        {m.description || 'Sin descripción'}
                      </td>
                      <td className="p-4 text-right font-bold text-bar-text">
                        {formatCOP(m.amount)}
                      </td>
                      <td className="p-4 text-center">
                        <button 
                          onClick={() => toggleRow(m.id)}
                          className="p-1 text-slate-500 hover:text-bar-text transition-colors"
                        >
                          {expandedRows[m.id] ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </button>
                      </td>
                    </tr>
                    {expandedRows[m.id] && (
                      <tr className="bg-bar-900/40">
                        <td colSpan={5} className="p-6 border-l-4 border-amber-500/50">
                          {renderMovementDetails(m)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-bar-700">
                {sessionMovements.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(m => (
                    <div key={m.id} className="p-4 active:bg-bar-700/30 transition-colors" onClick={() => toggleRow(m.id)}>
                        <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${m.type === 'PRODUCTION' ? 'bg-emerald-950/30 text-emerald-400 border border-emerald-500/20' : 'bg-rose-950/30 text-rose-400 border border-rose-500/20'}`}>
                                {m.type === 'PRODUCTION' ? 'Producción' : 'Pago'}
                            </span>
                            <span className="text-sm font-black font-mono text-bar-text">{formatCOP(m.amount)}</span>
                        </div>
                        <p className="text-xs text-slate-300 italic mb-2">"{m.description || 'Sin descripción'}"</p>
                        <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 uppercase">
                            <span>{new Date(m.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <div className="flex items-center gap-1 text-bar-500">
                                {expandedRows[m.id] ? 'Ocultar detalles' : 'Ver más'} 
                                {expandedRows[m.id] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            </div>
                        </div>
                        {expandedRows[m.id] && (
                            <div className="mt-4 pt-4 border-t border-bar-700/50 animate-in fade-in slide-in-from-top-2">
                                {renderMovementDetails(m)}
                            </div>
                        )}
                    </div>
                ))}
            </div>
          </div>
        </div>
      )}



      {/* --- FINANCIAL MOVEMENT MODAL --- */}
      {showMovementForm && (
        <div className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <FinancialMovementsForm 
            currentUser={user} 
            activeSessionId={activeSession?.id}
            activeSessionOpenedAt={activeSession?.openedAt}
            sessionMovements={sessionMovements}
            onSuccess={() => {
              setShowMovementForm(false);
              showNotification("Movimiento registrado correctamente", "success");
            }}
            onCancel={() => setShowMovementForm(false)}
            onRequestCorrection={(m) => {
                setCorrectionMovement(m);
                setCorrectionAmount(m.amount.toString());
                setShowCorrectionModal(true);
            }}
          />
        </div>
      )}

      {/* --- CORRECTION MODAL --- */}
      {showCorrectionModal && correctionMovement && (
          <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-bar-800 w-full max-w-md rounded-2xl border border-bar-700 shadow-2xl overflow-hidden">
                  <div className="bg-amber-600 px-6 py-4 flex justify-between items-center text-white">
                      <h3 className="font-bold flex items-center gap-2">
                          <AlertTriangle size={20} /> Solicitar Corrección
                      </h3>
                      <button onClick={() => setShowCorrectionModal(false)}><X size={20} /></button>
                  </div>
                  <div className="p-6 space-y-4">
                      <div>
                          <label className="text-xs font-bold text-slate-400 uppercase">Monto Actual</label>
                          <p className="text-xl font-mono text-slate-500 line-through">{formatCOP(correctionMovement.amount)}</p>
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Nuevo Monto Corregido</label>
                          <input 
                              type="number"
                              value={correctionAmount}
                              onChange={e => setCorrectionAmount(e.target.value)}
                              className="w-full bg-bar-900 border border-bar-700 rounded-lg p-3 text-bar-text text-xl font-bold focus:border-amber-500 outline-none"
                              placeholder="0"
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-slate-300 uppercase block mb-1">Razón de la Corrección</label>
                          <textarea 
                              value={correctionReason}
                              onChange={e => setCorrectionReason(e.target.value)}
                              className="w-full bg-bar-900 border border-bar-700 rounded-lg p-3 text-bar-text h-24 resize-none focus:border-amber-500 outline-none"
                              placeholder="Explica por qué necesitas corregir el valor..."
                          />
                      </div>
                      <div className="flex gap-3 pt-2">
                          <button 
                              onClick={() => setShowCorrectionModal(false)}
                              className="flex-1 py-3 bg-bar-700 text-slate-300 rounded-lg font-bold hover:bg-bar-600 transition-colors"
                          >
                              Cancelar
                          </button>
                          <button 
                              onClick={handleRequestCorrection}
                              disabled={isSubmittingCorrection || !correctionAmount || !correctionReason}
                              className="flex-1 py-3 bg-amber-600 text-white rounded-lg font-bold hover:bg-amber-500 transition-colors disabled:opacity-50"
                          >
                              {isSubmittingCorrection ? 'Enviando...' : 'Enviar Solicitud'}
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      )}

      {/* Permission notice */}
      {!canEdit && !activeSession && (
        <div className="bg-amber-900/30 border border-amber-600/50 p-4 rounded-xl flex items-center gap-3 text-amber-200">
          <Lock size={24} />
          <div>
            <p className="font-bold">Modo Solo Lectura</p>
            <p className="text-sm">Solo el administrador puede ajustar el inventario base. Espera a que un administrador inicie la sesion.</p>
          </div>
        </div>
      )}

      {/* Admin notice for base inventory editing */}
      {canEditBaseInventory && (
        <div className="bg-bar-800/50 border border-bar-600 p-4 rounded-xl flex items-center gap-3 text-slate-300">
          <AlertTriangle size={20} className="text-amber-500" />
          <div>
            <p className="font-bold">Modo Edicion de Inventario Base</p>
            <p className="text-sm">Estas ajustando el inventario base. Estos valores se usaran como punto de partida para el proximo turno.</p>
          </div>
        </div>
      )}

      {/* Table & Controls */}
      <div className="bg-bar-800 rounded-xl border border-bar-700 overflow-hidden shadow-xl">
        <div className="p-4 bg-bar-900/50 border-b border-bar-700 space-y-4">
          <div className="flex justify-between items-center cursor-pointer hover:bg-bar-800/50 transition-colors" onClick={() => setIsInventoryCollapsed(!isInventoryCollapsed)}>
            <h3 className="font-semibold text-bar-text flex items-center gap-2">
              <ChevronDown size={20} className={`transition-transform ${isInventoryCollapsed ? '-rotate-90' : ''}`} />
              {activeSession ? 'Inventario Final (Cierre)' : 'Inventario Inicial (Base)'}
            </h3>
            <div className="flex items-center gap-3">
              {!activeSession && canEditBaseInventory && (
                <div className="text-sm text-emerald-400 flex items-center gap-1">
                  <AlertTriangle size={14} />
                  <span>Editable por administrador</span>
                </div>
              )}
              <ChevronDown size={20} className={`text-slate-400 transition-transform ${isInventoryCollapsed ? '-rotate-90' : ''}`} />
            </div>
          </div>

          {!isInventoryCollapsed && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Buscar producto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-bar-900 border border-bar-700 rounded-lg pl-10 pr-4 py-2 text-bar-text focus:border-bar-500 outline-none transition-all"
                />
              </div>
              <div className="flex gap-2 bg-bar-900 border border-bar-700 rounded-lg p-1 overflow-x-auto no-scrollbar">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-1 rounded-md text-sm font-medium whitespace-nowrap transition-all ${selectedCategory === cat
                      ? 'bg-bar-500 text-bar-950 shadow-lg'
                      : 'text-slate-400 hover:bg-bar-800'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {!isInventoryCollapsed && (
          <div>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-bar-950 text-slate-500 text-[10px] font-black uppercase tracking-widest">
                        <th className="p-5">Producto</th>
                        <th className="p-5">Categoría</th>
                        {activeSession && <th className="p-5 text-center text-slate-300">Stock Inicial</th>}
                        <th className="p-5 w-40 text-center">Conteo Físico</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-bar-700/50">
                        {filteredProducts.map(product => {
                        const initialCount = activeSession?.initialInventory.find(i => i.productId === product.id)?.count;
                        return (
                            <tr key={product.id} className="hover:bg-bar-700/20 transition-colors">
                                <td className="p-5 font-black text-bar-text uppercase tracking-tight">{product.name}</td>
                                <td className="p-5">
                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 bg-bar-900 px-2 py-1 rounded-lg">{product.category}</span>
                                </td>

                                {activeSession && (
                                    <td className="p-5 text-center text-slate-300 font-mono text-lg">
                                        {initialCount}
                                    </td>
                                )}

                                <td className="p-5">
                                    <input
                                        type="number"
                                        min="0"
                                        disabled={!canEdit}
                                        value={inventoryInput[product.id] === undefined || inventoryInput[product.id] === 0 ? '' : inventoryInput[product.id]}
                                        onChange={(e) => handleInputChange(product.id, e.target.value)}
                                        className={`w-full bg-bar-900 border-2 border-bar-700 rounded-xl p-3 text-bar-text text-center font-black text-xl focus:border-bar-500 outline-none transition-all ${!canEdit
                                            ? 'opacity-40 cursor-not-allowed bg-bar-950 border-transparent'
                                            : canEditBaseInventory
                                            ? 'border-amber-500/30 focus:border-amber-500'
                                            : 'hover:border-bar-600'
                                        }`}
                                        placeholder="0"
                                    />
                                </td>
                            </tr>
                        );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-bar-700">
                {filteredProducts.length === 0 ? (
                    <div className="p-10 text-center text-slate-500 font-bold">No se encontraron productos.</div>
                ) : (
                    filteredProducts.map(product => {
                        const initialCount = activeSession?.initialInventory.find(i => i.productId === product.id)?.count;
                        return (
                            <div key={product.id} className="p-5 space-y-4">
                                <div className="flex justify-between items-start">
                                    <div className="max-w-[60%]">
                                        <h4 className="text-lg font-black text-bar-text uppercase tracking-tighter leading-tight">{product.name}</h4>
                                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1 inline-block">{product.category}</span>
                                    </div>
                                    {activeSession && (
                                        <div className="bg-bar-950 px-3 py-2 rounded-xl border border-bar-700 text-center min-w-[70px]">
                                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-tighter">Inicial</p>
                                            <p className="text-lg font-black text-bar-text font-mono">{initialCount}</p>
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-4 bg-bar-950/50 p-4 rounded-2xl border border-bar-700/50 shadow-inner">
                                    <div className="flex-1">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Conteo Final (Físico)</p>
                                        <input
                                            type="number"
                                            min="0"
                                            disabled={!canEdit}
                                            value={inventoryInput[product.id] === undefined || inventoryInput[product.id] === 0 ? '' : inventoryInput[product.id]}
                                            onChange={(e) => handleInputChange(product.id, e.target.value)}
                                            className="w-full bg-bar-900 border-2 border-bar-700 rounded-xl py-4 px-4 text-bar-text text-center font-black text-2xl focus:border-bar-500 outline-none transition-all disabled:opacity-30"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
          </div>
        )}
      </div>

      {/* ACTION AREA */}
      <div className="bg-bar-800 rounded-xl border border-bar-700 p-6 shadow-xl space-y-6">
        
        {activeSession && sessionMovements.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-4 border-b border-bar-700">
            <div className="flex items-center justify-between p-3 bg-bar-900/50 rounded-xl border border-bar-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500"><TrendingUp size={20} /></div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Producción del Turno</p>
                  <p className="text-xl font-black text-emerald-400">
                    {formatCOP(sessionMovements.filter(m => m.type === 'PRODUCTION').reduce((acc, m) => acc + m.amount, 0))}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-bar-900/50 rounded-xl border border-bar-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-rose-500/10 rounded-lg text-rose-500"><TrendingDown size={20} /></div>
                <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase">Pagos (Salida de Caja)</p>
                  <p className="text-xl font-black text-rose-400">
                    {formatCOP(sessionMovements.filter(m => m.type === 'PAYMENT' && m.source === 'CASH_DRAWER').reduce((acc, m) => acc + m.amount, 0))}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSession && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-bold text-bar-text mb-2 flex items-center gap-2">
                <DollarSign size={16} className="text-emerald-400" /> Efectivo Real en Caja *
              </label>
              <input
                type="number"
                min="0"
                value={realCash}
                onChange={e => setRealCash(e.target.value)}
                placeholder="Cuánto dinero hay?"
                className="w-full bg-bar-900 border border-bar-600 rounded-xl p-3 text-white font-mono text-lg focus:border-emerald-500 outline-none"
              />
              <p className="text-xs text-slate-500 mt-1">Cuenta billetes y monedas del turno.</p>
            </div>
            <div>
              <label className="block text-sm font-bold text-white mb-2 flex items-center gap-2">
                <MessageSquare size={16} className="text-blue-400" /> Observaciones (Opcional)
              </label>
              <input
                type="text"
                value={closingObs}
                onChange={e => setClosingObs(e.target.value)}
                placeholder="Ej: Se rompió una copa..."
                className="w-full bg-bar-900 border border-bar-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-2">
          {canEdit && (
            <button
              onClick={handleSaveProgress}
              disabled={processing}
              className="w-full md:w-auto flex items-center justify-center gap-3 text-emerald-400 hover:text-emerald-300 font-black uppercase tracking-widest px-6 py-5 md:py-3 rounded-2xl md:rounded-xl border border-emerald-500/30 hover:bg-emerald-500/10 transition-all disabled:opacity-50 shadow-xl shadow-emerald-950/20"
            >
              <Save size={24} className="md:w-5 md:h-5" />
              <span>Guardar Progreso</span>
            </button>
          )}
          <div className="w-full md:w-auto flex flex-col md:flex-row gap-4">
            {!activeSession ? (
              canEdit ? (
                <button
                  type="button"
                  onClick={handleStartShift}
                  disabled={processing}
                  className="w-full md:w-auto flex items-center justify-center gap-3 bg-bar-500 hover:bg-bar-400 text-bar-950 font-black uppercase tracking-tighter px-10 py-6 md:py-4 rounded-3xl md:rounded-xl shadow-2xl shadow-bar-500/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-lg md:text-base"
                >
                  {processing ? <Loader2 size={28} className="animate-spin" /> : <Play size={28} />}
                  <span>{processing ? 'Iniciando...' : 'Iniciar Turno'}</span>
                </button>
              ) : (
                <div className="text-slate-500 text-sm font-black uppercase tracking-widest italic py-4 text-center">Esperando apertura por administrador...</div>
              )
            ) : (
              <div className="fixed bottom-0 left-0 right-0 md:static p-4 md:p-0 bg-bar-950/90 md:bg-transparent backdrop-blur-xl md:backdrop-blur-none border-t md:border-t-0 border-bar-700 md:border-transparent z-[50] flex flex-col md:flex-row gap-4">
                <button
                    type="button"
                    onClick={handleEndShift}
                    disabled={processing || !realCash}
                    className="w-full md:w-auto flex items-center justify-center gap-4 bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-tighter px-12 py-6 md:py-4 rounded-3xl md:rounded-xl shadow-2xl shadow-rose-900/30 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xl md:text-base"
                >
                    {processing ? <Loader2 size={32} className="animate-spin" /> : <Square size={32} fill="currentColor" />}
                    <span>{processing ? 'Cerrando...' : 'Cerrar Turno'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Inventory;
