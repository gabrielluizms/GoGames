import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/App';
import { API } from '@/App';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings as SettingsIcon, Bell, DollarSign, Clock, UserPlus, Users as UsersIcon, Edit, Trash2, FileText, FileUp } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import ContractPdfEditor from '@/components/ContractPdfEditor';

const Settings = () => {
  const { token, user } = useContext(AuthContext);
  const [loading, setLoading] = useState(true);
  const [alertDays, setAlertDays] = useState(3);
  const [cardPrice, setCardPrice] = useState(5.00);
  const [standardPackages, setStandardPackages] = useState([
    { name: 'Manhã', start: '09:00', end: '13:00' },
    { name: 'Tarde', start: '14:00', end: '18:00' },
    { name: 'Noite', start: '19:00', end: '23:00' }
  ]);
  const [rooms, setRooms] = useState([
    { id: 'amarelo', name: 'Salão Amarelo', color: '#facc15' },
    { id: 'laranja', name: 'Salão Laranja', color: '#fb923c' }
  ]);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [users, setUsers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    username: '',
    password: '',
    role: 'user'
  });
  const [contractTemplate, setContractTemplate] = useState('');
  const [contractMode, setContractMode] = useState('editor'); // 'editor' ou 'pdf_base'
  const [pdfBase, setPdfBase] = useState(null);
  const [pdfFields, setPdfFields] = useState([]);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      const settings = response.data;
      settings.forEach(setting => {
        if (setting.key === 'alert_days') {
          setAlertDays(setting.value);
        } else if (setting.key === 'card_price') {
          setCardPrice(setting.value);
        } else if (setting.key === 'standard_packages') {
          setStandardPackages(setting.value);
        } else if (setting.key === 'rooms') {
          setRooms(setting.value);
        } else if (setting.key === 'contract_template') {
          setContractTemplate(setting.value);
        } else if (setting.key === 'contract_mode') {
          setContractMode(setting.value);
        } else if (setting.key === 'contract_pdf_base') {
          setPdfBase(setting.value);
        } else if (setting.key === 'contract_pdf_fields') {
          setPdfFields(setting.value);
        }
      });
      
      // Se não tiver template, carregar template padrão
      const hasTemplate = settings.find(s => s.key === 'contract_template');
      if (!hasTemplate) {
        loadDefaultTemplate();
      }

      // Fetch users (only admin can see)
      if (user?.role === 'admin') {
        fetchUsers();
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await axios.get(`${API}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleCreateUser = async () => {
    if (!newUsername || !newPassword) {
      toast.error('Preencha usuário e senha');
      return;
    }

    try {
      await axios.post(`${API}/auth/register`, {
        username: newUsername,
        password: newPassword,
        role: 'user'
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Usuário criado com sucesso!');
      setNewUsername('');
      setNewPassword('');
      fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      toast.error(error.response?.data?.detail || 'Erro ao criar usuário');
    }
  };

  const handleEditUser = (userToEdit) => {
    setEditingUser(userToEdit);
    setEditFormData({
      username: userToEdit.username,
      password: '',
      role: userToEdit.role
    });
    setEditDialogOpen(true);
  };

  const handleUpdateUser = async () => {
    if (!editFormData.username) {
      toast.error('Nome de usuário é obrigatório');
      return;
    }

    try {
      await axios.put(`${API}/users/${editingUser.id}`, editFormData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Usuário atualizado com sucesso!');
      setEditDialogOpen(false);
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error(error.response?.data?.detail || 'Erro ao atualizar usuário');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Tem certeza que deseja excluir este usuário?')) return;

    try {
      await axios.delete(`${API}/users/${userId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Usuário excluído com sucesso!');
      fetchUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error(error.response?.data?.detail || 'Erro ao excluir usuário');
    }
  };

  const saveSetting = async (key, value) => {
    try {
      await axios.post(`${API}/settings`, { key, value }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Configuração salva com sucesso!');
    } catch (error) {
      console.error('Error saving setting:', error);
      toast.error('Erro ao salvar configuração');
    }
  };

  const handleSaveAlertDays = () => {
    saveSetting('alert_days', parseInt(alertDays));
  };

  const handleSaveCardPrice = () => {
    saveSetting('card_price', parseFloat(cardPrice));
  };

  const handleSavePackages = () => {
    saveSetting('standard_packages', standardPackages);
  };

  const handleSaveRooms = () => {
    saveSetting('rooms', rooms);
  };

  const loadDefaultTemplate = () => {
    const defaultTemplate = `<h2>CONTRATO DE PRESTAÇÃO DE SERVIÇOS</h2>
<p><strong>CONTRATANTE:</strong> <span style="color: #3b82f6;">@client_name</span></p>
<p><strong>CPF:</strong> <span style="color: #3b82f6;">@cpf</span></p>
<p><strong>Endereço:</strong> <span style="color: #3b82f6;">@address</span></p>
<p><strong>Cidade/UF:</strong> <span style="color: #3b82f6;">@city_uf</span></p>
<p><strong>CEP:</strong> <span style="color: #3b82f6;">@cep</span></p>
<p><strong>Telefone:</strong> <span style="color: #3b82f6;">@phone</span></p>
<p><strong>E-mail:</strong> <span style="color: #3b82f6;">@email</span></p>

<h3>DADOS DO EVENTO</h3>
<p><strong>Nome do Aniversariante:</strong> <span style="color: #3b82f6;">@birthday_person_name</span></p>
<p><strong>Idade a Completar:</strong> <span style="color: #3b82f6;">@age_to_complete</span> anos</p>
<p><strong>Data do Evento:</strong> <span style="color: #3b82f6;">@event_date</span></p>
<p><strong>Horário:</strong> <span style="color: #3b82f6;">@start_time</span> às <span style="color: #3b82f6;">@end_time</span></p>
<p><strong>Espaço Escolhido:</strong> <span style="color: #3b82f6;">@room</span></p>
<p><strong>Tema da Festa:</strong> <span style="color: #3b82f6;">@party_theme</span></p>
<p><strong>Cor dos Balões:</strong> <span style="color: #3b82f6;">@balloon_color</span></p>

<h3>VALORES</h3>
<p><strong>Valor Base:</strong> R$ <span style="color: #3b82f6;">@base_value</span></p>
<p><strong>Valor Total do Contrato:</strong> R$ <span style="color: #3b82f6;">@total_value</span></p>
<p><strong>Forma de Pagamento:</strong> <span style="color: #3b82f6;">@payment_method</span></p>

<h3>EXTRAS CONTRATADOS</h3>
<p><span style="color: #3b82f6;">@extras</span></p>

<h3>CLÁUSULAS</h3>
<p>1. O presente contrato tem por objeto a locação do espaço para realização de festa infantil.</p>
<p>2. O CONTRATANTE se compromete a zelar pelo espaço e equipamentos disponibilizados.</p>
<p>3. Qualquer dano causado ao patrimônio será de responsabilidade do CONTRATANTE.</p>
<p>4. O pagamento deverá ser realizado conforme acordado entre as partes.</p>

<br>
<p>_________________________________</p>
<p>Assinatura do Contratante</p>
<p><span style="color: #3b82f6;">@client_name</span></p>

<p>Data: ____ / ____ / ________</p>`;
    
    setContractTemplate(defaultTemplate);
  };

  const handleSaveContract = () => {
    saveSetting('contract_template', contractTemplate);
  };

  const handleAddRoom = () => {
    const newRoom = {
      id: `room_${Date.now()}`,
      name: 'Novo Salão',
      color: '#10b981'
    };
    setRooms([...rooms, newRoom]);
  };

  const handleRemoveRoom = (index) => {
    if (rooms.length <= 1) {
      toast.error('É necessário ter pelo menos um salão');
      return;
    }
    const newRooms = rooms.filter((_, i) => i !== index);
    setRooms(newRooms);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-96">
        <Card className="p-8 text-center">
          <SettingsIcon className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600">Apenas administradores podem acessar as configurações</p>
        </Card>
      </div>
    );
  }

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
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Configurações</h1>
        <p className="text-slate-600">Gerencie as configurações do sistema</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Alert Settings */}
        <Card className="p-6 border-0 shadow-sm" data-testid="alert-settings">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-orange-600" />
            <h2 className="text-lg font-bold text-slate-800">Alertas</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label>Dias de antecedência para alertas</Label>
              <p className="text-sm text-slate-600 mb-2">
                O sistema irá alertar sobre eventos com esta antecedência
              </p>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="1"
                  max="30"
                  value={alertDays}
                  onChange={(e) => setAlertDays(e.target.value)}
                  className="w-24"
                  data-testid="alert-days-input"
                />
                <span className="flex items-center text-slate-600">dias</span>
              </div>
            </div>
            
            <Button
              onClick={handleSaveAlertDays}
              className="w-full bg-teal-600 hover:bg-teal-700"
              data-testid="save-alert-days"
            >
              Salvar Configuração de Alertas
            </Button>
          </div>
        </Card>

        {/* Card Price Settings */}
        <Card className="p-6 border-0 shadow-sm" data-testid="card-price-settings">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-5 h-5 text-green-600" />
            <h2 className="text-lg font-bold text-slate-800">Preços</h2>
          </div>
          
          <div className="space-y-4">
            <div>
              <Label>Preço padrão do cartão de jogos</Label>
              <p className="text-sm text-slate-600 mb-2">
                Valor unitário sugerido para cartões de jogos
              </p>
              <div className="flex gap-2">
                <span className="flex items-center text-slate-600">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={cardPrice}
                  onChange={(e) => setCardPrice(e.target.value)}
                  className="flex-1"
                  data-testid="card-price-input"
                />
              </div>
            </div>
            
            <Button
              onClick={handleSaveCardPrice}
              className="w-full bg-teal-600 hover:bg-teal-700"
              data-testid="save-card-price"
            >
              Salvar Preço de Cartões
            </Button>
          </div>
        </Card>
      </div>

      {/* Standard Packages */}
      <Card className="p-6 border-0 shadow-sm" data-testid="packages-settings">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-5 h-5 text-teal-600" />
          <h2 className="text-lg font-bold text-slate-800">Pacotes de Horário Padrão</h2>
        </div>
        
        <p className="text-sm text-slate-600 mb-4">
          Configure os horários padrão para facilitar o cadastro de eventos
        </p>
        
        <div className="space-y-4">
          {standardPackages.map((pkg, index) => (
            <div key={index} className="grid grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
              <div>
                <Label>Nome do Pacote</Label>
                <Input
                  value={pkg.name}
                  onChange={(e) => {
                    const newPackages = [...standardPackages];
                    newPackages[index].name = e.target.value;
                    setStandardPackages(newPackages);
                  }}
                  data-testid={`package-name-${index}`}
                />
              </div>
              
              <div>
                <Label>Horário Início</Label>
                <Input
                  type="time"
                  value={pkg.start}
                  onChange={(e) => {
                    const newPackages = [...standardPackages];
                    newPackages[index].start = e.target.value;
                    setStandardPackages(newPackages);
                  }}
                  data-testid={`package-start-${index}`}
                />
              </div>
              
              <div>
                <Label>Horário Fim</Label>
                <Input
                  type="time"
                  value={pkg.end}
                  onChange={(e) => {
                    const newPackages = [...standardPackages];
                    newPackages[index].end = e.target.value;
                    setStandardPackages(newPackages);
                  }}
                  data-testid={`package-end-${index}`}
                />
              </div>
            </div>
          ))}
          
          <Button
            onClick={handleSavePackages}
            className="w-full bg-teal-600 hover:bg-teal-700"
            data-testid="save-packages"
          >
            Salvar Pacotes de Horário
          </Button>
        </div>
      </Card>

      {/* Room Management */}
      <Card className="p-6 border-0 shadow-sm" data-testid="rooms-settings">
        <div className="flex items-center gap-2 mb-4">
          <SettingsIcon className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-bold text-slate-800">Gerenciamento de Salões</h2>
        </div>
        
        <p className="text-sm text-slate-600 mb-4">
          Configure os salões disponíveis e suas cores para identificação visual
        </p>
        
        <div className="space-y-4">
          {rooms.map((room, index) => (
            <div key={room.id} className="grid grid-cols-12 gap-4 p-4 bg-slate-50 rounded-lg items-end">
              <div className="col-span-5">
                <Label>Nome do Salão</Label>
                <Input
                  value={room.name}
                  onChange={(e) => {
                    const newRooms = [...rooms];
                    newRooms[index].name = e.target.value;
                    setRooms(newRooms);
                  }}
                  data-testid={`room-name-${index}`}
                />
              </div>
              
              <div className="col-span-3">
                <Label>Cor de Identificação</Label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={room.color}
                    onChange={(e) => {
                      const newRooms = [...rooms];
                      newRooms[index].color = e.target.value;
                      setRooms(newRooms);
                    }}
                    className="w-12 h-9 rounded border border-slate-200 cursor-pointer"
                    data-testid={`room-color-${index}`}
                  />
                  <Input
                    value={room.color}
                    onChange={(e) => {
                      const newRooms = [...rooms];
                      newRooms[index].color = e.target.value;
                      setRooms(newRooms);
                    }}
                    placeholder="#000000"
                    className="flex-1"
                    data-testid={`room-color-input-${index}`}
                  />
                </div>
              </div>
              
              <div className="col-span-3">
                <Label>Preview</Label>
                <div 
                  className="h-9 rounded-lg flex items-center justify-center text-sm font-semibold"
                  style={{ 
                    backgroundColor: room.color || '#888',
                    color: room.color ? (parseInt(room.color.replace('#', ''), 16) > 0xffffff / 2 ? '#000' : '#fff') : '#fff'
                  }}
                >
                  {room.name}
                </div>
              </div>
              
              <div className="col-span-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleRemoveRoom(index)}
                  className="text-red-600 hover:bg-red-50"
                  data-testid={`remove-room-${index}`}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          
          <Button
            onClick={handleAddRoom}
            variant="outline"
            className="w-full"
            data-testid="add-room"
          >
            + Adicionar Novo Salão
          </Button>
          
          <Button
            onClick={handleSaveRooms}
            className="w-full bg-teal-600 hover:bg-teal-700"
            data-testid="save-rooms"
          >
            Salvar Configurações de Salões
          </Button>
        </div>
      </Card>

      {/* User Management */}
      <Card className="p-6 border-0 shadow-sm" data-testid="user-management">
        <div className="flex items-center gap-2 mb-4">
          <UsersIcon className="w-5 h-5 text-blue-600" />
          <h2 className="text-lg font-bold text-slate-800">Gestão de Usuários</h2>
        </div>
        
        <p className="text-sm text-slate-600 mb-4">
          Crie novos usuários com acesso ao sistema (sem permissão de admin)
        </p>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <Label>Nome de Usuário</Label>
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Digite o nome de usuário"
              data-testid="new-username"
            />
          </div>
          
          <div>
            <Label>Senha</Label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Digite a senha"
              data-testid="new-password"
            />
          </div>
        </div>
        
        <Button
          onClick={handleCreateUser}
          className="w-full bg-blue-600 hover:bg-blue-700 gap-2"
          data-testid="create-user-button"
        >
          <UserPlus className="w-4 h-4" />
          Criar Novo Usuário
        </Button>

        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-800">
            <strong>Nota:</strong> Os novos usuários criados terão acesso a todas as funcionalidades do sistema, exceto esta página de configurações.
          </p>
        </div>

        {/* Users List */}
        <div className="mt-6">
          <h3 className="text-md font-semibold text-slate-800 mb-3">Usuários Cadastrados</h3>
          
          {users.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum usuário cadastrado</p>
          ) : (
            <div className="space-y-2">
              {users.map((usr) => {
                const adminCount = users.filter(u => u.role === 'admin').length;
                const isLastAdmin = usr.role === 'admin' && adminCount === 1;
                
                return (
                  <div
                    key={usr.id}
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
                    data-testid={`user-${usr.id}`}
                  >
                    <div>
                      <p className="font-medium text-slate-800">{usr.username}</p>
                      <p className="text-xs text-slate-600 capitalize">
                        {usr.role === 'admin' ? 'Administrador' : 'Usuário Comum'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEditUser(usr)}
                        data-testid={`edit-user-${usr.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      {!isLastAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteUser(usr.id)}
                          className="text-red-600 hover:bg-red-50"
                          data-testid={`delete-user-${usr.id}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                      {isLastAdmin && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled
                          className="text-slate-400 cursor-not-allowed"
                          data-testid={`delete-user-disabled-${usr.id}`}
                          title="Não é possível excluir o único administrador do sistema"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Contract Template Editor */}
      <Card className="p-6 border-0 shadow-sm" data-testid="contract-settings">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-indigo-600" />
          <h2 className="text-lg font-bold text-slate-800">Configuração de Contrato</h2>
        </div>
        
        <p className="text-sm text-slate-600 mb-4">
          Escolha o modo de geração de contratos e configure o modelo desejado.
        </p>

        {/* Mode Selection */}
        <div className="mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Modo de Contrato</h3>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="contractMode"
                value="editor"
                checked={contractMode === 'editor'}
                onChange={(e) => {
                  setContractMode(e.target.value);
                  saveSetting('contract_mode', e.target.value);
                }}
                className="w-4 h-4 text-indigo-600"
              />
              <div>
                <span className="font-medium text-slate-700">Editor de Texto</span>
                <p className="text-xs text-slate-500">Crie o contrato do zero usando o editor rico</p>
              </div>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="contractMode"
                value="pdf_base"
                checked={contractMode === 'pdf_base'}
                onChange={(e) => {
                  setContractMode(e.target.value);
                  saveSetting('contract_mode', e.target.value);
                }}
                className="w-4 h-4 text-indigo-600"
              />
              <div>
                <span className="font-medium text-slate-700">PDF Base (Upload)</span>
                <p className="text-xs text-slate-500">Use um PDF existente e adicione campos dinâmicos</p>
              </div>
            </label>
          </div>
        </div>

        {/* Editor Mode */}
        {contractMode === 'editor' && (
          <>
            {/* Available Variables */}
            <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <h3 className="text-sm font-semibold text-indigo-800 mb-2">Variáveis Disponíveis</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 text-xs">
                <div className="space-y-1">
                  <p className="font-semibold text-slate-700">Cliente</p>
                  <p><code className="bg-white px-1 rounded">@client_name</code> Nome</p>
                  <p><code className="bg-white px-1 rounded">@cpf</code> CPF</p>
                  <p><code className="bg-white px-1 rounded">@address</code> Endereço</p>
                  <p><code className="bg-white px-1 rounded">@city_uf</code> Cidade/UF</p>
                  <p><code className="bg-white px-1 rounded">@cep</code> CEP</p>
                  <p><code className="bg-white px-1 rounded">@phone</code> Telefone</p>
                  <p><code className="bg-white px-1 rounded">@email</code> E-mail</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-700">Evento</p>
                  <p><code className="bg-white px-1 rounded">@birthday_person_name</code> Aniversariante</p>
                  <p><code className="bg-white px-1 rounded">@age_to_complete</code> Idade</p>
                  <p><code className="bg-white px-1 rounded">@event_date</code> Data</p>
                  <p><code className="bg-white px-1 rounded">@start_time</code> Hora Início</p>
                  <p><code className="bg-white px-1 rounded">@end_time</code> Hora Fim</p>
                  <p><code className="bg-white px-1 rounded">@room</code> Salão</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-700">Festa</p>
                  <p><code className="bg-white px-1 rounded">@party_theme</code> Tema</p>
                  <p><code className="bg-white px-1 rounded">@balloon_color</code> Cor Balões</p>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-slate-700">Valores</p>
                  <p><code className="bg-white px-1 rounded">@base_value</code> Valor Base</p>
                  <p><code className="bg-white px-1 rounded">@total_value</code> Valor Total</p>
                  <p><code className="bg-white px-1 rounded">@extras</code> Lista Extras</p>
                  <p><code className="bg-white px-1 rounded">@payment_method</code> Forma Pagto</p>
                </div>
              </div>
            </div>

            {/* Rich Text Editor */}
            <div className="mb-4">
              <Label className="mb-2 block">Modelo do Contrato</Label>
              <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
                <ReactQuill
                  theme="snow"
                  value={contractTemplate}
                  onChange={setContractTemplate}
                  style={{ height: '400px', marginBottom: '42px' }}
                  modules={{
                    toolbar: [
                      [{ 'header': [1, 2, 3, false] }],
                      ['bold', 'italic', 'underline', 'strike'],
                      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                      [{ 'align': [] }],
                      [{ 'color': [] }, { 'background': [] }],
                      ['clean']
                    ]
                  }}
                  data-testid="contract-editor"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleSaveContract}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                data-testid="save-contract-template"
              >
                Salvar Modelo de Contrato
              </Button>
              <Button
                onClick={loadDefaultTemplate}
                variant="outline"
                className="text-slate-600"
                data-testid="reset-contract-template"
              >
                Restaurar Padrão
              </Button>
            </div>

            <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
              <p className="text-xs text-indigo-800">
                <strong>Dica:</strong> As variáveis (ex: @client_name) serão substituídas pelos dados reais do evento ao gerar o contrato.
              </p>
            </div>
          </>
        )}

        {/* PDF Base Mode */}
        {contractMode === 'pdf_base' && (
          <ContractPdfEditor
            token={token}
            API={API}
            pdfBase={pdfBase}
            pdfFields={pdfFields}
            onSave={saveSetting}
          />
        )}
      </Card>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent data-testid="edit-user-dialog">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label>Nome de Usuário</Label>
              <Input
                value={editFormData.username}
                onChange={(e) => setEditFormData({ ...editFormData, username: e.target.value })}
                data-testid="edit-username"
              />
            </div>
            
            <div>
              <Label>Nova Senha (deixe em branco para não alterar)</Label>
              <Input
                type="password"
                value={editFormData.password}
                onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                placeholder="Digite nova senha ou deixe em branco"
                data-testid="edit-password"
              />
            </div>
            
            <div>
              <Label>Tipo de Usuário</Label>
              <Select
                value={editFormData.role}
                onValueChange={(value) => setEditFormData({ ...editFormData, role: value })}
              >
                <SelectTrigger data-testid="edit-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuário Comum</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleUpdateUser}
                className="flex-1 bg-blue-600 hover:bg-blue-700"
                data-testid="save-user-button"
              >
                Salvar Alterações
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
