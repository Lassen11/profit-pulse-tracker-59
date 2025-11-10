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
import { UserPlus, Users, Shield, User, Trash2, Pencil } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Profile {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  position: string;
  department: string;
  is_active: boolean;
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
  const [position, setPosition] = useState("");
  const [department, setDepartment] = useState("");
  const [role, setRole] = useState<'admin' | 'user'>('user');
  const [submitting, setSubmitting] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [updatingRoleUserId, setUpdatingRoleUserId] = useState<string | null>(null);
  
  // Edit employee state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Profile | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editPosition, setEditPosition] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [updatingProfile, setUpdatingProfile] = useState(false);
  
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    checkAdminStatus();
    fetchEmployees();
  }, [user, navigate]);

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
        description: `Сотрудник ${firstName} ${lastName} добавлен`,
      });

      // Сбрасываем форму
      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setPosition("");
      setDepartment("");
      setRole('user');
      setIsAddDialogOpen(false);

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

  const handleDeleteEmployee = async (userId: string, firstName: string, lastName: string) => {
    if (!confirm(`Вы уверены, что хотите удалить сотрудника ${firstName} ${lastName}?`)) {
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
        description: `Сотрудник ${firstName} ${lastName} удален`,
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

  const handleRoleChange = async (userId: string, newRole: 'admin' | 'user', firstName: string, lastName: string) => {
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
        description: `Роль сотрудника ${firstName} ${lastName} изменена на ${newRole === 'admin' ? 'Администратор' : 'Пользователь'}`,
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
    setEditPosition(employee.position || "");
    setEditDepartment(employee.department || "");
    setIsEditDialogOpen(true);
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
          position: editPosition || null,
          department: editDepartment || null,
        })
        .eq('id', editingEmployee.id);

      if (error) throw error;

      toast({
        title: "Успешно",
        description: `Данные сотрудника ${editFirstName} ${editLastName} обновлены`,
      });

      setIsEditDialogOpen(false);
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
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
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
                    <Label htmlFor="first-name">Имя</Label>
                    <Input
                      id="first-name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      placeholder="Иван"
                    />
                  </div>
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
              Всего сотрудников: {employees.length}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                    <TableHead>Дата регистрации</TableHead>
                    <TableHead>Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">
                        {employee.first_name} {employee.last_name}
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
                              handleRoleChange(employee.user_id, value, employee.first_name, employee.last_name)
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
                        <Badge variant={employee.is_active ? 'default' : 'secondary'}>
                          {employee.is_active ? 'Активный' : 'Неактивный'}
                        </Badge>
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
                              onClick={() => handleDeleteEmployee(employee.user_id, employee.first_name, employee.last_name)}
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
                  <Label htmlFor="edit-first-name">Имя</Label>
                  <Input
                    id="edit-first-name"
                    value={editFirstName}
                    onChange={(e) => setEditFirstName(e.target.value)}
                    required
                    placeholder="Иван"
                  />
                </div>
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