import { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride';
import { useLocation } from 'react-router-dom';

interface AppTourProps {
  run: boolean;
  onFinish: () => void;
}

export function AppTour({ run, onFinish }: AppTourProps) {
  const location = useLocation();
  const [steps, setSteps] = useState<Step[]>([]);

  useEffect(() => {
    // Определяем шаги тура в зависимости от текущей страницы
    const currentSteps = getTourStepsForRoute(location.pathname);
    setSteps(currentSteps);
  }, [location.pathname]);

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      onFinish();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: 'hsl(var(--primary))',
          textColor: 'hsl(var(--foreground))',
          backgroundColor: 'hsl(var(--background))',
          overlayColor: 'rgba(0, 0, 0, 0.5)',
          arrowColor: 'hsl(var(--background))',
          zIndex: 10000,
        },
        tooltip: {
          borderRadius: 8,
          padding: 20,
        },
        buttonNext: {
          backgroundColor: 'hsl(var(--primary))',
          color: 'hsl(var(--primary-foreground))',
          borderRadius: 6,
          padding: '8px 16px',
        },
        buttonBack: {
          color: 'hsl(var(--muted-foreground))',
          marginRight: 10,
        },
        buttonSkip: {
          color: 'hsl(var(--muted-foreground))',
        },
      }}
      locale={{
        back: 'Назад',
        close: 'Закрыть',
        last: 'Завершить',
        next: 'Далее',
        skip: 'Пропустить',
      }}
    />
  );
}

function getTourStepsForRoute(pathname: string): Step[] {
  switch (pathname) {
    case '/':
      return [
        {
          target: 'body',
          content: (
            <div>
              <h3 className="text-lg font-bold mb-2">Добро пожаловать в P&L Tracker! 👋</h3>
              <p>Это система для отслеживания финансовых операций и бизнес-метрик. Давайте познакомимся с основными функциями.</p>
            </div>
          ),
          placement: 'center',
          disableBeacon: true,
        },
        {
          target: '[data-tour="company-selector"]',
          content: 'Здесь вы можете выбрать компанию для просмотра данных. Данные фильтруются по выбранной компании.',
          placement: 'bottom',
        },
        {
          target: '[data-tour="add-transaction"]',
          content: 'Кнопка для добавления новой финансовой операции (доход или расход).',
          placement: 'bottom',
        },
        {
          target: '[data-tour="kpi-cards"]',
          content: 'KPI-карточки показывают основные финансовые показатели: доходы, расходы, прибыль и баланс на счетах.',
          placement: 'bottom',
        },
        {
          target: '[data-tour="account-cards"]',
          content: 'Карточки счетов показывают баланс по каждому счету. Нажмите на карточку для просмотра операций.',
          placement: 'top',
        },
        {
          target: '[data-tour="transactions-table"]',
          content: 'Таблица всех финансовых операций с возможностью фильтрации, редактирования и удаления.',
          placement: 'top',
        },
        {
          target: '[data-tour="navigation"]',
          content: 'Используйте навигационное меню для перехода к другим разделам: клиенты, лидогенерация, сотрудники, ФОТ и настройки.',
          placement: 'bottom',
        },
      ];

    case '/clients-spasenie':
      return [
        {
          target: 'body',
          content: (
            <div>
              <h3 className="text-lg font-bold mb-2">Раздел "Клиенты Спасение" 👥</h3>
              <p>Здесь вы можете просматривать всех клиентов с договорами рассрочки и отслеживать платежи.</p>
            </div>
          ),
          placement: 'center',
          disableBeacon: true,
        },
        {
          target: '[data-tour="search"]',
          content: 'Поиск клиентов по имени или организации.',
          placement: 'bottom',
        },
        {
          target: '[data-tour="summary-cards"]',
          content: 'Сводная статистика по всем клиентам: количество, суммы договоров, оплачено и остаток.',
          placement: 'bottom',
        },
        {
          target: '[data-tour="clients-table"]',
          content: 'Таблица клиентов с информацией о договорах, платежах и остатках. Нажмите на строку для детального просмотра.',
          placement: 'top',
        },
      ];

    case '/lead-generation':
      return [
        {
          target: 'body',
          content: (
            <div>
              <h3 className="text-lg font-bold mb-2">Раздел "Лидогенерация" 📊</h3>
              <p>Отслеживайте эффективность привлечения клиентов и конверсию лидов в продажи.</p>
            </div>
          ),
          placement: 'center',
          disableBeacon: true,
        },
        {
          target: '[data-tour="filters"]',
          content: 'Фильтры для выбора компании и периода просмотра данных.',
          placement: 'bottom',
        },
        {
          target: '[data-tour="dashboard"]',
          content: 'Дашборд с ключевыми метриками: количество лидов, квалифицированных лидов, конверсия в договоры и оплаты.',
          placement: 'bottom',
        },
        {
          target: '[data-tour="leads-table"]',
          content: 'Таблица ежедневных данных по лидогенерации с возможностью редактирования.',
          placement: 'top',
        },
      ];

    case '/payroll':
      return [
        {
          target: 'body',
          content: (
            <div>
              <h3 className="text-lg font-bold mb-2">Раздел "ФОТ" 💰</h3>
              <p>Управление фондом оплаты труда: зарплаты, премии, налоги и взносы.</p>
            </div>
          ),
          placement: 'center',
          disableBeacon: true,
        },
        {
          target: '[data-tour="tabs"]',
          content: 'Вкладки для просмотра: ФОТ по отделам, аналитика и продажи менеджеров.',
          placement: 'bottom',
        },
        {
          target: '[data-tour="add-department"]',
          content: 'Создайте отдел/проект для учета зарплат сотрудников.',
          placement: 'bottom',
        },
        {
          target: '[data-tour="summary"]',
          content: 'Сводная информация по всем отделам: белая и серая зарплата, НДФЛ, взносы.',
          placement: 'bottom',
        },
      ];

    case '/employees':
      return [
        {
          target: 'body',
          content: (
            <div>
              <h3 className="text-lg font-bold mb-2">Управление сотрудниками 👨‍💼</h3>
              <p>Добавляйте и редактируйте профили сотрудников, назначайте роли.</p>
            </div>
          ),
          placement: 'center',
          disableBeacon: true,
        },
        {
          target: '[data-tour="add-employee"]',
          content: 'Кнопка для добавления нового сотрудника с указанием ФИО, должности и роли.',
          placement: 'bottom',
        },
        {
          target: '[data-tour="employees-table"]',
          content: 'Список всех сотрудников с возможностью редактирования данных, изменения ролей и удаления.',
          placement: 'top',
        },
      ];

    case '/settings':
      return [
        {
          target: 'body',
          content: (
            <div>
              <h3 className="text-lg font-bold mb-2">Настройки ⚙️</h3>
              <p>Управление счетами и настройками системы.</p>
            </div>
          ),
          placement: 'center',
          disableBeacon: true,
        },
        {
          target: '[data-tour="add-account"]',
          content: 'Добавьте новые счета для учета финансовых операций.',
          placement: 'bottom',
        },
        {
          target: '[data-tour="accounts-list"]',
          content: 'Список всех счетов с возможностью редактирования порядка отображения и архивации.',
          placement: 'top',
        },
      ];

    default:
      return [];
  }
}
