import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/App';
import { API } from '@/App';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Calendar as CalendarIcon, Plus, Edit, Trash2, DollarSign, Clock, FileText } from 'lucide-react';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatDateToYYYYMMDD, parseDateString, isSameDay, createEventDatesArray } from '@/utils/dateUtils';

const Events = () => {
  const { token } = useContext(AuthContext);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingEvent, setEditingEvent] = useState(null);
  const [standardPackages, setStandardPackages] = useState([]);
  const [rooms, setRooms] = useState([
    { id: 'amarelo', name: 'Salão Amarelo', color: '#facc15' },
    { id: 'laranja', name: 'Salão Laranja', color: '#fb923c' }
  ]);
  const [selectedPackage, setSelectedPackage] = useState('');
  const [formData, setFormData] = useState({
    client_name: '',
    cpf: '',
    address: '',
    city_uf: '',
    cep: '',
    phone: '',
    email: '',
    birthday_person_name: '',
    age_to_complete: '',
    party_theme: '',
    balloon_color: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '',
    end_time: '',
    room: [],  // Mudado para array para múltiplos salões
    base_value: '',
    payment_method: '',
    payment_status: 'pending',
    observations: '',
    extra_hours: [],
    game_cards: null,
    waiters: null,
    helpers: null,
    party_kit: null,
    payment_details: {
      deposit: 0,
      installments: [],
      paid_amount: 0,
      remaining: 0
    }
  });

  useEffect(() => {
    fetchEvents();
    fetchStandardPackages();
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const response = await axios.get(`${API}/settings/rooms`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && response.data.value) {
        setRooms(response.data.value);
      }
    } catch (error) {
      // Manter salões padrão se não encontrar configuração
      console.log('Using default rooms');
    }
  };

  const fetchStandardPackages = async () => {
    try {
      const response = await axios.get(`${API}/settings/standard_packages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data && response.data.value) {
        setStandardPackages(response.data.value);
      }
    } catch (error) {
      // Se não existir ainda, criar um array vazio
      if (error.response?.status === 404) {
        setStandardPackages([]);
      } else {
        console.error('Error fetching packages:', error);
      }
    }
  };

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API}/events`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEvents(response.data);
    } catch (error) {
      console.error('Error fetching events:', error);
      toast.error('Erro ao carregar eventos');
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalValue = () => {
    const baseValue = parseFloat(formData.base_value) || 0;
    
    // Calcular total de horas extras
    const extraHoursTotal = formData.extra_hours.reduce((sum, extra) => {
      return sum + (parseFloat(extra.total) || 0);
    }, 0);
    
    // Calcular total de cartões
    const gameCardsTotal = formData.game_cards ? (parseFloat(formData.game_cards.total) || 0) : 0;
    
    // Calcular total de garçons
    const waitersTotal = formData.waiters ? (parseFloat(formData.waiters.total) || 0) : 0;
    
    // Calcular total de copeiras
    const helpersTotal = formData.helpers ? (parseFloat(formData.helpers.total) || 0) : 0;
    
    // Calcular total de kit festa
    const partyKitTotal = formData.party_kit ? (parseFloat(formData.party_kit.total) || 0) : 0;
    
    return baseValue + extraHoursTotal + gameCardsTotal + waitersTotal + helpersTotal + partyKitTotal;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const totalValue = calculateTotalValue();
      
      const payload = {
        ...formData,
        base_value: parseFloat(formData.base_value) || 0,
        total_value: totalValue,
        payment_details: {
          ...formData.payment_details,
          deposit: parseFloat(formData.payment_details.deposit) || 0,
          paid_amount: parseFloat(formData.payment_details.paid_amount) || 0,
          remaining: totalValue - parseFloat(formData.payment_details.paid_amount) || 0
        }
      };

      if (editingEvent) {
        await axios.put(`${API}/events/${editingEvent.id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Evento atualizado com sucesso!');
      } else {
        await axios.post(`${API}/events`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Evento criado com sucesso!');
      }
      
      fetchEvents();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving event:', error);
      toast.error(error.response?.data?.detail || 'Erro ao salvar evento');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este evento?')) return;
    
    try {
      await axios.delete(`${API}/events/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Evento excluído com sucesso!');
      fetchEvents();
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Erro ao excluir evento');
    }
  };

  const handleOpenDialog = (event = null) => {
    if (event) {
      setEditingEvent(event);
      // Converter room para array se for string (compatibilidade com dados antigos)
      let roomValue = event.room;
      if (typeof roomValue === 'string') {
        roomValue = roomValue ? [roomValue] : [];
      } else if (!Array.isArray(roomValue)) {
        roomValue = [];
      }
      setFormData({
        ...event,
        room: roomValue,
        payment_details: event.payment_details || {
          deposit: 0,
          installments: [],
          paid_amount: 0,
          remaining: 0
        }
      });
      setSelectedPackage('');
    } else {
      setEditingEvent(null);
      setFormData({
        client_name: '',
        event_type: '',
        date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: '',
        end_time: '',
        room: [],  // Array vazio para múltiplos salões
        base_value: '',
        payment_status: 'pending',
        observations: '',
        extra_hours: [],
        game_cards: null,
        payment_details: {
          deposit: 0,
          installments: [],
          paid_amount: 0,
          remaining: 0
        }
      });
      setSelectedPackage('');
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingEvent(null);
    setSelectedPackage('');
  };

  const handlePackageSelect = (packageName) => {
    const pkg = standardPackages.find(p => p.name === packageName);
    if (pkg) {
      setSelectedPackage(packageName);
      setFormData({
        ...formData,
        start_time: pkg.start,
        end_time: pkg.end
      });
    }
  };

  const handleTimeChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    // Se o usuário editar manualmente, desmarcar o pacote
    setSelectedPackage('personalizado');
  };

  const handleAddGameCards = () => {
    const quantity = parseInt(prompt('Quantidade de cartões:'));
    const unitPrice = parseFloat(prompt('Preço unitário:'));
    
    if (quantity && unitPrice) {
      setFormData({
        ...formData,
        game_cards: {
          quantity,
          unit_price: unitPrice,
          total: quantity * unitPrice
        }
      });
    }
  };

  const handleAddExtraHour = () => {
    const hours = parseFloat(prompt('Horas extras:'));
    const pricePerHour = parseFloat(prompt('Preço por hora:'));
    
    if (hours && pricePerHour) {
      setFormData({
        ...formData,
        extra_hours: [
          ...formData.extra_hours,
          {
            hours,
            price_per_hour: pricePerHour,
            total: hours * pricePerHour
          }
        ]
      });
    }
  };

  const handleAddWaiters = () => {
    const quantity = parseInt(prompt('Quantidade de garçons:'));
    const unitPrice = parseFloat(prompt('Preço unitário por garçom:'));
    
    if (quantity && unitPrice) {
      setFormData({
        ...formData,
        waiters: {
          quantity,
          unit_price: unitPrice,
          total: quantity * unitPrice
        }
      });
    }
  };

  const handleAddHelpers = () => {
    const quantity = parseInt(prompt('Quantidade de copeiras:'));
    const unitPrice = parseFloat(prompt('Preço unitário por copeira:'));
    
    if (quantity && unitPrice) {
      setFormData({
        ...formData,
        helpers: {
          quantity,
          unit_price: unitPrice,
          total: quantity * unitPrice
        }
      });
    }
  };

  const handleAddPartyKit = () => {
    const quantity = parseInt(prompt('Quantidade de kits festa:'));
    if (!quantity) return;
    
    const totalValue = parseFloat(prompt('Valor TOTAL (não unitário) dos kits:'));
    
    if (quantity && totalValue) {
      setFormData({
        ...formData,
        party_kit: {
          quantity,
          unit_price: totalValue / quantity, // Calcula unitário para manter compatibilidade
          total: totalValue
        }
      });
    }
  };

  // Funções para remover extras
  const handleRemoveGameCards = () => {
    setFormData({ ...formData, game_cards: null });
  };

  const handleRemoveWaiters = () => {
    setFormData({ ...formData, waiters: null });
  };

  const handleRemoveHelpers = () => {
    setFormData({ ...formData, helpers: null });
  };

  const handleRemovePartyKit = () => {
    setFormData({ ...formData, party_kit: null });
  };

  const handleRemoveExtraHour = (index) => {
    const newExtraHours = formData.extra_hours.filter((_, i) => i !== index);
    setFormData({ ...formData, extra_hours: newExtraHours });
  };

  const eventsOnSelectedDate = events.filter(
    e => e.date === formatDateToYYYYMMDD(selectedDate)
  );

  const eventDates = createEventDatesArray(events);
  
  // Handler seguro para seleção de data - previne erro ao clicar no mesmo dia
  const handleDateSelect = (date) => {
    if (!date) return;
    
    // Verifica se é o mesmo dia já selecionado
    if (selectedDate && isSameDay(date, selectedDate)) {
      // Não faz nada, ignora o clique repetido
      return;
    }
    
    // Atualiza com a nova data
    setSelectedDate(date);
  };

  const handleGenerateReport = async () => {
    try {
      const month = format(selectedDate, 'yyyy-MM');
      const response = await axios.get(`${API}/reports/financial/${month}`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Criar um link para download do PDF
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `relatorio-${month}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Relatório gerado com sucesso!');
    } catch (error) {
      console.error('Error generating report:', error);
      if (error.response?.status === 404) {
        toast.error('Nenhum evento encontrado para este mês');
      } else {
        toast.error('Erro ao gerar relatório');
      }
    }
  };

  const handleGenerateContract = async (eventId) => {
    try {
      toast.info('Gerando contrato...');
      
      // Primeiro, verificar qual modo de contrato está ativo
      let contractMode = 'editor';
      try {
        const modeResponse = await axios.get(`${API}/settings/contract_mode`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        contractMode = modeResponse.data?.value || 'editor';
      } catch (e) {
        // Se não encontrar, usar editor como padrão
        contractMode = 'editor';
      }
      
      // Chamar endpoint correto baseado no modo
      const endpoint = contractMode === 'pdf_base' 
        ? `${API}/contracts/generate-pdf-base/${eventId}`
        : `${API}/contracts/generate/${eventId}`;
      
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      // Criar um link para download do PDF
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `contrato-${eventId}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Contrato gerado com sucesso!');
    } catch (error) {
      console.error('Error generating contract:', error);
      if (error.response?.status === 404) {
        toast.error('Modelo de contrato não configurado. Configure em Configurações.');
      } else {
        toast.error('Erro ao gerar contrato');
      }
    }
  };

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Reservas</h1>
          <p className="text-slate-600">Gerencie os eventos e reservas do salão</p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleGenerateReport}
            variant="outline"
            className="gap-2"
            data-testid="generate-report-button"
          >
            <DollarSign className="w-4 h-4" />
            Relatório do Mês
          </Button>
          <Button
            onClick={() => handleOpenDialog()}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            data-testid="create-event-button"
          >
            <Plus className="w-4 h-4" />
            Nova Reserva
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <Card className="p-6 border-0 shadow-sm lg:col-span-1" data-testid="calendar-section">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Calendário</h2>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            className="rounded-md border"
            locale={ptBR}
            modifiers={{
              booked: eventDates
            }}
            modifiersStyles={{
              booked: { backgroundColor: '#ccfbf1', fontWeight: 'bold' }
            }}
          />
          
          <div className="mt-4 p-3 bg-teal-50 rounded-lg">
            <p className="text-sm font-medium text-teal-800">
              {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
            <p className="text-xs text-teal-600 mt-1">
              {eventsOnSelectedDate.length} evento(s) neste dia
            </p>
          </div>
        </Card>

        {/* Events List */}
        <Card className="p-6 border-0 shadow-sm lg:col-span-2" data-testid="events-list">
          <h2 className="text-lg font-bold text-slate-800 mb-4">
            Eventos em {format(selectedDate, "dd/MM/yyyy")}
          </h2>
          
          {eventsOnSelectedDate.length === 0 ? (
            <div className="text-center py-12">
              <CalendarIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">Nenhum evento neste dia</p>
            </div>
          ) : (
            <div className="space-y-3">
              {eventsOnSelectedDate.map((event) => (
                <div
                  key={event.id}
                  className="p-4 bg-slate-50 border border-slate-100 rounded-lg hover:shadow-md transition-shadow"
                  data-testid={`event-${event.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold text-slate-800">{event.client_name}</h3>
                        {(() => {
                          // Suporta tanto string (dados antigos) quanto array (novo formato)
                          const eventRooms = Array.isArray(event.room) ? event.room : (event.room ? [event.room] : []);
                          return eventRooms.map(roomId => {
                            const room = rooms.find(r => r.id === roomId);
                            if (!room || !room.color) return null;
                            const colorHex = room.color.replace('#', '');
                            const textColor = parseInt(colorHex, 16) > 0xffffff / 2 ? '#000' : '#fff';
                            return (
                              <span 
                                key={roomId}
                                className="px-3 py-1 rounded-full text-xs font-bold"
                                style={{
                                  backgroundColor: room.color,
                                  color: textColor
                                }}
                              >
                                {room.name}
                              </span>
                            );
                          });
                        })()}
                        <span className={`status-badge status-${event.payment_status}`}>
                          {event.payment_status === 'paid' ? 'Pago' : event.payment_status === 'partial' ? 'Parcial' : 'Pendente'}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm text-slate-600">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {event.start_time} - {event.end_time}
                        </div>
                        <div className="flex items-center gap-1">
                          <DollarSign className="w-4 h-4" />
                          <span className="font-semibold text-slate-700">
                            R$ {(event.total_value || event.base_value).toFixed(2)}
                          </span>
                        </div>
                      </div>
                      
                      {event.payment_status === 'partial' && event.payment_details && (
                        <div className="mt-2 p-2 bg-amber-50 rounded border border-amber-200">
                          <p className="text-xs font-medium text-amber-800">Pagamento Parcial:</p>
                          <p className="text-xs text-amber-700">
                            Pago: R$ {(event.payment_details.paid_amount || 0).toFixed(2)} | 
                            Restante: R$ {((event.total_value || event.base_value) - (event.payment_details.paid_amount || 0)).toFixed(2)}
                          </p>
                        </div>
                      )}
                      
                      <p className="text-xs text-slate-500 mt-1 capitalize">{event.event_type}</p>
                      
                      {event.extra_hours && event.extra_hours.length > 0 && (
                        <div className="mt-2 p-2 bg-blue-50 rounded">
                          <p className="text-xs font-medium text-blue-800">Horas Extras:</p>
                          {event.extra_hours.map((extra, idx) => (
                            <p key={idx} className="text-xs text-blue-700">
                              {extra.hours}h x R$ {extra.price_per_hour.toFixed(2)} = R$ {extra.total.toFixed(2)}
                            </p>
                          ))}
                        </div>
                      )}
                      
                      {event.game_cards && (
                        <p className="text-xs text-teal-600 mt-1">
                          {event.game_cards.quantity} cartões de jogos (R$ {event.game_cards.total.toFixed(2)})
                        </p>
                      )}
                      
                      {event.waiters && (
                        <p className="text-xs text-purple-600 mt-1">
                          {event.waiters.quantity} garçons (R$ {event.waiters.total.toFixed(2)})
                        </p>
                      )}
                      
                      {event.helpers && (
                        <p className="text-xs text-pink-600 mt-1">
                          {event.helpers.quantity} copeiras (R$ {event.helpers.total.toFixed(2)})
                        </p>
                      )}
                      
                      {event.party_kit && (
                        <p className="text-xs text-orange-600 mt-1">
                          {event.party_kit.quantity} kit(s) festa (R$ {event.party_kit.total.toFixed(2)})
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDialog(event)}
                        data-testid={`edit-event-${event.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(event.id)}
                        className="text-red-600 hover:bg-red-50"
                        data-testid={`delete-event-${event.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Create/Edit Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="event-dialog">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Editar Evento' : 'Nova Reserva'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Dados do Contratante */}
            <div className="border-b pb-4 mb-4">
              <h3 className="text-md font-semibold text-slate-700 mb-3">Dados do Contratante</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label>Nome do Cliente (Contratante)</Label>
                  <Input
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    required
                    data-testid="event-client-name"
                  />
                </div>
                
                <div>
                  <Label>CPF</Label>
                  <Input
                    value={formData.cpf}
                    onChange={(e) => setFormData({ ...formData, cpf: e.target.value })}
                    placeholder="000.000.000-00"
                    data-testid="event-cpf"
                  />
                </div>
                
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(00) 00000-0000"
                    data-testid="event-phone"
                  />
                </div>
                
                <div className="col-span-2">
                  <Label>Endereço</Label>
                  <Input
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    data-testid="event-address"
                  />
                </div>
                
                <div>
                  <Label>Cidade / UF</Label>
                  <Input
                    value={formData.city_uf}
                    onChange={(e) => setFormData({ ...formData, city_uf: e.target.value })}
                    placeholder="Cidade - UF"
                    data-testid="event-city-uf"
                  />
                </div>
                
                <div>
                  <Label>CEP</Label>
                  <Input
                    value={formData.cep}
                    onChange={(e) => setFormData({ ...formData, cep: e.target.value })}
                    placeholder="00000-000"
                    data-testid="event-cep"
                  />
                </div>
                
                <div className="col-span-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    data-testid="event-email"
                  />
                </div>
              </div>
            </div>
            
            {/* Dados do Evento */}
            <div className="border-b pb-4 mb-4">
              <h3 className="text-md font-semibold text-slate-700 mb-3">Dados do Evento</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome do Aniversariante</Label>
                  <Input
                    value={formData.birthday_person_name}
                    onChange={(e) => setFormData({ ...formData, birthday_person_name: e.target.value })}
                    required
                    data-testid="event-birthday-person"
                  />
                </div>
                
                <div>
                  <Label>Idade a Completar</Label>
                  <Input
                    type="number"
                    value={formData.age_to_complete}
                    onChange={(e) => setFormData({ ...formData, age_to_complete: e.target.value })}
                    placeholder="Ex: 10"
                    data-testid="event-age"
                  />
                </div>
                
                <div>
                  <Label>Tema da Festa</Label>
                  <Input
                    value={formData.party_theme}
                    onChange={(e) => setFormData({ ...formData, party_theme: e.target.value })}
                    placeholder="Ex: Super-Heróis"
                    data-testid="event-theme"
                  />
                </div>
                
                <div>
                  <Label>Cor dos Balões</Label>
                  <Input
                    value={formData.balloon_color}
                    onChange={(e) => setFormData({ ...formData, balloon_color: e.target.value })}
                    placeholder="Ex: Azul e Branco"
                    data-testid="event-balloon-color"
                  />
                </div>
              </div>
            </div>

            <div>
              <Label className="block mb-3">Selecione o(s) Salão(ões)</Label>
              <p className="text-xs text-slate-500 mb-2">Você pode selecionar mais de um salão para a mesma reserva</p>
              <div className="flex gap-4 flex-wrap">
                {rooms.map((room) => {
                  const isSelected = Array.isArray(formData.room) && formData.room.includes(room.id);
                  return (
                    <label key={room.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value={room.id}
                        checked={isSelected}
                        onChange={(e) => {
                          const roomId = e.target.value;
                          let newRooms;
                          if (e.target.checked) {
                            newRooms = [...(formData.room || []), roomId];
                          } else {
                            newRooms = (formData.room || []).filter(r => r !== roomId);
                          }
                          setFormData({ ...formData, room: newRooms });
                        }}
                        className="w-4 h-4 rounded"
                        data-testid={`room-${room.id}`}
                      />
                      <span 
                        className={`px-3 py-1 rounded-full text-sm font-semibold transition-all ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                        style={{
                          backgroundColor: room.color || '#gray',
                          color: room.color ? (parseInt(room.color.replace('#', ''), 16) > 0xffffff / 2 ? '#000' : '#fff') : '#000'
                        }}
                      >
                        {room.name}
                      </span>
                    </label>
                  );
                })}
              </div>
              {formData.room?.length > 0 && (
                <p className="text-xs text-teal-600 mt-2">
                  Selecionado(s): {formData.room.map(r => rooms.find(rm => rm.id === r)?.name).join(', ')}
                </p>
              )}
            </div>

            <div>
              <Label>Pacote de Horário</Label>
              <Select
                value={selectedPackage}
                onValueChange={handlePackageSelect}
              >
                <SelectTrigger data-testid="event-package">
                  <SelectValue placeholder="Selecione um pacote ou personalize" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="personalizado">Personalizado</SelectItem>
                  {standardPackages.map((pkg) => (
                    <SelectItem key={pkg.name} value={pkg.name}>
                      {pkg.name} ({pkg.start} - {pkg.end})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                Selecione um pacote padrão ou escolha &quot;Personalizado&quot; para definir horários manualmente
              </p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Data</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  data-testid="event-date"
                />
              </div>
              
              <div>
                <Label>Horário Início</Label>
                <Input
                  type="time"
                  value={formData.start_time}
                  onChange={(e) => handleTimeChange('start_time', e.target.value)}
                  required
                  data-testid="event-start-time"
                />
              </div>
              
              <div>
                <Label>Horário Fim</Label>
                <Input
                  type="time"
                  value={formData.end_time}
                  onChange={(e) => handleTimeChange('end_time', e.target.value)}
                  required
                  data-testid="event-end-time"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Valor Base</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.base_value}
                  onChange={(e) => setFormData({ ...formData, base_value: e.target.value })}
                  required
                  data-testid="event-base-value"
                />
              </div>
              
              <div>
                <Label>Valor Total</Label>
                <div className="flex h-10 w-full items-center rounded-md border border-input bg-slate-50 px-3 py-2 text-sm font-semibold text-teal-700">
                  R$ {calculateTotalValue().toFixed(2)}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Base + Extras + Cartões
                </p>
              </div>
              
              <div>
                <Label>Status Pagamento</Label>
                <Select
                  value={formData.payment_status}
                  onValueChange={(value) => {
                    const updates = { ...formData, payment_status: value };
                    
                    // Se mudou para "Pago", marcar valor total como pago
                    if (value === 'paid' && formData.base_value) {
                      updates.payment_details = {
                        ...formData.payment_details,
                        paid_amount: parseFloat(formData.base_value) || 0
                      };
                    }
                    
                    // Se mudou para "Pendente", zerar valor pago
                    if (value === 'pending') {
                      updates.payment_details = {
                        ...formData.payment_details,
                        paid_amount: 0
                      };
                    }
                    
                    setFormData(updates);
                  }}
                >
                  <SelectTrigger data-testid="event-payment-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="partial">Parcial</SelectItem>
                    <SelectItem value="paid">Pago</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label>Forma de Pagamento</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
              >
                <SelectTrigger data-testid="event-payment-method">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Débito">Débito</SelectItem>
                  <SelectItem value="Crédito">Crédito</SelectItem>
                  <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="Transferência / Pix">Transferência / Pix</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.payment_status === 'partial' && (
              <div>
                <Label>Sinal/Valor Pago</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.payment_details.paid_amount}
                  onChange={(e) => setFormData({
                    ...formData,
                    payment_details: {
                      ...formData.payment_details,
                      paid_amount: e.target.value
                    }
                  })}
                  data-testid="event-paid-amount"
                  placeholder="0.00"
                />
                {formData.base_value && formData.payment_details.paid_amount > 0 && (
                  <p className="text-xs text-slate-600 mt-1">
                    Restante: R$ {(parseFloat(formData.base_value) - parseFloat(formData.payment_details.paid_amount || 0)).toFixed(2)}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Extras</Label>
              <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="outline" onClick={handleAddExtraHour}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Hora Extra
                </Button>
                <Button type="button" variant="outline" onClick={handleAddGameCards}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Cartões de Jogos
                </Button>
                <Button type="button" variant="outline" onClick={handleAddWaiters}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Garçons
                </Button>
                <Button type="button" variant="outline" onClick={handleAddHelpers}>
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Copeiras
                </Button>
                <Button type="button" variant="outline" onClick={handleAddPartyKit} className="col-span-2">
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Kit Festa
                </Button>
              </div>
              
              {formData.extra_hours && formData.extra_hours.length > 0 && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm space-y-1">
                  <p className="font-medium text-blue-800 mb-2">Horas Extras Adicionadas:</p>
                  {formData.extra_hours.map((extra, idx) => (
                    <div key={idx} className="relative flex items-center justify-between text-blue-700 p-2 bg-blue-100 rounded">
                      <span>{extra.hours}h x R$ {extra.price_per_hour.toFixed(2)}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">R$ {extra.total.toFixed(2)}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExtraHour(idx)}
                          className="w-4 h-4 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 text-xs font-bold"
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-blue-200 pt-1 mt-2">
                    <div className="flex items-center justify-between font-bold text-blue-800">
                      <span>Total Horas Extras:</span>
                      <span>R$ {formData.extra_hours.reduce((sum, e) => sum + e.total, 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {formData.game_cards && (
                <div className="relative p-3 bg-teal-50 rounded-lg text-sm">
                  <button
                    type="button"
                    onClick={handleRemoveGameCards}
                    className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 text-xs font-bold"
                  >
                    ×
                  </button>
                  <p className="font-medium text-teal-800 pr-6">
                    {formData.game_cards.quantity} cartões x R$ {formData.game_cards.unit_price.toFixed(2)} = R$ {formData.game_cards.total.toFixed(2)}
                  </p>
                </div>
              )}
              
              {formData.waiters && (
                <div className="relative p-3 bg-purple-50 rounded-lg text-sm">
                  <button
                    type="button"
                    onClick={handleRemoveWaiters}
                    className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 text-xs font-bold"
                  >
                    ×
                  </button>
                  <p className="font-medium text-purple-800 pr-6">
                    {formData.waiters.quantity} garçons x R$ {formData.waiters.unit_price.toFixed(2)} = R$ {formData.waiters.total.toFixed(2)}
                  </p>
                </div>
              )}
              
              {formData.helpers && (
                <div className="relative p-3 bg-pink-50 rounded-lg text-sm">
                  <button
                    type="button"
                    onClick={handleRemoveHelpers}
                    className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 text-xs font-bold"
                  >
                    ×
                  </button>
                  <p className="font-medium text-pink-800 pr-6">
                    {formData.helpers.quantity} copeiras x R$ {formData.helpers.unit_price.toFixed(2)} = R$ {formData.helpers.total.toFixed(2)}
                  </p>
                </div>
              )}
              
              {formData.party_kit && (
                <div className="relative p-3 bg-orange-50 rounded-lg text-sm">
                  <button
                    type="button"
                    onClick={handleRemovePartyKit}
                    className="absolute top-2 right-2 w-5 h-5 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 text-xs font-bold"
                  >
                    ×
                  </button>
                  <p className="font-medium text-orange-800 pr-6">
                    {formData.party_kit.quantity} kit(s) festa - Total: R$ {formData.party_kit.total.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            <div>
              <Label>Observações</Label>
              <textarea
                className="w-full p-2 border border-slate-200 rounded-md"
                rows={3}
                value={formData.observations}
                onChange={(e) => setFormData({ ...formData, observations: e.target.value })}
                data-testid="event-observations"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-700" data-testid="save-event-button">
                {editingEvent ? 'Atualizar' : 'Criar'} Evento
              </Button>
              <Button type="button" variant="outline" onClick={handleCloseDialog} className="flex-1">
                Cancelar
              </Button>
            </div>
            
            {/* Generate Contract Button - only for existing events */}
            {editingEvent && (
              <div className="pt-4 border-t border-slate-200 mt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 text-indigo-600 border-indigo-300 hover:bg-indigo-50"
                  onClick={() => handleGenerateContract(editingEvent.id)}
                  data-testid="generate-contract-button"
                >
                  <FileText className="w-4 h-4" />
                  Gerar Contrato PDF
                </Button>
              </div>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Events;