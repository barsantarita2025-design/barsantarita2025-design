// =============================================================================
// BARFLOW - PANEL DE ALERTAS DE SEGURIDAD (ADMIN)
// =============================================================================
import { useState, useEffect } from 'react';
import { AlertTriangle, Check, X, Clock, Shield, History, Filter, Search, RefreshCw } from 'lucide-react';
import type { DrawerAlert, AlertSeverity, AlertType } from '../types-pos';

// -----------------------------------------------------------------------------
// DATOS DE EJEMPLO (MOCK DATA)
// -----------------------------------------------------------------------------
const MOCK_ALERTS: DrawerAlert[] = [
  {
    id: 'alert-001',
    date: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min atrás
    type: 'UNAUTHORIZED_OPEN',
    severity: 'HIGH',
    message: 'Gaveta abierta sin venta asociada - Usuario: Ana López',
    userId: 'emp-002',
    acknowledged: false,
  },
  {
    id: 'alert-002',
    date: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 horas atrás
    type: 'LONG_OPEN',
    severity: 'MEDIUM',
    message: 'Gaveta abierta por más de 30 segundos',
    userId: 'emp-001',
    acknowledged: true,
    acknowledgedBy: 'admin',
    acknowledgedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'alert-003',
    date: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(), // 5 horas atrás
    type: 'CASH_MISMATCH',
    severity: 'CRITICAL',
    message: 'Diferencia de $45.00 en arqueo de caja - Turno noche',
    acknowledged: true,
    acknowledgedBy: 'admin',
    acknowledgedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'alert-004',
    date: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), // 1 día atrás
    type: 'SUSPICIOUS_PATTERN',
    severity: 'HIGH',
    message: 'Múltiples aperturas de gaveta en corto periodo (5 en 10 min)',
    userId: 'emp-003',
    acknowledged: false,
  },
  {
    id: 'alert-005',
    date: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(), // 2 días atrás
    type: 'JAMMED',
    severity: 'LOW',
    message: 'Gaveta atascada temporalmente - Puerto COM1',
    acknowledged: true,
    acknowledgedBy: 'admin',
    acknowledgedAt: new Date(Date.now() - 1000 * 60 * 60 * 47).toISOString(),
  },
];

// -----------------------------------------------------------------------------
// UTILIDADES
// -----------------------------------------------------------------------------
const getSeverityColor = (severity: AlertSeverity): string => {
  switch (severity) {
    case 'CRITICAL': return 'bg-red-500/20 border-red-500 text-red-400';
    case 'HIGH': return 'bg-orange-500/20 border-orange-500 text-orange-400';
    case 'MEDIUM': return 'bg-amber-500/20 border-amber-500 text-amber-400';
    case 'LOW': return 'bg-blue-500/20 border-blue-500 text-blue-400';
    default: return 'bg-gray-500/20 border-gray-500 text-gray-400';
  }
};

const getSeverityBg = (severity: AlertSeverity): string => {
  switch (severity) {
    case 'CRITICAL': return 'bg-red-500';
    case 'HIGH': return 'bg-orange-500';
    case 'MEDIUM': return 'bg-amber-500';
    case 'LOW': return 'bg-blue-500';
    default: return 'bg-gray-500';
  }
};

const getAlertIcon = (type: AlertType): string => {
  switch (type) {
    case 'UNAUTHORIZED_OPEN': return '🚨';
    case 'LONG_OPEN': return '⏰';
    case 'JAMMED': return '🔒';
    case 'SENSOR_ERROR': return '📡';
    case 'CASH_MISMATCH': return '💰';
    case 'SUSPICIOUS_PATTERN': return '🔍';
    default: return '⚠️';
  }
};

const formatTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 60000) return 'Hace menos de 1 minuto';
  if (diff < 3600000) return `Hace ${Math.floor(diff / 60000)} minutos`;
  if (diff < 86400000) return `Hace ${Math.floor(diff / 3600000)} horas`;
  return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
};

