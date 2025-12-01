// Демонстрационные данные для неавторизованных пользователей

export const demoTransactions = [
  {
    id: 'demo-1',
    user_id: 'demo-user',
    type: 'income' as const,
    category: 'Продажи',
    subcategory: '',
    amount: 250000,
    description: 'Оплата от клиента Иванов И.И.',
    date: new Date().toISOString().split('T')[0],
    company: 'Спасение',
    income_account: 'Зайнаб карта',
    client_name: 'Иванов Иван Иванович',
    contract_amount: 500000,
    first_payment: 100000,
    installment_period: 12,
    lump_sum: 33333,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'demo-2',
    user_id: 'demo-user',
    type: 'expense' as const,
    category: 'Зарплата наличкой',
    subcategory: '',
    amount: 80000,
    description: 'Зарплата сотрудникам',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    company: 'Спасение',
    expense_account: 'Касса офис',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'demo-3',
    user_id: 'demo-user',
    type: 'income' as const,
    category: 'Дебиторка',
    subcategory: '',
    amount: 50000,
    description: 'Платеж по рассрочке',
    date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
    company: 'Спасение',
    income_account: 'Карта Visa/Т-Банк (КИ)',
    client_name: 'Петров Петр Петрович',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'demo-4',
    user_id: 'demo-user',
    type: 'expense' as const,
    category: 'Реклама Авито',
    subcategory: '',
    amount: 25000,
    description: 'Размещение объявлений',
    date: new Date(Date.now() - 259200000).toISOString().split('T')[0],
    company: 'Спасение',
    expense_account: 'Расчетный счет',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'demo-5',
    user_id: 'demo-user',
    type: 'income' as const,
    category: 'Продажи',
    subcategory: '',
    amount: 150000,
    description: 'Новый договор Сидорова М.А.',
    date: new Date(Date.now() - 345600000).toISOString().split('T')[0],
    company: 'Спасение',
    income_account: 'Зайнаб карта',
    client_name: 'Сидорова Мария Александровна',
    contract_amount: 400000,
    first_payment: 150000,
    installment_period: 10,
    lump_sum: 25000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const demoBankrotClients = [
  {
    id: 'demo-client-1',
    user_id: 'demo-user',
    full_name: 'Иванов Иван Иванович',
    contract_amount: 500000,
    contract_date: '2024-10-15',
    first_payment: 100000,
    monthly_payment: 33333,
    installment_period: 12,
    payment_day: 15,
    deposit_target: 70000,
    deposit_paid: 35000,
    total_paid: 200000,
    remaining_amount: 300000,
    city: 'Москва',
    manager: 'Озеров Евгений Владимирович',
    source: 'Авито',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'demo-client-2',
    user_id: 'demo-user',
    full_name: 'Петров Петр Петрович',
    contract_amount: 600000,
    contract_date: '2024-09-20',
    first_payment: 120000,
    monthly_payment: 40000,
    installment_period: 12,
    payment_day: 20,
    deposit_target: 70000,
    deposit_paid: 70000,
    total_paid: 280000,
    remaining_amount: 320000,
    city: 'Санкт-Петербург',
    manager: 'Озеров Евгений Владимирович',
    source: 'Сайт',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'demo-client-3',
    user_id: 'demo-user',
    full_name: 'Сидорова Мария Александровна',
    contract_amount: 400000,
    contract_date: '2024-11-01',
    first_payment: 150000,
    monthly_payment: 25000,
    installment_period: 10,
    payment_day: 1,
    deposit_target: 70000,
    deposit_paid: 20000,
    total_paid: 150000,
    remaining_amount: 250000,
    city: 'Москва',
    manager: 'Смирнов Алексей Петрович',
    source: 'Рекомендация',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const demoEmployees = [
  {
    id: 'demo-emp-1',
    user_id: 'demo-user',
    first_name: 'Евгений',
    last_name: 'Озеров',
    middle_name: 'Владимирович',
    position: 'Менеджер по продажам',
    department: 'Отдел продаж',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'demo-emp-2',
    user_id: 'demo-user',
    first_name: 'Алексей',
    last_name: 'Смирнов',
    middle_name: 'Петрович',
    position: 'Менеджер по продажам',
    department: 'Отдел продаж',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'demo-emp-3',
    user_id: 'demo-user',
    first_name: 'Мария',
    last_name: 'Кузнецова',
    middle_name: 'Ивановна',
    position: 'Бухгалтер',
    department: 'Бухгалтерия',
    is_active: true,
    created_at: new Date().toISOString()
  },
  {
    id: 'demo-emp-4',
    user_id: 'demo-user',
    first_name: 'Дмитрий',
    last_name: 'Попов',
    middle_name: 'Сергеевич',
    position: 'Генеральный директор',
    department: 'Руководство',
    is_active: true,
    created_at: new Date().toISOString()
  }
];

export const demoDepartments = [
  {
    id: 'demo-dept-1',
    user_id: 'demo-user',
    name: 'Спасение - Ноябрь 2024',
    project_name: 'Спасение',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'demo-dept-2',
    user_id: 'demo-user',
    name: 'Дело Бизнеса - Ноябрь 2024',
    project_name: 'Дело Бизнеса',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const demoDepartmentEmployees = [
  {
    id: 'demo-dept-emp-1',
    user_id: 'demo-user',
    department_id: 'demo-dept-1',
    employee_id: 'demo-emp-1',
    company: 'Спасение',
    month: '2024-11-01',
    white_salary: 50000,
    gray_salary: 30000,
    advance: 20000,
    ndfl: 6500,
    contributions: 15000,
    bonus: 15000,
    next_month_bonus: 0,
    cost: 21500,
    net_salary: 43500,
    total_amount: 95000,
    paid_white: 25000,
    paid_gray: 15000,
    paid_advance: 10000,
    paid_bonus: 7500,
    paid_net_salary: 20000,
    profiles: {
      first_name: 'Евгений',
      last_name: 'Озеров',
      middle_name: 'Владимирович',
      position: 'Менеджер по продажам'
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'demo-dept-emp-2',
    user_id: 'demo-user',
    department_id: 'demo-dept-1',
    employee_id: 'demo-emp-2',
    company: 'Спасение',
    month: '2024-11-01',
    white_salary: 45000,
    gray_salary: 25000,
    advance: 15000,
    ndfl: 5850,
    contributions: 13500,
    bonus: 12000,
    next_month_bonus: 5000,
    cost: 19350,
    net_salary: 39150,
    total_amount: 82000,
    paid_white: 22500,
    paid_gray: 12500,
    paid_advance: 7500,
    paid_bonus: 6000,
    paid_net_salary: 19575,
    profiles: {
      first_name: 'Алексей',
      last_name: 'Смирнов',
      middle_name: 'Петрович',
      position: 'Менеджер по продажам'
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'demo-dept-emp-3',
    user_id: 'demo-user',
    department_id: 'demo-dept-1',
    employee_id: 'demo-emp-3',
    company: 'Спасение',
    month: '2024-11-01',
    white_salary: 60000,
    gray_salary: 0,
    advance: 25000,
    ndfl: 7800,
    contributions: 18000,
    bonus: 0,
    next_month_bonus: 0,
    cost: 25800,
    net_salary: 52200,
    total_amount: 60000,
    paid_white: 30000,
    paid_gray: 0,
    paid_advance: 12500,
    paid_bonus: 0,
    paid_net_salary: 26100,
    profiles: {
      first_name: 'Мария',
      last_name: 'Кузнецова',
      middle_name: 'Ивановна',
      position: 'Бухгалтер'
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'demo-dept-emp-4',
    user_id: 'demo-user',
    department_id: 'demo-dept-2',
    employee_id: 'demo-emp-4',
    company: 'Дело Бизнеса',
    month: '2024-11-01',
    white_salary: 80000,
    gray_salary: 40000,
    advance: 30000,
    ndfl: 10400,
    contributions: 24000,
    bonus: 20000,
    next_month_bonus: 10000,
    cost: 34400,
    net_salary: 69600,
    total_amount: 140000,
    paid_white: 40000,
    paid_gray: 20000,
    paid_advance: 15000,
    paid_bonus: 10000,
    paid_net_salary: 34800,
    profiles: {
      first_name: 'Дмитрий',
      last_name: 'Попов',
      middle_name: 'Сергеевич',
      position: 'Генеральный директор'
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const demoLeadGeneration = [
  {
    id: 'demo-lead-1',
    user_id: 'demo-user',
    company: 'Спасение',
    date: new Date().toISOString().split('T')[0],
    total_leads: 150,
    qualified_leads: 45,
    debt_above_300k: 30,
    contracts: 5,
    payments: 3,
    total_cost: 45000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'demo-lead-2',
    user_id: 'demo-user',
    company: 'Спасение',
    date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    total_leads: 120,
    qualified_leads: 38,
    debt_above_300k: 25,
    contracts: 4,
    payments: 2,
    total_cost: 38000,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const demoSales = [
  {
    id: 'demo-sale-1',
    user_id: 'demo-user',
    employee_id: 'demo-emp-1',
    client_name: 'Иванов Иван Иванович',
    contract_amount: 500000,
    payment_amount: 250000,
    city: 'Москва',
    lead_source: 'Авито',
    manager_bonus: 22500,
    payment_date: new Date().toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'demo-sale-2',
    user_id: 'demo-user',
    employee_id: 'demo-emp-2',
    client_name: 'Сидорова Мария Александровна',
    contract_amount: 400000,
    payment_amount: 150000,
    city: 'Москва',
    lead_source: 'Рекомендация',
    manager_bonus: 18000,
    payment_date: new Date(Date.now() - 345600000).toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];
