export function BookSignatureFooter() {
  return (
    <div className="mt-6 grid grid-cols-3 gap-4 px-4 pb-6 print:mt-10 text-center text-xs">
      <div className="space-y-8">
        <p className="font-medium">Người lập biểu</p>
        <p className="text-muted-foreground italic">(Ký, họ tên)</p>
      </div>
      <div className="space-y-8">
        <p className="font-medium">Kế toán trưởng</p>
        <p className="text-muted-foreground italic">(Ký, họ tên)</p>
      </div>
      <div className="space-y-8">
        <p className="font-medium">Giám đốc</p>
        <p className="text-muted-foreground italic">(Ký, họ tên, đóng dấu)</p>
      </div>
    </div>
  );
}
