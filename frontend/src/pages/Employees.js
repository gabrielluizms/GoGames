import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/App';
import { API } from '@/App';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, Users as UsersIcon } from 'lucide-react';
import { toast } from 'sonner';

const Employees = () => {
  const { token, user } = useContext(AuthContext);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    role: '',
    type: 'fixed'
  });

  const roles = ['monitor', 'copeira', 'auxiliar', 'gerente', 'freelancer'];
  const roleLabels = {
    monitor: 'Monitor',
    copeira: 'Copeira',
    auxiliar: 'Auxiliar de Serviços Gerais',
    gerente: 'Gerente',
    freelancer: 'Freelancer'
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(`${API}/employees`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployees(response.data);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast.error('Erro ao carregar funcionários');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingEmployee) {
        await axios.put(`${API}/employees/${editingEmployee.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Funcionário atualizado com sucesso!');
      } else {
        await axios.post(`${API}/employees`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Funcionário criado com sucesso!');
      }
      
      fetchEmployees();
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving employee:', error);
      toast.error('Erro ao salvar funcionário');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este funcionário?')) return;
    
    try {
      await axios.delete(`${API}/employees/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Funcionário excluído com sucesso!');
      fetchEmployees();
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error(error.response?.data?.detail || 'Erro ao excluir funcionário');
    }
  };

  const handleOpenDialog = (employee = null) => {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        name: employee.name,
        role: employee.role,
        type: employee.type
      });
    } else {
      setEditingEmployee(null);
      setFormData({
        name: '',
        role: '',
        type: 'fixed'
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingEmployee(null);
  };

  const groupedEmployees = {
    fixed: employees.filter(e => e.type === 'fixed'),
    freelancer: employees.filter(e => e.type === 'freelancer')
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
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Funcionários</h1>
          <p className="text-slate-600">Gerencie a equipe do salão</p>
        </div>
        {user?.role === 'admin' && (
          <Button
            onClick={() => handleOpenDialog()}
            className="bg-teal-600 hover:bg-teal-700 text-white gap-2"
            data-testid="create-employee-button"
          >
            <Plus className="w-4 h-4" />
            Novo Funcionário
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 border-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Total</p>
              <p className="text-3xl font-bold text-slate-800">{employees.length}</p>
            </div>
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
              <UsersIcon className="w-6 h-6 text-teal-600" />
            </div>
          </div>
        </Card>
        
        <Card className="p-6 border-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Fixos</p>
              <p className="text-3xl font-bold text-slate-800">{groupedEmployees.fixed.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <UsersIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </Card>
        
        <Card className="p-6 border-0 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-600 mb-1">Freelancers</p>
              <p className="text-3xl font-bold text-slate-800">{groupedEmployees.freelancer.length}</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <UsersIcon className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Employee Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Fixed Employees */}
        <Card className="p-6 border-0 shadow-sm" data-testid="fixed-employees-section">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Funcionários Fixos</h2>
          
          {groupedEmployees.fixed.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Nenhum funcionário fixo cadastrado</p>
          ) : (
            <div className="space-y-3">
              {groupedEmployees.fixed.map((employee) => (
                <div
                  key={employee.id}
                  className="p-4 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between hover:shadow-md transition-shadow"
                  data-testid={`employee-${employee.id}`}
                >
                  <div>
                    <p className="font-medium text-slate-800">{employee.name}</p>
                    <p className="text-sm text-slate-600">{roleLabels[employee.role] || employee.role}</p>
                  </div>
                  
                  {user?.role === 'admin' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDialog(employee)}
                        data-testid={`edit-employee-${employee.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(employee.id)}
                        className="text-red-600 hover:bg-red-50"
                        data-testid={`delete-employee-${employee.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Freelancer Employees */}
        <Card className="p-6 border-0 shadow-sm" data-testid="freelancer-employees-section">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Freelancers</h2>
          
          {groupedEmployees.freelancer.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">Nenhum freelancer cadastrado</p>
          ) : (
            <div className="space-y-3">
              {groupedEmployees.freelancer.map((employee) => (
                <div
                  key={employee.id}
                  className="p-4 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between hover:shadow-md transition-shadow"
                  data-testid={`employee-${employee.id}`}
                >
                  <div>
                    <p className="font-medium text-slate-800">{employee.name}</p>
                    <p className="text-sm text-slate-600">{roleLabels[employee.role] || employee.role}</p>
                  </div>
                  
                  {user?.role === 'admin' && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenDialog(employee)}
                        data-testid={`edit-employee-${employee.id}`}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(employee.id)}
                        className="text-red-600 hover:bg-red-50"
                        data-testid={`delete-employee-${employee.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Create/Edit Employee Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent data-testid="employee-dialog">
          <DialogHeader>
            <DialogTitle>{editingEmployee ? 'Editar Funcionário' : 'Novo Funcionário'}</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                data-testid="employee-name"
              />
            </div>

            <div>
              <Label>Função</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger data-testid="employee-role">
                  <SelectValue placeholder="Selecione uma função" />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {roleLabels[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <SelectTrigger data-testid="employee-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixo</SelectItem>
                  <SelectItem value="freelancer">Freelancer</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-700" data-testid="save-employee-button">
                {editingEmployee ? 'Atualizar' : 'Criar'}
              </Button>
              <Button type="button" variant="outline" onClick={handleCloseDialog} className="flex-1">
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Employees;