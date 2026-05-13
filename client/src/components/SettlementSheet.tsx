type SettlementSheetProps = {
  data: any;
  pageBreakAfter?: boolean;
};

const fmt = (n: number) => `¥${n.toLocaleString()}`;

export function SettlementSheet({ data, pageBreakAfter = false }: SettlementSheetProps) {
  const { settlement, member, event, salesTransactions, purchaseTransactions, breakdown, sealImageUrl } = data;
  const salesReturnTransactions = data.salesReturnTransactions ?? [];
  const purchaseReturnTransactions = data.purchaseReturnTransactions ?? [];
  const salesReturnTotal = breakdown?.salesReturnTotal ?? settlement.salesReturnTotal ?? 0;
  const purchaseReturnTotal = breakdown?.purchaseReturnTotal ?? settlement.purchaseReturnTotal ?? 0;

  return (
    <div
      className="settlement-sheet"
      style={{
        background: "#fff",
        padding: 32,
        maxWidth: 900,
        margin: "0 auto",
        fontFamily: "'Noto Sans JP', sans-serif",
        fontSize: 11,
        color: "#000",
        pageBreakAfter: pageBreakAfter ? "always" : undefined,
        breakAfter: pageBreakAfter ? "page" : undefined,
      }}
    >
      <h1 style={{ textAlign: "center", fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
        岐阜リサイクルオークション　精算書
      </h1>
      <p style={{ fontSize: 11, marginBottom: 24 }}>開催日:{event?.eventDate}</p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div style={{ flex: "0 0 45%" }}>
          <p style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>
            {member?.memberNumber}{settlement?.suffix ? <span style={{ color: "#1d4ed8" }}>-{settlement.suffix}</span> : null}　{member?.displayName}　<span style={{ fontWeight: 400 }}>様</span>
          </p>
          <div style={{ marginTop: 16, fontSize: 11, lineHeight: 1.8, position: "relative" }}>
            <p style={{ fontWeight: 700 }}>岐阜リサイクルオークション</p>
            <p>TEL:0575-24-3200</p>
            <p>住所:岐阜県多治見市大原町8-1-1</p>
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 10 }}>運営　総合リサイクルセンター JPH合同会社</p>
              <p style={{ fontSize: 10 }}>登録番号:T7-2000-0300-4293</p>
            </div>
            {sealImageUrl && (
              <img
                src={sealImageUrl}
                alt="印鑑"
                style={{
                  position: "absolute",
                  top: -10,
                  left: 200,
                  width: 70,
                  height: 70,
                  objectFit: "contain",
                  opacity: 0.85,
                }}
              />
            )}
          </div>
        </div>

        <div style={{ flex: "0 0 52%" }}>
          <table className="summary-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <colgroup>
              <col style={{ width: "28%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "22%" }} />
              <col style={{ width: "28%" }} />
            </colgroup>
            <tbody>
              <tr>
                <td style={{ textAlign: "right", padding: "3px 8px", fontWeight: 700, borderBottom: "1px solid #ccc" }}>売り合計金額</td>
                <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(settlement.salesTotal)}</td>
                <td style={{ textAlign: "right", padding: "3px 4px", fontSize: 9, borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc", color: "#555" }}>内課税業者</td>
                <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(breakdown.salesTotalTaxable)}</td>
              </tr>
              <tr>
                <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #ccc" }}>手数料</td>
                <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(settlement.salesCommission)}</td>
                <td style={{ textAlign: "right", padding: "3px 4px", fontSize: 9, borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc", color: "#555" }}>内免税業者</td>
                <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(breakdown.salesTotalNonTaxable)}</td>
              </tr>
              <tr>
                <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #ccc" }}>消費税(10%)</td>
                <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(breakdown.salesCommissionTax)}</td>
                <td style={{ borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}></td>
                <td style={{ borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}></td>
              </tr>
              <tr>
                <td style={{ textAlign: "right", padding: "3px 8px", fontWeight: 700, borderBottom: "1px solid #ccc" }}>買い合計金額</td>
                <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(settlement.purchaseTotal)}</td>
                <td style={{ textAlign: "right", padding: "3px 4px", fontSize: 9, borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc", color: "#555" }}>内課税業者</td>
                <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(breakdown.purchaseTotalTaxable)}</td>
              </tr>
              <tr>
                <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #ccc" }}>手数料</td>
                <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(settlement.purchaseCommission)}</td>
                <td style={{ textAlign: "right", padding: "3px 4px", fontSize: 9, borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc", color: "#555" }}>内免税業者</td>
                <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(breakdown.purchaseTotalNonTaxable)}</td>
              </tr>
              <tr>
                <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "2px solid #000" }}>消費税(10%)</td>
                <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "2px solid #000", borderLeft: "1px solid #ccc" }}>{fmt(breakdown.purchaseCommissionTax)}</td>
                <td style={{ borderBottom: "2px solid #000", borderLeft: "1px solid #ccc" }}></td>
                <td style={{ borderBottom: "2px solid #000", borderLeft: "1px solid #ccc" }}></td>
              </tr>
              {salesReturnTotal > 0 && (
                <tr style={{ background: "#ffffcc" }}>
                  <td style={{ textAlign: "right", padding: "3px 8px", fontWeight: 700, borderBottom: "1px solid #ccc" }}>売返品</td>
                  <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(salesReturnTotal)}</td>
                  <td style={{ borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}></td>
                  <td style={{ borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}></td>
                </tr>
              )}
              {purchaseReturnTotal > 0 && (
                <tr style={{ background: "#ffffcc" }}>
                  <td style={{ textAlign: "right", padding: "3px 8px", fontWeight: 700, borderBottom: "1px solid #ccc" }}>買返品</td>
                  <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(purchaseReturnTotal)}</td>
                  <td style={{ borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}></td>
                  <td style={{ borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}></td>
                </tr>
              )}
              {settlement.participationFee > 0 && (
                <tr>
                  <td style={{ textAlign: "right", padding: "3px 8px", fontWeight: 700, borderBottom: "2px solid #000" }}>参加費</td>
                  <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "2px solid #000", borderLeft: "1px solid #ccc" }}>
                    <span style={{ color: "#dc2626" }}>{fmt(settlement.participationFee)}</span>
                  </td>
                  <td colSpan={2} style={{ textAlign: "right", padding: "3px 8px", borderBottom: "2px solid #000", borderLeft: "1px solid #ccc", fontSize: 9, color: "#555" }}>
                    精算書より差引させていただきます
                  </td>
                </tr>
              )}
              {(settlement.companionFee ?? 0) > 0 && (
                <tr>
                  <td style={{ textAlign: "right", padding: "3px 8px", fontWeight: 700, borderBottom: "1px solid #ccc" }}>同伴者料金</td>
                  <td style={{ textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc" }}>{fmt(settlement.companionFee)}</td>
                  <td colSpan={2} style={{ textAlign: "right", padding: "3px 8px", borderBottom: "1px solid #ccc", borderLeft: "1px solid #ccc", fontSize: 9, color: "#555" }}>
                    {settlement.companionCount ?? 0}人 × ¥{(event?.companionFee ?? 0).toLocaleString()}
                  </td>
                </tr>
              )}
              <tr>
                <td style={{ textAlign: "right", padding: "6px 8px", fontWeight: 700, fontSize: 13, background: "#f5f5f5" }}>精算金額</td>
                <td colSpan={3} style={{ textAlign: "right", padding: "6px 8px", fontWeight: 700, fontSize: 16, background: "#f5f5f5", borderLeft: "1px solid #ccc" }}>
                  {fmt(settlement.settlementAmount)}
                </td>
              </tr>
            </tbody>
          </table>
          {member?.invoiceNumber && (
            <p style={{ textAlign: "right", fontSize: 10, marginTop: 4 }}>登録番号:{member.invoiceNumber}</p>
          )}
        </div>
      </div>

      {purchaseTransactions.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>【買い明細】</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>
                <th style={{ textAlign: "left", padding: "4px 6px", width: "30%" }}>商品名</th>
                <th style={{ textAlign: "right", padding: "4px 6px", width: "8%" }}>数量</th>
                <th style={{ textAlign: "right", padding: "4px 6px", width: "12%" }}>金額</th>
                <th style={{ textAlign: "left", padding: "4px 6px", width: "28%" }}>売主</th>
                <th style={{ textAlign: "left", padding: "4px 6px", width: "22%" }}>インボイス</th>
              </tr>
            </thead>
            <tbody>
              {purchaseTransactions.map((t: any) => (
                <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "3px 6px" }}>{t.itemName}</td>
                  <td style={{ textAlign: "right", padding: "3px 6px" }}>{t.quantity}</td>
                  <td style={{ textAlign: "right", padding: "3px 6px" }}>{t.totalPrice.toLocaleString()}</td>
                  <td style={{ padding: "3px 6px" }}>{t.sellerMemberNumber}　{t.sellerName}</td>
                  <td style={{ padding: "3px 6px", fontSize: 10 }}>{t.sellerInvoiceNumber || ""}</td>
                </tr>
              ))}
              {purchaseReturnTransactions.map((t: any) => (
                <tr key={`pr-${t.id}`} style={{ borderBottom: "1px solid #eee", background: "#ffffcc" }}>
                  <td style={{ padding: "3px 6px", fontWeight: 700 }}>買返品: {t.itemName}</td>
                  <td style={{ textAlign: "right", padding: "3px 6px" }}>{t.quantity}</td>
                  <td style={{ textAlign: "right", padding: "3px 6px" }}>{t.totalPrice.toLocaleString()}</td>
                  <td style={{ padding: "3px 6px" }}>{t.sellerMemberNumber}　{t.sellerName}</td>
                  <td style={{ padding: "3px 6px", fontSize: 10 }}>{t.sellerInvoiceNumber || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {salesTransactions.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>【売り明細】</h3>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr style={{ borderTop: "1px solid #000", borderBottom: "1px solid #000" }}>
                <th style={{ textAlign: "left", padding: "4px 6px", width: "30%" }}>商品名</th>
                <th style={{ textAlign: "right", padding: "4px 6px", width: "8%" }}>数量</th>
                <th style={{ textAlign: "right", padding: "4px 6px", width: "12%" }}>金額</th>
                <th style={{ textAlign: "left", padding: "4px 6px", width: "28%" }}>買主</th>
                <th style={{ textAlign: "left", padding: "4px 6px", width: "22%" }}>インボイス</th>
              </tr>
            </thead>
            <tbody>
              {salesTransactions.map((t: any) => (
                <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
                  <td style={{ padding: "3px 6px" }}>{t.itemName}</td>
                  <td style={{ textAlign: "right", padding: "3px 6px" }}>{t.quantity}</td>
                  <td style={{ textAlign: "right", padding: "3px 6px" }}>{t.totalPrice.toLocaleString()}</td>
                  <td style={{ padding: "3px 6px" }}>{t.buyerMemberNumber}　{t.buyerName}</td>
                  <td style={{ padding: "3px 6px", fontSize: 10 }}>{t.buyerInvoiceNumber || ""}</td>
                </tr>
              ))}
              {salesReturnTransactions.map((t: any) => (
                <tr key={`sr-${t.id}`} style={{ borderBottom: "1px solid #eee", background: "#ffffcc" }}>
                  <td style={{ padding: "3px 6px", fontWeight: 700 }}>売返品: {t.itemName}</td>
                  <td style={{ textAlign: "right", padding: "3px 6px" }}>{t.quantity}</td>
                  <td style={{ textAlign: "right", padding: "3px 6px" }}>{t.totalPrice.toLocaleString()}</td>
                  <td style={{ padding: "3px 6px" }}>{t.buyerMemberNumber}　{t.buyerName}</td>
                  <td style={{ padding: "3px 6px", fontSize: 10 }}>{t.buyerInvoiceNumber || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function getSettlementSheetStyles(): string {
  return `
    @media print {
      /* A4 サイズに収まるように余白とサイズを調整（上下・左右ともゆとりを確保）
         上部は2枚目以降の1行目が切れないよう1行分多めに確保 */
      @page { size: A4 portrait; margin: 28mm 18mm 22mm 18mm; }
      html, body {
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .no-print { display: none !important; }
      .settlement-sheet {
        /* @page の余白に任せ、シート自身のパディングは小さめに */
        padding: 4mm !important;
        max-width: 174mm !important; /* A4幅(210) - 左右マージン(18*2) */
        width: 174mm !important;
        margin: 0 auto !important;
        box-shadow: none !important;
        border-radius: 0 !important;
        font-size: 10.5px !important;
        box-sizing: border-box !important;
      }
      /* テーブルが枠外にはみ出ないようレイアウトを固定 */
      .settlement-sheet table {
        width: 100% !important;
        table-layout: fixed !important;
        border-collapse: collapse !important;
      }
      .settlement-sheet table th,
      .settlement-sheet table td {
        word-break: break-all;
        overflow-wrap: anywhere;
      }
      /* 行（tr）と表ヘッダー（thead）はページをまたいで切れないように。
         tbody 全体は avoid しない（途中改行を許可しないと、表が長い時に
         1ページ目の下半分が大きく空白になってしまうため） */
      .settlement-sheet table tr,
      .settlement-sheet table thead {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      /* tbody は自然に改ページさせる */
      .settlement-sheet table tbody {
        page-break-inside: auto !important;
        break-inside: auto !important;
      }
      /* テーブルヘッダーを2枚目以降も繰り返し表示 */
      .settlement-sheet table thead {
        display: table-header-group !important;
      }
    }
    .summary-table td {
      border-right: 1px solid #ccc;
    }
    .summary-table td:last-child {
      border-right: none;
    }
  `;
}
