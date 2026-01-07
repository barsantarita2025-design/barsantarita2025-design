import { POSSale, DailyStats } from '../types-pos';
import { STORAGE_KEYS } from '../constants';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const fetchAPI = async (endpoint: string, options?: RequestInit) => {
    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
        },
    });
    if (!response.ok) {
        throw new Error(`API Error: ${response.statusText}`);
    }
    return response.json();
};

export const saveSale = async (sale: POSSale): Promise<void> => {
    await fetchAPI('/pos/sales', {
        method: 'POST',
        body: JSON.stringify(sale),
    });
};

export const getSalesByDate = async (dateStr: string): Promise<POSSale[]> => {
    return fetchAPI(`/pos/sales?date=${dateStr}`);
};

export const getDailyStats = async (dateStr: string): Promise<DailyStats> => {
    const sales = await getSalesByDate(dateStr);

    const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0);
    const totalCash = sales.filter(s => s.paymentMethod === 'CASH').reduce((sum, s) => sum + s.total, 0);
    const totalCard = sales.filter(s => s.paymentMethod === 'CARD').reduce((sum, s) => sum + s.total, 0);
    const totalTransfer = sales.filter(s => s.paymentMethod === 'TRANSFER').reduce((sum, s) => sum + s.total, 0);
    const totalTips = sales.reduce((sum, s) => sum + s.tip, 0);

    return {
        totalSales: sales.length,
        totalRevenue,
        totalCash,
        totalCard,
        totalTransfer,
        totalTips,
        transactionCount: sales.length,
        averageTicket: sales.length > 0 ? totalRevenue / sales.length : 0,
        drawerOpenCount: sales.filter(s => s.drawerOpened).length,
    };
};