// -----------------------------------------------------------------------------
// COMPONENTE PRINCIPAL
// -----------------------------------------------------------------------------
export function AlertsPanel() {
  const [alerts, setAlerts] = useState<DrawerAlert[]>(MOCK_ALERTS);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'ACKNOWLEDGED'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Filtrar alertas
  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'PENDING' && alert.acknowledged) return false;
    if (filter === 'ACKNOWLEDGED' && !alert.acknowledged) return false;
    if (severityFilter !== 'ALL' && alert.severity !== severityFilter) return false;
    if (searchQuery && !alert.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Contadores
  const pendingCount = alerts.filter(a => !a.acknowledged).length;
  const criticalCount = alerts.filter(a => !a.acknowledged && a.severity === 'CRITICAL').length;

  // Reconocer alerta
  const acknowledgeAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => {
      if (alert.id === alertId) {
        return {
          ...alert,
          acknowledged: true,
          acknowledgedBy: 'admin',
          acknowledgedAt: new Date().toISOString(),
        };
      }
      return alert;
    }));
  };

  // Reconocer todas
  const acknowledgeAll = () => {
    setAlerts(prev => prev.map(alert => ({
      ...alert,
      acknowledged: true,
      acknowledgedBy: 'admin',
      acknowledgedAt: new Date().toISOString(),
    })));
  };

  // Recargar datos
  const refreshData = () => {
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 text-bar-text">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-400" />
            <h2 className="text-xl font-bold">🛡️ Panel de Alertas</h2>
          </div>
          {criticalCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500 rounded-full">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-red-400">{criticalCount} Críticas</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={refreshData}
            className="p-2 hover:bg-gray-700 rounded-lg flex items-center gap-2"
          >
            <RefreshCw className={`w-5 h-5 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          {pendingCount > 0 && (
            <button
              onClick={acknowledgeAll}
              className="px-4 py-2 bg-green-500 hover:bg-green-400 rounded-lg text-sm font-medium text-gray-900"
            >
              Reconocer todas ({pendingCount})
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-gray-800/30">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-sm text-gray-400">Total Alertas</div>
          <div className="text-2xl font-bold">{alerts.length}</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-sm text-gray-400">Pendientes</div>
          <div className="text-2xl font-bold text-amber-400">{pendingCount}</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-sm text-gray-400">Críticas</div>
          <div className="text-2xl font-bold text-red-400">{criticalCount}</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-sm text-gray-400">Hoy</div>
          <div className="text-2xl font-bold text-green-400">
            {alerts.filter(a => new Date(a.date).toDateString() === new Date().toDateString()).length}
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-4 pb-4 flex items-center gap-4 flex-wrap">
        {/* Buscador */}
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar alertas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-amber-400"
          />
        </div>

        {/* Filtro por estado */}
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as 'ALL' | 'PENDING' | 'ACKNOWLEDGED')}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-amber-400"
          >
            <option value="ALL">Todas</option>
            <option value="PENDING">Pendientes</option>
            <option value="ACKNOWLEDGED">Reconocidas</option>
          </select>
        </div>

        {/* Filtro por severidad */}
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | 'ALL')}
          className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg focus:outline-none focus:border-amber-400"
        >
          <option value="ALL">Todas las severidades</option>
          <option value="CRITICAL">🔴 Críticas</option>
          <option value="HIGH">🟠 Altas</option>
          <option value="MEDIUM">🟡 Medias</option>
          <option value="LOW">🔵 Bajas</option>
        </select>
      </div>

      {/* Lista de alertas */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Shield className="w-16 h-16 mb-4 opacity-50" />
            <p>No hay alertas que coincidan con los filtros</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAlerts.map(alert => (
              <div
                key={alert.id}
                className={`p-4 rounded-xl border ${getSeverityColor(alert.severity)} ${alert.acknowledged ? 'opacity-60' : ''
                  }`}
              >
                <div className="flex items-start gap-4">
                  {/* Indicador de severidad */}
                  <div className={`w-3 h-3 rounded-full ${getSeverityBg(alert.severity)} mt-1.5`} />

                  {/* Contenido */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xl">{getAlertIcon(alert.type)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${alert.severity === 'CRITICAL' ? 'border-red-400 text-red-400' :
                          alert.severity === 'HIGH' ? 'border-orange-400 text-orange-400' :
                            alert.severity === 'MEDIUM' ? 'border-amber-400 text-amber-400' :
                              'border-blue-400 text-blue-400'
                        }`}>
                        {alert.severity}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                        {alert.type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-sm">{alert.message}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatTime(alert.date)}
                      </span>
                      {alert.userId && (
                        <span>Usuario: {alert.userId}</span>
                      )}
                      {alert.acknowledged && alert.acknowledgedAt && (
                        <span className="flex items-center gap-1 text-green-400">
                          <Check className="w-3 h-3" />
                          Reconocida por {alert.acknowledgedBy} - {formatTime(alert.acknowledgedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  {!alert.acknowledged && (
                    <button
                      onClick={() => acknowledgeAlert(alert.id)}
                      className="p-2 bg-green-500/20 hover:bg-green-500/40 text-green-400 rounded-lg"
                      title="Reconocer alerta"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer con historial */}
      <div className="p-4 bg-gray-800 border-t border-gray-700">
        <button className="flex items-center gap-2 text-gray-400 hover:text-bar-text text-sm">
          <History className="w-4 h-4" />
          Ver historial completo de eventos de gaveta
        </button>
      </div>
    </div>
  );
}

export default AlertsPanel;
