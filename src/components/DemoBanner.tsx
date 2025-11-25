import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogIn, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

export function DemoBanner() {
  const navigate = useNavigate();

  return (
    <Alert className="mb-6 bg-primary/10 border-primary/20">
      <Eye className="h-5 w-5 text-primary" />
      <AlertDescription className="flex items-center justify-between gap-4 flex-wrap">
        <span className="text-sm">
          <strong>Демонстрационный режим:</strong> Вы просматриваете приложение с тестовыми данными. 
          Войдите, чтобы получить доступ к полному функционалу.
        </span>
        <Button 
          size="sm" 
          onClick={() => navigate('/auth')}
          className="gap-2"
        >
          <LogIn className="h-4 w-4" />
          Войти
        </Button>
      </AlertDescription>
    </Alert>
  );
}
