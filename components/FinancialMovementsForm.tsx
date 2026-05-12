import React, { useState } from 'react';
import { DollarSign, FileText, Calendar, Plus, Save, X, AlertCircle, ChevronDown, ChevronUp, Clock, History as HistoryIcon } from 'lucide-react';
import { FinancialMovement, FinancialMovementType, FinancialMovementSource, User } from '../types';
import { saveFinancialMovement } from '../services/db';

interface FinancialMovementsFormProps {
  currentUser: User;
  activeSessionId?: string;
  activeSessionOpenedAt?: string;
  activeSessionOpenedAt?: string;
  sessionMovements: FinancialMovement[];
  onSuccess?: () => void;
  onCancel?: () => void;
  onRequestCorrection?: (movement: FinancialMovement) => void;
}

export function FinancialMovementsForm({ 
  currentUser, 
  activeSessionId, 
  activeSessionOpenedAt,
  sessionMovements,
  onSuccess, 
  onCancel,
  onRequestCorrection
}: FinancialMovementsFormProps) {
  const [type, setType] = useState<FinancialMovementType>('PRODUCTION');
  const [source, setSource] = useState<FinancialMovementSource>('CASH_DRAWER');
  const [amount, setAmount] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

  const toggleRow = (id: string) => {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleAll = () => {
    const allAreExpanded = sessionMovements.length > 0 && 
                           sessionMovements.every(m => expandedRows[m.id]);
    
    if (allAreExpanded) {
      setExpandedRows({});
    } else {
      const all: Record<string, boolean> = {};
      sessionMovements.forEach(m => all[m.id] = true);
      setExpandedRows(all);
    }
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

  const formatMoney = (amount: number) => {
    return '$' + amount.toLocaleString('es-CO');
  };

  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setError('Por favor ingresa un monto válido.');
      return;
    }

    if (activeSessionOpenedAt) {
      const openDate = new Date(activeSessionOpenedAt);
      openDate.setHours(0, 0, 0, 0);
      const selectedDate = new Date(date);
      selectedDate.setHours(0, 0, 0, 0);

      if (selectedDate < openDate) {
        setError('La fecha no puede ser anterior a la apertura del turno actual');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const movement: Partial<FinancialMovement> = {
        type,
        source: type === 'PRODUCTION' ? 'CASH_DRAWER' : source,
        amount: parseFloat(amount),
        date: new Date(date).toISOString(),
        invoiceNumber: type === 'PAYMENT' ? invoiceNumber : undefined,
        description,
        employeeId: currentUser.id,
        employeeName: currentUser.name,
        sessionId: activeSessionId,
        status: 'PENDING'
      };

      await saveFinancialMovement(movement);
      if (onSuccess) onSuccess();
      
      // Reset form
      setAmount('');
      setInvoiceNumber('');
      setDescription('');
      setError(null);
    } catch (err) {
      console.error('Error saving movement:', err);
      setError('Error al guardar el movimiento. Por favor intenta de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderMovementDetails = (m: FinancialMovement) => (
    <div className="space-y-2 py-2">
      <p className="text-gray-300"><span className="text-gray-500 font-bold uppercase text-[9px]">Descripción:</span> {m.description || 'Sin descripción'}</p>
      {m.type === 'PAYMENT' && (
        <p className="text-gray-300">
          <span className="text-gray-500 font-bold uppercase text-[9px]">Origen:</span> {m.source === 'CASH_DRAWER' ? 'Efectivo Caja' : 'Fondos Admin'}
        </p>
      )}
      <p className="text-gray-300">
        <span className="text-gray-500 font-bold uppercase text-[9px]">Estado:</span> 
        <span className={`ml-2 px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${
          m.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-500' :
          m.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-500' :
          'bg-amber-500/10 text-amber-500'
        }`}>
          {m.status === 'APPROVED' ? 'Aprobado' : m.status === 'REJECTED' ? 'Rechazado' : 'Pendiente'}
        </span>
      </p>
      
      {m.originalAmount && (
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-2 pt-2 border-t border-gray-800">
          <HistoryIcon size={12} className="text-amber-500/50" />
          <span>
            Corregido: de <span className="line-through">{formatMoney(m.originalAmount)}</span> a <span className="font-bold text-gray-400">{formatMoney(m.amount)}</span> — {m.correctionReason}
          </span>
        </div>
      )}

      {(!m.correctionStatus || m.correctionStatus === 'REJECTED') && onRequestCorrection && (
        <div className="pt-2">
          <button 
            onClick={() => onRequestCorrection(m)}
            className="text-[10px] text-amber-500 hover:underline font-bold uppercase"
          >
            Solicitar Corrección
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-2xl max-w-lg w-full mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-700 px-6 py-4 flex items-center justify-between">
        <h3 className="text-white font-bold text-lg flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Registrar Movimiento Financiero
        </h3>
        {onCancel && (
          <button 
            onClick={onCancel}
            className="text-white/80 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {/* Type Selector */}
        <div className="flex bg-gray-900 p-1 rounded-xl border border-gray-700">
          <button
            type="button"
            onClick={() => {
              setType('PRODUCTION');
              setSource('CASH_DRAWER');
            }}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              type === 'PRODUCTION' 
                ? 'bg-amber-500 text-gray-900 shadow-lg' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            💰 Producción
          </button>
          <button
            type="button"
            onClick={() => setType('PAYMENT')}
            className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
              type === 'PAYMENT' 
                ? 'bg-amber-500 text-gray-900 shadow-lg' 
                : 'text-gray-400 hover:text-white'
            }`}
          >
            🧾 Pago Proveedor
          </button>
        </div>

        {/* Amount */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber-500" />
            Monto
          </label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            required
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 transition-colors text-xl font-bold"
          />
        </div>

        {/* Source Selector (Only for Payments) */}
        {type === 'PAYMENT' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400">¿De dónde salió el dinero?</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSource('CASH_DRAWER')}
                className={`py-3 px-4 rounded-xl border transition-all text-sm flex flex-col items-center gap-1 ${
                  source === 'CASH_DRAWER'
                    ? 'bg-blue-500/10 border-blue-500 text-blue-400'
                    : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-600'
                }`}
              >
                <div className="text-xl">🏪</div>
                <span>De la Caja</span>
              </button>
              <button
                type="button"
                onClick={() => setSource('ADMIN_FUNDS')}
                className={`py-3 px-4 rounded-xl border transition-all text-sm flex flex-col items-center gap-1 ${
                  source === 'ADMIN_FUNDS'
                    ? 'bg-purple-500/10 border-purple-500 text-purple-400'
                    : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-600'
                }`}
              >
                <div className="text-xl">👤</div>
                <span>Administrador</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1 italic">
              {source === 'CASH_DRAWER' 
                ? 'El gasto se restará del efectivo esperado al cerrar el turno.' 
                : 'El gasto lo registra el sistema pero no afecta tu cuadre de caja.'}
            </p>
          </div>
        )}

        {/* Extra Fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-400 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Factura #
            </label>
            <input
              type="text"
              value={invoiceNumber}
              disabled={type === 'PRODUCTION'}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="Ej: 12345"
              className={`w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 ${
                type === 'PRODUCTION' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-400">
            {type === 'PRODUCTION' ? 'Observaciones de producción' : '¿Qué se recibió / Observaciones?'}
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Escribe aquí los detalles..."
            rows={3}
            className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-amber-500 resize-none"
          />
        </div>

        {activeSessionOpenedAt && new Date(date).setHours(0,0,0,0) < new Date(activeSessionOpenedAt).setHours(0,0,0,0) && (
          <div className="flex items-center gap-2 text-rose-500 bg-rose-500/10 p-3 rounded-lg border border-rose-500/50">
            <AlertCircle size={16} />
            <p className="text-xs font-bold">La fecha no puede ser anterior a la apertura del turno actual</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500 p-4 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || (activeSessionOpenedAt ? new Date(date).setHours(0,0,0,0) < new Date(activeSessionOpenedAt).setHours(0,0,0,0) : false)}
          className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-bold text-lg transition-all ${
            isSubmitting || (activeSessionOpenedAt ? new Date(date).setHours(0,0,0,0) < new Date(activeSessionOpenedAt).setHours(0,0,0,0) : false)
              ? 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-50' 
              : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-900/20 active:scale-[0.98]'
          }`}
        >
          {isSubmitting ? (
            'Guardando...'
          ) : (
            <>
              <Save className="w-6 h-6" />
              Guardar Movimiento
            </>
          )}
        </button>
      </form>

      {/* HISTORIAL DE MOVIMIENTOS (IN-MODAL) */}
      {sessionMovements && sessionMovements.length > 0 && (
        <div className="border-t border-gray-700 bg-gray-900/50">
          <div className="p-4 bg-gray-900 border-b border-gray-700 flex justify-between items-center">
            <h4 className="font-bold text-gray-300 flex items-center gap-2 text-sm">
              <Clock size={16} className="text-amber-500" /> Movimientos del Turno
            </h4>
            <div className="flex items-center gap-3">
              <button 
                type="button"
                onClick={toggleAll}
                className="text-[10px] text-amber-500 hover:text-amber-400 font-black uppercase tracking-widest border border-amber-500/20 px-2 py-1 rounded bg-amber-500/5 active:scale-95 transition-all"
              >
                {sessionMovements.length > 0 && sessionMovements.every(m => expandedRows[m.id]) ? 'Contraer todo' : 'Expandir todo'}
              </button>
              <span className="text-[10px] text-gray-500 font-bold uppercase">{sessionMovements.length} Registros</span>
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-gray-950 text-gray-500 uppercase sticky top-0 z-10">
                <tr>
                  <th className="p-3">Fecha/Hora</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3 text-right">Monto</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {sessionMovements.map(m => (
                  <React.Fragment key={m.id}>
                    <tr className="hover:bg-gray-800/40 transition-colors">
                      <td className="p-3 text-gray-400 font-mono">
                        {formatFullDate(m.date)}
                      </td>
                      <td className="p-3">
                        <span className={`font-bold ${m.type === 'PRODUCTION' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {m.type === 'PRODUCTION' ? '💰 PROD' : '🧾 PAGO'}
                        </span>
                      </td>
                      <td className="p-3 text-right font-bold text-white">
                        {formatMoney(m.amount)}
                      </td>
                      <td className="p-3 text-right">
                        <button 
                          onClick={() => toggleRow(m.id)}
                          className="p-1 text-gray-500 hover:text-white transition-colors"
                        >
                          {expandedRows[m.id] ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                      </td>
                    </tr>
                    {expandedRows[m.id] && (
                      <tr className="bg-gray-950/30">
                        <td colSpan={4} className="p-4 border-l-2 border-amber-500/30">
                          {renderMovementDetails(m)}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
