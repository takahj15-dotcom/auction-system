import { useRef, useCallback, useState } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Printer, FileDown } from "lucide-react";
import { useLocation, useParams } from "wouter";
import { SettlementSheet, getSettlementSheetStyles } from "@/components/SettlementSheet";

export default function SettlementDetail() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const printRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = trpc.pdf.getSettlementPdfData.useQuery(
    { settlementId: parseInt(params.id ?? "0") },
    { enabled: !!params.id, refetchInterval: 10000 }
  );

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadPdf = useCallback(async () => {
    if (!params.id) return;
    setPdfLoading(true);
    try {
      const response = await fetch(`/api/pdf/settlement/${params.id}`);
      if (!response.ok) throw new Error("PDF generation failed");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `精算書_${data?.member?.displayName ?? ""}_${data?.event?.eventDate ?? ""}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF download error:", err);
      alert("PDF生成に失敗しました。印刷機能をご利用ください。");
    } finally {
      setPdfLoading(false);
    }
  }, [params.id, data]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0", color: "#888" }}>
        読み込み中...
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0", color: "#888" }}>
        精算データが見つかりません
      </div>
    );
  }

  return (
    <div>
      <style>{getSettlementSheetStyles()}</style>
      {/* Action buttons - hidden on print */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <button
          onClick={() => setLocation("/settlements")}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 12px", border: "1px solid #ddd", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 13 }}
        >
          <ArrowLeft size={16} />
          戻る
        </button>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <button
            onClick={handlePrint}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 16px", border: "1px solid #ddd", borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 13 }}
          >
            <Printer size={16} />
            印刷
          </button>
          <button
            onClick={handleDownloadPdf}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 16px", border: "none", borderRadius: 6, background: "#16a34a", color: "#fff", cursor: "pointer", fontSize: 13 }}
          >
            <FileDown size={16} />
            {pdfLoading ? "生成中..." : "PDF保存"}
          </button>
        </div>
      </div>

      {/* Settlement Sheet - rendered via shared component */}
      <div ref={printRef}>
        <SettlementSheet data={data} />

      </div>
    </div>
  );
}

