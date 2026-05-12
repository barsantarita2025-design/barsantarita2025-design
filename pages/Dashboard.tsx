import React, { useEffect, useState } from 'react';
import { getSessions, getActiveSession, getFinancialMovements } from '../services/db';
import { ShiftSession, FinancialMovement } from '../types';
import { TrendingUp, DollarSign, Calendar, Clock, TrendingDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const Dashboard: React.FC = () => {
  const [activeSession, setActiveSession] = useState<ShiftSession | null>(null);
  const [pastSessions, setPastSessions] = useState<ShiftSession[]>([]);
  const [movements, setMovements] = useState<FinancialMovement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const active = await getActiveSession();
        const all = await getSessions();
        const allMovements = await getFinancialMovements();
        setActiveSession(active);
        setPastSessions(all.slice(-7)); // Last 7 sessions
        setMovements(allMovements);
      } catch (e) {
        console.error("Error loading dashboard data", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  if (loading) return <div className="text-bar-text">Cargando estadísticas...</div>;

  // Calculate stats safely
  const totalRevenue = pastSessions.reduce((acc, s) => acc + (s.salesReport?.totalRevenue || 0), 0);
  const totalProfit = pastSessions.reduce((acc, s) => acc + (s.salesReport?.totalProfit || 0), 0);

  // Calculate approved production
  const totalProduction = movements
    .filter(m => m.type === 'PRODUCTION' && m.status === 'APPROVED')
    .reduce((acc, m) => acc + m.amount, 0);

  // Calculate approved payments from cash drawer
  const totalPayments = movements
    .filter(m => m.type === 'PAYMENT' && m.status === 'APPROVED' && m.source === 'CASH_DRAWER')
    .reduce((acc, m) => acc + m.amount, 0);

  // Prepare chart data with safety checks
  const chartData = pastSessions.map(s => {
    let dateLabel = 'N/A';
    try {
      if (s.openedAt) {
        dateLabel = new Date(s.openedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' });
      }
    } catch (e) {
      console.error("Invalid date", s.openedAt);
    }

    return {
      date: dateLabel,
      ventas: s.salesReport?.totalRevenue || 0,
      ganancia: s.salesReport?.totalProfit || 0,
    };
  });

  return (
    <div className="space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl md:text-3xl font-black text-bar-text uppercase tracking-tight">Resumen General</h2>
        <p className="text-slate-400 text-sm">Estado actual de la contabilidad</p>
      </div>

      {/* Active Shift Status */}
      <div className={`p-6 rounded-xl border ${activeSession ? 'bg-emerald-900/20 border-emerald-500/50' : 'bg-bar-800 border-bar-700'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-bar-text flex items-center gap-2">
              <Clock size={20} className={activeSession ? "text-emerald-400" : "text-slate-400"} />
              Turno Actual
            </h3>
            <p className="text-slate-400 mt-1">
              {activeSession && activeSession.openedAt
                ? `Abierto desde: ${new Date(activeSession.openedAt).toLocaleString()}`
                : "No hay un turno abierto actualmente."}
            </p>
          </div>
          {activeSession && (
            <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-sm font-medium animate-pulse">
              En Curso
            </span>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="bg-bar-800 p-5 md:p-6 rounded-2xl border border-bar-700 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Ventas (Últimos turnos)</span>
            <DollarSign className="text-bar-500" size={18} />
          </div>
          <p className="text-2xl md:text-3xl font-black text-bar-text">
            ${totalRevenue.toLocaleString()}
          </p>
        </div>

        <div className="bg-bar-800 p-5 md:p-6 rounded-2xl border border-bar-700 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Ganancia Estimada</span>
            <TrendingUp className="text-emerald-500" size={18} />
          </div>
          <p className="text-2xl md:text-3xl font-black text-emerald-400">
            ${totalProfit.toLocaleString()}
          </p>
        </div>

        <div className="bg-bar-800 p-5 md:p-6 rounded-2xl border border-bar-700 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Producción (Aprobada)</span>
            <TrendingUp className="text-amber-500" size={18} />
          </div>
          <p className="text-2xl md:text-3xl font-black text-amber-500">
            ${totalProduction.toLocaleString()}
          </p>
        </div>

        <div className="bg-bar-800 p-5 md:p-6 rounded-2xl border border-bar-700 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Pagos Caja (Aprobados)</span>
            <TrendingDown className="text-rose-400" size={18} />
          </div>
          <p className="text-2xl md:text-3xl font-black text-rose-400">
            ${totalPayments.toLocaleString()}
          </p>
        </div>

        <div className="bg-bar-800 p-5 md:p-6 rounded-2xl border border-bar-700 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Turnos Registrados</span>
            <Calendar className="text-blue-500" size={18} />
          </div>
          <p className="text-2xl md:text-3xl font-black text-bar-text">
            {pastSessions.length}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-bar-800 p-6 rounded-xl border border-bar-700 h-80">
        <h3 className="text-lg font-semibold text-bar-text mb-4">Ventas vs Ganancias (Últimos 7 turnos)</h3>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                itemStyle={{ color: '#f1f5f9' }}
              />
              <Bar dataKey="ventas" fill="#f59e0b" name="Ventas" radius={[4, 4, 0, 0]} />
              <Bar dataKey="ganancia" fill="#10b981" name="Ganancia" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500">
            <p>No hay datos suficientes para mostrar el gráfico</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;