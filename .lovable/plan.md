

## План: Страница «Финансовая модель»

Новая страница `/financial-model` для проектов **Спасение** и **Дело Бизнеса** — сводная финансовая модель проекта с план/факт за месяц, прогнозом до конца периода, юнит-экономикой и сценарным моделированием.

### Что появится в интерфейсе

**Доступ:**
- Кнопка «Финансовая модель» в шапке дашборда (рядом с «Все проекты», «Лидогенерация», «ФОТ»).
- Скрыта от роли `manager_oz`.
- Маршрут защищён `ProtectedRoute`.

**Структура страницы:**

1. **Шапка** — селектор компании (Спасение / Дело Бизнеса) и селектор месяца.

2. **Блок «P&L месяца» (план / факт / отклонение)** — сводная таблица:
   - Выручка (из `transactions` income, без переводов)
   - Себестоимость (ФОТ — `department_employees.cost` по компании за месяц)
   - Маркетинг / лидогенерация (из `lead_generation.total_cost` по компании)
   - Операционные расходы (прочие `transactions` expense, без выводов и налогов)
   - Налоги (УСН + НДФЛ/Взносы)
   - **EBITDA** = Выручка − ФОТ − Маркетинг − ОпEx
   - **Чистая прибыль** = EBITDA − Налоги
   - **Маржа, %**
   - Колонка «План» берётся из `kpi_targets` (выручка/расходы/прибыль) с возможностью редактирования прямо в таблице (upsert в `kpi_targets`).

3. **Блок «Юнит-экономика»** (по данным `lead_generation` и продаж):
   - CAC = маркетинг / число договоров
   - Конверсия лид→договор, %
   - Средний чек договора (по `bankrot_clients.contract_amount` для Спасения, `sales.contract_amount` для Дело Бизнеса)
   - Средний ежемесячный платёж (Спасение)
   - LTV (для Спасения = first_payment + monthly_payment × installment_period)
   - LTV / CAC

4. **Блок «Прогноз до конца месяца»**:
   - Run-rate = факт / прошедшие дни × всего дней месяца — по выручке, расходам, прибыли.
   - Сравнение прогноза с планом, вывод «опережаем / отстаём».

5. **Блок «Денежный поток»** (для выбранного месяца):
   - Остатки на счетах компании на начало / конец месяца (из `transactions` + `company_balance_adjustments`).
   - Поступления, списания, переводы, чистый CF за месяц.

6. **Блок «Сценарий» (что-если)** — три ползунка:
   - Изменение выручки, %
   - Изменение ФОТ, %
   - Изменение маркетинга, %
   
   Пересчитывает EBITDA / прибыль / маржу для текущего месяца. Состояние локальное (без сохранения).

7. **График** — линия «Выручка / Расходы / Прибыль» по месяцам за последние 6 месяцев (из `transactions`, агрегация на клиенте).

### Технические детали

**Новый файл:** `src/pages/FinancialModel.tsx`
- Хуки: `useState`, `useMemo`, `useEffect` с `useCallback` (паттерн macOS).
- Загрузка данных одним эффектом при смене компании/месяца:
  - `transactions` за месяц (фильтр по `company`, `date`, формат `format(date, 'yyyy-MM-dd')` — соблюдаем правило таймзон).
  - `transactions` за последние 6 месяцев для графика.
  - `department_employees` за месяц (фильтр по `company`).
  - `lead_generation` за месяц.
  - `kpi_targets` за месяц.
  - `bankrot_clients` (для Спасения) / `sales` (для Дело Бизнеса) для юнит-экономики.
  - `accounts` + `company_balance_adjustments` для CF.
- Realtime-подписки на `transactions`, `department_employees`, `lead_generation`, `kpi_targets` для авто-обновления.

**Новые компоненты в `src/components/financial-model/`:**
- `PnlTable.tsx` — таблица план/факт/отклонение со встроенным редактированием плана.
- `UnitEconomicsCards.tsx` — карточки CAC / LTV / Конверсия.
- `ForecastBlock.tsx` — run-rate.
- `CashFlowBlock.tsx` — поступления/списания.
- `ScenarioSimulator.tsx` — ползунки + пересчёт.
- `MonthlyTrendChart.tsx` — график (recharts, по аналогии с существующими).

**Утилита расчётов:** `src/lib/financialModel.ts`
- `buildPnl(transactions, employees, leadGen, taxes) → { revenue, fot, marketing, opex, taxes, ebitda, net, margin }`
- `buildUnitEconomics(clients|sales, leadGen) → { cac, ltv, avgCheck, conversion, ltvCac }`
- `buildRunRate(actual, daysPassed, daysInMonth)`
- `applyScenario(pnl, deltas)`

**Интеграция в Dashboard (`src/pages/Dashboard.tsx`):**
- Добавить кнопку в шапку:
  ```tsx
  {!isManagerOz && (
    <Button variant="outline" onClick={() => navigate("/financial-model")}>
      <BarChart3 className="w-4 h-4 mr-2" />Финансовая модель
    </Button>
  )}
  ```

**Маршрут (`src/App.tsx`):**
- Добавить `<Route path="/financial-model" element={<ProtectedRoute><FinancialModel /></ProtectedRoute>} />`.

**База данных:** изменений схемы не требуется — используем существующие таблицы. План правится через уже существующие `kpi_targets` (добавим ключи `revenue_plan`, `expenses_plan`, `fot_plan`, `marketing_plan` — это просто строки в `kpi_name`, без миграции).

### Что не входит

- Прогноз на несколько месяцев вперёд с сезонностью (можно добавить отдельной задачей).
- Экспорт модели в Excel/PDF (можно добавить позже на базе существующих утилит экспорта).
- Сохранение сценариев — пока only локально в state.

