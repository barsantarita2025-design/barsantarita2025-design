import React, { useState, useEffect } from 'react';
import { getActiveSession, startSession, closeSession, getProducts, getTransactionsInRange, getConfig, updateConfig } from '../services/db';
import { ShiftSession, Product, InventoryItem, SalesReport, User, CreditTransaction } from '../types';
import { Play, Square, AlertTriangle, Lock, CheckCircle, XCircle, Loader2, DollarSign, Package, TrendingUp, TrendingDown, Wallet, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

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

  const loadData = async () => {
    try {
      const session = await getActiveSession();
      const prods = await getProducts();
      const config = getConfig();
      setActiveSession(session);

      const activeProds = prods.filter(p => p.active);
      setProducts(activeProds);

      // Load inventory base from config or localStorage
      const savedBase = localStorage.getItem('barflow_inventory_base');
      let base: Record<string, number> = {};
      if (savedBase) {
        try {
          base = JSON.parse(savedBase);
        } catch (e) {
          console.error("Error parsing inventory base", e);
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

    if (!window.confirm("Confirmas que has contado el inventario y el dinero físico? Esta acción cerrará el turno.")) {
      return;
    }

    setProcessing(true);

    try {
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

      let totalRevenue = 0;
      let totalCost = 0;
      const itemsSoldReport = [];
      const initialInv = activeSession.initialInventory || [];

      for (const p of currentProducts) {
        const startItem = initialInv.find(i => i.productId === p.id);
        const startCount = startItem ? startItem.count : 0;
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

      // b. Payments (Abonos) received during this shift -> Add to Cash (ONLY if CASH method)
      const cashPayments = creditTransactions.filter(t => t.type === 'PAYMENT' && t.paymentMethod === 'CASH');
      const totalCashPayments = cashPayments.reduce((acc, t) => acc + t.amount, 0);

      // c. Non-Cash Payments (Transfer/Card) -> Just for reporting
      const otherPayments = creditTransactions.filter(t => t.type === 'PAYMENT' && t.paymentMethod !== 'CASH');
      const totalNonCashPayments = otherPayments.reduce((acc, t) => acc + t.amount, 0);

      // 3. Final Cash Calculation
      // Cash to Deliver (Theoretical) = (Total Inventory Revenue) - (Credit Sales) + (Cash Payments Collected)
      const cashToDeliver = totalRevenue - totalCreditSales + totalCashPayments;

      // 4. Difference
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

    // Keep inventory base values in input for next session
    setInventoryInput({ ...inventoryBase });

    if (user.role === 'ADMIN') {
      navigate('/');
    } else {
      loadData();
    }
  };

  if (loading) return <div className="p-8 text-center text-slate-400">Cargando sistema...</div>;

  // Can edit if: Admin OR (Employee AND there's an active session)
  const canEdit = user.role === 'ADMIN' || (user.role === 'EMPLOYEE' && activeSession !== null);
  // Only admin can edit inventory when there's no active session
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-bar-text">Gestion de Turno</h2>
          <p className="text-slate-400">
            {activeSession
              ? "Turno ABIERTO - Registra el inventario final para cerrar."
              : "Turno CERRADO - El inventario se actualizo automaticamente."}
          </p>
        </div>
        <div className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors duration-500 ${activeSession ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-300'}`}>
          <div className={`w-3 h-3 rounded-full ${activeSession ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
          {activeSession ? 'TURNO ABIERTO' : 'TURNO CERRADO'}
        </div>
      </div>

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

      {/* TABLE */}
      <div className="bg-bar-800 rounded-xl border border-bar-700 overflow-hidden shadow-xl">
        <div className="p-4 bg-bar-900/50 border-b border-bar-700 flex justify-between items-center cursor-pointer hover:bg-bar-800/50 transition-colors" onClick={() => setIsInventoryCollapsed(!isInventoryCollapsed)}>
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
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-bar-950 text-slate-400 text-sm uppercase tracking-wider">
                  <th className="p-4">Producto</th>
                  <th className="p-4">Categoria</th>
                  {activeSession && <th className="p-4 text-center text-slate-300">Stock Inicial</th>}
                  <th className="p-4 w-32 text-center">Cantidad Fisica</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-bar-700">
                {products.map(product => {
                  const initialCount = activeSession?.initialInventory.find(i => i.productId === product.id)?.count;
                  const baseCount = inventoryBase[product.id] || 0;

                  return (
                    <tr key={product.id} className="hover:bg-bar-700/30 transition-colors">
                      <td className="p-4 font-medium text-bar-text">{product.name}</td>
                      <td className="p-4 text-slate-400 text-sm">{product.category}</td>

                      {activeSession && (
                        <td className="p-4 text-center text-slate-300 font-mono bg-bar-900/30">
                          {initialCount}
                        </td>
                      )}

                      <td className="p-4">
                        <input
                          type="number"
                          min="0"
                          disabled={!canEdit}
                          value={inventoryInput[product.id] === undefined || inventoryInput[product.id] === 0 ? '' : inventoryInput[product.id]}
                          onChange={(e) => handleInputChange(product.id, e.target.value)}
                          className={`w-full bg-bar-900 border border-bar-600 rounded p-2 text-bar-text text-center font-bold focus:border-bar-500 focus:ring-1 focus:ring-bar-500 outline-none transition-all ${!canEdit
                            ? 'opacity-40 cursor-not-allowed bg-bar-950 border-transparent'
                            : canEditBaseInventory
                              ? 'border-amber-500/50 focus:border-amber-500'
                              : 'hover:border-bar-500'
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
        )}
      </div>

      {/* ACTION AREA (Fixed at bottom or static) */}
      <div className="bg-bar-800 rounded-xl border border-bar-700 p-6 shadow-xl space-y-4">

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
                placeholder="Cuanto dinero hay?"
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
                placeholder="Ej: Se rompio una copa..."
                className="w-full bg-bar-900 border border-bar-600 rounded-xl p-3 text-white focus:border-blue-500 outline-none"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          {!activeSession ? (
            canEdit ? (
              <button
                type="button"
                onClick={handleStartShift}
                disabled={processing}
                className="flex items-center gap-2 bg-bar-500 hover:bg-bar-400 text-bar-950 font-bold px-8 py-4 rounded-xl shadow-lg shadow-bar-500/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing ? <Loader2 size={24} className="animate-spin" /> : <Play size={24} />}
                {processing ? 'Iniciando...' : 'Iniciar Turno'}
              </button>
            ) : (
              <span className="text-slate-500 text-sm italic py-2">Esperando apertura por administrador...</span>
            )
          ) : (
            <button
              type="button"
              onClick={handleEndShift}
              disabled={processing || !realCash}
              className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white font-bold px-8 py-4 rounded-xl shadow-lg shadow-rose-600/20 transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {processing ? <Loader2 size={24} className="animate-spin" /> : <Square size={24} fill="currentColor" />}
              {processing ? 'Cerrando...' : 'Cerrar Turno'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Inventory;
