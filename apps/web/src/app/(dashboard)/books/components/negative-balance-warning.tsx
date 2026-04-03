import { AlertTriangle } from 'lucide-react';

interface NegativeBalanceWarningProps {
  message: string;
}

export function NegativeBalanceWarning({ message }: NegativeBalanceWarningProps) {
  return (
    <div className="mx-4 mt-3 flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span>
        <strong>Cảnh báo:</strong> {message}
      </span>
    </div>
  );
}
