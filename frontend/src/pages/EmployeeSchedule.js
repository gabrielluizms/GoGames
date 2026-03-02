import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/App';
import { API } from '@/App';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as CalendarIcon, Plus, Edit, Trash2, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatDateToYYYYMMDD, parseDateString } from '@/utils/dateUtils';

const EmployeeSchedule = () => {
  const { token } = useContext(AuthContext);
  const [employees, setEmployees] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [events, setEvents] = useState([]);
  const [rooms, setRooms] = useState([
    { id: 'amarelo', name: 'Salão Amarelo', color: '#facc15' },
    { id: 'laranja', name: 'Salão Laranja', color: '#fb923c' }
  ]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedShift, setSelectedShift] = useState('');

  const shifts = [
    { value: 'manha', label: 'Manhã (08:00-12:00)' },
    { value: 'tarde', label: 'Tarde (13:00-18:00)' },
    { value: 'noite', label: 'Noite (19:00-23:00)' },
    { value: 'integral', label: 'Integral (08:00-18:00)' }
  ];

  useEffect(() => {
    fetchData();
    fetchRooms();
  }, [currentMonth]);

  const fetchRooms = async () => {
    try {
      const response = await axios.get(`${API}/settings/rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && response.data.value) {
        setRooms(response.data.value);
      }
    } catch (error) {
      console.log('Using default rooms');
    }
  };

  const fetchData = async () => {
    try {
      const monthStr = format(currentMonth, 'yyyy-MM');
      const [employeesRes, schedulesRes, eventsRes] = await Promise.all([
        axios.get(`${API}/employees`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/schedules?month=${monthStr}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API}/events`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);
      
      setEmployees(employeesRes.data);
      setSchedules(schedulesRes.data);
      setEvents(eventsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSchedule = async () => {
    if (!selectedDate || !selectedEmployee || !selectedShift) {
      toast.error('Selecione data, funcionário e turno');
      return;
    }

    try {
      const scheduleData = {
        employee_id: selectedEmployee,
        date: formatDateToYYYYMMDD(selectedDate),
        shift: selectedShift,
        confirmed: 'confirmed'
      };

      await axios.post(`${API}/schedules`, scheduleData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Escala adicionada com sucesso!');
      fetchData();
      setSelectedDate(null);
      setSelectedEmployee('');
      setSelectedShift('');
    } catch (error) {
      console.error('Error adding schedule:', error);
      toast.error('Erro ao adicionar escala');
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Tem certeza que deseja remover esta escala?')) return;
    
    try {
      await axios.delete(`${API}/schedules/${scheduleId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Escala removida com sucesso!');
      fetchData();
    } catch (error) {
      console.error('Error deleting schedule:', error);
      toast.error('Erro ao remover escala');
    }
  };

  const getSchedulesForDate = (date) => {
    return schedules.filter(s => s.date === formatDateToYYYYMMDD(date));
  };

  const getEmployeeName = (employeeId) => {
    const employee = employees.find(e => e.id === employeeId);
    return employee ? employee.name : 'Desconhecido';
  };

  const getEventsForDate = (date) => {
    const dateStr = formatDateToYYYYMMDD(date);
    const dayEvents = events.filter(e => e.date === dateStr);
    
    // Agrupar por salão e contar dinamicamente
    const counts = {};
    rooms.forEach(room => {
      counts[room.id] = dayEvents.filter(e => e.room === room.id).length;
    });
    
    return counts;
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Escala de Funcionários</h1>
        <p className="text-slate-600">Gerencie a escala mensal da equipe</p>
      </div>

      {/* Month Navigation */}
      <Card className="p-4 border-0 shadow-sm">
        <div className="flex items-center justify-between">
          <Button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            variant="outline"
          >
            ← Mês Anterior
          </Button>
          <h2 className="text-xl font-bold text-slate-800">
            {format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}
          </h2>
          <Button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            variant="outline"
          >
            Próximo Mês →
          </Button>
        </div>
      </Card>

      {/* Add Schedule Form */}
      <Card className="p-6 border-0 shadow-sm" data-testid="add-schedule-form">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Adicionar à Escala</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <Label>Data Selecionada</Label>
            <div className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                {selectedDate ? (
                  <span className="text-sm">
                    {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Clique em um dia no calendário</span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              💡 Clique em um dia abaixo
            </p>
          </div>
          
          <div>
            <Label className="mb-2">Funcionário</Label>
            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
              <SelectTrigger data-testid="schedule-employee">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="mb-2">Turno</Label>
            <Select value={selectedShift} onValueChange={setSelectedShift}>
              <SelectTrigger data-testid="schedule-shift">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {shifts.map((shift) => (
                  <SelectItem key={shift.value} value={shift.value}>
                    {shift.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div>
            <Label className="mb-2 invisible">Ação</Label>
            <Button
              onClick={handleAddSchedule}
              className="w-full bg-teal-600 hover:bg-teal-700"
              data-testid="add-schedule-button"
            >
              <Plus className="w-4 h-4 mr-2" />
              Adicionar
            </Button>
          </div>
        </div>
      </Card>

      {/* Calendar Grid */}
      <Card className="p-6 border-0 shadow-sm" data-testid="schedule-calendar">
        <div className="grid grid-cols-7 gap-2">
          {/* Header */}
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
            <div key={day} className="text-center font-bold text-slate-700 py-2">
              {day}
            </div>
          ))}
          
          {/* Days */}
          {daysInMonth.map((day) => {
            const daySchedules = getSchedulesForDate(day);
            const isToday = isSameDay(day, new Date());
            
            return (
              <div
                key={day.toString()}
                onClick={() => setSelectedDate(day)}
                className={`min-h-32 p-2 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                  isToday ? 'border-teal-500 bg-teal-50' : 'border-slate-200 bg-white hover:border-teal-300'
                } ${selectedDate && isSameDay(day, selectedDate) ? 'ring-2 ring-teal-500 bg-teal-100' : ''}`}
                data-testid={`day-${format(day, 'yyyy-MM-dd')}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`font-semibold ${selectedDate && isSameDay(day, selectedDate) ? 'text-teal-700' : 'text-slate-700'}`}>
                    {format(day, 'd')}
                  </div>
                  
                  {/* Indicadores de Eventos por Salão */}
                  <div className="flex gap-1 flex-wrap">
                    {(() => {
                      const eventCounts = getEventsForDate(day);
                      return (
                        <>
                          {rooms.map(room => {
                            const count = eventCounts[room.id] || 0;
                            if (count === 0) return null;
                            
                            return (
                              <div 
                                key={room.id}
                                className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shadow-sm"
                                style={{
                                  backgroundColor: room.color,
                                  color: parseInt(room.color.replace('#', ''), 16) > 0xffffff / 2 ? '#000' : '#fff'
                                }}
                                title={`${count} festa(s) - ${room.name}`}
                              >
                                {count}
                              </div>
                            );
                          })}
                        </>
                      );
                    })()}
                  </div>
                </div>
                
                <div className="space-y-1">
                  {daySchedules.map((schedule) => (
                    <div
                      key={schedule.id}
                      className="text-xs p-1 bg-blue-100 text-blue-800 rounded flex items-center justify-between"
                    >
                      <div>
                        <div className="font-medium truncate">
                          {getEmployeeName(schedule.employee_id)}
                        </div>
                        <div className="text-[10px]">
                          {shifts.find(s => s.value === schedule.shift)?.label.split(' ')[0]}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteSchedule(schedule.id)}
                        className="ml-1 text-red-600 hover:text-red-800"
                        data-testid={`delete-schedule-${schedule.id}`}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Summary */}
      <Card className="p-6 border-0 shadow-sm">
        <h3 className="text-lg font-bold text-slate-800 mb-4">Resumo do Mês</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-teal-50 rounded-lg">
            <p className="text-sm text-slate-600 mb-1">Total de Escalas</p>
            <p className="text-2xl font-bold text-teal-700">{schedules.length}</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg">
            <p className="text-sm text-slate-600 mb-1">Funcionários Ativos</p>
            <p className="text-2xl font-bold text-blue-700">
              {new Set(schedules.map(s => s.employee_id)).size}
            </p>
          </div>
          <div className="p-4 bg-orange-50 rounded-lg">
            <p className="text-sm text-slate-600 mb-1">Dias com Escalas</p>
            <p className="text-2xl font-bold text-orange-700">
              {new Set(schedules.map(s => s.date)).size}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default EmployeeSchedule;
