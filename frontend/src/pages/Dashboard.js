import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/App';
import { API } from '@/App';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Calendar, Users, DollarSign, AlertCircle, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseDateString } from '@/utils/dateUtils';

const Dashboard = () => {
  const { token } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, alertsRes] = await Promise.all([
        axios.get(`${API}/dashboard/stats`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/alerts`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setStats(statsRes.data);
      setAlerts(alertsRes.data);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="spinner"></div>
      </div>
    );
  }

  const statCards = [
    {
      title: 'Total de Eventos',
      value: stats?.total_events || 0,
      icon: Calendar,
      color: 'teal',
      bgColor: 'bg-teal-50',
      iconColor: 'text-teal-600'
    },
    {
      title: 'Eventos Hoje',
      value: stats?.today_events || 0,
      icon: Calendar,
      color: 'orange',
      bgColor: 'bg-orange-50',
      iconColor: 'text-orange-600'
    },
    {
      title: 'Funcionários',
      value: stats?.total_employees || 0,
      icon: Users,
      color: 'blue',
      bgColor: 'bg-blue-50',
      iconColor: 'text-blue-600'
    },
    {
      title: 'Receita Total',
      value: `R$ ${stats?.total_revenue?.toFixed(2) || '0.00'}`,
      icon: DollarSign,
      color: 'green',
      bgColor: 'bg-green-50',
      iconColor: 'text-green-600'
    }
  ];

  return (
    <div className="space-y-8 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Dashboard</h1>
        <p className="text-slate-600">Visão geral do seu salão de festas</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card key={index} className="p-6 border-0 shadow-sm card-hover" data-testid={`stat-card-${index}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600 mb-1">{stat.title}</p>
                  <p className="text-2xl font-bold text-slate-800">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 ${stat.bgColor} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-6 h-6 ${stat.iconColor}`} />
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alerts */}
        <Card className="p-6 border-0 shadow-sm" data-testid="alerts-section">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-bold text-slate-800">Alertas de Eventos</h2>
          </div>
          
          {alerts.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum evento próximo</p>
          ) : (
            <div className="space-y-3">
              {alerts.slice(0, 5).map((alert, index) => (
                <div key={index} className="p-3 bg-orange-50 border border-orange-100 rounded-lg" data-testid={`alert-${index}`}>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-slate-800">{alert.event.client_name}</p>
                      <p className="text-sm text-slate-600">
                        {parseDateString(alert.event.date) ? format(parseDateString(alert.event.date), "dd 'de' MMMM", { locale: ptBR }) : alert.event.date} - {alert.event.start_time}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-orange-700 bg-orange-200 px-2 py-1 rounded-full">
                      {alert.days_until === 0 ? 'Hoje' : `${alert.days_until}d`}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Financial Summary */}
        <Card className="p-6 border-0 shadow-sm" data-testid="financial-summary">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-slate-800">Resumo Financeiro</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div>
                <p className="text-sm text-slate-600 mb-1">Valor Pago</p>
                <p className="text-2xl font-bold text-green-700">R$ {stats?.paid_amount?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-green-600" />
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
              <div>
                <p className="text-sm text-slate-600 mb-1">Valor Pendente</p>
                <p className="text-2xl font-bold text-orange-700">R$ {stats?.pending_amount?.toFixed(2) || '0.00'}</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Upcoming Events */}
      <Card className="p-6 border-0 shadow-sm" data-testid="upcoming-events">
        <h2 className="text-lg font-bold text-slate-800 mb-4">Próximos Eventos</h2>
        
        {!stats?.upcoming_events || stats.upcoming_events.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhum evento agendado</p>
        ) : (
          <div className="space-y-3">
            {stats.upcoming_events.map((event, index) => (
              <div key={index} className="p-4 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between" data-testid={`upcoming-event-${index}`}>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-teal-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-6 h-6 text-teal-600" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{event.client_name}</p>
                    <p className="text-sm text-slate-600">
                      {parseDateString(event.date) ? format(parseDateString(event.date), "dd/MM/yyyy", { locale: ptBR }) : event.date} - {event.start_time} às {event.end_time}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">{event.event_type}</p>
                  </div>
                </div>
                <span className={`status-badge status-${event.payment_status}`}>
                  {event.payment_status === 'paid' ? 'Pago' : event.payment_status === 'partial' ? 'Parcial' : 'Pendente'}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;