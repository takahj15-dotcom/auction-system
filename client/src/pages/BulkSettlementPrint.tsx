import { useEffect, useRef } from "react";
import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { SettlementSheet, getSettlementSheetStyles } from "@/components/SettlementSheet";

export default function BulkSettlementPrint() {
  const params = useParams<{ eventId: string }>();
  const eventId = parseInt(params.eventId ?? "0");
  const printedRef = useRef(false);

  const { data, isLoading } = trpc.pdf.getBulkSettlementPdfData.useQuery(
    { eventId },
    { enabled: !!eventId }
  );

  useEffect(() => {
    if (!data || data.length === 0 || printedRef.current) return;
    printedRef.current = true;
    // Give images (seal) a moment to load before printing
    const t = setTimeout(() => {
      window.print();
    }, 800);
    return () => clearTimeout(t);
  }, [data]);

  if (isLoading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0", color: "#888" }}>
        精算書を読み込んでいます...
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "64px 0", color: "#888" }}>
        精算データがありません
      </div>
    );
  }

  return (
    <div>
      <style>{getSettlementSheetStyles()}</style>
      <style>{`
        @media print {
          .bulk-print-controls { display: none !important; }
        }
        body { background: #e5e5e5; }
      `}</style>
      <div className="bulk-print-controls" style={{ position: "fixed", top: 12, right: 12, zIndex: 1000, display: "flex", gap: 8 }}>
        <button
          onClick={() => window.print()}
          style={{ padding: "8px 16px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
        >
          印刷ダイアログを開く
        </button>
        <button
          onClick={() => window.close()}
          style={{ padding: "8px 16px", background: "#fff", color: "#333", border: "1px solid #ccc", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
        >
          閉じる
        </button>
      </div>
      {data.map((d: any, idx: number) => (
        <SettlementSheet
          key={d.settlement.id}
          data={d}
          pageBreakAfter={idx < data.length - 1}
        />
      ))}
    </div>
  );
}
