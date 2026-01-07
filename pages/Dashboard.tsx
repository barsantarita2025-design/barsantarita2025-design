import React, { useEffect, useState } from 'react';
import { getSessions, getActiveSession } from '../services/db';
import { ShiftSession } from '../types';
import { TrendingUp, DollarSign, Calendar, Clock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const Dashboard: React.FC = () => {
  const [activeSession, setActiveSession] = useState<ShiftSession | null>(null);
  const [pastSessions, setPastSessions] = useState<ShiftSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const active = await getActiveSession();
        const all = await getSessions();
        setActiveSession(active);
        setPastSessions(all.slice(-7)); // Last 7 sessions
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
        <h2 className="text-3xl font-bold text-bar-text">Resumen General</h2>
        <p className="text-slate-400">Estado actual de la contabilidad</p>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-bar-800 p-6 rounded-xl border border-bar-700">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-sm">Ventas (Últimos turnos)</span>
            <DollarSign className="text-bar-500" size={20} />
          </div>
          <p className="text-2xl font-bold text-bar-text">
            ${totalRevenue.toLocaleString()}
          </p>
        </div>

        <div className="bg-bar-800 p-6 rounded-xl border border-bar-700">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-sm">Ganancia Estimada</span>
            <TrendingUp className="text-emerald-500" size={20} />
          </div>
          <p className="text-2xl font-bold text-bar-text">
            ${totalProfit.toLocaleString()}
          </p>
        </div>

        <div className="bg-bar-800 p-6 rounded-xl border border-bar-700">
          <div className="flex items-center justify-between mb-4">
            <span className="text-slate-400 text-sm">Turnos Registrados</span>
            <Calendar className="text-blue-500" size={20} />
          </div>
          <p className="text-2xl font-bold text-bar-text">
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