import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight, Plus, List } from "lucide-react";

interface AccountActionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: string;
  onTransferClick: () => void;
  onAddTransactionClick: () => void;
  onViewTransactionsClick: () => void;
}

export function AccountActionsDialog({
  open,
  onOpenChange,
  account,
  onTransferClick,
  onAddTransactionClick,
  onViewTransactionsClick,
}: AccountActionsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Действия со счетом: {account}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 py-4">
          <Button
            onClick={() => {
              onTransferClick();
              onOpenChange(false);
            }}
            className="w-full justify-start"
            variant="outline"
          >
            <ArrowLeftRight className="w-4 h-4 mr-2" />
            Перевод между счетами
          </Button>
          <Button
            onClick={() => {
              onAddTransactionClick();
              onOpenChange(false);
            }}
            className="w-full justify-start"
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            Добавить операцию
          </Button>
          <Button
            onClick={() => {
              onViewTransactionsClick();
              onOpenChange(false);
            }}
            className="w-full justify-start"
            variant="outline"
          >
            <List className="w-4 h-4 mr-2" />
            Просмотр операций
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
