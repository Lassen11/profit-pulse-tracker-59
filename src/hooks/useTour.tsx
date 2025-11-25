import { useState, useEffect } from 'react';

const TOUR_COMPLETED_KEY = 'app-tour-completed';

export function useTour() {
  const [runTour, setRunTour] = useState(false);
  const [tourCompleted, setTourCompleted] = useState(false);

  useEffect(() => {
    // Проверяем, был ли тур пройден ранее
    const completed = localStorage.getItem(TOUR_COMPLETED_KEY) === 'true';
    setTourCompleted(completed);

    // Автоматически запускаем тур для новых пользователей
    if (!completed) {
      // Задержка для загрузки страницы
      const timer = setTimeout(() => {
        setRunTour(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  const startTour = () => {
    setRunTour(true);
  };

  const finishTour = () => {
    setRunTour(false);
    setTourCompleted(true);
    localStorage.setItem(TOUR_COMPLETED_KEY, 'true');
  };

  const resetTour = () => {
    setTourCompleted(false);
    localStorage.removeItem(TOUR_COMPLETED_KEY);
    setRunTour(true);
  };

  return {
    runTour,
    tourCompleted,
    startTour,
    finishTour,
    resetTour,
  };
}
