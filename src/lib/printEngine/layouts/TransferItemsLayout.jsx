"use client";
import React, { forwardRef } from "react";
import { buildPrintCSS, computePrintSizes } from "../printStyles";

const TransferItemsLayout = forwardRef(({ data, settings, previewSettings, formatDateArabic }, ref) => {
  const sizes = computePrintSizes(previewSettings, settings);
  const css = buildPrintCSS(sizes);
  const company = settings?.companyName || "مجموعة التعزي لإدارة المناسبات والتأجير";

  const pickItems = (data.pickItems || []).filter(i => parseInt(i.quantity) > 0);
  const returnItems = (data.returnItems || []).filter(i => parseInt(i.quantity) > 0);
  const inheritItems = (data.inheritItems || []).filter(i => parseInt(i.quantity) > 0);

  const hasPick = pickItems.length > 0;
  const hasReturn = returnItems.length > 0;
  const hasInherit = inheritItems.length > 0;

  return (
    <div ref={ref} className="ps-root" dir="rtl">
      <style>{css}</style>
      <table><tbody>
        <tr><td className="ps-title">{company}</td></tr>
        <tr><td className="ps-subtitle">نقل مباشر — {data.sourceBookingId} → {data.targetBookingId}</td></tr>
      </tbody></table>
      <table className="ps-details"><tbody>
        <tr>
          <td style={{width:"50%",borderBottom:"1px dashed #ccc",padding:"0.3rem 0.5rem",fontSize:sizes?.detailSize}}>
            <span style={{fontWeight:600,color:"#333"}}>المصدر:</span>
            <span style={{marginRight:"0.3rem",color:"#000"}}>{data.sourceCustomer || "-"}</span>
          </td>
          <td style={{width:"50%",borderBottom:"1px dashed #ccc",padding:"0.3rem 0.5rem",fontSize:sizes?.detailSize}}>
            <span style={{fontWeight:600,color:"#333"}}>الهدف:</span>
            <span style={{marginRight:"0.3rem",color:"#000"}}>{data.targetCustomer || "-"}</span>
          </td>
        </tr>
        <tr>
          <td style={{width:"50%",borderBottom:"1px dashed #ccc",padding:"0.3rem 0.5rem",fontSize:sizes?.detailSize}}>
            <span style={{fontWeight:600,color:"#333"}}>تاريخ النقل:</span>
            <span style={{marginRight:"0.3rem",color:"#000"}}>{data.transferDate || new Date().toLocaleDateString("ar-EG")}</span>
          </td>
          <td style={{width:"50%",borderBottom:"1px dashed #ccc",padding:"0.3rem 0.5rem",fontSize:sizes?.detailSize}}>
            <span style={{fontWeight:600,color:"#333"}}>نوع النقل:</span>
            <span style={{marginRight:"0.3rem",color:"#000"}}>{data.transferType === "dismantled" ? "مفكوك" : "منصوب"}</span>
          </td>
        </tr>
      </tbody></table>

      {hasPick && (
        <>
          <div style={{marginTop:"1rem",fontWeight:"bold",color:"#059669"}}>📥 أصناف المطلوب تحميلها من المخزن:</div>
          <table className="ps-report-table">
            <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th></tr></thead>
            <tbody>
              {pickItems.map((item, i) => (
                <tr key={i}><td>{i+1}</td><td>{item.name}</td><td>{item.quantity}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {hasReturn && (
        <>
          <div style={{marginTop:"1rem",fontWeight:"bold",color:"#dc2626"}}>📤 أصناف المطلوب إرجاعها للمخزن:</div>
          <table className="ps-report-table">
            <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th></tr></thead>
            <tbody>
              {returnItems.map((item, i) => (
                <tr key={i}><td>{i+1}</td><td>{item.name}</td><td>{item.quantity}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {hasInherit && (
        <>
          <div style={{marginTop:"1rem",fontWeight:"bold",color:"#4b5563"}}>✓ الأصناف المنقولة مع الخيمة:</div>
          <table className="ps-report-table">
            <thead><tr><th>#</th><th>الصنف</th><th>الكمية</th></tr></thead>
            <tbody>
              {inheritItems.map((item, i) => (
                <tr key={i}><td>{i+1}</td><td>{item.name}</td><td>{item.quantity}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {!hasPick && !hasReturn && !hasInherit && (
        <div style={{textAlign:"center",padding:"2rem",color:"#666"}}>لا توجد أصناف</div>
      )}

      <div className="ps-signature" style={{marginTop:"2rem"}}>
        <table style={{width:"100%",direction:"rtl"}}><tbody>
          <tr>
            <td style={{width:"33%",textAlign:"center",paddingBottom:"0.5rem"}}>
              <div style={{borderTop:"1px solid #333",width:"80%",margin:"0 auto",paddingTop:"0.5rem"}}>
                <div style={{fontWeight:"bold",fontSize:sizes?.small?"0.7rem":"0.85rem"}}>توقيع أمين المخزن</div>
              </div>
            </td>
            <td style={{width:"33%",textAlign:"center",paddingBottom:"0.5rem"}}>
              <div style={{borderTop:"1px solid #333",width:"80%",margin:"0 auto",paddingTop:"0.5rem"}}>
                <div style={{fontWeight:"bold",fontSize:sizes?.small?"0.7rem":"0.85rem"}}>توقيع حارس الخيمة</div>
              </div>
            </td>
            <td style={{width:"34%",textAlign:"center",paddingBottom:"0.5rem"}}>
              <div style={{borderTop:"1px solid #333",width:"80%",margin:"0 auto",paddingTop:"0.5rem"}}>
                <div style={{fontWeight:"bold",fontSize:sizes?.small?"0.7rem":"0.85rem"}}>توقيع المشرف</div>
              </div>
            </td>
          </tr>
        </tbody></table>
      </div>
    </div>
  );
});

TransferItemsLayout.displayName = "TransferItemsLayout";
export default TransferItemsLayout;
