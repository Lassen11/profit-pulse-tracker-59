import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePersistedDialog } from "@/hooks/useDialogPersistence";
import { UserPlus, Users, Shield, User, Trash2, Pencil, Archive, UserCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useNavigate } from "react-router-dom";

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  middle_name: string;
  position: string;
  department: string;
  is_active: boolean;
  termination_date: string | null;
  created_at: string;
}

interface UserRole {
  role: 'admin' | 'user';
}

export default function Employees() {
  const [employees, setEmployees] = useState<(Profile & { role?: 'admin' | 'user' })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Form state for adding new employee
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [submitting, setSubmitting] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  
  // Edit employee state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Profile | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editMiddleName, setEditMiddleName] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editTerminationDate, setEditTerminationDate] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'archived'>('all');
  const [terminationDateFrom, setTerminationDateFrom] = useState("");
  const [terminationDateTo, setTerminationDateTo] = useState("");
  
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  // Dialog persistence hooks
  const addDialogPersistence = usePersistedDialog({
    key: 'employees-dialog-add',
    onRestore: () => {
      setIsAddDialogOpen(true);
    }
  });

  const editDialogPersistence = usePersistedDialog<{ employee: Profile }>({
    key: 'employees-dialog-edit',
    onRestore: (data) => {
      setEditingEmployee(data.employee);
      setEditFirstName(data.employee.first_name || "");
      setEditLastName(data.employee.last_name || "");
      setEditMiddleName(data.employee.middle_name || "");
      setEditPosition(data.employee.position || "");
      setEditDepartment(data.employee.department || "");
      setIsEditDialogOpen(true);
    }
  });

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    checkAdminStatus();
    fetchEmployees();
  }, [user, navigate]);

  // Restore dialog states from localStorage
  useEffect(() => {
    if (!user) return;

    addDialogPersistence.restoreDialog();
    editDialogPersistence.restoreDialog();
  }, [user]);

  // Realtime subscriptions for Employees
  useEffect(() => {
    if (!user) return;

    const profilesChannel = supabase
      .channel('employees-profiles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles'
        },
        () => {
          fetchEmployees();
        }
      )
      .subscribe();

    const userRolesChannel = supabase
      .channel('employees-roles-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_roles'
        },
        () => {
          fetchEmployees();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profilesChannel);
      supabase.removeChannel(userRolesChannel);
    };
  }, [user]);

  const checkAdminStatus = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .single();
        
      if (!error && data) {
        setIsAdmin(true);
      } else {
        // Не админ, перенаправляем на главную
        navigate('/');
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      navigate('/');
    }
  };

  const fetchEmployees = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Получаем профили
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profilesError) throw profilesError;

      // Получаем роли пользователей
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role');

      if (rolesError) throw rolesError;

      // Объединяем данные
      const employeesWithRoles = profiles?.map(profile => {
        const userRole = roles?.find(r => r.user_id === profile.user_id);
        return {
          ...profile,
          role: userRole?.role || 'user'
        };
      }) || [];

      setEmployees(employeesWithRoles);
    } catch (error) {
      console.error('Error fetching employees:', error);
      toast({
        title: "Ошибка",
        description: "Не удалось загрузить список сотрудников",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      // Call edge function to create user
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`https://rdpxbbddqxwbufzqozqz.supabase.co/functions/v1/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.session.access_token}`,
        },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          middleName,
          position,
          department,
          role
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create user');
      }

      toast({
        title: "Успешно",
        description: `Сотрудник ${lastName} ${firstName} ${middleName} добавлен`,
      });

      // Сбрасываем форму
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setMiddleName("");
      setPosition("");
      setDepartment("");
      setRole('user');
      setIsAddDialogOpen(false);
      addDialogPersistence.closeDialog();

      // Обновляем список
      fetchEmployees();
    } catch (error: any) {
      console.error('Error adding employee:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось добавить сотрудника",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmployee = async (userId: string, fullName: string) => {
    if (!confirm(`Вы уверены, что хотите удалить сотрудника ${fullName}?`)) {
      return;
    }

    setDeletingUserId(userId);

    try {
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`https://rdpxbbddqxwbufzqozqz.supabase.co/functions/v1/delete-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.session.access_token}`,
        },
        body: JSON.stringify({
          userId
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete user');
      }

      toast({
        title: "Успешно",
        description: `Сотрудник ${fullName} удален`,
      });

      // Обновляем список
      fetchEmployees();
    } catch (error: any) {
      console.error('Error deleting employee:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось удалить сотрудника",
        variant: "destructive"
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user', fullName: string) => {
    setUpdatingRoleUserId(userId);

    try {
      const { data: authData } = await supabase.auth.getSession();
      if (!authData.session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`https://rdpxbbddqxwbufzqozqz.supabase.co/functions/v1/update-user-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authData.session.access_token}`,
        },
        body: JSON.stringify({
          userId,
          role: newRole
        }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to update role');
      }

      toast({
        title: "Успешно",
        description: `Роль сотрудника ${fullName} изменена на ${newRole === 'admin' ? 'Администратор' : 'Пользователь'}`,
      });

      // Обновляем список
      fetchEmployees();
    } catch (error: any) {
      console.error('Error updating role:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось изменить роль",
        variant: "destructive"
      });
      // Обновляем список для отката изменений в UI
      fetchEmployees();
    } finally {
      setUpdatingRoleUserId(null);
    }
  };

  const handleEditEmployee = (employee: Profile) => {
    setEditingEmployee(employee);
    setEditFirstName(employee.first_name);
    setEditLastName(employee.last_name);
    setEditMiddleName(employee.middle_name || "");
    setEditPosition(employee.position || "");
    setEditDepartment(employee.department || "");
    setEditTerminationDate(employee.termination_date || "");
    setIsEditDialogOpen(true);
    editDialogPersistence.openDialog({ employee });
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEmployee) return;

    setUpdatingProfile(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          first_name: editFirstName,
          last_name: editLastName,
          middle_name: editMiddleName || null,
          position: editPosition || null,
          department: editDepartment || null,
          termination_date: editTerminationDate || null,
        })
        .eq('id', editingEmployee.id);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: `Данные сотрудника ${editLastName} ${editFirstName} ${editMiddleName} обновлены`,
      });

      setIsEditDialogOpen(false);
      editDialogPersistence.closeDialog();
      fetchEmployees();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось обновить данные сотрудника",
        variant: "destructive"
      });
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleToggleActiveStatus = async (profileId: string, currentStatus: boolean, fullName: string) => {
    setUpdatingStatusId(profileId);

    try {
      const updateData: any = {
        is_active: !currentStatus
      };
      
      // If archiving (setting to inactive), set termination date to today
      // If reactivating, clear termination date
      if (currentStatus) {
        updateData.termination_date = new Date().toISOString().split('T')[0];
      } else {
        updateData.termination_date = null;
      }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', profileId);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: `Статус сотрудника ${fullName} изменен на ${!currentStatus ? 'Активный' : 'Архивный'}`,
      });

      fetchEmployees();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast({
        title: "Ошибка",
        description: error.message || "Не удалось изменить статус сотрудника",
        variant: "destructive"
      });
      fetchEmployees();
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const filteredEmployees = employees.filter(employee => {
    // Status filter
    if (statusFilter === 'active' && !employee.is_active) return false;
    if (statusFilter === 'archived' && employee.is_active) return false;
    
    // Termination date filter
    if (terminationDateFrom && employee.termination_date) {
      if (employee.termination_date < terminationDateFrom) return false;
    }
    if (terminationDateTo && employee.termination_date) {
      if (employee.termination_date > terminationDateTo) return false;
    }
    
    return true;
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card>
          <CardHeader>
            <CardTitle>Доступ запрещен</CardTitle>
            <CardDescription>У вас нет прав для просмотра этой страницы</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Управление сотрудниками</h1>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
            setIsAddDialogOpen(open);
            if (open) {
              addDialogPersistence.openDialog({});
            } else {
              addDialogPersistence.closeDialog();
            }
          }}>
            <DialogTrigger asChild>
              <Button className="flex items-center gap-2">
                <UserPlus className="h-4 w-4" />
                Добавить сотрудника
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Добавить нового сотрудника</DialogTitle>
                <DialogDescription>
                  Заполните данные для регистрации нового сотрудника
                </DialogDescription>
              </DialogHeader>
              
              <form onSubmit={handleAddEmployee} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="last-name">Фамилия</Label>
                    <Input
                      id="last-name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      placeholder="Иванов"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="first-name">Имя</Label>
                    <Input
                      id="first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      placeholder="Иван"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="middle-name">Отчество</Label>
                  <Input
                    id="middle-name"
                    value={middleName}
                    onChange={(e) => setMiddleName(e.target.value)}
                    placeholder="Иванович"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="ivan.ivanov@company.com"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="password">Пароль</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    minLength={6}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="position">Должность</Label>
                    <Input
                      id="position"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      placeholder="Менеджер"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="department">Отдел</Label>
                    <Input
                      id="department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="Продажи"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="role">Роль</Label>
                  <Select value={role} onValueChange={(value: 'admin' | 'user') => setRole(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите роль" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Пользователь</SelectItem>
                      <SelectItem value="admin">Администратор</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                    className="flex-1"
                  >
                    Отмена
                  </Button>
                  <Button type="submit" disabled={submitting} className="flex-1">
                    {submitting ? "Добавление..." : "Добавить"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Список сотрудников</CardTitle>
            <CardDescription>
              Всего сотрудников: {employees.length} | Активных: {employees.filter(e => e.is_active).length} | Архивных: {employees.filter(e => !e.is_active).length}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 mb-6 pb-4 border-b">
              <div className="space-y-2">
                <Label htmlFor="status-filter" className="text-sm font-medium">
                  Статус
                </Label>
                <Select value={statusFilter} onValueChange={(value: any) => setStatusFilter(value)}>
                  <SelectTrigger id="status-filter" className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Все сотрудники</SelectItem>
                    <SelectItem value="active">Только активные</SelectItem>
                    <SelectItem value="archived">Только архивные</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="date-from" className="text-sm font-medium">
                  Увольнение с
                </Label>
                <Input
                  id="date-from"
                  type="date"
                  value={terminationDateFrom}
                  onChange={(e) => setTerminationDateFrom(e.target.value)}
                  className="w-[160px]"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="date-to" className="text-sm font-medium">
                  Увольнение по
                </Label>
                <Input
                  id="date-to"
                  type="date"
                  value={terminationDateTo}
                  onChange={(e) => setTerminationDateTo(e.target.value)}
                  className="w-[160px]"
                />
              </div>

              {(statusFilter !== 'all' || terminationDateFrom || terminationDateTo) && (
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStatusFilter('all');
                      setTerminationDateFrom('');
                      setTerminationDateTo('');
                    }}
                  >
                    Сбросить фильтры
                  </Button>
                </div>
              )}
              
              <div className="flex-1" />
              
              <div className="flex items-end">
                <div className="text-sm text-muted-foreground">
                  Показано: {filteredEmployees.length} из {employees.length}
                </div>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-8">Загрузка...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Имя</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Должность</TableHead>
                    <TableHead>Отдел</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>Дата увольнения</TableHead>
                    <TableHead>Дата регистрации</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">
                        {employee.last_name} {employee.first_name} {employee.middle_name || ''}
                      </TableCell>
                      <TableCell>-</TableCell>
                      <TableCell>{employee.position || "-"}</TableCell>
                      <TableCell>{employee.department || "-"}</TableCell>
                      <TableCell>
                        {employee.user_id === user?.id ? (
                          <Badge variant={employee.role === 'admin' ? 'default' : 'secondary'}>
                            {employee.role === 'admin' ? (
                              <>
                                <Shield className="h-3 w-3 mr-1" />
                                Администратор
                              </>
                            ) : (
                              <>
                                <User className="h-3 w-3 mr-1" />
                                Пользователь
                              </>
                            )}
                          </Badge>
                        ) : (
                          <Select 
                            value={employee.role} 
                            onValueChange={(value: 'admin' | 'user') => 
                              handleRoleChange(employee.user_id, value, `${employee.last_name} ${employee.first_name} ${employee.middle_name || ''}`)
                            }
                            disabled={updatingRoleUserId === employee.user_id}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">
                                <div className="flex items-center">
                                  <User className="h-3 w-3 mr-2" />
                                  Пользователь
                                </div>
                              </SelectItem>
                              <SelectItem value="admin">
                                <div className="flex items-center">
                                  <Shield className="h-3 w-3 mr-2" />
                                  Администратор
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Badge variant={employee.is_active ? 'default' : 'secondary'} className="flex items-center gap-1">
                            {employee.is_active ? (
                              <>
                                <UserCheck className="h-3 w-3" />
                                Активный
                              </>
                            ) : (
                              <>
                                <Archive className="h-3 w-3" />
                                Архивный
                              </>
                            )}
                          </Badge>
                          <Switch
                            checked={employee.is_active}
                            onCheckedChange={() => handleToggleActiveStatus(
                              employee.id, 
                              employee.is_active, 
                              `${employee.last_name} ${employee.first_name} ${employee.middle_name || ''}`
                            )}
                            disabled={updatingStatusId === employee.id}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        {employee.termination_date ? (
                          <div className="text-sm">
                            <div className="font-medium">
                              {new Date(employee.termination_date).toLocaleDateString('ru-RU')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {(() => {
                                const termDate = new Date(employee.termination_date);
                                const today = new Date();
                                const diffTime = today.getTime() - termDate.getTime();
                                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                                
                                if (diffDays === 0) return 'Сегодня';
                                if (diffDays === 1) return '1 день назад';
                                if (diffDays < 30) return `${diffDays} дн. назад`;
                                
                                const diffMonths = Math.floor(diffDays / 30);
                                if (diffMonths === 1) return '1 месяц назад';
                                if (diffMonths < 12) return `${diffMonths} мес. назад`;
                                
                                const diffYears = Math.floor(diffMonths / 12);
                                if (diffYears === 1) return '1 год назад';
                                return `${diffYears} лет назад`;
                              })()}
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(employee.created_at).toLocaleDateString('ru-RU')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditEmployee(employee)}
                          >
                            <Pencil className="h-4 w-4 mr-1" />
                            Редактировать
                          </Button>
                          {employee.user_id !== user?.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteEmployee(employee.user_id, `${employee.last_name} ${employee.first_name} ${employee.middle_name || ''}`)}
                              disabled={deletingUserId === employee.user_id}
                              className="text-destructive hover:text-destructive"
                            >
                              {deletingUserId === employee.user_id ? (
                                "Удаление..."
                              ) : (
                                <>
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Удалить
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Edit Employee Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Редактировать сотрудника</DialogTitle>
              <DialogDescription>
                Изменение информации о сотруднике
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-last-name">Фамилия</Label>
                  <Input
                    id="edit-last-name"
                    value={editLastName}
                    onChange={(e) => setEditLastName(e.target.value)}
                    required
                    placeholder="Иванов"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-first-name">Имя</Label>
                  <Input
                    id="edit-first-name"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    required
                    placeholder="Иван"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-middle-name">Отчество</Label>
                <Input
                  id="edit-middle-name"
                  value={editMiddleName}
                  onChange={(e) => setEditMiddleName(e.target.value)}
                  placeholder="Иванович"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-position">Должность</Label>
                  <Input
                    id="edit-position"
                    value={editPosition}
                    onChange={(e) => setEditPosition(e.target.value)}
                    placeholder="Менеджер"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-department">Отдел</Label>
                  <Input
                    id="edit-department"
                    value={editDepartment}
                    onChange={(e) => setEditDepartment(e.target.value)}
                    placeholder="Продажи"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="edit-termination-date">Дата увольнения</Label>
                <Input
                  id="edit-termination-date"
                  type="date"
                  value={editTerminationDate}
                  onChange={(e) => setEditTerminationDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Оставьте пустым для активных сотрудников
                </p>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                  className="flex-1"
                >
                  Отмена
                </Button>
                <Button type="submit" disabled={updatingProfile} className="flex-1">
                  {updatingProfile ? "Сохранение..." : "Сохранить"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}